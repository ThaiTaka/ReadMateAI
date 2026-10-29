-- R10.5 — Thư viện giọng máy (TTS) cho LỜI HƯỚNG DẪN và LỜI PHẢN HỒI cố định: tạo trước, giáo viên NGHE và DUYỆT, rồi mới phát.
--
-- Hai miền dữ liệu RIÊNG (không dùng chung bản ghi, quyền duyệt hay Storage):
--   * bản ghi giáo viên (audio_assets/audio_asset_versions, bucket `teacher-audio`) — âm/vần/tên chữ đơn lẻ;
--   * giọng máy (bảng dưới đây, bucket `tts-audio`) — câu lệnh và lời khen/nhắc cố định.
-- Nguyên tắc (docs/AUDIO_ENGINE.md §17):
--   * Hai lần xác nhận của giáo viên: (1) LỜI ĐỌC (chữ + cách đọc) trước khi được phép tạo tệp; (2) TỆP đã nghe trước khi dùng.
--   * Phiên bản đã tạo bất biến; đổi chữ / giọng / tốc độ / nhà cung cấp / phiên bản cấu hình → khóa tệp khác → duyệt lại.
--   * Mỗi (trường, lời đọc) có tối đa MỘT bản approved đang dùng; duyệt bản mới thì bản cũ thành superseded.
--   * Hai cờ hệ thống mặc định TẮT: `tts_library_approved` (tạo + duyệt) và `student_tts_playback_approved` (học sinh nghe).
--   * KHÔNG có dữ liệu học sinh trong lời đọc hay trong bảng; học sinh không có quyền đọc bảng hay Storage — chỉ máy chủ
--     (service_role) gọi MỘT hàm kiểm tra lại mọi điều kiện ở mỗi lần phát.

insert into private.feature_flags (key, enabled, note) values
  ('tts_library_approved', false,
   'Tạo và duyệt âm thanh giọng máy cho câu lệnh/lời phản hồi: chỉ bật khi chủ dự án đã chọn nhà cung cấp/giọng, xác nhận điều khoản và chi phí (R10.5).'),
  ('student_tts_playback_approved', false,
   'Phát âm thanh giọng máy ĐÃ DUYỆT cho học sinh: chỉ bật khi giáo viên đã nghe và duyệt tệp, thử trên iPhone/Android và chủ dự án cho phép (R10.5).');

-- -------------------------------------------------------------------------------------
-- Bảng
-- -------------------------------------------------------------------------------------

-- Bước 1 — giáo viên duyệt LỜI ĐỌC (chữ + cách đọc) của một mục danh mục, theo đúng bản băm nội dung hiện hành.
create table public.tts_script_reviews (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id),
  entry_id text not null check (entry_id ~ '^(instruction|feedback):[a-z0-9_.]{1,60}$'),
  content_hash text not null check (content_hash ~ '^[0-9a-f]{64}$'),
  decision text not null check (decision in ('approved', 'rejected')),
  pronunciation_confirmed boolean not null,
  note text null check (note is null or private.is_clean_text(note, 3, 500)),
  reviewed_by uuid not null references public.staff_profiles (id),
  reviewed_at timestamptz not null default now(),
  unique (school_id, entry_id, content_hash),
  check (decision <> 'approved' or pronunciation_confirmed),
  check (decision <> 'rejected' or note is not null)
);
comment on table public.tts_script_reviews is
  'Duyệt lời đọc TTS (bước 1): chỉ lời đọc có bản duyệt khớp băm nội dung hiện hành mới được tạo tệp và mới phát được.';

