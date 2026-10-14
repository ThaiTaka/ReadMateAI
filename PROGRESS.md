# PROGRESS — Tiến độ dự án ReadMate AI

> **Cập nhật lần cuối:** 2026-10-14 — Phiên Claude Code #3 (Giai đoạn 3)
> Tệp này là "bộ nhớ" giữa các phiên: đọc đầu tiên khi bắt đầu phiên mới; cập nhật trước khi kết thúc phiên.

## 1. Trạng thái hiện tại

- **Giai đoạn hiện tại:** GĐ3 — Vietnamese Knowledge Engine → **HOÀN THÀNH về mã nguồn, dữ liệu và kiểm thử; chờ người điều phối đánh giá.** GĐ1, GĐ2 đã được nghiệm thu.
- **Điểm còn phụ thuộc giáo viên:** toàn bộ dữ liệu kho tri thức ở trạng thái **chờ duyệt** (0 mục `approved`); hồ sơ lớp 1A2 **`unconfirmed`** (chưa biết bộ sách, vị trí bài, quy ước qu/gi/kiểu dấu — Q-01, Q-02) → mọi kiểm tra theo lớp 1A2 trả về `unknown`. Danh sách "đọc được" ở 3 mốc bài minh họa đã sinh, chờ GV nhận xét.
- **Giai đoạn kế tiếp đề xuất:** GĐ4 — bộ máy bài tập + 6 dạng bài + `/demo` → **chưa bắt đầu** (chỉ bắt đầu khi được phê duyệt).
- **Ứng dụng:** 5 trang khung giao diện của GĐ2 (không đổi giao diện ở GĐ3). Thêm thư viện `src/lib/vietnamese/`, lớp `src/features/knowledge/`, dữ liệu `content/`, lệnh `npm run content:check`. **Chưa** có bài tập tương tác, tài khoản, CSDL, AI.
- **Git/GitHub:** commit GĐ3 `5e63087` đã **push** lên `origin/main` (lần push đầu tiên của repo, 2026-10-14). GitHub Actions CI chạy lần đầu trên Linux: **xanh** (run 38596049449). Repo vẫn **PUBLIC** (không đổi chế độ). Chưa deploy Vercel, chưa tạo Supabase, chưa dùng AI.

| GĐ | Tên | Trạng thái |
|---|---|---|
| 1 | Khởi tạo & thiết kế kiến trúc | ✅ Đã nghiệm thu |
| 2 | Nền móng kỹ thuật | ✅ Đã nghiệm thu |
| 3 | Lõi Tiếng Việt & kho tri thức | ✅ Hoàn thành — chờ duyệt (dữ liệu chờ GV) |
| 4–10 | MVP (xem [TASKS.md](TASKS.md)) | ⏸ Chưa bắt đầu |
| 11+ | Sau MVP (AI, nâng cao) | ⏸ Chưa bắt đầu |

## 2. Môi trường đã kiểm tra

