# PROGRESS — Tiến độ dự án ReadMate AI

> **Cập nhật lần cuối:** 2026-10-14 — Phiên Claude Code #2 (Giai đoạn 2)
> Tệp này là "bộ nhớ" giữa các phiên: đọc đầu tiên khi bắt đầu phiên mới; cập nhật trước khi kết thúc phiên.

## 1. Trạng thái hiện tại

- **Giai đoạn hiện tại:** GĐ2 — Nền móng kỹ thuật → **HOÀN THÀNH, chờ người điều phối đánh giá**. GĐ1 đã được nghiệm thu.
- **Giai đoạn kế tiếp đề xuất:** GĐ3 — Lõi Tiếng Việt và kho tri thức dạng mã → **chưa bắt đầu** (chỉ bắt đầu khi được phê duyệt).
- **Ứng dụng:** Next.js 16.4 chạy được (dev và production); 5 trang khung giao diện `/`, `/demo`, `/teacher`, `/learn`, `/join` + trang 404/lỗi. **Chưa** có bài tập tương tác, tài khoản, CSDL, AI.
- **Git:** nhánh `main` có commit cục bộ; remote `origin` → `https://github.com/ThaiTaka/ReadMateAI.git`. **Chưa push** (GitHub vẫn rỗng), chưa đổi public/private, chưa deploy Vercel, chưa tạo dịch vụ bên ngoài.

| GĐ | Tên | Trạng thái |
|---|---|---|
| 1 | Khởi tạo & thiết kế kiến trúc | ✅ Đã nghiệm thu |
| 2 | Nền móng kỹ thuật | ✅ Hoàn thành — chờ duyệt (CI trên GitHub chưa chạy vì chưa push) |
| 3–10 | MVP (xem [TASKS.md](TASKS.md)) | ⏸ Chưa bắt đầu |
| 11+ | Sau MVP (AI, nâng cao) | ⏸ Chưa bắt đầu |

## 2. Môi trường đã kiểm tra

| Hạng mục | Kết quả |
|---|---|
| Thư mục thực tế | `D:\ReadMateAI` (không có dấu cách). `D:\ReadMate AI` **không tồn tại**. Thư mục ban đầu (GĐ1) **rỗng** |
| Hệ điều hành / shell | Windows 11 Pro; PowerShell 5.1 (CurrentUser `RemoteSigned` → `npm.ps1` chạy được); Git Bash có sẵn |
| Ổ đĩa D: | Còn trống khoảng 174 GB (GĐ1) |
| Git | 2.54.0; `git init -b main` ở GĐ1; `user.name`/`user.email` cấu hình toàn cục; `core.autocrlf=true` (system) — `.gitattributes` đưa mọi tệp về LF (đã kiểm tra `git ls-files --eol`) |
| Git remote | `origin` → `https://github.com/ThaiTaka/ReadMateAI.git` (thêm 2026-10-14 sau khi xác minh). Repo GitHub thuộc tài khoản đang đăng nhập `ThaiTaka` (quyền ADMIN), **PUBLIC**, **rỗng** — chưa có nhánh |
| Node.js / npm | Node 24.18.0 (win32 x64), npm 11.16.0 (npm báo đã có 12.2.0 — chưa nâng cấp) |
| pnpm / yarn / bun | Không có |
| GitHub CLI | 2.100.0; đã đăng nhập `ThaiTaka` (https, có quyền `repo`, `workflow`) |
| Playwright | 1.64.0; trình duyệt Chromium 156 + WebKit 27.2 cài ở `%LOCALAPPDATA%\ms-playwright` (GĐ2) |
| Vercel CLI / Supabase CLI | **Chưa cài** (dùng `npx` khi được phép) |
| Docker | Docker Desktop đã cài (client 29.5.3) nhưng **daemon không chạy** |
| Windows long paths | `LongPathsEnabled = 0` — chưa gây lỗi (đường dẫn gốc ngắn) |
| Khác | Phiên Claude Code có thư mục làm việc phụ `d:\DYE LMS\packages\db\prisma` (dự án khác) — **không đụng tới** |

