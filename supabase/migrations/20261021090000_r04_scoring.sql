-- =====================================================================================
-- R04 — Điểm thưởng: nội dung bài tập có phiên bản + kiểm duyệt, buổi luyện, câu phát hành
-- (question instance), lượt trả lời, điểm mùa, sổ cái điểm (chỉ ghi thêm), thẻ bản đồ, dấu mở khóa game.
--
-- Nguyên tắc (CLAUDE.md §6, §9.4, §9.6; docs/GAMIFICATION_SPEC.md; docs/REDESIGN_ARCHITECTURE.md §5, §8):
--   * RLS bật cho MỌI bảng mới; chỉ policy SELECT; ghi qua hàm gateway_* (service_role) — migration 090100.
--   * Học sinh KHÔNG đọc được nội dung bài tập (exercise_items chứa đáp án) hay câu phát hành; mọi thứ đến
--     trình duyệt qua student gateway, đáp án chỉ trả về sau khi câu đóng.
--   * Sổ cái point_events, item_attempts, map_tile_reveals, game_unlocks: CHỈ GHI THÊM (chặn UPDATE; DELETE chỉ
--     theo dây chuyền khi xóa hồ sơ học sinh/lớp theo quy trình xóa dữ liệu).
--   * season_scores là dữ liệu dẫn xuất từ sổ cái: balance = earned_total − deducted_total (ràng buộc CSDL).
--   * Mỗi nội dung câu (vân tay content_fingerprint) chỉ được phát dạng TÍNH ĐIỂM một lần mỗi mùa cho mỗi học
--     sinh (chỉ mục duy nhất từng phần) — chống làm lại lấy điểm, kể cả khi cùng nội dung có mã câu khác.
--   * Dữ liệu kiểm thử (origin/series_kind = test_fixture) chỉ ghi được khi private.test_environment cho phép —
--     cờ này mặc định TẮT và chỉ script local (`npm run db:test-fixtures`) bật trên Supabase local.
-- Không chứa dữ liệu nào ngoài một dòng hằng số điểm 'r1' (khớp src/features/gamification/rules.ts).
-- =====================================================================================

-- -------------------------------------------------------------------------------------
-- Môi trường kiểm thử (KHÔNG phải cờ tính năng): cho phép dữ liệu fixture của kiểm thử tự động
-- -------------------------------------------------------------------------------------

create table private.test_environment (
  singleton boolean primary key default true check (singleton),
  fixtures_allowed boolean not null default false,
  note text not null,
  updated_at timestamptz not null default now()
);
insert into private.test_environment (fixtures_allowed, note) values
  (false, 'Chỉ bật trên Supabase LOCAL bằng scripts/db-test-fixtures.ts. Production luôn tắt: nội dung/lớp kiểm thử bị từ chối.');
revoke all on private.test_environment from public, anon, authenticated;

create or replace function private.test_fixtures_allowed()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select t.fixtures_allowed from private.test_environment t where t.singleton), false);
$$;

-- -------------------------------------------------------------------------------------
-- Hằng số điểm theo phiên bản quy tắc (bản sao của rules.ts — kiểm thử tích hợp đối chiếu hai nơi)
-- -------------------------------------------------------------------------------------

create table private.scoring_rules (
  version text primary key check (version ~ '^r[0-9]+$'),
  points_correct int not null check (points_correct > 0),
  points_incorrect int not null check (points_incorrect < 0),
  balance_floor int not null check (balance_floor = 0),
  map_tile_step int not null check (map_tile_step > 0),
  game_min_balance jsonb not null check (jsonb_typeof(game_min_balance) = 'object'),
  created_at timestamptz not null default now()
);
comment on table private.scoring_rules is
  'Hằng số điểm theo SCORING_RULES_VERSION. Bất biến: đổi quy tắc = thêm phiên bản mới bằng migration (quyết định của người điều phối).';
insert into private.scoring_rules
  (version, points_correct, points_incorrect, balance_floor, map_tile_step, game_min_balance) values
  ('r1', 10, -5, 0, 30, '{"treasure_maze": 50, "wonder_forest": 120, "tone_island": 200, "rhyme_castle": 300}');
revoke all on private.scoring_rules from public, anon, authenticated;

create or replace function private.block_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'APPEND_ONLY' using errcode = '23514';
end;
$$;
create trigger scoring_rules_immutable before update or delete on private.scoring_rules
  for each row execute function private.block_change();

-- Bảng chỉ ghi thêm: chặn UPDATE; chặn DELETE trực tiếp. DELETE theo dây chuyền (xóa hồ sơ học sinh/lớp — quyền
-- xóa dữ liệu) chạy bên trong trigger khóa ngoại nên pg_trigger_depth() > 1 → được phép.
create or replace function private.block_direct_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' and pg_trigger_depth() > 1 then
    return old;
  end if;
  raise exception 'APPEND_ONLY' using errcode = '23514';