| Hạng mục | Kết quả |
|---|---|
| Thư mục thực tế | `D:\ReadMateAI` (không có dấu cách). `D:\ReadMate AI` **không tồn tại**. Thư mục ban đầu (GĐ1) **rỗng** |
| Hệ điều hành / shell | Windows 11 Pro; PowerShell 5.1 (CurrentUser `RemoteSigned` → `npm.ps1` chạy được); Git Bash có sẵn |
| Ổ đĩa D: | Còn trống khoảng 174 GB (GĐ1) |
| Git | 2.54.0; `git init -b main` ở GĐ1; `user.name`/`user.email` cấu hình toàn cục; `core.autocrlf=true` (system) — `.gitattributes` đưa mọi tệp về LF (đã kiểm tra `git ls-files --eol`) |
| Git remote | `origin` → `https://github.com/ThaiTaka/ReadMateAI.git`. Repo GitHub thuộc tài khoản đang đăng nhập `ThaiTaka` (quyền ADMIN), **PUBLIC**; rỗng cho tới GĐ3, **đã push `main`** ngày 2026-10-14 (nhánh mặc định `main`) |
| Node.js / npm | Node 24.18.0 (win32 x64), npm 11.16.0 (npm báo đã có 12.2.0 — chưa nâng cấp). Node 24 chạy TypeScript gốc (bỏ kiểu) — dùng cho `content:check` |
| pnpm / yarn / bun | Không có |
| GitHub CLI | 2.100.0; đã đăng nhập `ThaiTaka` (https, có quyền `repo`, `workflow`) |
| GitHub Actions | `actions/checkout` mới nhất v7.0.1, `actions/setup-node` v7.1.0 — thẻ `v7` tồn tại (kiểm tra 2026-10-14 bằng `gh api`) |
| Playwright | 1.64.0; trình duyệt Chromium 156 + WebKit 27.2 cài ở `%LOCALAPPDATA%\ms-playwright` (GĐ2) |
| Vercel CLI / Supabase CLI | **Chưa cài** (dùng `npx` khi được phép) |
| Docker | Docker Desktop đã cài (client 29.5.3) nhưng **daemon không chạy** |
| Windows long paths | `LongPathsEnabled = 0` — chưa gây lỗi (đường dẫn gốc ngắn) |
| Khác | Phiên Claude Code có thư mục làm việc phụ `d:\DYE LMS\packages\db\prisma` (dự án khác) — **không đụng tới** |

## 3. Công việc đã hoàn thành

### GĐ3 — 2026-10-14 (Vietnamese Knowledge Engine)

1. Đọc `CLAUDE.md`, `TASKS.md`, `PROGRESS.md`, `docs/PRD.md`, `docs/ARCHITECTURE.md`, `docs/DATA_MODEL.md`; kiểm tra cấu trúc mã, Git (nhánh `main`, 2 commit, working tree sạch), scripts; xác minh nền GĐ2 vẫn xanh (format, lint, typecheck, 80 unit test, build) **trước** khi thay đổi.
2. Cài `zod@^4.6.7` (đã `npm view zod version engines peerDependencies`; MIT, không peer) — phụ thuộc production duy nhất được thêm.
3. **Thư viện `src/lib/vietnamese/`** (hàm thuần): `characters`, `tone`, `normalize` (mở rộng, giữ API cũ), `tokenize`, `syllable` (phân tích theo danh mục vần; `ok`/`invalid`/`unrecognized`/`ambiguous`), `spelling-rules`, `tone-placement`, `diagnostics`, `decodability` (4 kết luận), `difficulty`, `index`.
4. **Kho tri thức `content/`** (JSON, mọi mục **chờ GV duyệt**): 29 chữ cái (tên chữ tách khỏi cách gọi âm), 39 âm (11 tổ hợp chữ), 6 thanh, 153 vần (cấu tạo khai báo tường minh), 13 quy tắc (10 `established`, 3 `convention`; spec máy đọc + ví dụ đúng/sai), 17 cặp dễ nhầm, 18 mục tiên quyết (25 cạnh khai báo + 404 cạnh suy ra theo cấu tạo), 14 chủ đề; ngữ liệu nguyên bản **149 mục**: 58 tiếng, 60 từ, 31 câu (147 `pending_review`, 2 `draft`, 0 `approved`).
5. **Tiến độ học tập `content/curriculum/`**: chuỗi **minh họa** 17 bài (`seriesKind: "illustrative"`, ghi rõ không phải SGK); hồ sơ `class-1a2` (`unconfirmed`, không có bộ sách/vị trí bài/quy ước); hồ sơ `illustrative-demo` (hư cấu, bài 10, quy ước tạm).
6. **Lớp nghiệp vụ `src/features/knowledge/`**: `schema` (zod `strictObject`), `load`, `default-kb` (import JSON qua bundler), `curriculum` (`resolveKnowledgeState`: Nhóm 3 lùi một bài, Nhóm 1 thêm đơn vị GV cho phép), `readability` (`checkReadability`: giải mã + từ vựng + đọc hiểu tách bạch), `selection` (`selectCorpusItems`: giao bài chỉ khi hồ sơ `confirmed` + mục `approved`), `prerequisites` (đồ thị + phát hiện vòng), `content-validation` (chỉ Node).
7. **`npm run content:check`** (`scripts/content-check.ts`, Node 24 chạy TypeScript trực tiếp): lỗi chặn / cảnh báo cho GV / thông tin. Thêm vào CI cùng `format:check`.
8. **Kiểm thử:** 10 tệp mới, **524 ca** (tổng 604). Kiểm tra độ nhạy bằng 4 đột biến tạm thời trong bộ máy (cho thanh ngang đi với âm cuối tắc; bỏ lùi bài Nhóm 3; bỏ quy tắc "i" dùng chung; bỏ qua quy ước chưa xác nhận) → lần lượt 8, 2, 11, 1 ca thất bại; đã khôi phục. Mở rộng test vệ sinh repo sang `content/` và `scripts/`.
9. Kiểm chứng giả định kiến trúc: Turbopack (Next 16.4) đóng gói được thư viện dùng import tương đối có đuôi `.ts` + JSON từ `content/` (trang thử tạm `/kb-probe` prerender ra `153|readable`, **đã xóa** ngay sau đó).
10. Tài liệu: tạo `docs/VIETNAMESE_ENGINE.md`, `docs/TEACHER_REVIEW_CHECKLIST.md`; cập nhật `CLAUDE.md` (§3, §5, §9.2 mới, §10, §11), `TASKS.md`, `docs/ARCHITECTURE.md` (v0.3: §3.1, AD-25→AD-31, §5.1, §10, §19, §20, §22), `docs/DATA_MODEL.md` (ghi chú đối chiếu §4.C), `README.md`, tệp này.

