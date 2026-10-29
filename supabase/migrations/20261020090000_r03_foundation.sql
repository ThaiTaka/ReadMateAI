-- =====================================================================================
-- R03 — Nền tảng dữ liệu: trường, giáo viên, lớp, học sinh, thẻ học, thiết bị, đồng ý
-- hai phạm vi, nhóm năng lực, mùa thi đua, nhật ký kiểm toán, giới hạn tần suất, và
-- bảng đồng bộ kho tri thức (content/) theo phiên bản.
--
-- Nguyên tắc (CLAUDE.md §6, docs/DATA_MODEL.md, docs/REDESIGN_ARCHITECTURE.md §5, §8):
--   * RLS bật cho MỌI bảng của schema public; không bảng nào có policy INSERT/UPDATE/DELETE
--     cho anon/authenticated — mọi thao tác ghi đi qua hàm (migration 20261020090100).
--   * GRANT viết tường minh (config.toml: auto_expose_new_tables = false): anon không có
--     quyền gì; authenticated chỉ SELECT (RLS lọc dòng); service_role dùng cho máy chủ.
--   * class_id phi chuẩn hóa trên dữ liệu học sinh, khóa ngoại kép (student_id, class_id)
--     bảo đảm nhất quán.
--   * Văn bản tiếng Việt: kiểm tra NFC, cắt khoảng trắng, chặn ký tự điều khiển/ẩn.
-- Không chứa dữ liệu nào (dữ liệu giả: scripts/db-seed.ts).
-- =====================================================================================

create schema if not exists private;
comment on schema private is
  'Hàm trợ giúp RLS và cờ hệ thống. KHÔNG thêm vào "Exposed schemas" của Data API.';
revoke all on schema private from public, anon, authenticated;
-- authenticated cần USAGE để policy RLS gọi được các hàm trợ giúp (chỉ những hàm được GRANT).
grant usage on schema private to authenticated, service_role;

-- -------------------------------------------------------------------------------------
-- Trợ giúp chung
-- -------------------------------------------------------------------------------------

create or replace function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Văn bản ngắn do người dùng nhập (biệt danh, tên lớp…): NFC, không khoảng trắng đầu/cuối,
-- không ký tự điều khiển, không ký tự ẩn/định hướng (U+00AD, U+200B–U+200F, U+2028–U+202E,
-- U+2060–U+2064, U+FEFF) — chặn giả mạo tên.
create or replace function private.is_clean_text(p_value text, p_min int, p_max int)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_value is nfc normalized
    and p_value = btrim(p_value)
    and char_length(p_value) between p_min and p_max
    and p_value !~ '[\u0001-\u001F\u007F-\u009F\u00AD\u200B-\u200F\u2028-\u202E\u2060-\u2064\uFEFF]';
$$;

-- Cờ hệ thống — chỉ đổi bằng migration sau khi có chấp thuận bằng văn bản (PRIVACY_AND_SECURITY §5).
create table private.feature_flags (
  key text primary key,
  enabled boolean not null default false,
  note text not null,
  updated_at timestamptz not null default now()
);
insert into private.feature_flags (key, enabled, note) values
  ('leaderboard_feature_approved', false,
   'Bảng xếp hạng lớp: chỉ bật sau rà soát pháp lý Luật 91/2025 Điều 24 và chấp thuận của nhà trường.'),
  ('honors_feature_approved', false,
   'Vinh danh TOP 3: chỉ bật sau chấp thuận của nhà trường.');
revoke all on private.feature_flags from public, anon, authenticated;

create or replace function private.feature_enabled(p_key text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select f.enabled from private.feature_flags f where f.key = p_key), false);
$$;

-- -------------------------------------------------------------------------------------
-- Trường và giáo viên
-- -------------------------------------------------------------------------------------

