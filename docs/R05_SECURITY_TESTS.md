# ReadMate AI — Kiểm thử bảo mật và quyền riêng tư của R05

> **Trạng thái:** đã chạy trên Supabase **LOCAL** (không Cloud, không production). Tài liệu liên quan: [LEADERBOARD_API.md](LEADERBOARD_API.md) · [RANKING_ENGINE.md](RANKING_ENGINE.md) · [PRIVACY_AND_SECURITY §5](PRIVACY_AND_SECURITY.md) · [RLS_SECURITY.md](RLS_SECURITY.md)

## 1. Phạm vi

Bảng xếp hạng điểm thưởng trong phạm vi lớp: hàm CSDL (`private.leaderboard_rows`, `gateway_class_leaderboard`, `teacher_set_leaderboard_settings`, `teacher_leaderboard_overview`, `teacher_leaderboard_display`), `GET /api/student/leaderboard`, Server Action `saveLeaderboardSettings`, ba màn hình (học sinh, GV, trình chiếu), cờ hệ thống `leaderboard_feature_approved`, avatar. Không gồm vinh danh/reset (R06).

## 2. Vai trò và quyền

| Vai trò | Được | Không được |
|---|---|---|
| Học sinh (thiết bị liên kết) | Xem bảng **lớp mình** khi cờ hệ thống + cờ lớp bật; xem điểm của mình; chọn avatar của mình | Bật/tắt bảng; xem lớp khác; xem học sinh bị ẩn; đổi điểm; đổi cờ |
| GV chủ nhiệm (`owner`) | Bật/tắt bảng, chọn kiểu hiển thị (`teacher_set_leaderboard_settings`); xem bảng nội bộ; trình chiếu | Bật khi cờ hệ thống tắt; chạm lớp khác |
| GV cùng dạy (`co_teacher`) | Xem bảng nội bộ + trình chiếu của lớp mình | Đổi cài đặt (FORBIDDEN) |
| GV lớp khác | Không gì cả (RLS/hàm → FORBIDDEN, trang → "Không tìm thấy") | — |
| Khách / thiết bị chưa liên kết / thiết bị bị thu hồi | Không gì cả (401/FORBIDDEN) | — |
| Quản trị CSDL | Đổi cờ hệ thống bằng migration | (ngoài ứng dụng) |

## 3. Ma trận truy cập hai lớp (kiểm thử tích hợp `tests/db/leaderboard.test.ts`, E2E `tests/e2e-db/leaderboard.spec.ts`)

| Hành động | Lớp C (GV A) | Lớp D (GV B) |
|---|---|---|
| HS lớp C xem bảng | chỉ hàng lớp C ✅ | không có hàng lớp D ✅ |
| HS lớp D xem bảng | không có hàng lớp C ✅ | chỉ hàng lớp D ✅ |
| Thiết bị C dùng hồ sơ HS lớp D | FORBIDDEN / HTTP 403 ✅ | — |
| GV B gọi overview/display/settings lớp C | FORBIDDEN ✅ (trang: "Không tìm thấy trang", không lộ tên lớp) | — |
| HS gọi hàm `teacher_*` | FORBIDDEN ✅ | — |
| HS đọc `season_scores` của bạn qua REST | 0 dòng ✅ (RLS chỉ dòng của mình) | — |
| HS `UPDATE classes.leaderboard_enabled` | 0 dòng, không đổi ✅ | — |
| Khách `GET /api/student/leaderboard` | 401, không lộ tên ✅ | — |

## 4. Điều kiện hiển thị học sinh

`private.leaderboard_rows` yêu cầu **cả sáu**: lớp active · mùa active · hồ sơ active · đồng ý `learning_data` · đồng ý `leaderboard_display` · tên hiển thị đã duyệt. Đã kiểm thử bằng dữ liệu thật: thiếu đồng ý hiển thị / tên chưa duyệt / chưa có tên / thiếu đồng ý dữ liệu học tập / hồ sơ tạm ngưng / đồng ý đã rút ⇒ **không có hàng, tên không xuất hiện trong JSON**. Đối soát: bản TypeScript (`eligibilityBlockers`) và CSDL cho cùng kết luận với mọi học sinh của lớp thử.