**Lỗi phát hiện và đã sửa trong phiên** (ghi lại để không lặp lại):

- Dữ liệu tự sinh ghi sai `tone:ngang.allowedWithStopCoda = true` → `content:check` bắt (`TONE_DATA_MISMATCH`), đã sửa; thêm test hồi quy.
- Lược đồ thiếu vị trí `medial` cho âm o, u → `content:check` bắt (`SCHEMA_INVALID`), đã sửa.
- Chuỗi thoát `\u…` trong mã/test bị ghi thành **ký tự thật** (dấu tổ hợp đứng riêng, U+200B, U+FEFF, U+00AD, chữ Kirin) → test vệ sinh repo bắt một tệp không NFC; đã chuyển toàn bộ về dạng thoát và kiểm tra byte; thêm quy tắc CLAUDE.md §9.2.2.
- Một ca test sai dữ liệu ("mưa" không có dấu thanh) và một ca có thể báo nhầm («» là dấu ngoặc hợp lệ) → đã sửa test/bộ phát hiện.

### 3.1 Kết quả kiểm tra cuối GĐ3 (chạy thật ngày 2026-10-14, Windows 11, Node 24.18.0)

| Kiểm tra | Kết quả |
|---|---|
| `npm run format:check` | ✅ exit 0 |
| `npm run lint` | ✅ exit 0, không lỗi/cảnh báo |
| `npm run typecheck` | ✅ exit 0 |
| `npm run content:check` | ✅ exit 0 — **ĐẠT: 0 lỗi, 33 cảnh báo** (19 `CONVENTION_DEPENDENT` — qu/gi/kiểu dấu, 11 `PENDING_REVIEW`, 2 `UNVERIFIED_SYLLABLE` — quýt, 1 `PROFILE_UNCONFIRMED` — đều là việc chờ GV), 4 thông tin |
| `npm run test:run` | ✅ 17 tệp, **604/604** (80 cũ + 524 mới) |
| `npm run build` | ✅ exit 0; 7 route tĩnh như GĐ2 (không thêm route) |
| `npm run test:e2e` | ✅ **139 đạt, 25 bỏ qua có chủ đích, 0 lỗi** (giống GĐ2) |
| Phân bố 524 ca mới | phân tích tiếng 122 · chính tả + chẩn đoán 63 · vị trí dấu 38 · ký tự/thanh 44 · soát văn bản 25 · tách token/độ khó 16 · giải mã 37 · kho tri thức 95 (gồm 57 ca đối chiếu ngân hàng tiếng) · hồ sơ lớp/kiểm tra theo hồ sơ/chọn ngữ liệu 39 · content:check với dữ liệu gài lỗi 45 |
| Ngữ liệu đọc được (hồ sơ minh họa, Nhóm 2) | bài 5: 14 từ / 4 câu · bài 10: 34 / 16 · bài 16: 56 / 28 · bài 17 (cả 149 mục): 136 `readable`, 11 `not_yet_learned` (cố ý), 2 `unknown` (quýt) |