create table public.schools (
  id uuid primary key default gen_random_uuid(),
  name text not null check (private.is_clean_text(name, 1, 120)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.schools is 'Trường học (đơn vị sở hữu lớp và tài khoản giáo viên).';

create table public.staff_profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  school_id uuid not null references public.schools (id),
  display_name text not null check (private.is_clean_text(display_name, 1, 60)),
  role text not null default 'teacher' check (role in ('teacher', 'admin')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.staff_profiles is
  'Hồ sơ giáo viên/quản trị. Email chỉ nằm trong auth.users; tài khoản do quản trị tạo (không tự đăng ký).';
create index staff_profiles_school_idx on public.staff_profiles (school_id);

-- -------------------------------------------------------------------------------------
-- Kho tri thức và tiến độ chương trình (đồng bộ từ content/ — scripts/db-sync-content.ts)
-- -------------------------------------------------------------------------------------

create table public.content_releases (
  id uuid primary key default gen_random_uuid(),
  dataset_version text not null check (dataset_version ~ '^\d+\.\d+\.\d+$'),
  content_hash text not null unique check (content_hash ~ '^[0-9a-f]{64}$'),
  stats jsonb not null default '{}' check (jsonb_typeof(stats) = 'object'),
  synced_at timestamptz not null default now()
);
comment on table public.content_releases is
  'Mỗi lần đồng bộ content/ có nội dung khác là một phiên bản (băm SHA-256 của toàn bộ tệp JSON).';

create table public.curriculum_series (
  id uuid primary key default gen_random_uuid(),
  key text not null unique check (key ~ '^series:[a-z0-9-]+$'),
  series_kind text not null check (series_kind in ('textbook', 'illustrative', 'teacher_custom')),
  title text not null check (private.is_clean_text(title, 1, 200)),
  source text null,
  review_status text not null check (review_status in ('draft', 'pending_review', 'approved', 'rejected', 'retired')),
  reviewed_by text null,
  reviewed_at date null,
  content_hash text null check (content_hash ~ '^[0-9a-f]{64}$'),
  release_id uuid not null references public.content_releases (id),
  updated_at timestamptz not null default now(),
  -- Không bao giờ "đã duyệt" khi thiếu người duyệt/ngày/băm (AD-30).
  check (review_status <> 'approved' or (reviewed_by is not null and reviewed_at is not null and content_hash is not null)),
  -- Bộ sách thật phải có nguồn (AD-31).
  check (series_kind <> 'textbook' or source is not null)
);
comment on table public.curriculum_series is
  'Bộ sách/chuỗi bài. illustrative = chuỗi minh họa của dự án, KHÔNG phải chương trình thật của lớp.';

create table public.curriculum_lessons (
  id uuid primary key default gen_random_uuid(),
  series_id uuid not null references public.curriculum_series (id) on delete cascade,
  ordinal int not null check (ordinal >= 1),
  code text not null check (private.is_clean_text(code, 1, 40)),
  title text not null check (private.is_clean_text(title, 1, 200)),
  lesson_type text not null check (lesson_type in ('new_units', 'review', 'reading', 'other')),
  introduces text[] not null default '{}',
  reviews text[] not null default '{}',
  unique (series_id, ordinal),
  unique (id, series_id)
);
comment on table public.curriculum_lessons is 'Thứ tự bài (chỉ dữ kiện: mã, tên, đơn vị giới thiệu/ôn) — không sao chép bài đọc.';

create table public.kb_units (
  id uuid primary key default gen_random_uuid(),
  key text not null unique check (key ~ '^[a-z]+:.+$'),
  kind text not null check (kind in ('letter', 'phoneme', 'rime', 'tone', 'syllable', 'word', 'sentence')),
  text text not null check (text is nfc normalized and char_length(text) between 1 and 300),
  review_status text not null check (review_status in ('draft', 'pending_review', 'approved', 'rejected', 'retired')),
  reviewed_by text null,
  reviewed_at date null,
  content_hash text null check (content_hash ~ '^[0-9a-f]{64}$'),
  release_id uuid not null references public.content_releases (id),
  updated_at timestamptz not null default now(),
  check (review_status <> 'approved' or (reviewed_by is not null and reviewed_at is not null and content_hash is not null))
);
comment on table public.kb_units is
  'Đơn vị tri thức (chữ, âm, vần, thanh, tiếng, từ, câu) đồng bộ từ content/ — trạng thái duyệt lấy nguyên từ tệp nguồn.';
create index kb_units_kind_status_idx on public.kb_units (kind, review_status);

-- -------------------------------------------------------------------------------------
-- Lớp học
-- -------------------------------------------------------------------------------------

create table public.classes (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id),
  name text not null check (private.is_clean_text(name, 1, 40)),
  school_year text not null check (
    school_year ~ '^\d{4}-\d{4}$'
    and split_part(school_year, '-', 2)::int = split_part(school_year, '-', 1)::int + 1
  ),
  status text not null default 'active' check (status in ('active', 'archived')),
  -- AD-52: mặc định TẮT; trigger guard_class_flags chặn bật khi cờ hệ thống chưa được chấp thuận.
  leaderboard_enabled boolean not null default false,
  honors_enabled boolean not null default false,
  leaderboard_student_view text not null default 'top10_and_me'
    check (leaderboard_student_view in ('top10_and_me', 'full')),
  -- Tiến độ chương trình: mặc định CHƯA xác nhận; không có đường tự động sang confirmed (CLAUDE.md §9.2.4).
  curriculum_series_id uuid null references public.curriculum_series (id),
  current_lesson_id uuid null references public.curriculum_lessons (id),
  curriculum_status text not null default 'unconfirmed' check (curriculum_status in ('unconfirmed', 'confirmed')),
  curriculum_confirmed_by uuid null references public.staff_profiles (id),
  curriculum_confirmed_at timestamptz null,
  language_conventions jsonb not null default '{}' check (jsonb_typeof(language_conventions) = 'object'),
  teacher_term text not null default 'cô' check (teacher_term in ('cô', 'thầy')),
  student_term text not null default 'con' check (student_term in ('con', 'em')),
  archived_at timestamptz null,
  created_by uuid null references public.staff_profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, name, school_year),
  check ((status = 'archived') = (archived_at is not null)),
  check (current_lesson_id is null or curriculum_series_id is not null),
  check (
    curriculum_status = 'unconfirmed'
    or (curriculum_series_id is not null and current_lesson_id is not null
        and curriculum_confirmed_by is not null and curriculum_confirmed_at is not null)
  )
);
comment on table public.classes is
  'Lớp học. Cờ bảng xếp hạng/vinh danh mặc định tắt; tiến độ chương trình mặc định chưa xác nhận.';
create index classes_school_idx on public.classes (school_id);

create table public.class_staff (
  class_id uuid not null references public.classes (id) on delete cascade,
  staff_id uuid not null references public.staff_profiles (id) on delete cascade,
  role text not null check (role in ('owner', 'co_teacher')),
  can_honor boolean not null default false,
  added_at timestamptz not null default now(),
  added_by uuid null references public.staff_profiles (id),
  removed_at timestamptz null,
  primary key (class_id, staff_id)
);
comment on table public.class_staff is 'Giáo viên thuộc lớp. Gỡ quyền = đặt removed_at (không xóa lịch sử).';
create unique index class_staff_one_owner on public.class_staff (class_id) where role = 'owner' and removed_at is null;
create index class_staff_staff_idx on public.class_staff (staff_id) where removed_at is null;

-- -------------------------------------------------------------------------------------
-- Học sinh (dữ liệu tối thiểu — CLAUDE.md §6.1)
-- -------------------------------------------------------------------------------------

create table public.students (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes (id) on delete cascade,
  -- Mã nội bộ trong lớp = số thứ tự (không phải mã định danh cá nhân).
  student_number smallint null check (student_number between 1 and 99),
  display_name text not null check (private.is_clean_text(display_name, 1, 30)),
  leaderboard_alias text null check (leaderboard_alias is null or private.is_clean_text(leaderboard_alias, 1, 20)),
  leaderboard_alias_approved_by uuid null references public.staff_profiles (id),
  leaderboard_alias_approved_at timestamptz null,
  avatar_key text not null check (avatar_key ~ '^[a-z][a-z0-9-]{0,39}$'),
  motion_preference text not null default 'system' check (motion_preference in ('system', 'reduce', 'full')),
  sound_preference text not null default 'on' check (sound_preference in ('on', 'off')),
  status text not null default 'active' check (status in ('active', 'paused', 'archived')),
  archived_at timestamptz null,
  created_by uuid null references public.staff_profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (class_id, student_number),
  unique (id, class_id),
  check ((status = 'archived') = (archived_at is not null)),
  check ((leaderboard_alias_approved_by is null) = (leaderboard_alias_approved_at is null)),
  check (leaderboard_alias is not null or leaderboard_alias_approved_at is null)
);
comment on table public.students is
  'Hồ sơ học sinh tối thiểu: biệt danh, số thứ tự, avatar có sẵn, cài đặt trợ năng. Không họ tên đầy đủ, ngày sinh, giới tính, ảnh, liên hệ.';
create index students_class_idx on public.students (class_id);
-- Không trùng biệt danh / tên hiển thị trên bảng trong cùng lớp (không phân biệt hoa thường).
create unique index students_display_name_per_class on public.students (class_id, lower(display_name));
create unique index students_alias_per_class on public.students (class_id, lower(leaderboard_alias))
  where leaderboard_alias is not null;

create table public.student_band_assignments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null,
  class_id uuid not null,
  band text not null check (band in ('foundation', 'developing', 'extending')),
  source text not null default 'teacher' check (source in ('teacher', 'suggestion_accepted')),
  reason text null check (reason is null or private.is_clean_text(reason, 1, 200)),
  valid_from timestamptz not null default now(),
  valid_to timestamptz null,
  set_by uuid not null references public.staff_profiles (id),
  foreign key (student_id, class_id) references public.students (id, class_id) on delete cascade,
  check (valid_to is null or valid_to >= valid_from)
);
comment on table public.student_band_assignments is
  'Lịch sử nhóm năng lực/lộ trình — CHỈ giáo viên đọc được (học sinh không bao giờ thấy, CLAUDE.md §6.4).';
