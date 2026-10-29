-- Kiểm thử bất biến R10.3a (pgTAP): phát bản ghi giáo viên cho học sinh — cờ mặc định TẮT, quyền hàm, khai báo hàm,
-- không mở bảng âm thanh cho học sinh. Hành vi nghiệp vụ (điều kiện đủ/thiếu, Storage) ở tests/db/student-audio-playback.test.ts.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(9);

select isnt(to_regprocedure('public.gateway_resolve_teacher_audio(uuid, uuid, text, text, text)'), null,
  'có gateway_resolve_teacher_audio');

select is((select enabled from private.feature_flags where key = 'student_teacher_audio_playback_approved'), false,
  'cờ student_teacher_audio_playback_approved mặc định tắt');

select ok(has_function_privilege('service_role', 'public.gateway_resolve_teacher_audio(uuid, uuid, text, text, text)', 'EXECUTE'),
  'service_role gọi được gateway_resolve_teacher_audio');
select ok(not has_function_privilege('authenticated', 'public.gateway_resolve_teacher_audio(uuid, uuid, text, text, text)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.gateway_resolve_teacher_audio(uuid, uuid, text, text, text)', 'EXECUTE'),
  'JWT thiết bị/GV/khách không gọi được gateway_resolve_teacher_audio');

select ok((select p.prosecdef from pg_proc p where p.oid = 'public.gateway_resolve_teacher_audio(uuid, uuid, text, text, text)'::regprocedure)
  and exists (select 1 from pg_proc p where p.oid = 'public.gateway_resolve_teacher_audio(uuid, uuid, text, text, text)'::regprocedure
              and p.proconfig @> array['search_path=""']),
  'gateway_resolve_teacher_audio: security definer + search_path rỗng');

-- Hàm chỉ ĐỌC: không ghi vào bảng nào (không tự duyệt, không đổi đồng ý).
select ok((select p.provolatile = 's' from pg_proc p where p.oid = 'public.gateway_resolve_teacher_audio(uuid, uuid, text, text, text)'::regprocedure),
  'gateway_resolve_teacher_audio là hàm STABLE (chỉ đọc)');
select is((select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname = 'gateway_resolve_teacher_audio'
             and p.prosrc ~* '(insert|update|delete)[[:space:]]+(into[[:space:]]+|from[[:space:]]+)?(public|private)\.'),
  0, 'hàm không chứa câu lệnh ghi vào bảng');

-- Không mở quyền đọc bảng âm thanh hay schema private cho học sinh.
select ok(not has_table_privilege('anon', 'public.audio_asset_versions', 'SELECT')
  and not has_table_privilege('anon', 'public.audio_assets', 'SELECT')
  and not has_table_privilege('anon', 'public.audio_voice_consents', 'SELECT')
  and not has_table_privilege('authenticated', 'public.audio_asset_versions', 'UPDATE')
  and not has_table_privilege('authenticated', 'private.feature_flags', 'SELECT'),
  'migration R10.3a không mở thêm quyền trên bảng âm thanh / cờ hệ thống');

select is((select count(*)::int from pg_policies where schemaname = 'public' and tablename like 'audio\_%' and roles::text ~ 'anon'),
  0, 'không có policy nào của anon trên bảng âm thanh');

select * from finish();
rollback;