### 3.2 Rà soát Git trước khi push (2026-10-14)

- Lịch sử: 2 commit (`16d1413`, `d1210e6`), một nhánh `main`, remote `origin` đúng repo.
- Tệp từng có trong lịch sử với tên nhạy cảm: chỉ `.env.example` (không có giá trị bí mật).
- Quét **mọi blob của mọi commit** bằng mẫu khóa Anthropic/OpenAI/Supabase/JWT/GitHub/AWS/Google/khóa riêng/gán `PASSWORD|SECRET|TOKEN|API_KEY|PEPPER=`: chỉ trúng chính biểu thức dò secret trong `tests/e2e/privacy.spec.ts` (dương tính giả). Quét email/số điện thoại trong tệp: không có.
- `.gitignore` chặn `.env*` (trừ `.env.example`), `node_modules`, `.next`, kết quả test, `exports/`, `*.dump`… — đã kiểm tra lại.
- Lưu ý: siêu dữ liệu commit (tác giả) chứa **email cá nhân** cấu hình trong Git của chủ dự án → sẽ công khai khi push lên repo PUBLIC (Q-13). Không phải secret hay dữ liệu học sinh nên không chặn push, nhưng chủ dự án nên cân nhắc dùng email `noreply` của GitHub cho các commit sau.

### 3.3 Git và CI trong GĐ3

- `5e63087` — *feat: Giai đoạn 3 — Vietnamese Knowledge Engine và kho tri thức* (58 tệp). Rà soát nội dung stage lần cuối: không secret, không email/số điện thoại.
- `git push -u origin main` (2026-10-14 16:12 UTC): tạo nhánh `main` trên GitHub, nhánh cục bộ theo dõi `origin/main`.
- **GitHub Actions — run 38596049449 (commit `5e63087`): ✅ thành công trong 58 giây** trên `ubuntu-latest`, Node 24.21.0 (theo `.nvmrc`): `npm ci` → format ✅ → lint ✅ → typecheck ✅ → content:check ✅ (0 lỗi, 33 cảnh báo — giống Windows) → unit test ✅ **604/604** → build ✅. Đây là lần đầu CI chạy trên Linux → R-15 đã được kiểm chứng.
- Ghi chú từ GitHub: nhãn `ubuntu-latest` chuyển sang Ubuntu 26 từ 2026-10-19 (R-23).
- Commit tài liệu kế tiếp ghi lại các kết quả này (xem `git log`; CI của commit đó cũng phải xanh).

### GĐ2 — 2026-10-12 → 2026-10-14 (tóm tắt)

