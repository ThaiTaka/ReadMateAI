-- Kiểm thử bất biến R05 (pgTAP): quyền thực thi các hàm bảng xếp hạng, mặc định an toàn, không có bảng ranking độc lập.
-- Mọi thay đổi (nếu có) nằm trong giao dịch và bị ROLLBACK cuối tệp.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(10);

-- Hàm gateway của bảng xếp hạng chỉ service_role gọi được: thiết bị học sinh/GV không gọi thẳng.
select ok(not has_function_privilege('authenticated', 'public.gateway_class_leaderboard(uuid, uuid)', 'EXECUTE'),
  'authenticated không gọi được gateway_class_leaderboard');
select ok(has_function_privilege('service_role', 'public.gateway_class_leaderboard(uuid, uuid)', 'EXECUTE'),
  'service_role gọi được gateway_class_leaderboard');

-- Hàm lọc học sinh đủ điều kiện nằm ở schema private, KHÔNG tự kiểm tra người gọi nên chỉ máy chủ được gọi.
select ok(not has_function_privilege('authenticated', 'private.leaderboard_rows(uuid)', 'EXECUTE'),
  'authenticated không gọi trực tiếp private.leaderboard_rows');
select ok(not has_function_privilege('anon', 'private.leaderboard_rows(uuid)', 'EXECUTE'),
  'anon không gọi được private.leaderboard_rows');

-- Ba hàm của giáo viên: authenticated gọi được (hàm tự kiểm tra quyền lớp), anon không.
select ok(
  has_function_privilege('authenticated', 'public.teacher_set_leaderboard_settings(uuid, boolean, text)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.teacher_leaderboard_overview(uuid)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.teacher_leaderboard_display(uuid)', 'EXECUTE'),
  'GV (authenticated) gọi được ba hàm teacher_*leaderboard*');
select ok(
  not has_function_privilege('anon', 'public.teacher_set_leaderboard_settings(uuid, boolean, text)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.teacher_leaderboard_overview(uuid)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.teacher_leaderboard_display(uuid)', 'EXECUTE'),
  'khách (anon) không gọi được hàm bảng xếp hạng của GV');

-- Mặc định an toàn: lớp mới tắt bảng, kiểu hiển thị TOP 10 + con.
select is(
  (select column_default from information_schema.columns
   where table_schema = 'public' and table_name = 'classes' and column_name = 'leaderboard_enabled'),
  'false', 'classes.leaderboard_enabled mặc định false');
select is(
  (select column_default from information_schema.columns
   where table_schema = 'public' and table_name = 'classes' and column_name = 'leaderboard_student_view'),
  '''top10_and_me''::text', 'classes.leaderboard_student_view mặc định top10_and_me');

-- Không có bảng xếp hạng/điểm độc lập: bảng xếp hạng chỉ được TÍNH từ season_scores (một nguồn điểm duy nhất).
select is(
  (select count(*)::int from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind in ('r', 'p') and c.relname ~ '(leaderboard|ranking|rank)'),
  0, 'không có bảng xếp hạng lưu điểm riêng trong schema public');

-- Hàm bảng xếp hạng đều security definer với search_path cố định (kiểm tra thêm ngoài 01_schema_security).
select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname in ('public', 'private') and p.proname ~ 'leaderboard'
     and (not p.prosecdef or not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) cfg where cfg like 'search_path=%'))),
  0, 'mọi hàm leaderboard là security definer có search_path cố định');

select * from finish();
rollback;