## 3. Công việc đã hoàn thành

### GĐ2 — 2026-10-12 → 2026-10-14

1. Đọc đầy đủ 8 tệp của GĐ1 (`CLAUDE.md`, `PRD`, `ARCHITECTURE`, `DATA_MODEL`, `TASKS`, `PROGRESS`, `.gitignore`, `.gitattributes`).
2. Kiểm tra lại phiên bản bằng `npm view` trước khi cài; scaffold `create-next-app@16.4.0` (TypeScript, Tailwind, ESLint, App Router, `src/`, alias `@/*`) trong thư mục tạm ngoài dự án → chuyển các tệp cần thiết vào `D:\ReadMateAI`, giữ nguyên `.git`, tài liệu và cấu hình; hợp nhất `.gitignore`; **xóa thư mục tạm** sau khi ứng dụng chạy được. Không dùng `--force`/`--legacy-peer-deps`.
3. Cấu hình: `package.json` (`engines.node = 24.x`, 10 script đều chạy thật), `.nvmrc`, `tsconfig.json` (strict + `noUncheckedIndexedAccess` + `erasableSyntaxOnly`), `eslint.config.mjs`, Prettier, `next.config.ts` (Cache Components, Partial Prefetching, typedRoutes, tắt `X-Powered-By`, header bảo mật), `vercel.json` (`sin1`), `.env.example`.
4. Design system: tokens Tailwind 4 (màu thương hiệu, nền, chữ, cỡ chữ đọc, vùng chạm 48/64 px, bo góc, đổ bóng), font Be Vietnam Pro (giao diện) + Andika (học liệu) tự host qua `next/font`, focus ring rõ, `prefers-reduced-motion`; thành phần `Button`/`ButtonLink` (4 kiểu, 4 cỡ gồm `kid`), `Card`, `Badge`, `Container`, `SectionHeading`, `Notice`, `EmptyState`, `LoadingState`/`Skeleton`, `Tabs` (WAI-ARIA, điều khiển bằng bàn phím), header + menu di động, footer, sidebar giáo viên, thanh điều hướng học sinh, skip link, minh họa ghép tiếng, linh vật.
5. Trang: `/` (giới thiệu, sứ mệnh, 3 hướng hỗ trợ, quy trình nhà → lớp, công cụ dự kiến cho GV, an toàn dữ liệu), `/demo` (3 lộ trình Khởi động/Vững bước/Tăng tốc, buổi luyện mẫu, hỗ trợ giảm dần H3→H0, 6 dạng bài — dữ liệu hư cấu), `/teacher` (khung bảng điều khiển, "Chức năng đang phát triển", không giả lập đăng nhập), `/learn` (mobile-first, không lưu thông tin), `/join` (giao diện bị khóa, không có `<form>`, không nhận mã), 404, trang lỗi.
6. Header bảo mật (`src/config/security-headers.ts`): CSP, `Permissions-Policy` (tắt camera/microphone/geolocation/payment/usb), `Referrer-Policy` (`/join`: `no-referrer`), `X-Content-Type-Options`, `X-Frame-Options`.
7. Kiểm thử: Vitest (7 tệp, 80 test — gồm test vệ sinh repo), Playwright (6 tệp spec × 4 cấu hình).
8. Soát giao diện bằng ảnh chụp thật (desktop, iPhone 13, 360 px) và sửa: chữ nút bị xuống dòng, nút CTA ở header vẫn hiện ở 360 px (xung đột `hidden`/`inline-flex`), tên thương hiệu xuống dòng, bố cục sidebar GV, tiêu đề mục GV quá lớn, thanh điều hướng học sinh trong suốt, nhãn liên kết `/demo`, bố cục thẻ quyền riêng tư `/join`, biểu tượng nhiệm vụ "Ôn chữ và âm" (Tai → Mắt cho khớp "Nhìn hình, chọn chữ").
9. GitHub Actions `.github/workflows/ci.yml` (lint → typecheck → unit test → build); `README.md`.
10. Cập nhật `CLAUDE.md` (§4, §9.1 quy tắc mới, §10, §11), `TASKS.md`, `docs/ARCHITECTURE.md` (§3.1, AD-19→AD-24, §5.1, §6.1, §18, §19, §20, §22), tệp này.
11. Git: xác minh repo GitHub, thêm remote `origin`, commit cục bộ (mục 3.2). **Không push.**