end;
$$;

-- -------------------------------------------------------------------------------------
-- Chuỗi bài kiểm thử: series_kind 'test_fixture' (không phải sách thật) — chỉ khi môi trường kiểm thử cho phép
-- -------------------------------------------------------------------------------------

alter table public.curriculum_series drop constraint curriculum_series_series_kind_check;
alter table public.curriculum_series add constraint curriculum_series_series_kind_check
  check (series_kind in ('textbook', 'illustrative', 'teacher_custom', 'test_fixture'));

create or replace function private.guard_curriculum_series()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.series_kind = 'test_fixture' and not private.test_fixtures_allowed() then
    raise exception 'TEST_FIXTURES_NOT_ALLOWED' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger curriculum_series_guard before insert or update of series_kind on public.curriculum_series
  for each row execute function private.guard_curriculum_series();

-- Thay guard_class của R03: tiến độ đã xác nhận chấp nhận bộ sách thật đã duyệt (như cũ) HOẶC chuỗi kiểm thử đã
-- duyệt khi môi trường kiểm thử cho phép. Chuỗi minh họa vẫn không bao giờ xác nhận được (AD-31).
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
    where s.id = new.curriculum_series_id and s.review_status = 'approved'
      and (s.series_kind = 'textbook' or (s.series_kind = 'test_fixture' and private.test_fixtures_allowed()))
  ) then
    raise exception 'CURRICULUM_NOT_CONFIRMABLE' using errcode = '23514';
  end if;
  if tg_op = 'UPDATE' and new.school_id <> old.school_id then
    raise exception 'IMMUTABLE_SCHOOL' using errcode = '23514';
  end if;
  return new;
end;
$$;

-- Khóa ngoại kép (mùa, lớp) cho dữ liệu điểm → mùa luôn thuộc đúng lớp của học sinh.
alter table public.seasons add constraint seasons_id_class_id_key unique (id, class_id);

-- =====================================================================================
-- Nội dung bài tập có phiên bản + kiểm duyệt (DATA_MODEL §4.E, §6)
-- =====================================================================================

create table public.exercises (
  id uuid primary key default gen_random_uuid(),
  -- Định danh ổn định (không đổi giữa các phiên bản).
  key text not null unique check (key ~ '^[a-z0-9][a-z0-9:._-]{2,119}$'),
  type_code text not null check (type_code in
    ('letter_sound', 'build_syllable', 'identify_unit', 'fill_blank', 'word_picture', 'sentence_reading')),
  title text not null check (private.is_clean_text(title, 1, 200)),
  target_bands text[] not null default '{}'
    check (target_bands <@ array['foundation', 'developing', 'extending']::text[]),
  origin text not null check (origin in ('library', 'teacher', 'rule_generator', 'ai', 'test_fixture')),
  owner_school_id uuid null references public.schools (id),
  created_by uuid null references public.staff_profiles (id),
  created_at timestamptz not null default now(),
  archived_at timestamptz null
);
comment on table public.exercises is
  'Bài tập (định danh logic). origin = test_fixture chỉ có trên CSDL kiểm thử local. Học sinh không đọc được.';

create table public.exercise_versions (
  id uuid primary key default gen_random_uuid(),
  exercise_id uuid not null references public.exercises (id) on delete cascade,
  version_no int not null check (version_no >= 1),
  status text not null default 'draft'
    check (status in ('draft', 'in_review', 'changes_requested', 'approved', 'rejected', 'retired')),
  schema_version int not null default 1 check (schema_version >= 1),
  -- Phạm vi "đã học": mọi đơn vị kiến thức của phiên bản đã được dạy tới bài lesson_ordinal của chuỗi series_id
  -- (bộ kiểm tra GĐ4 xác nhận lúc gửi duyệt). Phát câu chỉ khi lớp đã học tới bài này (Nhóm 3: bài trước).
  series_id uuid not null references public.curriculum_series (id),
  lesson_ordinal int not null check (lesson_ordinal >= 1),
  content_hash text null check (content_hash ~ '^[0-9a-f]{64}$'),
  validation_report jsonb not null default '{}' check (jsonb_typeof(validation_report) = 'object'),
  source jsonb not null default '{}' check (jsonb_typeof(source) = 'object'),
  created_by uuid null references public.staff_profiles (id),
  created_at timestamptz not null default now(),
  submitted_at timestamptz null,
  decided_by uuid null references public.staff_profiles (id),
  decided_at timestamptz null,
  unique (exercise_id, version_no),
  check (status = 'draft' or (content_hash is not null and submitted_at is not null)),
  check (status not in ('approved', 'rejected', 'changes_requested') or (decided_by is not null and decided_at is not null))
);
comment on table public.exercise_versions is
  'Phiên bản nội dung — bất biến sau khi gửi duyệt; chỉ approved được phát cho học sinh (trigger + hàm gateway).';
