# ReadMate AI

> **Mỗi em một nhịp đọc – Mỗi ngày một tiến bộ**

ReadMate AI là nền tảng hỗ trợ học sinh lớp 1 luyện Tiếng Việt — nhận diện chữ, âm, vần, đánh vần, đọc trơn và phát triển vốn từ. Triết lý cốt lõi: **học có hướng dẫn ở nhà → tự thực hiện ở lớp**. Ở nhà, các em làm quen từng dạng bài với lời đọc yêu cầu, hình ảnh và gợi ý; mức hỗ trợ giảm dần; ở lớp, các em tự làm phiếu tương đương mà ít cần giáo viên hướng dẫn riêng.

**Trạng thái hiện tại: Giai đoạn 3 — bộ máy tiếng Việt và kho tri thức (bản xem trước).** Website chạy được với giao diện các trang nền tảng; đã có thư viện phân tích tiếng Việt, kho tri thức có kiểm thử và lệnh kiểm tra nội dung. **Chưa** có bài tập tương tác, tài khoản, cơ sở dữ liệu hay AI; toàn bộ dữ liệu kho tri thức **đang chờ giáo viên duyệt**. Xem lộ trình ở [TASKS.md](TASKS.md) và tiến độ ở [PROGRESS.md](PROGRESS.md).

## Yêu cầu

- Node.js **24.x** (xem `.nvmrc`) và npm 11.
- Để chạy kiểm thử E2E: trình duyệt của Playwright (Chromium, WebKit).

## Cài đặt

```bash
npm ci
npx playwright install chromium webkit   # chỉ cần cho kiểm thử E2E
```

