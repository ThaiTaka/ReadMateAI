# ReadMate AI — Ranking Engine (R05)

> **Trạng thái: ĐÃ HIỆN THỰC (R05, Supabase LOCAL).** Nguồn quy tắc: [LEADERBOARD_SPEC §3–§4](LEADERBOARD_SPEC.md). Mã: `src/features/gamification/ranking.ts` (hàm thuần), `src/features/leaderboard/build.ts` (dựng DTO), CSDL `private.leaderboard_rows`.
> Tài liệu liên quan: [LEADERBOARD_API.md](LEADERBOARD_API.md) · [LEADERBOARD_UI.md](LEADERBOARD_UI.md) · [SCORING_ENGINE.md](SCORING_ENGINE.md) · [R05_SECURITY_TESTS.md](R05_SECURITY_TESTS.md)

## 1. Kiến trúc

```text
season_scores.balance ──┐
students (alias duyệt) ─┤  private.leaderboard_rows(class)   (CSDL: LỌC học sinh đủ điều kiện, một nơi duy nhất)
guardian_consents ──────┤            │
seasons / classes ──────┘            ▼
                          gateway_class_leaderboard / teacher_leaderboard_display   (kiểm tra thiết bị / GV, hai cờ)
                                     │  jsonb (không student_id)
                                     ▼
                  src/features/leaderboard/build.ts   (zod → rankScores → selectVisibleRows → DTO)
                                     │
                          GET /api/student/leaderboard  ·  trang GV  ·  trình chiếu
```

- **Không có bảng ranking độc lập**: bảng được tính khi đọc từ `season_scores` (pgTAP `04_leaderboard` kiểm tra không có bảng tên `leaderboard/ranking`).
- **CSDL lọc, TypeScript xếp hạng.** CSDL quyết định *ai được xuất hiện* (điều kiện quyền riêng tư — không thể quên lọc ở tầng giao diện); `ranking.ts` quyết định *thứ hạng, thứ tự đọc, đồng hạng, thanh điểm* (hàm thuần, có unit test, dùng lại ở R06 cho vinh danh và `final_rank`).
- Không thay đổi Scoring Engine: Ranking Engine **chỉ đọc** `balance`.

## 2. Điểm xếp hạng

Điểm xếp hạng = `season_scores.balance` (điểm **hiện tại**). **Không** dùng `earned_total`. Học sinh đủ điều kiện nhưng chưa có dòng điểm mùa (mới vào lớp, mùa mới) có **0 điểm thật** (`left join` + `coalesce(balance, 0)`) — không bịa điểm.

## 3. Quy tắc xếp hạng và đồng hạng

Hàm `rankScores(rows)` (không sửa đầu vào):

1. Sắp theo điểm giảm dần.
2. **Hạng = 1 + số người có điểm CAO HƠN** (xếp hạng kiểu thi đấu).
3. Thứ tự **hiển thị** trong nhóm đồng hạng (`compareDisplayOrder`, một thứ tự toàn phần ⇒ ổn định giữa các lần tải):
   1. `reachedAt` sớm hơn trước (`season_scores.balance_updated_at` — thời điểm của CSDL); không có thời điểm hợp lệ ⇒ xếp sau;
   2. tên hiển thị (NFC, `Intl.Collator("vi")`);
   3. khóa hàng (`rowKey`) làm chốt cuối.
4. Thứ tự đọc **không** tạo thứ hạng cao hơn; không có tiêu chí phụ nào phân thắng thua.

Ví dụ:

| Học sinh | Điểm | Hạng |
|---|---:|---:|
| Mây | 250 | 1 |
| Bống | 200 | 2 |
| Na | 200 | 2 |
| Tí | 160 | 4 |
| Bin | 100 | 5 |

Ví dụ của đặc tả §3 (120, 80@08:30, 80@08:00, 50, 0, 0) → hạng 1, 2, 2, 4, 5, 5 với thứ tự đọc B, E, C, D, A, F (có trong `tests/unit/gamification/ranking.test.ts`).