create unique index exercise_versions_one_approved on public.exercise_versions (exercise_id) where status = 'approved';
create index exercise_versions_scope_idx on public.exercise_versions (series_id, lesson_ordinal) where status = 'approved';

create table public.exercise_items (
  id uuid primary key default gen_random_uuid(),
  exercise_version_id uuid not null references public.exercise_versions (id) on delete cascade,
  position smallint not null check (position between 1 and 200),
  -- Mã câu của bộ máy GĐ4 (có thể phụ thuộc seed) — KHÔNG dùng để chống tính điểm trùng; dùng content_fingerprint.
  item_key text not null check (item_key ~ '^[a-z0-9_.:-]{1,120}$'),
  type_code text not null check (type_code in
    ('letter_sound', 'build_syllable', 'identify_unit', 'fill_blank', 'word_picture', 'sentence_reading')),
  variant text not null check (variant ~ '^[a-z_]{3,40}$'),
  -- content = phần học sinh nhìn thấy; answer = đáp án + thẻ lỗi (chỉ máy chủ đọc). content không bao giờ có khóa answer.
  content jsonb not null check (jsonb_typeof(content) = 'object' and not (content ? 'answer')),
  answer jsonb not null check (jsonb_typeof(answer) = 'object'),
  objective jsonb not null check (jsonb_typeof(objective) = 'object'),
  required_units text[] not null default '{}',
  difficulty smallint not null check (difficulty between 1 and 5),
  audio jsonb not null default '{}' check (jsonb_typeof(audio) = 'object'),
  item_schema_version smallint not null default 1 check (item_schema_version >= 1),
  -- Vân tay nội dung (src/features/exercises/fingerprint.ts): bất biến theo seed/thứ tự phương án.
  content_fingerprint text not null check (content_fingerprint ~ '^[0-9a-f]{64}$'),
  unique (exercise_version_id, position),
  unique (exercise_version_id, content_fingerprint)
);
comment on table public.exercise_items is
  'Câu trong một phiên bản (bất biến cùng phiên bản). Cột answer chứa đáp án — chỉ máy chủ và GV đọc.';
create index exercise_items_fingerprint_idx on public.exercise_items (content_fingerprint);

create table public.content_reviews (
  id uuid primary key default gen_random_uuid(),
  exercise_version_id uuid not null references public.exercise_versions (id) on delete cascade,
  action text not null check (action in ('submit', 'approve', 'request_changes', 'reject', 'retire')),
  reviewer_id uuid not null references public.staff_profiles (id),
  content_hash text not null check (content_hash ~ '^[0-9a-f]{64}$'),
  checklist jsonb not null default '{}' check (jsonb_typeof(checklist) = 'object'),
  comment text null check (comment is null or private.is_clean_text(comment, 1, 500)),
  created_at timestamptz not null default now()
);
comment on table public.content_reviews is
  'Nhật ký kiểm duyệt (chỉ ghi thêm). Mọi quyết định gắn với content_hash của phiên bản. AI không bao giờ duyệt.';
create index content_reviews_version_idx on public.content_reviews (exercise_version_id, created_at);

