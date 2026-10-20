# ReadMate AI — Xác thực và phân quyền (R03)

> **Trạng thái (2026-10-20):** đã hiện thực và kiểm thử trên **Supabase local**. Chưa có dự án Cloud, chưa deploy. Không dùng cho học sinh thật cho tới khi xong danh mục [PRIVACY_AND_SECURITY §12](PRIVACY_AND_SECURITY.md#12-danh-mục-kiểm-tra-trước-khi-bật-cho-học-sinh-thật).
> **Liên quan:** [STUDENT_ACCESS.md](STUDENT_ACCESS.md) (thẻ học, thiết bị) · [RLS_SECURITY.md](RLS_SECURITY.md) · [SUPABASE_SETUP.md](SUPABASE_SETUP.md)

## 1. Vai trò

| Vai trò | Danh tính | Vào được |
|---|---|---|
| Giáo viên (`staff_profiles.role = teacher`, `is_active`) | Supabase Auth email/mật khẩu | `/teacher/**` — chỉ lớp có trong `class_staff` (owner hoặc co_teacher) |
| Quản trị (`role = admin`) | như trên | đọc mọi lớp qua RLS (chưa có giao diện riêng ở R03) |
| Thiết bị học sinh | Người dùng **ẩn danh** của Supabase + dòng `student_devices` còn hiệu lực | `/learn/me` — chỉ hồ sơ đã liên kết |
| Khách / ẩn danh chưa liên kết | không phiên / phiên ẩn danh không liên kết | trang công khai, `/demo`, `/learn` (minh họa), `/join`, `/login` |

## 2. Đăng nhập giáo viên

- Route `/login` (Server Action `signInTeacher`, `src/server/auth/actions.ts`): zod → **giới hạn tần suất** (10 lần/15 phút theo IP, 5 lần/15 phút theo email; khóa là HMAC, không lưu IP/email thô) → `signInWithPassword` → kiểm tra có `staff_profiles` đang hoạt động, nếu không thì đăng xuất ngay và báo "không phải tài khoản giáo viên".
- Thông báo lỗi chung "Email hoặc mật khẩu chưa đúng." — không tiết lộ email có tồn tại.
- `next` chỉ được chấp nhận khi bắt đầu bằng `/teacher` (chặn chuyển hướng mở).
- **Không tự đăng ký**: Auth Hook `before_user_created` trả 403 cho mọi đăng ký công khai không ẩn danh (migration `20261020090200`). Tài khoản GV chỉ tạo bằng Admin API (khóa secret): script quản trị / Dashboard. Ở R03 chỉ có script tạo **GV giả** (`npm run db:seed`); quy trình cấp tài khoản thật cần quản trị viên của trường (chưa có giao diện quản trị — đề xuất R11).
- Mật khẩu: ≥ 10 ký tự, có chữ hoa, chữ thường, số (`config.toml`). Không lưu mật khẩu ở localStorage; chỉ gửi qua POST tới Server Action.

## 3. Phiên

- Cookie phiên do `@supabase/ssr` ghi, **httpOnly**, SameSite=Lax, Secure (trừ máy dev http localhost) — `src/lib/supabase/cookie-options.ts`. JavaScript của trang không đọc được token.
- **Không có client Supabase ở trình duyệt**: mọi lời gọi đi qua máy chủ → CSP `connect-src 'self'` giữ nguyên, bundle không chứa URL/khóa Supabase (đã kiểm bằng `npm run check:bundle`).
- `src/proxy.ts` (Next 16): làm mới phiên bằng `getClaims()` cho `/teacher/**`, `/learn/**`, `/join`, `/login`; chưa đăng nhập/thiết bị học sinh vào `/teacher` → `/login?reason=…&next=…` (`Cache-Control: private, no-store`).
- Phiên hết hạn: cookie còn nhưng JWT không xác minh được → `reason=expired` ("Phiên đăng nhập đã hết hạn").
- Đăng xuất: `signOut({ scope: "local" })` thu hồi refresh token của phiên này và xóa cookie (kiểm thử: refresh token cũ không dùng lại được).

## 4. Ba lớp kiểm tra quyền

1. **Proxy** — chỉ chuyển hướng thô (không phải phân quyền).
2. **DAL** `src/server/auth/teacher.ts` — `getTeacherSession()`/`requireTeacher()` trong mọi trang và Server Action: `getClaims()` (chữ ký JWT) → không ẩn danh → `staff_profiles.is_active` (đọc qua RLS). GV bị vô hiệu hóa mất quyền ngay ở request kế tiếp.
3. **CSDL** — RLS (chỉ policy SELECT) + hàm `teacher_*` (security definer) tự kiểm tra `auth.uid()` thuộc `class_staff` của lớp; chủ nhiệm (`owner`) cho thao tác cấu hình lớp. Xem [RLS_SECURITY.md](RLS_SECURITY.md).

Server Action luôn: xác thực → zod → gọi hàm CSDL bằng JWT của GV → kết quả `{ status: "ok" } | { status: "error", code }`; mã lỗi ánh xạ sang câu chữ ở `vi.errors` (không lộ lỗi kỹ thuật).

## 5. Cache Components (Next 16.4)

Đọc phiên là dữ liệu theo request: trang GV đặt phần đọc phiên trong `<Suspense>`; DAL gọi `await connection()` trước `getClaims()` vì supabase-js dùng `Date.now()` (không được nằm trong bản dựng trước của Partial Prefetching). Trang GV là Partial Prerender (◐): khung tĩnh không chứa dữ liệu, dữ liệu stream sau xác thực. Hệ quả: lớp/học sinh không thuộc quyền hiển thị "Không tìm thấy trang" nhưng mã HTTP là 200 (đặc điểm của streaming).

## 6. Chưa làm / giới hạn

- Quên mật khẩu, đổi mật khẩu, MFA cho GV (SMTP riêng cần cho production — ARCHITECTURE §8.1).
- Giao diện quản trị cấp tài khoản GV, mời GV cùng dạy (co_teacher) — hiện chỉ qua script/Dashboard.
- Giới hạn tần suất của Supabase Auth tính theo **IP máy chủ** (mọi đăng nhập đi qua server) — Cloud cần chỉnh hạn mức phù hợp; giới hạn của ứng dụng tính theo IP người dùng (`x-forwarded-for` của Vercel).
- Một trình duyệt chỉ giữ một phiên: GV đăng nhập trên máy đã liên kết thẻ học sẽ thay phiên thiết bị (trang `/login` có cảnh báo `reason=student_device`); `/join` từ chối khi đang có phiên GV.