-- Bước 2 — tệp âm thanh đã tạo; chỉ approved mới được phát.
create table public.tts_audio_versions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id),
  entry_id text not null check (entry_id ~ '^(instruction|feedback):[a-z0-9_.]{1,60}$'),
  purpose text not null check (purpose in ('instruction', 'feedback')),
  text_nfc text not null check (text_nfc is nfc normalized and char_length(text_nfc) between 1 and 300),
  content_hash text not null check (content_hash ~ '^[0-9a-f]{64}$'),
  -- Khóa dùng lại tệp: nhà cung cấp + mục đích + giọng + tốc độ + phiên bản cấu hình + chữ NFC (src/server/tts/hash.ts).
  asset_key text not null check (asset_key ~ '^[0-9a-f]{64}$'),
  provider text not null check (provider in ('viettel', 'fpt', 'google')),
  voice_key text not null check (voice_key ~ '^[a-z0-9-]{1,40}$'),
  speed text not null check (speed in ('slow', 'normal')),
  config_version text not null check (config_version ~ '^[a-z0-9._-]{1,40}$' and config_version !~ '^provisional'),
  version_no int not null check (version_no >= 1),
  status text not null default 'pending_review'
    check (status in ('pending_review', 'approved', 'rejected', 'revoked', 'superseded')),
  storage_bucket text not null default 'tts-audio' check (storage_bucket = 'tts-audio'),
  storage_key text not null check (
    storage_key ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(mp3|wav|ogg)$'
  ),
  mime_type text not null check (mime_type in ('audio/mpeg', 'audio/wav', 'audio/ogg')),
  size_bytes int not null check (size_bytes between 1 and 2097152),
  duration_ms int not null check (duration_ms between 300 and 10000),
  content_sha256 text not null check (content_sha256 ~ '^[0-9a-f]{64}$'),
  -- Tệp dựng cho kiểm thử tự động: chỉ tạo/phát được khi `private.test_environment.fixtures_allowed` (chỉ local/CI).
  test_only boolean not null default false,
  generated_by uuid not null references public.staff_profiles (id),
  generated_at timestamptz not null default now(),
  review_listened boolean not null default false,
  review_pronunciation_confirmed boolean not null default false,
  review_note text null check (review_note is null or private.is_clean_text(review_note, 3, 500)),
  reviewed_by uuid null references public.staff_profiles (id),
  reviewed_at timestamptz null,
  revoked_by uuid null references public.staff_profiles (id),
  revoked_at timestamptz null,
  revoke_reason text null check (revoke_reason is null or private.is_clean_text(revoke_reason, 3, 300)),
  unique (school_id, entry_id, version_no),
  check ((reviewed_by is null) = (reviewed_at is null)),
  check (status not in ('approved', 'rejected', 'superseded') or reviewed_by is not null),
  check (status <> 'pending_review' or reviewed_by is null),
  check (status <> 'approved' or (review_listened and review_pronunciation_confirmed)),
  check (status <> 'rejected' or review_note is not null),
  check ((status = 'revoked') = (revoked_at is not null)),
  check ((revoked_at is null) = (revoked_by is null) and (revoked_at is null) = (revoke_reason is null))
);
comment on table public.tts_audio_versions is
  'Tệp giọng máy của câu lệnh/lời phản hồi cố định. Metadata + khóa đối tượng trong bucket riêng tư `tts-audio`; không dữ liệu học sinh.';
create index tts_audio_versions_school_entry_idx on public.tts_audio_versions (school_id, entry_id, version_no desc);
-- Một bản approved đang dùng cho mỗi (trường, lời đọc).
create unique index tts_audio_versions_one_approved on public.tts_audio_versions (school_id, entry_id) where status = 'approved';
-- Không tạo trùng tệp cùng khóa khi còn bản đang chờ/đang dùng (bị từ chối/thu hồi thì được tạo lại).
create unique index tts_audio_versions_one_live_per_key on public.tts_audio_versions (school_id, asset_key)
  where status in ('pending_review', 'approved');

-- -------------------------------------------------------------------------------------
-- Bất biến
-- -------------------------------------------------------------------------------------

