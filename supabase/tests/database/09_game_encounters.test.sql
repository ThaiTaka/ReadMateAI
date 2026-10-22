-- Kiểm thử bất biến R08.1 (pgTAP): game_level_triggers, game_encounters (RLS, quyền, ràng buộc, chuyển trạng thái, giới hạn 7),
-- cột mới của question_instances. Hành vi qua gateway/RLS với JWT thật ở tests/db/game-encounters.test.ts.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(54);

insert into auth.users (id, email, is_anonymous) values
  ('00000000-0000-4000-8000-0000000000b1', concat('pgtap-ge', '@', 'readmate.test'), false);
insert into public.schools (id, name) values ('00000000-0000-4000-8000-0000000000b2', 'Trường pgTAP chạm trán');
insert into public.staff_profiles (id, school_id, display_name)
  values ('00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-0000000000b2', 'GV chạm trán');
insert into public.classes (id, school_id, name, school_year, created_by)
  values ('00000000-0000-4000-8000-0000000000b3', '00000000-0000-4000-8000-0000000000b2', 'Lớp chạm trán', '2026-2027',
          '00000000-0000-4000-8000-0000000000b1');
insert into public.students (id, class_id, display_name, avatar_key)
  values ('00000000-0000-4000-8000-0000000000b4', '00000000-0000-4000-8000-0000000000b3', 'Bé chạm trán', 'may');

create temp table se as select id from public.seasons where class_id = '00000000-0000-4000-8000-0000000000b3';
grant select on se to public;

insert into public.game_runs (id, class_id, student_id, season_id, game_key, level_key, level_version, position)
select '00000000-0000-4000-8000-0000000000c1', '00000000-0000-4000-8000-0000000000b3', '00000000-0000-4000-8000-0000000000b4',
       (select id from se), 'treasure_maze', l.level_key, l.level_version, jsonb_build_object('row', l.start_row, 'col', l.start_col)
from private.game_levels l where l.level_key = 'treasure-maze-01';

-- Một lượt level 2 đã bỏ dở, để thử chèn chạm trán vào lượt không còn hoạt động.
insert into public.game_runs (id, class_id, student_id, season_id, game_key, level_key, level_version, position)
select '00000000-0000-4000-8000-0000000000c2', '00000000-0000-4000-8000-0000000000b3', '00000000-0000-4000-8000-0000000000b4',
       (select id from se), 'treasure_maze', l.level_key, l.level_version, jsonb_build_object('row', l.start_row, 'col', l.start_col)
from private.game_levels l where l.level_key = 'treasure-maze-02';
update public.game_runs set status = 'abandoned', ended_at = now() where id = '00000000-0000-4000-8000-0000000000c2';

-- Quyền và RLS
select ok((select relrowsecurity from pg_class where oid = 'public.game_encounters'::regclass), 'game_encounters bật RLS');
select is((select count(*)::int from pg_policies where schemaname = 'public' and tablename = 'game_encounters' and cmd <> 'SELECT'),
  0, 'game_encounters chỉ có policy SELECT');
select ok(not has_table_privilege('authenticated', 'public.game_encounters', 'INSERT')
  and not has_table_privilege('authenticated', 'public.game_encounters', 'UPDATE')
  and not has_table_privilege('authenticated', 'public.game_encounters', 'DELETE'), 'authenticated không ghi trực tiếp');
select ok(not has_table_privilege('anon', 'public.game_encounters', 'SELECT'), 'anon không có quyền');
select ok(not has_table_privilege('authenticated', 'private.game_level_triggers', 'SELECT')
  and has_table_privilege('service_role', 'private.game_level_triggers', 'SELECT'), 'bảng trigger màn không cấp cho client');
select ok((select bool_and(prosecdef and proconfig @> array['search_path=""']) from pg_proc
           where oid in ('private.guard_game_encounter()'::regprocedure, 'private.guard_game_level_trigger()'::regprocedure,
                         'private.game_check_encounter_path(public.game_runs, jsonb)'::regprocedure)),
  'hàm bảo vệ chạm trán: security definer + search_path rỗng');
select ok(not has_function_privilege('authenticated', 'private.game_check_encounter_path(public.game_runs, jsonb)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.gateway_save_game_position(uuid, uuid, uuid, jsonb, int)', 'EXECUTE'),
  'client không gọi được hàm kiểm tra đường đi/lưu vị trí');