Scaffold Next 16.4 qua thư mục tạm; cấu hình TS strict/ESLint/Prettier/Vitest/Playwright; design system + 5 trang khung + 404/lỗi; header bảo mật; CI; README; soát giao diện bằng ảnh chụp và sửa 9 lỗi hiển thị; format/lint/typecheck/80 unit/build/139 E2E đều xanh; chủ dự án tự tạo commit `16d1413` (82 tệp, đã kiểm tra không có tệp nhạy cảm); thêm remote `origin`; commit tài liệu cuối GĐ2 `d1210e6`. Điều chỉnh: không thêm `content:check` tạm (chuyển GĐ3 — đã làm); Playwright 4 cấu hình (iPad chuyển GĐ4); cấu trúc route `(site)/`, `teacher/`, `learn/`; thêm `test:run`, `format:check`.

### GĐ1 — 2026-10-12 (tóm tắt)

Kiểm tra môi trường; `git init -b main`; xác minh phiên bản (27 gói) và tài liệu chính thức; viết `CLAUDE.md`, `docs/PRD.md`, `docs/ARCHITECTURE.md`, `docs/DATA_MODEL.md`, `TASKS.md`, `PROGRESS.md`, `.gitignore`, `.gitattributes`; kiểm tra mã hóa, liên kết, sơ đồ, quét secret — tất cả đạt.

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
| D-011 | Kho tri thức lõi là dữ liệu trong repo (`content/`) + thư viện xác định `lib/vietnamese`; không vector DB | Chốt (hiện thực ở GĐ3) | AD-07, AD-17, AD-25 |
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
| D-027 | Không thêm Supabase/zod/thư viện chưa dùng ở GĐ2; chỉ tạo thư mục có mã thật | Chốt (GĐ3 thêm zod khi thực sự dùng) | |
| D-028 | Kho tri thức = JSON trong `content/kb` (ngôn ngữ) + `content/curriculum` (tiến độ), lược đồ zod `strictObject` | Chốt | AD-25 |
| D-029 | Phân tích tiếng dựa trên danh mục 153 vần (khớp chính xác); không khớp → `unrecognized`/`ambiguous` | Chốt | AD-26 |
| D-030 | Quy ước qu / gi / "i" dùng chung / kiểu đặt dấu là tham số hồ sơ lớp; quy ước tạm của bộ máy: `qu_onset`, `gi_onset`, `shared_i`; qu + y luôn `ambiguous` | **Chờ xác nhận** (Q-02, Q-16) | AD-27 |
| D-031 | Đơn vị giải mã = âm đầu + vần + thanh; vần một nguyên âm tính là âm; không tự ghép vần; 4 kết luận | Chốt (chờ GV nhận xét) | AD-28 |
| D-032 | `content:check` chạy TypeScript gốc bằng Node 24, import tương đối có đuôi `.ts`; tắt riêng cảnh báo `MODULE_TYPELESS_PACKAGE_JSON` | Chốt | AD-29 |
| D-033 | Duyệt gắn `contentHash` (SHA-256, bỏ trường `review`); AI/hệ thống không được duyệt; giao bài chỉ với hồ sơ `confirmed` + mục `approved` | Chốt | AD-30 |
| D-034 | Chuỗi bài minh họa tách khỏi bộ sách thật; hồ sơ 1A2 `unconfirmed` không có tiến độ | Chốt | AD-31 |
| D-035 | Ngữ liệu khởi đầu 149 mục (yêu cầu GĐ3: 100–150, ưu tiên chất lượng) thay cho 300–500 từ của kế hoạch GĐ1; hình minh họa để GĐ6 | Chốt | TASKS 3.7 |
| D-036 | CI thêm `format:check` và `content:check` | Chốt | `.github/workflows/ci.yml` |

## 5. Câu hỏi mở

