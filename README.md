# ReadMate AI

> **Học Tiếng Việt, khám phá thế giới kỳ diệu**
> *Tự luyện mỗi ngày – Tích điểm, mở khóa và phiêu lưu cùng tri thức*

ReadMate AI là **nền tảng tự luyện Tiếng Việt tại nhà kết hợp trò chơi phiêu lưu, điểm thưởng và bảng xếp hạng lớp học** cho học sinh lớp 1 — nhận diện chữ, âm, vần, đánh vần, đọc trơn và phát triển vốn từ. Học sinh luyện ở nhà với lời đọc yêu cầu, hình ảnh và gợi ý; mỗi câu đúng được điểm thưởng để khám phá bản đồ và mở các mini-game phiêu lưu (câu hỏi trong game vẫn là câu hỏi Tiếng Việt). Giáo viên quản lý và duyệt nội dung, theo dõi kết quả, vinh danh TOP 3 và tổ chức các mùa thi đua.

> **Trạng thái (2026-10-20): Giai đoạn R04 — Scoring Engine, chấm bài ở máy chủ, điểm thưởng và mở khóa bản đồ hoàn thành trên Supabase LOCAL** (chờ người điều phối đánh giá). Điểm thật chỉ chạy với **nội dung fixture kiểm thử hư cấu** trên máy dev — học liệu thật chưa được duyệt. Xem mục [Điểm thưởng…](#điểm-thưởng-buổi-luyện-có-điểm-bản-đồ-khám-phá-giai-đoạn-r04--supabase-local).
>
> **Lịch sử R02 — giao diện mới "Modern 2D Educational Adventure"** (nhánh `feature/home-learning-redesign`). Trang chủ, trang học sinh `/learn` (Student Adventure Dashboard + Game World), phần xem trước Game World ở `/demo` và khu giáo viên đã thiết kế lại; nhân vật, avatar, quái vật và bốn bản đồ là **SVG tự vẽ — bản phác thảo chờ giáo viên duyệt**. Điểm, bản đồ, bảng xếp hạng **chỉ là dữ liệu minh họa hư cấu** (không lưu, không gửi); điểm thật, tài khoản, mini-game chơi được thuộc R03–R09. Thiết kế: [docs/PRODUCT_REDESIGN.md](docs/PRODUCT_REDESIGN.md) · [docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md) · [docs/ASSET_MANIFEST.md](docs/ASSET_MANIFEST.md) · lộ trình [REDESIGN_TASKS.md](REDESIGN_TASKS.md) · tiến độ [REDESIGN_PROGRESS.md](REDESIGN_PROGRESS.md).

Đã có từ GĐ3–GĐ4 và vẫn giữ nguyên: thư viện phân tích tiếng Việt, kho tri thức có kiểm thử, **bộ máy bài tập sáu dạng / 17 biến thể** (sinh bài theo quy tắc, chống lộ đáp án, mức hỗ trợ H3 → H0 — H0 nay gọi là **"Tự làm"**) và bản chơi thử tương tác `/demo`. **Chưa** có âm thanh, tài khoản, cơ sở dữ liệu, lưu kết quả hay AI; toàn bộ nội dung **đang chờ giáo viên duyệt**.

## Yêu cầu

- Node.js **24.x** (xem `.nvmrc`) và npm 11.
- Để chạy kiểm thử E2E: trình duyệt của Playwright (Chromium, WebKit).
- Để dùng tài khoản/CSDL (R03): **Docker Desktop** đang chạy (Supabase local) — chi tiết [docs/SUPABASE_SETUP.md](docs/SUPABASE_SETUP.md).

## Cài đặt

```bash
npm ci
npx playwright install chromium webkit   # chỉ cần cho kiểm thử E2E
```

Không có `.env.local`: trang công khai và `/demo` vẫn chạy; đăng nhập GV và `/join` báo "chưa cấu hình máy chủ dữ liệu". Có Supabase local:

```bash
npm run db:start   # Supabase local (Docker), áp dụng mọi migration
npm run db:env     # tạo .env.local từ Supabase LOCAL (không in khóa) — KHÔNG commit
npm run db:seed    # dữ liệu GIẢ: 2 GV, 2 lớp × 3 học sinh (chạy lặp lại được)
```

Tệp `.env.example` liệt kê mọi biến; **không bao giờ commit** tệp chứa giá trị thật.

## Chạy trên máy

```bash
npm run dev
```

Mở <http://localhost:3000>.

Xem trên điện thoại thật cùng mạng Wi-Fi: chế độ dev của Next.js 16 chặn yêu cầu từ địa chỉ khác `localhost` (tùy chọn `allowedDevOrigins`), nên hãy dùng bản production:

```bash
npm run build
npm run start -- --hostname 0.0.0.0
```

rồi mở `http://<địa-chỉ-IP-máy-tính>:3000` trên điện thoại (Windows có thể hỏi cho phép Node.js qua tường lửa). Cách nhanh hơn: chế độ giả lập thiết bị trong công cụ dành cho nhà phát triển của trình duyệt.

## Kiểm thử và kiểm tra chất lượng

| Lệnh | Nội dung |
|---|---|
| `npm run lint` | ESLint (cấu hình `eslint-config-next`) |
| `npm run typecheck` | Sinh kiểu route (`next typegen`) rồi `tsc --noEmit` |
| `npm run test` | Vitest ở chế độ theo dõi |
| `npm run test:run` | Vitest chạy một lần: unit test, component test, kiểm tra vệ sinh repo |
| `npm run test:e2e` | Playwright: tự build production, chạy `next start` ở cổng 3100, kiểm thử trên Chromium và WebKit (desktop + điện thoại) và iPad (riêng bản chơi thử, bố cục); có kiểm tra trợ năng bằng axe |
| `npm run format` / `npm run format:check` | Prettier |
| `npm run content:check` | Kiểm tra kho tri thức `content/`: JSON/lược đồ, ID, NFC, tham chiếu, chính tả, kiểm duyệt, dữ liệu cá nhân. Lỗi → thoát mã 1; cảnh báo = việc cần giáo viên rà soát |
| `npm run check:bundle` | Sau `build`: quét `.next/static` không chứa khóa secret hay giá trị secret của môi trường |
| `npm run db:lint` · `npm run db:test` | (cần Supabase local) Lint bảo mật CSDL · pgTAP: RLS mọi bảng, quyền, ràng buộc |
| `npm run test:db` | (cần Supabase local) Kiểm thử tích hợp RLS, thẻ học, xác thực bằng JWT thật |
| `npm run test:e2e:db` | (cần Supabase local + `db:env` + `db:seed`) Playwright luồng GV → thẻ học → thiết bị Android/iPhone → thu hồi |
| `npm run db:reset` · `db:sync-content` · `db:types` | Dựng lại CSDL từ migration · đồng bộ `content/` vào CSDL · sinh lại kiểu TypeScript |

Kết quả E2E (ảnh chụp từng trang, báo cáo HTML) nằm trong `test-results/` và `playwright-report/` — đã được bỏ qua trong Git.

## Build production

```bash
npm run build
npm run start
```

## Cấu trúc thư mục chính

```text
src/
├── app/                    # App Router
│   ├── (site)/             # Trang công khai có header/footer: / · /demo · /join
│   ├── teacher/            # Khung khu vực giáo viên (/teacher)
│   ├── learn/              # Student Adventure Dashboard + Game World (/learn) — dữ liệu minh họa
│   ├── layout.tsx          # Layout gốc: lang="vi", font, metadata
│   ├── fonts.ts            # Be Vietnam Pro (giao diện) + Andika (học liệu đọc)
│   └── globals.css         # Tailwind CSS 4 + style nền
├── components/
│   ├── ui/                 # Button, Card, Badge, Notice, EmptyState, LoadingState, Tabs…
│   ├── layout/             # Header, menu di động, footer, sidebar giáo viên, điều hướng học sinh
│   ├── learning/           # Biểu tượng hướng dẫn, màu/biểu tượng lộ trình
│   ├── kid/                # Thành phần cho trẻ: thẻ chọn ≥ 64px, tranh, dấu thanh SVG, nút âm thanh (khóa), phản hồi, tiến độ
│   ├── adventure/          # R02: nút phiêu lưu, thẻ game/khóa, bản đồ, ô điểm, avatar, huy hiệu, dialog, giảm chuyển động…
│   └── art/                # R02: nhân vật, avatar, quái vật, kho báu, 4 cảnh game, bản đồ thế giới (SVG tự vẽ, chờ GV duyệt)
├── config/                 # site.ts (điều hướng), security-headers.ts (CSP, Permissions-Policy…)
├── features/               # exercises/ (bộ máy bài tập 6 dạng — GĐ4), learning-paths/ (3 lộ trình), demo/ (dữ liệu minh họa hư cấu),
│                           # gamification/ (hằng số điểm + hàm mở khóa thuần), game-world/ (4 game, mốc bản đồ), avatars/, media/ (kiểm giấy phép),
│                           # knowledge/ (kho tri thức: nạp, hồ sơ lớp, kiểm tra ngữ liệu, content:check)
├── lib/                    # cn.ts, vietnamese/ (NFC, thanh, phân tích tiếng, chính tả, giải mã, độ khó)
├── strings/vi.ts           # Toàn bộ câu chữ giao diện tiếng Việt
├── styles/tokens.css       # Design tokens (màu, cỡ chữ, vùng chạm, bo góc, đổ bóng)
└── types/learning.ts       # Kiểu dùng chung
content/                    # Kho tri thức (JSON): kb/, curriculum/; media/licenses.json (giấy phép mọi asset hình ảnh, phông chữ)
scripts/content-check.ts    # npm run content:check
tests/
├── unit/                   # Vitest + Testing Library (vietnamese/, knowledge/ từ GĐ3; exercises/ từ GĐ4)
└── e2e/                    # Playwright
docs/                       # PRD, kiến trúc, mô hình dữ liệu, bộ máy tiếng Việt, bộ máy bài tập, phiếu rà soát cho GV
```

## Xem thử (Giai đoạn R02)

1. `npm ci` (lần đầu), rồi `npm run dev` → <http://localhost:3000> (hoặc `npm run build && npm run start`).
2. **Trang chủ** `/`: thông điệp mới, ba bước, ba lộ trình, bốn vùng Game World, công cụ dự kiến cho giáo viên.
3. **Student Dashboard** `/learn` — hồ sơ hư cấu **Mây, 135 điểm** (nhãn "BẢN CHƠI THỬ – DỮ LIỆU MINH HỌA"): avatar, ô điểm, huy hiệu; **Game World** (`/learn#game-world`): bản đồ, 4 thẻ khu vực (Mê cung, Rừng chữ: đủ điểm; Đảo dấu thanh, Lâu đài: còn khóa) → **Xem chi tiết** mở bảng thông tin; nút "Vào chơi – Sắp có" bị khóa (chưa có game). Mốc khám phá mỗi 30 điểm, công tắc **Giảm chuyển động** ở đầu trang.
4. **Bản chơi thử** `/demo`: chọn lộ trình → mức hỗ trợ (H3 → H0 "Tự làm") → **Bắt đầu buổi luyện** (ôn bài cũ → luyện tập → thử thách tự làm) hoặc **Làm thử** một dạng bài → kết quả → **Về Game World**. Phần **Xem trước Game World** có avatar, ô điểm, 4 vùng đất, bảng xếp hạng hư cấu.
5. **Giáo viên** `/teacher`: menu mới (Bảng điểm, Vinh danh, Mùa thi đua… "Sắp có"), bản phác thảo nhân vật chờ duyệt ở mục **Duyệt học liệu**.
6. **Trên điện thoại:** công cụ giả lập thiết bị của trình duyệt (360–390 px), hoặc xem bằng điện thoại thật cùng Wi-Fi (mục "Chạy trên máy").

Mọi dữ liệu minh họa **chưa được giáo viên duyệt**, **không có âm thanh**, không tài khoản, không lưu, không gửi dữ liệu đi đâu. Chi tiết: [docs/EXERCISE_ENGINE.md](docs/EXERCISE_ENGINE.md), [docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md).

## Điểm thưởng, buổi luyện có điểm, bản đồ khám phá (Giai đoạn R04 — Supabase local)

1. `npm run db:start`, `npm run db:env`, `npm run db:seed` (cài thêm **nội dung fixture kiểm thử hư cấu** và lớp "Thử Điểm" có tiến độ đã xác nhận trên chuỗi bài kiểm thử — chỉ trên Supabase local), rồi `npm run dev`.
2. GV `co.mai` → lớp **Thử Điểm** → Học sinh → thêm học sinh, ghi nhận đồng ý *Dữ liệu học tập* (giả), chọn lộ trình, **Cấp thẻ học mới** → mở liên kết/mã dự phòng ở trình duyệt khác.
3. `/learn/me`: điểm hiện tại + điểm tích lũy, **Luyện Tiếng Việt** → `/learn/me/practice`: chọn đáp án → **Kiểm tra** → máy chủ chấm: đúng **+10**, sai **−5** (sàn 0, hiển thị trung tính); tải lại giữ nguyên câu và điểm.
4. Mỗi 30 điểm tích lũy: một lượt **khám phá ô bản đồ** (chạm ô sương mù kề vùng đã mở). Đủ 50/120/200/300 **điểm hiện tại**: khu vực game "Đủ điểm" — mini-game **đang phát triển** (chưa chơi được).
5. Học liệu thật **chưa có mục nào được GV duyệt** và hồ sơ lớp 1A2 chưa xác nhận → lớp thật luôn nhận "chưa có bài luyện" (đúng thiết kế). Tài liệu: [docs/SCORING_ENGINE.md](docs/SCORING_ENGINE.md) · [docs/QUESTION_INSTANCE_SERVICE.md](docs/QUESTION_INSTANCE_SERVICE.md) · [docs/MAP_UNLOCK_ENGINE.md](docs/MAP_UNLOCK_ENGINE.md) · [docs/R04_DATABASE_MIGRATIONS.md](docs/R04_DATABASE_MIGRATIONS.md).

## Tài khoản, lớp học, thẻ học (Giai đoạn R03 — Supabase local)

1. `npm run db:start`, `npm run db:env`, `npm run db:seed`, rồi `npm run dev`.
2. **Giáo viên** `/login`: tài khoản giả `co.mai` hoặc `thay.binh` @ `readmate.test`, mật khẩu = `SEED_TEACHER_PASSWORD` trong `.env.local`. Không có tự đăng ký.
3. `/teacher/classes` → lớp (đổi tên, tiến độ chương trình "Chưa xác nhận", bảng xếp hạng **tắt và bị khóa**, nhật ký) → **Học sinh** → thêm biệt danh + avatar → mở hồ sơ: lộ trình, tên hiển thị + duyệt, **đồng ý hai phạm vi** (dữ liệu giả), **Cấp thẻ học mới** (QR + mã dự phòng hiện một lần), thiết bị + thu hồi.
4. **Phụ huynh** mở liên kết QR (hoặc `/join` + mã dự phòng) ở trình duyệt khác/điện thoại → `/learn/me` (trang của con: avatar, giảm chuyển động). GV thu hồi thiết bị → tải lại là mất quyền.
5. Toàn bộ là **dữ liệu giả trên máy**. Chưa có dự án Supabase Cloud, chưa deploy, chưa dùng cho học sinh thật. Tài liệu: [docs/AUTHENTICATION.md](docs/AUTHENTICATION.md) · [docs/STUDENT_ACCESS.md](docs/STUDENT_ACCESS.md) · [docs/RLS_SECURITY.md](docs/RLS_SECURITY.md) · [docs/SUPABASE_SETUP.md](docs/SUPABASE_SETUP.md).

## Bộ máy bài tập (Giai đoạn 4)

- `src/features/exercises/`: mỗi dạng bài là một module (`schema`, `variants`, `runtime`, `module`, `generate`, `Player`) — 6 dạng, 17 biến thể; chuỗi kiểm tra 9 bước dùng bộ máy tiếng Việt; chính sách âm thanh theo mục tiêu học tập; bộ chạy phiên là reducer thuần; kết quả buổi luyện chỉ trong bộ nhớ.
- Hai chế độ nội dung: **demo** (hồ sơ minh họa, dữ liệu chờ duyệt có cảnh báo) và **học thật** (chỉ hồ sơ đã xác nhận + nội dung đã duyệt — hiện chưa có nên không tạo bài nào, đúng thiết kế).
- Tài liệu: [docs/EXERCISE_ENGINE.md](docs/EXERCISE_ENGINE.md).

## Bộ máy tiếng Việt và kho tri thức (Giai đoạn 3)

- **Thư viện** `src/lib/vietnamese/`: chuẩn hóa NFC và soát văn bản (ký tự ẩn, dấu sót, dấu hiệu bảng mã cũ TCVN3/VNI — chỉ phát hiện, không tự sửa); tách dấu thanh; phân tích tiếng thành âm đầu – âm đệm – âm chính – âm cuối – thanh theo **danh mục 153 vần**; quy tắc chính tả c/k, g/gh, ng/ngh, qu, iê/yê, nguyên âm đôi, âm cuối p/t/c/ch; vị trí dấu thanh; kiểm tra “đọc được bằng kiến thức đã học” với 4 kết luận `readable` / `not_yet_learned` / `unknown` / `invalid`; ước lượng độ khó.
- **Kho tri thức** `content/`: 29 chữ cái, 39 âm (11 tổ hợp chữ), 6 thanh, 153 vần, 13 quy tắc, 17 cặp dễ nhầm, quan hệ tiên quyết, 149 mục ngữ liệu nguyên bản (58 tiếng, 60 từ, 31 câu). **Chưa mục nào được duyệt.**
- **Tiến độ học tập**: hồ sơ lớp 1A2 **chưa được giáo viên xác nhận** (chưa biết bộ sách, vị trí bài, quy ước) nên mọi kiểm tra theo lớp 1A2 trả về “chưa xác định”; chuỗi bài minh họa chỉ dùng để kiểm thử.
- Tài liệu: [docs/VIETNAMESE_ENGINE.md](docs/VIETNAMESE_ENGINE.md) · Phiếu rà soát cho giáo viên: [docs/TEACHER_REVIEW_CHECKLIST.md](docs/TEACHER_REVIEW_CHECKLIST.md).

## Chức năng đã có (Giai đoạn 2)

- Trang chủ `/`: GĐ2 giới thiệu theo định hướng cũ — **R02 đã viết lại** theo định hướng tự luyện tại nhà + phiêu lưu.
- `/demo`: GĐ2 là trang giới thiệu; từ GĐ4 là **bản chơi thử tương tác** (xem mục trên).
- `/teacher`: khung bảng điều khiển giáo viên — **từ R03 cần đăng nhập**; lớp/học sinh hoạt động ở `/teacher/classes`.
- `/learn`: GĐ2 là khung góc học tập — **R02 thành Student Adventure Dashboard** (dữ liệu minh họa, không lưu).
- `/join`: GĐ2 là giao diện chuẩn bị — **từ R03 nhận mã thẻ học thật** (QR hoặc mã dự phòng).
- Design system (màu, typography, khoảng cách, nút, thẻ, badge, thông báo, trạng thái trống/đang tải, tab, điều hướng), hỗ trợ bàn phím và trình đọc màn hình cơ bản.
- Header bảo mật: CSP, `X-Content-Type-Options`, `Referrer-Policy` (riêng `/join` là `no-referrer`), `Permissions-Policy` tắt camera/microphone/định vị, `X-Frame-Options`; không có `X-Powered-By`.
- Font tự host lúc build (trình duyệt không gửi yêu cầu tới Google); không có script hay tài nguyên bên thứ ba.

## Chức năng chưa phát triển (lộ trình R02 → R11)

Đã có ở R03–R04 (Supabase local): cơ sở dữ liệu, đăng nhập giáo viên, liên kết thiết bị, đồng ý của phụ huynh; điểm thưởng chấm ở máy chủ, sổ cái điểm, mở khóa bản đồ, điều kiện mini-game (R04). Chưa có: dự án Supabase Cloud, CAPTCHA `/join`, quên mật khẩu GV; bảng xếp hạng lớp và avatar (R05), vinh danh TOP 3 và mùa thi đua (R06), Mê cung kho báu và quái vật (R07–R08), ba mini-game khác (R09), âm thanh, giao diện duyệt nội dung, góc phụ huynh, dashboard (R10), kiểm thử tổng thể và triển khai Vercel (R11). AI hỗ trợ giáo viên tạo bài: sau R11. Phiếu PDF ở lớp: **bỏ khỏi lộ trình**.

## Triển khai

Đã chuẩn bị cho Vercel: `engines.node = 24.x`, `vercel.json` đặt region Functions `sin1` (Singapore). **Chưa** tạo dự án Vercel và chưa deploy. Ứng dụng không ghi dữ liệu lâu dài vào hệ thống tệp của Vercel Functions.

## Tài liệu dự án

- **Tài khoản và dữ liệu R03:** [docs/AUTHENTICATION.md](docs/AUTHENTICATION.md) · [docs/STUDENT_ACCESS.md](docs/STUDENT_ACCESS.md) · [docs/RLS_SECURITY.md](docs/RLS_SECURITY.md) · [docs/SUPABASE_SETUP.md](docs/SUPABASE_SETUP.md)
- **Giao diện R02:** [docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md) — hệ thống thiết kế · [docs/ASSET_MANIFEST.md](docs/ASSET_MANIFEST.md) — asset và giấy phép
- **Tái thiết kế (R01, phần lớn PLANNED):** [docs/PRODUCT_REDESIGN.md](docs/PRODUCT_REDESIGN.md) — định hướng mới · [docs/GAMIFICATION_SPEC.md](docs/GAMIFICATION_SPEC.md) — điểm, mở khóa, mùa · [docs/GAME_DESIGN.md](docs/GAME_DESIGN.md) — game · [docs/LEADERBOARD_SPEC.md](docs/LEADERBOARD_SPEC.md) — bảng xếp hạng, vinh danh · [docs/REDESIGN_ARCHITECTURE.md](docs/REDESIGN_ARCHITECTURE.md) — kiến trúc, dữ liệu · [docs/PRIVACY_AND_SECURITY.md](docs/PRIVACY_AND_SECURITY.md) — quyền riêng tư · [REDESIGN_TASKS.md](REDESIGN_TASKS.md) · [REDESIGN_PROGRESS.md](REDESIGN_PROGRESS.md)
- Báo cáo PDF (định hướng cũ, lập 2026-10-16): [docs/BaoCao_ReadMateAI.pdf](docs/BaoCao_ReadMateAI.pdf) · [docs/LuongHoatDong_ReadMateAI.pdf](docs/LuongHoatDong_ReadMateAI.pdf)
- [docs/PRD.md](docs/PRD.md) — yêu cầu sản phẩm (một phần đã được thay thế, xem đầu tệp)
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — kiến trúc kỹ thuật
- [docs/DATA_MODEL.md](docs/DATA_MODEL.md) — mô hình dữ liệu dự kiến
- [docs/EXERCISE_ENGINE.md](docs/EXERCISE_ENGINE.md) — bộ máy bài tập và bản chơi thử
- [docs/VIETNAMESE_ENGINE.md](docs/VIETNAMESE_ENGINE.md) — bộ máy tiếng Việt và kho tri thức · [docs/TEACHER_REVIEW_CHECKLIST.md](docs/TEACHER_REVIEW_CHECKLIST.md) — phiếu rà soát cho giáo viên
- [TASKS.md](TASKS.md) — kế hoạch GĐ1–GĐ4 (lịch sử) · [PROGRESS.md](PROGRESS.md) — lịch sử tiến độ GĐ1–GĐ4
- [CLAUDE.md](CLAUDE.md) — quy tắc phát triển bắt buộc · [AGENTS.md](AGENTS.md) — ghi chú của Next.js cho trợ lý lập trình

## Bảo vệ dữ liệu trẻ em

Dự án chưa thu thập dữ liệu học sinh thật: R03 chỉ chạy với Supabase local và dữ liệu hư cấu; hồ sơ học sinh chỉ gồm biệt danh, số thứ tự, avatar có sẵn; RLS bật cho mọi bảng ([docs/RLS_SECURITY.md](docs/RLS_SECURITY.md)). Bản chơi thử chỉ giữ kết quả trong bộ nhớ của trang (không lưu, không gửi đi, không dùng localStorage). Kho tri thức chỉ chứa ngữ liệu minh họa và tên nhân vật hư cấu; `npm run content:check` chặn chuỗi giống email/số điện thoại/số định danh và các trường dữ liệu cá nhân. Repository đang **công khai**: không commit secret, dữ liệu thật hay bản xuất cơ sở dữ liệu. Các quy tắc chi tiết nằm ở [CLAUDE.md](CLAUDE.md) §6.

## Giấy phép

- Font Be Vietnam Pro và Andika: SIL Open Font License 1.1 (tải qua `next/font/google`).
- Biểu tượng và tranh minh họa tạm của bản chơi thử: [Lucide](https://lucide.dev) (ISC; một phần gốc Feather — MIT) — chỉ cho điều khiển phụ và tranh câu hỏi.
- Nhân vật, avatar, cảnh Game World (R02): tác phẩm gốc của dự án, SVG tự vẽ, chờ giáo viên duyệt — danh mục [content/media/licenses.json](content/media/licenses.json), [docs/ASSET_MANIFEST.md](docs/ASSET_MANIFEST.md).
- Mã nguồn dự án: chưa chọn giấy phép — chủ dự án sẽ quyết định.
