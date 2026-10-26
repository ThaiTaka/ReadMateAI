-- R10.2 — Thư viện âm thanh bản ghi của giáo viên: bảng, bất biến phiên bản, quy trình duyệt, đồng ý dùng giọng.
--
-- Nguyên tắc (docs/AUDIO_ENGINE.md §8–§9, docs/AUDIO_RECORDING_PLAN.md):
--   * Tệp âm thanh KHÔNG nằm trong CSDL: chỉ metadata + khóa đối tượng trong bucket Storage RIÊNG TƯ `teacher-audio`
--     (bucket do supabase/config.toml tạo ở local/CI; không policy storage.objects nào cho authenticated/anon —
--     chỉ máy chủ (service_role) đọc/ghi).
--   * Phạm vi = TRƯỜNG: giáo viên chỉ thấy/ghi tài nguyên của trường mình. Bản nháp chỉ người tạo (hoặc quản trị
--     của trường) thấy.
--   * Vòng đời: draft → pending_review → approved | rejected; approved → superseded | revoked; draft → discarded.
--     Bản đã gửi duyệt BẤT BIẾN (trigger, áp dụng cả với service_role); sửa = phiên bản mới.
--   * Không có đường nào tự đặt `approved`: chỉ hàm `teacher_review_audio_version` (JWT GV, đã nghe, đã xác nhận
--     cách đọc, giọng còn được đồng ý). Cờ hệ thống `teacher_audio_recording_approved` mặc định TẮT: khi tắt, mọi
--     thao tác GHI (trừ thu hồi) bị từ chối.
--   * Nhật ký audit_logs chỉ chứa UUID/mã — không tên tệp, không nội dung âm thanh.

-- -------------------------------------------------------------------------------------
-- Cờ hệ thống
-- -------------------------------------------------------------------------------------

insert into private.feature_flags (key, enabled, note) values
  ('teacher_audio_recording_approved', false,
   'Ghi/tải bản ghi giọng giáo viên: chỉ bật sau khi GV đồng ý bằng văn bản và chủ dự án cho phép (R10.2).');

-- -------------------------------------------------------------------------------------
-- Bảng
-- -------------------------------------------------------------------------------------

-- Đồng ý dùng giọng: mỗi GV tối đa một bản ghi đang hiệu lực. Chứng từ — chỉ chuyển granted → withdrawn.
create table public.audio_voice_consents (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id),
  staff_id uuid not null references public.staff_profiles (id),
  notice_version text not null check (notice_version ~ '^[a-z0-9._-]{1,32}$'),
  scope text not null default 'teacher_voice_in_app' check (scope = 'teacher_voice_in_app'),
  status text not null default 'granted' check (status in ('granted', 'withdrawn')),
  granted_at timestamptz not null default now(),
  withdrawn_at timestamptz null,
  withdraw_reason text null check (withdraw_reason is null or private.is_clean_text(withdraw_reason, 3, 300)),
  check ((status = 'withdrawn') = (withdrawn_at is not null)),
  check ((status = 'withdrawn') = (withdraw_reason is not null))
);
comment on table public.audio_voice_consents is
  'Giáo viên đồng ý lưu và dùng giọng của mình trong ứng dụng (phạm vi teacher_voice_in_app). Chứng từ bất biến.';
create unique index audio_voice_consents_one_active on public.audio_voice_consents (staff_id) where status = 'granted';
create index audio_voice_consents_school_idx on public.audio_voice_consents (school_id);

-- Một đơn vị (âm/vần) của một trường. active_version_id = bản đã duyệt đang được dùng.
create table public.audio_assets (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id),
  unit_kind text not null check (unit_kind in ('phoneme', 'rime')),
  unit_text text not null check (private.is_clean_text(unit_text, 1, 6) and unit_text ~ '^[[:alpha:]]+$'),
  source text not null default 'teacher_recording' check (source = 'teacher_recording'),
  proposed_label text not null check (private.is_clean_text(proposed_label, 1, 40)),
  confirmed_label text null check (confirmed_label is null or private.is_clean_text(confirmed_label, 1, 40)),
  pronunciation_confirmed_by uuid null references public.staff_profiles (id),
  pronunciation_confirmed_at timestamptz null,
  teacher_note text null check (teacher_note is null or private.is_clean_text(teacher_note, 1, 300)),
  active_version_id uuid null,
  created_by uuid not null references public.staff_profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, unit_kind, unit_text),
  check ((confirmed_label is null) = (pronunciation_confirmed_by is null)),
  check ((confirmed_label is null) = (pronunciation_confirmed_at is null))
);
comment on table public.audio_assets is
  'Đơn vị âm thanh cần bản ghi GV (âm/vần đơn lẻ) theo trường. Cách đọc chỉ hợp lệ khi GV đã xác nhận.';

