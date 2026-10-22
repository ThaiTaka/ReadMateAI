-- Kiểm thử bất biến R08.2 (pgTAP): chữ ký/quyền của gateway_start_game_run (có kế hoạch), hình dạng kế hoạch 7 × 3.
-- Hành vi phân bổ qua gateway với JWT thật, rollback, đồng thời, reset mùa: tests/db/game-allocation.test.ts.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(26);

-- Chữ ký và quyền: bản cũ 4 tham số đã bị thay, hàm mới chỉ service_role gọi được.
select is(to_regprocedure('public.gateway_start_game_run(uuid, uuid, text, text)'), null, 'chữ ký 4 tham số đã bị thay thế');
select isnt(to_regprocedure('public.gateway_start_game_run(uuid, uuid, text, text, jsonb)'), null, 'có chữ ký 5 tham số (kế hoạch)');
select ok(has_function_privilege('service_role', 'public.gateway_start_game_run(uuid, uuid, text, text, jsonb)', 'EXECUTE'),
  'service_role gọi được gateway_start_game_run');
select ok(not has_function_privilege('authenticated', 'public.gateway_start_game_run(uuid, uuid, text, text, jsonb)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.gateway_start_game_run(uuid, uuid, text, text, jsonb)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'private.game_plan_shape_ok(jsonb)', 'EXECUTE')
  and not has_function_privilege('anon', 'private.game_plan_shape_ok(jsonb)', 'EXECUTE'),
  'client không gọi được hàm bắt đầu lượt/kiểm kế hoạch');
select ok((select bool_and(prosecdef and proconfig @> array['search_path=""']) from pg_proc
           where oid in ('public.gateway_start_game_run(uuid, uuid, text, text, jsonb)'::regprocedure)),
  'gateway_start_game_run: security definer + search_path rỗng');
select ok((select proconfig @> array['search_path=""'] from pg_proc where oid = 'private.game_plan_shape_ok(jsonb)'::regprocedure),
  'game_plan_shape_ok: search_path rỗng');

-- Cờ môi trường kiểm thử mặc định TẮT trong migration (production không phát được nội dung fixture)
select is((select column_default from information_schema.columns where table_schema = 'private'
           and table_name = 'test_environment' and column_name = 'fixtures_allowed'), 'false', 'fixtures_allowed mặc định false');
select is((select column_default from information_schema.columns where table_schema = 'private'
           and table_name = 'test_environment' and column_name = 'game_run_fixtures_allowed'), 'false',
  'game_run_fixtures_allowed mặc định false');

-- Hình dạng kế hoạch
create temp table plan_ok as
select jsonb_build_object('encounters', (
  select jsonb_agg(jsonb_build_object('monsterKey', 'mon-' || n, 'questions', (
    select jsonb_agg(jsonb_build_object('exerciseItemId', gen_random_uuid(), 'supportLevel', 2, 'maxAttempts', 3))
    from generate_series(1, 3))))
  from generate_series(1, 7) n)) as p;
grant select on plan_ok to public;

select ok(private.game_plan_shape_ok((select p from plan_ok)), 'kế hoạch 7 × 3 hợp lệ được chấp nhận');
select ok(not private.game_plan_shape_ok(null), 'null không hợp lệ');
select ok(not private.game_plan_shape_ok('[]'::jsonb) and not private.game_plan_shape_ok('"x"'::jsonb)
  and not private.game_plan_shape_ok('{}'::jsonb), 'không phải đối tượng có encounters → từ chối');
select ok(not private.game_plan_shape_ok((select p #- '{encounters,6}' from plan_ok)), 'chỉ 6 chạm trán → từ chối');
select ok(not private.game_plan_shape_ok(jsonb_set((select p from plan_ok), '{encounters,7}',
  (select p -> 'encounters' -> 0 from plan_ok))), 'chạm trán thứ tám → từ chối');
select ok(not private.game_plan_shape_ok((select p #- '{encounters,2,questions,2}' from plan_ok)), 'chạm trán chỉ có 2 câu → từ chối');
select ok(not private.game_plan_shape_ok(jsonb_set((select p from plan_ok), '{encounters,0,questions,3}',
  (select p -> 'encounters' -> 0 -> 'questions' -> 0 from plan_ok))), 'chạm trán có 4 câu → từ chối');
select ok(not private.game_plan_shape_ok(jsonb_set((select p from plan_ok), '{encounters,1,monsterKey}', '"mon-1"')),
  'hai chạm trán trùng mã quái vật → từ chối');
select ok(not private.game_plan_shape_ok(jsonb_set((select p from plan_ok), '{encounters,0,monsterKey}', '"Quái Vật!"')),
  'mã quái vật sai định dạng → từ chối');
select ok(not private.game_plan_shape_ok(jsonb_set((select p from plan_ok), '{encounters,0,monsterKey}', '5')),
  'mã quái vật không phải chuỗi → từ chối');
select ok(not private.game_plan_shape_ok(jsonb_set((select p from plan_ok), '{encounters,0,questions}', '"abc"')),
  'questions không phải mảng → từ chối (không gây lỗi)');
select ok(not private.game_plan_shape_ok(jsonb_set((select p from plan_ok), '{encounters,0}', '3')),
  'chạm trán không phải đối tượng → từ chối (không gây lỗi)');
select ok(not private.game_plan_shape_ok(jsonb_set((select p from plan_ok), '{encounters,0,questions,0,exerciseItemId}', '"khong-phai-uuid"')),
  'mã câu không phải UUID → từ chối');
select ok(not private.game_plan_shape_ok(jsonb_set((select p from plan_ok), '{encounters,0,questions,0,supportLevel}', '4')),
  'mức hỗ trợ ngoài 0..3 → từ chối');
select ok(not private.game_plan_shape_ok(jsonb_set((select p from plan_ok), '{encounters,0,questions,0,supportLevel}', '"2"')),
  'mức hỗ trợ dạng chuỗi → từ chối');
select ok(not private.game_plan_shape_ok(jsonb_set((select p from plan_ok), '{encounters,0,questions,0,maxAttempts}', '0')),
  'số lượt 0 → từ chối');
select ok(not private.game_plan_shape_ok(jsonb_set((select p from plan_ok), '{encounters,0,questions,0,maxAttempts}', '2.5')),
  'số lượt không nguyên → từ chối');
select ok(not private.game_plan_shape_ok(jsonb_set((select p from plan_ok), '{encounters,0,questions,0}', 'null')),
  'câu null → từ chối');

select * from finish();
rollback;
