# ReadMate AI — RLS và bảo mật cơ sở dữ liệu (R03)

> **Trạng thái (2026-10-20):** hiện thực ở `supabase/migrations/20261020090000_r03_foundation.sql`, `…090100_r03_functions.sql`, `…090200_r03_signup_guard.sql`; kiểm thử thật trên Supabase local (pgTAP 36 + tích hợp 78 + E2E). Ma trận thiết kế gốc: [DATA_MODEL §7](DATA_MODEL.md#7-ma-trận-phân-quyền-rls), [REDESIGN_ARCHITECTURE §8](REDESIGN_ARCHITECTURE.md#8-phân-quyền-và-rls).

## 1. Mô hình

- **RLS bật cho mọi bảng** của schema `public` (pgTAP kiểm theo catalog — bảng thêm sau cũng bị bắt).
- **Chỉ có policy SELECT.** Không bảng nào có policy INSERT/UPDATE/DELETE → không ai ghi trực tiếp qua API.
- **Đường ghi duy nhất là hàm:**
  - `teacher_*` (security definer, `search_path = ''`, GRANT cho `authenticated`) — tự kiểm tra `auth.uid()` là GV đang hoạt động của lớp (owner cho cấu hình lớp); ghi `audit_logs` trong cùng giao dịch.
  - `gateway_*` (GRANT **chỉ** `service_role`) — student gateway trên máy chủ, sau khi máy chủ xác minh phiên thiết bị; học sinh không ghi trực tiếp (CLAUDE.md §6.3).
- **GRANT tường minh** (`auto_expose_new_tables = false`): `anon` không có quyền gì; `authenticated` chỉ SELECT; cột HMAC thẻ học bị loại khỏi quyền SELECT theo cột; `rate_limit_buckets` chỉ `service_role`.
- Hàm trợ giúp ở schema `private` (không lộ qua Data API): `my_class_ids()`, `my_owned_class_ids()`, `my_student_ids()` (liên kết chưa thu hồi + hồ sơ `active` + lớp `active`), `my_student_class_ids()`, `is_active_staff()`, `is_admin()`, `consent_active()`.
- **Khóa ngoại kép** `(student_id, class_id) → students(id, class_id)` trên mọi bảng dữ liệu học sinh: `class_id` phi chuẩn hóa không thể lệch lớp thật.

## 2. Ma trận R03 (đã kiểm thử)

R = đọc qua RLS · F = chỉ qua hàm · — = không.

| Bảng | GV (lớp mình) | Thiết bị HS | Ẩn danh chưa liên kết / khách |
|---|---|---|---|
| `schools` | R (trường mình) | — | — |
| `staff_profiles` | R (mình + đồng nghiệp cùng lớp) | — | — |
| `classes` | R; F đổi tên/tiến độ (owner) | R (lớp của mình) | — |
| `class_staff` | R | — | — |
| `students` | R; F tạo/sửa/trạng thái/alias | R **chỉ hồ sơ đã liên kết**; F (gateway) avatar + cài đặt | — |
| `student_band_assignments` | R; F | **—** (không bao giờ thấy nhóm) | — |
| `student_login_codes` | R (trừ cột HMAC); F cấp/thu hồi | — | — |
| `student_devices` | R; F thu hồi | R (liên kết của chính thiết bị) | — |
| `guardian_consents` | R; F ghi nhận/rút | — | — |
| `seasons` | R (không sửa được) | R (mùa của lớp mình) | — |
| `audit_logs` | R (chỉ **owner**) | — | — |
| `content_releases`, `curriculum_*`, `kb_units` | R (mọi GV đang hoạt động) | — | — |
| `rate_limit_buckets` | — | — | — (chỉ máy chủ) |

## 3. Bất biến do CSDL bảo đảm

| Bất biến | Cơ chế |
|---|---|
| Bảng xếp hạng/vinh danh không bật được khi chưa có chấp thuận | Trigger `guard_class` + cờ `private.feature_flags` (mặc định tắt, chỉ đổi bằng migration) |
| Tiến độ chuỗi minh họa không xác nhận được | Trigger: `confirmed` chỉ với `series_kind = textbook` + `approved`; bài phải thuộc bộ |
| "Đã duyệt" phải có người duyệt, ngày, băm | `check` trên `curriculum_series`, `kb_units` |
| Đúng một mùa đang diễn ra mỗi lớp | Unique một phần; mùa 1 tạo bằng trigger cùng lớp; `rules_version` = `SCORING_RULES_VERSION` (kiểm thử) |
| Bản ghi đồng ý là chứng từ | Chỉ `granted → withdrawn`, không sửa nội dung, một bản ghi còn hiệu lực mỗi phạm vi |
| Ghi nhận đồng ý cần xác nhận của GV | `p_attested` bắt buộc `true` |
| Nhật ký chỉ ghi thêm | Trigger chặn UPDATE/DELETE |
| Thiết bị là ẩn danh, GV không ẩn danh | Trigger trên `student_devices`, `staff_profiles` |
| Không chuyển học sinh sang lớp khác | Trigger `guard_student` |
| Đổi tên hiển thị → phải duyệt lại | Trigger `guard_student` |
| Văn bản sạch | `private.is_clean_text`: NFC, cắt khoảng trắng, chặn ký tự điều khiển và ký tự ẩn (U+00AD, U+200B–U+200F, U+2028–U+202E, U+2060–U+2064, U+FEFF); biệt danh/alias không trùng trong lớp (không phân biệt hoa thường, kể cả chữ có dấu) |
| Không đăng ký tự do | Auth Hook `private.hook_before_user_created` |

## 4. Kiểm thử

| Tệp | Nội dung |
|---|---|
| `supabase/tests/database/01_schema_security.test.sql` | RLS mọi bảng; không policy ghi; `anon` 0 quyền; `authenticated` chỉ SELECT; cột HMAC; `anon` không chạy được hàm nào; `gateway_*` chỉ service_role; mọi hàm definer cố định `search_path`; chỉ hai nhóm hàm public; cờ hệ thống tắt |
| `supabase/tests/database/02_constraints.test.sql` | Các bất biến §3 |
| `tests/db/rls.test.ts` | Ma trận §2 bằng JWT thật: khách, ẩn danh chưa liên kết, thiết bị A1, thiết bị bị thu hồi, tạm ngưng, GV A vs lớp B, co_teacher, GV bị vô hiệu hóa, nhật ký không chứa biệt danh |
| `tests/db/login-codes.test.ts` | Vòng đời thẻ học, tách miền HMAC, đồng thời, dùng lại, phạm vi, khôi phục, giới hạn tần suất |
| `tests/db/auth-consent.test.ts` | Đăng nhập đúng/sai, không tự đăng ký, đăng xuất, JWT hết hạn/giả mạo → 401, đồng ý hai phạm vi, mùa, cờ, tiến độ, alias |
| `tests/e2e-db/accounts.spec.ts` | Luồng trình duyệt thật |

## 5. Khi thêm bảng mới (R04+)

1. `alter table … enable row level security;` — pgTAP sẽ báo nếu quên.
2. Chỉ policy SELECT; ghi qua hàm `teacher_*`/`gateway_*` (hoặc nhóm mới có lý do + cập nhật pgTAP §10).
3. `revoke all … from anon, authenticated` rồi GRANT tối thiểu; hàm mới: `revoke execute … from public, anon, authenticated` rồi GRANT đúng vai trò.
4. Hàm security definer luôn `set search_path = ''`.
5. Thêm kiểm thử tích hợp cho ma trận quyền của bảng trong **cùng** thay đổi (CLAUDE.md §6.2).

## R06.3 — `season_resets`

RLS bật, chỉ policy SELECT (GV của lớp), không GRANT ghi; bất biến bằng trigger `block_direct_change`. Ghi chỉ qua `private.reset_class_season` (không cấp cho client) do `teacher_reset_season` gọi; hàm kiểm tra owner bằng `auth.uid()`. pgTAP `06_season_reset`, tích hợp `tests/db/season-reset.test.ts`.