-- Băm nội dung phiên bản = SHA-256 của các vân tay câu theo thứ tự vị trí.
create or replace function private.exercise_version_hash(p_version_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select encode(sha256(convert_to(coalesce(string_agg(i.content_fingerprint, ',' order by i.position), ''), 'UTF8')), 'hex')
  from public.exercise_items i where i.exercise_version_id = p_version_id;
$$;

create or replace function private.guard_exercise()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.origin = 'test_fixture' and not private.test_fixtures_allowed() then
    raise exception 'TEST_FIXTURES_NOT_ALLOWED' using errcode = '23514';
  end if;
  if tg_op = 'UPDATE' and (new.type_code <> old.type_code or new.key <> old.key or new.origin <> old.origin) then
    raise exception 'EXERCISE_IMMUTABLE' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger exercises_guard before insert or update on public.exercises
  for each row execute function private.guard_exercise();

-- Vòng đời kiểm duyệt (DATA_MODEL §6): draft → in_review → approved | changes_requested | rejected; approved → retired.
-- Gửi duyệt: content_hash phải bằng băm thật của các câu. Duyệt: phải có dòng content_reviews 'approve' của một GV
-- đang hoạt động với đúng content_hash. Nội dung kiểm thử chỉ duyệt được trong môi trường kiểm thử.
create or replace function private.guard_exercise_version()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_origin text;
begin
  select e.origin into v_origin from public.exercises e where e.id = new.exercise_id;
  if v_origin = 'test_fixture' and not private.test_fixtures_allowed() then
    raise exception 'TEST_FIXTURES_NOT_ALLOWED' using errcode = '23514';
  end if;
  if tg_op = 'INSERT' then
    if new.status <> 'draft' then
      raise exception 'VERSION_MUST_START_DRAFT' using errcode = '23514';
    end if;
    return new;
  end if;
  if new.exercise_id <> old.exercise_id or new.version_no <> old.version_no then
    raise exception 'VERSION_IMMUTABLE' using errcode = '23514';
  end if;
  if old.status <> 'draft' and (
       new.series_id <> old.series_id or new.lesson_ordinal <> old.lesson_ordinal
       or new.content_hash is distinct from old.content_hash or new.schema_version <> old.schema_version
       or new.source <> old.source or new.validation_report <> old.validation_report) then
    raise exception 'VERSION_IMMUTABLE' using errcode = '23514';
  end if;
  if new.status <> old.status and not (
       (old.status = 'draft' and new.status = 'in_review')
    or (old.status = 'in_review' and new.status in ('approved', 'changes_requested', 'rejected'))
    or (old.status = 'approved' and new.status = 'retired')
  ) then
    raise exception 'INVALID_REVIEW_TRANSITION' using errcode = '23514';
  end if;
  if new.status = 'in_review' and old.status = 'draft'
     and new.content_hash is distinct from private.exercise_version_hash(new.id) then
    raise exception 'CONTENT_HASH_MISMATCH' using errcode = '23514';
  end if;
  if new.status = 'approved' and old.status <> 'approved' and not exists (
    select 1 from public.content_reviews r
    join public.staff_profiles s on s.id = r.reviewer_id
    where r.exercise_version_id = new.id and r.action = 'approve' and r.content_hash = new.content_hash
      and r.reviewer_id = new.decided_by and s.is_active
  ) then
    raise exception 'APPROVAL_REQUIRES_REVIEW' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger exercise_versions_guard before insert or update on public.exercise_versions
  for each row execute function private.guard_exercise_version();

-- Câu chỉ thêm/sửa/xóa khi phiên bản còn là bản nháp; dạng bài phải khớp bài tập.
create or replace function private.guard_exercise_item()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_version_id uuid := case when tg_op = 'DELETE' then old.exercise_version_id else new.exercise_version_id end;
  v_status text;
  v_type text;
begin
  -- Xóa theo dây chuyền (xóa cả bài tập/phiên bản) luôn được phép.
  if tg_op = 'DELETE' and pg_trigger_depth() > 1 then
    return old;
  end if;
  select v.status, e.type_code into v_status, v_type
  from public.exercise_versions v join public.exercises e on e.id = v.exercise_id
  where v.id = v_version_id;
  if v_status is distinct from 'draft' then
    raise exception 'VERSION_NOT_DRAFT' using errcode = '23514';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  if tg_op = 'UPDATE' and new.exercise_version_id <> old.exercise_version_id then
    raise exception 'VERSION_IMMUTABLE' using errcode = '23514';
  end if;
  if new.type_code <> v_type then
    raise exception 'TYPE_MISMATCH' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger exercise_items_guard before insert or update or delete on public.exercise_items
  for each row execute function private.guard_exercise_item();

create or replace function private.guard_content_review()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.staff_profiles s where s.id = new.reviewer_id and s.is_active) then
    raise exception 'REVIEWER_NOT_STAFF' using errcode = '23514';
  end if;
  if new.action = 'approve' and not exists (
    select 1 from public.exercise_versions v
    where v.id = new.exercise_version_id and v.status = 'in_review' and v.content_hash = new.content_hash
  ) then
    raise exception 'REVIEW_HASH_MISMATCH' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger content_reviews_guard before insert on public.content_reviews
  for each row execute function private.guard_content_review();
create trigger content_reviews_append_only before update or delete on public.content_reviews
  for each row execute function private.block_direct_change();

-- =====================================================================================
-- Buổi luyện, câu phát hành, lượt trả lời (REDESIGN_ARCHITECTURE §5.2, GAMIFICATION_SPEC §4–§5)
-- =====================================================================================