| Mã | Câu hỏi | Ảnh hưởng tới |
|---|---|---|
| Q-01 | Lớp 1A2 dùng bộ sách Tiếng Việt 1 nào? Đang học đến bài nào? | **Then chốt** — chưa có thì hồ sơ 1A2 không dùng được (GĐ4 demo dùng hồ sơ minh họa) |
| Q-02 | Quy ước của lớp: cách gọi tên chữ và tên âm ("bờ", "cờ", "ngờ kép"…), phân tích "qu"/"gi", "i" dùng chung (gì, giếng), vị trí dấu thanh ("hoà"/"hòa") | **Then chốt** — phiếu rà soát mục B, C, D |
| Q-03 | GV có thể ghi âm bao nhiêu âm/vần/câu lệnh? Giọng vùng miền của lớp? | GĐ4 (âm thanh demo), GĐ6; cặp dễ nhầm theo phương ngữ (phiếu mục G) |
| Q-04 | Thiết bị và chất lượng mạng phổ biến của phụ huynh; thời gian trẻ luyện mỗi ngày | GĐ4, GĐ7 |
| Q-05 | Bên kiểm soát dữ liệu (nhà trường hay GV)? Quy trình xin đồng ý của phụ huynh? | GĐ10 (nên bắt đầu trao đổi sớm) |
| Q-06 | Máy in ở trường: đen trắng hay màu, khổ A4? | GĐ8 |
| Q-07 | Sĩ số lớp, số học sinh mỗi nhóm hiện tại | GĐ5, GĐ9 |
| Q-08 | Xưng hô trong lời đọc: "cô – con" hay "cô – em"? (khung `/learn` đang dùng "Chào con!") | GĐ4 |
| Q-09 | Ai duyệt nội dung: một GV hay tổ chuyên môn? | GĐ3 (duyệt kho tri thức), GĐ6 |
| Q-10 | Ngân sách cho Supabase Pro / Vercel Pro; có cần tên miền riêng? | GĐ10 |
| Q-11 | Repo GitHub để **public** là có chủ ý? | Đã push ở GĐ3 theo chỉ đạo; không tự đổi public/private |
| Q-13 | Email trong siêu dữ liệu commit là email cá nhân và sẽ công khai — có muốn dùng email `noreply` của GitHub cho commit sau? | Quyền riêng tư của chủ dự án |
| Q-14 | Tên ba lộ trình (Khởi động, Vững bước, Tăng tốc) và nội dung trang chủ có phù hợp với GV/phụ huynh không? | GĐ4 |
| Q-15 | Thứ tự bài và danh sách âm/vần của bộ sách (sau khi có Q-01): ai nhập, nguồn đối chiếu nào? | Hồ sơ 1A2, GĐ4–GĐ5 |
| Q-16 | Cách đánh vần qu + y (quý, quýt, quyển, quỳnh) theo bộ sách của lớp | Các tiếng này đang `unknown` |
| Q-17 | GV đánh giá danh sách "đọc được" ở 3 mốc bài minh họa có hợp lý không (phiếu rà soát mục I)? | Tiêu chí nghiệm thu GĐ3 còn mở |

*(Q-12 — cho phép push `main` — đã được trả lời ở yêu cầu GĐ3.)*

## 6. Rủi ro đang theo dõi