### 3.1 Kết quả kiểm tra cuối GĐ2 (chạy thật ngày 2026-10-14, Windows 11, Node 24.18.0)

| Kiểm tra | Kết quả |
|---|---|
| `npm run format:check` | ✅ exit 0 |
| `npm run lint` | ✅ exit 0, không lỗi/cảnh báo |
| `npm run typecheck` | ✅ exit 0 (`next typegen` + `tsc --noEmit`) |
| `npm run test:run` | ✅ 7 tệp, **80/80** test đạt |
| `npm run build` | ✅ exit 0; 7 route đều tĩnh (○): `/`, `/_not-found`, `/demo`, `/icon.svg`, `/join`, `/learn`, `/teacher` |
| `npm run test:e2e` | ✅ exit 0: **139 đạt, 0 lỗi, 25 bỏ qua có chủ đích** (~70 giây, gồm build) — routes 24, privacy 48, vietnamese 28, responsive 24, navigation 9, security-headers 6 |
| 25 test bỏ qua | Header bảo mật chỉ kiểm trên `chromium-desktop` vì do server trả, giống nhau mọi trình duyệt (18); skip link bỏ qua trên WebKit (Safari không Tab tới liên kết theo mặc định) và điện thoại (3); menu di động bỏ qua trên desktop (2); menu desktop bỏ qua trên điện thoại (2) |
| Responsive 360 px | ✅ 5 route không cuộn ngang × 4 cấu hình; vùng chạm `/learn` ≥ 64 px |
| Server production (`npm run start`) | ✅ sẵn sàng sau ~1,1 giây; `/`, `/demo`, `/teacher`, `/learn`, `/join`, `/icon.svg` → 200; route không tồn tại → 404; đủ header; không có `X-Powered-By` |
| Server dev (`npm run dev`) | ✅ sẵn sàng sau ~6,7 giây; 5 route → 200; CSP dev có thêm `'unsafe-eval'` và `ws:` như thiết kế |
| Kiểm thử âm tính test vệ sinh repo | ✅ Cài tạm khóa giả dạng Anthropic, email và tệp NFD → 3 test thất bại đúng chỗ; xóa tệp tạm → 18/18 đạt |
| `npm audit` | ⚠️ Dependency production: **0** lỗ hổng. Toàn bộ: 5 mức cao, đều trong công cụ dev (`braces` ← `micromatch` ← `fast-glob` ← `@next/eslint-plugin-next` ← `eslint-config-next`), chưa có bản vá — không dùng `--force` |
| Workflow CI | ✅ YAML hợp lệ (đã phân tích bằng `js-yaml`); các bước khớp script thật. ⏸ **Chưa chạy trên GitHub** vì chưa push |
| Lockfile cho Linux | ✅ `package-lock.json` có binary `linux-x64-gnu` của Next SWC, lightningcss, Tailwind oxide, unrs-resolver, rolldown (cần cho `npm ci` trên CI) |
| Ảnh chụp giao diện | Ảnh từng trang (full-page, 4 cấu hình) do E2E lưu ở `test-results/` (bị gitignore); ảnh soát thủ công nằm trong thư mục scratchpad của phiên, không thuộc repo |

### 3.2 Git trong GĐ2

- `16d1413` — *WIP: cap nhat truoc khi chuyen qua cloud session* — commit gốc **do chủ dự án tự tạo** ngày 2026-10-14 bằng `git add .` (82 tệp). Đã kiểm tra: không có `node_modules`, `.next`, `.env*`, `next-env.d.ts`, kết quả test, `.claude/`; mọi tệp LF. Lệnh `git push` đi kèm của chủ dự án **không chạy** (cú pháp còn placeholder `<tên-nhánh-của-bạn>`, và lúc đó chưa có remote).
- Commit kế tiếp (Claude): cập nhật tài liệu cuối GĐ2 (`PROGRESS.md`, `TASKS.md`, `CLAUDE.md`, `docs/ARCHITECTURE.md`) — xem `git log`.
- Remote `origin` đã thêm; **chưa push**. Khi được phép: `git push -u origin main` (repo đang PUBLIC — xem Q-11).

