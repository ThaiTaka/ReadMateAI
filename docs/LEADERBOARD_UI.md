# ReadMate AI — Giao diện bảng xếp hạng (R05)

> **Trạng thái: ĐÃ HIỆN THỰC (R05).** Mã: `src/components/leaderboard/{leaderboard-board,score-bar,demo-leaderboard}.tsx`, `src/features/leaderboard/ui/student-leaderboard.tsx`, `src/app/learn/leaderboard/`, `src/app/teacher/(console)/classes/[classId]/leaderboard/`, `src/app/teacher/(present)/…/present/`, `src/app/(site)/demo/page.tsx`. Câu chữ: `vi.leaderboard.*`.
> Tài liệu liên quan: [LEADERBOARD_SPEC §4–§6](LEADERBOARD_SPEC.md) · [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) · [AVATAR_SYSTEM.md](AVATAR_SYSTEM.md) · [RANKING_ENGINE.md](RANKING_ENGINE.md)

## 1. Bốn nơi dùng chung một bộ thành phần

| Nơi | Route | Dữ liệu | Ghi chú |
|---|---|---|---|
| Học sinh | `/learn/leaderboard` | **Thật** — `GET /api/student/leaderboard` ở trình duyệt | HTML ban đầu không chứa tên/điểm của bạn nào; `noindex` |
| GV — quản trị | `/teacher/classes/[classId]/leaderboard` | **Thật** — `teacher_leaderboard_overview` (JWT GV) | Bảng nội bộ + đối soát; bật/tắt; kiểu hiển thị |
| GV — trình chiếu | `/teacher/classes/[classId]/leaderboard/present` | **Thật** — `teacher_leaderboard_display` | Toàn màn hình, route group `(present)` **không có thanh bên** |
| Bản chơi thử | `/demo` | **Hư cấu** trong state phiên | Nhãn "BẢN CHƠI THỬ – DỮ LIỆU MINH HỌA"; không API, không CSDL |

## 2. Một hàng

`Hạng` · huy hiệu · `Avatar` · `Tên` · **thanh điểm ngang** · `Điểm` — `LeaderboardRowView`.

- **Điện thoại (< 640 px):** hạng (cột hẹp) · avatar · khối giữa gồm **tên (dòng trên, cắt bằng "…")** và **thanh (dòng dưới)** · số điểm cố định bên phải. Không cuộn ngang; thanh không che tên (kiểm thử đo giao nhau hình chữ nhật).
- **Máy tính bảng / máy tính (≥ 640 px):** một dòng `hạng · avatar · tên (w-44) · thanh · điểm`; trình chiếu dùng cỡ `xl` (chữ 4xl–6xl, avatar lớn, thanh 32 px).
- **Trợ năng:** mỗi hàng có `<span class="sr-only">Hạng 2, Bống, 80 điểm</span>` (hàng của con: "Hạng 2, Na (con), 80 điểm"); phần nhìn thấy `aria-hidden`; thanh `aria-hidden` (số điểm là nội dung chính). Danh sách `<ol aria-label>`.

## 3. Thanh điểm (`ScoreBar`)

- Chiều dài = `calculateBarWidth(points, maxPoints)`; 0 điểm ⇒ rỗng (chỉ còn đường nền); cả lớp 0 ⇒ mọi thanh rỗng.
- Một màu thương hiệu cho **mọi** hàng (ngọc → vàng nhạt); dải màu căn theo **cả đường nền** (`background-size`), nên hàng ngắn và dài cùng màu ở cùng vị trí. Không tô đỏ/xám hàng cuối.
- Hoạt cảnh: lớn dần ≤ 500 ms (`transition-[width,background-size]`) từ 0 lúc xuất hiện và khi điểm đổi. Giảm chuyển động (`prefers-reduced-motion` **hoặc** công tắc `[data-motion="reduce"]`) ⇒ chuyển tiếp ≈ 0 (CSS toàn cục).

## 4. Huy hiệu và hạng

