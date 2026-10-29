-- Chế độ trình diễn âm thanh: khóa đối tượng Storage phải nằm trong thư mục của CHÍNH trường đó.
--
-- `contest_audio_assets.storage_key` có dạng `<mã trường>/<mã phiên bản>.<đuôi>` (migration trước chỉ kiểm hình dạng, chưa kiểm rằng thư mục
-- đầu trùng `school_id`). Hàm đăng ký chỉ `service_role` gọi được, nhưng ràng buộc cứng ở CSDL bảo đảm một dòng của trường A không thể trỏ
-- tới đối tượng của trường B dù có lỗi ở mã gọi hàm. Dòng hiện có đều do công cụ/kiểm thử dựng đúng dạng này.

alter table public.contest_audio_assets
  add constraint contest_audio_assets_key_in_school_folder check (split_part(storage_key, '/', 1) = school_id::text);