create unique index student_band_current on public.student_band_assignments (student_id) where valid_to is null;
create index student_band_class_idx on public.student_band_assignments (class_id);

-- -------------------------------------------------------------------------------------
-- Thẻ học và thiết bị
-- -------------------------------------------------------------------------------------

create table public.student_login_codes (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null,
  class_id uuid not null,
  -- HMAC-SHA256(mã, LOGIN_CODE_PEPPER) — KHÔNG lưu mã gốc (ARCHITECTURE §8.2).
  token_hmac bytea not null unique check (octet_length(token_hmac) = 32),
  backup_code_hmac bytea not null unique check (octet_length(backup_code_hmac) = 32),
  max_devices smallint not null default 3 check (max_devices between 1 and 5),
  devices_linked smallint not null default 0,
  expires_at timestamptz not null,
  revoked_at timestamptz null,
  revoked_by uuid null references public.staff_profiles (id),
  revoke_reason text null check (revoke_reason in ('reissued', 'teacher', 'consent_withdrawn', 'student_inactive')),
  last_used_at timestamptz null,
  created_by uuid not null references public.staff_profiles (id),
  created_at timestamptz not null default now(),
  foreign key (student_id, class_id) references public.students (id, class_id) on delete cascade,
  check (devices_linked between 0 and max_devices),
  check (expires_at > created_at),
  check ((revoked_at is null) = (revoke_reason is null))
);
comment on table public.student_login_codes is
  'Thẻ học (QR + mã dự phòng). Chỉ lưu HMAC; mỗi mã liên kết tối đa max_devices thiết bị trước khi hết hạn.';