## 4. Thanh điểm

`calculateBarWidth(points, maxPoints)` = `points / maxPoints × 100` (làm tròn 2 chữ số, kẹp ≤ 100):

| Trường hợp | Kết quả |
|---|---|
| 250/250 · 200/250 · 125/250 | 100 · 80 · 50 |
| 0 điểm | **0** — thanh rỗng, không có độ dài tối thiểu giả |
| `maxPoints = 0` (cả lớp 0 điểm) | 0 cho mọi hàng — không chia cho 0 |
| NaN, âm, vượt tối đa | 0, 0, 100 |

`maxPoints` = điểm cao nhất của **toàn bộ** học sinh đủ điều kiện (không chỉ phần đang hiển thị); hàng hạng 1 luôn nằm trong dữ liệu gửi đi nên mẫu số không lộ thông tin về học sinh ẩn.

## 5. Chọn hàng gửi cho học sinh

- `getTopRankedStudents(ranked, 10, 30)`: mọi hàng có **hạng ≤ 10** (không cắt giữa nhóm đồng hạng), trần cứng 30 hàng.
- `selectVisibleRows(ranked, view)`: `full` ⇒ tất cả hàng đủ điều kiện; `top10_and_me` ⇒ phần đầu + **hàng của chính em tách riêng** nếu em nằm ngoài (và đủ điều kiện). Không có số lượng/tổng của phần còn lại ⇒ không suy ra được số bạn bị ẩn.

## 6. Điều kiện xuất hiện

Mỗi học sinh cần **đủ cả**: lớp `active` · mùa `active` · hồ sơ `active` · đồng ý `learning_data` · đồng ý `leaderboard_display` · tên hiển thị **đã duyệt** (`leaderboard_alias_approved_at`; trigger R03 xóa trạng thái duyệt khi tên đổi). Thiếu một ⇒ không có hàng (CSDL: `private.leaderboard_rows`; TypeScript: `eligibilityBlockers` + `normalizeLeaderboardRows`, dùng cho lý do hiển thị ở màn hình GV và kiểm thử). Kiểm thử tích hợp đối chiếu hai bản trên cùng dữ liệu thật. **Không** dùng họ tên/biệt danh nội bộ thay cho tên hiển thị thiếu.

## 7. Các hàm

| Hàm | Vai trò |
|---|---|
| `rankScores` | xếp hạng + thứ tự đọc |
| `normalizeLeaderboardRows` | ứng viên → hàng xếp hạng được (chỉ đủ điều kiện, NFC, điểm nguyên ≥ 0) |
| `calculateBarWidth` | chiều dài thanh (%) |
| `getTopRankedStudents` / `selectVisibleRows` | chọn hàng theo kiểu hiển thị |
| `maxPointsOf`, `compareAlias`, `compareDisplayOrder`, `eligibilityBlockers` | tiện ích |

## 8. Trường hợp đặc biệt đã kiểm thử

Lớp chưa có học sinh · một học sinh · hai bạn đồng hạng nhất · tất cả 0 điểm · học sinh chưa có bản ghi điểm · tên Unicode NFC/NFD · thời điểm không hợp lệ · điểm đổi ⇒ hạng tính lại (A 50 / B 60 → đồng hạng → A hạng 1 → A sai còn 65) · học sinh tạm ngưng · rút đồng ý hiển thị · chưa có/chưa duyệt tên · mùa không hoạt động (`no_season`). Xem [R05_SECURITY_TESTS.md](R05_SECURITY_TESTS.md).

## 9. Giới hạn

- Không thời gian thực: bảng tính khi mở trang và khi bấm "Cập nhật bảng"/quay lại thẻ trình duyệt.
- Chưa có `final_rank`/ảnh chụp vinh danh (R06 sẽ dùng lại `rankScores`).
- Thứ tự theo tên dùng bộ so sánh của môi trường chạy (`Intl.Collator("vi")`); Node 24 và trình duyệt hiện đại đều hỗ trợ.