create table public.audio_asset_versions (
  id uuid primary key,
  asset_id uuid not null references public.audio_assets (id),
  school_id uuid not null references public.schools (id),
  version_no int not null check (version_no >= 1),
  status text not null default 'draft'
    check (status in ('draft', 'pending_review', 'approved', 'rejected', 'revoked', 'superseded', 'discarded')),
  spoken_label text not null check (private.is_clean_text(spoken_label, 1, 40)),
  storage_bucket text not null default 'teacher-audio' check (storage_bucket = 'teacher-audio'),
  storage_key text not null unique
    check (storage_key ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(webm|ogg|m4a|mp3|wav)$'),
  content_hash text not null check (content_hash ~ '^[0-9a-f]{64}$'),
  mime_type text not null check (mime_type in ('audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/wav')),
  size_bytes int not null check (size_bytes between 1 and 2097152),
  duration_ms int not null check (duration_ms between 300 and 10000),
  consent_id uuid not null references public.audio_voice_consents (id),
  created_by uuid not null references public.staff_profiles (id),
  created_at timestamptz not null default now(),
  submitted_by uuid null references public.staff_profiles (id),
  submitted_at timestamptz null,
  reviewed_by uuid null references public.staff_profiles (id),
  reviewed_at timestamptz null,
  review_note text null check (review_note is null or private.is_clean_text(review_note, 3, 500)),
  review_listened boolean not null default false,
  revoked_by uuid null references public.staff_profiles (id),
  revoked_at timestamptz null,
  revoke_reason text null check (revoke_reason is null or private.is_clean_text(revoke_reason, 3, 300)),
  unique (asset_id, version_no),
  check ((reviewed_by is null) = (reviewed_at is null)),
  check (status not in ('approved', 'rejected', 'superseded') or reviewed_by is not null),
  check (status not in ('draft', 'pending_review', 'discarded') or reviewed_by is null),
  check (status not in ('pending_review', 'approved', 'rejected', 'superseded') or submitted_at is not null),
  check (status <> 'draft' or submitted_at is null),
  check (status <> 'rejected' or review_note is not null),
  check (status not in ('approved', 'superseded') or review_listened),
  check ((status = 'revoked') = (revoked_at is not null)),
  check ((revoked_at is null) = (revoked_by is null) and (revoked_at is null) = (revoke_reason is null))
);
comment on table public.audio_asset_versions is
  'Phiên bản bản ghi. Nội dung (khóa đối tượng, hash, thời lượng…) bất biến; chỉ trạng thái/dấu vết duyệt đổi, theo máy trạng thái.';
create index audio_asset_versions_asset_idx on public.audio_asset_versions (asset_id, version_no);
create index audio_asset_versions_school_status_idx on public.audio_asset_versions (school_id, status);
create index audio_asset_versions_creator_idx on public.audio_asset_versions (created_by);
create index audio_asset_versions_consent_idx on public.audio_asset_versions (consent_id);

alter table public.audio_assets
  add constraint audio_assets_active_version_fk foreign key (active_version_id)
  references public.audio_asset_versions (id) deferrable initially deferred;
create index audio_assets_active_version_idx on public.audio_assets (active_version_id);
create index audio_assets_created_by_idx on public.audio_assets (created_by);

-- -------------------------------------------------------------------------------------
-- Trigger bất biến
-- -------------------------------------------------------------------------------------

create or replace function private.guard_audio_consent()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'AUDIO_RECORD_NO_DELETE' using errcode = '23514';
  end if;
  if old.status <> 'granted' or new.status <> 'withdrawn'
     or new.school_id <> old.school_id or new.staff_id <> old.staff_id or new.scope <> old.scope
     or new.notice_version <> old.notice_version or new.granted_at <> old.granted_at then
    raise exception 'AUDIO_CONSENT_IMMUTABLE' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger audio_voice_consents_guard before update or delete on public.audio_voice_consents
  for each row execute function private.guard_audio_consent();

create or replace function private.guard_audio_asset()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'AUDIO_RECORD_NO_DELETE' using errcode = '23514';
  end if;
  if new.school_id <> old.school_id or new.unit_kind <> old.unit_kind or new.unit_text <> old.unit_text
     or new.source <> old.source or new.proposed_label <> old.proposed_label
     or new.created_by <> old.created_by or new.created_at <> old.created_at then
    raise exception 'AUDIO_ASSET_IMMUTABLE' using errcode = '23514';
  end if;
  if new.active_version_id is not null and new.active_version_id is distinct from old.active_version_id and not exists (
    select 1 from public.audio_asset_versions v
    where v.id = new.active_version_id and v.asset_id = new.id and v.status = 'approved'
  ) then
    raise exception 'AUDIO_ACTIVE_NOT_APPROVED' using errcode = '23514';
  end if;
  new.updated_at := now();
  return new;
end;
$$;
create trigger audio_assets_guard before update or delete on public.audio_assets
  for each row execute function private.guard_audio_asset();

create or replace function private.guard_audio_version()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'AUDIO_RECORD_NO_DELETE' using errcode = '23514';
  end if;
  if tg_op = 'INSERT' then
    -- Phiên bản luôn khởi tạo là bản nháp; chặn chèn thẳng trạng thái đã duyệt (kể cả bằng service_role).
    if new.status <> 'draft' then
      raise exception 'AUDIO_VERSION_MUST_START_DRAFT' using errcode = '23514';
    end if;
    if not exists (
      select 1 from public.audio_assets a where a.id = new.asset_id and a.school_id = new.school_id
    ) then
      raise exception 'AUDIO_SCOPE_MISMATCH' using errcode = '23514';
    end if;
    return new;
  end if;

  -- Nội dung phiên bản bất biến.
  if new.id <> old.id or new.asset_id <> old.asset_id or new.school_id <> old.school_id
     or new.version_no <> old.version_no or new.spoken_label <> old.spoken_label
     or new.storage_bucket <> old.storage_bucket or new.storage_key <> old.storage_key
     or new.content_hash <> old.content_hash or new.mime_type <> old.mime_type
     or new.size_bytes <> old.size_bytes or new.duration_ms <> old.duration_ms
     or new.consent_id <> old.consent_id or new.created_by <> old.created_by or new.created_at <> old.created_at then
    raise exception 'AUDIO_VERSION_IMMUTABLE' using errcode = '23514';
  end if;
  -- Dấu vết gửi/duyệt/thu hồi đã đặt thì không đổi.
  if (old.submitted_at is not null and (new.submitted_at is distinct from old.submitted_at
        or new.submitted_by is distinct from old.submitted_by))
     or (old.reviewed_at is not null and (new.reviewed_at is distinct from old.reviewed_at
        or new.reviewed_by is distinct from old.reviewed_by or new.review_note is distinct from old.review_note
        or new.review_listened is distinct from old.review_listened))
     or (old.revoked_at is not null) then
    raise exception 'AUDIO_VERSION_IMMUTABLE' using errcode = '23514';
  end if;
  if new.status = old.status then
    if new is distinct from old then
      raise exception 'AUDIO_VERSION_IMMUTABLE' using errcode = '23514';
    end if;
    return new;
  end if;
  if not (
       (old.status = 'draft' and new.status in ('pending_review', 'discarded', 'revoked'))
    or (old.status = 'pending_review' and new.status in ('approved', 'rejected', 'revoked'))
    or (old.status = 'approved' and new.status in ('superseded', 'revoked'))
  ) then
    raise exception 'AUDIO_INVALID_TRANSITION' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger audio_asset_versions_guard before insert or update or delete on public.audio_asset_versions
  for each row execute function private.guard_audio_version();

-- -------------------------------------------------------------------------------------
-- Trợ giúp
-- -------------------------------------------------------------------------------------

create or replace function private.audio_ext(p_mime text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_mime
    when 'audio/webm' then 'webm' when 'audio/ogg' then 'ogg' when 'audio/mp4' then 'm4a'
    when 'audio/mpeg' then 'mp3' when 'audio/wav' then 'wav' end;
$$;

-- Người gọi là GV đang hoạt động; thao tác GHI chỉ khi cờ hệ thống đã bật. Trả về uid.
create or replace function private.require_audio_staff(p_write boolean default true)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_staff();
begin
  if p_write and not private.feature_enabled('teacher_audio_recording_approved') then
    raise exception 'AUDIO_RECORDING_DISABLED' using errcode = '22023';
  end if;
  return v_uid;
end;
$$;

create or replace function private.audio_active_consent(p_staff uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select c.id from public.audio_voice_consents c where c.staff_id = p_staff and c.status = 'granted';
$$;

-- -------------------------------------------------------------------------------------
-- Hàm cho giáo viên (JWT GV; tự kiểm tra quyền; ghi audit cùng giao dịch)
-- -------------------------------------------------------------------------------------

create or replace function public.teacher_grant_audio_consent(p_notice_version text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_audio_staff(true);
  v_id uuid;
begin
  v_id := private.audio_active_consent(v_uid);
  if v_id is not null then
    return v_id;
  end if;
  insert into public.audio_voice_consents (school_id, staff_id, notice_version)
  values ((select private.my_school_id()), v_uid, p_notice_version)
  returning id into v_id;
  perform private.write_audit('audio.consent_grant', 'audio_consent', v_id, null, '{}'::jsonb);
  return v_id;
end;
$$;

-- Rút đồng ý: luôn được phép. Thu hồi mọi phiên bản (nháp/chờ duyệt/đã duyệt) của chính GV; không xóa tệp
-- (xóa theo yêu cầu là quy trình quản trị riêng — docs/AUDIO_RECORDING_PLAN §8).
create or replace function public.teacher_withdraw_audio_consent(p_reason text)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_audio_staff(false);
  v_consent uuid := private.audio_active_consent(v_uid);
  v_count int := 0;
  v_row record;
begin
  if v_consent is null then
    raise exception 'NOT_FOUND' using errcode = '22023';
  end if;
  for v_row in
    select v.id, v.asset_id from public.audio_asset_versions v
    where v.created_by = v_uid and v.status in ('draft', 'pending_review', 'approved')
    order by v.asset_id, v.version_no
  loop
    perform 1 from public.audio_assets a where a.id = v_row.asset_id for update;
    update public.audio_assets a set active_version_id = null where a.id = v_row.asset_id and a.active_version_id = v_row.id;
    update public.audio_asset_versions v
       set status = 'revoked', revoked_by = v_uid, revoked_at = now(), revoke_reason = 'Giáo viên rút đồng ý dùng giọng'
     where v.id = v_row.id;
    v_count := v_count + 1;
  end loop;
  update public.audio_voice_consents c
     set status = 'withdrawn', withdrawn_at = now(), withdraw_reason = p_reason
   where c.id = v_consent;
  perform private.write_audit('audio.consent_withdraw', 'audio_consent', v_consent, null,
    jsonb_build_object('revoked_versions', v_count));
  return v_count;
end;
$$;

create or replace function public.teacher_ensure_audio_asset(p_unit_kind text, p_unit_text text, p_proposed_label text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_audio_staff(true);
  v_school uuid := (select private.my_school_id());
  v_id uuid;
begin
  insert into public.audio_assets (school_id, unit_kind, unit_text, proposed_label, created_by)
  values (v_school, p_unit_kind, p_unit_text, p_proposed_label, v_uid)
  on conflict (school_id, unit_kind, unit_text) do nothing;
  select a.id into v_id from public.audio_assets a
   where a.school_id = v_school and a.unit_kind = p_unit_kind and a.unit_text = p_unit_text;
  return v_id;
end;
$$;

create or replace function public.teacher_confirm_audio_pronunciation(p_asset_id uuid, p_label text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_audio_staff(true);
  v_asset public.audio_assets;
begin
  select * into v_asset from public.audio_assets a
   where a.id = p_asset_id and a.school_id = (select private.my_school_id()) for update;
  if v_asset.id is null then
    raise exception 'NOT_FOUND' using errcode = '22023';
  end if;
  -- Chỉ khóa việc ĐỔI cách đã xác nhận; xác nhận lần đầu luôn được (kể cả khi đã có bản chờ duyệt).
  if v_asset.confirmed_label is not null and v_asset.confirmed_label <> p_label and exists (
    select 1 from public.audio_asset_versions v
    where v.asset_id = v_asset.id and v.status in ('pending_review', 'approved')
  ) then
    raise exception 'PRONUNCIATION_LOCKED' using errcode = '22023';
  end if;
  update public.audio_assets a
     set confirmed_label = p_label, pronunciation_confirmed_by = v_uid, pronunciation_confirmed_at = now()
   where a.id = v_asset.id;
  perform private.write_audit('audio.pronunciation_confirm', 'audio_asset', v_asset.id, null, '{}'::jsonb);
end;
$$;

create or replace function public.teacher_set_audio_note(p_asset_id uuid, p_note text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_audio_staff(true);
  update public.audio_assets a
     set teacher_note = nullif(btrim(coalesce(p_note, '')), '')
   where a.id = p_asset_id and a.school_id = (select private.my_school_id());
  if not found then
    raise exception 'NOT_FOUND' using errcode = '22023';
  end if;
end;
$$;

-- Máy chủ đã tải tệp lên Storage (khóa do máy chủ sinh) rồi mới gọi hàm này. Khóa phải ĐÚNG dạng
-- {trường}/{tài nguyên}/{phiên bản}.{đuôi} — không thể trỏ tới đối tượng của người khác.
create or replace function public.teacher_create_audio_version(
  p_asset_id uuid,
  p_version_id uuid,
  p_storage_key text,
  p_content_hash text,
  p_mime_type text,
  p_size_bytes int,
  p_duration_ms int
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_audio_staff(true);
  v_asset public.audio_assets;
  v_consent uuid;
  v_ext text := private.audio_ext(p_mime_type);
  v_no int;
begin
  select * into v_asset from public.audio_assets a
   where a.id = p_asset_id and a.school_id = (select private.my_school_id()) for update;
  if v_asset.id is null then
    raise exception 'NOT_FOUND' using errcode = '22023';
  end if;
  v_consent := private.audio_active_consent(v_uid);
  if v_consent is null then
    raise exception 'VOICE_CONSENT_REQUIRED' using errcode = '22023';
  end if;
  if v_ext is null or p_storage_key is distinct from (v_asset.school_id::text || '/' || v_asset.id::text || '/' || p_version_id::text || '.' || v_ext) then
    raise exception 'INVALID_INPUT' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.audio_asset_versions v
    where v.asset_id = v_asset.id and v.content_hash = p_content_hash
      and v.created_by = v_uid and v.status in ('draft', 'pending_review', 'approved')
  ) then
    raise exception 'DUPLICATE_AUDIO' using errcode = '22023';
  end if;

  -- Ghi lại = bản nháp cũ của chính GV được bỏ (không xóa tệp, không ghi đè).
  update public.audio_asset_versions v set status = 'discarded'
   where v.asset_id = v_asset.id and v.created_by = v_uid and v.status = 'draft';
  select coalesce(max(v.version_no), 0) + 1 into v_no from public.audio_asset_versions v where v.asset_id = v_asset.id;

  insert into public.audio_asset_versions (
    id, asset_id, school_id, version_no, spoken_label, storage_key, content_hash, mime_type, size_bytes,
    duration_ms, consent_id, created_by)
  values (
    p_version_id, v_asset.id, v_asset.school_id, v_no, coalesce(v_asset.confirmed_label, v_asset.proposed_label),
    p_storage_key, p_content_hash, p_mime_type, p_size_bytes, p_duration_ms, v_consent, v_uid);
  perform private.write_audit('audio.version_create', 'audio_version', p_version_id, null,
    jsonb_build_object('asset_id', v_asset.id, 'version_no', v_no));
  return jsonb_build_object('asset_id', v_asset.id, 'version_id', p_version_id, 'version_no', v_no);
end;
$$;

-- Khóa theo thứ tự: tài nguyên rồi phiên bản (mọi hàm cùng thứ tự → không deadlock).
create or replace function private.lock_audio_version(p_version_id uuid)
returns public.audio_asset_versions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_asset uuid;
  v_ver public.audio_asset_versions;
begin
  select v.asset_id into v_asset from public.audio_asset_versions v
   where v.id = p_version_id and v.school_id = (select private.my_school_id());
  if v_asset is null then
    raise exception 'NOT_FOUND' using errcode = '22023';
  end if;
  perform 1 from public.audio_assets a where a.id = v_asset for update;
  select * into v_ver from public.audio_asset_versions v where v.id = p_version_id for update;
  -- Bản nháp/đã bỏ của người khác không "tồn tại" với GV này.
  if v_ver.status in ('draft', 'discarded') and v_ver.created_by <> (select auth.uid())
     and not (select private.is_admin()) then
    raise exception 'NOT_FOUND' using errcode = '22023';
  end if;
  return v_ver;
end;
$$;

create or replace function public.teacher_submit_audio_version(p_version_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_audio_staff(true);
  v_ver public.audio_asset_versions := private.lock_audio_version(p_version_id);
begin
  if v_ver.created_by <> v_uid then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if v_ver.status <> 'draft' then
    raise exception 'STATE_CONFLICT' using errcode = '22023';
  end if;
  if private.audio_active_consent(v_uid) is null then
    raise exception 'VOICE_CONSENT_REQUIRED' using errcode = '22023';
  end if;
  update public.audio_asset_versions v
     set status = 'pending_review', submitted_by = v_uid, submitted_at = now()
   where v.id = v_ver.id;
  perform private.write_audit('audio.version_submit', 'audio_version', v_ver.id, null,
    jsonb_build_object('asset_id', v_ver.asset_id, 'version_no', v_ver.version_no));
end;
$$;

create or replace function public.teacher_discard_audio_version(p_version_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_audio_staff(true);
  v_ver public.audio_asset_versions := private.lock_audio_version(p_version_id);
begin
  if v_ver.created_by <> v_uid then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if v_ver.status <> 'draft' then
    raise exception 'STATE_CONFLICT' using errcode = '22023';
  end if;
  update public.audio_asset_versions v set status = 'discarded' where v.id = v_ver.id;
  perform private.write_audit('audio.version_discard', 'audio_version', v_ver.id, null,
    jsonb_build_object('asset_id', v_ver.asset_id));
end;
$$;

create or replace function public.teacher_review_audio_version(
  p_version_id uuid,
  p_decision text,
  p_note text,
  p_listened boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_audio_staff(true);
  v_ver public.audio_asset_versions := private.lock_audio_version(p_version_id);
  v_asset public.audio_assets;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  if p_decision not in ('approve', 'reject') then
    raise exception 'INVALID_INPUT' using errcode = '22023';
  end if;
  if v_ver.status <> 'pending_review' then
    raise exception 'STATE_CONFLICT' using errcode = '22023';
  end if;
  select * into v_asset from public.audio_assets a where a.id = v_ver.asset_id;

  if p_decision = 'approve' then
    if p_listened is not true then
      raise exception 'LISTEN_REQUIRED' using errcode = '22023';
    end if;
    if v_asset.confirmed_label is null then
      raise exception 'PRONUNCIATION_UNCONFIRMED' using errcode = '22023';
    end if;
    if v_asset.confirmed_label <> v_ver.spoken_label then
      raise exception 'LABEL_MISMATCH' using errcode = '22023';
    end if;
    if private.audio_active_consent(v_ver.created_by) is null then
      raise exception 'VOICE_CONSENT_REQUIRED' using errcode = '22023';
    end if;
    update public.audio_asset_versions v set status = 'superseded'
     where v.id = v_asset.active_version_id and v.status = 'approved';
    update public.audio_asset_versions v
       set status = 'approved', reviewed_by = v_uid, reviewed_at = now(), review_note = v_note, review_listened = true
     where v.id = v_ver.id;
    update public.audio_assets a set active_version_id = v_ver.id where a.id = v_asset.id;
  else
    if v_note is null or not private.is_clean_text(v_note, 3, 500) then
      raise exception 'NOTE_REQUIRED' using errcode = '22023';
    end if;
    update public.audio_asset_versions v
       set status = 'rejected', reviewed_by = v_uid, reviewed_at = now(), review_note = v_note,
           review_listened = coalesce(p_listened, false)
     where v.id = v_ver.id;
  end if;
  perform private.write_audit('audio.version_review', 'audio_version', v_ver.id, null,
    jsonb_build_object('asset_id', v_ver.asset_id, 'decision', p_decision));
  return jsonb_build_object('version_id', v_ver.id, 'status', case p_decision when 'approve' then 'approved' else 'rejected' end);
end;
$$;

-- Thu hồi/ngừng dùng: người tạo hoặc quản trị trường; luôn được phép (kể cả khi cờ tắt).
create or replace function public.teacher_revoke_audio_version(p_version_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_audio_staff(false);
  v_ver public.audio_asset_versions := private.lock_audio_version(p_version_id);
begin
  if v_ver.created_by <> v_uid and not (select private.is_admin()) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if v_ver.status not in ('draft', 'pending_review', 'approved') then
    raise exception 'STATE_CONFLICT' using errcode = '22023';
  end if;
  update public.audio_assets a set active_version_id = null where a.id = v_ver.asset_id and a.active_version_id = v_ver.id;
  update public.audio_asset_versions v
     set status = 'revoked', revoked_by = v_uid, revoked_at = now(), revoke_reason = p_reason
   where v.id = v_ver.id;
  perform private.write_audit('audio.version_revoke', 'audio_version', v_ver.id, null,
    jsonb_build_object('asset_id', v_ver.asset_id));
end;
$$;

-- Trạng thái chung cho trang /teacher/audio: cờ hệ thống (không đọc được trực tiếp qua API) và đồng ý của chính GV.
create or replace function public.teacher_audio_status()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_audio_staff(false);
  v_consent public.audio_voice_consents;
begin
  select * into v_consent from public.audio_voice_consents c where c.staff_id = v_uid and c.status = 'granted';
  return jsonb_build_object(
    'recording_enabled', private.feature_enabled('teacher_audio_recording_approved'),
    'consent_active', v_consent.id is not null,
    'consent_notice_version', v_consent.notice_version,
    'consent_granted_at', v_consent.granted_at,
    'role', (select s.role from public.staff_profiles s where s.id = v_uid));
end;
$$;

-- -------------------------------------------------------------------------------------
-- RLS — chỉ policy SELECT (ghi qua hàm teacher_*)
-- -------------------------------------------------------------------------------------

alter table public.audio_voice_consents enable row level security;
alter table public.audio_assets enable row level security;
alter table public.audio_asset_versions enable row level security;

create policy audio_voice_consents_read on public.audio_voice_consents for select to authenticated
  using (staff_id = (select auth.uid())
         or (school_id = (select private.my_school_id()) and (select private.is_admin())));

create policy audio_assets_school_read on public.audio_assets for select to authenticated
  using (school_id = (select private.my_school_id()));

create policy audio_asset_versions_read on public.audio_asset_versions for select to authenticated
  using (
    school_id = (select private.my_school_id())
    and (status not in ('draft', 'discarded') or created_by = (select auth.uid()) or (select private.is_admin()))
  );

-- -------------------------------------------------------------------------------------
-- Quyền (GRANT tường minh)
-- -------------------------------------------------------------------------------------

revoke all on public.audio_voice_consents, public.audio_assets, public.audio_asset_versions
  from public, anon, authenticated;
grant select on public.audio_voice_consents, public.audio_assets, public.audio_asset_versions to authenticated;
grant all on public.audio_voice_consents, public.audio_assets, public.audio_asset_versions to service_role;

revoke all on function
  public.teacher_audio_status(),
  public.teacher_grant_audio_consent(text),
  public.teacher_withdraw_audio_consent(text),
  public.teacher_ensure_audio_asset(text, text, text),
  public.teacher_confirm_audio_pronunciation(uuid, text),
  public.teacher_set_audio_note(uuid, text),
  public.teacher_create_audio_version(uuid, uuid, text, text, text, int, int),
  public.teacher_submit_audio_version(uuid),
  public.teacher_discard_audio_version(uuid),
  public.teacher_review_audio_version(uuid, text, text, boolean),
  public.teacher_revoke_audio_version(uuid, text)
from public, anon, authenticated;
grant execute on function
  public.teacher_audio_status(),
  public.teacher_grant_audio_consent(text),
  public.teacher_withdraw_audio_consent(text),
  public.teacher_ensure_audio_asset(text, text, text),
  public.teacher_confirm_audio_pronunciation(uuid, text),
  public.teacher_set_audio_note(uuid, text),
  public.teacher_create_audio_version(uuid, uuid, text, text, text, int, int),
  public.teacher_submit_audio_version(uuid),
  public.teacher_discard_audio_version(uuid),
  public.teacher_review_audio_version(uuid, text, text, boolean),
  public.teacher_revoke_audio_version(uuid, text)
to authenticated, service_role;

revoke all on function
  private.guard_audio_consent(), private.guard_audio_asset(), private.guard_audio_version(),
  private.audio_ext(text), private.require_audio_staff(boolean), private.audio_active_consent(uuid),
  private.lock_audio_version(uuid)
from public, anon, authenticated;
grant execute on function
  private.guard_audio_consent(), private.guard_audio_asset(), private.guard_audio_version(),
  private.audio_ext(text), private.require_audio_staff(boolean), private.audio_active_consent(uuid),
  private.lock_audio_version(uuid)
to service_role;
