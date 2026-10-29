-- Kiểm thử bất biến R10.5 (pgTAP): thư viện giọng máy — RLS chỉ SELECT, quyền bảng/hàm, khai báo hàm, hai cờ mặc định TẮT, ràng buộc
-- cứng của bảng. Hành vi nghiệp vụ (hai lần duyệt, bất biến, thu hồi, cô lập trường, đọc Storage) ở tests/db/tts-library.test.ts.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(24);

-- Hai cờ hệ thống mặc định TẮT.
select is((select enabled from private.feature_flags where key = 'tts_library_approved'), false, 'cờ tts_library_approved mặc định tắt');
select is((select enabled from private.feature_flags where key = 'student_tts_playback_approved'), false,
  'cờ student_tts_playback_approved mặc định tắt');

-- RLS và quyền bảng.
select ok((select relrowsecurity from pg_class where oid = 'public.tts_script_reviews'::regclass)
  and (select relrowsecurity from pg_class where oid = 'public.tts_audio_versions'::regclass), 'hai bảng TTS bật RLS');
select is((select count(*)::int from pg_policies where schemaname = 'public' and tablename in ('tts_script_reviews', 'tts_audio_versions') and cmd <> 'SELECT'),
  0, 'hai bảng TTS chỉ có policy SELECT');
select is((select count(*)::int from pg_policies where schemaname = 'public' and tablename in ('tts_script_reviews', 'tts_audio_versions') and roles::text ~ 'anon'),
  0, 'không có policy nào của anon trên bảng TTS');
select ok(has_table_privilege('authenticated', 'public.tts_audio_versions', 'SELECT')
  and has_table_privilege('authenticated', 'public.tts_script_reviews', 'SELECT'), 'authenticated đọc được (qua RLS)');
select ok(not has_table_privilege('authenticated', 'public.tts_audio_versions', 'INSERT')
  and not has_table_privilege('authenticated', 'public.tts_audio_versions', 'UPDATE')
  and not has_table_privilege('authenticated', 'public.tts_audio_versions', 'DELETE')
  and not has_table_privilege('authenticated', 'public.tts_script_reviews', 'INSERT')
  and not has_table_privilege('authenticated', 'public.tts_script_reviews', 'UPDATE')
  and not has_table_privilege('authenticated', 'public.tts_script_reviews', 'DELETE'), 'authenticated không ghi trực tiếp');
select ok(not has_table_privilege('anon', 'public.tts_audio_versions', 'SELECT')
  and not has_table_privilege('anon', 'public.tts_script_reviews', 'SELECT'), 'anon không có quyền trên bảng TTS');

-- Hàm của giáo viên: authenticated + service_role; khai báo security definer + search_path rỗng.
select ok(has_function_privilege('authenticated', 'public.teacher_review_tts_script(text, text, text, boolean, text)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.teacher_register_tts_version(uuid, text, text, text, text, text, text, text, text, text, text, text, int, int, text, boolean)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.teacher_review_tts_version(uuid, text, text, boolean, boolean)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.teacher_revoke_tts_version(uuid, text)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.teacher_tts_status()', 'EXECUTE'), 'giáo viên (JWT) gọi được các hàm teacher_*_tts');
select ok(not has_function_privilege('anon', 'public.teacher_review_tts_script(text, text, text, boolean, text)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.teacher_review_tts_version(uuid, text, text, boolean, boolean)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.teacher_revoke_tts_version(uuid, text)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.teacher_tts_status()', 'EXECUTE'), 'khách không gọi được hàm giáo viên TTS');
select ok((select bool_and(p.prosecdef and p.proconfig @> array['search_path=""']) from pg_proc p
  where p.oid in ('public.teacher_review_tts_script(text, text, text, boolean, text)'::regprocedure,
                  'public.teacher_register_tts_version(uuid, text, text, text, text, text, text, text, text, text, text, text, int, int, text, boolean)'::regprocedure,
                  'public.teacher_review_tts_version(uuid, text, text, boolean, boolean)'::regprocedure,
                  'public.teacher_revoke_tts_version(uuid, text)'::regprocedure,
                  'public.teacher_tts_status()'::regprocedure,
                  'public.gateway_resolve_tts_line(uuid, uuid, text, text, text)'::regprocedure)),
  'mọi hàm TTS: security definer + search_path rỗng');

