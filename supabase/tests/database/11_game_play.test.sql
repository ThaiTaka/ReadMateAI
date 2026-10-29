-- Kiểm thử bất biến R08.3 (pgTAP): chữ ký/quyền của hàm kích hoạt chạm trán và mở kho báu; ghi điểm vẫn chỉ qua gateway.
-- Hành vi (vị trí đứng, thứ tự câu, điểm/HP, kết thúc chạm trán, kho báu, đồng thời, reset mùa): tests/db/game-play.test.ts.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(14);

select isnt(to_regprocedure('public.gateway_activate_encounter(uuid, uuid, uuid)'), null, 'có gateway_activate_encounter');
select isnt(to_regprocedure('public.gateway_open_treasure(uuid, uuid, uuid)'), null, 'có gateway_open_treasure');

select ok(has_function_privilege('service_role', 'public.gateway_activate_encounter(uuid, uuid, uuid)', 'EXECUTE')
  and has_function_privilege('service_role', 'public.gateway_open_treasure(uuid, uuid, uuid)', 'EXECUTE'),
  'service_role gọi được hai hàm mới');
select ok(not has_function_privilege('authenticated', 'public.gateway_activate_encounter(uuid, uuid, uuid)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.gateway_activate_encounter(uuid, uuid, uuid)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.gateway_open_treasure(uuid, uuid, uuid)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.gateway_open_treasure(uuid, uuid, uuid)', 'EXECUTE'),
  'client (authenticated/anon) không gọi được kích hoạt chạm trán và mở kho báu');
select ok((select bool_and(prosecdef and proconfig @> array['search_path=""']) from pg_proc
           where oid in ('public.gateway_activate_encounter(uuid, uuid, uuid)'::regprocedure,
                         'public.gateway_open_treasure(uuid, uuid, uuid)'::regprocedure,
                         'private.record_graded_attempt(uuid, uuid, uuid, jsonb, text, text, boolean, text[], jsonb, text)'::regprocedure,
                         'private.attempt_result(uuid, text, text[])'::regprocedure)),
  'các hàm R08.3: security definer + search_path rỗng');
select ok(not has_function_privilege('authenticated', 'private.record_graded_attempt(uuid, uuid, uuid, jsonb, text, text, boolean, text[], jsonb, text)', 'EXECUTE')
  and not has_function_privilege('anon', 'private.record_graded_attempt(uuid, uuid, uuid, jsonb, text, text, boolean, text[], jsonb, text)', 'EXECUTE'),
  'hàm ghi điểm riêng tư không gọi được từ client');

-- Học sinh không có đường ghi trực tiếp vào chạm trán, câu, điểm, lượt chơi
select ok(not has_table_privilege('authenticated', 'public.game_encounters', 'UPDATE')
  and not has_table_privilege('authenticated', 'public.game_encounters', 'INSERT')
  and not has_table_privilege('authenticated', 'public.game_encounters', 'DELETE')
  and not has_table_privilege('anon', 'public.game_encounters', 'SELECT'),
  'game_encounters: client chỉ đọc (qua RLS), không ghi, anon không đọc');
select ok(not has_table_privilege('authenticated', 'public.game_runs', 'UPDATE')
  and not has_table_privilege('authenticated', 'public.question_instances', 'UPDATE')
  and not has_table_privilege('authenticated', 'public.season_scores', 'UPDATE')
  and not has_table_privilege('authenticated', 'public.point_events', 'INSERT'),
  'client không ghi trực tiếp lượt chơi, câu, điểm mùa, sổ cái');

-- Điểm kích hoạt vẫn đúng 7 mỗi màn và không thể có chạm trán thứ tám (ràng buộc R08.1 còn nguyên)
select is((select count(*)::int from private.game_level_triggers where level_key = 'treasure-maze-01'), 7, 'màn 1 có đúng 7 điểm kích hoạt');
select ok(exists (select 1 from pg_constraint where conrelid = 'public.game_encounters'::regclass
                  and pg_get_constraintdef(oid) like '%encounter_no >= 1%encounter_no <= 7%'),
  'encounter_no bị chặn trong 1..7 (không có chạm trán thứ tám)');
select ok(exists (select 1 from pg_indexes where schemaname = 'public' and tablename = 'game_encounters'
                  and indexname = 'game_encounters_one_active'), 'mỗi lượt chỉ một chạm trán đang diễn ra');

-- Quy tắc điểm giữ nguyên (+10 / −5 / sàn 0)
select is((select points_correct from private.scoring_rules order by version desc limit 1), 10, 'đúng = +10');
select is((select points_incorrect from private.scoring_rules order by version desc limit 1), -5, 'sai = −5');
select is((select balance_floor from private.scoring_rules order by version desc limit 1), 0, 'sàn điểm = 0');

select * from finish();
rollback;
