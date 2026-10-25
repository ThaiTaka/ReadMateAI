# PROGRESS — Tiến độ dự án ReadMate AI

> **Cập nhật lần cuối:** 2026-10-16 — Phiên R01 (tái thiết kế)
> **Từ R01, tiến độ hiện tại nằm ở [REDESIGN_PROGRESS.md](REDESIGN_PROGRESS.md)** và lộ trình ở [REDESIGN_TASKS.md](REDESIGN_TASKS.md). Tệp này giữ lịch sử GĐ1–GĐ4, các quyết định D-xx, câu hỏi mở Q-xx và rủi ro R-xx (vẫn còn hiệu lực trừ chỗ ghi chú).

## 0. Thay đổi định hướng (R01, 2026-10-16)

Người điều phối đổi định hướng sản phẩm thành **nền tảng tự luyện Tiếng Việt tại nhà kết hợp trò chơi phiêu lưu, điểm thưởng và bảng xếp hạng lớp học** ([docs/PRODUCT_REDESIGN.md](docs/PRODUCT_REDESIGN.md)). Hệ quả với tệp này:

- Lộ trình GĐ5 → GĐ12 ở §7 và TASKS.md được **thay thế** bởi R02 → R11 (bảng đối chiếu ở cuối REDESIGN_TASKS). GĐ8 (phiếu PDF, tự lực tại lớp) **bỏ khỏi lộ trình**.
- D-013 (PDF), D-043 (cặp nhà – lớp) → **ngừng dùng** (AD-51). D-045 giữ cơ chế, nhãn H0 "Thử như ở lớp" đổi ở R02.
- Quy tắc "không bảng xếp hạng" (PRD P7, CLAUDE.md §6.4) và "không phạt" (§7.10) có **ngoại lệ có điều kiện** do người điều phối quyết định (RD-01, RD-02 trong REDESIGN_PROGRESS).
- Công việc "Prompt 05 / GĐ5" (âm thanh + Vercel) được báo là bị gián đoạn **không tìm thấy** ở thư mục này hay trên GitHub (REDESIGN_PROGRESS §2).
- Q-06 (máy in), Q-20 (lượt "như ở lớp") không còn cần thiết; R-06 (trẻ tự thao tác) càng quan trọng hơn với game.

## 1. Trạng thái hiện tại (đến hết GĐ4 — xem REDESIGN_PROGRESS cho trạng thái mới)

- **Giai đoạn hiện tại:** GĐ4 — Interactive Learning Engine (bộ máy bài tập, 6 dạng bài, bản chơi thử `/demo`) → **HOÀN THÀNH về mã nguồn và kiểm thử; chờ người điều phối đánh giá.** GĐ1, GĐ2 đã nghiệm thu; GĐ3 đã được chấp nhận về kỹ thuật.
- **Điểm còn phụ thuộc giáo viên / bên ngoài:**
  - **Chưa có âm thanh nào** (không bản ghi âm GV, chưa chọn TTS) → nút loa bị khóa, ghi "Chưa có âm thanh"; biến thể "Nghe âm – chọn chữ" chỉ xem giao diện, chưa chấm được.
  - Kho tri thức và fixture của bản chơi thử (22 tranh biểu tượng, 8 câu hỏi đọc hiểu) đều **chờ duyệt** (0 mục `approved`); hồ sơ 1A2 vẫn `unconfirmed` (Q-01, Q-02) → chế độ học thật trả về "chưa có bài hợp lệ" — đúng thiết kế.
  - Chưa có buổi thử khả dụng với GV/học sinh (TASKS 4.9).