- Chip hạng: 1 vàng, 2 bạc, 3 đồng; các hạng khác trung tính. Huy hiệu hình trên avatar: vương miện (hạng 1), huy chương (hạng 2–3) + số hạng + chữ "Hạng n" cho trình đọc ⇒ **không chỉ dựa vào màu**.
- **Chỉ hạng có điểm > 0** mới có chip vàng/bạc/đồng, huy hiệu và avatar nhún (`animate-bob`, chỉ hạng 1): cả lớp cùng 0 điểm ⇒ không ai được "vương miện". Đồng hạng nhận cùng huy hiệu.
- Hàng của con: viền + vầng sáng vàng và nhãn "Con" (không đổi màu thanh).
- Không biểu tượng/ngôn ngữ gây xấu hổ (`vi.leaderboard.*` được unit test quét các từ "cuối bảng, bét, thua, kém, tụt hạng"; không màu cảnh báo `coral/red/rose`).

## 5. Trang học sinh

`StudentLeaderboard` (client) — các trạng thái:

| Trạng thái | Hiển thị |
|---|---|
| Đang tải | Khung chờ (skeleton 5 hàng) + `role="status"` |
| Có dữ liệu | Bảng; "Điểm của con: N" (từ `/api/student/home`); nút **Cập nhật bảng**; lời nhắn trung tính khi em chưa hiện trên bảng |
| Bảng tắt (`disabled`) | "Bảng điểm của lớp hiện chưa được mở. Con vẫn có thể tiếp tục luyện tập và tích điểm nhé!" — **không** có dữ liệu bảng trong payload |
| Chưa có mùa | "Mùa mới sắp bắt đầu…" |
| Bảng trống | "Bảng điểm đang chờ các bạn…" |
| Tất cả 0 điểm | Thanh rỗng + "Mùa mới vừa bắt đầu — mọi người cùng xuất phát từ 0 điểm" |
| Lỗi / mất mạng | Thẻ `role="alert"` + nút **Thử lại** (phân biệt không có mạng) |

Tải khi mở trang, khi quay lại thẻ trình duyệt (`visibilitychange`) và khi bấm nút; trong lúc làm mới **giữ bảng cũ** (không nhảy bố cục). Không localStorage/sessionStorage, không tham số URL cho điểm. Lối vào: thẻ "Bảng điểm của lớp" ở `/learn/me` và mục "Bảng điểm" ở thanh dưới điện thoại.

## 6. Giáo viên

- **Quản trị:** trạng thái (Đang bật/tắt) · cài đặt (hộp bật + kiểu TOP 10 + con / toàn bộ lớp; chỉ GV chủ nhiệm lưu được) · ghi chú khi cờ hệ thống chưa được chấp thuận · nút trình chiếu (khóa kèm lý do khi bảng tắt) · **bảng nội bộ** (thanh điểm + bảng số: hạng, điểm hiện tại, điểm tích lũy, "Có trên bảng"/"Chưa hiện trên bảng" kèm lý do) · hai nút **Vinh danh TOP 3** và **Reset điểm – bắt đầu mùa mới** **đã khóa**, ghi "Sắp có ở giai đoạn tiếp theo (R06)".
- **Trình chiếu:** layout riêng (không thanh bên → bàn phím không "lạc" vào menu), chữ lớn, nút Giảm chuyển động · Cập nhật · Toàn màn hình (Fullscreen API) · Thoát trình chiếu. Dữ liệu lấy từ hàm CSDL riêng, **không** dùng dữ liệu quản trị.

## 7. Responsive và trợ năng đã kiểm thử

Playwright (Supabase local): Chromium desktop, Pixel 7, iPhone 13 (WebKit), iPad (WebKit) và các khung 360/375/390/768/1024/1440 px: không cuộn ngang, không hàng tràn, thanh không che tên, nút ≥ 40 px, axe không lỗi critical/serious, bàn phím tới được "Cập nhật bảng" với vòng focus, giảm chuyển động tắt hoạt cảnh. Ảnh chụp: `test-results/r05-screens/` (không commit).

## 8. Giới hạn

- Hoạt cảnh chỉ trên thanh/huy hiệu/avatar hạng 1; chưa có hoạt cảnh đổi vị trí hàng (hàng sắp lại ngay khi dữ liệu mới).
- Avatar vẫn `pending_review` (chờ GV duyệt — RQ-M1, RQ-L3).
- Vinh danh/reset chưa có (R06).