-- Hàm gateway: chỉ service_role, chỉ đọc.
select ok(has_function_privilege('service_role', 'public.gateway_resolve_tts_line(uuid, uuid, text, text, text)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.gateway_resolve_tts_line(uuid, uuid, text, text, text)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.gateway_resolve_tts_line(uuid, uuid, text, text, text)', 'EXECUTE'),
  'gateway_resolve_tts_line chỉ service_role');
select ok((select p.provolatile = 's' from pg_proc p where p.oid = 'public.gateway_resolve_tts_line(uuid, uuid, text, text, text)'::regprocedure),
  'gateway_resolve_tts_line là hàm STABLE (chỉ đọc)');
select is((select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname = 'gateway_resolve_tts_line'
             and p.prosrc ~* '(insert|update|delete)[[:space:]]+(into[[:space:]]+|from[[:space:]]+)?(public|private)\.'),
  0, 'gateway_resolve_tts_line không chứa câu lệnh ghi');
select ok(not has_function_privilege('authenticated', 'private.require_tts_staff(boolean)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'private.lock_tts_version(uuid)', 'EXECUTE')
  and not has_function_privilege('anon', 'private.guard_tts_version()', 'EXECUTE'), 'hàm private TTS không gọi được bằng JWT');

-- Ràng buộc cứng: không nhà cung cấp mock/none, không cấu hình provisional, định dạng âm thanh hẹp, thời lượng/dung lượng giới hạn.
select ok((select pg_get_constraintdef(c.oid) from pg_constraint c where c.conrelid = 'public.tts_audio_versions'::regclass
             and pg_get_constraintdef(c.oid) ~ 'provider') ~ 'viettel' and
          (select string_agg(pg_get_constraintdef(c.oid), ' ') from pg_constraint c where c.conrelid = 'public.tts_audio_versions'::regclass) !~ 'mock|none',
  'nhà cung cấp chỉ viettel/fpt/google — không mock/none');
select ok((select string_agg(pg_get_constraintdef(c.oid), ' ') from pg_constraint c where c.conrelid = 'public.tts_audio_versions'::regclass) ~ 'provisional',
  'cấu hình giọng provisional bị chặn ở CSDL');
select ok((select string_agg(pg_get_constraintdef(c.oid), ' ') from pg_constraint c where c.conrelid = 'public.tts_audio_versions'::regclass)
            ~ 'audio/mpeg' and
          (select string_agg(pg_get_constraintdef(c.oid), ' ') from pg_constraint c where c.conrelid = 'public.tts_audio_versions'::regclass) !~ 'audio/webm|audio/mp4',
  'định dạng tệp giọng máy: chỉ mp3/wav/ogg');
select ok((select string_agg(pg_get_constraintdef(c.oid), ' ') from pg_constraint c where c.conrelid = 'public.tts_audio_versions'::regclass)
            ~ '2097152' and (select string_agg(pg_get_constraintdef(c.oid), ' ') from pg_constraint c where c.conrelid = 'public.tts_audio_versions'::regclass) ~ '10000',
  'dung lượng ≤ 2 MiB và thời lượng ≤ 10 giây');
select ok((select string_agg(pg_get_constraintdef(c.oid), ' ') from pg_constraint c where c.conrelid = 'public.tts_audio_versions'::regclass) ~ 'tts-audio',
  'bucket cố định là tts-audio (tách khỏi teacher-audio)');

-- Bảo vệ: một bản approved mỗi lời đọc và không tạo trùng khóa tệp.
select ok(exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'tts_audio_versions_one_approved'
                  and indexdef ~ 'UNIQUE' and indexdef ~ 'approved'), 'chỉ một bản approved đang dùng cho mỗi (trường, lời đọc)');
select ok(exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'tts_audio_versions_one_live_per_key'
                  and indexdef ~ 'UNIQUE'), 'không tạo trùng tệp cùng khóa khi còn bản chờ/đang dùng');
select ok(exists (select 1 from pg_trigger t where t.tgrelid = 'public.tts_audio_versions'::regclass and t.tgname = 'tts_audio_versions_guard')
          and exists (select 1 from pg_trigger t where t.tgrelid = 'public.tts_script_reviews'::regclass and t.tgname = 'tts_script_reviews_guard'),
  'trigger bất biến có trên cả hai bảng');
-- Học sinh không có đường tới thư viện giọng máy.
select ok(not has_table_privilege('anon', 'public.tts_audio_versions', 'SELECT')
  and not has_schema_privilege('anon', 'private', 'USAGE'), 'khách không đọc được bảng giọng máy hay schema private');

select * from finish();
rollback;
