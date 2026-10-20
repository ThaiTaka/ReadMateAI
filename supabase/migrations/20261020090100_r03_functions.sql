-- =====================================================================================
-- R03 — Hàm nghiệp vụ. Đây là đường GHI DUY NHẤT vào các bảng của migration nền tảng.
--
--   * teacher_*  : gọi bằng JWT của giáo viên (Server Action → supabase.rpc). security definer,
--                  search_path rỗng, TỰ kiểm tra quyền bằng auth.uid() (phòng thủ nhiều lớp —
--                  Server Action đã kiểm tra trước). GRANT cho authenticated; thiết bị học sinh
--                  cũng là authenticated nhưng không phải staff → FORBIDDEN.
--   * gateway_*  : student gateway — CHỈ service_role (máy chủ) gọi, sau khi máy chủ đã xác minh
--                  phiên. Học sinh không ghi trực tiếp vào CSDL (CLAUDE.md §6.3).
--   * Mỗi thao tác quản trị ghi một dòng audit_logs trong CÙNG giao dịch.
-- Mã lỗi: message là mã máy đọc (FORBIDDEN, NOT_FOUND, …); máy chủ ánh xạ sang câu chữ tiếng Việt.
-- =====================================================================================

-- -------------------------------------------------------------------------------------
-- Trợ giúp phân quyền cho hàm
-- -------------------------------------------------------------------------------------

create or replace function private.require_staff()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null or not exists (select 1 from public.staff_profiles s where s.id = v_uid and s.is_active) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  return v_uid;
end;
$$;

-- p_owner_only: các thao tác cấu hình lớp chỉ dành cho GV chủ nhiệm (owner).
create or replace function private.require_class_staff(p_class_id uuid, p_owner_only boolean default false)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_staff();
begin
  if not exists (
    select 1 from public.class_staff cs
    where cs.class_id = p_class_id and cs.staff_id = v_uid and cs.removed_at is null
      and (not p_owner_only or cs.role = 'owner')
  ) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  return v_uid;
end;
$$;

