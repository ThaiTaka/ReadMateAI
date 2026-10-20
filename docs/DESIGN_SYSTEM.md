# ReadMate AI — Hệ thống thiết kế "Modern 2D Educational Adventure"

> **Phiên bản:** 1.0 — Giai đoạn R02 (2026-10-20)
> **Trạng thái:** ĐÃ HIỆN THỰC ở mức giao diện (token, thành phần, asset SVG). Dữ liệu điểm/bản đồ/xếp hạng là **minh họa hư cấu**; logic điểm thật thuộc R04.
> **Liên quan:** [ASSET_MANIFEST.md](ASSET_MANIFEST.md) · [GAME_DESIGN.md](GAME_DESIGN.md) · [GAMIFICATION_SPEC.md](GAMIFICATION_SPEC.md) · [REDESIGN_ARCHITECTURE.md](REDESIGN_ARCHITECTURE.md)

## 1. Nguyên tắc

| Nguyên tắc | Cách làm |
|---|---|
| Fantasy Adventure + Playful Learning + Premium EdTech | Khối bo tròn lớn, bóng mềm có chiều sâu, cảnh minh họa phân lớp; không phải wireframe |
| Trẻ 6–7 tuổi đọc được | Be Vietnam Pro cho giao diện, Andika cho chữ cần đọc; cỡ ≥ 12 px (E2E kiểm), line-height ≥ 1.2 cho dấu chồng |
| Không truyền tin chỉ bằng màu | Mọi trạng thái có chữ + biểu tượng (ổ khóa / dấu tích, "Đủ điểm" / "Chưa đủ điểm", trái tim đầy / viền đứt + "Quái vật còn n/3 trái tim") |
| Vùng chạm | Nút học sinh ≥ 64 px (`min-h-touch-kid`), người lớn ≥ 48 px |
| Trung thực | Chức năng chưa có: "Sắp có – Đang phát triển", nút khóa; dữ liệu minh họa luôn có nhãn "BẢN CHƠI THỬ – DỮ LIỆU MINH HỌA" |
| Chuyển động nhẹ, tắt được | Chu kỳ ≥ 2,4 s, không nhấp nháy > 3 lần/giây; tắt theo `prefers-reduced-motion` **và** công tắc "Giảm chuyển động" |

## 2. Màu sắc (`src/styles/tokens.css`)

| Nhóm | Token | Vai trò |
|---|---|---|
| `brand-*` (xanh lá mạ) | giữ từ GĐ2 | Thương hiệu, nút chính người lớn |
| `jade-*` (xanh ngọc) — **mới** | 50 → 900 | Thế giới khám phá: bản đồ, thẻ khu vực đủ điểm, nút phiêu lưu chính |
| `lagoon-*` (xanh dương) | giữ | Tri thức, luyện tập, kỹ năng |
| `sun-*` (vàng ấm) | thêm `sun-600` | Điểm thưởng, thành tích, ngôi sao, nút "Chơi thử" |
| `magic-*` (tím nhẹ) — **mới** | 50 → 900 | Khu vực kỳ diệu (lâu đài), trạng thái khóa, nút "Khám phá Game World" |
| `coral-*` | giữ | Điểm nhấn ấm (khăn, mái nhà, cờ) — dùng ít |
| `deep-700/800/900` — **mới** | | Nền khung cảnh sâu (khối Game World ở trang chủ, phủ mờ sau bảng thông tin) |
| Trung tính `canvas`, `surface`, `ink*`, `line*` | giữ | Nền sáng, chữ dễ đọc |

Tương phản: chữ trắng chỉ đặt trên `jade-600+`, `magic-600+`, `brand-600+`, `deep-*`; chữ `ink` trên nền `sun-*`. Mỗi màn hình chỉ một hai màu nhấn mạnh (không quá nhiều màu chói).

## 3. Bóng, bo góc, chuyển động

- `--radius-world` (2 rem) cho khung cảnh/thẻ lớn; `--radius-card`, `--radius-tile` giữ từ GĐ2.
- `shadow-press-{jade,sun,magic,plain}`: viền đáy đậm của nút phiêu lưu (bấm thì lún 3 px). `shadow-world`: thẻ/khung cảnh nổi. `shadow-glow-sun`: huy hiệu đã đạt, mốc kế tiếp.
- Hoạt cảnh (`animate-*`): `float` (6 s), `bob` (3,2 s), `sway` (5 s), `wave` (2,8 s), `twinkle` (3 s), `drift` (22 s), `glow` (3,6 s), `pop-in` (0,5 s, một lần).
- SVG: phần tử xoay/nhún dùng `origin-fill` (transform-box: fill-box) + `origin-*`. **Không** đặt hoạt cảnh lên phần tử có thuộc tính `transform` (CSS transform sẽ đè vị trí) — bọc `<g transform>` ngoài, hoạt cảnh ở phần tử trong.
- Giảm chuyển động: `globals.css` (1) `@media (prefers-reduced-motion: reduce)` rút thời lượng về 0,01 ms; (2) `[data-motion="reduce"]` đặt `animation: none`. `MotionScope` (client) gắn `data-motion` theo hệ điều hành hoặc lựa chọn trong trang (React state, **không** localStorage — lưu ở hồ sơ server từ R03).

## 4. Thành phần (`src/components/adventure/`, `src/components/ui/`)