Ứng dụng chưa cần biến môi trường nào. Tệp `.env.example` liệt kê các biến dự kiến cho các giai đoạn sau — sao chép thành `.env.local` khi cần và **không bao giờ commit** tệp chứa giá trị thật.

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
| `npm run test:e2e` | Playwright: tự build production, chạy `next start` ở cổng 3100, kiểm thử trên Chromium và WebKit (desktop + điện thoại) |
| `npm run format` / `npm run format:check` | Prettier |
| `npm run content:check` | Kiểm tra kho tri thức `content/`: JSON/lược đồ, ID, NFC, tham chiếu, chính tả, kiểm duyệt, dữ liệu cá nhân. Lỗi → thoát mã 1; cảnh báo = việc cần giáo viên rà soát |

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
│   ├── learn/              # Khung khu vực học sinh (/learn), ưu tiên điện thoại
│   ├── layout.tsx          # Layout gốc: lang="vi", font, metadata
│   ├── fonts.ts            # Be Vietnam Pro (giao diện) + Andika (học liệu đọc)
│   └── globals.css         # Tailwind CSS 4 + style nền
├── components/
│   ├── ui/                 # Button, Card, Badge, Notice, EmptyState, LoadingState, Tabs…
│   ├── layout/             # Header, menu di động, footer, sidebar giáo viên, điều hướng học sinh
│   ├── learning/           # Biểu tượng hướng dẫn, màu/biểu tượng lộ trình
│   └── illustrations/      # Minh họa ghép tiếng, linh vật
├── config/                 # site.ts (điều hướng), security-headers.ts (CSP, Permissions-Policy…)
├── features/               # exercises/ (6 dạng bài), learning-paths/ (3 lộ trình), demo/ (dữ liệu giả lập),
│                           # knowledge/ (kho tri thức: nạp, hồ sơ lớp, kiểm tra ngữ liệu, content:check)
├── lib/                    # cn.ts, vietnamese/ (NFC, thanh, phân tích tiếng, chính tả, giải mã, độ khó)
├── strings/vi.ts           # Toàn bộ câu chữ giao diện tiếng Việt
├── styles/tokens.css       # Design tokens (màu, cỡ chữ, vùng chạm, bo góc, đổ bóng)
└── types/learning.ts       # Kiểu dùng chung
content/                    # Kho tri thức (JSON): kb/ (chữ, âm, thanh, vần, quy tắc, tiếng, từ, câu), curriculum/ (bộ bài, hồ sơ lớp)
scripts/content-check.ts    # npm run content:check
tests/
├── unit/                   # Vitest + Testing Library (vietnamese/, knowledge/ từ GĐ3)
└── e2e/                    # Playwright
docs/                       # PRD, kiến trúc, mô hình dữ liệu, bộ máy tiếng Việt, phiếu rà soát cho GV
```

## Bộ máy tiếng Việt và kho tri thức (Giai đoạn 3)

- **Thư viện** `src/lib/vietnamese/`: chuẩn hóa NFC và soát văn bản (ký tự ẩn, dấu sót, dấu hiệu bảng mã cũ TCVN3/VNI — chỉ phát hiện, không tự sửa); tách dấu thanh; phân tích tiếng thành âm đầu – âm đệm – âm chính – âm cuối – thanh theo **danh mục 153 vần**; quy tắc chính tả c/k, g/gh, ng/ngh, qu, iê/yê, nguyên âm đôi, âm cuối p/t/c/ch; vị trí dấu thanh; kiểm tra “đọc được bằng kiến thức đã học” với 4 kết luận `readable` / `not_yet_learned` / `unknown` / `invalid`; ước lượng độ khó.
- **Kho tri thức** `content/`: 29 chữ cái, 39 âm (11 tổ hợp chữ), 6 thanh, 153 vần, 13 quy tắc, 17 cặp dễ nhầm, quan hệ tiên quyết, 149 mục ngữ liệu nguyên bản (58 tiếng, 60 từ, 31 câu). **Chưa mục nào được duyệt.**
- **Tiến độ học tập**: hồ sơ lớp 1A2 **chưa được giáo viên xác nhận** (chưa biết bộ sách, vị trí bài, quy ước) nên mọi kiểm tra theo lớp 1A2 trả về “chưa xác định”; chuỗi bài minh họa chỉ dùng để kiểm thử.
- Tài liệu: [docs/VIETNAMESE_ENGINE.md](docs/VIETNAMESE_ENGINE.md) · Phiếu rà soát cho giáo viên: [docs/TEACHER_REVIEW_CHECKLIST.md](docs/TEACHER_REVIEW_CHECKLIST.md).

## Chức năng đã có (Giai đoạn 2)

- Trang chủ `/`: giới thiệu ReadMate AI, ba hướng hỗ trợ học tập, quy trình "luyện ở nhà → vận dụng ở lớp", công cụ dự kiến cho giáo viên, cam kết bảo vệ dữ liệu trẻ em.
- `/demo`: giới thiệu ba lộ trình (Khởi động, Vững bước, Tăng tốc) bằng tab điều khiển được bằng bàn phím, buổi luyện mẫu, cơ chế hỗ trợ giảm dần H3→H0 và sáu dạng bài dự kiến — **toàn bộ dữ liệu là giả lập**.
- `/teacher`: khung bảng điều khiển giáo viên (điều hướng, các khu vực dự kiến) — **chưa có đăng nhập, chưa có dữ liệu**.
- `/learn`: khung góc học tập cho học sinh, ưu tiên điện thoại, vùng chạm ≥ 64px — **chưa lưu thông tin học sinh**.
- `/join`: giao diện chuẩn bị cho liên kết thiết bị bằng thẻ học — **biểu mẫu bị khóa, không nhận hay lưu mã nào**.
- Design system (màu, typography, khoảng cách, nút, thẻ, badge, thông báo, trạng thái trống/đang tải, tab, điều hướng), hỗ trợ bàn phím và trình đọc màn hình cơ bản.
- Header bảo mật: CSP, `X-Content-Type-Options`, `Referrer-Policy` (riêng `/join` là `no-referrer`), `Permissions-Policy` tắt camera/microphone/định vị, `X-Frame-Options`; không có `X-Powered-By`.
- Font tự host lúc build (trình duyệt không gửi yêu cầu tới Google); không có script hay tài nguyên bên thứ ba.

## Chức năng chưa phát triển

Sáu dạng bài tương tác và âm thanh (GĐ4, GĐ6), giao diện duyệt nội dung cho giáo viên (GĐ6), Supabase — cơ sở dữ liệu, đăng nhập giáo viên, liên kết thiết bị (GĐ5), giao bài và lưu kết quả (GĐ7), phiếu PDF (GĐ8), dashboard có dữ liệu (GĐ9), triển khai production (GĐ10), AI hỗ trợ giáo viên tạo bài (GĐ11).

## Triển khai

Đã chuẩn bị cho Vercel: `engines.node = 24.x`, `vercel.json` đặt region Functions `sin1` (Singapore). **Chưa** tạo dự án Vercel và chưa deploy. Ứng dụng không ghi dữ liệu lâu dài vào hệ thống tệp của Vercel Functions.

## Tài liệu dự án

- [docs/PRD.md](docs/PRD.md) — yêu cầu sản phẩm
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — kiến trúc kỹ thuật
- [docs/DATA_MODEL.md](docs/DATA_MODEL.md) — mô hình dữ liệu dự kiến
- [docs/VIETNAMESE_ENGINE.md](docs/VIETNAMESE_ENGINE.md) — bộ máy tiếng Việt và kho tri thức · [docs/TEACHER_REVIEW_CHECKLIST.md](docs/TEACHER_REVIEW_CHECKLIST.md) — phiếu rà soát cho giáo viên
- [TASKS.md](TASKS.md) — kế hoạch theo giai đoạn · [PROGRESS.md](PROGRESS.md) — tiến độ
- [CLAUDE.md](CLAUDE.md) — quy tắc phát triển bắt buộc · [AGENTS.md](AGENTS.md) — ghi chú của Next.js cho trợ lý lập trình

## Bảo vệ dữ liệu trẻ em

Dự án không thu thập dữ liệu học sinh ở giai đoạn này. Kho tri thức chỉ chứa ngữ liệu minh họa và tên nhân vật hư cấu; `npm run content:check` chặn chuỗi giống email/số điện thoại/số định danh và các trường dữ liệu cá nhân. Repository đang **công khai**: không commit secret, dữ liệu thật hay bản xuất cơ sở dữ liệu. Các quy tắc chi tiết nằm ở [CLAUDE.md](CLAUDE.md) §6.

## Giấy phép

- Font Be Vietnam Pro và Andika: SIL Open Font License 1.1 (tải qua `next/font/google`).
- Biểu tượng: [Lucide](https://lucide.dev) (ISC).
- Mã nguồn dự án: chưa chọn giấy phép — chủ dự án sẽ quyết định.
