-- Kiểm thử bất biến (pgTAP) của CHẾ ĐỘ TRÌNH DIỄN âm thanh (docs/CONTEST_AUDIO.md): hai cờ + cổng local mặc định TẮT, RLS chỉ SELECT, KHÔNG có
-- cột duyệt nào (về cấu trúc không thể thành "giáo viên đã duyệt"), nguồn gốc cố định, hàm chỉ service_role, miền tách biệt. Hành vi nghiệp vụ
-- (cổng, thu hồi, cô lập trường, mục rủi ro, đọc Storage) ở tests/db/contest-audio.test.ts.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(22);

-- Mặc định TẮT ở mọi môi trường.
select is((select enabled from private.feature_flags where key = 'contest_audio_preview_enabled'), false, 'cờ contest_audio_preview_enabled mặc định tắt');
select is((select enabled from private.feature_flags where key = 'contest_audio_play_unverified'), false, 'cờ contest_audio_play_unverified mặc định tắt');
select is((select contest_audio_allowed from private.test_environment where singleton), false, 'cổng local contest_audio_allowed mặc định tắt');

-- RLS và quyền bảng.
select ok((select relrowsecurity from pg_class where oid = 'public.contest_audio_assets'::regclass), 'bảng contest_audio_assets bật RLS');
select is((select count(*)::int from pg_policies where schemaname = 'public' and tablename = 'contest_audio_assets' and cmd <> 'SELECT'),
  0, 'chỉ có policy SELECT');
select is((select count(*)::int from pg_policies where schemaname = 'public' and tablename = 'contest_audio_assets' and roles::text ~ 'anon'),
  0, 'không policy nào của anon');
select ok(has_table_privilege('authenticated', 'public.contest_audio_assets', 'SELECT')
  and not has_table_privilege('authenticated', 'public.contest_audio_assets', 'INSERT')
  and not has_table_privilege('authenticated', 'public.contest_audio_assets', 'UPDATE')
  and not has_table_privilege('authenticated', 'public.contest_audio_assets', 'DELETE'), 'authenticated chỉ đọc (qua RLS), không ghi trực tiếp');
select ok(not has_table_privilege('anon', 'public.contest_audio_assets', 'SELECT'), 'anon không có quyền trên bảng');

-- KHÔNG có cột duyệt/trạng thái/đã nghe: không thể biến tệp trình diễn thành "giáo viên đã duyệt".
select is((select count(*)::int from information_schema.columns
           where table_schema = 'public' and table_name = 'contest_audio_assets'
             and column_name ~* '(review|approv|listen|status|teacher|staff|consent|confirm)'),
  0, 'không có cột duyệt / trạng thái / giáo viên / đồng ý nào');

-- Nguồn gốc và cấu hình bị ràng buộc cứng.
select ok((select string_agg(pg_get_constraintdef(c.oid), ' ') from pg_constraint c where c.conrelid = 'public.contest_audio_assets'::regclass)
            ~ 'ai_generated' and
          (select string_agg(pg_get_constraintdef(c.oid), ' ') from pg_constraint c where c.conrelid = 'public.contest_audio_assets'::regclass)
            ~ 'contest_preview' and
          (select string_agg(pg_get_constraintdef(c.oid), ' ') from pg_constraint c where c.conrelid = 'public.contest_audio_assets'::regclass)
            ~ 'technical_check_passed', 'nguồn gốc cố định: ai_generated / contest_preview / technical_check_passed');
select ok((select string_agg(pg_get_constraintdef(c.oid), ' ') from pg_constraint c where c.conrelid = 'public.contest_audio_assets'::regclass) ~ '\^contest-',
  'phiên bản cấu hình phải bắt đầu bằng contest- (khác thư viện đã duyệt)');
select ok((select string_agg(pg_get_constraintdef(c.oid), ' ') from pg_constraint c where c.conrelid = 'public.contest_audio_assets'::regclass) ~ 'contest-audio',
  'bucket cố định là contest-audio (tách khỏi teacher-audio và tts-audio)');
select ok((select string_agg(pg_get_constraintdef(c.oid), ' ') from pg_constraint c where c.conrelid = 'public.contest_audio_assets'::regclass) ~ '2097152'
  and (select string_agg(pg_get_constraintdef(c.oid), ' ') from pg_constraint c where c.conrelid = 'public.contest_audio_assets'::regclass) ~ '10000',
  'dung lượng ≤ 2 MiB và thời lượng ≤ 10 giây');
