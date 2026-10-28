# TTS — Bảng quyết định trước khi dùng giọng máy (R10.3b1)

> **Mục đích:** để chủ dự án và giáo viên quyết định những điều bắt buộc trước khi có **bất kỳ** âm thanh giọng máy nào được tạo thật hoặc phát cho học sinh. Tài liệu kỹ thuật: [AUDIO_ENGINE §10 và §14](AUDIO_ENGINE.md). Hướng dẫn giáo viên: [TEACHER_AUDIO_GUIDE §7](TEACHER_AUDIO_GUIDE.md).
>
> **Quy ước:** mọi ô dưới đây đang ghi **"Chưa quyết định"**. Không ô nào được điền "Đã đồng ý" hộ chủ dự án hay giáo viên; chỉ người có thẩm quyền ghi quyết định, ngày và (nếu cần) bằng chứng (tin nhắn, văn bản, đường dẫn điều khoản). Hệ thống hiện chạy với nhà cung cấp `none` — không gọi dịch vụ ngoài, không tạo khóa, không bật thanh toán.

## 1. Trạng thái hiện tại (sự thật, không phải quyết định)

| Hạng mục | Tình trạng |
|---|---|
| Nhà cung cấp TTS | Chưa chọn (`TTS_PROVIDER=none`; Google chỉ là adapter thử nghiệm chưa gọi API thật) |
| Tài khoản Cloud / khóa API / thanh toán | Chưa tạo, chưa bật |
| Giọng đọc | Chưa nghe thử giọng nào; cấu hình giữ chỗ `provisional-0` |
| Lời đọc đã duyệt | 0 trên 34 lời đọc của danh mục tĩnh (17 câu lệnh + 17 phản hồi, tổng 1.260 ký tự); danh sách xem trước ở `/teacher/tts-script`, mọi mục "Chờ giáo viên duyệt") |
| Tệp âm thanh TTS | 0 |
| Cờ phát âm thanh cho học sinh (`student_teacher_audio_playback_approved`) và cờ ghi âm giáo viên (`teacher_audio_recording_approved`) | **TẮT** |

## 2. Quyết định của chủ dự án

| # | Câu hỏi | Lựa chọn / ghi chú | Người quyết định | Ngày | Trạng thái |
|---|---|---|---|---|---|
| P1 | **Nhà cung cấp TTS** (ứng viên theo tài liệu: Google Cloud TTS Neural2 → FPT.AI → Azure; xem AUDIO_ENGINE §3) | — | Chủ dự án | — | **Chưa quyết định** |
| P2 | Có được **tạo tài khoản thử nghiệm / khóa API** để nghe thử không? Ai giữ khóa, lưu ở đâu (biến môi trường máy chủ, không commit) | — | Chủ dự án | — | **Chưa quyết định** |
| P3 | Chấp nhận **bật thanh toán** nếu nhà cung cấp bắt buộc (Google bắt buộc) không? | — | Chủ dự án | — | **Chưa quyết định** |
| P4 | **Chi phí tối đa** cho toàn dự án và cho mỗi tháng; cảnh báo ngân sách ở mức nào | Ước tính theo tài liệu: dưới 100.000 ký tự cho toàn kho hiện tại; mã giới hạn mỗi lô 40 tác vụ / 3.000 ký tự | Chủ dự án | — | **Chưa quyết định** |
| P5 | **Giới hạn sử dụng** (số lô mỗi ngày/tháng, ai được bấm tạo — chỉ giáo viên `owner`?) | — | Chủ dự án | — | **Chưa quyết định** |
| P6 | **Điều khoản của nhà cung cấp** cho phép **lưu lâu dài và phân phối lại** tệp đã tổng hợp trong ứng dụng cho học sinh không? Có yêu cầu ghi nguồn/nhãn "giọng tổng hợp" không? (chưa xác minh với cả ba nhà cung cấp) | — | Chủ dự án | — | **Chưa quyết định** |
| P7 | Dịch vụ có **lưu lại văn bản gửi đi** không và có chấp nhận được không (chỉ gửi câu hướng dẫn/lời động viên cố định, không dữ liệu học sinh) | — | Chủ dự án | — | **Chưa quyết định** |
| P8 | Cho **lời khen/câu hướng dẫn dùng giọng máy**, hay giáo viên ghi hết (phương án chỉ-giáo-viên vẫn dùng được thiết kế hiện tại) — mục D6 của AUDIO_ENGINE | — | Chủ dự án | — | **Chưa quyết định** |
| P9 | **Cho phép lưu tệp TTS** ở Storage riêng tư và thêm bảng/migration cho phiên bản TTS (R10.3b2) | — | Chủ dự án | — | **Chưa quyết định** |

## 3. Quyết định của giáo viên