create table public.practice_sessions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null,
  class_id uuid not null,
  season_id uuid not null,
  device_id uuid null references public.student_devices (id) on delete set null,
  mode text not null default 'daily_practice' check (mode in ('daily_practice', 'review', 'challenge')),
  status text not null default 'in_progress' check (status in ('in_progress', 'completed', 'abandoned', 'void')),
  -- Kế hoạch cố định của buổi: [{position, questionInstanceId, scorable}] — tải lại không đổi câu.
  plan jsonb not null default '[]' check (jsonb_typeof(plan) = 'array'),
  question_count smallint not null check (question_count between 1 and 50),
  planner_version text not null check (planner_version ~ '^[a-z0-9.-]{1,40}$'),
  started_at timestamptz not null default now(),
  ended_at timestamptz null,
  foreign key (student_id, class_id) references public.students (id, class_id) on delete cascade,
  foreign key (season_id, class_id) references public.seasons (id, class_id) on delete cascade,
  check ((status = 'in_progress') = (ended_at is null))
);
comment on table public.practice_sessions is
  'Buổi luyện có điểm. Mỗi học sinh tối đa một buổi đang làm; mở lại trang nhận đúng buổi cũ.';
create unique index practice_sessions_one_open on public.practice_sessions (student_id) where status = 'in_progress';
create index practice_sessions_student_idx on public.practice_sessions (student_id, started_at desc);
create index practice_sessions_class_idx on public.practice_sessions (class_id);
create index practice_sessions_season_idx on public.practice_sessions (season_id);

create table public.question_instances (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null,
  class_id uuid not null,
  season_id uuid not null,
  -- R08 thêm 'game_encounter' (+ cột game_encounter_id).
  context_kind text not null default 'practice_session' check (context_kind in ('practice_session')),
  practice_session_id uuid null references public.practice_sessions (id) on delete cascade,
  position smallint not null check (position between 1 and 50),
  exercise_item_id uuid not null references public.exercise_items (id),
  exercise_version_id uuid not null references public.exercise_versions (id),
  content_fingerprint text not null check (content_fingerprint ~ '^[0-9a-f]{64}$'),
  -- CHỈ {type, variant, content} — không đáp án (kiểm thử chống lộ đáp án).
  view jsonb not null check (jsonb_typeof(view) = 'object' and not (view ? 'answer') and not (view ? 'reveal')),
  support_level smallint not null check (support_level between 0 and 3),
  max_attempts smallint not null check (max_attempts between 1 and 3),
  attempts_used smallint not null default 0 check (attempts_used >= 0),
  scorable boolean not null,
  not_scorable_reason text null check (not_scorable_reason in ('ALREADY_SCORED_IN_SEASON', 'PRACTICE_ONLY')),
  rewarded boolean not null default false,
  status text not null default 'open' check (status in ('open', 'correct', 'exhausted', 'void')),
  opened_at timestamptz not null default now(),
  closed_at timestamptz null,
  foreign key (student_id, class_id) references public.students (id, class_id) on delete cascade,
  foreign key (season_id, class_id) references public.seasons (id, class_id) on delete cascade,
  unique (practice_session_id, position),
  check (attempts_used <= max_attempts),
  check ((status = 'open') = (closed_at is null)),
  check (scorable = (not_scorable_reason is null)),
  check (not rewarded or (scorable and status = 'correct')),
  check (context_kind <> 'practice_session' or practice_session_id is not null)
);
comment on table public.question_instances is
  'Câu do máy chủ phát cho một học sinh trong một ngữ cảnh (lượt, trạng thái, đã nhận thưởng). Học sinh không đọc trực tiếp.';
-- Mỗi nội dung câu tính điểm MỘT lần mỗi mùa cho mỗi học sinh (AD-43; theo vân tay, không theo mã câu).
create unique index question_instances_scorable_once
  on public.question_instances (season_id, student_id, content_fingerprint) where scorable;
create index question_instances_student_idx on public.question_instances (student_id, status);
create index question_instances_class_idx on public.question_instances (class_id);
create index question_instances_season_idx on public.question_instances (season_id);
create index question_instances_item_idx on public.question_instances (exercise_item_id);
create index question_instances_version_idx on public.question_instances (exercise_version_id);

-- Câu phát hành: chỉ từ nội dung đã duyệt; vân tay/view khớp câu gốc; khi đã phát thì phần nội dung bất biến;
-- lượt chỉ tăng từng bước một; trạng thái chỉ đi open → correct | exhausted | void.
create or replace function private.guard_question_instance()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item public.exercise_items;
  v_status text;
  v_origin text;
