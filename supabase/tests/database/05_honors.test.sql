-- Kiểm thử bất biến R06.1 (pgTAP): vinh danh TOP 3 — RLS, quyền đọc/ghi, quyền thực thi, cờ mặc định, trigger bất biến.
-- Hành vi nghiệp vụ (TOP 3, đồng hạng, rút đồng ý…) được kiểm thử tích hợp ở tests/db/honors.test.ts.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(16);

select ok((select relrowsecurity from pg_class where oid = 'public.honor_snapshots'::regclass),
  'honor_snapshots bật RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.honor_snapshot_entries'::regclass),
  'honor_snapshot_entries bật RLS');

-- Chỉ có policy SELECT; bảng hàng có policy từ chối đọc trực tiếp.
select is((select count(*)::int from pg_policies
           where schemaname = 'public' and tablename in ('honor_snapshots', 'honor_snapshot_entries') and cmd <> 'SELECT'),
  0, 'không có policy ghi trên bảng vinh danh');
select is((select qual from pg_policies
           where schemaname = 'public' and tablename = 'honor_snapshot_entries' and policyname = 'honor_snapshot_entries_no_direct_read'),
  'false', 'bảng hàng vinh danh: policy đọc luôn từ chối');

-- Quyền bảng: authenticated đọc đầu ảnh chụp nhưng KHÔNG đọc thẳng bảng hàng; không ai ghi trực tiếp.
select ok(has_table_privilege('authenticated', 'public.honor_snapshots', 'SELECT'), 'GV đọc được đầu ảnh chụp (qua RLS)');
select ok(not has_table_privilege('authenticated', 'public.honor_snapshot_entries', 'SELECT'),
  'authenticated không có SELECT trên bảng hàng vinh danh (đọc qua hàm đã lọc)');
select ok(not has_table_privilege('authenticated', 'public.honor_snapshots', 'INSERT')
  and not has_table_privilege('authenticated', 'public.honor_snapshots', 'UPDATE')
  and not has_table_privilege('authenticated', 'public.honor_snapshots', 'DELETE')
  and not has_table_privilege('authenticated', 'public.honor_snapshot_entries', 'INSERT'),
  'authenticated không ghi trực tiếp bảng vinh danh');
select ok(not has_table_privilege('anon', 'public.honor_snapshots', 'SELECT')
  and not has_table_privilege('anon', 'public.honor_snapshot_entries', 'SELECT'),
  'anon không có quyền trên bảng vinh danh');

-- Hàm: GV (authenticated) gọi được bốn hàm teacher_*; anon thì không; hàm nội bộ chỉ service_role.
select ok(has_function_privilege('authenticated', 'public.teacher_create_honor_snapshot(uuid, uuid)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.teacher_get_honor_snapshot(uuid)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.teacher_list_honor_snapshots(uuid)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.teacher_set_honors_enabled(uuid, boolean)', 'EXECUTE'),
  'GV gọi được các hàm vinh danh (hàm tự kiểm tra quyền lớp)');
select ok(not has_function_privilege('anon', 'public.teacher_create_honor_snapshot(uuid, uuid)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.teacher_get_honor_snapshot(uuid)', 'EXECUTE'),
  'khách (anon) không gọi được hàm vinh danh');
select ok(not has_function_privilege('authenticated', 'private.require_honor_staff(uuid)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'private.honor_entry_visible(uuid, text)', 'EXECUTE'),
  'hàm nội bộ của vinh danh không mở cho authenticated');

-- Bất biến: trigger chặn sửa/xóa trực tiếp cả hai bảng.
select is((select count(*)::int from pg_trigger
           where tgrelid in ('public.honor_snapshots'::regclass, 'public.honor_snapshot_entries'::regclass)
             and not tgisinternal and tgfoid = 'private.block_direct_change()'::regprocedure),
  2, 'cả hai bảng vinh danh có trigger chặn sửa/xóa');

-- Ràng buộc: hạng 1–3 và điểm > 0 nằm ở CSDL.
select ok(exists (select 1 from pg_constraint
                  where conrelid = 'public.honor_snapshot_entries'::regclass and contype = 'c'
                    and pg_get_constraintdef(oid) like '%rank >= 1%rank <= 3%'),
  'hạng chỉ 1–3 (CHECK)');
select ok(exists (select 1 from pg_constraint
                  where conrelid = 'public.honor_snapshot_entries'::regclass and contype = 'c'
                    and pg_get_constraintdef(oid) like '%points > 0%'),
  'điểm vinh danh phải > 0 (CHECK)');

-- Mặc định an toàn: cờ hệ thống vinh danh tắt; cờ lớp mặc định tắt.
select is((select enabled from private.feature_flags where key = 'honors_feature_approved'), false,
  'cờ hệ thống honors_feature_approved mặc định tắt');
select is(
  (select column_default from information_schema.columns
   where table_schema = 'public' and table_name = 'classes' and column_name = 'honors_enabled'),
  'false', 'classes.honors_enabled mặc định false');

select * from finish();
rollback;