create unique index student_login_codes_one_active on public.student_login_codes (student_id) where revoked_at is null;
create index student_login_codes_class_idx on public.student_login_codes (class_id);

create table public.student_devices (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null references auth.users (id) on delete cascade,
  student_id uuid not null,
  class_id uuid not null,
  login_code_id uuid null references public.student_login_codes (id) on delete set null,
  linked_at timestamptz not null default now(),
  last_seen_at timestamptz null,
  revoked_at timestamptz null,
  revoked_by uuid null references public.staff_profiles (id),
  revoke_reason text null check (revoke_reason in ('teacher', 'consent_withdrawn', 'student_inactive')),
  foreign key (student_id, class_id) references public.students (id, class_id) on delete cascade,
  check ((revoked_at is null) = (revoke_reason is null))
);
comment on table public.student_devices is
  'Liên kết thiết bị (người dùng ẩn danh Supabase) ↔ học sinh. Không lưu IP, user-agent hay dấu vân tay thiết bị.';
create unique index student_devices_active_link on public.student_devices (auth_user_id, student_id) where revoked_at is null;
create index student_devices_user_idx on public.student_devices (auth_user_id) where revoked_at is null;
create index student_devices_student_idx on public.student_devices (student_id);
create index student_devices_class_idx on public.student_devices (class_id);

-- -------------------------------------------------------------------------------------
-- Đồng ý hai phạm vi (PRIVACY_AND_SECURITY §4)
-- -------------------------------------------------------------------------------------

