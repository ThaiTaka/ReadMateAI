-- Kiểm thử bất biến R04 (pgTAP): hằng số điểm, sổ cái chỉ ghi thêm, môi trường kiểm thử, chỉ mục chống cày điểm.
-- Mọi thay đổi trong giao dịch và bị ROLLBACK cuối tệp (kể cả việc tắt cờ môi trường kiểm thử).
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(16);

-- Hằng số 'r1' khớp GAMIFICATION_SPEC §1 / rules.ts (kiểm thử tích hợp đối chiếu thêm với mã).
select results_eq(
  $$select points_correct, points_incorrect, balance_floor, map_tile_step from private.scoring_rules where version = 'r1'$$,
  $$values (10, -5, 0, 30)$$,
  'hằng số điểm r1: +10 / −5 / sàn 0 / 30 điểm một thẻ');
select is(
  (select game_min_balance from private.scoring_rules where version = 'r1'),
  '{"treasure_maze": 50, "wonder_forest": 120, "tone_island": 200, "rhyme_castle": 300}'::jsonb,
  'ngưỡng bốn mini-game');
select throws_ok($$update private.scoring_rules set points_correct = 1000 where version = 'r1'$$,
  '23514', 'APPEND_ONLY', 'hằng số điểm bất biến (đổi = phiên bản quy tắc mới)');

-- Bảng chỉ máy chủ: authenticated không đọc được cấu hình riêng tư.
select ok(not has_table_privilege('authenticated', 'private.scoring_rules', 'SELECT'), 'scoring_rules chỉ máy chủ');
select ok(not has_table_privilege('authenticated', 'private.test_environment', 'SELECT'), 'test_environment chỉ máy chủ');

-- Chỉ mục duy nhất từng phần: mỗi nội dung tính điểm một lần mỗi mùa cho mỗi học sinh.
select is(
  (select indexdef from pg_indexes where schemaname = 'public' and indexname = 'question_instances_scorable_once'),
  'CREATE UNIQUE INDEX question_instances_scorable_once ON public.question_instances USING btree (season_id, student_id, content_fingerprint) WHERE scorable',
  'unique (season_id, student_id, content_fingerprint) where scorable');
select ok(
  exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'practice_sessions_one_open'),
  'mỗi học sinh tối đa một buổi luyện đang làm');

-- Khóa ý định và chống chấm lại đúng câu trả lời cũ.
select ok(
  exists (select 1 from pg_constraint where conname = 'item_attempts_client_attempt_id_key'),
  'unique client_attempt_id');
select ok(
  exists (select 1 from pg_constraint where conname = 'item_attempts_question_instance_id_response_key_key'),
  'unique (question_instance_id, response_key)');
select ok(
  exists (select 1 from pg_constraint where conname = 'point_events_idempotency_key_key'),
  'unique idempotency_key của sổ cái');

-- Sổ cái và lịch sử trả lời có trigger chỉ ghi thêm.
select ok(
  exists (select 1 from pg_trigger where tgname = 'point_events_append_only' and not tgisinternal),
  'point_events chỉ ghi thêm');
select ok(
  exists (select 1 from pg_trigger where tgname = 'item_attempts_append_only' and not tgisinternal),
  'item_attempts chỉ ghi thêm');

-- Học sinh (authenticated) không có policy đọc câu phát hành / nội dung bài tập.
select is(
  (select count(*)::int from pg_policies
   where schemaname = 'public' and tablename in ('question_instances', 'exercise_items')
     and policyname like '%device%'),
  0, 'không có policy cho thiết bị trên question_instances và exercise_items');

-- Môi trường như production (cờ tắt): không tạo được nội dung/chuỗi bài kiểm thử.
update private.test_environment set fixtures_allowed = false where singleton;
select throws_ok(
  $$insert into public.exercises (key, type_code, title, origin) values ('fixture:pgtap', 'letter_sound', 'Thử', 'test_fixture')$$,
  '23514', 'TEST_FIXTURES_NOT_ALLOWED', 'production: từ chối bài tập kiểm thử');
select throws_ok(
  $$insert into public.curriculum_series (key, series_kind, title, review_status, release_id)
    values ('series:pgtap-fixture', 'test_fixture', 'Thử', 'draft',
            (select id from public.content_releases limit 1))$$,
  '23514', 'TEST_FIXTURES_NOT_ALLOWED', 'production: từ chối chuỗi bài kiểm thử');

-- Phiên bản mới luôn bắt đầu ở bản nháp (không có đường tắt tới approved).
insert into public.exercises (id, key, type_code, title, origin)
  values ('00000000-0000-4000-8000-00000000e401', 'pgtap:r04', 'letter_sound', 'Thử', 'library');
select throws_ok(
  $$insert into public.exercise_versions (exercise_id, version_no, status, series_id, lesson_ordinal, content_hash, submitted_at, decided_by, decided_at)
    values ('00000000-0000-4000-8000-00000000e401', 1, 'approved',
            (select id from public.curriculum_series limit 1), 1, repeat('a', 64), now(), null, now())$$,
  '23514', 'VERSION_MUST_START_DRAFT', 'phiên bản mới không thể tạo thẳng ở trạng thái approved');

select * from finish();
rollback;
