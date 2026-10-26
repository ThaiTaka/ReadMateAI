-- Kiểm thử bất biến R10.2 (pgTAP): thư viện bản ghi giáo viên — RLS, quyền, cờ mặc định, trigger bất biến, máy trạng thái.
-- Hành vi nghiệp vụ qua JWT thật (phạm vi trường, bản nháp riêng, duyệt…) nằm ở tests/db/audio-library.test.ts.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(22);

-- Dữ liệu giả
insert into auth.users (id, email, is_anonymous) values
  ('00000000-0000-4000-8000-0000000a0001', concat('pgtap-audio', '@', 'readmate.test'), false);
insert into public.schools (id, name) values ('00000000-0000-4000-8000-0000000a00e1', 'Trường pgTAP audio');
insert into public.staff_profiles (id, school_id, display_name)
  values ('00000000-0000-4000-8000-0000000a0001', '00000000-0000-4000-8000-0000000a00e1', 'GV audio');
insert into public.audio_assets (id, school_id, unit_kind, unit_text, proposed_label, created_by)
  values ('00000000-0000-4000-8000-0000000a00a1', '00000000-0000-4000-8000-0000000a00e1', 'phoneme', 'b', 'bờ',
          '00000000-0000-4000-8000-0000000a0001');
insert into public.audio_voice_consents (id, school_id, staff_id, notice_version)
  values ('00000000-0000-4000-8000-0000000a00c1', '00000000-0000-4000-8000-0000000a00e1',
          '00000000-0000-4000-8000-0000000a0001', 'v1');

-- 1–3. RLS bật, chỉ policy SELECT.
select ok((select bool_and(relrowsecurity) from pg_class
           where oid in ('public.audio_voice_consents'::regclass, 'public.audio_assets'::regclass,
                         'public.audio_asset_versions'::regclass)),
  'ba bảng âm thanh bật RLS');
select is((select count(*)::int from pg_policies
           where schemaname = 'public' and tablename like 'audio\_%' and cmd <> 'SELECT'),
  0, 'không có policy ghi trên bảng âm thanh');
select ok(not has_table_privilege('authenticated', 'public.audio_asset_versions', 'INSERT')
  and not has_table_privilege('authenticated', 'public.audio_asset_versions', 'UPDATE')
  and not has_table_privilege('authenticated', 'public.audio_asset_versions', 'DELETE')
  and not has_table_privilege('authenticated', 'public.audio_assets', 'UPDATE')
  and not has_table_privilege('authenticated', 'public.audio_voice_consents', 'UPDATE')
  and not has_table_privilege('anon', 'public.audio_assets', 'SELECT')
  and not has_table_privilege('anon', 'public.audio_asset_versions', 'SELECT'),
  'authenticated chỉ đọc, anon không có quyền trên bảng âm thanh');

-- 4–5. Quyền hàm.
select ok(has_function_privilege('authenticated', 'public.teacher_review_audio_version(uuid, text, text, boolean)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.teacher_create_audio_version(uuid, uuid, text, text, text, integer, integer)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.teacher_review_audio_version(uuid, text, text, boolean)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.teacher_audio_status()', 'EXECUTE'),
  'GV gọi được hàm âm thanh, anon thì không');
select ok(not has_function_privilege('authenticated', 'private.lock_audio_version(uuid)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'private.require_audio_staff(boolean)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'private.guard_audio_version()', 'EXECUTE'),
  'hàm nội bộ âm thanh chỉ dành cho service_role');

-- 6. Cờ mặc định TẮT.
select is((select enabled from private.feature_flags where key = 'teacher_audio_recording_approved'), false,
  'cờ teacher_audio_recording_approved mặc định tắt');

-- 7–8. Ràng buộc khóa đối tượng và định dạng.
select throws_ok(
  $$insert into public.audio_asset_versions (id, asset_id, school_id, version_no, spoken_label, storage_key, content_hash,
      mime_type, size_bytes, duration_ms, consent_id, created_by)
    values ('00000000-0000-4000-8000-0000000a00b1', '00000000-0000-4000-8000-0000000a00a1', '00000000-0000-4000-8000-0000000a00e1', 1, 'bờ',
      '../tuy/y/duong-dan.wav', repeat('a', 64), 'audio/wav', 100, 1000, '00000000-0000-4000-8000-0000000a00c1', '00000000-0000-4000-8000-0000000a0001')$$,
  '23514', null, 'khóa đối tượng tùy ý bị từ chối');
select throws_ok(
  $$insert into public.audio_asset_versions (id, asset_id, school_id, version_no, spoken_label, storage_key, content_hash,
      mime_type, size_bytes, duration_ms, consent_id, created_by)
    values ('00000000-0000-4000-8000-0000000a00b1', '00000000-0000-4000-8000-0000000a00a1', '00000000-0000-4000-8000-0000000a00e1', 1, 'bờ',
      '00000000-0000-4000-8000-0000000a00e1/00000000-0000-4000-8000-0000000a00a1/00000000-0000-4000-8000-0000000a00b1.exe',
      repeat('a', 64), 'application/x-msdownload', 100, 1000, '00000000-0000-4000-8000-0000000a00c1', '00000000-0000-4000-8000-0000000a0001')$$,
  '23514', null, 'định dạng ngoài danh sách bị từ chối');

