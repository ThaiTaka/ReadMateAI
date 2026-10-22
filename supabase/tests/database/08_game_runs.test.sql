-- Kiểm thử bất biến R07.5a (pgTAP): game_runs — RLS, quyền, ràng buộc, vị trí, bản đồ, cờ fixture, quyền hàm.
-- Hành vi nghiệp vụ (ngưỡng 50, đồng thời, reset…) ở tests/db/game-runs.test.ts.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(23);

insert into auth.users (id, email, is_anonymous) values
  ('00000000-0000-4000-8000-0000000000a1', concat('pgtap-gr', '@', 'readmate.test'), false);
insert into public.schools (id, name) values ('00000000-0000-4000-8000-0000000000a2', 'Trường pgTAP game');
insert into public.staff_profiles (id, school_id, display_name)
  values ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000a2', 'GV game');
insert into public.classes (id, school_id, name, school_year, created_by)
  values ('00000000-0000-4000-8000-0000000000a3', '00000000-0000-4000-8000-0000000000a2', 'Lớp game', '2026-2027',
          '00000000-0000-4000-8000-0000000000a1');
insert into public.students (id, class_id, display_name, avatar_key)
  values ('00000000-0000-4000-8000-0000000000a4', '00000000-0000-4000-8000-0000000000a3', 'Bé game', 'may');

select ok((select relrowsecurity from pg_class where oid = 'public.game_runs'::regclass), 'game_runs bật RLS');
select is((select count(*)::int from pg_policies where schemaname = 'public' and tablename = 'game_runs' and cmd <> 'SELECT'),
  0, 'game_runs chỉ có policy SELECT');
select ok(has_table_privilege('authenticated', 'public.game_runs', 'SELECT'), 'authenticated đọc được (qua RLS)');
select ok(not has_table_privilege('authenticated', 'public.game_runs', 'INSERT')
  and not has_table_privilege('authenticated', 'public.game_runs', 'UPDATE')
  and not has_table_privilege('authenticated', 'public.game_runs', 'DELETE'), 'authenticated không ghi trực tiếp');
select ok(not has_table_privilege('anon', 'public.game_runs', 'SELECT'), 'anon không có quyền');

select ok(has_function_privilege('service_role', 'public.gateway_start_game_run(uuid, uuid, text, text, jsonb)', 'EXECUTE')
  and has_function_privilege('service_role', 'public.gateway_save_game_position(uuid, uuid, uuid, jsonb, int)', 'EXECUTE'),
  'service_role gọi được gateway game');
select ok(not has_function_privilege('authenticated', 'public.gateway_start_game_run(uuid, uuid, text, text, jsonb)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.gateway_start_game_run(uuid, uuid, text, text, jsonb)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.gateway_save_game_position(uuid, uuid, uuid, jsonb, int)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.gateway_save_game_position(uuid, uuid, uuid, jsonb, int)', 'EXECUTE'),
  'client không gọi được gateway game');
select ok(not has_function_privilege('authenticated', 'private.game_walk(text, text, text, jsonb, jsonb)', 'EXECUTE')
  and not has_table_privilege('authenticated', 'private.game_levels', 'SELECT'), 'hàm/bảng nội bộ không cấp cho client');
select ok((select bool_and(prosecdef and proconfig @> array['search_path=""']) from pg_proc
           where oid in ('public.gateway_start_game_run(uuid, uuid, text, text, jsonb)'::regprocedure,
                         'public.gateway_save_game_position(uuid, uuid, uuid, jsonb, int)'::regprocedure,
                         'private.guard_game_run()'::regprocedure)), 'hàm game: security definer + search_path rỗng');

select is((select game_run_fixtures_allowed from private.test_environment), false, 'cờ lượt chơi fixture mặc định TẮT');
select is(private.game_run_fixtures_allowed(), false, 'game_run_fixtures_allowed() = false mặc định');
select is((select count(*)::int from private.game_levels where is_current), 3, 'có đúng 3 màn hiện hành');

select ok(exists (select 1 from pg_indexes where indexname = 'game_runs_one_in_progress' and indexdef like '%in_progress%'),
  'unique một lượt đang chơi mỗi học sinh/màn');