- Rút `leaderboard_display` ⇒ biến mất ở **request kế tiếp**, điểm cá nhân còn nguyên; cấp lại ⇒ xuất hiện lại.
- Đổi tên hiển thị ⇒ trigger xóa trạng thái duyệt ⇒ biến mất tới khi GV duyệt lại.
- Học sinh không đủ điều kiện **vẫn học, tích điểm, thấy điểm mình**; bảng nói trung tính "Tên của con chưa hiện trên bảng" (không nêu lý do hay số bạn bị ẩn).

## 5. Điều kiện bật bảng

1. Cờ hệ thống `leaderboard_feature_approved` (xem §8) **bật** — nếu tắt, `teacher_set_leaderboard_settings(enabled=true)` ⇒ `LEADERBOARD_NOT_APPROVED` (trigger `classes_guard`).
2. Người gọi là GV **chủ nhiệm** của lớp (`require_class_staff(.., true)`).
3. Giá trị hợp lệ (`top10_and_me` | `full`), lớp không lưu trữ.
4. Mỗi lần **đọc**, CSDL kiểm tra lại cả hai cờ: rút cờ hệ thống ⇒ bảng đã bật cũng trả `{status:"disabled"}` ngay (đã kiểm thử); GV tắt bảng khi học sinh đang xem ⇒ lần làm mới kế tiếp không còn hàng (E2E).
5. Mỗi lần đổi cài đặt ghi `audit_logs('leaderboard.configure')` (UUID, không tên học sinh).

## 6. Dữ liệu trình chiếu

`teacher_leaderboard_display` là hàm riêng: chỉ học sinh đủ điều kiện, trả `alias/avatar/points` (không `student_id`, `balance` của học sinh ẩn, đồng ý, điểm tích lũy); lỗi `LEADERBOARD_DISABLED` khi bảng tắt. Trang trình chiếu không dùng `teacher_leaderboard_overview`. Đã kiểm thử: bạn không đủ điều kiện **không** có trong DOM, trong HTML do máy chủ trả về (`request.get`), hay trong JSON; layout riêng không thanh bên.

## 7. Thử tấn công

| Thử | Kết quả |
|---|---|
| Thêm tham số `classId` vào `GET /leaderboard` | 400 INVALID_INPUT |
| `POST /leaderboard` với `{points: 999}` | 405 (không có route ghi) |
| `studentId` của lớp khác | 403, không lộ tên |
| Ghi trực tiếp `classes.leaderboard_enabled` bằng JWT học sinh/GV | 0 dòng; không đổi |
| Học sinh/GV/khách đọc hoặc ghi `private.feature_flags` qua API | lỗi (schema `private` không lộ) |
| Gọi `gateway_class_leaderboard` bằng JWT thiết bị | bị chặn (chỉ service_role) |
| Gọi `private.leaderboard_rows` bằng authenticated/anon | không có quyền EXECUTE (pgTAP) |
| Quét phản hồi API tìm `student_id/class_id/auth_user_id/earned/deducted/band` | không có |
| HTML ban đầu của `/learn/leaderboard` | không chứa tên/điểm bạn nào (bảng tải qua API) |
| `localStorage/sessionStorage` | rỗng |

## 8. Cờ hệ thống (RD-R05-01)

Kiểm tra theo yêu cầu của người điều phối:

1. **Mặc định false** — migration R03 chèn `false`; unit test quét mọi migration (không có `update … set enabled = true`); pgTAP "mọi cờ hệ thống mặc định tắt" (bắt được rò khi một lần chạy bị dừng giữa chừng — đã xảy ra một lần và pgTAP phát hiện đúng).
2. **Chỉ quản trị CSDL đổi được** — `revoke all` trên bảng; pgTAP: anon/authenticated không SELECT/INSERT/UPDATE; không hàm `public` nào ghi vào bảng; chỉ migration/`supabase db query` có quyền.
3. **GV không tự bật** — `teacher_set_leaderboard_settings` ⇒ `LEADERBOARD_NOT_APPROVED`; REST vào `private.feature_flags` lỗi.
4. **Học sinh không đổi được** — như trên (kiểm thử tích hợp với JWT thiết bị).
5. **Fixture local không bật nhầm production** — `setLocalLeaderboardApproval` chỉ gọi `supabase db query --local` (unit test kiểm tra không có `--db-url/--linked/DATABASE_URL`); chỉ được import từ `tests/` và `scripts/`.
6. **Không API công khai đổi cờ** — unit test quét `src/`: không mã nào đọc/ghi `feature_flags`, không biến môi trường liên quan.
7. **Sau kiểm thử trả về false** — `afterAll`/`globalTeardown` đặt `false`; đã xác minh bằng truy vấn sau mỗi đợt.

## 9. Avatar

Danh mục có khóa ổn định trong mã (`AVATAR_KEYS`, 16 mẫu); Server Action chọn avatar dùng `z.enum` ⇒ khóa lạ bị từ chối; hồ sơ lấy từ thiết bị (không tin `student_id` từ client) ⇒ không đổi được avatar tài khoản khác; không có đường tải ảnh; 16 dòng giấy phép (`licenses.json`), tất cả `pending_review`. Đổi nhãn "Bạn tóc xoăn nhỏ" → "Bạn tóc bồng" **không** đổi khóa `oi`.

## 10. Kết quả chạy (Supabase LOCAL, 2026-10-21)

| Nhóm | Kết quả |
|---|---|
| pgTAP | **65/65** (62 + 3 kiểm tra cờ; có kiểm tra `04_leaderboard`) |
| Tích hợp CSDL (`test:db`) | **129/129** (5 tệp) |
| Unit (`test:run`) | **952/952** (gồm `ranking`, `leaderboard-ui`, `leaderboard-flag-safety`) |
| E2E CSDL, theo project (1 worker) | chromium-desktop 22 đạt/1 bỏ qua · chromium-mobile 15/8 · webkit-mobile 15/8 · webkit-ipad 4/0 |

(Chi tiết toàn bộ lượt chạy cuối: xem [REDESIGN_PROGRESS §6](../REDESIGN_PROGRESS.md).)

## 10b. Xác nhận trên GitHub Actions (2026-10-21)

Các kiểm thử bảo mật ở trên (cách ly lớp, cờ hệ thống tắt, DTO không định danh, đồng ý, thu hồi thiết bị, GV lớp khác) nằm trong tích hợp CSDL **129/129**, pgTAP **65/65**, unit **952/952**, E2E database 4 project và quét bundle — tất cả PASS trên commit `83b34a7` ([CI](https://github.com/ThaiTaka/ReadMateAI/actions/runs/39514016955), [E2E](https://github.com/ThaiTaka/ReadMateAI/actions/runs/39514016837)). Mã sản phẩm của R05 không đổi sau `628bf64`; chỉ sửa test (xem REDESIGN_PROGRESS §5b).

## 11. Rủi ro còn lại

- **Chưa có chấp thuận pháp lý/nhà trường** (Luật 91/2025 Điều 24, RQ-01, RQ-P1–P3) ⇒ cờ hệ thống giữ tắt; chưa dùng với trẻ thật.
- Chưa kiểm thử trên Supabase Cloud/Vercel; cấu hình Dashboard chưa kiểm chứng.
- Chưa thử trên điện thoại thật (chỉ giả lập Playwright).
- Một lần chạy bị dừng giữa chừng có thể để cờ local ở `true` ⇒ pgTAP sẽ báo; xử lý: `npm run test:db` (afterAll trả về tắt) hoặc truy vấn local trực tiếp.
- Avatar `pending_review`; bảng không thời gian thực; chưa giới hạn kích thước lớp (>~60 học sinh cần phân trang).
