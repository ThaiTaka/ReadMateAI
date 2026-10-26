# Hướng dẫn giáo viên: Ghi âm giọng đọc (`/teacher/audio`)

> **Trạng thái (R10.2, 2026-10-27):** phần kỹ thuật đã có và kiểm thử với **dữ liệu giả** trên Supabase local/CI. **Chưa dùng với giáo viên thật**: chưa có xác nhận cách đọc, chưa có sự đồng ý dùng giọng, chưa kiểm tra thiết bị ghi âm thật. Tính năng lưu bản ghi **tắt mặc định** (cờ hệ thống `teacher_audio_recording_approved`); khi tắt, trang chỉ ở chế độ xem trước.
> Liên quan: [AUDIO_ENGINE](AUDIO_ENGINE.md), [AUDIO_RECORDING_PLAN](AUDIO_RECORDING_PLAN.md), [PRIVACY_AND_SECURITY](PRIVACY_AND_SECURITY.md).

## 1. Bạn cần ghi gì

Chỉ **âm đơn lẻ** (danh sách P0 dự kiến, 38 cách gọi âm). Câu hướng dẫn và lời khen sau này dùng giọng tổng hợp (TTS) sau khi được duyệt. **Không ghi âm trẻ em.** Không cần ghi cả 181 âm/vần ngay: bắt đầu với các âm lớp đã học.

## 2. Các bước

1. **Đồng ý dùng giọng** (chỉ lần đầu): đọc các điều ở đầu trang, tự đánh dấu ô đồng ý rồi bấm *Tôi đồng ý*. Ô không bao giờ được chọn sẵn.
2. **Chọn một âm** trong danh sách (lọc: *Tất cả, Chưa ghi, Bản nháp, Chờ duyệt, Đã duyệt, Cần ghi lại*; có ô tìm chữ). Âm nào còn ghi **"Chờ xác nhận cách đọc"** thì cách đọc là đề xuất của hệ thống, chưa phải quy ước của lớp.
3. **Xác nhận cách đọc**: gõ đúng cách bạn đọc khi dạy (ví dụ *bờ*) và bấm *Xác nhận cách đọc*. Các âm k, gh, ngh, gi, qu, ă, â, i/y là điểm quy ước cần chốt trước khi ghi.
4. **Ghi âm**: bấm *Bắt đầu ghi* (trình duyệt sẽ hỏi quyền micro), đọc mẫu, bấm *Dừng ghi*, rồi *Nghe lại*. Chưa hài lòng thì bấm *Ghi lại*. Mỗi bản tối đa 9 giây (tự dừng).
5. **Lưu bản nháp**: bản ghi **chỉ được gửi lên khi bạn bấm *Lưu bản nháp*** — dừng ghi không tự lưu. Bản nháp được giữ để bạn làm tiếp buổi sau.
6. **Gửi duyệt**: bấm *Gửi duyệt* khi sẵn sàng. Sau khi gửi, bản đó **không sửa được**; muốn đổi, hãy ghi một bản mới.
7. **Duyệt**: người duyệt nghe bản ghi (phải bấm phát), tích *Tôi đã nghe…*, rồi bấm *Duyệt bản ghi* hoặc *Yêu cầu ghi lại* (kèm ghi chú). Không duyệt được nếu cách đọc chưa xác nhận hoặc khác cách đọc ghi trên bản, hoặc người ghi đã rút đồng ý.
8. **Bị yêu cầu ghi lại**: đọc ghi chú, ghi một bản mới (phiên bản kế tiếp); bản cũ vẫn lưu nguyên. Bản đã duyệt cũ chỉ được thay khi bản mới được duyệt.

## 3. Tải tệp ghi sẵn lên

Chọn tệp từ điện thoại/máy tính ở mục *Hoặc tải tệp ghi sẵn lên*. Hỗ trợ **WebM, Ogg, M4A (MP4 âm thanh), MP3, WAV**, tối đa **2 MB** và **10 giây**, chỉ âm thanh (không có hình). Máy chủ kiểm tra **nội dung** tệp, không tin đuôi tên hay loại tệp trình duyệt khai; tệp lạ/hỏng bị từ chối kèm hướng dẫn. Tệp không được gửi tới dịch vụ âm thanh bên thứ ba.

## 4. Trên iPhone

- Ghi trực tiếp bằng trình duyệt Safari dùng định dạng MP4/AAC nếu có; nếu không dùng được, trang báo và gợi ý tải tệp.
- Cách chắc nhất: dùng ứng dụng **Ghi âm (Voice Memos)** → chia sẻ/lưu tệp `.m4a` → chọn tệp ở đây.
- Chưa kiểm thử trên iPhone thật (CI chỉ có WebKit trên Linux, không có micro).
- Lưu ý cho R10.3: bản ghi được lưu **đúng định dạng đã ghi** (WebM/Opus từ Chrome, MP4 từ Safari). Trình phát cho học sinh sẽ phải xử lý khác biệt này (xem AUDIO_ENGINE §12).

## 5. Bản ghi của bạn được bảo vệ thế nào

- Lưu ở kho **riêng tư** (không có liên kết công khai); học sinh và giáo viên trường khác không thấy. Đồng nghiệp cùng trường chỉ thấy bản **đã gửi duyệt**, không thấy bản nháp.
- Bạn nghe lại qua trang (có đăng nhập); đường dẫn lưu trữ không hiện ra ngoài.
- **Thu hồi**: nút *Thu hồi* trên từng bản (bản bị thu hồi ngừng được dùng ngay). **Rút đồng ý**: thu hồi toàn bộ bản ghi của bạn một lần.
- **Xóa hẳn tệp**: báo quản trị viên của trường (quy trình xóa dữ liệu có kiểm soát, chưa có nút tự xóa).
- Nhật ký chỉ ghi mã định danh, không ghi nội dung âm thanh.

## 6. Việc chưa có xác nhận (đừng dùng với học sinh khi chưa xong)

1. Giáo viên nào ghi âm (Q-03) và bộ sách/vị trí bài của lớp 1A2 (Q-01).
2. Cách gọi từng âm theo lớp (Q-02), đặc biệt k, gh, ngh, gi, qu, ă, â, y.
3. Sự đồng ý lưu và dùng giọng bằng văn bản; chủ dự án bật cờ hệ thống.
4. Nhà cung cấp TTS và quyền dùng tệp tổng hợp (cho lời khen/câu lệnh).
5. Kiểm tra thực tế micro/thiết bị (Windows, Mac, Android, iPhone).

**Điều kiện chuyển R10.3** (phát âm thanh trong bài): có ≥ 1 bản ghi được duyệt thật cho các âm cần thiết, cách đọc đã xác nhận, đã kiểm tra phát trên Safari/iPhone, chủ dự án cho phép.