| Thành phần | Tệp | API chính | Ghi chú |
|---|---|---|---|
| `AdventureButton`, `AdventureLink`, `adventureClasses()` | `adventure-button.tsx` | `tone: jade·sun·magic·plain`, `size: md·kid` | Link chỉ dùng khi đích có thật; nút khóa không nổi |
| `GameCard`, `LockedGameCard` | `game-card.tsx` | `art`, `title`, `titleId`, `status`, `actions`, `accentRing`, `as` | Thẻ có tên vùng (`aria-labelledby`); khóa = sương + ổ khóa |
| `WorldMapCard` | `world-map-card.tsx` | `game`, `state` (`GameUnlockState`), `compact`, `idPrefix` | Nút "Xem chi tiết" mở bảng thật; "Vào chơi – Sắp có" luôn khóa |
| `GameWorldMap` | `game-world-map.tsx` | `states` | SVG + ghim HTML (chỉ để nhìn, `aria-hidden`); thao tác ở thẻ |
| `ScoreBadge`, `StarMark` | `score-badge.tsx` | `points`, `earnedTotal`, `illustrative`, `size` | Chỉ hiển thị; chip "Minh họa" bắt buộc khi điểm không thật |
| `ProgressBar` | `progress-bar.tsx` | `value`, `max`, `label`, `valueText`, `tone` | `role="progressbar"` + `aria-valuetext` |
| `AvatarFrame` | `avatar-frame.tsx` | `avatar`, `size: sm·md·lg·xl·hero`, `ring`, `label`, `badge` | Avatar hoạt hình có sẵn |
| `AchievementBadge` | `achievement-badge.tsx` | `title`, `description`, `icon`, `earned` | "Đã đạt" / "Chưa đạt" bằng chữ |
| `HeartIndicator` | `heart-indicator.tsx` | `remaining`, `total` | HP của quái vật (học sinh không "mất mạng") |
| `GameWorldHeader` | `game-world-header.tsx` | `id`, `eyebrow`, `title`, `description`, `actions`, `tone`, `level` | |
| `CharacterPreview` | `character-preview.tsx` | `art`, `name`, `role`, `note`, `tone` | Luôn có nhãn "Bản phác thảo – chờ giáo viên duyệt" |
| `MilestoneTrail` | `milestone-trail.tsx` | `earnedTotal` | 8 mốc × `MAP_TILE_STEP`; ô kế tiếp nổi bật |
| `LeaderboardPreview` | `leaderboard-preview.tsx` | `entries` | **Chỉ minh họa** (tên hư cấu), ngôn ngữ trung tính |
| `AdventureDialog` | `adventure-dialog.tsx` (client) | `triggerLabel`, `triggerAriaLabel`, `title`, `children` | `<dialog>` gốc + `showModal()`: khóa focus, Esc, trả focus |
| `MotionScope`, `MotionToggle` | `motion.tsx` (client) | — | `aria-pressed`; chỉ lưu trong phiên trang |
| `PreviewRibbon` | `preview-ribbon.tsx` | — | `role="note"` "Bản chơi thử – Dữ liệu minh họa" (in hoa bằng CSS) |
| `ComingSoonState` | `ui/coming-soon-state.tsx` | `title`, `description`, `art` | "Sắp có – Đang phát triển", không có nút |
| `EmptyState`, `LoadingState` | `ui/*` | giữ từ GĐ2 | |

Thành phần giữ từ GĐ2 (`Button`, `Badge`, `Card`, `Notice`, `SectionHeading`, `Container`, Player của 6 dạng bài) không đổi API.

**Ranh giới server/client:** chỉ `AdventureDialog`, `MotionScope/MotionToggle` là client component; ảnh SVG và nội dung bảng thông tin truyền vào qua `children` từ Server Component → không vào bundle JS.

### Bảng xếp hạng (R05) — `src/components/leaderboard/`

`LeaderboardBoard`/`LeaderboardRowView`/`BoardPanel` (hàng: hạng · avatar · tên · thanh · điểm), `ScoreBar` (thanh điểm có hoạt cảnh ≤ 500 ms, dừng khi giảm chuyển động), `DemoLeaderboard` (bản chơi thử). Chi tiết: [LEADERBOARD_UI.md](LEADERBOARD_UI.md).

## 5. Kiểu chữ

- Giao diện: Be Vietnam Pro 400/600/700/800 (`font-sans`). Chữ cần đọc trong bài: Andika (`font-reading`), cả trong cảnh SVG có chữ cái (Rừng chữ, Lâu đài).
- Tiêu đề lớn `text-display` (clamp, line-height 1.2), tiêu đề khu vực `text-3xl/4xl font-extrabold`; nhãn nhỏ nhất `text-xs` (12 px).

## 6. Mở rộng

1. Màu mới → thêm token trong `tokens.css` (không mã màu rời trong thành phần, trừ bên trong SVG minh họa).
2. Thành phần mới đặt ở `src/components/adventure/` nếu dùng chung cho trang học sinh/game; câu chữ ở `src/strings/vi.ts`.
3. Hình mới → `src/components/art/` + dòng trong `content/media/licenses.json` (unit test chặn nếu thiếu) — xem [ASSET_MANIFEST](ASSET_MANIFEST.md).
4. Mọi số liệu điểm lấy từ `src/features/gamification/rules.ts` / `unlocks.ts`; không chép số vào giao diện.

## 7. Giới hạn hiện tại

- Nhân vật là SVG vẽ bằng mã — đủ để trình diễn và để GV góp ý, chưa phải mỹ thuật của họa sĩ chuyên nghiệp (chưa có sprite động nhiều khung, biểu cảm, chuyển cảnh).
- Chưa có chế độ tối; chưa có âm thanh hiệu ứng.
- Ghim tên khu vực trên bản đồ ẩn chữ ở màn < 640 px (chỉ còn biểu tượng) — tên đầy đủ ở thẻ ngay dưới.
- Ảnh hoạt cảnh không được kiểm tra hiệu năng trên Android cấu hình thấp (dự kiến POC R07).