begin
  if tg_op = 'INSERT' then
    select i.* into v_item from public.exercise_items i where i.id = new.exercise_item_id;
    select v.status, e.origin into v_status, v_origin
    from public.exercise_versions v join public.exercises e on e.id = v.exercise_id
    where v.id = v_item.exercise_version_id;
    if v_item.exercise_version_id is distinct from new.exercise_version_id or v_status is distinct from 'approved' then
      raise exception 'CONTENT_NOT_APPROVED' using errcode = '23514';
    end if;
    if v_origin = 'test_fixture' and not private.test_fixtures_allowed() then
      raise exception 'TEST_FIXTURES_NOT_ALLOWED' using errcode = '23514';
    end if;
    if new.content_fingerprint <> v_item.content_fingerprint
       or new.view <> jsonb_build_object('type', v_item.type_code, 'variant', v_item.variant, 'content', v_item.content) then
      raise exception 'VIEW_MISMATCH' using errcode = '23514';
    end if;
    if new.attempts_used <> 0 or new.status <> 'open' or new.rewarded then
      raise exception 'INVALID_INITIAL_STATE' using errcode = '23514';
    end if;
    return new;
  end if;
  if new.student_id <> old.student_id or new.class_id <> old.class_id or new.season_id <> old.season_id
     or new.context_kind <> old.context_kind or new.practice_session_id is distinct from old.practice_session_id
     or new.position <> old.position or new.exercise_item_id <> old.exercise_item_id
     or new.exercise_version_id <> old.exercise_version_id or new.content_fingerprint <> old.content_fingerprint
     or new.view <> old.view or new.support_level <> old.support_level or new.max_attempts <> old.max_attempts
     or new.scorable <> old.scorable or new.not_scorable_reason is distinct from old.not_scorable_reason
     or new.opened_at <> old.opened_at then
    raise exception 'QUESTION_IMMUTABLE' using errcode = '23514';
  end if;
  if new.attempts_used not in (old.attempts_used, old.attempts_used + 1) then
    raise exception 'INVALID_ATTEMPT_COUNT' using errcode = '23514';
  end if;
  if new.status <> old.status and not (old.status = 'open' and new.status in ('correct', 'exhausted', 'void')) then
    raise exception 'INVALID_QUESTION_TRANSITION' using errcode = '23514';
  end if;
  if old.rewarded and not new.rewarded then
    raise exception 'QUESTION_IMMUTABLE' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger question_instances_guard before insert or update on public.question_instances
  for each row execute function private.guard_question_instance();

create table public.item_attempts (
  id uuid primary key default gen_random_uuid(),
  question_instance_id uuid not null references public.question_instances (id) on delete cascade,
  student_id uuid not null,
  class_id uuid not null,
  season_id uuid not null,
  exercise_item_id uuid not null references public.exercise_items (id),
  attempt_no smallint not null check (attempt_no between 1 and 3),
  -- Khóa ý định do trình duyệt tạo (UUID) — gửi lại nhận đúng kết quả cũ, không tạo lượt/điểm mới.
  client_attempt_id uuid not null unique,
  -- SHA-256 của (câu, khóa câu trả lời): cùng clientAttemptId nhưng nội dung khác → IDEMPOTENCY_CONFLICT.
  request_hash text not null check (request_hash ~ '^[0-9a-f]{64}$'),
  response jsonb not null check (jsonb_typeof(response) = 'object'),
  response_key text not null check (char_length(response_key) between 1 and 500),
  -- Do MÁY CHỦ chấm (runtime.ts của GĐ4) — không bao giờ lấy từ trình duyệt.
  is_correct boolean not null,
  error_tags text[] not null default '{}',
  marks jsonb not null default '{}' check (jsonb_typeof(marks) = 'object'),
  support_level smallint not null check (support_level between 0 and 3),
  scorable boolean not null,
  grader_version text not null check (grader_version ~ '^[a-z0-9.-]{1,40}$'),
  received_at timestamptz not null default now(),
  foreign key (student_id, class_id) references public.students (id, class_id) on delete cascade,
  foreign key (season_id, class_id) references public.seasons (id, class_id) on delete cascade,
  unique (question_instance_id, attempt_no),
  -- Không chấm lại đúng câu trả lời cũ của cùng câu (DUPLICATE_RESPONSE).
  unique (question_instance_id, response_key)
);
comment on table public.item_attempts is
  'Lịch sử trả lời (dữ liệu học tập — không bị reset theo mùa). Chỉ ghi thêm, chỉ qua hàm gateway.';
create index item_attempts_student_idx on public.item_attempts (student_id, received_at desc);
create index item_attempts_class_idx on public.item_attempts (class_id);
create index item_attempts_season_idx on public.item_attempts (season_id);
create index item_attempts_item_idx on public.item_attempts (exercise_item_id);
create trigger item_attempts_append_only before update or delete on public.item_attempts
  for each row execute function private.block_direct_change();

-- =====================================================================================
-- Điểm mùa và sổ cái (GAMIFICATION_SPEC §2–§3)
-- =====================================================================================