-- Điểm kích hoạt của màn
select is((select count(*)::int from private.game_level_triggers), 21, 'có 21 điểm kích hoạt (3 màn × 7)');
select is((select count(*)::int from private.game_levels l where l.is_current and
           (select count(*) from private.game_level_triggers t where (t.game_key, t.level_key, t.level_version)
              = (l.game_key, l.level_key, l.level_version)) = 7), 3, 'mỗi màn hiện hành có đúng 7 điểm kích hoạt');
select is((select count(*)::int from private.game_level_triggers t
           where private.game_cell(t.game_key, t.level_key, t.level_version, t.row_no, t.col_no) = '.'), 21,
  'mọi điểm kích hoạt nằm trên ô đường đi');
select throws_ok($$insert into private.game_level_triggers (game_key, level_key, level_version, trigger_key, row_no, col_no)
  select game_key, level_key, level_version, 'wall-1', 0, 0 from private.game_levels where level_key = 'treasure-maze-01'$$,
  '23514', 'TRIGGER_NOT_ON_PATH', 'điểm kích hoạt trên tường bị từ chối');
select throws_ok($$update private.game_level_triggers set row_no = 1, col_no = 2 where trigger_key = 'tm01-t1'$$,
  '23514', 'APPEND_ONLY', 'điểm kích hoạt không sửa được');
select throws_ok($$delete from private.game_level_triggers where trigger_key = 'tm01-t1'$$,
  '23514', 'APPEND_ONLY', 'điểm kích hoạt không xóa được');

-- Chèn chạm trán
select lives_ok($$insert into public.game_encounters (run_id, student_id, class_id, season_id, encounter_no, trigger_key, monster_key)
  select '00000000-0000-4000-8000-0000000000c1', '00000000-0000-4000-8000-0000000000b4', '00000000-0000-4000-8000-0000000000b3',
         id, 1, 'tm01-t1', 'monster-1' from se$$, 'chèn chạm trán hợp lệ');
select throws_ok($$insert into public.game_encounters (run_id, student_id, class_id, season_id, encounter_no, trigger_key, monster_key)
  select '00000000-0000-4000-8000-0000000000c1', '00000000-0000-4000-8000-0000000000b4', '00000000-0000-4000-8000-0000000000b3',
         id, 1, 'tm01-t2', 'monster-2' from se$$, '23505', null, 'không trùng encounter_no');
select throws_ok($$insert into public.game_encounters (run_id, student_id, class_id, season_id, encounter_no, trigger_key, monster_key)
  select '00000000-0000-4000-8000-0000000000c1', '00000000-0000-4000-8000-0000000000b4', '00000000-0000-4000-8000-0000000000b3',
         id, 2, 'tm01-t1', 'monster-2' from se$$, '23505', null, 'không trùng trigger');
select throws_ok($$insert into public.game_encounters (run_id, student_id, class_id, season_id, encounter_no, trigger_key, monster_key)
  select '00000000-0000-4000-8000-0000000000c1', '00000000-0000-4000-8000-0000000000b4', '00000000-0000-4000-8000-0000000000b3',
         id, 2, 'tm01-t2', 'monster-1' from se$$, '23505', null, 'không trùng quái vật');
select throws_ok($$insert into public.game_encounters (run_id, student_id, class_id, season_id, encounter_no, trigger_key, monster_key)
  select '00000000-0000-4000-8000-0000000000c1', '00000000-0000-4000-8000-0000000000b4', '00000000-0000-4000-8000-0000000000b3',
         id, 2, 'tm02-t1', 'monster-2' from se$$, '23514', 'UNKNOWN_TRIGGER', 'trigger của màn khác bị từ chối');
select throws_ok($$insert into public.game_encounters (run_id, student_id, class_id, season_id, encounter_no, trigger_key, monster_key)
  select '00000000-0000-4000-8000-0000000000c1', '00000000-0000-4000-8000-0000000000b4', '00000000-0000-4000-8000-0000000000b3',
         id, 2, 'tm01-t99', 'monster-2' from se$$, '23514', 'UNKNOWN_TRIGGER', 'trigger không tồn tại bị từ chối');
select throws_ok($$insert into public.game_encounters (run_id, student_id, class_id, season_id, encounter_no, trigger_key, monster_key)
  select '00000000-0000-4000-8000-0000000000c1', '00000000-0000-4000-8000-0000000000b4', '00000000-0000-4000-8000-0000000000b3',
         gen_random_uuid(), 2, 'tm01-t2', 'monster-2' from se$$, '23514', 'ENCOUNTER_RUN_MISMATCH', 'sai mùa bị từ chối');
