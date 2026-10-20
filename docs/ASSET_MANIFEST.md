# ReadMate AI — Danh mục asset hình ảnh và quy tắc sử dụng

> **Phiên bản:** 1.0 — Giai đoạn R02 (2026-10-20)
> **Nguồn dữ liệu máy đọc:** [`content/media/licenses.json`](../content/media/licenses.json) (kiểm bằng `npm run content:check` và `tests/unit/media-licenses.test.ts`).
> **Trạng thái duyệt:** mọi nhân vật, avatar, cảnh, biểu tượng R02 đều **`pending_review` — chờ giáo viên duyệt** (RQ-M1). Không mục nào được đánh dấu đã duyệt.

## 1. Quy tắc (BẮT BUỘC — CLAUDE.md §7.9, §9.4.7, §6.9)

1. Chỉ dùng asset **tự tạo** trong repo, có hợp đồng chuyển giao, hoặc giấy phép rõ ràng cho sản phẩm công khai (CC0, CC BY có ghi công, SIL OFL, ISC/MIT cho biểu tượng). Repo **public** → không commit asset chưa rõ quyền.
2. Không dùng nhân vật/hình của SGK, Disney, Nintendo hay thương hiệu khác; avatar không mô phỏng trẻ thật.
3. Mỗi asset có một dòng trong `licenses.json`: `id`, `name`, `kind`, `paths` (tệp tồn tại, có thể kèm `#TênThànhPhần`), `author`, `source`, `license`, `usage`, `createdAt`, `review`.
4. Asset học liệu (`character`, `avatar`, `scene`, `icon`) bắt đầu ở `pending_review`. Chỉ được `approved` khi **giáo viên** duyệt: `teacherReviewed: true`, `reviewedBy`, `reviewedAt` — bộ kiểm tra báo lỗi nếu thiếu. AI/công cụ không bao giờ tự duyệt.
5. Phông chữ tải qua `next/font` lúc build — **không commit tệp phông** (unit test quét `.ttf/.otf/.woff*`).
6. Biểu tượng Lucide chỉ dùng cho điều khiển phụ (nút, nhãn), **không** làm nhân vật hay cảnh quan.

## 2. Asset của R02

Tất cả do dự án tự vẽ bằng mã SVG trong phiên Claude Code R02 (2026-10-20), không dùng công cụ tạo ảnh hay dịch vụ ngoài, không phát sinh chi phí (RQ-M2). Giấy phép: tác phẩm gốc của dự án, quyền thuộc chủ dự án.

| id | Tên | Tệp (thành phần) | Dùng ở |
|---|---|---|---|
| `art.character.hero-kid` | Bạn nhỏ thám hiểm — nhân vật học sinh phiêu lưu | `src/components/art/characters.tsx` (`HeroKid`) | Trang chủ, khu duyệt học liệu |
| `art.character.guide-owl` | Cú Bông — nhân vật hướng dẫn | `characters.tsx` (`GuideOwl`) | Trang chủ, `/learn`, khu duyệt |
| `art.character.friendly-monster` | Bé Mây Bông — quái vật thân thiện (không răng, không móng vuốt) | `characters.tsx` (`FriendlyMonster`) | Bảng chi tiết trò chơi, khu duyệt |
| `art.avatar.may` · `bong` · `na` · `ti` · `bin` | 5 avatar hình người (tóc búi, tóc xoăn, tóc ngắn, đội mũ, đeo kính) | `src/components/art/avatars.tsx` (`KidAvatar`) — danh mục `src/features/avatars/catalog.ts` | `/learn`, `/demo`, bảng xếp hạng minh họa |
| `art.icon.treasure-chest` | Rương kho báu | `src/components/art/treasure.tsx` (`TreasureChest`) | Khu duyệt; đích của Mê cung |
| `art.icon.honor-podium` | Bục vinh danh ba bậc | `treasure.tsx` (`HonorPodium`) | Giới thiệu vinh danh (khu GV) |
| `art.scene.treasure-maze` | Cảnh Mê cung kho báu | `src/components/art/scenes.tsx` (`MazeScene`) | Thẻ trò chơi |
| `art.scene.wonder-forest` | Cảnh Rừng chữ kỳ diệu | `scenes.tsx` (`ForestScene`) | Thẻ trò chơi |
| `art.scene.tone-island` | Cảnh Đảo dấu thanh (5 phao dấu thanh vẽ bằng nét) | `scenes.tsx` (`IslandScene`) | Thẻ trò chơi |
| `art.scene.rhyme-castle` | Cảnh Lâu đài ghép vần | `scenes.tsx` (`CastleScene`) | Thẻ trò chơi |
| `art.scene.world-map` | Bản đồ thế giới (trạm luyện tập + 4 vùng, sương mù vùng khóa) | `src/components/art/world-map.tsx` | `/learn` |
| `art.scene.hero-landscape` | Phông cảnh thế giới kỳ diệu | `src/components/art/hero-landscape.tsx` | Trang chủ |
| `art.scene.map-tiles` | 8 ô mốc khám phá (đồi hoa, ao sen, lũy tre, ruộng lúa, cầu gỗ, đồi thả diều, làng đèn lồng, đài ngắm sao) + ô sương mù | `src/components/art/map-tiles.tsx` | `/learn` |
| `art.icon.adventure-ui` | Ngôi sao điểm, trái tim HP | `score-badge.tsx`, `heart-indicator.tsx` | Ô điểm, chỉ báo HP |
| `art.logo.readmate` | Biểu trưng (từ GĐ2) | `src/components/layout/logo.tsx` | Mọi trang |
| `font.be-vietnam-pro`, `font.andika` | Phông chữ | `src/app/fonts.ts` | SIL OFL 1.1, tải lúc build |
| `icons.lucide` | lucide-react 1.55.0 | `package.json` | ISC, chỉ điều khiển phụ |

Đã gỡ ở R02: `mascot-owl.tsx`, `syllable-builder-art.tsx` (GĐ2, thay bằng bộ nhân vật mới).

## 3. Việc giáo viên cần làm

- Xem bộ phác thảo ở **`/teacher#duyet-hoc-lieu`** (hoặc chạy `npm run dev` → http://localhost:3000/teacher#duyet-hoc-lieu) và góp ý: không gây sợ cho trẻ 6 tuổi, gần gũi, không giống trẻ thật, tên gọi phù hợp (RQ-M1, RQ-M5).
- Khi duyệt: cập nhật dòng tương ứng (`status: "approved"`, `teacherReviewed: true`, `reviewedBy`, `reviewedAt`) — từ R10 sẽ có giao diện duyệt, hiện chỉnh tay có commit ghi rõ người duyệt.

## 4. Thêm asset mới

1. Vẽ SVG trong `src/components/art/` (dùng `useSvgIds` cho id gradient, `artA11y(title)` cho trợ năng), hoặc đặt tệp có giấy phép vào `public/` (chỉ khi có nguồn rõ ràng).
2. Thêm dòng vào `content/media/licenses.json` (`pending_review`).
3. `npm run content:check` → 0 lỗi; `npm run test:run` (unit test báo nếu tệp art chưa có dòng giấy phép).