create table public.season_scores (
  season_id uuid not null,
  student_id uuid not null,
  class_id uuid not null,
  balance int not null default 0 check (balance >= 0),
  earned_total int not null default 0 check (earned_total >= 0),
  deducted_total int not null default 0 check (deducted_total >= 0),
  -- Thứ tự hiển thị khi đồng hạng (R05) — thời điểm của CSDL, không của thiết bị (T-24).
  balance_updated_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (season_id, student_id),
  foreign key (student_id, class_id) references public.students (id, class_id) on delete cascade,
  foreign key (season_id, class_id) references public.seasons (id, class_id) on delete cascade,
  -- Số dư luôn bằng phần được cộng trừ phần thực sự bị trừ (sàn 0 đã nằm trong deducted_total).
  check (balance = earned_total - deducted_total)
);
comment on table public.season_scores is
  'Điểm của học sinh trong mùa — dữ liệu dẫn xuất từ point_events, chỉ cập nhật trong hàm ghi điểm.';
create index season_scores_rank_idx on public.season_scores (season_id, balance desc);
create index season_scores_student_idx on public.season_scores (student_id);
create index season_scores_class_idx on public.season_scores (class_id);

create table public.point_events (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null,
  student_id uuid not null,
  class_id uuid not null,
  question_instance_id uuid not null references public.question_instances (id) on delete cascade,
  item_attempt_id uuid not null unique references public.item_attempts (id) on delete cascade,
  attempt_no smallint not null check (attempt_no between 1 and 3),
  outcome text not null check (outcome in ('correct', 'incorrect')),
  nominal_delta smallint not null,
  applied_delta smallint not null,
  balance_before int not null check (balance_before >= 0),
  balance_after int not null check (balance_after >= 0),
  earned_total_after int not null check (earned_total_after >= 0),
  rules_version text not null references private.scoring_rules (version),
  idempotency_key text not null unique,
  created_at timestamptz not null default now(),
  foreign key (student_id, class_id) references public.students (id, class_id) on delete cascade,
  foreign key (season_id, class_id) references public.seasons (id, class_id) on delete cascade,
  check (applied_delta = balance_after - balance_before),
  check (balance_after = greatest(0, balance_before + nominal_delta)),
  check ((outcome = 'correct') = (nominal_delta > 0)),
  check (idempotency_key = question_instance_id::text || ':' || attempt_no::text)
);
comment on table public.point_events is
  'Sổ cái điểm thưởng — CHỈ GHI THÊM. Mỗi lượt hợp lệ của câu tính điểm tạo đúng một dòng.';
create index point_events_student_idx on public.point_events (season_id, student_id, created_at);
create index point_events_class_idx on public.point_events (class_id);
create index point_events_question_idx on public.point_events (question_instance_id);
create trigger point_events_append_only before update or delete on public.point_events
  for each row execute function private.block_direct_change();

-- =====================================================================================
-- Thẻ bản đồ và dấu mở khóa mini-game (GAMIFICATION_SPEC §6–§7)
-- =====================================================================================

create table public.map_tile_reveals (
  season_id uuid not null,
  student_id uuid not null,
  tile_key text not null check (tile_key ~ '^[a-z_]{3,40}$'),
  class_id uuid not null,
  map_key text not null check (map_key ~ '^[a-z0-9-]{3,40}$'),
  ordinal smallint not null check (ordinal between 1 and 64),
  earned_total_at_reveal int not null check (earned_total_at_reveal >= 0),
  revealed_at timestamptz not null default now(),
  primary key (season_id, student_id, tile_key),
  unique (season_id, student_id, ordinal),
  foreign key (student_id, class_id) references public.students (id, class_id) on delete cascade,
  foreign key (season_id, class_id) references public.seasons (id, class_id) on delete cascade
);
comment on table public.map_tile_reveals is
  'Thẻ bản đồ học sinh đã khám phá trong mùa — không bao giờ bị che lại trong mùa; mở thẻ không tiêu điểm.';
create index map_tile_reveals_class_idx on public.map_tile_reveals (class_id);
create index map_tile_reveals_student_idx on public.map_tile_reveals (student_id);
create trigger map_tile_reveals_append_only before update or delete on public.map_tile_reveals
  for each row execute function private.block_direct_change();

create table public.game_unlocks (
  season_id uuid not null,
  student_id uuid not null,
  game_key text not null check (game_key in ('treasure_maze', 'wonder_forest', 'tone_island', 'rhyme_castle')),
  class_id uuid not null,
  balance_at_unlock int not null check (balance_at_unlock >= 0),
  first_reached_at timestamptz not null default now(),
  primary key (season_id, student_id, game_key),
  foreign key (student_id, class_id) references public.students (id, class_id) on delete cascade,
  foreign key (season_id, class_id) references public.seasons (id, class_id) on delete cascade
);
comment on table public.game_unlocks is
  'Lần ĐẦU điểm hiện tại đạt ngưỡng một game trong mùa (để hiện "Đã khám phá khu vực mới!"). KHÔNG cấp quyền vào chơi — vào chơi luôn xét điểm hiện tại.';