create or replace function private.guard_tts_version()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'TTS_RECORD_NO_DELETE' using errcode = '23514';
  end if;
  if tg_op = 'INSERT' then
    if new.status <> 'pending_review' then
      raise exception 'TTS_VERSION_MUST_START_PENDING' using errcode = '23514';
    end if;
    return new;
  end if;
  -- Nội dung và nguồn gốc của phiên bản bất biến; chỉ trạng thái và dấu vết duyệt/thu hồi được đặt thêm.
  if new.id <> old.id or new.school_id <> old.school_id or new.entry_id <> old.entry_id or new.purpose <> old.purpose
     or new.text_nfc <> old.text_nfc or new.content_hash <> old.content_hash or new.asset_key <> old.asset_key
     or new.provider <> old.provider or new.voice_key <> old.voice_key or new.speed <> old.speed
     or new.config_version <> old.config_version or new.version_no <> old.version_no
     or new.storage_bucket <> old.storage_bucket or new.storage_key <> old.storage_key
     or new.mime_type <> old.mime_type or new.size_bytes <> old.size_bytes or new.duration_ms <> old.duration_ms
     or new.content_sha256 <> old.content_sha256 or new.test_only <> old.test_only
     or new.generated_by <> old.generated_by or new.generated_at <> old.generated_at then
    raise exception 'TTS_VERSION_IMMUTABLE' using errcode = '23514';
  end if;
  if (old.reviewed_at is not null and (new.reviewed_at is distinct from old.reviewed_at
        or new.reviewed_by is distinct from old.reviewed_by or new.review_note is distinct from old.review_note
        or new.review_listened is distinct from old.review_listened
        or new.review_pronunciation_confirmed is distinct from old.review_pronunciation_confirmed))
     or old.revoked_at is not null then
    raise exception 'TTS_VERSION_IMMUTABLE' using errcode = '23514';
  end if;
  if new.status = old.status then
    if new is distinct from old then
      raise exception 'TTS_VERSION_IMMUTABLE' using errcode = '23514';
    end if;
    return new;
  end if;
  if not (
    (old.status = 'pending_review' and new.status in ('approved', 'rejected'))
    or (old.status = 'approved' and new.status in ('revoked', 'superseded'))
    or (old.status = 'pending_review' and new.status = 'revoked')
  ) then
    raise exception 'TTS_ILLEGAL_TRANSITION' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger tts_audio_versions_guard before insert or update or delete on public.tts_audio_versions
  for each row execute function private.guard_tts_version();

create or replace function private.guard_tts_review()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'TTS_RECORD_NO_DELETE' using errcode = '23514';
  end if;
  if tg_op = 'UPDATE' and (new.id <> old.id or new.school_id <> old.school_id or new.entry_id <> old.entry_id
     or new.content_hash <> old.content_hash) then
    raise exception 'TTS_REVIEW_IMMUTABLE' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger tts_script_reviews_guard before update or delete on public.tts_script_reviews
  for each row execute function private.guard_tts_review();

-- -------------------------------------------------------------------------------------
-- Hàm của giáo viên (JWT GV; tự kiểm tra quyền; audit cùng giao dịch)
-- -------------------------------------------------------------------------------------

create or replace function private.require_tts_staff(p_write boolean default true)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_staff();
begin
  if p_write and not private.feature_enabled('tts_library_approved') then
    raise exception 'TTS_LIBRARY_DISABLED' using errcode = '22023';
  end if;
  return v_uid;
end;
$$;

create or replace function public.teacher_tts_status()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_tts_staff(false);
begin
  return jsonb_build_object(
    'library_enabled', private.feature_enabled('tts_library_approved'),
    'role', (select s.role from public.staff_profiles s where s.id = v_uid));
end;
$$;