create table public.guardian_consents (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null,
  class_id uuid not null,
  scope text not null check (scope in ('learning_data', 'leaderboard_display')),
  status text not null default 'granted' check (status in ('granted', 'withdrawn')),
  notice_version text not null check (private.is_clean_text(notice_version, 1, 40)),
  method text not null check (method in ('paper_form', 'other')),
  note text null check (note is null or private.is_clean_text(note, 1, 200)),
  recorded_by uuid not null references public.staff_profiles (id),
  recorded_at timestamptz not null default now(),
  withdrawn_by uuid null references public.staff_profiles (id),
  withdrawn_at timestamptz null,
  foreign key (student_id, class_id) references public.students (id, class_id) on delete cascade,
  check ((status = 'withdrawn') = (withdrawn_at is not null)),
  check ((withdrawn_at is null) = (withdrawn_by is null)),
  check (withdrawn_at is null or withdrawn_at >= recorded_at)
);
comment on table public.guardian_consents is
  'Ghi nhận đồng ý của phụ huynh theo phạm vi (phiếu giấy do trường lưu). Không có dòng = CHƯA đồng ý. Ghi thêm, chỉ được chuyển granted → withdrawn.';
create unique index guardian_consents_one_active on public.guardian_consents (student_id, scope) where status = 'granted';
create index guardian_consents_class_idx on public.guardian_consents (class_id);

-- -------------------------------------------------------------------------------------
-- Mùa thi đua (REDESIGN_ARCHITECTURE §5.2) — R03 chỉ tạo cấu trúc + mùa đầu cùng lớp
-- -------------------------------------------------------------------------------------

create table public.seasons (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes (id) on delete cascade,
  seq_no int not null check (seq_no >= 1),
  status text not null default 'active' check (status in ('active', 'closed')),
  rules_version text not null check (rules_version ~ '^r[0-9]+$'),
  config jsonb not null default '{}' check (jsonb_typeof(config) = 'object'),
  planned_end_on date null,
  started_at timestamptz not null default now(),
  ended_at timestamptz null,
  started_by uuid null references public.staff_profiles (id),
  closed_by uuid null references public.staff_profiles (id),
  unique (class_id, seq_no),
  check ((status = 'closed') = (ended_at is not null)),
  check (ended_at is null or ended_at >= started_at)
);
comment on table public.seasons is
  'Mùa thi đua theo lớp; đúng một mùa active mỗi lớp. Chỉ thay đổi bằng hàm reset (R06); R03 tạo mùa 1 cùng lớp.';
create unique index seasons_one_active on public.seasons (class_id) where status = 'active';

-- -------------------------------------------------------------------------------------
-- Nhật ký kiểm toán và giới hạn tần suất
-- -------------------------------------------------------------------------------------

create table public.audit_logs (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  actor_id uuid null,
  actor_kind text not null check (actor_kind in ('staff', 'student_device', 'system')),
  action text not null check (action ~ '^[a-z_]+\.[a-z_]+$'),
  target_type text not null check (target_type ~ '^[a-z_]+$'),
  target_id uuid null,
  -- Không khóa ngoại: nhật ký phải còn sau khi lớp/học sinh bị xóa theo thời hạn lưu giữ.
  class_id uuid null,
  -- Chỉ UUID/mã — không biệt danh, không mã thẻ, không nội dung câu trả lời (CLAUDE.md §6.11).
  metadata jsonb not null default '{}' check (jsonb_typeof(metadata) = 'object')
);
comment on table public.audit_logs is
  'Nhật ký thao tác quản trị (chỉ ghi thêm qua hàm security definer). Không chứa dữ liệu cá nhân.';
create index audit_logs_class_idx on public.audit_logs (class_id, occurred_at desc);

create table public.rate_limit_buckets (
  key_hash text not null check (key_hash ~ '^[0-9a-f]{64}$'),
  window_start timestamptz not null,
  count int not null default 0 check (count >= 0),
  primary key (key_hash, window_start)
);
comment on table public.rate_limit_buckets is
  'Đếm số lần thử theo cửa sổ thời gian (khóa là HMAC của IP/mục đích — không lưu IP thô). Chỉ máy chủ.';

-- =====================================================================================
-- Hàm trợ giúp RLS (security definer, search_path rỗng — DATA_MODEL §8)
-- =====================================================================================

create or replace function private.is_active_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.staff_profiles s
    where s.id = (select auth.uid()) and s.is_active
  );
$$;

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.staff_profiles s
    where s.id = (select auth.uid()) and s.role = 'admin' and s.is_active
  );
$$;

create or replace function private.my_school_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select s.school_id from public.staff_profiles s where s.id = (select auth.uid()) and s.is_active;
$$;

