-- Kiểm thử bất biến R06.3 (pgTAP): reset mùa — RLS, quyền bảng/hàm, cột final_rank, trigger bất biến, ràng buộc.
-- Hành vi nghiệp vụ (quyền owner, đồng thời, rollback, hạng cuối…) ở tests/db/season-reset.test.ts.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(14);

select ok((select relrowsecurity from pg_class where oid = 'public.season_resets'::regclass), 'season_resets bật RLS');
select is((select count(*)::int from pg_policies where schemaname = 'public' and tablename = 'season_resets' and cmd <> 'SELECT'),
  0, 'season_resets chỉ có policy SELECT');
select ok(has_table_privilege('authenticated', 'public.season_resets', 'SELECT'), 'GV đọc được nhật ký reset (qua RLS)');
select ok(not has_table_privilege('authenticated', 'public.season_resets', 'INSERT')
  and not has_table_privilege('authenticated', 'public.season_resets', 'UPDATE')
  and not has_table_privilege('authenticated', 'public.season_resets', 'DELETE'),
  'authenticated không ghi trực tiếp season_resets');
select ok(not has_table_privilege('anon', 'public.season_resets', 'SELECT'), 'anon không có quyền trên season_resets');

select ok(has_function_privilege('authenticated', 'public.teacher_reset_season(uuid, uuid, uuid, text)', 'EXECUTE'),
  'GV gọi được teacher_reset_season (hàm tự kiểm tra owner bằng auth.uid())');
select ok(not has_function_privilege('anon', 'public.teacher_reset_season(uuid, uuid, uuid, text)', 'EXECUTE'),
  'anon không gọi được teacher_reset_season');
select ok(not has_function_privilege('authenticated', 'private.reset_class_season(uuid, uuid, uuid, text)', 'EXECUTE')
  and not has_function_privilege('anon', 'private.reset_class_season(uuid, uuid, uuid, text)', 'EXECUTE'),
  'hàm nội bộ reset_class_season không cấp cho client');
select ok((select prosecdef and proconfig @> array['search_path=""'] from pg_proc
           where oid = 'private.reset_class_season(uuid, uuid, uuid, text)'::regprocedure),
  'reset_class_season: security definer + search_path rỗng');

select has_column('public', 'season_scores', 'final_rank', 'season_scores.final_rank tồn tại');
select col_is_null('public', 'season_scores', 'final_rank', 'final_rank cho phép NULL (mùa đang diễn ra)');
select ok(exists (select 1 from pg_trigger where tgrelid = 'public.season_resets'::regclass and tgname = 'season_resets_immutable'),
  'season_resets bất biến (trigger)');
select ok(exists (select 1 from pg_constraint where conrelid = 'public.season_resets'::regclass and contype = 'u'
                  and pg_get_constraintdef(oid) = 'UNIQUE (old_season_id)'),
  'một mùa chỉ bị đóng bằng reset một lần (unique old_season_id)');
select ok(exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'seasons_one_active'),
  'vẫn đúng một mùa active mỗi lớp (partial unique index)');

select * from finish();
rollback;