| # | Câu hỏi | Lựa chọn / ghi chú | Người quyết định | Ngày | Trạng thái |
|---|---|---|---|---|---|
| G1 | **Giọng Bắc hay Nam** phù hợp lớp (Q-03) | — | Giáo viên | — | **Chưa quyết định** |
| G2 | **Giọng nữ hay nam** | — | Giáo viên | — | **Chưa quyết định** |
| G3 | **Tốc độ đọc** cho câu hướng dẫn và lời động viên (chậm / bình thường); mã mặc định giữ chỗ đang là "chậm" nhưng **chưa phải quyết định** | — | Giáo viên | — | **Chưa quyết định** |
| G4 | **Quy ước xưng hô**: "con" hay "em" trong mọi lời đọc (Q-08). Hiện câu chữ dùng "Con"; 30/34 lời đọc trong danh mục tĩnh (câu lệnh + phản hồi) đang có chữ "con/em" và được gắn cờ chờ chọn xưng hô | — | Giáo viên | — | **Chưa quyết định** |
| G5 | **Duyệt lời hướng dẫn** của từng dạng bài (17 câu): đúng sư phạm, dễ hiểu với trẻ 6–7 tuổi | — | Giáo viên | — | **Chưa quyết định** |
| G6 | **Duyệt lời khen / lời nhắc thử lại** (17 câu), gồm 3 câu có chữ phủ định ("Chưa đúng rồi", "Có phần ghép chưa đúng…", "Có cặp nối chưa đúng…") — giữ, đổi giọng điệu hay bỏ phần đọc | — | Giáo viên | — | **Chưa quyết định** |
| G7 | **Cách đọc**: tên chữ cái, cách gọi âm, vần, cách đọc dấu thanh, từ dễ nhầm (Q-01/Q-02; xem AUDIO_RECORDING_PLAN §6) | — | Giáo viên | — | **Chưa quyết định** |
| G8 | **Nghe và duyệt từng tệp** đã tạo (sau khi P1–P9 xong): chất lượng phát âm dấu thanh, b/d, ch/tr, s/x, câu 4–6 tiếng | — | Giáo viên | — | **Chưa quyết định** |
| G9 | Có muốn **ghép chuỗi đánh vần** ("bờ – a – ba – huyền – bà") không, và **quy tắc đánh vần** của lớp (AUDIO_ENGINE §14.9) | — | Giáo viên | — | **Chưa quyết định** |

## 4. Điều kiện mở cho học sinh thật

Chỉ khi **tất cả** dưới đây đạt (mỗi mục cần bằng chứng, không suy đoán):

| # | Điều kiện | Trạng thái |
|---|---|---|
| C1 | P1–P9 đã có quyết định bằng văn bản | **Chưa quyết định** |
| C2 | G1–G7 đã có quyết định; lời đọc cần dùng đã được giáo viên duyệt (bước 1) | **Chưa quyết định** |
| C3 | Giáo viên đã **nghe và duyệt từng tệp** (bước 2), không dùng tệp mock hay `testOnly` | **Chưa quyết định** |
| C4 | Đã **kiểm thử phát trên iPhone/Safari thật và ít nhất một điện thoại Android thật** | **Chưa quyết định** |
| C5 | Hạng mục gợi ý bằng âm thanh: có cơ chế ghi nhận "đã dùng gợi ý" (hiện khe `hint` bị khóa) | **Chưa quyết định** |
| C6 | Đường phát TTS cho học sinh (R10.3b2) được viết, kiểm thử và rà soát bảo mật; cờ phát được bật **bằng migration** do chủ dự án cho phép (không bằng mã ứng dụng) | **Chưa quyết định** |
| C7 | Rà soát quyền riêng tư: không dữ liệu học sinh gửi tới nhà cung cấp (PRIVACY_AND_SECURITY), đã cập nhật danh mục dịch vụ bên thứ ba | **Chưa quyết định** |

## 5. Những điều hệ thống đã bảo đảm (không cần quyết định)

- Âm/vần đơn lẻ **luôn** là bản ghi giáo viên, không đi qua TTS.
- Giọng máy **không đọc hộ** chữ/từ/câu mà bài đang kiểm tra khả năng tự đọc; đọc mẫu chỉ sau khi câu đã đóng.
- Lời đọc chưa duyệt không được sinh; tệp chưa duyệt, tệp mock, tệp bị thu hồi hoặc không khớp nội dung đã duyệt không được phát.
- Đổi chữ, giọng, tốc độ hay nhà cung cấp tạo **phiên bản mới**, không sửa tệp đã duyệt.
- Không dữ liệu học sinh trong lời đọc; không TTS khi học sinh mở bài; trình duyệt học sinh không gọi nhà cung cấp.
