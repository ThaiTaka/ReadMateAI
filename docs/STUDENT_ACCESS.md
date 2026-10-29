# ReadMate AI — Truy cập của học sinh: thẻ học + liên kết thiết bị (R03)

> **Trạng thái (2026-10-20):** POC AD-05 **đã hiện thực và kiểm thử** trên Supabase local (tích hợp CSDL + E2E Android/iPhone giả lập). Chưa thử trên điện thoại thật, chưa có Turnstile, chưa dùng với học sinh thật.
> **Liên quan:** [AUTHENTICATION.md](AUTHENTICATION.md) · [RLS_SECURITY.md](RLS_SECURITY.md) · [ARCHITECTURE §8.2](ARCHITECTURE.md#82-luồng-liên-kết-thiết-bị-học-sinh)

## 1. Nguyên tắc

Trẻ 6–7 tuổi không nhớ mật khẩu, không có email. Phụ huynh dùng **thẻ học cá nhân** do GV cấp để liên kết thiết bị ở nhà. Không có mã lớp chung. Không thu thập gì ngoài biệt danh, số thứ tự, avatar có sẵn.

## 2. Thẻ học

| Thành phần | Thiết kế |
|---|---|
| Mã QR | 32 byte ngẫu nhiên (base64url, 43 ký tự) trong **fragment** `…/join#c=<mã>` → không vào log máy chủ, không vào Referer (`/join` đặt `Referrer-Policy: no-referrer`). Trang đọc fragment rồi **xóa khỏi thanh địa chỉ** trước khi gửi |
| Mã dự phòng | 8 ký tự Crockford Base32 (≈ 40 bit), in `ABCD-EFGH`; gõ thường/không gạch/O↔0/I,L↔1 vẫn nhận |
| Lưu trữ | Chỉ `HMAC-SHA256(LOGIN_CODE_PEPPER, "readmate.login-code.v1:<loại>:<mã>")` 32 byte; tách miền QR/dự phòng. GV không đọc được cột HMAC (quyền theo cột) |
| Hiển thị | Mã gốc chỉ có trong phản hồi lúc cấp — GV in thẻ ngay; không xem lại được |
| Hạn dùng | GV chọn 1/7/14/30 ngày (CSDL chấp nhận 1 giờ – 90 ngày) |
| Số thiết bị | GV chọn 1–5 (mặc định 3: bố, mẹ, máy tính bảng); hết lượt → mã không dùng được |
| Cấp lại | Cấp thẻ mới **thu hồi thẻ cũ** trong cùng giao dịch (`revoke_reason = reissued`) |

## 3. Luồng liên kết (`/join` → Server Action `joinWithCode`)

1. Kiểm tra định dạng ở máy chủ (sai → lỗi ngay, không gọi CSDL).
2. Giới hạn tần suất: 10 lần/15 phút theo IP (HMAC) + 300 lần/giờ toàn hệ thống.
3. Trình duyệt đang đăng nhập GV → từ chối (không thay phiên GV).
4. `gateway_check_login_code` (service_role, không thay đổi gì) → không dùng được → **một thông báo chung** "Mã chưa đúng hoặc đã hết hạn…" (không phân biệt sai/hết hạn/thu hồi/hết lượt; không lộ thông tin học sinh).
5. Chưa có phiên → `signInAnonymously()` ở máy chủ (cookie httpOnly). Mã sai không tạo người dùng ẩn danh.
6. `gateway_redeem_login_code` — **một giao dịch, khóa dòng mã** (`FOR UPDATE`): kiểm tra lại, tạo `student_devices`, tăng `devices_linked`, ghi `audit_logs` (`device.link`, không chứa mã). Cùng thiết bị gửi lặp → `already_linked`, không tốn lượt.
7. Chuyển tới `/learn/me` (đọc hồ sơ bằng JWT thiết bị → RLS `my_student_ids()`).

Không ghi log giá trị mã ở bất kỳ đâu.

## 4. Thu hồi và khôi phục

| Tình huống | Cơ chế | Hiệu lực |
|---|---|---|
| GV thu hồi một thiết bị | `teacher_revoke_device` | Ngay ở truy vấn kế tiếp (RLS lọc `revoked_at`) — kiểm thử cùng phiên |
| GV thu hồi thẻ | `teacher_revoke_login_code` | Thẻ không liên kết thêm được; thiết bị đã liên kết giữ nguyên (thu hồi riêng nếu cần) |
| Tạm ngưng hồ sơ | `status = paused` | Mọi thiết bị mất quyền ngay; mở lại → vào lại được |
| Lưu trữ hồ sơ | `status = archived` | Thu hồi hẳn mọi thiết bị + thẻ |
| Phụ huynh rút đồng ý `learning_data` | `teacher_withdraw_consent` | Thu hồi mọi thiết bị + thẻ trong cùng giao dịch |
| Đổi/mất điện thoại | GV cấp thẻ mới → liên kết máy mới; thu hồi máy cũ trong danh sách thiết bị | |
| Xóa dữ liệu trình duyệt | Mất cookie ẩn danh → liên kết lại bằng thẻ (thẻ còn hạn và còn lượt) hoặc thẻ mới | |
| Anh/chị/em dùng chung máy | Một thiết bị liên kết nhiều hồ sơ; `/learn/me` cho chọn "Con là bạn nào?" | |

`/learn/me` có nút "Đăng xuất khỏi thiết bị này" (xóa phiên ở trình duyệt); liên kết còn lại do GV thu hồi.

## 5. Đánh giá Supabase Anonymous Auth (POC AD-05)

| Yêu cầu | Kết quả kiểm thử (Supabase local, CLI 2.121) |
|---|---|
| Ẩn danh chưa liên kết không đọc được hồ sơ | ✅ mọi bảng rỗng (`tests/db/rls.test.ts`) |
| Chỉ liên kết được với mã hợp lệ | ✅ sai/hết hạn/thu hồi/hết lượt/hồ sơ lưu trữ → `invalid` |
| Mã của A không mở được B | ✅ |
| Thu hồi thiết bị mất quyền | ✅ ngay ở truy vấn kế tiếp |
| Không truy cập lớp khác | ✅ |
| Nhiều yêu cầu đồng thời | ✅ 6 thiết bị cùng lúc với mã 1 lượt → đúng 1 liên kết |
| Giới hạn nhập sai | ✅ lần thứ 11/15 phút bị chặn |
| Thiết bị không thể là GV và ngược lại | ✅ trigger CSDL |
| Luồng thật trên trình duyệt | ✅ E2E: Pixel 7 (Chromium) mở liên kết QR, iPhone 13 (WebKit) nhập mã dự phòng, GV thu hồi → cả hai mất quyền |

**Giới hạn đã biết:**

- `signInAnonymously` chạy ở máy chủ → giới hạn "anonymous users / giờ / IP" của Supabase áp lên **IP máy chủ** (mặc định Cloud 30/giờ) → buổi phát thẻ cả lớp cùng lúc có thể chạm hạn mức; cần nâng hạn mức ở Dashboard và bật CAPTCHA (Turnstile) trước production.
- Người dùng ẩn danh không liên kết thành công (hiếm — chỉ khi mã bị dùng hết giữa bước 4 và 6) và thiết bị đã thu hồi chưa được dọn tự động (cron dọn dẹp: R11).
- Chưa thử trên điện thoại Android/iPhone thật (chỉ giả lập Playwright) và chưa thử máy quét QR của camera thật.
- Avatar trong bộ hiện có vẫn `pending_review` (chờ GV duyệt — RQ-M1).
