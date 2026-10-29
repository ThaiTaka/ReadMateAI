# Hướng dẫn giáo viên: Ghi âm giọng đọc (`/teacher/audio`)

> **Cập nhật R10.3b1 (2026-10-28):** thêm mục 7 — phân biệt *bản ghi giọng giáo viên* với *giọng máy (AI)*. Giọng máy **chưa được tạo**; hiện chỉ có danh sách lời đọc để bạn xem trước.
> **Cập nhật R10.3a (2026-10-27):** phần *phát cho học sinh* đã có về kỹ thuật nhưng **TẮT** (cờ `student_teacher_audio_playback_approved`) và mới thử bằng âm thanh tổng hợp. Xem mục 4a về định dạng tương thích với điện thoại của học sinh.
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
- Bản ghi được lưu **đúng định dạng đã ghi** (WebM/Opus từ Chrome, MP4 từ Safari) và phát cho học sinh **đúng định dạng đó** (hệ thống **không** tự chuyển mã). Xem mục 4a.

## 4a. Làm sao để học sinh nghe được trên điện thoại của các em

- **Chắc chắn nhất: tệp M4A (AAC) hoặc MP3** — iPhone/Safari và Android đều phát được. Cách làm: ghi bằng ứng dụng *Ghi âm (Voice Memos)* trên iPhone (ra tệp `.m4a`) hoặc máy ghi âm của điện thoại Android rồi **tải tệp lên** ở mục *Hoặc tải tệp ghi sẵn lên*.
- **WebM/Opus** (ghi trực tiếp bằng Chrome/Edge trên máy tính) có thể **không nghe được trên iPhone** cũ hoặc chưa cập nhật. Nếu lớp có em dùng iPhone, nên dùng M4A/MP3 thay vì WebM.
- Nếu một em không nghe được, giao diện của em hiện *"Máy này chưa phát được âm thanh này"* và nút nghe bị khóa — hệ thống **không** thay bằng giọng máy đọc. Hãy ghi lại bản M4A/MP3 rồi gửi duyệt như thường.
- Mỗi bản chỉ **một âm**, ngắn (dưới 10 giây), đọc đúng cách bạn đã xác nhận. Học sinh chỉ nghe bản **đã duyệt, đang dùng** và chỉ khi bạn còn đồng ý dùng giọng; thu hồi bản hoặc rút đồng ý thì các lần nghe **mới** bị chặn ngay (bản đã tải về điện thoại trước đó thì không thu lại được).
- Học sinh có thể tắt âm thanh trong cài đặt của em; khi đó em không nghe được và không bị tính là sai.
- **Chưa kiểm tra trên iPhone/Android thật** — bạn (hoặc phụ huynh tình nguyện) nên thử nghe trước khi cho cả lớp dùng.

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

**Điều kiện để bật phát cho học sinh thật (nghiệm thu R10.3):** có bản ghi **được duyệt thật** cho các âm cần thiết, cách đọc đã xác nhận (Q-01/Q-02/Q-03), sự đồng ý dùng giọng hợp lệ, đã kiểm tra phát trên **iPhone/Safari thật và ít nhất một điện thoại Android thật**, quyết định về TTS cho các câu hướng dẫn, và chủ dự án cho phép bật cờ.

**Chưa làm (hạng mục kế tiếp):** ghép chuỗi đánh vần kiểu *"bờ – a – ba – huyền – bà"*. Việc đó cần quy tắc đánh vần do GV duyệt và thêm bản ghi cho tiếng cơ sở, dấu thanh, tiếng hoàn chỉnh; hiện hệ thống chỉ phát **một bản ghi đã duyệt cho một âm**.

## 7. Bản ghi giọng giáo viên và giọng máy (AI) — khác nhau thế nào

| | Bản ghi giọng giáo viên | Giọng máy (TTS, chưa có) |
|---|---|---|
| Ai tạo | Chính giáo viên ghi hoặc tải tệp (trang *Ghi âm giọng đọc*) | Máy tính tạo từ chữ, sau khi chủ dự án chọn dịch vụ |
| Dùng cho | **Âm và vần đơn lẻ** (ví dụ "bờ", "a") — bắt buộc, không thay bằng giọng máy | Câu hướng dẫn, lời động viên, và những lời đọc mà chính sách của dạng bài cho phép |
| Bạn duyệt gì | Nghe bản ghi + xác nhận cách đọc + người ghi còn đồng ý dùng giọng | **Hai lần**: (1) *chữ và cách đọc* của từng lời trước khi tạo âm thanh; (2) *nghe tệp đã tạo* trước khi học sinh được nghe |
| Khi nào học sinh nghe | Bản đã duyệt, đang dùng, còn đồng ý | Chưa — chưa có nhà cung cấp, chưa chọn giọng, chưa lời nào được duyệt |

Những điều cần biết:

- **Xem trước:** trang *Lời đọc giọng máy (thử nghiệm)* (`/teacher/tts-script`) liệt kê các câu hướng dẫn và lời động viên **đang có trong bài luyện**, kèm mục đích dùng, giọng dự kiến, nguồn và lúc nào được phát ở từng mức hỗ trợ (H3→H0). Trang ghi rõ **"BẢN THỬ NGHIỆM — DỮ LIỆU MINH HỌA"**, chỉ để đọc: chưa có nút duyệt, chưa phát được âm thanh.
- **Đừng duyệt hộ máy:** không lời đọc nào tự được duyệt. Mục có nhãn *"Cách xưng hô chờ giáo viên chọn"* (con/em) hoặc *"Giáo viên cân nhắc giọng điệu"* (ví dụ "Chưa đúng rồi") là chỗ bạn nên góp ý trước.
- **Không bao giờ** có giọng máy cho âm/vần đơn lẻ, và giọng máy **không đọc hộ** chữ, từ, câu mà bài đang kiểm tra khả năng tự đọc của trẻ — chỉ đọc mẫu **sau khi** trẻ đã trả lời.
- Đổi chữ của một lời đọc, đổi giọng hay tốc độ đọc là tạo **phiên bản mới** và phải duyệt lại; tệp đã duyệt không bị sửa.
- Quyết định còn thiếu (chọn dịch vụ, giọng Bắc/Nam, xưng hô "con"/"em", điều khoản lưu tệp…) nằm trong [TTS_APPROVAL_CHECKLIST](TTS_APPROVAL_CHECKLIST.md); các ô chưa xác nhận ghi **"Chưa quyết định"**.
- *Ghép chuỗi đánh vần* ("bờ – a – ba – huyền – bà") vẫn là hạng mục sau này, cần quy tắc do giáo viên duyệt ([AUDIO_ENGINE §14.9](AUDIO_ENGINE.md)).
