# ReadMate AI — Leaderboard API và hàm CSDL (R05)

> **Trạng thái: ĐÃ HIỆN THỰC (R05, Supabase LOCAL).** Migration: `supabase/migrations/20261022090000_r05_leaderboard.sql`. Mã: `src/app/api/student/leaderboard/route.ts`, `src/server/leaderboard/{student,teacher}.ts`, `src/features/leaderboard/{types,build}.ts`, `src/server/teacher/actions.ts` (`saveLeaderboardSettings`).
> Tài liệu liên quan: [RANKING_ENGINE.md](RANKING_ENGINE.md) · [LEADERBOARD_SPEC §10](LEADERBOARD_SPEC.md#10-dữ-liệu-trả-về-và-bảo-mật) · [PRIVACY_AND_SECURITY §5](PRIVACY_AND_SECURITY.md) · [RLS_SECURITY.md](RLS_SECURITY.md)

## 1. `GET /api/student/leaderboard`

Bảng điểm của lớp **của chính học sinh**.

| Mục | Giá trị |
|---|---|
| Query | `studentId` (tùy chọn, khóa tra cứu — phải thuộc danh sách RLS của thiết bị; thiết bị một hồ sơ thì bỏ qua được). **Mọi tham số khác** (`classId`, `seasonId`, `points`…) ⇒ `400 INVALID_INPUT` (zod `strictObject`) |
| Phương thức | Chỉ `GET` (`POST`… ⇒ 405) |
| Giới hạn | 120 lần/phút/thiết bị (`STUDENT_RATE_LIMITS.read`) |
| Phản hồi | `{ ok: true, data: LeaderboardDto }` hoặc `{ ok: false, code }`; luôn `Cache-Control: private, no-store`, `X-Content-Type-Options: nosniff` |
| Mã lỗi | `401 UNAUTHENTICATED` (khách/chưa liên kết/thiết bị bị thu hồi) · `403 FORBIDDEN` (hồ sơ không thuộc thiết bị) · `400 INVALID_INPUT` · `429 RATE_LIMITED` · `503 NOT_CONFIGURED` |

### Quy trình ở server

1. `getDeviceSession()` — `getClaims()` (JWT đã xác minh), danh sách học sinh theo **RLS của chính thiết bị** (liên kết còn hiệu lực, hồ sơ/lớp đang hoạt động).
2. Giới hạn tần suất → zod → `pickStudent` (hồ sơ phải thuộc thiết bị).
3. `admin.rpc("gateway_class_leaderboard", { p_auth_user_id, p_student_id })` (service_role) — **lớp được suy ra trong CSDL** (`private.require_linked_device`), không bao giờ nhận `class_id` từ trình duyệt.
4. CSDL kiểm tra **hai cờ**: `private.feature_flags('leaderboard_feature_approved')` (cấp hệ thống) **và** `classes.leaderboard_enabled`; tắt ⇒ trả đúng `{status:"disabled"}`, **không** kèm tên mùa/hàng nào. Không có mùa đang diễn ra ⇒ `{status:"no_season"}`.
5. `private.leaderboard_rows` lọc học sinh đủ điều kiện (xem [RANKING_ENGINE §6](RANKING_ENGINE.md)); kết quả jsonb **không có** `student_id`.
6. `build.ts`: zod kiểm tra ranh giới JSON → `rankScores` → `selectVisibleRows` (TOP 10 + con hoặc cả lớp) → DTO.

### DTO

```ts
type LeaderboardRowDto = {
  rowKey: string;   // băm một chiều của (số mùa, tên hiển thị) — KHÔNG phải mã học sinh
  rank: number;
  alias: string;    // tên hiển thị đã duyệt (NFC, ≤ 20 ký tự)
  avatarKey: string;
  points: number;   // season_scores.balance
  isMe: boolean;
};
type LeaderboardDto =
  | { status: "ok"; view: "top10_and_me" | "full"; seasonNo: number; maxPoints: number;
      rows: LeaderboardRowDto[]; myRow: LeaderboardRowDto | null; viewerListed: boolean; generatedAt: string }
  | { status: "disabled" }
  | { status: "no_season" };
```

**Không bao giờ có:** `student_id`, `class_id`, `auth_user_id`, email/điện thoại/ngày sinh, nhóm năng lực, mức hỗ trợ, lịch sử trả lời sai, `earned_total`/`deducted_total`, thời điểm đạt điểm, dữ liệu phụ huynh, danh sách hay số lượng học sinh chưa đồng ý hiển thị. `viewerListed` chỉ nói về **chính em** (em có hàng trên bảng không) để giao diện hiện lời nhắn trung tính. Kiểm thử: unit (`tests/unit/gamification/ranking.test.ts` — quét khóa cấm trong JSON), tích hợp và E2E (quét phản hồi thật).

## 2. Hàm CSDL (tất cả `security definer`, `search_path = ''`, quyền thực thi tường minh)

| Hàm | Ai gọi | Việc |
|---|---|---|
| `private.leaderboard_rows(class)` | chỉ các hàm bên dưới (service_role) | Lọc học sinh đủ điều kiện + điểm hiện tại. **Một nơi duy nhất** quyết định ai lên bảng |
| `gateway_class_leaderboard(auth_user, student)` | service_role (route handler) | Dữ liệu bảng của lớp học sinh; kiểm tra thiết bị liên kết + hai cờ |
| `teacher_set_leaderboard_settings(class, enabled, view)` | GV **chủ nhiệm** (JWT) | Bật/tắt bảng + kiểu hiển thị; ghi `audit_logs('leaderboard.configure')`; trigger `guard_class` chặn bật khi cờ hệ thống tắt (`LEADERBOARD_NOT_APPROVED`) |
| `teacher_leaderboard_overview(class)` | GV của lớp | Bảng nội bộ + đối soát (điểm tích lũy, đồng ý, tên hiển thị, `eligible`) — chỉ màn hình quản trị |
| `teacher_leaderboard_display(class)` | GV của lớp | Dữ liệu **trình chiếu**: chỉ học sinh đủ điều kiện, không mã định danh; lỗi `LEADERBOARD_DISABLED` khi bảng tắt |

Frontend **không** `UPDATE classes.leaderboard_enabled` (RLS chỉ cho SELECT): Server Action `saveLeaderboardSettings` (xác thực → zod → `rpc`) là đường duy nhất.

## 3. Cờ hệ thống

Cờ cấp hệ thống là hàng `leaderboard_feature_approved` trong `private.feature_flags` (migration R03): **mặc định `false`**, chỉ đổi bằng migration sau khi có chấp thuận bằng văn bản của nhà trường và rà soát pháp lý (PRIVACY_AND_SECURITY §5). Được kiểm tra **mỗi lần đọc** và bởi trigger khi bật — rút cờ thì mọi bảng đã bật cũng ngừng trả dữ liệu ngay.

> **Quyết định hiện thực (khác chữ trong prompt R05):** prompt nêu biến môi trường `LEADERBOARD_FEATURE_APPROVED`. Đã **giữ cờ trong CSDL** vì (a) nó đã có từ R03 và được trigger CSDL ép thực thi — biến môi trường không thể ép ở tầng CSDL; (b) tránh hai nguồn sự thật có thể lệch nhau. Kiểm thử cục bộ bật cờ bằng `setLocalLeaderboardApproval(true)` (`scripts/lib/test-fixtures.ts`, chỉ `supabase db query --local`) và trả về `false` khi xong; **không có đường tự bật ở production**.

## 4. Mã lỗi mới

`LEADERBOARD_NOT_APPROVED` (bật khi cờ hệ thống tắt), `LEADERBOARD_DISABLED` (trình chiếu khi bảng tắt) — câu chữ ở `vi.errors`.

## 5. Giới hạn hiện tại

- Chưa có endpoint cho vinh danh/reset (R06).
- Bảng không thời gian thực; client tải lại khi mở trang, khi quay lại thẻ trình duyệt và khi bấm nút.
- Chưa phân trang: trần cứng 30 hàng ở "TOP 10 + con"; "toàn bộ lớp" trả mọi học sinh đủ điều kiện (lớp tối đa vài chục em).