-- Lớp mà người dùng hiện tại là giáo viên đang hoạt động.
create or replace function private.my_class_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select cs.class_id
  from public.class_staff cs
  join public.staff_profiles s on s.id = cs.staff_id
  where cs.staff_id = (select auth.uid())
    and cs.removed_at is null
    and s.is_active;
$$;

create or replace function private.my_owned_class_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select cs.class_id
  from public.class_staff cs
  join public.staff_profiles s on s.id = cs.staff_id
  where cs.staff_id = (select auth.uid())
    and cs.role = 'owner'
    and cs.removed_at is null
    and s.is_active;
$$;

-- Học sinh mà thiết bị hiện tại đã liên kết: liên kết chưa thu hồi, hồ sơ đang hoạt động, lớp chưa lưu trữ.
-- Thu hồi thiết bị / tạm ngưng học sinh có hiệu lực ngay ở truy vấn kế tiếp.
create or replace function private.my_student_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select d.student_id
  from public.student_devices d
  join public.students st on st.id = d.student_id
  join public.classes c on c.id = st.class_id
  where d.auth_user_id = (select auth.uid())
    and d.revoked_at is null
    and st.status = 'active'
    and c.status = 'active';
$$;

create or replace function private.my_student_class_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select st.class_id from public.students st where st.id in (select private.my_student_ids());
$$;

-- Đồng ý còn hiệu lực cho một phạm vi. Không có dòng = chưa đồng ý (mặc định từ chối).
create or replace function private.consent_active(p_student_id uuid, p_scope text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.guardian_consents g
    where g.student_id = p_student_id and g.scope = p_scope and g.status = 'granted'
  );
$$;

-- =====================================================================================
-- Trigger bảo vệ bất biến
-- =====================================================================================

-- Tài khoản giáo viên không bao giờ là người dùng ẩn danh.
create or replace function private.guard_staff_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from auth.users u where u.id = new.id and u.is_anonymous) then
    raise exception 'STAFF_MUST_NOT_BE_ANONYMOUS' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger staff_profiles_guard before insert or update of id on public.staff_profiles
  for each row execute function private.guard_staff_profile();

-- Cờ bảng xếp hạng/vinh danh chỉ bật được khi cờ hệ thống đã được chấp thuận (AD-52).
-- Tiến độ đã xác nhận chỉ chấp nhận bộ sách thật (textbook) đã duyệt và bài thuộc đúng bộ (AD-31).
create or replace function private.guard_class()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.leaderboard_enabled and (tg_op = 'INSERT' or not old.leaderboard_enabled)
     and not private.feature_enabled('leaderboard_feature_approved') then
    raise exception 'LEADERBOARD_NOT_APPROVED' using errcode = '23514';
  end if;
  if new.honors_enabled and (tg_op = 'INSERT' or not old.honors_enabled)
     and not private.feature_enabled('honors_feature_approved') then
    raise exception 'HONORS_NOT_APPROVED' using errcode = '23514';
  end if;
  if new.current_lesson_id is not null and not exists (
    select 1 from public.curriculum_lessons l
    where l.id = new.current_lesson_id and l.series_id = new.curriculum_series_id
  ) then
    raise exception 'LESSON_NOT_IN_SERIES' using errcode = '23514';
  end if;
  if new.curriculum_status = 'confirmed' and not exists (
    select 1 from public.curriculum_series s
    where s.id = new.curriculum_series_id and s.series_kind = 'textbook' and s.review_status = 'approved'
  ) then
    raise exception 'CURRICULUM_NOT_CONFIRMABLE' using errcode = '23514';
  end if;
  if tg_op = 'UPDATE' and new.school_id <> old.school_id then
    raise exception 'IMMUTABLE_SCHOOL' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger classes_guard before insert or update on public.classes
  for each row execute function private.guard_class();
create trigger classes_touch before update on public.classes
  for each row execute function private.touch_updated_at();

-- Mùa đầu tạo cùng lớp. 'r1' khớp SCORING_RULES_VERSION (src/features/gamification/rules.ts) —
-- kiểm thử tests/db/seasons.test.ts đối chiếu hai giá trị.
create or replace function private.create_first_season()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.seasons (class_id, seq_no, status, rules_version, started_at, started_by)
  values (new.id, 1, 'active', 'r1', now(), new.created_by);
  return new;
end;
$$;
create trigger classes_first_season after insert on public.classes
  for each row execute function private.create_first_season();