select throws_ok($$insert into public.game_encounters (run_id, student_id, class_id, season_id, encounter_no, trigger_key, monster_key)
  select '00000000-0000-4000-8000-0000000000c1', gen_random_uuid(), '00000000-0000-4000-8000-0000000000b3',
         id, 2, 'tm01-t2', 'monster-2' from se$$, '23514', 'ENCOUNTER_RUN_MISMATCH', 'sai học sinh bị từ chối');
select throws_ok($$insert into public.game_encounters (run_id, student_id, class_id, season_id, encounter_no, trigger_key, monster_key)
  select '00000000-0000-4000-8000-0000000000c1', '00000000-0000-4000-8000-0000000000b4', gen_random_uuid(),
         id, 2, 'tm01-t2', 'monster-2' from se$$, '23514', 'ENCOUNTER_RUN_MISMATCH', 'sai lớp bị từ chối');
select throws_ok($$insert into public.game_encounters (run_id, student_id, class_id, season_id, encounter_no, trigger_key, monster_key, hp_remaining)
  select '00000000-0000-4000-8000-0000000000c1', '00000000-0000-4000-8000-0000000000b4', '00000000-0000-4000-8000-0000000000b3',
         id, 2, 'tm01-t2', 'monster-2', 4 from se$$, '23514', null, 'HP > 3 bị từ chối');
select throws_ok($$insert into public.game_encounters (run_id, student_id, class_id, season_id, encounter_no, trigger_key, monster_key, hp_remaining)
  select '00000000-0000-4000-8000-0000000000c1', '00000000-0000-4000-8000-0000000000b4', '00000000-0000-4000-8000-0000000000b3',
         id, 2, 'tm01-t2', 'monster-2', -1 from se$$, '23514', null, 'HP âm bị từ chối');
select throws_ok($$insert into public.game_encounters (run_id, student_id, class_id, season_id, encounter_no, trigger_key, monster_key)
  select '00000000-0000-4000-8000-0000000000c1', '00000000-0000-4000-8000-0000000000b4', '00000000-0000-4000-8000-0000000000b3',
         id, 0, 'tm01-t2', 'monster-2' from se$$, '23514', null, 'encounter_no = 0 bị từ chối');
select throws_ok($$insert into public.game_encounters (run_id, student_id, class_id, season_id, encounter_no, trigger_key, monster_key, status)
  select '00000000-0000-4000-8000-0000000000c1', '00000000-0000-4000-8000-0000000000b4', '00000000-0000-4000-8000-0000000000b3',
         id, 2, 'tm01-t2', 'monster-2', 'defeated' from se$$, '23514', null, 'không chèn thẳng trạng thái đã kết thúc');
select throws_ok($$insert into public.game_encounters (run_id, student_id, class_id, season_id, encounter_no, trigger_key, monster_key)
  select '00000000-0000-4000-8000-0000000000c2', '00000000-0000-4000-8000-0000000000b4', '00000000-0000-4000-8000-0000000000b3',
         id, 1, 'tm02-t1', 'monster-1' from se$$, '23514', 'RUN_NOT_ACTIVE', 'lượt không còn hoạt động không nhận chạm trán');

-- Chuyển trạng thái
select throws_ok($$update public.game_encounters set status = 'defeated', hp_remaining = 0 where encounter_no = 1$$,
  '23514', null, 'pending không nhảy thẳng sang defeated');
select throws_ok($$update public.game_encounters set status = 'active' where encounter_no = 1$$,
  '23514', null, 'kích hoạt thiếu vị trí quay lại/thời điểm bị từ chối');
select lives_ok($$update public.game_encounters set status = 'active', activated_at = now(),
  return_position = '{"row":1,"col":4}' where encounter_no = 1$$, 'pending → active');
select throws_ok($$update public.game_encounters set hp_remaining = 1 where encounter_no = 1$$,
  '23514', 'INVALID_HP', 'HP không giảm hai bậc một lúc');
select throws_ok($$update public.game_encounters set return_position = '{"row":1,"col":5}' where encounter_no = 1$$,
  '23514', 'ENCOUNTER_IMMUTABLE', 'vị trí quay lại không đổi sau khi kích hoạt');
select throws_ok($$update public.game_encounters set trigger_key = 'tm01-t2' where encounter_no = 1$$,
  '23514', 'ENCOUNTER_IMMUTABLE', 'không đổi trigger sau khi phân bổ');
select throws_ok($$update public.game_encounters set monster_key = 'monster-9' where encounter_no = 1$$,
  '23514', 'ENCOUNTER_IMMUTABLE', 'không đổi quái vật sau khi phân bổ');