### 3.3 Điều chỉnh so với kế hoạch GĐ2 ban đầu

1. Không thêm script `content:check` tạm thời (yêu cầu GĐ2: mọi script phải chạy thật) → chuyển sang nhiệm vụ 3.8.
2. Playwright dùng 4 cấu hình (Desktop Chrome, Pixel 7, Desktop Safari, iPhone 13); cấu hình iPad chuyển sang GĐ4 (4.8).
3. Cấu trúc thư mục: dùng route group `(site)/` cho trang công khai và thư mục thường `teacher/`, `learn/` thay vì `(public)/`, `(student)/`, `(teacher)/` — chỉ tạo thư mục có mã thật (ARCHITECTURE §5.1).
4. Thêm script `test:run`, `format:check` (theo yêu cầu GĐ2 và cho CI).

### GĐ1 — 2026-10-12 (tóm tắt)

Kiểm tra môi trường; `git init -b main`; xác minh phiên bản (27 gói) và tài liệu chính thức; viết `CLAUDE.md`, `docs/PRD.md`, `docs/ARCHITECTURE.md`, `docs/DATA_MODEL.md`, `TASKS.md`, `PROGRESS.md`, `.gitignore`, `.gitattributes`; kiểm tra mã hóa (UTF-8, NFC, LF), 93 liên kết nội bộ, 6 sơ đồ Mermaid, quét secret — tất cả đạt; đọc lại và sửa 5 điểm chưa nhất quán (đồng bộ H1 với chính sách âm thanh; F-AT-01; ví dụ JSON dạng 1 và mã `TEXT_LEAKS_ANSWER`; student gateway; Deployment Protection).

## 4. Nhật ký quyết định kỹ thuật

Trạng thái: **Chốt** · **POC** (cần thử nghiệm) · **Hoãn** · **Chờ xác nhận** (cần GV/điều phối).

