-- Kiểm thử bảo mật lược đồ (pgTAP) — chạy bằng `npm run db:test` (supabase test db) trên CSDL local sạch.
-- Bảo đảm cho MỌI bảng/hàm hiện có VÀ mọi bảng/hàm thêm sau này (truy vấn catalog, không liệt kê tay).
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(12);

-- 1. RLS bật cho mọi bảng của schema public (CLAUDE.md §6.2).
select is(
  (select count(*)::int from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity),
  0, 'mọi bảng public đều bật RLS');

-- 2. Không có policy ghi (INSERT/UPDATE/DELETE/ALL) nào: mọi thao tác ghi đi qua hàm.
select is(
  (select count(*)::int from pg_policies where schemaname = 'public' and cmd <> 'SELECT'),
  0, 'không có policy ghi trực tiếp nào trên schema public');

-- 3. anon không có bất kỳ quyền nào trên bảng public.
select is(
  (select count(*)::int from information_schema.role_table_grants where grantee = 'anon' and table_schema = 'public'),
  0, 'anon không có quyền trên bảng public nào');

-- 4. authenticated chỉ có quyền SELECT (không INSERT/UPDATE/DELETE/TRUNCATE).
select is(
  (select count(*)::int from information_schema.role_table_grants
   where grantee = 'authenticated' and table_schema = 'public' and privilege_type <> 'SELECT'),
  0, 'authenticated chỉ có quyền SELECT trên bảng public');

-- 5. Cột HMAC của thẻ học không đọc được bằng vai trò người dùng.
select ok(
  not has_column_privilege('authenticated', 'public.student_login_codes', 'token_hmac', 'SELECT')
  and not has_column_privilege('authenticated', 'public.student_login_codes', 'backup_code_hmac', 'SELECT'),
  'authenticated không đọc được token_hmac/backup_code_hmac');

-- 6. Bảng chỉ máy chủ: authenticated không đọc được rate_limit_buckets.
select ok(not has_table_privilege('authenticated', 'public.rate_limit_buckets', 'SELECT'),
  'rate_limit_buckets chỉ dành cho máy chủ');

-- 7. anon không thực thi được hàm nào của public/private.
select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname in ('public', 'private') and has_function_privilege('anon', p.oid, 'EXECUTE')),
  0, 'anon không thực thi được hàm nào');

-- 8. Hàm student gateway chỉ service_role gọi được (thiết bị/GV không gọi thẳng).
select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname like 'gateway\_%' and has_function_privilege('authenticated', p.oid, 'EXECUTE')),
  0, 'authenticated không gọi được hàm gateway_*');

-- 9. Mọi hàm security definer đều cố định search_path (chống chiếm search_path).
select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname in ('public', 'private') and p.prosecdef
     and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) cfg where cfg like 'search_path=%')),
  0, 'mọi hàm security definer có search_path cố định');

-- 10. Hàm public chỉ thuộc hai nhóm có kiểm soát: teacher_* (tự kiểm tra quyền) và gateway_* (service_role).
select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname !~ '^(teacher|gateway)_'),
  0, 'không có hàm public ngoài teacher_* và gateway_*');

-- 11. Cờ hệ thống bảng xếp hạng/vinh danh mặc định TẮT.
select is(
  (select count(*)::int from private.feature_flags where enabled), 0, 'mọi cờ hệ thống mặc định tắt');

-- 12. Schema private không đọc được bởi anon.
select ok(not has_schema_privilege('anon', 'private', 'USAGE'), 'anon không có quyền trên schema private');

select * from finish();
rollback;