- **Giai đoạn kế tiếp đề xuất:** GĐ5 — Supabase: CSDL nền, RLS, xác thực → **chưa bắt đầu** (chỉ bắt đầu khi được phê duyệt).
- **Ứng dụng:** 7 route tĩnh như GĐ2–3; `/demo` nay là **bản chơi thử tương tác** (3 buổi luyện mẫu theo lộ trình + 6 dạng bài / 17 biến thể, chọn mức H3→H0, kết quả buổi luyện, xem trước phiếu ở lớp). Bài tập sinh ở máy chủ lúc build; trình duyệt không lưu, không gửi dữ liệu. **Chưa** có tài khoản, CSDL, âm thanh, PDF, AI.
- **Git/GitHub:** commit GĐ4 `5861286` đã **push** lên `origin/main`; GitHub Actions run 38709007640 **xanh** (729/729 unit, content:check, build) — chi tiết [§3.3](#33-git-và-ci-trong-gđ4). Repo vẫn **PUBLIC** (không đổi chế độ). **Chưa deploy Vercel**, chưa tạo Supabase, chưa dùng AI.

| GĐ | Tên | Trạng thái |
|---|---|---|
| 1 | Khởi tạo & thiết kế kiến trúc | ✅ Đã nghiệm thu |
| 2 | Nền móng kỹ thuật | ✅ Đã nghiệm thu |
| 3 | Lõi Tiếng Việt & kho tri thức | ✅ Đã chấp nhận về kỹ thuật (dữ liệu chờ GV) |
| 4 | Bộ máy bài tập + 6 dạng bài + `/demo` | ✅ Hoàn thành — chờ duyệt (âm thanh, nội dung chờ GV) |
| 5–10 | MVP (xem [TASKS.md](TASKS.md)) | ⏸ Chưa bắt đầu |
| 11+ | Sau MVP (AI, nâng cao) | ⏸ Chưa bắt đầu |

## 2. Môi trường đã kiểm tra

| Hạng mục | Kết quả |
|---|---|
| Thư mục thực tế | `D:\ReadMateAI` (không có dấu cách). `D:\ReadMate AI` **không tồn tại**. Thư mục ban đầu (GĐ1) **rỗng** |
| Hệ điều hành / shell | Windows 11 Pro; PowerShell 5.1 (CurrentUser `RemoteSigned` → `npm.ps1` chạy được); Git Bash có sẵn |
| Ổ đĩa D: | Còn trống khoảng 174 GB (GĐ1) |
| Git | 2.54.0; `git init -b main` ở GĐ1; `user.name`/`user.email` cấu hình toàn cục; từ GĐ4 repo có `user.email` **cục bộ** là email `noreply` của GitHub (Q-13); `core.autocrlf=true` (system) — `.gitattributes` đưa mọi tệp về LF |
| Git remote | `origin` → `https://github.com/ThaiTaka/ReadMateAI.git`. Repo GitHub thuộc tài khoản đang đăng nhập `ThaiTaka` (quyền ADMIN), **PUBLIC**; `main` đã push từ GĐ3 |
| Node.js / npm | Node 24.18.0 (win32 x64), npm 11.16.0. Node 24 chạy TypeScript gốc (bỏ kiểu) — dùng cho `content:check` |
| pnpm / yarn / bun | Không có |
| GitHub CLI | 2.100.0; đã đăng nhập `ThaiTaka` (https, có quyền `repo`, `workflow`) |
| GitHub Actions | `actions/checkout` v7, `actions/setup-node` v7 (kiểm tra 2026-10-14) |
| Playwright | 1.64.0; Chromium 156 + WebKit 27.2 ở `%LOCALAPPDATA%\ms-playwright`. GĐ4 thêm cấu hình **`webkit-tablet`** (iPad gen 7) cho spec bản chơi thử + bố cục, và `@axe-core/playwright` 4.13 (devDependency; đã `npm view` phiên bản/peer; MPL-2.0, chỉ dùng khi test) |
| Vercel CLI / Supabase CLI | **Chưa cài** (dùng `npx` khi được phép) |
| Docker | Docker Desktop đã cài (client 29.5.3) nhưng **daemon không chạy** |
| Windows long paths | `LongPathsEnabled = 0` — chưa gây lỗi |
| Khác | Phiên Claude Code có thư mục làm việc phụ `d:\DYE LMS\packages\db\prisma` (dự án khác) — **không đụng tới** |

## 3. Công việc đã hoàn thành

### GĐ4 — 2026-10-14 → 2026-10-15 (Interactive Learning Engine)

1. **Kiểm tra đầu phiên:** đọc `CLAUDE.md`, `TASKS.md`, `PROGRESS.md`, PRD, ARCHITECTURE, DATA_MODEL, VIETNAMESE_ENGINE, TEACHER_REVIEW_CHECKLIST; xác minh nền GĐ3 **trước** khi thay đổi (working tree sạch, `main` khớp `origin/main`, unit 604/604, `content:check` 0 lỗi, build xanh).
2. **Bộ máy tiếng Việt:** thêm `src/lib/vietnamese/compose.ts` — ghép tiếng từ âm đầu + vần + thanh có kiểm tra khứ hồi bằng `analyzeSyllable` (trả mã lỗi `UNPARSABLE` / `AMBIGUOUS_COMPOSITION` / `TONE_STYLE_REQUIRED`, không đoán).
3. **Lõi bộ máy bài tập `src/features/exercises/core/`:** lược đồ dùng chung (zod `strictObject`), hợp đồng `ExerciseTypeRuntime` / `ExerciseTypeModule`, chính sách hỗ trợ H3→H0, chính sách âm thanh theo mục tiêu học tập, bộ soát lộ đáp án (văn bản + lời đọc, theo chuỗi tiếng NFC), phản hồi, chấm điểm, gợi ý, ràng buộc theo nhóm, chế độ nội dung, hợp đồng phiếu.
4. **Sáu dạng bài / 17 biến thể** (`types/<dạng>/`: `schema`, `variants`, `runtime`, `module`, `generate`, `Player`): nhìn hình – chọn chữ, tìm chữ giống chữ mẫu, nghe âm – chọn chữ (chỉ giao diện); ghép tiếng có tranh, ghép âm – vần – thanh; tìm âm đầu / vần / thanh, tìm tiếng có vần; điền âm đầu / vần / dấu thanh; chọn tranh đúng từ, nối từ – tranh; chọn tranh đúng câu, trả lời câu hỏi đọc hiểu, sắp xếp từ thành câu.
5. **Bộ kiểm tra 9 bước** `validateExerciseItem`: lược đồ → NFC → phân tích tiếng (`unknown` là lỗi) → chỉ dùng điều đã học → đáp án duy nhất / phương án trùng → lộ đáp án chữ & âm thanh (`TEXT_LEAKS_ANSWER`, `AUDIO_LEAKS_ANSWER`) → tranh/âm thanh → trạng thái duyệt theo chế độ → ràng buộc nhóm.
6. **Bộ sinh biến thể có seed** (`generation/`): ứng viên hữu hạn từ ngữ liệu đọc được, phương án nhiễu ưu tiên cặp dễ nhầm, đảo vị trí đáp án, kiểm tra **từng** câu; thiếu dữ liệu → `INSUFFICIENT_CONTENT` kèm chẩn đoán. **Cặp bài ở nhà – ở lớp** ("bài sinh đôi": cùng nhóm đơn vị trọng tâm, khác mục tiêu cụ thể, độ khó ước lượng chênh ≤ 1) + hợp đồng phiếu 8 thông tin + bản xem trước phiếu dạng trang web (chưa PDF).
7. **Phiên luyện** (`session/`): reducer thuần (bắt đầu, chọn, kiểm tra, thử lại, gợi ý, "Cô làm mẫu", chuyển câu, kết thúc, làm lại, thời gian ẩn tab); kết quả buổi luyện và chỉ số nghiên cứu **chỉ trong bộ nhớ** — chỉ số cần quan sát ở lớp để trống, không bịa số liệu.
8. **Giao diện học sinh** (`ui/`, `src/components/kid/`): thẻ chọn ≥ 64 px, tranh biểu tượng (lucide, ISC), dấu thanh vẽ bằng SVG riêng, `AudioSlot` luôn khóa, thanh tiến độ, phản hồi tích cực; bàn phím đầy đủ, focus rõ, chặn bấm đúp, không đếm ngược, không bảng xếp hạng.
9. **`/demo`** viết lại thành bản chơi thử: chọn lộ trình → buổi luyện mẫu (3 hoạt động, hoạt động cuối ở H0 "Thử như ở lớp") hoặc chọn từng dạng bài → hướng dẫn → làm → kiểm tra → phản hồi → câu tiếp → kết quả. Fixture riêng `src/features/demo/practice-fixture.ts` (hồ sơ minh họa bài MH16, 22 tranh, 8 câu hỏi — đều `pending_review`). Nhãn "Bản chơi thử", không đăng nhập, không lưu, không AI.
10. **Kiểm thử:** 7 tệp unit mới (124 ca) + E2E `tests/e2e/demo-practice.spec.ts` (lấy đáp án từ chính bộ sinh, thao tác qua giao diện) + axe. Kiểm tra độ nhạy bằng **4 đột biến tạm thời** (tắt so khớp lộ đáp án; bỏ chặn bấm "Kiểm tra" hai lần; cho chế độ học thật nhận nội dung chờ duyệt; cho phép âm thanh kích thích ở bài đọc) → lần lượt 3, 2, 2, 3 ca thất bại; đã khôi phục và kiểm tra lại.
11. **Tài liệu:** tạo [docs/EXERCISE_ENGINE.md](docs/EXERCISE_ENGINE.md); cập nhật `CLAUDE.md` (§3, §4, §5, §9.3 mới, §11), `TASKS.md` (mục GĐ4), `docs/ARCHITECTURE.md` (v0.4: AD-32→AD-39, §5.1, §6.1, §11, §20, §21, T-08, T-16), `docs/PRD.md` (v0.2: §9.3 điều chỉnh khi hiện thực, ghi chú §12.2), `docs/DATA_MODEL.md` (ghi chú §5), `README.md`, tệp này.

**Lỗi phát hiện và đã sửa trong phiên** (ghi lại để không lặp lại):

- **Lỗi thật của bộ chạy phiên:** sau khi sai, bấm "Kiểm tra" lần nữa mà không đổi lựa chọn vẫn tính thêm một lượt → nay phải đổi lựa chọn mới được kiểm tra lại (có test).
- **Bộ soát lộ đáp án bắt lỗi thật của bộ sinh:** "Điền dấu thanh" với tiếng thanh ngang làm khung câu trùng đáp án → bộ sinh bỏ qua thanh ngang.
- Cặp nhà – lớp ở bài mức chữ không tìm được bài tương đương → thiết kế lại theo "bài sinh đôi" + nhóm đơn vị trọng tâm; hai bài có cùng chuỗi đáp án → đảo thứ tự bài ở lớp; lỗi bài ở nhà bị báo nhầm mã → `INSUFFICIENT_CONTENT_FOR_PAIR`, vẫn giữ bài ở nhà.
- Câu "chỉ xem giao diện" (`previewOnly`) khóa cả lựa chọn và ẩn nút "Kiểm tra" → nay cho chọn, hiện nút "Kiểm tra" bị khóa kèm lý do.
- Ở 360 px: cuộn/focus rơi giữa trang, focus bị giành lúc tải trang, nút loa quá to, danh sách buổi luyện xuống dòng xấu → đã sửa và soát lại bằng ảnh chụp.
- **Ký tự đặc biệt lại bị ghi thành ký tự thật** (`\u0301` trong một test, `\u00a0` trong Player điền chữ); `grep -P` của Git Bash không bắt được → test vệ sinh NFC + script quét byte bằng Node phát hiện; đã chuyển về dạng thoát, quét lại 0 lỗi (quy tắc CLAUDE.md §9.3.8).
- Test mạng E2E chập chờn do request prefetch của Next → khẳng định chặt hơn: chỉ GET, cùng nguồn, không body, đường dẫn của ứng dụng hoặc `/_next` chỉ với tham số `_rsc`.

### 3.1 Kết quả kiểm tra cuối GĐ4 (chạy thật 2026-10-15, Windows 11, Node 24.18.0)

| Kiểm tra | Kết quả |
|---|---|
| `npm run format:check` | ✅ exit 0 |
| `npm run lint` | ✅ exit 0, 0 lỗi, 0 cảnh báo |
| `npm run typecheck` | ✅ exit 0 |
| `npm run content:check` | ✅ exit 0 — **0 lỗi, 33 cảnh báo** (giống GĐ3: quy ước qu/gi/kiểu dấu, chờ duyệt, quýt, hồ sơ chưa xác nhận — đều chờ GV) |
| `npm run test:run` | ✅ 24 tệp, **729/729** (604 cũ + 124 ca ở 7 tệp mới + 1 ca ròng ở 3 tệp cũ sửa) |
| `npm run build` | ✅ exit 0; 7 route tĩnh; `/demo` prerender tĩnh |
| `npm run test:e2e` | ✅ **199 đạt, 31 bỏ qua có chủ đích, 0 lỗi** — 5 cấu hình (Chromium/WebKit × desktop/điện thoại + iPad cho spec bản chơi thử và bố cục). 31 bỏ qua = 25 từ GĐ2 + 6 mới (ca "đủ 6 dạng bài" và ca "chỉ dùng bàn phím" chỉ chạy trên desktop, bỏ qua ở 3 cấu hình cảm ứng) |
| Phân bố 124 ca unit mới | ghép tiếng 18 · an toàn nội dung (lộ đáp án, chưa học, `unknown`, chưa duyệt, chế độ) 32 · sinh biến thể + cặp nhà – lớp 21 · lộ đáp án / chính sách âm thanh 12 · lược đồ + chấm 15 · phiên luyện + kết quả 16 · giao diện (component) 10 |
| Số câu hợp lệ tối đa / biến thể (Nhóm 2, hồ sơ minh họa, bài MH16) | nhìn hình – chọn chữ 17 · tìm chữ giống mẫu 20 · nghe âm – chọn chữ 27 (chỉ xem) · ghép tiếng có tranh 15 · ghép âm – vần – thanh 48 · tìm âm đầu 91 · tìm vần 31 · tìm thanh 96 · tìm tiếng có vần 24 · điền âm đầu 17 · điền vần 9 · điền dấu thanh 13 · chọn tranh đúng từ 21 · nối từ – tranh 21 · chọn tranh đúng câu 13 · câu hỏi đọc hiểu 8 · sắp xếp câu 25 |
| Chế độ học thật với dữ liệu thật hiện tại | Không sinh câu nào: `PROFILE_NOT_CONFIRMED` (1A2) / `INSUFFICIENT_CONTENT` (0 mục `approved`) — đúng thiết kế |
| Kích thước `/demo` | JS ≈ 228 KB gzip (khung Next + React của `/learn` ≈ 192 KB; phần bài tập ≈ 26 KB sau khi tách `runtime` khỏi zod — trước đó ≈ 270 KB); HTML ≈ 48 KB gzip (dữ liệu bài ≈ 269 KB chưa nén) |

### 3.2 Rà soát trước khi commit GĐ4

- Working tree chỉ gồm tệp của GĐ4 (mã, test, tài liệu, `package.json`/`package-lock.json` thêm `@axe-core/playwright`); không có `.env*`, kết quả test, script tạm (script soát tạm đặt ở thư mục scratchpad ngoài repo; các tệp `scripts/_probe-*` đã xóa).
- Quét nội dung đã stage bằng mẫu khóa API (Anthropic/OpenAI/Supabase/GitHub/AWS/Google), JWT, khóa riêng, gán `PASSWORD|SECRET|TOKEN|API_KEY|PEPPER=`, email, số điện thoại — kết quả ở §3.3.
- Không có dữ liệu học sinh: dữ liệu bản chơi thử là hư cấu, tranh là biểu tượng lucide (ISC), không ảnh thật, không âm thanh.
- Tác giả commit: từ GĐ4 dùng email `noreply` của GitHub (cấu hình **cục bộ** của repo, không sửa cấu hình toàn cục, không viết lại commit cũ).

### 3.3 Git và CI trong GĐ4

- `5861286` — *feat: Giai đoạn 4 — Exercise Engine, sáu dạng bài và bản chơi thử /demo* (107 tệp: 88 mới, 19 sửa). Tác giả: email `noreply` của GitHub (đã đối chiếu ID tài khoản `ThaiTaka` bằng `gh api user`).
- Rà soát nội dung đã stage: không tệp nhạy cảm (`.env*`, khóa, bản xuất CSDL, âm thanh, ảnh, kết quả test); mẫu secret chỉ trúng các tên `tokenIds`/`tokens` (token của câu — dương tính giả); không email, không số điện thoại; `test.skip` mới chỉ là 2 bỏ qua có điều kiện đã nêu ở §3.1. 107 tệp đều NFC, LF, không ký tự ẩn/dấu tổ hợp rời (quét byte bằng Node).
- `git push origin main` (2026-10-15 08:54 UTC): `3035e5b..5861286`, fast-forward, không viết lại lịch sử. Repo vẫn **PUBLIC**.
- **GitHub Actions — run 38709007640 (commit `5861286`): ✅ thành công trong 71 giây**, ảnh `ubuntu-24.04`, Node 24.21.0 (theo `.nvmrc`): `npm ci` → format ✅ → lint ✅ → typecheck ✅ → content:check ✅ (0 lỗi, 33 cảnh báo — giống Windows) → unit test ✅ **729/729** (24 tệp) → build ✅ (`/demo` tĩnh). CI không chạy E2E (E2E chạy cục bộ, §3.1).
- Commit tài liệu kế tiếp ghi lại các kết quả này (xem `git log`; CI của commit đó cũng phải xanh).
- **Không deploy Vercel** (đúng yêu cầu GĐ4).

### GĐ3 — 2026-10-14 (tóm tắt)

Cài zod 4.6.7; thư viện `src/lib/vietnamese/` (11 module, hàm thuần); kho tri thức `content/` (29 chữ, 39 âm, 6 thanh, 153 vần, 13 quy tắc, 17 cặp dễ nhầm, 149 ngữ liệu nguyên bản — tất cả chờ GV); chuỗi bài minh họa 17 bài, hồ sơ 1A2 `unconfirmed`, hồ sơ `illustrative-demo`; `src/features/knowledge/` (`resolveKnowledgeState`, `checkReadability`, `selectCorpusItems`, đồ thị tiên quyết); `npm run content:check` (0 lỗi, 33 cảnh báo) + CI; 524 test mới (tổng 604) + 4 đột biến; E2E 139 đạt; tài liệu VIETNAMESE_ENGINE, TEACHER_REVIEW_CHECKLIST. Rà soát toàn bộ lịch sử Git (không secret); commit `5e63087` + **push `main` lần đầu** (2026-10-14); GitHub Actions run 38596049449 xanh trên `ubuntu-latest` (604/604); commit tài liệu `3035e5b`.

### GĐ2 — 2026-10-12 → 2026-10-14 (tóm tắt)

Scaffold Next 16.4 qua thư mục tạm; cấu hình TS strict/ESLint/Prettier/Vitest/Playwright; design system + 5 trang khung + 404/lỗi; header bảo mật; CI; README; soát giao diện bằng ảnh chụp và sửa 9 lỗi hiển thị; format/lint/typecheck/80 unit/build/139 E2E đều xanh; chủ dự án tự tạo commit `16d1413`; thêm remote `origin`; commit tài liệu cuối GĐ2 `d1210e6`.

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
| D-008 | Exercise Type Module; 6 dạng MVP: `letter_sound`, `build_syllable`, `identify_unit`, `fill_blank`, `word_picture`, `sentence_reading` | Chốt (hiện thực ở GĐ4; chờ GV góp ý nội dung) | PRD §9, AD-06 |
| D-009 | Mức hỗ trợ H3→H0 theo từng HS × dạng bài, luật mặc định có tham số | Chốt (hiệu chỉnh khi thí điểm) | PRD §11 |
| D-010 | Chính sách âm thanh chống lộ đáp án A1–A7 + bộ kiểm tra chặn duyệt | Chốt (hiện thực ở GĐ4) | PRD §12, AD-35 |
| D-011 | Kho tri thức lõi là dữ liệu trong repo (`content/`) + thư viện xác định `lib/vietnamese`; không vector DB | Chốt (hiện thực ở GĐ3) | AD-07, AD-17, AD-25 |
| D-012 | Âm thanh sinh trước/ghi âm GV; âm/vần đơn lẻ bắt buộc ghi âm GV; nhà cung cấp TTS chọn sau POC | Chốt / POC (GĐ6) | AD-09 |
| D-013 | PDF bằng `@react-pdf/renderer` + font Andika (OFL) | Chốt / POC kỹ thuật (GĐ8) | AD-10 |
| D-014 | Phân hóa dựa trên luật: mastery trung bình trượt, Leitner 1–5, mức hỗ trợ, câu bắc cầu; đề xuất đổi nhóm do GV quyết định | Chốt cho MVP | AD-11 |
| D-015 | AI sau MVP qua cổng `StructuredLlm`; adapter đầu tiên dùng SDK chính thức của Anthropic, mô hình mặc định `claude-opus-5-5` (đổi bằng biến môi trường) | Hoãn (GĐ11) | AD-12 |
| D-016 | Làm bộ máy bài tập + `/demo` (GĐ4) **trước** CSDL (GĐ5) để thử khả dụng sớm mà không thu dữ liệu | Chốt (đã làm GĐ4) | TASKS |
| D-017 | Tên nhóm trong mã: `foundation` (Nhóm 3), `developing` (Nhóm 2), `extending` (Nhóm 1) để tránh nhầm thứ tự | Chốt | PRD §10 |
| D-018 | Thêm `.gitignore`/`.gitattributes` ngay ở GĐ1 vì repo GitHub đang public | Chốt | |
| D-019 | Giữ `cacheComponents` + `partialPrefetching` (mặc định của `create-next-app` 16.4) | Chốt | AD-19 |
| D-020 | CSP không nonce đặt trong `next.config.ts` (`'unsafe-inline'` cho script); xem lại khi có dữ liệu thật | Chốt cho GĐ2–4 | AD-20 |
| D-021 | Font Be Vietnam Pro + Andika qua `next/font/google` (tự host lúc build) | Chốt | AD-21 |
| D-022 | Vitest + Testing Library; Playwright chạy trên bản production, Chromium + WebKit × desktop + điện thoại (+ iPad từ GĐ4) | Chốt | AD-22 |
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
| D-037 | Câu bài tập tách `content` (hiển thị) / `answer`; Player chỉ nhận `{type, variant, content}`; đáp án chỉ tới giao diện qua `reveal` sau khi chấm; nhãn tranh trước khi chấm trung tính | Chốt | AD-32 |
| D-038 | Mỗi dạng bài tách `runtime.ts` (client + server, không zod) khỏi `module.ts` (lược đồ, bộ kiểm tra — máy chủ); hai registry. JS `/demo` giảm từ ≈ 270 KB xuống ≈ 228 KB gzip | Chốt | AD-33 |
| D-039 | Bài tập của `/demo` sinh và kiểm tra ở máy chủ **lúc build** (trang tĩnh); trình duyệt không nhận kho tri thức | Chốt cho GĐ4 (GĐ7 sinh theo phiên của HS) | AD-34 |
| D-040 | GĐ4 **không phát âm thanh**: nút loa là `AudioSlot` bị khóa ghi "Chưa có âm thanh"; **không dùng Web Speech API** kể cả ở `/demo` (giọng tiếng Việt có thể là giọng trực tuyến — gửi chữ ra ngoài; chất lượng chưa xác minh) — điều chỉnh so với PRD §12.2 | Chốt (xem lại ở GĐ6) | AD-39, PRD §12.2 |
| D-041 | Chính sách âm thanh khai báo **theo mục tiêu học tập** (nghe / mã hóa – chính tả / phân tích / đọc) × vai trò × mức H3–H0 × trước/sau chấm; bộ soát lộ đáp án so theo chuỗi tiếng, có danh sách trường được phép | Chốt | AD-35 |
| D-042 | Bộ sinh theo quy tắc: ứng viên hữu hạn, RNG có seed (FNV-1a + mulberry32) theo từng ứng viên, nhiễu ưu tiên `confusions.json`, kiểm tra từng câu; thiếu dữ liệu trả lý do, không nới quy tắc | Chốt | AD-36 |
| D-043 | Cặp bài ở nhà – ở lớp = "bài sinh đôi" (cùng nhóm đơn vị trọng tâm, độ khó ước lượng chênh ≤ 1, khác mục tiêu cụ thể); hợp đồng phiếu 8 thông tin; **không** khẳng định độ khó tương đương chính xác | Chốt (chờ GV đánh giá) | AD-37 |
| D-044 | Hai chế độ nội dung: `demo` (chỉ hồ sơ minh họa, nội dung chờ duyệt kèm cảnh báo, không lưu) / `production` (hồ sơ `confirmed`, mọi ngữ liệu, tranh, tệp tham chiếu, âm thanh phải `approved`) | Chốt | AD-38 |
| D-045 | Số lượt theo **mức hỗ trợ** (H3/H2 = 3, H1 = 2, H0 = 1) thay vì theo dạng bài; gợi ý tự hiện ở H3, theo yêu cầu ở H2/H1, không có ở H0; "Cô làm mẫu" chỉ ở H3 | Chốt (hiệu chỉnh khi thí điểm) | PRD §9.3, EXERCISE_ENGINE §4 |
| D-046 | Điều chỉnh dạng bài: thêm "Tìm chữ giống chữ mẫu" (dạng 1); dạng 6 làm "trả lời câu hỏi đọc hiểu" thay cho Đúng/Sai (chưa làm); gợi ý dạng 5 là tách tiếng + loại bớt tranh | Chốt (chờ GV góp ý) | PRD §9.3 |
| D-047 | Tranh của bản chơi thử dùng biểu tượng lucide (ISC, đã có từ GĐ2) — fixture riêng, `pending_review`, ghi nguồn; bộ biểu tượng hướng dẫn SVG riêng (TASKS 4.6) hoãn. Thêm `@axe-core/playwright` (dev) + cấu hình Playwright iPad | Chốt cho GĐ4 | TASKS 4.6, 4.8 |

## 5. Câu hỏi mở

| Mã | Câu hỏi | Ảnh hưởng tới |
|---|---|---|
| Q-01 | Lớp 1A2 dùng bộ sách Tiếng Việt 1 nào? Đang học đến bài nào? | **Then chốt** — chưa có thì hồ sơ 1A2 không dùng được, chế độ học thật không sinh bài |
| Q-02 | Quy ước của lớp: cách gọi tên chữ và tên âm ("bờ", "cờ", "ngờ kép"…), phân tích "qu"/"gi", "i" dùng chung (gì, giếng), vị trí dấu thanh ("hoà"/"hòa") | **Then chốt** — phiếu rà soát mục B, C, D |
| Q-03 | GV có thể ghi âm bao nhiêu âm/vần/câu lệnh? Giọng vùng miền của lớp? | GĐ6 (GĐ4 đã làm không âm thanh); cặp dễ nhầm theo phương ngữ |
| Q-04 | Thiết bị và chất lượng mạng phổ biến của phụ huynh; thời gian trẻ luyện mỗi ngày | GĐ7 (bản chơi thử đã kiểm trên điện thoại 360 px, iPhone, iPad) |
| Q-05 | Bên kiểm soát dữ liệu (nhà trường hay GV)? Quy trình xin đồng ý của phụ huynh? | GĐ5, GĐ10 (nên bắt đầu trao đổi sớm) |
| Q-06 | Máy in ở trường: đen trắng hay màu, khổ A4? | GĐ8 |
| Q-07 | Sĩ số lớp, số học sinh mỗi nhóm hiện tại | GĐ5, GĐ9 |
| Q-08 | Xưng hô trong lời đọc: "cô – con" hay "cô – em"? GĐ4 tạm dùng "con" trong gợi ý/phản hồi của bản chơi thử (`src/strings/vi.ts`, mục `practice`) | Câu lệnh, gợi ý, phản hồi; kịch bản ghi âm GĐ6 |
| Q-09 | Ai duyệt nội dung: một GV hay tổ chuyên môn? | GĐ6 |
| Q-10 | Ngân sách cho Supabase Pro / Vercel Pro; có cần tên miền riêng? | GĐ10 |
| Q-11 | Repo GitHub để **public** là có chủ ý? | Đã push theo chỉ đạo; không tự đổi public/private |
| Q-13 | ~~Dùng email `noreply` của GitHub cho commit sau?~~ | Từ GĐ4 dùng email `noreply` (cấu hình cục bộ repo); commit cũ giữ nguyên, không viết lại lịch sử |
| Q-14 | Tên ba lộ trình (Khởi động, Vững bước, Tăng tốc) và nội dung trang chủ có phù hợp với GV/phụ huynh không? | Trang chủ, `/demo` |
| Q-15 | Thứ tự bài và danh sách âm/vần của bộ sách (sau khi có Q-01): ai nhập, nguồn đối chiếu nào? | Hồ sơ 1A2, GĐ5–GĐ6 |
| Q-16 | Cách đánh vần qu + y (quý, quýt, quyển, quỳnh) theo bộ sách của lớp | Các tiếng này đang `unknown` |
| Q-17 | GV đánh giá danh sách "đọc được" ở 3 mốc bài minh họa có hợp lý không (phiếu rà soát mục I)? | Tiêu chí nghiệm thu GĐ3 còn mở |
| Q-18 | GV rà soát fixture bản chơi thử: 22 tranh biểu tượng có dễ hiểu với trẻ không; 8 câu hỏi đọc hiểu; nhóm chữ dễ nhầm hình dạng (b/d/p/q, m/n/u, o/ô/ơ…); câu lệnh 17 biến thể | Tiêu chí "GV xác nhận câu lệnh và biểu tượng" (GĐ4); GĐ6 |
| Q-19 | Ai sắp xếp buổi thử khả dụng (TASKS 4.9), khi nào; có học sinh tham gia không (cần đồng ý của phụ huynh, không ghi hình/ghi âm trẻ)? | Kiểm chứng R-06 |
| Q-20 | Số lượt và thang gợi ý theo mức (H3/H2 = 3, H1 = 2, H0 = 1; H0 không gợi ý) có phù hợp với thói quen làm phiếu ở lớp? | D-045; GĐ7 |

*(Q-12 — cho phép push `main` — đã được trả lời ở yêu cầu GĐ3.)*

## 6. Rủi ro đang theo dõi

| Mã | Rủi ro | Mức | Giảm thiểu |
|---|---|---|---|
| R-01 | Pháp lý: Luật 91/2025/QH15 (hiệu lực 01/01/2026) — dữ liệu trẻ em (Điều 24); xử lý trên nền tảng ở nước ngoài được coi là chuyển dữ liệu xuyên biên giới (Điều 20) | Cao | Tối thiểu hóa dữ liệu; `/demo` không lưu (E2E kiểm chứng); chỉ thu dữ liệu thật sau rà soát pháp lý và đồng ý (GĐ10) |
| R-02 | Vercel Hobby chỉ cho sử dụng cá nhân phi thương mại | Trung bình | Xác nhận với Vercel/nhà trường hoặc dùng Pro cho production |
| R-03 | Supabase Free tạm dừng sau 1 tuần không hoạt động và không có sao lưu | Cao (với production) | Dùng Supabase Pro cho thí điểm |
| R-04 | Repo public: lộ secret hoặc dữ liệu nếu commit nhầm | Trung bình | `.gitignore`; test vệ sinh repo; `content:check` chặn mẫu dữ liệu cá nhân; quét nội dung trước mỗi push; GitHub secret scanning |
| R-05 | TTS phát âm sai âm/vần tách rời, khác giọng cô | Trung bình | Ghi âm GV cho âm/vần; POC TTS (GĐ6) |
| R-06 | Trẻ 6 tuổi chưa tự thao tác được | Cao | Bản chơi thử đã sẵn sàng (GĐ4); **chưa thử với người dùng thật** — buổi thử khả dụng 4.9 (Q-19) |
| R-07 | Tương thích phiên bản: Serwist + Turbopack, react-pdf trên Next 16 | Trung bình | POC (GĐ7, GĐ8) |
| R-09 | Khóa `anon`/`service_role` của Supabase bị khai tử cuối 2026 | Thấp | Dùng khóa publishable/secret ngay từ đầu |
| R-10 | Lạm dụng đăng nhập ẩn danh | Thấp–TB | Giới hạn tần suất riêng + Turnstile ở `/join` + dọn người dùng ẩn danh |
| R-11 | Docker daemon chưa chạy; Windows long paths tắt | Thấp | Bật Docker Desktop khi cần Supabase local (GĐ5) |
| R-12 | Bản quyền nội dung SGK, hình ảnh | Trung bình | Chỉ lưu thứ tự bài/đơn vị; ngữ liệu viết mới; tranh bản chơi thử là biểu tượng lucide (ISC) có ghi nguồn |
| R-13 | GV quá tải khi duyệt nội dung (149 mục + dữ liệu tham chiếu + fixture bản chơi thử) | Trung bình | Phiếu rà soát gom theo nhóm; duyệt dữ liệu tham chiếu cấp tệp; GĐ6 có giao diện duyệt |
| R-14 | ESLint 9 hết hỗ trợ; lỗ hổng mức cao (ReDoS `braces`) trong chuỗi `eslint-config-next` — chỉ công cụ dev | Thấp | Theo dõi bản hỗ trợ ESLint 10; không `npm audit fix --force` |
| R-16 | CSP cho phép `'unsafe-inline'` cho script (không nonce) | Thấp ở GĐ2–4 (không dữ liệu thật) | Xem lại nonce/SRI ở GĐ5 |
| R-17 | `npm install` chặn script cài đặt của `unrs-resolver` (allow-scripts của npm 11) | Thấp | Lint vẫn chạy đúng |
| R-18 | `next.config.ts` nạp bằng TypeScript gốc của Node 24 (cần đuôi `.ts`, cấm enum) | Thấp | Quy tắc CLAUDE.md §9.1 |
| R-19 | Dữ liệu kho tri thức do trợ lý AI soạn, **chưa** được GV kiểm chứng (tên chữ, cách gọi âm, danh mục vần, ngữ liệu) | Trung bình | 0 mục `approved`; AI không được duyệt; phiếu rà soát; chế độ học thật chặn nội dung chưa duyệt (có test) |
| R-20 | Ký tự vô hình/dấu tổ hợp lọt vào mã khi soạn (xảy ra ở GĐ3 **và GĐ4**) | Thấp (đã xử lý) | Dạng thoát `\uXXXX`; test vệ sinh NFC; quét byte bằng Node trước commit (CLAUDE.md §9.2.2, §9.3.8) |
| R-21 | Quy ước phân tích tạm (qu, gi, i dùng chung) có thể khác bộ sách thật | Trung bình | Là tham số; quy ước chưa xác nhận → `unknown`; chờ Q-02, Q-16 |
| R-22 | Email cá nhân trong siêu dữ liệu các commit cũ (đến `3035e5b`) trên repo public | Thấp | Từ GĐ4 dùng email `noreply`; không viết lại lịch sử (theo yêu cầu) |
| R-23 | GitHub chuyển `ubuntu-latest` sang Ubuntu 26 từ 2026-10-19 | Thấp | Theo dõi run CI sau ngày đó; nếu lỗi do ảnh, ghim tạm `ubuntu-24.04` |
| R-24 | **Chưa có âm thanh:** Nhóm 3 (chưa đọc được câu lệnh) khó tự làm; "Nghe âm – chọn chữ" chưa chấm được; buổi thử khả dụng sẽ cần người lớn đọc câu lệnh | Cao (với trải nghiệm thật) | Điểm tích hợp `AudioSlot` + khe âm thanh trong dữ liệu đã sẵn; bộ sinh tự gắn tệp khi có; GĐ6 (Q-03) |
| R-25 | Tranh biểu tượng có thể mơ hồ với trẻ (ví dụ cùng một hình nhiều tên gọi) | Trung bình | Fixture `pending_review` có ghi chú độ rõ; nhãn trung tính trước khi chấm; GV rà soát (Q-18); tranh thật ở GĐ6 |
| R-26 | JS của route học sinh vượt nhẹ ngân sách ≈ 200 KB gzip (`/demo` ≈ 228 KB, khung Next + React đã ≈ 192 KB) | Thấp–TB | Đã tách runtime khỏi zod; đo mỗi giai đoạn; cân nhắc tách mã theo dạng bài (T-16) |
| R-27 | Bộ soát lộ đáp án **thận trọng** (so theo chuỗi tiếng) → loại cả câu hợp lệ, vài biến thể ít câu (điền vần 9, đọc hiểu 8); ngược lại không phát hiện lộ đáp án **theo nghĩa** (tranh gợi ý quá rõ) | Trung bình | Thêm ngữ liệu/tranh (GĐ6); GV duyệt từng câu trước khi đến tay học sinh |

## 7. Bước tiếp theo

> **Đã thay thế ở R01:** bước tiếp theo hiện hành ở [REDESIGN_PROGRESS §8](REDESIGN_PROGRESS.md#8-bước-tiếp-theo). Nội dung dưới đây giữ để tra cứu; phần Supabase chuyển sang R03.

**Đề xuất GĐ5 — Supabase: CSDL nền, RLS và xác thực** (chi tiết: [TASKS.md](TASKS.md#gđ5--supabase-csdl-nền-rls-và-xác-thực-l)): migrations + RLS + kiểm thử cách ly, đăng nhập GV, thẻ học QR cho HS (POC trước), seed kho tri thức từ `content/`, ghi nhận đồng ý. Bộ máy GĐ4 nối vào qua student gateway ở GĐ7 (sinh bài theo phiên, ghi `item_attempt` ở máy chủ) — **không** đưa đáp án hay kho tri thức xuống trình duyệt.

Điều kiện trước khi bắt đầu:

1. Người điều phối nghiệm thu GĐ4.
2. Chủ dự án cho phép tạo dự án Supabase *dev* (region Singapore); Docker Desktop đang chạy (Supabase local).
3. Nên có trước: hướng trả lời Q-05 (bên kiểm soát dữ liệu, quy trình đồng ý) và Q-07 (sĩ số).
4. Song song, không chặn GĐ5: GV trả lời Q-01, Q-02, Q-16, Q-18; buổi thử khả dụng (Q-19); chuẩn bị ghi âm (Q-03) cho GĐ6.

## 8. Nhật ký phiên

| Ngày | Phiên | Giai đoạn | Tóm tắt |
|---|---|---|---|
| 2026-10-12 | #1 | GĐ1 | Kiểm tra môi trường; `git init -b main`; xác minh phiên bản và tài liệu; tạo 6 tài liệu + `.gitignore` + `.gitattributes`; kiểm tra mã hóa, 93 liên kết, 6 sơ đồ Mermaid, quét secret — tất cả đạt. Không commit/push/deploy. **Kết thúc GĐ1 — đã được nghiệm thu.** |
| 2026-10-12 → 2026-10-14 | #2 | GĐ2 | Scaffold Next 16.4; cấu hình TS strict/ESLint/Prettier/Vitest/Playwright; design system + 5 trang khung + 404/lỗi; header bảo mật; CI; README; format/lint/typecheck/80 unit/build/139 E2E đều xanh; commit `16d1413` (chủ dự án), `d1210e6`; thêm remote `origin`. **Kết thúc GĐ2 — đã được nghiệm thu.** |
| 2026-10-14 | #3 | GĐ3 | Thư viện `src/lib/vietnamese/`; kho tri thức `content/` (tất cả chờ GV); lớp tiến độ; `src/features/knowledge/`; `npm run content:check` + CI; 604 unit test; commit `5e63087` + **push `main` lần đầu**; CI xanh trên Linux; commit tài liệu `3035e5b`. **Kết thúc GĐ3 — đã được chấp nhận về kỹ thuật.** |
| 2026-10-14 → 2026-10-15 | #4 | GĐ4 | Ghép tiếng `compose.ts`; lõi bộ máy bài tập; 6 dạng / 17 biến thể; bộ kiểm tra 9 bước + chống lộ đáp án theo mục tiêu; bộ sinh có seed + cặp nhà – lớp + hợp đồng phiếu; phiên luyện + kết quả trong bộ nhớ; `/demo` tương tác (3 buổi mẫu, H3→H0, không âm thanh, không lưu); 729/729 unit, 199 E2E đạt (thêm iPad, axe), content:check 0 lỗi; 4 đột biến kiểm độ nhạy; tài liệu EXERCISE_ENGINE + cập nhật 7 tài liệu; commit `5861286` (email `noreply`) + push; GitHub Actions run 38709007640 xanh (729/729); commit tài liệu ghi kết quả CI. **Kết thúc GĐ4 — chờ duyệt. Không deploy Vercel, không Supabase, không AI, không đổi public/private.** |
| 2026-10-16 | — | (ngoài giai đoạn) | Thư mục được clone lại từ GitHub; một phiên Claude tạo 2 báo cáo PDF (`docs/BaoCao_ReadMateAI.pdf`, `docs/LuongHoatDong_ReadMateAI.pdf`), chưa commit |
| 2026-10-16 | R01 | R01 | Đổi định hướng sản phẩm; nhánh `feature/home-learning-redesign`; checkpoint 2 PDF; 8 tài liệu thiết kế mới (PLANNED); cập nhật CLAUDE.md, PRD, ARCHITECTURE, README, TASKS, tệp này. Chi tiết: [REDESIGN_PROGRESS §9](REDESIGN_PROGRESS.md#9-nhật-ký-phiên) |
| 2026-10-20 | R02 | R02 | Giao diện mới "Modern 2D Educational Adventure", Student Dashboard + Game World (dữ liệu minh họa), asset SVG chờ GV duyệt, H0 "Tự làm"; chi tiết ở [REDESIGN_PROGRESS.md](REDESIGN_PROGRESS.md). Phát hiện công việc GĐ5 âm thanh chưa commit (RQ-06) → nhánh cục bộ `local/gd5-audio-wip` |
| 2026-10-20 | R03 | R03 | Supabase local + RLS, đăng nhập GV, thẻ học + liên kết thiết bị, quản lý lớp/học sinh/đồng ý; pgTAP 36, tích hợp 78, unit 819, E2E 262 + 30 (CSDL); chi tiết ở [REDESIGN_PROGRESS §4](REDESIGN_PROGRESS.md#4-việc-đã-làm-trong-r03). Supabase Cloud chưa tạo |
| 2026-10-21 | R05 | R05 | Ranking Engine 1-2-2-4, bảng xếp hạng lớp (cờ hệ thống tắt), avatar 16 mẫu, trình chiếu GV; nghiệm thu bằng GitHub Actions trên `83b34a7` (unit 952, pgTAP 65, tích hợp CSDL 129, E2E 9/9 job xanh); chi tiết ở [REDESIGN_PROGRESS §5b](REDESIGN_PROGRESS.md) |
| 2026-10-20 | R04 | R04 | Scoring Engine (+10/−5, sàn 0, sổ cái chỉ ghi thêm), chấm bài ở máy chủ, câu phát hành không lộ đáp án, buổi luyện có điểm, mở thẻ bản đồ, điều kiện mini-game; pgTAP 52, tích hợp 106, unit 900, E2E 262 + 40 (CSDL), p95 104 ms (local); chi tiết ở [REDESIGN_PROGRESS §5](REDESIGN_PROGRESS.md#5-việc-đã-làm-trong-r04). Chỉ fixture hư cấu trên Supabase local; Cloud chưa tạo |
| 2026-10-21 | R06.2 | R06 | Giao diện vinh danh TOP 3: bục danh dự, hoạt cảnh 3 → 2 → 1, đồng hạng, Bỏ qua/Xem lại, giảm chuyển động, lịch sử; unit +11, E2E honors.spec. Không làm reset (R06.3) |
| 2026-10-21 | R06.3 | R06 | Backend reset mùa: migration 20261024090000, `teacher_reset_season`, `resetSeason`, khóa ý định + mùa xác nhận, hạng cuối 1-2-2-4, đồng thời/rollback; pgTAP 95, DB 14 mới, unit +12. Chưa có giao diện (R06.4) |
| 2026-10-21 | R06.4 | R06 | Giao diện reset mùa hai bước nối `resetSeason`; unit +9, E2E season-reset 9/9 local; CI chờ |
| 2026-10-21 | R06.5 | R06 | API học sinh `GET /api/student/honors/latest` + khóa ý định chống snapshot vinh danh trùng (migration 20261025090000); unit/pgTAP/DB/E2E mục tiêu đạt local; CI chờ |
| 2026-10-21 | R07.1 | Nghiệm thu R06; nguyên mẫu đồ họa Mê cung kho báu `/demo/treasure-maze` (React + SVG/CSS), số đo FPS/bundle ở REDESIGN_PROGRESS §5h; CI chờ |
| 2026-10-21 | R07.2 | Lõi Game Engine thuần TS (grid, reducer, level-validate) + 24 unit test; CI chờ |
| 2026-10-21 | R07.3 | 3 màn Mê cung kho báu (JSON) + schema zod + `content:check` kiểm màn; CI chờ. Không làm R07.4 |
| 2026-10-21 | R07.4 | Điều khiển nhân vật Mê cung kho báu (bàn phím, 4 nút, giữ/thả, camera 7×7, tạm dừng, thử thách minh họa); unit + E2E 48/48 local; CI chờ. Không làm R07.5 |
| 2026-10-21 | R07.5a | Database `game_runs` + RPC bắt đầu/tiếp tục/lưu vị trí, reset mùa đóng lượt dở; pgTAP + DB local xanh; CI chờ. Không làm R07.5b |
| 2026-10-21 | R07.5b2 | Trang Mê cung có xác thực nối API lượt chơi: tự lưu vị trí (5 bước/3 giây/tạm dừng/ẩn trang), khôi phục sau tải lại, STATE_CONFLICT/SEASON_CLOSED/mất mạng; unit + E2E CSDL local; lộ trình nộp: R09 hoãn sau khi nộp. Không làm R07.6/R08 |
| 2026-10-22 | R07.6 | Lớp phủ tạm dừng, chờ xác nhận lưu khi rời màn, đo lại FPS/bundle (60 FPS, 224,5 KB gzip); R07 nghiệm thu phần engine; CI chờ. Không làm R08 |
| 2026-10-22 | R08.1 | Database 7 chạm trán (`game_encounters`, `game_level_triggers`), ngữ cảnh game của `question_instances`, chặn lưu vị trí xuyên trigger, reset mùa đóng chạm trán; sửa test chập chờn reset mùa; pgTAP + DB local xanh; CI chờ. Không làm R08.2 |
| 2026-10-22 | R08.2 | Máy mới dựng lại (Node 24.18, Docker, Supabase local); bắt đầu lượt Mê cung phân bổ 1 lượt + 7 chạm trán + 21 câu trong một giao dịch, thiếu nội dung → `INSUFFICIENT_CONTENT`; pgTAP + DB local xanh; CI + E2E xanh `042ab92`. Không làm R08.3 |
| 2026-10-22 | Báo cáo (không phát triển) | Tạo bài trình chiếu `docs/presentations/ReadMateAI_BaoCaoDuAn.pptx` (20 slide, ảnh chụp bản chơi thử + nhân vật SVG) và mã tạo ở `scripts/presentations/`; phản ánh đúng tiến độ xong R08.2; không sửa ứng dụng, không làm R08.3 |
| 2026-10-22 | R08.3 | Đồng bộ máy cũ về `ea915bb`; sửa CI `repo-hygiene`; kích hoạt chạm trán, chấm điểm + HP, kết thúc chạm trán, mở kho báu ở máy chủ (migration + 3 API); pgTAP 226 + DB 253 + unit 1113 local. Không làm R08.4 |
| 2026-10-22 | R08.4 | Giao diện Mê cung có chạm trán (lưu trước khi kích hoạt, màn quái vật, 3 trái tim, Player GĐ4, hoạt cảnh, tải lại, rương); unit 1133 + E2E toàn trình local xanh. Không làm R08.5 |
| 2026-10-23 | R08.5 | Soát quái vật: tên/mã trung tính, bộ soát chống lộ đáp án (`monster-audit`), giấy phép hình + hoạt cảnh, hồ sơ GV `docs/reviews/R08_MONSTER_REVIEW.md` (phiếu "Chưa đánh giá"); GV chưa duyệt; CI chờ. Không làm R08.6 |
| 2026-10-25 | R08.6 | Nghiệm thu R08.5 kỹ thuật (CI xanh; E2E push 1 test chập chờn webkit-mobile, PR bị hủy); chơi lại Mê cung không tính điểm (`is_replay`, GAME_REPLAY, 7 × 21, điểm/sổ cái không đổi, hai tab, reset mùa, giao diện "Chơi lại cho vui"); pgTAP 239 + DB 268 + unit 1163 local; `build` local bị `SecurityFatalError` của Next 16.4.0; CI/E2E chờ. R08 xong về kỹ thuật, chưa duyệt dùng thật. Không làm R10/R11 |
| 2026-10-25 | R08.7 | Tiếp tục lượt Mê cung tính điểm đang dở khi điểm < 50 (ngưỡng chỉ áp dụng khi bắt đầu lượt mới); sửa `hasLevelProgress`; test unit + DB; CI chờ. Rủi ro mở: Next 16.4.0 `SecurityFatalError` trước khi triển khai |