select ok(exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'contest_audio_assets_one_live' and indexdef ~ 'UNIQUE'),
  'mỗi (trường, mục) có tối đa một tệp đang dùng');
select ok(exists (select 1 from pg_trigger t where t.tgrelid = 'public.contest_audio_assets'::regclass and t.tgname = 'contest_audio_assets_guard'),
  'trigger bất biến có trên bảng');

-- Hàm: chỉ service_role; security definer + search_path rỗng.
select ok(has_function_privilege('service_role', 'public.gateway_register_contest_audio(uuid, uuid, text, text, text, text, text, text, text, text, text, int, int, text, int, int)', 'EXECUTE')
  and has_function_privilege('service_role', 'public.gateway_revoke_contest_audio(uuid, text)', 'EXECUTE')
  and has_function_privilege('service_role', 'public.gateway_resolve_contest_audio(uuid, uuid, text, text, text)', 'EXECUTE')
  and has_function_privilege('service_role', 'public.gateway_list_contest_audio(uuid, uuid, jsonb)', 'EXECUTE'),
  'service_role gọi được bốn hàm gateway_*contest_audio');
select ok(not has_function_privilege('authenticated', 'public.gateway_register_contest_audio(uuid, uuid, text, text, text, text, text, text, text, text, text, int, int, text, int, int)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.gateway_revoke_contest_audio(uuid, text)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.gateway_resolve_contest_audio(uuid, uuid, text, text, text)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.gateway_list_contest_audio(uuid, uuid, jsonb)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.gateway_resolve_contest_audio(uuid, uuid, text, text, text)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.gateway_register_contest_audio(uuid, uuid, text, text, text, text, text, text, text, text, text, int, int, text, int, int)', 'EXECUTE'),
  'giáo viên (JWT), thiết bị và khách không gọi được hàm trình diễn');
select ok((select bool_and(p.prosecdef and p.proconfig @> array['search_path=""']) from pg_proc p
  where p.oid in ('public.gateway_register_contest_audio(uuid, uuid, text, text, text, text, text, text, text, text, text, int, int, text, int, int)'::regprocedure,
                  'public.gateway_revoke_contest_audio(uuid, text)'::regprocedure,
                  'public.gateway_resolve_contest_audio(uuid, uuid, text, text, text)'::regprocedure,
                  'public.gateway_list_contest_audio(uuid, uuid, jsonb)'::regprocedure,
                  'private.resolve_contest_audio(uuid, text, text, text, boolean)'::regprocedure,
                  'private.contest_audio_active()'::regprocedure)),
  'mọi hàm trình diễn: security definer + search_path rỗng');
select ok((select bool_and(p.provolatile = 's') from pg_proc p
  where p.oid in ('public.gateway_resolve_contest_audio(uuid, uuid, text, text, text)'::regprocedure,
                  'public.gateway_list_contest_audio(uuid, uuid, jsonb)'::regprocedure)),
  'hàm phát / liệt kê là STABLE (chỉ đọc)');
select is((select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname in ('gateway_resolve_contest_audio', 'gateway_list_contest_audio')
             and p.prosrc ~* '(insert|update|delete)[[:space:]]+(into[[:space:]]+|from[[:space:]]+)?(public|private)\.'),
  0, 'hàm phát / liệt kê không chứa câu lệnh ghi');

-- Miền tách biệt: hàm trình diễn không đụng bảng bản ghi giáo viên hay giọng máy đã duyệt.
select is((select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname in ('public', 'private') and p.proname ~ 'contest_audio'
             and p.prosrc ~* '\m(audio_asset_versions|audio_assets|tts_audio_versions|tts_script_reviews|teacher-audio|tts-audio)'),
  0, 'hàm trình diễn không tham chiếu bảng/bucket của bản ghi giáo viên hay giọng máy đã duyệt');

-- Khóa đối tượng Storage phải nằm trong thư mục của chính trường (migration 20261104090100).
select ok(exists (select 1 from pg_constraint c where c.conrelid = 'public.contest_audio_assets'::regclass
                  and c.conname = 'contest_audio_assets_key_in_school_folder' and pg_get_constraintdef(c.oid) ~ 'split_part'),
  'storage_key phải nằm trong thư mục của chính trường');

select * from finish();
rollback;