create index game_unlocks_class_idx on public.game_unlocks (class_id);
create index game_unlocks_student_idx on public.game_unlocks (student_id);
create trigger game_unlocks_append_only before update or delete on public.game_unlocks
  for each row execute function private.block_direct_change();

-- =====================================================================================
-- RLS — chỉ policy SELECT (ma trận REDESIGN_ARCHITECTURE §8)
-- =====================================================================================

alter table public.exercises enable row level security;
alter table public.exercise_versions enable row level security;
alter table public.exercise_items enable row level security;
alter table public.content_reviews enable row level security;
alter table public.practice_sessions enable row level security;
alter table public.question_instances enable row level security;
alter table public.item_attempts enable row level security;
alter table public.season_scores enable row level security;
alter table public.point_events enable row level security;
alter table public.map_tile_reveals enable row level security;
alter table public.game_unlocks enable row level security;

-- Nội dung bài tập: chỉ giáo viên đang hoạt động (học sinh nhận câu qua gateway, không bao giờ đọc đáp án).
create policy exercises_staff_read on public.exercises for select to authenticated
  using ((select private.is_active_staff()));
create policy exercise_versions_staff_read on public.exercise_versions for select to authenticated
  using ((select private.is_active_staff()));
create policy exercise_items_staff_read on public.exercise_items for select to authenticated
  using ((select private.is_active_staff()));
create policy content_reviews_staff_read on public.content_reviews for select to authenticated
  using ((select private.is_active_staff()));

-- Câu phát hành: GV của lớp đọc; thiết bị KHÔNG có policy (chỉ nhận view qua gateway).
create policy question_instances_staff_read on public.question_instances for select to authenticated
  using (class_id in (select private.my_class_ids()) or (select private.is_admin()));

create policy practice_sessions_staff_read on public.practice_sessions for select to authenticated
  using (class_id in (select private.my_class_ids()) or (select private.is_admin()));
create policy practice_sessions_device_read on public.practice_sessions for select to authenticated
  using (student_id in (select private.my_student_ids()));

create policy item_attempts_staff_read on public.item_attempts for select to authenticated
  using (class_id in (select private.my_class_ids()) or (select private.is_admin()));
create policy item_attempts_device_read on public.item_attempts for select to authenticated
  using (student_id in (select private.my_student_ids()));

create policy season_scores_staff_read on public.season_scores for select to authenticated
  using (class_id in (select private.my_class_ids()) or (select private.is_admin()));
create policy season_scores_device_read on public.season_scores for select to authenticated
  using (student_id in (select private.my_student_ids()));

create policy point_events_staff_read on public.point_events for select to authenticated
  using (class_id in (select private.my_class_ids()) or (select private.is_admin()));
create policy point_events_device_read on public.point_events for select to authenticated
  using (student_id in (select private.my_student_ids()));

create policy map_tile_reveals_staff_read on public.map_tile_reveals for select to authenticated
  using (class_id in (select private.my_class_ids()) or (select private.is_admin()));
create policy map_tile_reveals_device_read on public.map_tile_reveals for select to authenticated
  using (student_id in (select private.my_student_ids()));

create policy game_unlocks_staff_read on public.game_unlocks for select to authenticated
  using (class_id in (select private.my_class_ids()) or (select private.is_admin()));
create policy game_unlocks_device_read on public.game_unlocks for select to authenticated
  using (student_id in (select private.my_student_ids()));

-- =====================================================================================
-- Quyền (GRANT tường minh — config.toml auto_expose_new_tables = false)
-- =====================================================================================

revoke all on public.exercises, public.exercise_versions, public.exercise_items, public.content_reviews,
  public.practice_sessions, public.question_instances, public.item_attempts, public.season_scores,
  public.point_events, public.map_tile_reveals, public.game_unlocks
from public, anon, authenticated;

grant select on public.exercises, public.exercise_versions, public.exercise_items, public.content_reviews,
  public.practice_sessions, public.question_instances, public.item_attempts, public.season_scores,
  public.point_events, public.map_tile_reveals, public.game_unlocks
to authenticated;

grant all on public.exercises, public.exercise_versions, public.exercise_items, public.content_reviews,
  public.practice_sessions, public.question_instances, public.item_attempts, public.season_scores,
  public.point_events, public.map_tile_reveals, public.game_unlocks
to service_role;

revoke all on all functions in schema private from public, anon, authenticated;
grant execute on function
  private.is_active_staff(), private.is_admin(), private.my_school_id(), private.my_class_ids(),
  private.my_owned_class_ids(), private.my_student_ids(), private.my_student_class_ids(),
  private.is_clean_text(text, int, int)
to authenticated;
grant execute on all functions in schema private to service_role;