| Mã | Quyết định | Trạng thái | Chi tiết |
|---|---|---|---|
| D-001 | Gốc dự án là `D:\ReadMateAI` (khớp tên repo `ReadMateAI`, không dấu cách) | Chốt | |
| D-002 | Next.js 16.4 (App Router) + React 19.3 + TypeScript 5.9 + Tailwind 4.3; Node 24.x; npm | Chốt (đã cài ở GĐ2) | ARCHITECTURE §3.1 |
| D-003 | Không dùng TypeScript 7.0 và ESLint 10 lúc này; dùng `@types/node@^24` | Chốt | ARCHITECTURE §3.1 |
| D-004 | Supabase (Postgres + Auth + Storage, Singapore) + Vercel Functions region `sin1`; khóa `publishable`/`secret` | Chốt | AD-02, AD-13 |
| D-005 | Không ORM: `supabase-js` + kiểu sinh tự động + SQL migrations | Chốt | AD-03 |
| D-006 | Student gateway: mọi thao tác ghi và nội dung phiên của HS đi qua server; HS chỉ đọc dữ liệu của mình qua RLS | Chốt | AD-04, DATA_MODEL §7 |
| D-007 | HS đăng nhập bằng người dùng ẩn danh + liên kết thiết bị qua thẻ học (QR trong fragment URL + mã dự phòng; lưu HMAC + pepper) | POC (GĐ5) | AD-05, ARCHITECTURE §8.2 |
| D-008 | Exercise Type Module; 6 dạng MVP: `letter_sound`, `build_syllable`, `identify_unit`, `fill_blank`, `word_picture`, `sentence_reading` | Chốt (chờ GV góp ý nội dung) | PRD §9, AD-06 |
| D-009 | Mức hỗ trợ H3→H0 theo từng HS × dạng bài, luật mặc định có tham số | Chốt (hiệu chỉnh khi thí điểm) | PRD §11 |
| D-010 | Chính sách âm thanh chống lộ đáp án A1–A7 + bộ kiểm tra chặn duyệt | Chốt | PRD §12 |
| D-011 | Kho tri thức lõi là dữ liệu trong repo (`content/`) + thư viện xác định `lib/vietnamese`; không vector DB | Chốt | AD-07, AD-17 |
| D-012 | Âm thanh sinh trước/ghi âm GV; âm/vần đơn lẻ bắt buộc ghi âm GV; nhà cung cấp TTS chọn sau POC | Chốt / POC (GĐ6) | AD-09 |
| D-013 | PDF bằng `@react-pdf/renderer` + font Andika (OFL) | Chốt / POC kỹ thuật (GĐ8) | AD-10 |
| D-014 | Phân hóa dựa trên luật: mastery trung bình trượt, Leitner 1–5, mức hỗ trợ, câu bắc cầu; đề xuất đổi nhóm do GV quyết định | Chốt cho MVP | AD-11 |
| D-015 | AI sau MVP qua cổng `StructuredLlm`; adapter đầu tiên dùng SDK chính thức của Anthropic, mô hình mặc định `claude-opus-5-5` (đổi bằng biến môi trường) | Hoãn (GĐ11) | AD-12 |
| D-016 | Làm bộ máy bài tập + `/demo` (GĐ4) **trước** CSDL (GĐ5) để thử khả dụng sớm mà không thu dữ liệu | Chốt | TASKS |
| D-017 | Tên nhóm trong mã: `foundation` (Nhóm 3), `developing` (Nhóm 2), `extending` (Nhóm 1) để tránh nhầm thứ tự | Chốt | PRD §10 |
| D-018 | Thêm `.gitignore`/`.gitattributes` ngay ở GĐ1 vì repo GitHub đang public | Chốt | |
| D-019 | Giữ `cacheComponents` + `partialPrefetching` (mặc định của `create-next-app` 16.4) | Chốt | AD-19 |
| D-020 | CSP không nonce đặt trong `next.config.ts` (`'unsafe-inline'` cho script); xem lại khi có dữ liệu thật | Chốt cho GĐ2 | AD-20 |
| D-021 | Font Be Vietnam Pro + Andika qua `next/font/google` (tự host lúc build) | Chốt | AD-21 |
| D-022 | Vitest + Testing Library; Playwright chạy trên bản production, Chromium + WebKit × desktop + điện thoại | Chốt | AD-22 |
| D-023 | `typedRoutes`; `typecheck` = `next typegen && tsc --noEmit` | Chốt | AD-23 |
| D-024 | Tách `src/config/security-headers.ts` (có unit test), nạp từ `next.config.ts` bằng đuôi `.ts` | Chốt | AD-24 |
| D-025 | Ba lộ trình hiển thị cho phụ huynh/GV: Khởi động (`foundation`), Vững bước (`developing`), Tăng tốc (`extending`); **không** hiển thị cho học sinh | Chốt (chờ GV góp ý tên gọi) | `src/features/learning-paths/catalog.ts` |
| D-026 | Câu chữ giao diện tập trung ở `src/strings/vi.ts`; dữ liệu demo hư cấu tách riêng ở `src/features/demo/` (cờ `DEMO_DATA_IS_FICTIONAL`) | Chốt | CLAUDE.md §9.1 |
| D-027 | Không thêm Supabase/zod/thư viện chưa dùng ở GĐ2; chỉ tạo thư mục có mã thật (đơn giản hóa so với ARCHITECTURE §5.2) | Chốt | |

## 5. Câu hỏi mở

