-- Kiểm thử bất biến R10.4 (pgTAP): âm thanh khi học (tên chữ cái + âm của chữ) — quyền hàm, khai báo hàm, loại tài nguyên mới,
-- cờ phát vẫn TẮT, không mở bảng âm thanh cho học sinh. Hành vi nghiệp vụ ở tests/db/student-learning-audio.test.ts.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(13);

select isnt(to_regprocedure('public.gateway_resolve_learning_audio(uuid, uuid, text, text, text, text)'), null,
  'có gateway_resolve_learning_audio');
select isnt(to_regprocedure('public.gateway_list_learning_audio(uuid, uuid, jsonb)'), null,
  'có gateway_list_learning_audio');
select isnt(to_regprocedure('private.resolve_teacher_audio_unit(uuid, text, text, text, text)'), null,
  'có private.resolve_teacher_audio_unit');

select ok(has_function_privilege('service_role', 'public.gateway_resolve_learning_audio(uuid, uuid, text, text, text, text)', 'EXECUTE')
  and has_function_privilege('service_role', 'public.gateway_list_learning_audio(uuid, uuid, jsonb)', 'EXECUTE'),
  'service_role gọi được hai hàm gateway âm thanh khi học');
select ok(not has_function_privilege('authenticated', 'public.gateway_resolve_learning_audio(uuid, uuid, text, text, text, text)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.gateway_resolve_learning_audio(uuid, uuid, text, text, text, text)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.gateway_list_learning_audio(uuid, uuid, jsonb)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.gateway_list_learning_audio(uuid, uuid, jsonb)', 'EXECUTE'),
  'JWT thiết bị/GV/khách không gọi được hai hàm gateway âm thanh khi học');
select ok(not has_function_privilege('authenticated', 'private.resolve_teacher_audio_unit(uuid, text, text, text, text)', 'EXECUTE')
  and not has_function_privilege('anon', 'private.resolve_teacher_audio_unit(uuid, text, text, text, text)', 'EXECUTE'),
  'bộ kiểm tra dùng chung không gọi được trực tiếp bằng JWT');

select ok((select bool_and(p.prosecdef and p.proconfig @> array['search_path=""'])
           from pg_proc p
           where p.oid in ('public.gateway_resolve_learning_audio(uuid, uuid, text, text, text, text)'::regprocedure,
                           'public.gateway_list_learning_audio(uuid, uuid, jsonb)'::regprocedure,
                           'private.resolve_teacher_audio_unit(uuid, text, text, text, text)'::regprocedure)),
  'cả ba hàm: security definer + search_path rỗng');

-- Chỉ ĐỌC: STABLE và không có câu lệnh ghi (không tự duyệt, không đổi đồng ý).
select ok((select bool_and(p.provolatile = 's') from pg_proc p
           where p.oid in ('public.gateway_resolve_learning_audio(uuid, uuid, text, text, text, text)'::regprocedure,
                           'public.gateway_list_learning_audio(uuid, uuid, jsonb)'::regprocedure,
                           'private.resolve_teacher_audio_unit(uuid, text, text, text, text)'::regprocedure)),
  'ba hàm là STABLE (chỉ đọc)');
select is((select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname in ('public', 'private')
             and p.proname in ('gateway_resolve_learning_audio', 'gateway_list_learning_audio', 'resolve_teacher_audio_unit')
             and p.prosrc ~* '(insert|update|delete)[[:space:]]+(into[[:space:]]+|from[[:space:]]+)?(public|private)\.'),
  0, 'ba hàm không chứa câu lệnh ghi vào bảng');

-- Loại tài nguyên mới: tên chữ cái; vẫn không cho loại lạ.
select ok((select pg_get_constraintdef(c.oid) from pg_constraint c
           where c.conrelid = 'public.audio_assets'::regclass and c.conname = 'audio_assets_unit_kind_check') ~ 'letter',
  'audio_assets nhận loại letter (tên chữ cái)');
select ok((select pg_get_constraintdef(c.oid) from pg_constraint c
           where c.conrelid = 'public.audio_assets'::regclass and c.conname = 'audio_assets_unit_kind_check') !~ 'syllable|word|sentence',
  'audio_assets vẫn không nhận tiếng/từ/câu (thuộc thư viện giọng máy)');

-- Cờ phát cho học sinh vẫn TẮT, migration không bật gì.
select is((select enabled from private.feature_flags where key = 'student_teacher_audio_playback_approved'), false,
  'cờ student_teacher_audio_playback_approved vẫn tắt');
select ok(not has_table_privilege('anon', 'public.audio_assets', 'SELECT')
  and not has_table_privilege('authenticated', 'public.audio_asset_versions', 'UPDATE')
  and not has_table_privilege('authenticated', 'private.feature_flags', 'SELECT'),
  'migration R10.4 không mở thêm quyền trên bảng âm thanh / cờ hệ thống');

select * from finish();
rollback;