| Mã | Rủi ro | Mức | Giảm thiểu |
|---|---|---|---|
| R-01 | Pháp lý: Luật 91/2025/QH15 (hiệu lực 01/01/2026) — dữ liệu trẻ em (Điều 24); xử lý trên nền tảng ở nước ngoài được coi là chuyển dữ liệu xuyên biên giới (Điều 20) | Cao | Tối thiểu hóa dữ liệu; `/demo` không lưu; chỉ thu dữ liệu thật sau rà soát pháp lý và đồng ý (GĐ10) |
| R-02 | Vercel Hobby chỉ cho sử dụng cá nhân phi thương mại | Trung bình | Xác nhận với Vercel/nhà trường hoặc dùng Pro cho production |
| R-03 | Supabase Free tạm dừng sau 1 tuần không hoạt động và không có sao lưu | Cao (với production) | Dùng Supabase Pro cho thí điểm |
| R-04 | Repo public: lộ secret hoặc dữ liệu nếu commit nhầm | Trung bình | `.gitignore`; test vệ sinh repo (mở rộng sang `content/`, `scripts/`); `content:check` chặn mẫu dữ liệu cá nhân; quét toàn bộ lịch sử trước push; GitHub secret scanning |
| R-05 | TTS phát âm sai âm/vần tách rời, khác giọng cô | Trung bình | Ghi âm GV cho âm/vần; POC TTS |
| R-06 | Trẻ 6 tuổi chưa tự thao tác được | Cao | Thử `/demo` ở GĐ4 trước khi xây CSDL |
| R-07 | Tương thích phiên bản: Serwist + Turbopack, react-pdf trên Next 16 | Trung bình | POC (GĐ4, GĐ8) |
| R-09 | Khóa `anon`/`service_role` của Supabase bị khai tử cuối 2026 | Thấp | Dùng khóa publishable/secret ngay từ đầu |
| R-10 | Lạm dụng đăng nhập ẩn danh | Thấp–TB | Giới hạn tần suất riêng + Turnstile ở `/join` + dọn người dùng ẩn danh |
| R-11 | Docker daemon chưa chạy; Windows long paths tắt | Thấp | Bật Docker Desktop khi cần Supabase local |
| R-12 | Bản quyền nội dung SGK, hình ảnh | Trung bình | Chỉ lưu thứ tự bài/đơn vị; ngữ liệu GĐ3 viết mới; `seriesKind: "textbook"` bắt buộc `source` |
| R-13 | GV quá tải khi duyệt nội dung (149 mục + dữ liệu tham chiếu) | Trung bình | Phiếu rà soát gom theo nhóm; duyệt dữ liệu tham chiếu cấp tệp; GĐ6 có giao diện duyệt |
| R-14 | ESLint 9 hết hỗ trợ; 5 lỗ hổng mức cao (ReDoS `braces`) trong chuỗi `eslint-config-next` — chỉ công cụ dev | Thấp | Theo dõi bản hỗ trợ ESLint 10; không `npm audit fix --force` |
| R-15 | ~~CI chưa từng chạy trên Linux~~ | Đã xử lý (GĐ3) | Run 38596049449 xanh trên `ubuntu-latest`, Node 24.21.0: 604/604 test, content:check, build |
| R-16 | CSP cho phép `'unsafe-inline'` cho script (không nonce) | Thấp ở GĐ2–3 | Xem lại nonce/SRI ở GĐ5 |
| R-17 | `npm install` chặn script cài đặt của `unrs-resolver` (allow-scripts của npm 11) | Thấp | Lint vẫn chạy đúng |
| R-18 | `next.config.ts` nạp bằng TypeScript gốc của Node 24 (cần đuôi `.ts`, cấm enum) | Thấp | Quy tắc CLAUDE.md §9.1 |
| R-19 | Dữ liệu kho tri thức do trợ lý AI soạn, **chưa** được GV kiểm chứng (tên chữ, cách gọi âm, danh mục vần, ngữ liệu) | Trung bình | 0 mục `approved`; AI không được duyệt; phiếu rà soát cho GV; `selectCorpusItems` chặn giao bài |
| R-20 | Ký tự vô hình/dấu tổ hợp lọt vào mã khi soạn (đã xảy ra ở GĐ3) | Thấp (đã xử lý) | Dạng thoát `\uXXXX`; test vệ sinh NFC; quy tắc CLAUDE.md §9.2.2 |
| R-21 | Quy ước phân tích tạm (qu, gi, i dùng chung) có thể khác bộ sách thật | Trung bình | Là tham số; quy ước chưa xác nhận → `unknown`; chờ Q-02, Q-16 |
| R-22 | Email cá nhân trong siêu dữ liệu commit trên repo public (đã công khai cùng lần push GĐ3) | Thấp | Q-13 — cân nhắc email `noreply` cho commit sau |
| R-23 | GitHub chuyển `ubuntu-latest` sang Ubuntu 26 từ 2026-10-19 — có thể lộ khác biệt môi trường CI | Thấp | Theo dõi run CI sau ngày đó; nếu lỗi do ảnh, ghim tạm `ubuntu-24.04` |

