-- Kiểm thử ràng buộc và bất biến (pgTAP). Mỗi dữ liệu tạo trong giao dịch và bị ROLLBACK cuối tệp.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(24);

-- Dữ liệu giả cho kiểm thử
insert into auth.users (id, email, is_anonymous) values
  ('00000000-0000-4000-8000-0000000000f1', concat('pgtap-teacher', '@', 'readmate.test'), false),
  ('00000000-0000-4000-8000-0000000000f2', null, true);
insert into public.schools (id, name) values ('00000000-0000-4000-8000-0000000000e1', 'Trường kiểm thử pgTAP');
insert into public.staff_profiles (id, school_id, display_name)
  values ('00000000-0000-4000-8000-0000000000f1', '00000000-0000-4000-8000-0000000000e1', 'GV kiểm thử');
insert into public.classes (id, school_id, name, school_year, created_by)
  values ('00000000-0000-4000-8000-0000000000c1', '00000000-0000-4000-8000-0000000000e1', 'Lớp Thử', '2026-2027',
          '00000000-0000-4000-8000-0000000000f1');

-- Mùa thi đua
select is((select count(*)::int from public.seasons where class_id = '00000000-0000-4000-8000-0000000000c1' and status = 'active'),
  1, 'tạo lớp → tự có đúng một mùa đang diễn ra');
select is((select seq_no from public.seasons where class_id = '00000000-0000-4000-8000-0000000000c1'), 1, 'mùa đầu có số 1');
select throws_ok(
  $$insert into public.seasons (class_id, seq_no, rules_version) values ('00000000-0000-4000-8000-0000000000c1', 2, 'r1')$$,
  '23505', null, 'không thể có hai mùa đang diễn ra trong một lớp');

-- Cờ bảng xếp hạng/vinh danh
select throws_ok(
  $$update public.classes set leaderboard_enabled = true where id = '00000000-0000-4000-8000-0000000000c1'$$,
  '23514', 'LEADERBOARD_NOT_APPROVED', 'không bật được bảng xếp hạng khi chưa có chấp thuận hệ thống');
select throws_ok(
  $$update public.classes set honors_enabled = true where id = '00000000-0000-4000-8000-0000000000c1'$$,
  '23514', 'HONORS_NOT_APPROVED', 'không bật được vinh danh khi chưa có chấp thuận hệ thống');

-- Tiến độ chương trình: chuỗi minh họa không bao giờ xác nhận được
insert into public.content_releases (id, dataset_version, content_hash)
  values ('00000000-0000-4000-8000-0000000000d1', '0.0.1', repeat('a', 64));
insert into public.curriculum_series (id, key, series_kind, title, review_status, release_id)
  values ('00000000-0000-4000-8000-0000000000d2', 'series:pgtap-illustrative', 'illustrative', 'Minh họa', 'pending_review',
          '00000000-0000-4000-8000-0000000000d1');
insert into public.curriculum_lessons (id, series_id, ordinal, code, title, lesson_type)
  values ('00000000-0000-4000-8000-0000000000d3', '00000000-0000-4000-8000-0000000000d2', 1, 'T1', 'Bài thử', 'new_units');
select lives_ok(
  $$update public.classes set curriculum_series_id = '00000000-0000-4000-8000-0000000000d2',
    current_lesson_id = '00000000-0000-4000-8000-0000000000d3' where id = '00000000-0000-4000-8000-0000000000c1'$$,
  'chọn chuỗi minh họa ở trạng thái chưa xác nhận');
select throws_ok(
  $$update public.classes set curriculum_status = 'confirmed', curriculum_confirmed_by = '00000000-0000-4000-8000-0000000000f1',
    curriculum_confirmed_at = now() where id = '00000000-0000-4000-8000-0000000000c1'$$,
  '23514', 'CURRICULUM_NOT_CONFIRMABLE', 'không xác nhận được tiến độ dùng chuỗi minh họa');
select throws_ok(
  $$insert into public.curriculum_series (key, series_kind, title, review_status, release_id)
    values ('series:pgtap-fake', 'textbook', 'Sách', 'approved', '00000000-0000-4000-8000-0000000000d1')$$,
  '23514', null, 'không thể "đã duyệt" khi thiếu người duyệt/ngày/băm (và bộ sách phải có nguồn)');

-- Văn bản: NFC, không ký tự ẩn, không trùng biệt danh (không phân biệt hoa thường, kể cả chữ có dấu)
select throws_ok(
  format($$insert into public.students (class_id, display_name, avatar_key) values ('00000000-0000-4000-8000-0000000000c1', %L, 'may')$$,
         normalize('Ánh', NFD)),
  '23514', null, 'biệt danh không ở dạng NFC bị từ chối');
select throws_ok(
  format($$insert into public.students (class_id, display_name, avatar_key) values ('00000000-0000-4000-8000-0000000000c1', %L, 'may')$$,
         'Na' || chr(8203) || 'Na'),
  '23514', null, 'biệt danh chứa ký tự ẩn (U+200B) bị từ chối');
select throws_ok(
  format($$insert into public.students (class_id, display_name, avatar_key) values ('00000000-0000-4000-8000-0000000000c1', %L, 'may')$$,
         'Bin' || chr(173)),
  '23514', null, 'biệt danh chứa dấu gạch mềm ẩn (U+00AD) bị từ chối');
