# ReadMate AI — Mở khóa bản đồ và điều kiện mini-game

> **Trạng thái:** ✅ hiện thực ở **R04 (2026-10-20)** trên Supabase LOCAL. Mini-game **chưa chơi được** (R07–R09).
> **Quy tắc:** [GAMIFICATION_SPEC §6–§7](GAMIFICATION_SPEC.md#6-mở-khóa-thẻ-bản-đồ). **Liên quan:** [SCORING_ENGINE.md](SCORING_ENGINE.md) · [GAME_DESIGN.md](GAME_DESIGN.md)

## 1. Bản đồ khám phá mùa đầu

`src/features/game-world/map.ts` (hàm thuần):

```text
┌──────────────┬──────────────┬──────────────┐
│ Đồi hoa      │ Ao sen       │ Lũy tre      │
├──────────────┼──────────────┼──────────────┤
│ Ruộng lúa    │ TRẠM LUYỆN   │ Cầu gỗ       │
│              │ TẬP (luôn mở)│              │
├──────────────┼──────────────┼──────────────┤
│ Đồi thả diều │ Làng đèn lồng│ Đài ngắm sao │
└──────────────┴──────────────┴──────────────┘
```

- `WORLD_MAP_KEY = "season-map-1"`; **8 thẻ** = 8 cảnh SVG đã vẽ ở R02 (`MAP_TILES`); Trạm luyện tập không tính là thẻ.
- **Kề nhau theo cạnh** (trên/dưới/trái/phải). Lúc đầu mở được 4 thẻ cạnh Trạm; 4 thẻ góc cần một thẻ cạnh kề đã mở. Mọi thẻ tới được trong đúng 8 lượt (unit test).
- Đề xuất R04 (GAME_DESIGN gợi ý 24 thẻ): lưới 3 × 3 dùng đúng 8 cảnh đã có giấy phép; mở rộng khi có thêm asset.

## 2. Quy tắc

| | Giá trị |
|---|---|
| Lượt khám phá được phép | `min(8, floor(earned_total / 30))` |
| Lượt còn lại | được phép − đã mở |
| Ví dụ | 0–29 → 0 · 30–59 → 1 · 60–89 → 2 · 90–119 → 3 · 120–149 → 4 · ≥ 240 → 8 |
| Chi phí | **0 điểm** (không trừ, không tiêu) |
| Khi điểm hiện tại giảm | Thẻ đã mở **giữ nguyên** (tích lũy chỉ tăng) |

## 3. Khám phá thẻ (`POST /api/student/map-tiles`)

1. Máy chủ đọc mùa, điểm, thẻ đã mở → `canRevealTile` (thẻ hợp lệ, chưa mở, còn lượt, kề vùng đã mở).
2. Thẻ đã mở → trả `already_revealed` (gửi lại **không** tốn lượt).
3. `gateway_reveal_map_tile`: liên kết thiết bị + đồng ý; khóa mùa (chia sẻ) → dòng điểm (`FOR UPDATE`); đếm lại thẻ; kiểm số lượt (`NO_TILE_AVAILABLE`) và tính kề nhau (`NOT_ADJACENT` — danh sách thẻ kề do máy chủ truyền từ `map.ts`); ghi `map_tile_reveals` (PK `(season_id, student_id, tile_key)`, `ordinal` duy nhất).
4. Hai yêu cầu song song khi chỉ còn 1 lượt → đúng một thẻ được mở (kiểm thử tích hợp).

Giao diện `src/features/scored-practice/ui/map-explorer.tsx`: lưới 3 × 3, ô có thể khám phá là nút ≥ 64 px viền vàng "Khám phá"; ô khác là sương mù có nhãn hàng/cột; mây tan bằng `animate-fog-clear` (trạng thái gốc của lớp sương **trong suốt** → khi giảm chuyển động sương biến mất ngay); thông báo `aria-live` "Mây tan rồi! Con vừa khám phá …". Hình SVG dựng ở Server Component và truyền xuống dạng phần tử (không vào bundle JS).

## 4. Điều kiện mini-game

| Game | Điểm hiện tại cần | Logic | Giao diện (`/learn/me#tro-choi`) | Chưa hoạt động |
|---|---|---|---|---|
| Mê cung kho báu | 50 | `canEnterGame(balance)` — xét **điểm hiện tại**, không tiêu điểm | "Đủ điểm"/"Cần thêm n điểm"; "Đã khám phá" khi có `game_unlocks`; chip + nút trong bảng chi tiết "Mini-game đang phát triển" (khóa) | Màn chơi, lượt chơi (R07–R08) |
| Rừng chữ kỳ diệu | 120 | như trên | như trên | R09 |
| Đảo dấu thanh | 200 | như trên | như trên | R09 |
| Lâu đài ghép vần | 300 | như trên | như trên | R09 |

- **`game_unlocks`** ghi trong giao dịch ghi điểm khi điểm hiện tại **lần đầu** đạt ngưỡng trong mùa (`balance_at_unlock`, `first_reached_at`), dùng để hiện "Đã khám phá khu vực mới: …!" trong buổi luyện và chip "Đã khám phá". **Không** cấp quyền vào chơi: tụt dưới ngưỡng thì thẻ trở lại "Cần thêm n điểm" nhưng dấu vẫn giữ (kiểm thử tích hợp).
- Quy tắc "đang chơi dở mà tụt ngưỡng vẫn chơi tiếp" (RQ-G4) thực hiện khi có Game Engine (R07).
- Không có route game nào (E2E kiểm không có liên kết `/games`).

## 5. Kiểm thử

Unit `tests/unit/gamification/map.test.ts`, `scoring.test.ts` (biên 49/50 … 299/300, 29/30/60 điểm); tích hợp `tests/db/scoring.test.ts` (29 → không mở, 30 → mở 1 thẻ kề, không kề bị từ chối, song song, gửi lại, điểm không đổi; 50 → `treasure_maze` một lần); E2E `tests/e2e-db/scoring.spec.ts` (mở Ao sen rồi Đồi hoa, tải lại giữ nguyên, Mê cung đủ điều kiện, nút khóa).
