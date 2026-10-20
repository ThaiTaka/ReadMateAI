-- =====================================================================================
-- R05 — Bảng xếp hạng lớp (LEADERBOARD_SPEC, PRIVACY_AND_SECURITY §5).
--
-- KHÔNG có bảng mới: bảng xếp hạng được TÍNH từ season_scores (R04), students, guardian_consents, seasons, classes.
-- Điểm xếp hạng = season_scores.balance (điểm hiện tại); balance_updated_at (R04) cho thứ tự hiển thị khi đồng hạng.
-- Việc xếp hạng nằm ở mã TypeScript thuần (src/features/gamification/ranking.ts); CSDL chỉ LỌC học sinh đủ điều kiện
-- — ở MỘT nơi duy nhất (private.leaderboard_rows) dùng chung cho bảng của học sinh và màn trình chiếu của giáo viên.
--
-- Điều kiện xuất hiện: lớp đang hoạt động + mùa đang diễn ra + học sinh đang hoạt động + đồng ý learning_data
-- + đồng ý leaderboard_display + tên hiển thị đã được GV duyệt. Thiếu một điều kiện → không có hàng.
-- Bảng chỉ mở khi cờ hệ thống 'leaderboard_feature_approved' bật VÀ lớp bật leaderboard_enabled (đọc lại mỗi lần).
--
-- Không sửa migration R03–R04. Mọi hàm mới: security definer, search_path rỗng, quyền thực thi tường minh.
-- =====================================================================================

-- Học sinh đủ điều kiện hiển thị của một lớp trong mùa đang diễn ra. KHÔNG tự kiểm tra người gọi:
-- chỉ được gọi từ các hàm bên dưới (đã kiểm tra thiết bị/giáo viên) — private không cấp cho authenticated.
create or replace function private.leaderboard_rows(p_class_id uuid)
returns table (student_id uuid, alias text, avatar_key text, points int, reached_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select st.id, st.leaderboard_alias, st.avatar_key, coalesce(sc.balance, 0), sc.balance_updated_at
  from public.classes c
  join public.seasons se on se.class_id = c.id and se.status = 'active'
  join public.students st on st.class_id = c.id
  left join public.season_scores sc on sc.season_id = se.id and sc.student_id = st.id
  where c.id = p_class_id
    and c.status = 'active'
    and st.status = 'active'
    and st.leaderboard_alias is not null
    and st.leaderboard_alias_approved_at is not null
    and private.consent_active(st.id, 'learning_data')
    and private.consent_active(st.id, 'leaderboard_display');
$$;

-- -------------------------------------------------------------------------------------
-- Học sinh: dữ liệu bảng của CHÍNH lớp mình. Kết quả không chứa student_id/class_id/điểm tích lũy/nhóm/đồng ý.
-- -------------------------------------------------------------------------------------
create or replace function public.gateway_class_leaderboard(p_auth_user_id uuid, p_student_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_class_id uuid := private.require_linked_device(p_auth_user_id, p_student_id);
  v_class public.classes;
  v_season public.seasons;
  v_rows jsonb;
  v_listed boolean;
begin
  select * into v_class from public.classes c where c.id = v_class_id;
  -- Cờ hệ thống hoặc cờ lớp tắt → không trả một dòng dữ liệu nào (kể cả tên mùa).
  if not v_class.leaderboard_enabled or not private.feature_enabled('leaderboard_feature_approved') then
    return jsonb_build_object('status', 'disabled');
  end if;
  select * into v_season from public.seasons s where s.class_id = v_class_id and s.status = 'active';
  if v_season.id is null then
    return jsonb_build_object('status', 'no_season');
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
           'alias', r.alias,
           'avatar_key', r.avatar_key,
           'points', r.points,
           'reached_at', r.reached_at,
           'is_me', r.student_id = p_student_id)), '[]'::jsonb),
         coalesce(bool_or(r.student_id = p_student_id), false)
    into v_rows, v_listed
  from private.leaderboard_rows(v_class_id) r;
  return jsonb_build_object(
    'status', 'ok',
    'view', v_class.leaderboard_student_view,
    'season_no', v_season.seq_no,
    'viewer_listed', v_listed,
    'rows', v_rows);
end;
$$;