| Mã | Câu hỏi | Ảnh hưởng tới |
|---|---|---|
| Q-01 | Lớp 1A2 dùng bộ sách Tiếng Việt 1 nào? | **GĐ3** (thứ tự âm/vần) |
| Q-02 | Quy ước của lớp: cách gọi tên âm ("bờ", "cờ", "ngờ kép"…), phân tích "qu"/"gi", vị trí dấu thanh ("hoà"/"hòa") | **GĐ3** |
| Q-03 | GV có thể ghi âm bao nhiêu âm/vần/câu lệnh? Giọng vùng miền của lớp? | GĐ4 (âm thanh demo), GĐ6 |
| Q-04 | Thiết bị và chất lượng mạng phổ biến của phụ huynh; thời gian trẻ luyện mỗi ngày | GĐ4, GĐ7 |
| Q-05 | Bên kiểm soát dữ liệu (nhà trường hay GV)? Quy trình xin đồng ý của phụ huynh? | GĐ10 (nên bắt đầu trao đổi sớm) |
| Q-06 | Máy in ở trường: đen trắng hay màu, khổ A4? | GĐ8 |
| Q-07 | Sĩ số lớp, số học sinh mỗi nhóm hiện tại | GĐ5, GĐ9 |
| Q-08 | Xưng hô trong lời đọc: "cô – con" hay "cô – em"? (khung `/learn` đang dùng "Chào con!") | GĐ4 |
| Q-09 | Ai duyệt nội dung: một GV hay tổ chuyên môn? | GĐ6 |
| Q-10 | Ngân sách cho Supabase Pro / Vercel Pro; có cần tên miền riêng? | GĐ10 |
| Q-11 | Repo GitHub để **public** là có chủ ý? Có muốn chuyển sang private trước khi push? | Trước lần push đầu tiên |
| Q-12 | Khi nào được push `main` (để chạy CI trên Linux) và tạo dự án Vercel? GĐ5 có được tạo dự án Supabase không? | Push, CI, GĐ5 |
| Q-13 | Email cấu hình trong Git cục bộ đã liên kết với tài khoản GitHub `ThaiTaka` chưa (để commit hiển thị đúng tác giả)? | Trước khi push |
| Q-14 | Tên ba lộ trình (Khởi động, Vững bước, Tăng tốc) và nội dung trang chủ có phù hợp với GV/phụ huynh không? | GĐ4 |

## 6. Rủi ro đang theo dõi

| Mã | Rủi ro | Mức | Giảm thiểu |
|---|---|---|---|
| R-01 | Pháp lý: Luật 91/2025/QH15 (hiệu lực 01/01/2026) — dữ liệu trẻ em (Điều 24); xử lý trên nền tảng ở nước ngoài được coi là chuyển dữ liệu xuyên biên giới (Điều 20) | Cao | Tối thiểu hóa dữ liệu; `/demo` không lưu; chỉ thu dữ liệu thật sau rà soát pháp lý và đồng ý (GĐ10) |
| R-02 | Vercel Hobby chỉ cho sử dụng cá nhân phi thương mại | Trung bình | Xác nhận với Vercel/nhà trường hoặc dùng Pro cho production |
| R-03 | Supabase Free tạm dừng sau 1 tuần không hoạt động và không có sao lưu | Cao (với production) | Dùng Supabase Pro cho thí điểm |
| R-04 | Repo public: lộ secret hoặc dữ liệu nếu commit nhầm | Trung bình | `.gitignore`; test vệ sinh repo (đã thử âm tính); quy tắc CLAUDE.md; GitHub secret scanning sau khi push |
| R-05 | TTS phát âm sai âm/vần tách rời, khác giọng cô | Trung bình | Ghi âm GV cho âm/vần; POC TTS |
| R-06 | Trẻ 6 tuổi chưa tự thao tác được | Cao | Thử `/demo` ở GĐ4 trước khi xây CSDL |
| R-07 | Tương thích phiên bản: Serwist + Turbopack, react-pdf trên Next 16 | Trung bình | POC (GĐ4, GĐ8) |
| R-08 | ~~`create-next-app` từ chối thư mục đã có tài liệu~~ | Đã xử lý | Scaffold vào thư mục tạm rồi hợp nhất (GĐ2) |
| R-09 | Khóa `anon`/`service_role` của Supabase bị khai tử cuối 2026 | Thấp | Dùng khóa publishable/secret ngay từ đầu |
| R-10 | Lạm dụng đăng nhập ẩn danh | Thấp–TB | Giới hạn tần suất riêng + Turnstile ở `/join` + dọn người dùng ẩn danh |
| R-11 | Docker daemon chưa chạy; Windows long paths tắt | Thấp | Bật Docker Desktop khi cần Supabase local |
| R-12 | Bản quyền nội dung SGK, hình ảnh | Trung bình | Chỉ lưu thứ tự bài/đơn vị; ghi nguồn và giấy phép mọi media |
| R-13 | GV quá tải khi duyệt nội dung | Trung bình | Thư viện khởi đầu + tạo nhanh theo quy tắc + bộ kiểm tra tự động |
| R-14 | ESLint 9 bị npm đánh dấu hết hỗ trợ; 5 lỗ hổng mức cao (ReDoS `braces`) trong chuỗi `eslint-config-next` — chỉ công cụ dev, production 0 lỗ hổng | Thấp | Theo dõi bản `eslint-config-next`/plugin hỗ trợ ESLint 10; không `npm audit fix --force` |
| R-15 | CI chưa từng chạy trên Linux (chưa push) — có thể lộ khác biệt Windows/Linux (phân biệt hoa thường tên tệp, binary gốc) | Trung bình | Đã kiểm tra lockfile có binary Linux, bật `forceConsistentCasingInFileNames`; kiểm chứng ngay sau lần push đầu |
| R-16 | CSP cho phép `'unsafe-inline'` cho script (không nonce) | Thấp ở GĐ2 | Không có script bên thứ ba và không hiển thị HTML do người dùng nhập; xem lại nonce/SRI ở GĐ5 |
| R-17 | `npm install` chặn script cài đặt của `unrs-resolver` (tính năng allow-scripts của npm 11) — module vẫn nạp được binary có sẵn | Thấp | Đã kiểm tra lint chạy đúng; theo dõi khi nâng cấp npm/ESLint |
| R-18 | `next.config.ts` nạp bằng TypeScript gốc của Node 24 (cần đuôi `.ts`, cấm enum) | Thấp | Quy tắc CLAUDE.md §9.1; unit test cho module header |