create or replace function private.guard_student()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if new.class_id <> old.class_id then
      raise exception 'IMMUTABLE_CLASS' using errcode = '23514';
    end if;
    -- Đổi tên hiển thị trên bảng → phải duyệt lại (không công khai tên chưa duyệt).
    if new.leaderboard_alias is distinct from old.leaderboard_alias then
      new.leaderboard_alias_approved_by := null;
      new.leaderboard_alias_approved_at := null;
    end if;
  end if;
  return new;
end;
$$;
create trigger students_guard before insert or update on public.students
  for each row execute function private.guard_student();
create trigger students_touch before update on public.students
  for each row execute function private.touch_updated_at();
create trigger schools_touch before update on public.schools
  for each row execute function private.touch_updated_at();
create trigger staff_profiles_touch before update on public.staff_profiles
  for each row execute function private.touch_updated_at();

-- Thiết bị học sinh luôn là người dùng ẩn danh và không phải tài khoản giáo viên.
create or replace function private.guard_student_device()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from auth.users u where u.id = new.auth_user_id and u.is_anonymous) then
    raise exception 'DEVICE_MUST_BE_ANONYMOUS' using errcode = '23514';
  end if;
  if exists (select 1 from public.staff_profiles s where s.id = new.auth_user_id) then
    raise exception 'DEVICE_MUST_NOT_BE_STAFF' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger student_devices_guard before insert or update of auth_user_id on public.student_devices
  for each row execute function private.guard_student_device();

-- Bản ghi đồng ý là chứng từ: chỉ được chuyển granted → withdrawn, không sửa nội dung, không xóa
-- (trừ khi xóa cả hồ sơ học sinh theo quy trình xóa dữ liệu — cascade).
create or replace function private.guard_consent()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status <> 'granted' or new.status <> 'withdrawn'
     or new.student_id <> old.student_id or new.class_id <> old.class_id or new.scope <> old.scope
     or new.notice_version <> old.notice_version or new.method <> old.method
     or new.note is distinct from old.note
     or new.recorded_by <> old.recorded_by or new.recorded_at <> old.recorded_at then
    raise exception 'CONSENT_RECORD_IMMUTABLE' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger guardian_consents_guard before update on public.guardian_consents
  for each row execute function private.guard_consent();

-- Nhật ký chỉ ghi thêm. (Tác vụ xóa theo thời hạn lưu giữ — R11 — sẽ thêm cơ chế riêng.)
create or replace function private.block_audit_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'AUDIT_LOG_APPEND_ONLY' using errcode = '23514';
end;
$$;
create trigger audit_logs_append_only before update or delete on public.audit_logs
  for each row execute function private.block_audit_change();

