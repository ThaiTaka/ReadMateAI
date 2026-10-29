-- Kiểm thử bất biến R08.6 (pgTAP): chữ ký/quyền, cột phân biệt loại lượt, ràng buộc chơi lại, lý do GAME_REPLAY.
-- Hành vi (điều kiện mở, 7 × 21 câu, điểm không đổi, HP, kho báu, đồng thời, reset mùa): tests/db/game-replay.test.ts.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(13);

select is(to_regprocedure('public.gateway_start_game_run(uuid, uuid, text, text, jsonb)'), null,
  'chữ ký 5 tham số đã bị thay thế bởi bản có ý định chơi lại');
select isnt(to_regprocedure('public.gateway_start_game_run(uuid, uuid, text, text, jsonb, boolean)'), null,
  'có gateway_start_game_run với p_replay');
select ok(has_function_privilege('service_role', 'public.gateway_start_game_run(uuid, uuid, text, text, jsonb, boolean)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.gateway_start_game_run(uuid, uuid, text, text, jsonb, boolean)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.gateway_start_game_run(uuid, uuid, text, text, jsonb, boolean)', 'EXECUTE'),
  'chỉ service_role bắt đầu được lượt (kể cả chơi lại)');
select ok((select bool_and(prosecdef and proconfig @> array['search_path=""']) from pg_proc
           where oid in ('public.gateway_start_game_run(uuid, uuid, text, text, jsonb, boolean)'::regprocedure,
                         'public.gateway_activate_encounter(uuid, uuid, uuid)'::regprocedure,
                         'public.gateway_open_treasure(uuid, uuid, uuid)'::regprocedure,
                         'private.game_check_encounter_path(public.game_runs, jsonb)'::regprocedure)),
  'các hàm R08.6: security definer + search_path rỗng');

select ok(exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'game_runs'
                  and column_name = 'is_replay' and is_nullable = 'NO' and column_default = 'false'),
  'game_runs.is_replay: not null, mặc định false (lượt cũ không thành lượt chơi lại)');
select ok(exists (select 1 from pg_constraint where conrelid = 'public.game_runs'::regclass and conname = 'game_runs_replay_not_scored'),
  'lượt chơi lại không bao giờ là lượt tính điểm (ràng buộc CSDL)');
select ok(pg_get_constraintdef((select oid from pg_constraint where conrelid = 'public.question_instances'::regclass
                                  and conname = 'question_instances_not_scorable_reason_check')) like '%GAME_REPLAY%',
  'not_scorable_reason có GAME_REPLAY');
select ok(exists (select 1 from pg_constraint where conrelid = 'public.question_instances'::regclass
                  and conname = 'question_instances_game_replay_reason'),
  'GAME_REPLAY chỉ cho câu trong ngữ cảnh chạm trán');
select ok(pg_get_functiondef('private.guard_game_run()'::regprocedure) like '%is_replay%',
  'is_replay bất biến sau khi tạo lượt (guard_game_run)');
select ok(pg_get_functiondef('private.game_run_dto(public.game_runs)'::regprocedure) like '%''replay''%',
  'DTO lượt chơi có trường replay');

-- Vẫn đúng một lượt tính điểm mỗi mùa và một lượt đang hoạt động mỗi học sinh/màn: chơi lại không nới hai ràng buộc này
select ok(exists (select 1 from pg_indexes where schemaname = 'public' and tablename = 'game_runs'
                  and indexname = 'game_runs_one_scored' and indexdef like '%WHERE scored%'),
  'vẫn một lượt TÍNH ĐIỂM mỗi màn mỗi mùa');
select ok(exists (select 1 from pg_indexes where schemaname = 'public' and tablename = 'game_runs'
                  and indexname = 'game_runs_one_in_progress'),
  'vẫn một lượt đang hoạt động mỗi học sinh/màn (hai tab chỉ tạo một lượt chơi lại)');

-- Câu chơi lại vẫn nằm dưới các ràng buộc trùng nội dung trong lượt
select ok(exists (select 1 from pg_indexes where schemaname = 'public' and tablename = 'question_instances'
                  and indexname = 'question_instances_run_content'),
  'không trùng vân tay nội dung trong cùng một lượt (kể cả lượt chơi lại)');

select * from finish();
rollback;