-- 9. Không chèn thẳng bản đã duyệt.
select throws_ok(
  $$insert into public.audio_asset_versions (id, asset_id, school_id, version_no, status, spoken_label, storage_key, content_hash,
      mime_type, size_bytes, duration_ms, consent_id, created_by, submitted_at, submitted_by, reviewed_by, reviewed_at, review_listened)
    values ('00000000-0000-4000-8000-0000000a00b1', '00000000-0000-4000-8000-0000000a00a1', '00000000-0000-4000-8000-0000000a00e1', 1, 'approved', 'bờ',
      '00000000-0000-4000-8000-0000000a00e1/00000000-0000-4000-8000-0000000a00a1/00000000-0000-4000-8000-0000000a00b1.wav',
      repeat('a', 64), 'audio/wav', 100, 1000, '00000000-0000-4000-8000-0000000a00c1', '00000000-0000-4000-8000-0000000a0001',
      now(), '00000000-0000-4000-8000-0000000a0001', '00000000-0000-4000-8000-0000000a0001', now(), true)$$,
  '23514', 'AUDIO_VERSION_MUST_START_DRAFT', 'bản mới luôn bắt đầu là bản nháp (kể cả khi chèn bằng quyền cao)');

-- Bản nháp hợp lệ để kiểm tra bất biến.
select lives_ok(
  $$insert into public.audio_asset_versions (id, asset_id, school_id, version_no, spoken_label, storage_key, content_hash,
      mime_type, size_bytes, duration_ms, consent_id, created_by)
    values ('00000000-0000-4000-8000-0000000a00b1', '00000000-0000-4000-8000-0000000a00a1', '00000000-0000-4000-8000-0000000a00e1', 1, 'bờ',
      '00000000-0000-4000-8000-0000000a00e1/00000000-0000-4000-8000-0000000a00a1/00000000-0000-4000-8000-0000000a00b1.wav',
      repeat('a', 64), 'audio/wav', 100, 1000, '00000000-0000-4000-8000-0000000a00c1', '00000000-0000-4000-8000-0000000a0001')$$,
  'bản nháp hợp lệ chèn được');

-- 11–13. Máy trạng thái.
select throws_ok(
  $$update public.audio_asset_versions set status = 'approved' where id = '00000000-0000-4000-8000-0000000a00b1'$$,
  '23514', null, 'draft không nhảy thẳng sang approved');
select throws_ok(
  $$update public.audio_asset_versions set storage_key = replace(storage_key, '.wav', '.mp3') where id = '00000000-0000-4000-8000-0000000a00b1'$$,
  '23514', 'AUDIO_VERSION_IMMUTABLE', 'không đổi tệp trỏ tới của một phiên bản');
select throws_ok(
  $$update public.audio_asset_versions set content_hash = repeat('b', 64) where id = '00000000-0000-4000-8000-0000000a00b1'$$,
  '23514', 'AUDIO_VERSION_IMMUTABLE', 'không đổi nội dung (hash) của phiên bản');

select lives_ok(
  $$update public.audio_asset_versions set status = 'pending_review', submitted_by = '00000000-0000-4000-8000-0000000a0001', submitted_at = now()
    where id = '00000000-0000-4000-8000-0000000a00b1'$$,
  'gửi duyệt hợp lệ');
select throws_ok(
  $$update public.audio_asset_versions set duration_ms = 2000 where id = '00000000-0000-4000-8000-0000000a00b1'$$,
  '23514', 'AUDIO_VERSION_IMMUTABLE', 'bản đã gửi duyệt bất biến');
select throws_ok(
  $$update public.audio_asset_versions set status = 'draft', submitted_at = null, submitted_by = null where id = '00000000-0000-4000-8000-0000000a00b1'$$,
  '23514', null, 'không quay về bản nháp sau khi gửi duyệt');

-- 17–18. Không xóa.
select throws_ok($$delete from public.audio_asset_versions$$, '23514', 'AUDIO_RECORD_NO_DELETE', 'không xóa được phiên bản');
select throws_ok($$delete from public.audio_assets$$, '23514', 'AUDIO_RECORD_NO_DELETE', 'không xóa được tài nguyên');

-- 19. Đồng ý chỉ chuyển granted → withdrawn.
select throws_ok(
  $$update public.audio_voice_consents set notice_version = 'v2' where id = '00000000-0000-4000-8000-0000000a00c1'$$,
  '23514', 'AUDIO_CONSENT_IMMUTABLE', 'bản ghi đồng ý dùng giọng là chứng từ bất biến');

-- 20. Con trỏ "đang dùng" chỉ trỏ tới bản đã duyệt.
select throws_ok(
  $$update public.audio_assets set active_version_id = '00000000-0000-4000-8000-0000000a00b1' where id = '00000000-0000-4000-8000-0000000a00a1'$$,
  '23514', 'AUDIO_ACTIVE_NOT_APPROVED', 'asset chỉ kích hoạt được bản đã duyệt');

-- 21. Nhật ký không có nội dung nhạy cảm (không hàm âm thanh nào ghi tên tệp/khóa lưu trữ vào audit).
select is((select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname like '%audio%' and p.prosrc ~* 'write_audit\([^;]*(storage_key|spoken_label)'),
  0, 'hàm âm thanh không ghi khóa lưu trữ/nhãn vào audit_logs');

-- 22. Chuỗi trạng thái trong CHECK đúng tập đã thiết kế.
select ok(exists (select 1 from pg_constraint
                  where conrelid = 'public.audio_asset_versions'::regclass and contype = 'c'
                    and pg_get_constraintdef(oid) like '%draft%pending_review%approved%rejected%revoked%superseded%discarded%'),
  'CHECK trạng thái phiên bản đúng 7 giá trị');

select * from finish();
rollback;