## 7. Bước tiếp theo

**Đề xuất GĐ3 — Lõi Tiếng Việt và kho tri thức dạng mã** (chi tiết: [TASKS.md](TASKS.md#gđ3--lõi-tiếng-việt-và-kho-tri-thức-dạng-mã-ml)).

Điều kiện trước khi bắt đầu:

1. Người điều phối nghiệm thu GĐ2.
2. Trả lời Q-01, Q-02 (bộ sách, quy ước gọi tên âm, "qu"/"gi", vị trí dấu thanh) — nếu chưa có, GĐ3 làm với quy ước tạm và đánh dấu "chờ xác nhận".
3. Quyết định Q-11, Q-12, Q-13 trước lần push đầu tiên (để chạy CI trên Linux).

Lệnh push khi được phép (repo đang PUBLIC):

```powershell
git -C D:\ReadMateAI push -u origin main
```

## 8. Nhật ký phiên

| Ngày | Phiên | Giai đoạn | Tóm tắt |
|---|---|---|---|
| 2026-10-12 | #1 | GĐ1 | Kiểm tra môi trường; `git init -b main`; xác minh phiên bản và tài liệu; tạo 6 tài liệu + `.gitignore` + `.gitattributes`; kiểm tra mã hóa, 93 liên kết, 6 sơ đồ Mermaid, quét secret — tất cả đạt. Không commit/push/deploy. **Kết thúc GĐ1 — đã được nghiệm thu.** |
| 2026-10-12 → 2026-10-14 | #2 | GĐ2 | Scaffold Next 16.4 qua thư mục tạm; cấu hình TS strict/ESLint/Prettier/Vitest/Playwright; design system + 5 trang khung + 404/lỗi; header bảo mật; CI; README; soát giao diện bằng ảnh chụp và sửa 9 lỗi hiển thị; format/lint/typecheck/80 unit/build/139 E2E đều xanh; chủ dự án tự tạo commit `16d1413`; thêm remote `origin`; commit tài liệu cuối GĐ2. **Không push, không deploy. Kết thúc GĐ2 — chờ duyệt.** |