-- Bước 1: duyệt hoặc từ chối LỜI ĐỌC. Duyệt đòi giáo viên xác nhận cách đọc; từ chối đòi ghi chú. Có thể đổi quyết định
-- (cập nhật cùng bản băm); mọi lần đổi đều vào nhật ký bất biến.
create or replace function public.teacher_review_tts_script(
  p_entry_id text,
  p_content_hash text,
  p_decision text,
  p_pronunciation_confirmed boolean,
  p_note text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_tts_staff(true);
  v_school uuid := (select private.my_school_id());
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  if p_entry_id is null or p_entry_id !~ '^(instruction|feedback):[a-z0-9_.]{1,60}$'
     or p_content_hash is null or p_content_hash !~ '^[0-9a-f]{64}$'
     or p_decision not in ('approve', 'reject') then
    raise exception 'INVALID_INPUT' using errcode = '22023';
  end if;
  if p_decision = 'approve' then
    if p_pronunciation_confirmed is not true then
      raise exception 'PRONUNCIATION_UNCONFIRMED' using errcode = '22023';
    end if;
  elsif v_note is null or not private.is_clean_text(v_note, 3, 500) then
    raise exception 'NOTE_REQUIRED' using errcode = '22023';
  end if;
  insert into public.tts_script_reviews (school_id, entry_id, content_hash, decision, pronunciation_confirmed, note, reviewed_by)
  values (v_school, p_entry_id, p_content_hash, case p_decision when 'approve' then 'approved' else 'rejected' end,
          p_decision = 'approve', v_note, v_uid)
  on conflict (school_id, entry_id, content_hash) do update
    set decision = excluded.decision, pronunciation_confirmed = excluded.pronunciation_confirmed,
        note = excluded.note, reviewed_by = excluded.reviewed_by, reviewed_at = now();
  -- Từ chối/thu hồi duyệt lời đọc: các tệp đang chờ/đang dùng của lời đọc này không còn hợp lệ.
  if p_decision = 'reject' then
    update public.tts_audio_versions v
       set status = 'revoked', revoked_by = v_uid, revoked_at = now(), revoke_reason = 'Lời đọc đã bị từ chối duyệt'
     where v.school_id = v_school and v.entry_id = p_entry_id and v.content_hash = p_content_hash
       and v.status in ('pending_review', 'approved');
  end if;
  perform private.write_audit('tts.script_review', 'tts_script', null, null,
    jsonb_build_object('entry_id', p_entry_id, 'decision', p_decision));
  return jsonb_build_object('entry_id', p_entry_id, 'status', case p_decision when 'approve' then 'approved' else 'rejected' end);
end;
$$;

-- Đăng ký MỘT tệp đã tạo và đã lưu vào Storage (máy chủ gọi bằng JWT của giáo viên sau khi kiểm tệp theo nội dung). Chỉ khi lời đọc
-- đã được duyệt khớp bản băm; luôn bắt đầu ở pending_review.
create or replace function public.teacher_register_tts_version(
  p_version_id uuid,
  p_entry_id text,
  p_purpose text,
  p_text text,
  p_content_hash text,
  p_asset_key text,
  p_provider text,
  p_voice_key text,
  p_speed text,
  p_config_version text,
  p_storage_key text,
  p_mime_type text,
  p_size_bytes int,
  p_duration_ms int,
  p_content_sha256 text,
  p_test_only boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_tts_staff(true);
  v_school uuid := (select private.my_school_id());
  v_no int;
begin
  if p_version_id is null or p_entry_id is null or p_text is null or p_content_hash is null or p_asset_key is null
     or p_storage_key is null or p_provider not in ('viettel', 'fpt', 'google') then
    raise exception 'INVALID_INPUT' using errcode = '22023';
  end if;
  if coalesce(p_test_only, false)
     and not coalesce((select t.fixtures_allowed from private.test_environment t where t.singleton), false) then
    raise exception 'TEST_ONLY_NOT_ALLOWED' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.tts_script_reviews r
     where r.school_id = v_school and r.entry_id = p_entry_id and r.content_hash = p_content_hash
       and r.decision = 'approved' and r.pronunciation_confirmed
  ) then
    raise exception 'SCRIPT_NOT_APPROVED' using errcode = '22023';
  end if;
  if split_part(p_storage_key, '/', 1) <> v_school::text then
    raise exception 'TTS_SCOPE_MISMATCH' using errcode = '23514';
  end if;
  select coalesce(max(v.version_no), 0) + 1 into v_no
    from public.tts_audio_versions v where v.school_id = v_school and v.entry_id = p_entry_id;
  insert into public.tts_audio_versions (
    id, school_id, entry_id, purpose, text_nfc, content_hash, asset_key, provider, voice_key, speed, config_version,
    version_no, storage_key, mime_type, size_bytes, duration_ms, content_sha256, test_only, generated_by)
  values (
    p_version_id, v_school, p_entry_id, p_purpose, p_text, p_content_hash, p_asset_key, p_provider, p_voice_key, p_speed,
    p_config_version, v_no, p_storage_key, p_mime_type, p_size_bytes, p_duration_ms, p_content_sha256,
    coalesce(p_test_only, false), v_uid);
  perform private.write_audit('tts.version_register', 'tts_version', p_version_id, null,
    jsonb_build_object('entry_id', p_entry_id, 'provider', p_provider, 'version_no', v_no));
  return jsonb_build_object('version_no', v_no);
end;
$$;

create or replace function private.lock_tts_version(p_version_id uuid)
returns public.tts_audio_versions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ver public.tts_audio_versions;
begin
  select v.* into v_ver from public.tts_audio_versions v
   where v.id = p_version_id and v.school_id = (select private.my_school_id()) for update;
  if v_ver.id is null then
    raise exception 'NOT_FOUND' using errcode = '22023';
  end if;
  return v_ver;
end;
$$;

-- Bước 2: nghe rồi duyệt hoặc từ chối TỆP. Duyệt đòi: đã nghe, xác nhận cách đọc, lời đọc đã duyệt khớp bản băm.
create or replace function public.teacher_review_tts_version(
  p_version_id uuid,
  p_decision text,
  p_note text,
  p_listened boolean,
  p_pronunciation_confirmed boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_tts_staff(true);
  v_ver public.tts_audio_versions := private.lock_tts_version(p_version_id);
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  if p_decision not in ('approve', 'reject') then
    raise exception 'INVALID_INPUT' using errcode = '22023';
  end if;
  if v_ver.status <> 'pending_review' then
    raise exception 'STATE_CONFLICT' using errcode = '22023';
  end if;
  if p_decision = 'approve' then
    if p_listened is not true then
      raise exception 'LISTEN_REQUIRED' using errcode = '22023';
    end if;
    if p_pronunciation_confirmed is not true then
      raise exception 'PRONUNCIATION_UNCONFIRMED' using errcode = '22023';
    end if;
    if not exists (
      select 1 from public.tts_script_reviews r
       where r.school_id = v_ver.school_id and r.entry_id = v_ver.entry_id and r.content_hash = v_ver.content_hash
         and r.decision = 'approved' and r.pronunciation_confirmed
    ) then
      raise exception 'SCRIPT_NOT_APPROVED' using errcode = '22023';
    end if;
    update public.tts_audio_versions v set status = 'superseded'
     where v.school_id = v_ver.school_id and v.entry_id = v_ver.entry_id and v.status = 'approved' and v.id <> v_ver.id;
    update public.tts_audio_versions v
       set status = 'approved', reviewed_by = v_uid, reviewed_at = now(), review_note = v_note,
           review_listened = true, review_pronunciation_confirmed = true
     where v.id = v_ver.id;
  else
    if v_note is null or not private.is_clean_text(v_note, 3, 500) then
      raise exception 'NOTE_REQUIRED' using errcode = '22023';
    end if;
    update public.tts_audio_versions v
       set status = 'rejected', reviewed_by = v_uid, reviewed_at = now(), review_note = v_note,
           review_listened = coalesce(p_listened, false), review_pronunciation_confirmed = false
     where v.id = v_ver.id;
  end if;
  perform private.write_audit('tts.version_review', 'tts_version', v_ver.id, null,
    jsonb_build_object('entry_id', v_ver.entry_id, 'decision', p_decision));
  return jsonb_build_object('version_id', v_ver.id, 'status', case p_decision when 'approve' then 'approved' else 'rejected' end);
end;
$$;

-- Thu hồi/ngừng dùng: giáo viên của trường; luôn được phép (kể cả khi cờ tắt).
create or replace function public.teacher_revoke_tts_version(p_version_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_tts_staff(false);
  v_ver public.tts_audio_versions := private.lock_tts_version(p_version_id);
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if v_ver.status not in ('pending_review', 'approved') then
    raise exception 'STATE_CONFLICT' using errcode = '22023';
  end if;
  if v_reason is null or not private.is_clean_text(v_reason, 3, 300) then
    raise exception 'NOTE_REQUIRED' using errcode = '22023';
  end if;
  update public.tts_audio_versions v
     set status = 'revoked', revoked_by = v_uid, revoked_at = now(), revoke_reason = v_reason
   where v.id = v_ver.id;
  perform private.write_audit('tts.version_revoke', 'tts_version', v_ver.id, null,
    jsonb_build_object('entry_id', v_ver.entry_id));
end;
$$;

-- -------------------------------------------------------------------------------------
-- Hàm của student gateway (chỉ service_role, chỉ ĐỌC)
-- -------------------------------------------------------------------------------------

-- Trả metadata bản approved đang dùng của MỘT lời đọc cho một học sinh, hoặc ném mã lỗi máy đọc:
--   AUDIO_PLAYBACK_DISABLED · FORBIDDEN · CONSENT_REQUIRED · AUDIO_NOT_AVAILABLE · INVALID_INPUT
-- `p_content_hash` và `p_asset_key` do MÁY CHỦ tính từ danh mục + cấu hình giọng hiện hành: chữ hoặc giọng đã đổi thì bản đã duyệt
-- không còn khớp → không phát. Phạm vi = TRƯỜNG của lớp học sinh.
create or replace function public.gateway_resolve_tts_line(
  p_auth_user_id uuid,
  p_student_id uuid,
  p_entry_id text,
  p_content_hash text,
  p_asset_key text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_class_id uuid;
  v_school_id uuid;
  v_ver public.tts_audio_versions;
begin
  if not private.feature_enabled('student_tts_playback_approved') then
    raise exception 'AUDIO_PLAYBACK_DISABLED' using errcode = '22023';
  end if;
  if p_auth_user_id is null or p_student_id is null
     or p_entry_id is null or p_entry_id !~ '^(instruction|feedback):[a-z0-9_.]{1,60}$'
     or p_content_hash is null or p_content_hash !~ '^[0-9a-f]{64}$'
     or p_asset_key is null or p_asset_key !~ '^[0-9a-f]{64}$' then
    raise exception 'INVALID_INPUT' using errcode = '22023';
  end if;

  v_class_id := private.require_linked_device(p_auth_user_id, p_student_id);
  if not private.consent_active(p_student_id, 'learning_data') then
    raise exception 'CONSENT_REQUIRED' using errcode = '42501';
  end if;
  select c.school_id into v_school_id from public.classes c where c.id = v_class_id;

  select v.* into v_ver from public.tts_audio_versions v
   where v.school_id = v_school_id and v.entry_id = p_entry_id and v.status = 'approved';
  if v_ver.id is null or v_ver.reviewed_by is null
     or v_ver.review_listened is not true or v_ver.review_pronunciation_confirmed is not true
     or v_ver.content_hash <> p_content_hash or v_ver.asset_key <> p_asset_key then
    raise exception 'AUDIO_NOT_AVAILABLE' using errcode = '22023';
  end if;
  if v_ver.test_only
     and not coalesce((select t.fixtures_allowed from private.test_environment t where t.singleton), false) then
    raise exception 'AUDIO_NOT_AVAILABLE' using errcode = '22023';
  end if;
  -- Lời đọc vẫn còn được duyệt (bị từ chối/thu hồi duyệt là dừng phát ngay).
  if not exists (
    select 1 from public.tts_script_reviews r
     where r.school_id = v_school_id and r.entry_id = p_entry_id and r.content_hash = p_content_hash
       and r.decision = 'approved' and r.pronunciation_confirmed
  ) then
    raise exception 'AUDIO_NOT_AVAILABLE' using errcode = '22023';
  end if;

  return jsonb_build_object(
    'versionId', v_ver.id,
    'storageKey', v_ver.storage_key,
    'mimeType', v_ver.mime_type,
    'sizeBytes', v_ver.size_bytes,
    'durationMs', v_ver.duration_ms,
    'contentHash', v_ver.content_sha256);
end;
$$;

-- -------------------------------------------------------------------------------------
-- RLS — chỉ policy SELECT cho giáo viên cùng trường (ghi qua hàm teacher_*)
-- -------------------------------------------------------------------------------------

alter table public.tts_script_reviews enable row level security;
alter table public.tts_audio_versions enable row level security;

create policy tts_script_reviews_school_read on public.tts_script_reviews for select to authenticated
  using (school_id = (select private.my_school_id()));
create policy tts_audio_versions_school_read on public.tts_audio_versions for select to authenticated
  using (school_id = (select private.my_school_id()));

revoke all on public.tts_script_reviews, public.tts_audio_versions from public, anon, authenticated;
grant select on public.tts_script_reviews, public.tts_audio_versions to authenticated;
grant all on public.tts_script_reviews, public.tts_audio_versions to service_role;

revoke all on function
  public.teacher_tts_status(),
  public.teacher_review_tts_script(text, text, text, boolean, text),
  public.teacher_register_tts_version(uuid, text, text, text, text, text, text, text, text, text, text, text, int, int, text, boolean),
  public.teacher_review_tts_version(uuid, text, text, boolean, boolean),
  public.teacher_revoke_tts_version(uuid, text)
from public, anon, authenticated;
grant execute on function
  public.teacher_tts_status(),
  public.teacher_review_tts_script(text, text, text, boolean, text),
  public.teacher_register_tts_version(uuid, text, text, text, text, text, text, text, text, text, text, text, int, int, text, boolean),
  public.teacher_review_tts_version(uuid, text, text, boolean, boolean),
  public.teacher_revoke_tts_version(uuid, text)
to authenticated, service_role;

revoke all on function public.gateway_resolve_tts_line(uuid, uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.gateway_resolve_tts_line(uuid, uuid, text, text, text) to service_role;

revoke all on function
  private.guard_tts_version(), private.guard_tts_review(), private.require_tts_staff(boolean), private.lock_tts_version(uuid)
from public, anon, authenticated;
grant execute on function
  private.guard_tts_version(), private.guard_tts_review(), private.require_tts_staff(boolean), private.lock_tts_version(uuid)
to service_role;