## 7. Bước tiếp theo

**Đề xuất GĐ4 — Bộ máy bài tập + 6 dạng bài + `/demo`** (chi tiết: [TASKS.md](TASKS.md#gđ4--bộ-máy-bài-tập-6-dạng-bài-và-bản-chơi-thử-demo-l)), tận dụng trực tiếp bộ máy GĐ3: `validate()` của từng dạng gọi `checkReadability`/`diagnoseSyllable`; sinh bài theo quy tắc từ `selectCorpusItems({ purpose: "preview" })` (demo không cần nội dung đã duyệt nhưng phải ghi rõ "minh họa"); phương án nhiễu từ `confusions.json`; ràng buộc theo nhóm từ `resolveKnowledgeState`.

Điều kiện trước khi bắt đầu:

1. Người điều phối nghiệm thu GĐ3.
2. Nên có trước: GV trả lời Q-01, Q-02, Q-16 và điền phiếu [docs/TEACHER_REVIEW_CHECKLIST.md](docs/TEACHER_REVIEW_CHECKLIST.md) — nếu chưa có, GĐ4 vẫn làm được với hồ sơ minh họa nhưng `/demo` phải ghi rõ dữ liệu minh họa.
3. Bộ âm thanh mẫu tạm thời cho demo (Q-03).

## 8. Nhật ký phiên

| Ngày | Phiên | Giai đoạn | Tóm tắt |
|---|---|---|---|
| 2026-10-12 | #1 | GĐ1 | Kiểm tra môi trường; `git init -b main`; xác minh phiên bản và tài liệu; tạo 6 tài liệu + `.gitignore` + `.gitattributes`; kiểm tra mã hóa, 93 liên kết, 6 sơ đồ Mermaid, quét secret — tất cả đạt. Không commit/push/deploy. **Kết thúc GĐ1 — đã được nghiệm thu.** |
| 2026-10-12 → 2026-10-14 | #2 | GĐ2 | Scaffold Next 16.4 qua thư mục tạm; cấu hình TS strict/ESLint/Prettier/Vitest/Playwright; design system + 5 trang khung + 404/lỗi; header bảo mật; CI; README; soát giao diện và sửa 9 lỗi hiển thị; format/lint/typecheck/80 unit/build/139 E2E đều xanh; commit `16d1413` (chủ dự án), `d1210e6`; thêm remote `origin`. **Không push, không deploy. Kết thúc GĐ2 — đã được nghiệm thu.** |
| 2026-10-14 | #3 | GĐ3 | Cài zod 4.6.7; thư viện `src/lib/vietnamese/` (11 module); kho tri thức `content/` (29 chữ, 39 âm, 6 thanh, 153 vần, 13 quy tắc, 149 ngữ liệu — tất cả chờ GV); lớp tiến độ (chuỗi minh họa, hồ sơ 1A2 `unconfirmed`); `src/features/knowledge/`; `npm run content:check` (0 lỗi, 33 cảnh báo) + CI; 524 test mới (tổng 604) + 4 đột biến kiểm độ nhạy; E2E 139 đạt; tài liệu VIETNAMESE_ENGINE, TEACHER_REVIEW_CHECKLIST; rà soát toàn bộ lịch sử Git; commit `5e63087` + **push `main` lần đầu**; GitHub Actions xanh trên Linux (604/604); commit tài liệu ghi kết quả CI. **Kết thúc GĐ3 — chờ duyệt. Không deploy, không Supabase, không AI, không đổi public/private.** |