select lives_ok($$update public.game_encounters set hp_remaining = 2 where encounter_no = 1$$, 'HP giảm từng bước khi đang diễn ra');
select throws_ok($$update public.game_encounters set status = 'defeated', resolved_at = now() where encounter_no = 1$$,
  '23514', null, 'defeated chỉ khi HP = 0');
select lives_ok($$update public.game_encounters set hp_remaining = 1 where encounter_no = 1$$, 'HP giảm tiếp');
select lives_ok($$update public.game_encounters set hp_remaining = 0, status = 'defeated', resolved_at = now() where encounter_no = 1$$,
  'active → defeated khi HP về 0');
select throws_ok($$update public.game_encounters set status = 'active' where encounter_no = 1$$,
  '23514', 'ENCOUNTER_FINISHED', 'chạm trán đã kết thúc không mở lại');
select throws_ok($$update public.game_encounters set status = 'void', resolved_at = now() where encounter_no = 1$$,
  '23514', 'ENCOUNTER_FINISHED', 'chạm trán đã kết thúc không đổi trạng thái nữa');
select throws_ok($$delete from public.game_encounters where encounter_no = 1$$, '23514', 'APPEND_ONLY', 'không xóa trực tiếp chạm trán');

-- Đủ 7 và không có chạm trán thứ tám
select lives_ok($$insert into public.game_encounters (run_id, student_id, class_id, season_id, encounter_no, trigger_key, monster_key)
  select '00000000-0000-4000-8000-0000000000c1', '00000000-0000-4000-8000-0000000000b4', '00000000-0000-4000-8000-0000000000b3',
         se.id, n, 'tm01-t' || n, 'monster-' || n from se, generate_series(2, 7) n$$, 'tạo đủ 7 chạm trán');
select is((select count(*)::int from public.game_encounters), 7, 'đúng 7 chạm trán');
select throws_ok($$insert into public.game_encounters (run_id, student_id, class_id, season_id, encounter_no, trigger_key, monster_key)
  select '00000000-0000-4000-8000-0000000000c1', '00000000-0000-4000-8000-0000000000b4', '00000000-0000-4000-8000-0000000000b3',
         id, 8, 'tm01-t8', 'monster-8' from se$$, '23514', 'ENCOUNTER_LIMIT', 'chạm trán thứ tám bị từ chối (encounter_no 8)');
select throws_ok($$insert into public.game_encounters (run_id, student_id, class_id, season_id, encounter_no, trigger_key, monster_key)
  select '00000000-0000-4000-8000-0000000000c1', '00000000-0000-4000-8000-0000000000b4', '00000000-0000-4000-8000-0000000000b3',
         id, 3, 'tm01-t8', 'monster-8' from se$$, '23514', 'ENCOUNTER_LIMIT', 'chạm trán thứ tám bị từ chối (tái dùng số thứ tự)');
select is((select count(*)::int from public.game_encounters), 7, 'vẫn đúng 7 sau khi thử chèn thêm');

-- Chỉ một chạm trán đang diễn ra mỗi lượt
select lives_ok($$update public.game_encounters set status = 'active', activated_at = now(),
  return_position = '{"row":2,"col":7}' where encounter_no = 2$$, 'kích hoạt chạm trán thứ hai');
select throws_ok($$update public.game_encounters set status = 'active', activated_at = now(),
  return_position = '{"row":5,"col":6}' where encounter_no = 3$$, '23505', null, 'không hai chạm trán đang diễn ra cùng lúc');

-- question_instances
select has_column('public', 'question_instances', 'game_encounter_id', 'question_instances.game_encounter_id tồn tại');
select has_column('public', 'question_instances', 'run_id', 'question_instances.run_id tồn tại');
select ok(exists (select 1 from pg_indexes where indexname = 'question_instances_encounter_position'),
  'unique (chạm trán, vị trí câu)');
select ok(exists (select 1 from pg_indexes where indexname = 'question_instances_run_content'),
  'unique (lượt, vân tay nội dung): không lặp nội dung trong lượt');
select ok(exists (select 1 from pg_indexes where indexname = 'question_instances_scorable_once'),
  'chỉ mục chống tính điểm lặp của R04 còn nguyên');
select ok(exists (select 1 from pg_constraint where conname = 'question_instances_context_shape'),
  'ràng buộc hình dạng ngữ cảnh câu (luyện tập / chạm trán, vị trí 1..3)');

select * from finish();
rollback;
