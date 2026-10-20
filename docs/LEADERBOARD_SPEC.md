# ReadMate AI — Bảng xếp hạng, vinh danh và reset mùa

> **Trạng thái:** §1–§7 và §10–§11 (bảng xếp hạng, thanh điểm, avatar, DTO, kiểm thử) **ĐÃ HIỆN THỰC ở R05** (Supabase LOCAL, 2026-10-22) — xem [RANKING_ENGINE.md](RANKING_ENGINE.md), [LEADERBOARD_API.md](LEADERBOARD_API.md), [LEADERBOARD_UI.md](LEADERBOARD_UI.md), [AVATAR_SYSTEM.md](AVATAR_SYSTEM.md), [R05_SECURITY_TESTS.md](R05_SECURITY_TESTS.md). §8 (vinh danh TOP 3) và §9 (reset mùa) vẫn **PLANNED — R06**.
> **Quyết định hiện thực R05:** hạng = 1 + số người điểm cao hơn; TOP 10 + con = mọi hàng hạng ≤ 10 (không cắt nhóm đồng hạng, trần 30 hàng); chip vàng/bạc/đồng và huy hiệu chỉ cho hạng 1–3 **có điểm > 0**; cờ hệ thống nằm trong CSDL (`private.feature_flags`), không phải biến môi trường; avatar nằm trong mã (16 mẫu), không có bảng `avatar_options`.
> **Điều kiện bật (BẮT BUỘC):** bảng xếp hạng là ngoại lệ có điều kiện của CLAUDE.md §6.4 (quyết định của người điều phối, 2026-10-16) — chỉ trong phạm vi lớp, chỉ học sinh có đồng ý hiển thị, **mặc định tắt** theo từng lớp. Chi tiết: [PRIVACY_AND_SECURITY §5](PRIVACY_AND_SECURITY.md#5-bảng-xếp-hạng-điều-kiện-bật-và-kiểm-soát-hiển-thị).
> **Tài liệu liên quan:** [GAMIFICATION_SPEC.md](GAMIFICATION_SPEC.md) · [REDESIGN_ARCHITECTURE.md](REDESIGN_ARCHITECTURE.md) · [PRODUCT_REDESIGN.md](PRODUCT_REDESIGN.md)

## Mục lục

1. [Phạm vi và người xem](#1-phạm-vi-và-người-xem)
2. [Dữ liệu một hàng](#2-dữ-liệu-một-hàng)
3. [Quy tắc xếp hạng và bằng điểm](#3-quy-tắc-xếp-hạng-và-bằng-điểm)
4. [Thanh điểm kiểu FIFA Ranking](#4-thanh-điểm-kiểu-fifa-ranking)
5. [Ngôn ngữ và trình bày không gây xấu hổ](#5-ngôn-ngữ-và-trình-bày-không-gây-xấu-hổ)
6. [Bố cục theo thiết bị](#6-bố-cục-theo-thiết-bị)
7. [Avatar và tên hiển thị](#7-avatar-và-tên-hiển-thị)
8. [Vinh danh TOP 3](#8-vinh-danh-top-3)
9. [Reset điểm — bắt đầu mùa mới](#9-reset-điểm--bắt-đầu-mùa-mới)
10. [Dữ liệu trả về và bảo mật](#10-dữ-liệu-trả-về-và-bảo-mật)
11. [Kiểm thử bắt buộc](#11-kiểm-thử-bắt-buộc)

---

## 1. Phạm vi và người xem

| Người xem | Thấy gì | Điều kiện |
|---|---|---|
| Học sinh (thiết bị đã liên kết) | Bảng xếp hạng **mùa đang diễn ra** của **lớp mình** | Lớp bật `leaderboardEnabled` |
| GV của lớp | Bảng của lớp mình (mùa hiện tại và các mùa đã đóng), cộng cột đối soát (điểm tích lũy, tổng đã trừ) chỉ GV thấy | Vai trò trong `class_staff` |
| Phụ huynh | Như học sinh, trên thiết bị của con | — |
| Người ngoài lớp, khách, công cụ tìm kiếm | **Không thấy gì** | Không có URL công khai |

- Một bảng = một lớp × một mùa. Không có bảng toàn trường, toàn hệ thống hay so sánh giữa các lớp.
- Không hiển thị nhóm năng lực, lộ trình, mức hỗ trợ, tỉ lệ đúng, số câu sai của bất kỳ ai.

## 2. Dữ liệu một hàng

| Thành phần | Nguồn | Ghi chú |
|---|---|---|
| Thứ hạng | Tính khi đọc (§3) | Số; đồng hạng hiển thị cùng số |
| Avatar | `students.avatar_key` → bộ avatar có sẵn | Nhân vật hoạt hình hình người (§7); không ảnh thật |
| Tên hiển thị | `students.leaderboard_alias` đã được GV duyệt | Không phải họ tên đầy đủ |
| Thanh điểm ngang | `season_scores.balance` | Chiều dài tỉ lệ với điểm (§4) |
| Tổng điểm chính xác | `season_scores.balance` | Số nguyên, luôn hiện cạnh thanh |

Chỉ học sinh **đủ điều kiện hiển thị** mới có hàng: học sinh đang hoạt động của lớp, có đồng ý thu dữ liệu học tập **và** đồng ý hiển thị trên bảng xếp hạng, có tên hiển thị đã duyệt. Học sinh không đủ điều kiện vẫn tích điểm và thấy điểm của mình ở góc riêng, chỉ không xuất hiện trên bảng. Bảng **không** ghi "còn N bạn ẩn" (tránh suy đoán).

## 3. Quy tắc xếp hạng và bằng điểm

1. Sắp theo **điểm hiện tại giảm dần**.
2. **Bằng điểm → đồng hạng** (xếp hạng kiểu thi đấu "1-2-2-4"): hai bạn cùng 80 điểm đều hạng 2; bạn kế tiếp hạng 4. Không dùng tiêu chí phụ để phân thắng thua.
3. Thứ tự **hiển thị** trong nhóm đồng hạng: ai đạt mức điểm đó **sớm hơn** đứng trước (`balance_updated_at` tăng dần), cùng thời điểm thì theo tên hiển thị (so sánh chuỗi tiếng Việt, NFC). Đây chỉ là thứ tự đọc, **không** đổi số hạng.
4. Học sinh 0 điểm vẫn có hàng (nếu đủ điều kiện hiển thị), xếp đồng hạng với nhau.
5. Hàm xếp hạng là **hàm thuần** `rankScores(rows)` dùng chung cho bảng, vinh danh và thứ hạng cuối mùa (`final_rank`).

Ví dụ:

| Điểm | Đạt lúc | Hạng hiển thị |
|---|---|---|
| 120 | 09:10 | 1 |
| 80 | 08:00 | 2 |
| 80 | 08:30 | 2 |
| 50 | — | 4 |
| 0 | — | 5 |
| 0 | — | 5 |

## 4. Thanh điểm kiểu FIFA Ranking

Lấy cảm hứng từ biểu đồ thanh ngang của bảng xếp hạng FIFA (chỉ ý tưởng bố cục — không dùng tên, logo, màu thương hiệu hay hình ảnh của FIFA).

```text
 1  (avatar) Mây      ████████████████████████████  120
 2  (avatar) Bống     ███████████████████           80
 2  (avatar) Tí       ███████████████████           80
 4  (avatar) Na       ████████████                  50
 5  (avatar) Su                                     0
```

- Chiều dài thanh **tỉ lệ tuyến tính** với điểm thực: `width = balance / max(balance của bảng) × 100%` của vùng thanh. Khi mọi người 0 điểm → mọi thanh rỗng.
- Không có độ dài tối thiểu giả (0 điểm = thanh rỗng, chỉ còn đường nền mảnh) — để thanh đúng với điểm; số điểm luôn hiện nên không ai "biến mất".
- Thanh có hoạt cảnh lớn dần khi điểm tăng (≤ 600 ms); chế độ giảm chuyển động: đổi kích thước tức thì.
- Màu thanh **giống nhau cho mọi hàng** (một màu thương hiệu dịu); không tô đỏ/xám hàng cuối. TOP 3 có huy hiệu hình (vương miện nhỏ, ngôi sao) + chữ "Hạng 1", không chỉ dựa vào màu.
- Hàng của chính học sinh có viền nổi bật và nhãn "Con" — không đổi màu thanh.

## 5. Ngôn ngữ và trình bày không gây xấu hổ

| Không dùng | Dùng |
|---|---|
| "Cuối bảng", "bét", "thua", "kém", "tụt hạng" | Không nhắc tới vị trí cuối; chỉ có số hạng |
| Mũi tên đỏ đi xuống, mặt buồn | Không có biểu tượng giảm hạng |
| "Bạn A hơn con 50 điểm" | "Con có 30 điểm. Mỗi câu đúng được thêm 10 điểm!" |
| Thông báo khi bị vượt | Không thông báo |

- Tiêu đề bảng: "Bảng điểm của lớp — Mùa 1". Lời dẫn: "Ai cũng đang cố gắng. Cùng luyện tập nhé!".
- GV có thể chọn kiểu hiển thị cho học sinh: **toàn bộ lớp** hoặc **TOP 10 + hàng của con** (mặc định đề xuất: TOP 10 + hàng của con, RQ-L1).
- Không có bảng theo ngày/tuần dạng "người cố gắng nhất" hay "người chậm nhất".

## 6. Bố cục theo thiết bị

| Thiết bị | Bố cục |
|---|---|
| Điện thoại dọc (≥ 360 px) | Mỗi hàng: hạng (cột hẹp) · avatar 40 px · tên (cắt bằng dấu "…" nếu dài, tên đầy đủ đọc được bằng trình đọc màn hình) — thanh nằm **dòng dưới** tên, số điểm cuối thanh. Không cuộn ngang |
| Điện thoại ngang, máy tính bảng | Một dòng: hạng · avatar 48 px · tên · thanh · điểm |
| Máy tính | Như máy tính bảng, vùng thanh rộng hơn; GV có chế độ trình chiếu toàn màn hình (chữ lớn) |

- Ngữ nghĩa: bảng HTML (`<table>`) có tiêu đề cột, hoặc danh sách có `aria-label` từng hàng ("Hạng 2, Bống, 80 điểm"); thanh là phần trang trí `aria-hidden`, con số là nội dung chính.
- Tương phản ≥ 4,5:1 cho chữ; thanh ≥ 3:1 với nền.

## 7. Avatar và tên hiển thị

- **Bộ avatar có sẵn**: nhân vật hoạt hình **hình người** (đa dạng kiểu tóc, màu da, trang phục; không gắn giới tính bắt buộc), vẽ mới, không mô phỏng trẻ thật, có giấy phép ([GAME_DESIGN §12](GAME_DESIGN.md#12-asset-âm-thanh-và-giấy-phép)). Đề xuất 16–24 avatar cho bản đầu. *Thay đổi so với DATA_MODEL GĐ1 (ảnh đại diện con vật/đồ vật):* bổ sung avatar hình người theo yêu cầu R01; avatar con vật cũ có thể giữ làm lựa chọn.
- Học sinh (cùng phụ huynh) chọn avatar trong bộ có sẵn; không tải ảnh lên, không chụp ảnh.
- **Tên hiển thị trên bảng** (`leaderboard_alias`) do GV nhập hoặc phụ huynh đề xuất và **GV duyệt**; mặc định là biệt danh ở lớp (`display_name`) nhưng chỉ dùng khi GV bấm duyệt. Quy tắc: 1–20 ký tự, NFC, không họ tên đầy đủ, không số điện thoại/email (kiểm bằng cùng bộ soát dữ liệu cá nhân của `content:check`), không từ ngữ không phù hợp.
- Hai học sinh trùng tên hiển thị trong lớp → GV phải chỉnh để phân biệt (ràng buộc duy nhất trong lớp).

## 8. Vinh danh TOP 3

### 8.1 Ai và khi nào

- Chỉ **GV có quyền quản lý lớp** (vai trò `owner` hoặc `co_teacher` được cấp quyền) và chỉ khi lớp bật `honorsEnabled`. Nút "Vinh danh TOP 3" nằm ở trang bảng xếp hạng của GV.
- Server kiểm tra quyền ở Server Action/Route Handler (xác thực → `class_staff` → zod), **không** dựa vào việc nút có hiện hay không.

### 8.2 Luồng

1. GV bấm "Vinh danh TOP 3" → server **chụp ảnh bảng xếp hạng** hiện tại thành `honor_snapshots` (bất biến): mùa, thời điểm, người tạo, danh sách hàng đủ điều kiện có `rank ≤ 3` **và** `balance > 0` (alias, avatar, điểm, hạng). Không chứa `student_id` trong phần dữ liệu trình chiếu.
2. Màn vinh danh (toàn màn hình, phù hợp máy chiếu) phát theo thứ tự: **TOP 3 → TOP 2 → TOP 1**.
3. Mỗi bước: bục vinh danh, avatar, tên, tổng điểm; hiệu ứng nhẹ (hoa giấy rơi chậm).
4. **TOP 1**: ánh hào quang (vầng sáng tỏa chậm, không nhấp nháy), hiệu ứng chúc mừng, avatar lớn, tên, tổng điểm.
5. Nút **Bỏ qua** (tới thẳng màn tổng kết ba bậc) và **Xem lại** (phát lại từ đầu) luôn hiện; danh sách các lần vinh danh trước của lớp để xem lại.
6. **Không** reset điểm sau vinh danh.

### 8.3 Bằng điểm và trường hợp đặc biệt

- Theo xếp hạng đồng hạng §3: nhiều bạn cùng hạng → cùng đứng một bậc (bục rộng ra, tối đa 6 avatar/bậc; nhiều hơn thì hiện lưới tên). Ví dụ hạng 1, 1, 3 → bậc TOP 2 trống và được **bỏ qua** trong hoạt cảnh.
- Chỉ người có điểm > 0 được vinh danh; nếu không ai > 0 → nút bị khóa kèm lý do.
- Học sinh không đủ điều kiện hiển thị không bao giờ xuất hiện trong vinh danh.
- Chế độ giảm chuyển động: các bậc hiện bằng mờ dần, không hoa giấy, không hào quang động (dùng hình hào quang tĩnh).
- Học sinh có thể xem lần vinh danh gần nhất của lớp trong ứng dụng (nếu lớp bật bảng xếp hạng) — cùng dữ liệu ảnh chụp.

## 9. Reset điểm — bắt đầu mùa mới

### 9.1 Giao diện xác nhận hai bước

1. **Bước 1** — GV bấm "Bắt đầu mùa mới" → hộp thoại giải thích hệ quả: điểm của cả lớp về 0; mini-game khóa lại; thẻ bản đồ che lại; tiến độ thử thách mùa cũ kết thúc; kết quả mùa cũ được lưu và xem lại được; **không** xóa tài khoản và kết quả học tập; không ảnh hưởng lớp khác. Nút "Tiếp tục" / "Hủy".
2. **Bước 2** — GV gõ lại đúng tên lớp (ví dụ `1A2`) vào ô xác nhận rồi bấm "Xác nhận bắt đầu mùa mới" (nút chỉ bật khi gõ đúng). Đây là thao tác GV (khu vực GV được phép có ô nhập; quy tắc "không ô nhập tự do" chỉ áp dụng khu vực học sinh).

### 9.2 Xử lý ở server

Server Action `resetSeason({ classId, requestId, confirmation })`: xác thực GV → kiểm tra vai trò `owner` với lớp → zod → kiểm tra `confirmation` khớp tên lớp → gọi hàm CSDL `private.reset_class_season` **trong một giao dịch** (các bước và hệ quả: [GAMIFICATION_SPEC §8.2](GAMIFICATION_SPEC.md#82-reset-điểm-bắt-đầu-mùa-mới); SQL phác thảo: [REDESIGN_ARCHITECTURE §7.3](REDESIGN_ARCHITECTURE.md#73-reset-mùa-trong-một-giao-dịch)) → trả `{ ok: true, data: { newSeasonId, seqNo } }` hoặc `{ ok: false, code }` (`FORBIDDEN`, `CONFIRMATION_MISMATCH`, `ALREADY_RESET` khi gửi lại cùng `requestId`).

- Ghi `audit_logs` (UUID GV, UUID lớp, UUID mùa cũ/mới) — không ghi tên học sinh.
- Sau reset: bảng xếp hạng hiện mùa mới (mọi người 0 điểm); thiết bị học sinh đang mở nhận lỗi `SEASON_CLOSED` ở lần nộp kế tiếp và tải lại trạng thái.

## 10. Dữ liệu trả về và bảo mật

- Học sinh **không** đọc trực tiếp bảng `season_scores` của bạn khác (RLS chỉ cho đọc dòng của mình). Bảng xếp hạng đi qua **student gateway**: `GET /api/student/leaderboard` → server suy ra lớp từ thiết bị, kiểm tra lớp bật bảng, lọc học sinh đủ điều kiện, trả DTO:

```ts
// PLANNED — R05
type LeaderboardRowDto = {
  rowKey: string;        // khóa ngẫu nhiên theo mùa (không phải student_id)
  rank: number;
  alias: string;         // leaderboard_alias đã duyệt (NFC)
  avatarKey: string;
  points: number;
  isMe: boolean;
};
type LeaderboardDto = { seasonNo: number; maxPoints: number; rows: LeaderboardRowDto[]; generatedAt: string };
```

- Không trả `student_id`, `class_id`, điểm tích lũy, tổng đã trừ, nhóm, mức hỗ trợ cho học sinh.
- Header: `Cache-Control: private, no-store`; trang `noindex`; không có trong sitemap; không chia sẻ được bằng liên kết công khai.
- GV đọc qua Server Component với JWT của GV (RLS theo `private.my_class_ids()`).
- Tần suất cập nhật: tính khi mở trang và làm mới khi học sinh quay lại trang (không cần thời gian thực).

## 11. Kiểm thử bắt buộc

1. `rankScores`: bảng ví dụ §3; thuộc tính — hạng không giảm theo thứ tự hiển thị; cùng điểm ⇔ cùng hạng.
2. Thanh: điểm tối đa → 100%; 0 → 0%; tỉ lệ đúng với điểm.
3. Học sinh thiếu một trong các điều kiện hiển thị → không có trong DTO, không có trong ảnh chụp vinh danh.
4. RLS / gateway: thiết bị lớp A không lấy được bảng lớp B; khách → 401; DTO không có `student_id`.
5. Vinh danh: chỉ GV lớp gọi được; ảnh chụp bất biến (cập nhật/xóa bị chặn); đồng hạng → cùng bậc; không ai > 0 → từ chối.
6. Reset: hai bước trên giao diện; sai tên lớp → `CONFIRMATION_MISMATCH`; GV lớp khác → `FORBIDDEN`; gửi lại `requestId` → không tạo thêm mùa; dữ liệu học tập không đổi.
7. E2E: 360 px không cuộn ngang; trình đọc màn hình đọc được "Hạng 2, Bống, 80 điểm"; giảm chuyển động; axe không lỗi critical/serious.
8. Câu chữ: bộ soát (unit test) cấm các từ ở cột "Không dùng" §5 xuất hiện trong chuỗi giao diện học sinh của bảng xếp hạng.

| Mã | Câu hỏi mở |
|---|---|
| RQ-L1 | Học sinh xem toàn bộ lớp hay TOP 10 + hàng của mình? (đề xuất TOP 10 + mình) |
| RQ-L2 | Học sinh có được xem lại vinh danh trong ứng dụng, hay chỉ xem trên máy chiếu của GV? |
| RQ-L3 | Bộ avatar: số lượng, phong cách — GV duyệt bản phác thảo |