-- Ghi nhật ký. actor_kind suy ra từ phiên: giáo viên khi auth.uid() là staff; thiết bị khi truyền
-- p_device_user (chỉ các hàm của student gateway, gọi bằng service_role).
create or replace function private.write_audit(
  p_action text,
  p_target_type text,
  p_target_id uuid,
  p_class_id uuid,
  p_metadata jsonb default '{}',
  p_device_user uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.audit_logs (actor_id, actor_kind, action, target_type, target_id, class_id, metadata)
  values (
    coalesce(p_device_user, (select auth.uid())),
    case
      when p_device_user is not null then 'student_device'
      when (select auth.uid()) is not null then 'staff'
      else 'system'
    end,
    p_action, p_target_type, p_target_id, p_class_id, coalesce(p_metadata, '{}')
  );
end;
$$;

-- =====================================================================================
-- RLS — bật cho mọi bảng; chỉ policy SELECT (ma trận REDESIGN_ARCHITECTURE §8, DATA_MODEL §7)
-- =====================================================================================

alter table public.schools enable row level security;
alter table public.staff_profiles enable row level security;
alter table public.content_releases enable row level security;
alter table public.curriculum_series enable row level security;
alter table public.curriculum_lessons enable row level security;
alter table public.kb_units enable row level security;
alter table public.classes enable row level security;
alter table public.class_staff enable row level security;
alter table public.students enable row level security;
alter table public.student_band_assignments enable row level security;
alter table public.student_login_codes enable row level security;
alter table public.student_devices enable row level security;
alter table public.guardian_consents enable row level security;
alter table public.seasons enable row level security;
alter table public.audit_logs enable row level security;
alter table public.rate_limit_buckets enable row level security;

create policy schools_staff_read on public.schools for select to authenticated
  using (id = (select private.my_school_id()) or (select private.is_admin()));

create policy staff_profiles_self_read on public.staff_profiles for select to authenticated
  using (id = (select auth.uid()));
create policy staff_profiles_colleague_read on public.staff_profiles for select to authenticated
  using (
    id in (select cs.staff_id from public.class_staff cs
           where cs.removed_at is null and cs.class_id in (select private.my_class_ids()))
  );
create policy staff_profiles_admin_read on public.staff_profiles for select to authenticated
  using ((select private.is_admin()));

-- Kho tri thức: chỉ giáo viên (học sinh nhận nội dung qua gateway, chỉ bản đã duyệt — AD-04).
create policy content_releases_staff_read on public.content_releases for select to authenticated
  using ((select private.is_active_staff()));
create policy curriculum_series_staff_read on public.curriculum_series for select to authenticated
  using ((select private.is_active_staff()));
create policy curriculum_lessons_staff_read on public.curriculum_lessons for select to authenticated
  using ((select private.is_active_staff()));
create policy kb_units_staff_read on public.kb_units for select to authenticated
  using ((select private.is_active_staff()));

create policy classes_staff_read on public.classes for select to authenticated
  using (id in (select private.my_class_ids()) or (select private.is_admin()));
create policy classes_device_read on public.classes for select to authenticated
  using (id in (select private.my_student_class_ids()));

create policy class_staff_read on public.class_staff for select to authenticated
  using (class_id in (select private.my_class_ids()) or (select private.is_admin()));

create policy students_staff_read on public.students for select to authenticated
  using (class_id in (select private.my_class_ids()) or (select private.is_admin()));
create policy students_device_read on public.students for select to authenticated
  using (id in (select private.my_student_ids()));

create policy student_band_staff_read on public.student_band_assignments for select to authenticated
  using (class_id in (select private.my_class_ids()) or (select private.is_admin()));

create policy student_login_codes_staff_read on public.student_login_codes for select to authenticated
  using (class_id in (select private.my_class_ids()) or (select private.is_admin()));

create policy student_devices_staff_read on public.student_devices for select to authenticated
  using (class_id in (select private.my_class_ids()) or (select private.is_admin()));
create policy student_devices_self_read on public.student_devices for select to authenticated
  using (auth_user_id = (select auth.uid()) and revoked_at is null);

create policy guardian_consents_staff_read on public.guardian_consents for select to authenticated
  using (class_id in (select private.my_class_ids()) or (select private.is_admin()));

create policy seasons_staff_read on public.seasons for select to authenticated
  using (class_id in (select private.my_class_ids()) or (select private.is_admin()));
create policy seasons_device_read on public.seasons for select to authenticated
  using (class_id in (select private.my_student_class_ids()));

create policy audit_logs_owner_read on public.audit_logs for select to authenticated
  using (class_id in (select private.my_owned_class_ids()) or (select private.is_admin()));

-- rate_limit_buckets: không policy nào — chỉ service_role.

-- =====================================================================================
-- Quyền (GRANT tường minh)
-- =====================================================================================

revoke all on all tables in schema public from public, anon, authenticated;
revoke all on all sequences in schema public from public, anon, authenticated;

grant select on
  public.schools, public.staff_profiles, public.content_releases, public.curriculum_series,
  public.curriculum_lessons, public.kb_units, public.classes, public.class_staff, public.students,
  public.student_band_assignments, public.student_devices, public.guardian_consents, public.seasons,
  public.audit_logs
to authenticated;
-- Cột HMAC của thẻ học không bao giờ đọc được qua API người dùng (DATA_MODEL §7 ghi chú ²).
grant select (
  id, student_id, class_id, max_devices, devices_linked, expires_at, revoked_at, revoked_by,
  revoke_reason, last_used_at, created_by, created_at
) on public.student_login_codes to authenticated;

grant all on all tables in schema public to service_role;
grant usage on all sequences in schema public to service_role;

-- Hàm trợ giúp: chỉ những hàm policy cần mới được authenticated gọi (schema private không lộ qua API).
revoke all on all functions in schema private from public, anon, authenticated;
grant execute on function
  private.is_active_staff(), private.is_admin(), private.my_school_id(), private.my_class_ids(),
  private.my_owned_class_ids(), private.my_student_ids(), private.my_student_class_ids(),
  private.is_clean_text(text, int, int)
to authenticated;
grant execute on all functions in schema private to service_role;