select ok(exists (select 1 from pg_indexes where indexname = 'game_runs_one_scored' and indexdef like '%WHERE scored%'),
  'unique một lượt tính điểm mỗi màn mỗi mùa');

create temp table lv as select level_version from private.game_levels where level_key = 'treasure-maze-01';
create temp table se as select id from public.seasons where class_id = '00000000-0000-4000-8000-0000000000a3';
grant select on lv, se to public;

select lives_ok(format($$insert into public.game_runs (class_id, student_id, season_id, game_key, level_key, level_version, position)
  values ('00000000-0000-4000-8000-0000000000a3', '00000000-0000-4000-8000-0000000000a4', %L, 'treasure_maze', 'treasure-maze-01', %L, '{"row":1,"col":1}')$$,
  (select id from se), (select level_version from lv)), 'chèn lượt chơi hợp lệ (ô xuất phát)');
select throws_ok(format($$insert into public.game_runs (class_id, student_id, season_id, game_key, level_key, level_version, position)
  values ('00000000-0000-4000-8000-0000000000a3', '00000000-0000-4000-8000-0000000000a4', %L, 'treasure_maze', 'treasure-maze-01', %L, '{"row":1,"col":2}')$$,
  (select id from se), (select level_version from lv)), '23505', null, 'không có hai lượt đang chơi cùng màn');
update public.game_runs set status = 'abandoned', ended_at = now();
select throws_ok(format($$insert into public.game_runs (class_id, student_id, season_id, game_key, level_key, level_version, position)
  values ('00000000-0000-4000-8000-0000000000a3', '00000000-0000-4000-8000-0000000000a4', %L, 'treasure_maze', 'treasure-maze-01', %L, '{"row":0,"col":0}')$$,
  (select id from se), (select level_version from lv)), '23514', 'INVALID_POSITION', 'vị trí là tường bị từ chối');
select throws_ok(format($$insert into public.game_runs (class_id, student_id, season_id, game_key, level_key, level_version, position)
  values ('00000000-0000-4000-8000-0000000000a3', '00000000-0000-4000-8000-0000000000a4', %L, 'treasure_maze', 'treasure-maze-01', %L, '{"row":99,"col":1}')$$,
  (select id from se), (select level_version from lv)), '23514', 'INVALID_POSITION', 'vị trí ngoài bản đồ bị từ chối');
select throws_ok(format($$insert into public.game_runs (class_id, student_id, season_id, game_key, level_key, level_version, position)
  values ('00000000-0000-4000-8000-0000000000a3', '00000000-0000-4000-8000-0000000000a4', %L, 'treasure_maze', 'treasure-maze-01', %L, '{"row":1.5,"col":1}')$$,
  (select id from se), (select level_version from lv)), '23514', null, 'vị trí không nguyên bị từ chối');
select throws_ok(format($$insert into public.game_runs (class_id, student_id, season_id, game_key, level_key, level_version, position)
  values ('00000000-0000-4000-8000-0000000000a3', '00000000-0000-4000-8000-0000000000a4', %L, 'treasure_maze', 'treasure-maze-01', repeat('0', 64), '{"row":1,"col":1}')$$,
  (select id from se)), '23514', 'INVALID_POSITION', 'phiên bản màn không tồn tại bị từ chối');
select throws_ok(format($$insert into public.game_runs (class_id, student_id, season_id, game_key, level_key, level_version, position, status)
  values ('00000000-0000-4000-8000-0000000000a3', '00000000-0000-4000-8000-0000000000a4', %L, 'treasure_maze', 'treasure-maze-01', %L, '{"row":1,"col":1}', 'playing')$$,
  (select id from se), (select level_version from lv)), '23514', null, 'trạng thái ngoài danh sách bị từ chối');
select throws_ok($$update public.game_runs set state_version = 5$$, '23514', 'RUN_NOT_ACTIVE', 'lượt đã kết thúc không đổi được nữa');
select throws_ok($$delete from public.game_runs$$, '23514', 'APPEND_ONLY', 'không xóa trực tiếp lượt chơi');

select * from finish();
rollback;