-- -------------------------------------------------------------------------------------
-- Giáo viên: cấu hình bảng (chỉ GV chủ nhiệm). Trigger guard_class chặn bật khi cờ hệ thống chưa được chấp thuận.
-- -------------------------------------------------------------------------------------
create or replace function public.teacher_set_leaderboard_settings(
  p_class_id uuid, p_enabled boolean, p_student_view text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_class public.classes;
begin
  perform private.require_class_staff(p_class_id, true);
  if p_enabled is null or p_student_view is null or p_student_view not in ('top10_and_me', 'full') then
    raise exception 'INVALID_INPUT' using errcode = '22023';
  end if;
  select * into v_class from public.classes c where c.id = p_class_id for update;
  if v_class.status <> 'active' then
    raise exception 'CLASS_ARCHIVED' using errcode = '22023';
  end if;
  update public.classes
    set leaderboard_enabled = p_enabled, leaderboard_student_view = p_student_view
    where id = p_class_id;
  perform private.write_audit('leaderboard.configure', 'class', p_class_id, p_class_id,
    jsonb_build_object('enabled', p_enabled, 'student_view', p_student_view));
end;
$$;

-- -------------------------------------------------------------------------------------
-- Giáo viên: tổng quan quản trị (có đối soát — CHỈ GV thấy). Không dùng cho trình chiếu.
-- -------------------------------------------------------------------------------------
create or replace function public.teacher_leaderboard_overview(p_class_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_class public.classes;
  v_season public.seasons;
  v_students jsonb;
begin
  perform private.require_class_staff(p_class_id);
  select * into v_class from public.classes c where c.id = p_class_id;
  select * into v_season from public.seasons s where s.class_id = p_class_id and s.status = 'active';
  select coalesce(jsonb_agg(jsonb_build_object(
           'student_id', st.id,
           'display_name', st.display_name,
           'alias', st.leaderboard_alias,
           'alias_approved', st.leaderboard_alias_approved_at is not null,
           'avatar_key', st.avatar_key,
           'status', st.status,
           'learning_consent', private.consent_active(st.id, 'learning_data'),
           'leaderboard_consent', private.consent_active(st.id, 'leaderboard_display'),
           'balance', coalesce(sc.balance, 0),
           'earned_total', coalesce(sc.earned_total, 0),
           'reached_at', sc.balance_updated_at,
           'eligible', exists (select 1 from private.leaderboard_rows(p_class_id) r where r.student_id = st.id))
         order by st.display_name), '[]'::jsonb)
    into v_students
  from public.students st
  left join public.season_scores sc on sc.season_id = v_season.id and sc.student_id = st.id
  where st.class_id = p_class_id and st.status <> 'archived';
  return jsonb_build_object(
    'feature_approved', private.feature_enabled('leaderboard_feature_approved'),
    'enabled', v_class.leaderboard_enabled,
    'student_view', v_class.leaderboard_student_view,
    'season_no', v_season.seq_no,
    'students', v_students);
end;
$$;

-- -------------------------------------------------------------------------------------
-- Giáo viên: dữ liệu TRÌNH CHIẾU — chỉ học sinh đủ điều kiện, không mã định danh, chỉ khi bảng đang bật.
-- -------------------------------------------------------------------------------------
create or replace function public.teacher_leaderboard_display(p_class_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_class public.classes;
  v_season public.seasons;
  v_rows jsonb;
begin
  perform private.require_class_staff(p_class_id);
  select * into v_class from public.classes c where c.id = p_class_id;
  if not v_class.leaderboard_enabled or not private.feature_enabled('leaderboard_feature_approved') then
    raise exception 'LEADERBOARD_DISABLED' using errcode = '22023';
  end if;
  select * into v_season from public.seasons s where s.class_id = p_class_id and s.status = 'active';
  if v_season.id is null then
    raise exception 'SEASON_CLOSED' using errcode = '22023';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
           'alias', r.alias,
           'avatar_key', r.avatar_key,
           'points', r.points,
           'reached_at', r.reached_at)), '[]'::jsonb)
    into v_rows
  from private.leaderboard_rows(p_class_id) r;
  return jsonb_build_object('season_no', v_season.seq_no, 'class_name', v_class.name, 'rows', v_rows);
end;
$$;

-- =====================================================================================
-- Quyền thực thi (mặc định của Supabase cấp EXECUTE cho anon/authenticated → thu hồi rồi cấp tối thiểu)
-- =====================================================================================

revoke all on function
  public.gateway_class_leaderboard(uuid, uuid),
  public.teacher_set_leaderboard_settings(uuid, boolean, text),
  public.teacher_leaderboard_overview(uuid),
  public.teacher_leaderboard_display(uuid)
from public, anon, authenticated;
revoke all on function private.leaderboard_rows(uuid) from public, anon, authenticated;

grant execute on function public.gateway_class_leaderboard(uuid, uuid) to service_role;
grant execute on function
  public.teacher_set_leaderboard_settings(uuid, boolean, text),
  public.teacher_leaderboard_overview(uuid),
  public.teacher_leaderboard_display(uuid)
to authenticated, service_role;
grant execute on function private.leaderboard_rows(uuid) to service_role;
