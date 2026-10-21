-- Kiểm thử bất biến R06.5 (pgTAP): khóa ý định tạo ảnh chụp vinh danh + hàm gateway của học sinh.
-- Hành vi (đồng thời, hai tab, sau khoảng chống lặp, riêng tư) kiểm thử tích hợp ở tests/db/honor-dedupe.test.ts.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(14);

select ok((select relrowsecurity from pg_class where oid = 'public.honor_snapshot_requests'::regclass),
  'honor_snapshot_requests bật RLS');
select ok(not has_table_privilege('authenticated', 'public.honor_snapshot_requests', 'SELECT')
  and not has_table_privilege('anon', 'public.honor_snapshot_requests', 'SELECT'),
  'GV/khách không đọc thẳng bảng khóa ý định');
select ok(not has_table_privilege('authenticated', 'public.honor_snapshot_requests', 'INSERT')
  and not has_table_privilege('authenticated', 'public.honor_snapshot_requests', 'UPDATE')
  and not has_table_privilege('authenticated', 'public.honor_snapshot_requests', 'DELETE'),
  'GV không ghi trực tiếp vào bảng khóa ý định');
select ok(exists (select 1 from pg_trigger where tgrelid = 'public.honor_snapshot_requests'::regclass
                  and tgname = 'honor_snapshot_requests_immutable'),
  'bảng khóa ý định bất biến (trigger)');
select ok(exists (select 1 from pg_constraint
                  where conrelid = 'public.honor_snapshot_requests'::regclass and contype = 'p'),
  'request_id là khóa chính (chống trùng tại CSDL)');

-- Đường gọi cũ đã bị gỡ; đường mới có hai tham số.
select ok(not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                      where n.nspname = 'public' and p.proname = 'teacher_create_honor_snapshot' and p.pronargs = 1),
  'không còn teacher_create_honor_snapshot(uuid) (đường bỏ qua khóa ý định)');
select ok(has_function_privilege('authenticated', 'public.teacher_create_honor_snapshot(uuid, uuid)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.teacher_create_honor_snapshot(uuid, uuid)', 'EXECUTE'),
  'chỉ GV đăng nhập gọi được hàm tạo ảnh chụp (hàm tự kiểm tra quyền lớp)');

-- Hàm gateway học sinh: chỉ service_role.
select ok(has_function_privilege('service_role', 'public.gateway_latest_honors(uuid, uuid)', 'EXECUTE'),
  'service_role gọi được gateway_latest_honors');
select ok(not has_function_privilege('authenticated', 'public.gateway_latest_honors(uuid, uuid)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.gateway_latest_honors(uuid, uuid)', 'EXECUTE'),
  'JWT thiết bị/GV/khách không gọi được gateway_latest_honors');
select ok((select p.prosecdef from pg_proc p where p.oid = 'public.gateway_latest_honors(uuid, uuid)'::regprocedure)
  and (select 'search_path=""' = any (p.proconfig) from pg_proc p
       where p.oid = 'public.gateway_latest_honors(uuid, uuid)'::regprocedure),
  'gateway_latest_honors: security definer + search_path rỗng');
select ok((select 'search_path=""' = any (p.proconfig) from pg_proc p
           where p.oid = 'public.teacher_create_honor_snapshot(uuid, uuid)'::regprocedure),
  'teacher_create_honor_snapshot: search_path rỗng');

-- Cấu hình khoảng chống lặp: mặc định 15 giây, một dòng duy nhất, không ai ngoài service_role đọc.
select is((select dedupe_seconds from private.honor_settings), 15, 'khoảng chống lặp mặc định 15 giây');
select is((select count(*)::int from private.honor_settings), 1, 'private.honor_settings chỉ có một dòng');
select ok(not has_table_privilege('authenticated', 'private.honor_settings', 'SELECT')
  and not has_table_privilege('authenticated', 'private.honor_settings', 'UPDATE'),
  'GV không đọc/sửa cấu hình khoảng chống lặp');

select * from finish();
rollback;