-- Trả class_id của học sinh nếu người gọi là GV của lớp đó (khóa dòng học sinh để tuần tự hóa thao tác).
create or replace function private.require_student_staff(p_student_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_class_id uuid;
begin
  select st.class_id into v_class_id from public.students st where st.id = p_student_id for update;
  if v_class_id is null then
    -- Không phân biệt "không tồn tại" với "không có quyền" để không lộ sự tồn tại của hồ sơ.
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  perform private.require_class_staff(v_class_id);
  return v_class_id;
end;
$$;

-- Thu hồi mọi thiết bị + thẻ học còn hiệu lực của một học sinh (rút đồng ý, tạm ngưng, lưu trữ).
create or replace function private.revoke_student_access(p_student_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  update public.student_devices
    set revoked_at = now(), revoked_by = v_uid, revoke_reason = p_reason
    where student_id = p_student_id and revoked_at is null;
  update public.student_login_codes
    set revoked_at = now(), revoked_by = v_uid, revoke_reason = p_reason
    where student_id = p_student_id and revoked_at is null;
end;
$$;

-- =====================================================================================
-- Giáo viên — lớp học
-- =====================================================================================

create or replace function public.teacher_create_class(p_name text, p_school_year text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_staff();
  v_school uuid;
  v_class_id uuid;
begin
  select s.school_id into v_school from public.staff_profiles s where s.id = v_uid;
  insert into public.classes (school_id, name, school_year, created_by)
  values (v_school, p_name, p_school_year, v_uid)
  returning id into v_class_id;
  insert into public.class_staff (class_id, staff_id, role, added_by) values (v_class_id, v_uid, 'owner', v_uid);
  perform private.write_audit('class.create', 'class', v_class_id, v_class_id);
  return v_class_id;
end;
$$;

create or replace function public.teacher_rename_class(p_class_id uuid, p_name text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_class_staff(p_class_id, true);
  update public.classes set name = p_name where id = p_class_id;
  perform private.write_audit('class.rename', 'class', p_class_id, p_class_id);
end;
$$;

-- Chọn bộ bài + bài hiện tại. LUÔN đưa về trạng thái chưa xác nhận: đổi tiến độ phải xác nhận lại.
create or replace function public.teacher_set_class_curriculum(p_class_id uuid, p_series_id uuid, p_lesson_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_class_staff(p_class_id, true);
  if p_series_id is null and p_lesson_id is not null then
    raise exception 'INVALID_INPUT' using errcode = '22023';
  end if;
  update public.classes
    set curriculum_series_id = p_series_id,
        current_lesson_id = p_lesson_id,
        curriculum_status = 'unconfirmed',
        curriculum_confirmed_by = null,
        curriculum_confirmed_at = null
    where id = p_class_id;
  perform private.write_audit('curriculum.set', 'class', p_class_id, p_class_id,
    jsonb_build_object('series_id', p_series_id, 'lesson_id', p_lesson_id));
end;
$$;

-- Xác nhận tiến độ là quyết định chuyên môn của GV chủ nhiệm; trigger guard_class chỉ chấp nhận
-- bộ sách thật (textbook) đã duyệt — chuỗi minh họa không bao giờ được xác nhận (AD-31).
create or replace function public.teacher_confirm_class_curriculum(p_class_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_class_staff(p_class_id, true);
begin
  update public.classes
    set curriculum_status = 'confirmed', curriculum_confirmed_by = v_uid, curriculum_confirmed_at = now()
    where id = p_class_id;
  perform private.write_audit('curriculum.confirm', 'class', p_class_id, p_class_id);
end;
$$;

-- =====================================================================================
-- Giáo viên — học sinh
-- =====================================================================================

create or replace function public.teacher_create_student(
  p_class_id uuid, p_display_name text, p_student_number smallint, p_avatar_key text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_class_staff(p_class_id);
  v_student_id uuid;
begin
  if not exists (select 1 from public.classes c where c.id = p_class_id and c.status = 'active') then
    raise exception 'CLASS_ARCHIVED' using errcode = '22023';
  end if;
  insert into public.students (class_id, display_name, student_number, avatar_key, created_by)
  values (p_class_id, p_display_name, p_student_number, p_avatar_key, v_uid)
  returning id into v_student_id;
  perform private.write_audit('student.create', 'student', v_student_id, p_class_id);
  return v_student_id;
end;
$$;

create or replace function public.teacher_update_student(
  p_student_id uuid, p_display_name text, p_student_number smallint, p_avatar_key text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_class_id uuid := private.require_student_staff(p_student_id);
begin
  update public.students
    set display_name = p_display_name, student_number = p_student_number, avatar_key = p_avatar_key
    where id = p_student_id;
  perform private.write_audit('student.update', 'student', p_student_id, v_class_id);
end;
$$;

-- active ↔ paused ↔ archived. Tạm ngưng: thiết bị mất quyền ngay (my_student_ids lọc status) nhưng
-- liên kết được giữ để mở lại; lưu trữ: thu hồi hẳn thiết bị và thẻ học.
create or replace function public.teacher_set_student_status(p_student_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_class_id uuid := private.require_student_staff(p_student_id);
begin
  if p_status not in ('active', 'paused', 'archived') then
    raise exception 'INVALID_INPUT' using errcode = '22023';
  end if;
  update public.students
    set status = p_status,
        archived_at = case when p_status = 'archived' then coalesce(archived_at, now()) else null end
    where id = p_student_id;
  if p_status = 'archived' then
    perform private.revoke_student_access(p_student_id, 'student_inactive');
  end if;
  perform private.write_audit('student.status', 'student', p_student_id, v_class_id,
    jsonb_build_object('status', p_status));
end;
$$;

-- Đặt/xóa tên hiển thị trên bảng xếp hạng; trigger guard_student xóa trạng thái duyệt khi tên đổi.
create or replace function public.teacher_set_leaderboard_alias(p_student_id uuid, p_alias text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_class_id uuid := private.require_student_staff(p_student_id);
begin
  update public.students set leaderboard_alias = nullif(btrim(p_alias), '') where id = p_student_id;
  perform private.write_audit('alias.set', 'student', p_student_id, v_class_id);
end;
$$;

create or replace function public.teacher_approve_leaderboard_alias(p_student_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_class_id uuid := private.require_student_staff(p_student_id);
  v_uid uuid := (select auth.uid());
begin
  update public.students
    set leaderboard_alias_approved_by = v_uid, leaderboard_alias_approved_at = now()
    where id = p_student_id and leaderboard_alias is not null;
  if not found then
    raise exception 'ALIAS_MISSING' using errcode = '22023';
  end if;
  perform private.write_audit('alias.approve', 'student', p_student_id, v_class_id);
end;
$$;

-- Gán/đổi nhóm (lộ trình). p_band null = bỏ gán. Không có thao tác gán hàng loạt (GV quyết định từng em).
create or replace function public.teacher_assign_band(p_student_id uuid, p_band text, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_class_id uuid := private.require_student_staff(p_student_id);
  v_uid uuid := (select auth.uid());
begin
  if p_band is not null and p_band not in ('foundation', 'developing', 'extending') then
    raise exception 'INVALID_INPUT' using errcode = '22023';
  end if;
  update public.student_band_assignments set valid_to = now()
    where student_id = p_student_id and valid_to is null;
  if p_band is not null then
    insert into public.student_band_assignments (student_id, class_id, band, source, reason, set_by)
    values (p_student_id, v_class_id, p_band, 'teacher', nullif(btrim(p_reason), ''), v_uid);
  end if;
  perform private.write_audit('band.assign', 'student', p_student_id, v_class_id,
    jsonb_build_object('band', p_band));
end;
$$;

-- =====================================================================================
-- Giáo viên — thẻ học và thiết bị
-- =====================================================================================

-- Máy chủ sinh mã ngẫu nhiên và tính HMAC bằng pepper (không bao giờ tới CSDL dạng gốc);
-- cấp mới = thu hồi mã cũ trong cùng giao dịch.
create or replace function public.teacher_issue_login_code(
  p_student_id uuid, p_token_hmac bytea, p_backup_code_hmac bytea, p_expires_at timestamptz, p_max_devices smallint
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_class_id uuid := private.require_student_staff(p_student_id);
  v_uid uuid := (select auth.uid());
  v_code_id uuid;
begin
  if not exists (select 1 from public.students st where st.id = p_student_id and st.status = 'active') then
    raise exception 'STUDENT_INACTIVE' using errcode = '22023';
  end if;
  if p_expires_at < now() + interval '1 hour' or p_expires_at > now() + interval '90 days' then
    raise exception 'INVALID_INPUT' using errcode = '22023';
  end if;
  update public.student_login_codes
    set revoked_at = now(), revoked_by = v_uid, revoke_reason = 'reissued'
    where student_id = p_student_id and revoked_at is null;
  insert into public.student_login_codes
    (student_id, class_id, token_hmac, backup_code_hmac, max_devices, expires_at, created_by)
  values (p_student_id, v_class_id, p_token_hmac, p_backup_code_hmac, p_max_devices, p_expires_at, v_uid)
  returning id into v_code_id;
  perform private.write_audit('login_code.issue', 'login_code', v_code_id, v_class_id,
    jsonb_build_object('student_id', p_student_id, 'max_devices', p_max_devices));
  return v_code_id;
end;
$$;

create or replace function public.teacher_revoke_login_code(p_code_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_student_id uuid;
  v_class_id uuid;
begin
  select c.student_id into v_student_id from public.student_login_codes c where c.id = p_code_id;
  if v_student_id is null then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  v_class_id := private.require_student_staff(v_student_id);
  update public.student_login_codes
    set revoked_at = now(), revoked_by = (select auth.uid()), revoke_reason = 'teacher'
    where id = p_code_id and revoked_at is null;
  perform private.write_audit('login_code.revoke', 'login_code', p_code_id, v_class_id);
end;
$$;

create or replace function public.teacher_revoke_device(p_device_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_student_id uuid;
  v_class_id uuid;
begin
  select d.student_id into v_student_id from public.student_devices d where d.id = p_device_id;
  if v_student_id is null then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  v_class_id := private.require_student_staff(v_student_id);
  update public.student_devices
    set revoked_at = now(), revoked_by = (select auth.uid()), revoke_reason = 'teacher'
    where id = p_device_id and revoked_at is null;
  perform private.write_audit('device.revoke', 'device', p_device_id, v_class_id,
    jsonb_build_object('student_id', v_student_id));
end;
$$;

-- =====================================================================================
-- Giáo viên — đồng ý (chỉ ghi nhận khi đã có xác nhận hợp lệ ngoài đời thực)
-- =====================================================================================

create or replace function public.teacher_record_consent(
  p_student_id uuid, p_scope text, p_notice_version text, p_method text, p_note text, p_attested boolean
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_class_id uuid := private.require_student_staff(p_student_id);
  v_consent_id uuid;
begin
  -- GV phải xác nhận đã nhận phiếu đồng ý hợp lệ — không có đường ghi "đồng ý" ngầm định.
  if p_attested is not true then
    raise exception 'ATTESTATION_REQUIRED' using errcode = '22023';
  end if;
  insert into public.guardian_consents (student_id, class_id, scope, status, notice_version, method, note, recorded_by)
  values (p_student_id, v_class_id, p_scope, 'granted', p_notice_version, p_method, nullif(btrim(p_note), ''), (select auth.uid()))
  returning id into v_consent_id;
  perform private.write_audit('consent.record', 'consent', v_consent_id, v_class_id,
    jsonb_build_object('student_id', p_student_id, 'scope', p_scope, 'notice_version', p_notice_version));
  return v_consent_id;
end;
$$;

-- Rút learning_data → dừng xử lý ngay: thu hồi mọi thiết bị và thẻ học (DATA_MODEL §10). Việc xóa dữ liệu
-- học tập đã lưu sẽ nối vào đây khi có bảng dữ liệu học tập (R04).
create or replace function public.teacher_withdraw_consent(p_student_id uuid, p_scope text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_class_id uuid := private.require_student_staff(p_student_id);
  v_consent_id uuid;
begin
  update public.guardian_consents
    set status = 'withdrawn', withdrawn_at = now(), withdrawn_by = (select auth.uid())
    where student_id = p_student_id and scope = p_scope and status = 'granted'
    returning id into v_consent_id;
  if v_consent_id is null then
    raise exception 'CONSENT_NOT_ACTIVE' using errcode = '22023';
  end if;
  if p_scope = 'learning_data' then
    perform private.revoke_student_access(p_student_id, 'consent_withdrawn');
  end if;
  perform private.write_audit('consent.withdraw', 'consent', v_consent_id, v_class_id,
    jsonb_build_object('student_id', p_student_id, 'scope', p_scope));
end;
$$;

-- =====================================================================================
-- Student gateway — CHỈ service_role
-- =====================================================================================

-- Giới hạn tần suất nguyên tử: tăng bộ đếm của cửa sổ hiện tại, trả true nếu còn trong hạn mức.
create or replace function public.gateway_consume_rate_limit(p_key_hash text, p_window_seconds int, p_limit int)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_window timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  v_count int;
begin
  insert into public.rate_limit_buckets as b (key_hash, window_start, count)
  values (p_key_hash, v_window, 1)
  on conflict (key_hash, window_start) do update set count = b.count + 1
  returning b.count into v_count;
  -- Dọn cửa sổ cũ của chính khóa này (giữ bảng nhỏ, không cần cron ở R03).
  delete from public.rate_limit_buckets where key_hash = p_key_hash and window_start < v_window - interval '1 day';
  return v_count <= p_limit;
end;
$$;

-- Kiểm tra mã có dùng được không (trước khi tạo người dùng ẩn danh) — không thay đổi gì.
-- Trả về NULL cho mọi trường hợp không hợp lệ: không phân biệt sai/hết hạn/thu hồi với bên ngoài.
create or replace function public.gateway_check_login_code(p_code_hmac bytea, p_kind text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select c.id
  from public.student_login_codes c
  join public.students st on st.id = c.student_id
  join public.classes cl on cl.id = c.class_id
  where (case when p_kind = 'token' then c.token_hmac else c.backup_code_hmac end) = p_code_hmac
    and p_kind in ('token', 'backup')
    and c.revoked_at is null
    and c.expires_at > now()
    and c.devices_linked < c.max_devices
    and st.status = 'active'
    and cl.status = 'active';
$$;

-- Liên kết thiết bị (người dùng ẩn danh đã có phiên) với học sinh của mã. Khóa dòng mã để các yêu cầu
-- đồng thời không vượt max_devices; cùng thiết bị gửi lại → trả liên kết cũ, không tính thêm lượt.
create or replace function public.gateway_redeem_login_code(p_code_hmac bytea, p_kind text, p_auth_user_id uuid)
returns table (outcome text, student_id uuid, device_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code public.student_login_codes;
  v_device_id uuid;
begin
  if p_kind not in ('token', 'backup') then
    return query select 'invalid'::text, null::uuid, null::uuid;
    return;
  end if;
  select c.* into v_code
  from public.student_login_codes c
  where (case when p_kind = 'token' then c.token_hmac else c.backup_code_hmac end) = p_code_hmac
  for update;

  if v_code.id is null or v_code.revoked_at is not null or v_code.expires_at <= now()
     or not exists (
       select 1 from public.students st join public.classes cl on cl.id = st.class_id
       where st.id = v_code.student_id and st.status = 'active' and cl.status = 'active'
     ) then
    return query select 'invalid'::text, null::uuid, null::uuid;
    return;
  end if;

  select d.id into v_device_id from public.student_devices d
  where d.auth_user_id = p_auth_user_id and d.student_id = v_code.student_id and d.revoked_at is null;
  if v_device_id is not null then
    return query select 'already_linked'::text, v_code.student_id, v_device_id;
    return;
  end if;

  if v_code.devices_linked >= v_code.max_devices then
    return query select 'invalid'::text, null::uuid, null::uuid;
    return;
  end if;

  insert into public.student_devices (auth_user_id, student_id, class_id, login_code_id, last_seen_at)
  values (p_auth_user_id, v_code.student_id, v_code.class_id, v_code.id, now())
  returning id into v_device_id;
  update public.student_login_codes
    set devices_linked = devices_linked + 1, last_used_at = now()
    where id = v_code.id;
  perform private.write_audit('device.link', 'device', v_device_id, v_code.class_id,
    jsonb_build_object('student_id', v_code.student_id, 'login_code_id', v_code.id, 'kind', p_kind),
    p_auth_user_id);
  return query select 'linked'::text, v_code.student_id, v_device_id;
end;
$$;

-- Ghi nhận lần dùng gần nhất (thô 15 phút để không ghi mỗi lần tải trang).
create or replace function public.gateway_touch_device(p_auth_user_id uuid, p_student_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.student_devices
    set last_seen_at = now()
    where auth_user_id = p_auth_user_id and student_id = p_student_id and revoked_at is null
      and (last_seen_at is null or last_seen_at < now() - interval '15 minutes');
$$;

-- Học sinh tự chọn avatar và cài đặt trợ năng — chỉ khi liên kết còn hiệu lực.
create or replace function public.gateway_update_student_preferences(
  p_auth_user_id uuid, p_student_id uuid, p_avatar_key text, p_motion text, p_sound text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.student_devices d
    join public.students st on st.id = d.student_id
    join public.classes cl on cl.id = st.class_id
    where d.auth_user_id = p_auth_user_id and d.student_id = p_student_id and d.revoked_at is null
      and st.status = 'active' and cl.status = 'active'
  ) then
    return false;
  end if;
  update public.students
    set avatar_key = p_avatar_key, motion_preference = p_motion, sound_preference = p_sound
    where id = p_student_id;
  return true;
end;
$$;

-- =====================================================================================
-- Quyền thực thi
-- =====================================================================================

revoke all on all functions in schema public from public, anon, authenticated;

grant execute on function
  public.teacher_create_class(text, text),
  public.teacher_rename_class(uuid, text),
  public.teacher_set_class_curriculum(uuid, uuid, uuid),
  public.teacher_confirm_class_curriculum(uuid),
  public.teacher_create_student(uuid, text, smallint, text),
  public.teacher_update_student(uuid, text, smallint, text),
  public.teacher_set_student_status(uuid, text),
  public.teacher_set_leaderboard_alias(uuid, text),
  public.teacher_approve_leaderboard_alias(uuid),
  public.teacher_assign_band(uuid, text, text),
  public.teacher_issue_login_code(uuid, bytea, bytea, timestamptz, smallint),
  public.teacher_revoke_login_code(uuid),
  public.teacher_revoke_device(uuid),
  public.teacher_record_consent(uuid, text, text, text, text, boolean),
  public.teacher_withdraw_consent(uuid, text)
to authenticated;

grant execute on all functions in schema public to service_role;

revoke all on all functions in schema private from public, anon;
grant execute on all functions in schema private to service_role;