select throws_ok(
  format($$insert into public.students (class_id, display_name, avatar_key) values ('00000000-0000-4000-8000-0000000000c1', %L, 'may')$$,
         'Bi' || chr(7) || 'n'),
  '23514', null, 'biệt danh chứa ký tự điều khiển bị từ chối');
insert into public.students (id, class_id, display_name, avatar_key)
  values ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000c1', 'Ánh', 'may');
select throws_ok(
  $$insert into public.students (class_id, display_name, avatar_key) values ('00000000-0000-4000-8000-0000000000c1', 'ánh', 'na')$$,
  '23505', null, 'không trùng biệt danh trong lớp (Ánh / ánh)');
select throws_ok(
  $$update public.students set class_id = gen_random_uuid() where id = '00000000-0000-4000-8000-0000000000a1'$$,
  null, null, 'không chuyển học sinh sang lớp khác bằng UPDATE');

-- Tên hiển thị: đổi tên → mất trạng thái duyệt
update public.students set leaderboard_alias = 'Ánh Sao', leaderboard_alias_approved_by = '00000000-0000-4000-8000-0000000000f1',
  leaderboard_alias_approved_at = now() where id = '00000000-0000-4000-8000-0000000000a1';
update public.students set leaderboard_alias = 'Ánh Trăng' where id = '00000000-0000-4000-8000-0000000000a1';
select ok((select leaderboard_alias_approved_at is null from public.students where id = '00000000-0000-4000-8000-0000000000a1'),
  'đổi tên hiển thị thì phải duyệt lại');

-- Thiết bị và tài khoản GV
select throws_ok(
  $$insert into public.student_devices (auth_user_id, student_id, class_id)
    values ('00000000-0000-4000-8000-0000000000f1', '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000c1')$$,
  '23514', 'DEVICE_MUST_BE_ANONYMOUS', 'thiết bị học sinh phải là người dùng ẩn danh');
select throws_ok(
  $$insert into public.staff_profiles (id, school_id, display_name)
    values ('00000000-0000-4000-8000-0000000000f2', '00000000-0000-4000-8000-0000000000e1', 'Giả mạo')$$,
  '23514', 'STAFF_MUST_NOT_BE_ANONYMOUS', 'người dùng ẩn danh không thể thành giáo viên');
select throws_ok(
  $$insert into public.student_devices (auth_user_id, student_id, class_id)
    values ('00000000-0000-4000-8000-0000000000f2', '00000000-0000-4000-8000-0000000000a1', gen_random_uuid())$$,
  '23503', null, 'class_id của thiết bị phải khớp lớp của học sinh (khóa ngoại kép)');

-- Đồng ý: chứng từ bất biến, chỉ granted → withdrawn
insert into public.guardian_consents (id, student_id, class_id, scope, notice_version, method, recorded_by)
  values ('00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000c1',
          'learning_data', 'nhap-2026-10', 'paper_form', '00000000-0000-4000-8000-0000000000f1');
select throws_ok(
  $$update public.guardian_consents set notice_version = 'khac' where id = '00000000-0000-4000-8000-0000000000b1'$$,
  '23514', 'CONSENT_RECORD_IMMUTABLE', 'không sửa được nội dung bản ghi đồng ý');
select throws_ok(
  $$insert into public.guardian_consents (student_id, class_id, scope, notice_version, method, recorded_by)
    values ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000c1', 'learning_data', 'nhap-2026-10',
            'paper_form', '00000000-0000-4000-8000-0000000000f1')$$,
  '23505', null, 'mỗi phạm vi chỉ có một đồng ý còn hiệu lực');
update public.guardian_consents set status = 'withdrawn', withdrawn_at = now(), withdrawn_by = '00000000-0000-4000-8000-0000000000f1'
  where id = '00000000-0000-4000-8000-0000000000b1';
select throws_ok(
  $$update public.guardian_consents set status = 'granted', withdrawn_at = null, withdrawn_by = null
    where id = '00000000-0000-4000-8000-0000000000b1'$$,
  '23514', 'CONSENT_RECORD_IMMUTABLE', 'không "khôi phục" đồng ý đã rút — phải ghi nhận bản mới');

-- Nhật ký chỉ ghi thêm
insert into public.audit_logs (actor_kind, action, target_type) values ('system', 'test.insert', 'test');
select throws_ok($$update public.audit_logs set action = 'test.changed'$$, '23514', 'AUDIT_LOG_APPEND_ONLY', 'không sửa được nhật ký');
select throws_ok($$delete from public.audit_logs$$, '23514', 'AUDIT_LOG_APPEND_ONLY', 'không xóa được nhật ký');

-- Giới hạn tần suất nguyên tử
select ok(
  public.gateway_consume_rate_limit(repeat('b', 64), 900, 2) and public.gateway_consume_rate_limit(repeat('b', 64), 900, 2)
  and not public.gateway_consume_rate_limit(repeat('b', 64), 900, 2),
  'giới hạn tần suất: lần thứ 3 trong cửa sổ bị chặn');

select * from finish();
rollback;
