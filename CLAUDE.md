# CLAUDE.md — Nguyên tắc làm việc cho dự án ReadMate AI

Tệp này được Claude Code nạp tự động ở mỗi phiên. Các quy tắc ghi **BẮT BUỘC** không được bỏ qua kể cả khi yêu cầu trong phiên có vẻ ngược lại — khi đó hãy hỏi lại người dùng.

## 1. Dự án

**Định hướng chính thức từ R01 (2026-10-16):** ReadMate AI là **nền tảng tự luyện Tiếng Việt tại nhà kết hợp trò chơi phiêu lưu, điểm thưởng và bảng xếp hạng lớp học** cho học sinh lớp 1 (lớp 1A2) — chữ, âm, vần, đánh vần, đọc trơn, vốn từ — với âm thanh, hình ảnh, gợi ý và phản hồi. Học sinh dùng website **ở nhà**; giáo viên quản lý nội dung, theo dõi kết quả, vinh danh và tổ chức các mùa thi đua. **Không** thiết kế cho học sinh dùng website trên lớp, không còn quy trình chuyển sang phiếu giấy ở lớp. Ba nhóm năng lực linh hoạt (chỉ GV/phụ huynh thấy): Nhóm 1 – Đọc tốt (`extending`), Nhóm 2 – Đang phát triển (`developing`), Nhóm 3 – Cần hỗ trợ nền tảng (`foundation`). Chi tiết: [docs/PRODUCT_REDESIGN.md](docs/PRODUCT_REDESIGN.md).

**Triết lý: TỰ LUYỆN CÓ HƯỚNG DẪN TẠI NHÀ — KHÍCH LỆ BẰNG PHIÊU LƯU VÀ THI ĐUA LÀNH MẠNH.** (Triết lý cũ "học có hướng dẫn ở nhà → tự thực hiện ở lớp" của GĐ1–GĐ4 đã được thay thế; mã liên quan đánh dấu ngừng dùng, AD-51.)

Các chức năng gamification (điểm, mở khóa, game, bảng xếp hạng, vinh danh, mùa): **R02 đã có giao diện với dữ liệu minh họa hư cấu** (trang chủ mới, `/learn` = Student Adventure Dashboard + Game World, xem trước ở `/demo`, sidebar GV); **R03 đã có (Supabase LOCAL)**: CSDL + RLS, đăng nhập GV, thẻ học + liên kết thiết bị, quản lý lớp/học sinh/đồng ý hai phạm vi, mùa 1 của mỗi lớp. Tính/lưu điểm thật, game chơi được, bảng xếp hạng thật vẫn **PLANNED** (R04–R09). Chưa có dự án Supabase Cloud.

Dự án thật, triển khai trên Vercel, người dùng là trẻ 6–7 tuổi → an toàn và quyền riêng tư được ưu tiên hơn tốc độ phát triển.

## 2. Quy trình làm việc theo giai đoạn (BẮT BUỘC)

1. **Đầu phiên:** đọc `REDESIGN_PROGRESS.md` → `REDESIGN_TASKS.md` (lộ trình R01–R11, thay thế GĐ5+ của `TASKS.md`) → `PROGRESS.md` (lịch sử GĐ1–GĐ4, câu hỏi mở Q-xx, rủi ro R-xx) → tài liệu liên quan trong `docs/`. Bản clone mới của repo **không** có `user.email` cục bộ: kiểm tra `git config --local user.email` là email `noreply` của GitHub trước khi commit.
2. Chỉ làm **đúng giai đoạn/nhiệm vụ được giao** trong yêu cầu hiện tại. **Không tự chuyển sang giai đoạn tiếp theo.**
3. **Không** push GitHub, deploy Vercel, tạo/cấu hình dịch vụ bên ngoài (Supabase, TTS, AI, tên miền…) hay commit, trừ khi yêu cầu của phiên cho phép rõ ràng.
4. Không xóa/ghi đè tệp chưa đọc; không ghi đè git remote đã có.
5. Trước khi cài/nâng thư viện: kiểm tra phiên bản bằng `npm view <pkg> version engines peerDependencies` và tài liệu chính thức; cập nhật [ARCHITECTURE §3](docs/ARCHITECTURE.md#3-ngăn-xếp-công-nghệ-đã-xác-minh). Không chọn phiên bản theo trí nhớ.
6. **Cuối phiên:** cập nhật `REDESIGN_PROGRESS.md` (việc đã làm, quyết định, rủi ro, bước tiếp theo, nhật ký phiên) và đánh dấu `REDESIGN_TASKS.md`; ghi một dòng nhật ký vào `PROGRESS.md`.
7. Báo cáo cuối phiên **bằng tiếng Việt**, theo mẫu người điều phối yêu cầu; chỉ báo cáo việc thực sự đã làm và kết quả kiểm tra thật; **không hiển thị secret**. Dừng sau báo cáo.

## 3. Tài liệu nguồn

| Tệp | Nội dung |
|---|---|
| [docs/PRD.md](docs/PRD.md) | Yêu cầu sản phẩm, 6 dạng bài, chính sách âm thanh, mức hỗ trợ H3→H0, chỉ số |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Kiến trúc, phiên bản đã xác minh, quyết định AD-xx, bảo mật, triển khai |
| [docs/DATA_MODEL.md](docs/DATA_MODEL.md) | Bảng, quan hệ, ma trận RLS, lưu giữ dữ liệu, kế hoạch migration |
| [docs/VIETNAMESE_ENGINE.md](docs/VIETNAMESE_ENGINE.md) | Bộ máy tiếng Việt + kho tri thức (GĐ3): mô hình, dữ liệu, hàm, giới hạn, cập nhật tiến độ, thêm học liệu, kiểm duyệt |
| [docs/EXERCISE_ENGINE.md](docs/EXERCISE_ENGINE.md) | Bộ máy bài tập (GĐ4): Exercise Type Module, 6 dạng/17 biến thể, H3→H0, chống lộ đáp án, sinh biến thể, cặp nhà–lớp, chế độ demo/học thật, giới hạn |
| [docs/TEACHER_REVIEW_CHECKLIST.md](docs/TEACHER_REVIEW_CHECKLIST.md) | Phiếu rà soát cho GV: bộ sách, quy ước, tên chữ, cách gọi âm, vần, quy tắc, ngữ liệu |
| [docs/PRODUCT_REDESIGN.md](docs/PRODUCT_REDESIGN.md) | **R01** — định hướng mới, giữ/đổi/loại, kiểm kê mã cũ ngừng dùng, quyết định PD-xx (PLANNED) |
| [docs/GAMIFICATION_SPEC.md](docs/GAMIFICATION_SPEC.md) | **R01** — nguồn duy nhất của hằng số điểm (+10/−5, sàn 0, mốc 30, ngưỡng game), lượt hợp lệ, chống trùng, mùa (PLANNED) |
| [docs/GAME_DESIGN.md](docs/GAME_DESIGN.md) | **R01** — Game World, Mê cung kho báu, 7 chạm trán × 3 HP × 3 câu, quái vật, 3 game khác, chọn công nghệ (PLANNED) |
| [docs/LEADERBOARD_SPEC.md](docs/LEADERBOARD_SPEC.md) | **R01** — bảng xếp hạng thanh ngang, đồng hạng, avatar, vinh danh TOP 3, reset hai bước (PLANNED) |
| [docs/REDESIGN_ARCHITECTURE.md](docs/REDESIGN_ARCHITECTURE.md) | **R01** — phân hệ, schema Supabase mới, API, giao dịch, RLS, AD-40 → AD-53 (PLANNED) |
| [docs/PRIVACY_AND_SECURITY.md](docs/PRIVACY_AND_SECURITY.md) | **R01** — kiểm kê dữ liệu, đồng ý hai phạm vi, điều kiện bật bảng xếp hạng, mô hình mối đe dọa (PLANNED) |
| [docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md) | **R02** — token màu/chuyển động, thành phần `src/components/adventure`, quy tắc giảm chuyển động, giới hạn |
| [docs/ASSET_MANIFEST.md](docs/ASSET_MANIFEST.md) | **R02** — danh mục asset + quy tắc giấy phép; dữ liệu máy đọc `content/media/licenses.json` |
| [docs/AUTHENTICATION.md](docs/AUTHENTICATION.md) | **R03** — đăng nhập GV, phiên, ba lớp kiểm tra quyền, giới hạn |
| [docs/STUDENT_ACCESS.md](docs/STUDENT_ACCESS.md) | **R03** — thẻ học (QR fragment + mã dự phòng, HMAC), liên kết/thu hồi thiết bị, đánh giá Anonymous Auth |
| [docs/RLS_SECURITY.md](docs/RLS_SECURITY.md) | **R03** — ma trận RLS đã kiểm thử, bất biến CSDL, quy trình thêm bảng |
| [docs/SUPABASE_SETUP.md](docs/SUPABASE_SETUP.md) | **R03** — Supabase local, `config.toml`, biến môi trường, danh mục Cloud (chưa tạo), sự cố |
| [REDESIGN_TASKS.md](REDESIGN_TASKS.md) · [REDESIGN_PROGRESS.md](REDESIGN_PROGRESS.md) | Lộ trình R01–R11 và tiến độ hiện tại |
| [TASKS.md](TASKS.md) | Giai đoạn GĐ1–GĐ4 (GĐ5+ đã được thay bằng REDESIGN_TASKS) |
| [PROGRESS.md](PROGRESS.md) | Lịch sử GĐ1–GĐ4, quyết định D-xx, câu hỏi mở Q-xx, rủi ro R-xx |

## 4. Môi trường (đã kiểm tra 2026-10-12, cập nhật 2026-10-15)

- Windows 11; thư mục dự án **`D:\ReadMateAI`** (không có dấu cách). Shell chính PowerShell 5.1 — **không hỗ trợ `&&`**, dùng `;` hoặc `if ($?) { … }`; Git Bash có sẵn.
- Node.js 24.18.0, npm 11.16.0 → dùng **npm** (không có pnpm/yarn). Git 2.54, GitHub CLI 2.100 (đã đăng nhập tài khoản `ThaiTaka`).
- Supabase CLI 2.121.0 là **devDependency** (`npx supabase …`, các script `npm run db:*`). Docker Desktop 29.5.3 đã cài; daemon phải chạy cho Supabase local (R03 khởi động bằng Docker Desktop). Máy còn container của dự án khác (`dye-lms-*`) — không đụng tới. Vercel CLI **chưa cài**.
- Trình duyệt Playwright (Chromium, WebKit) đã cài ở `%LOCALAPPDATA%\ms-playwright` (GĐ2). `@axe-core/playwright` 4.13 (devDependency, GĐ4) cho kiểm tra trợ năng trong E2E.
- Repo GitHub `ThaiTaka/ReadMateAI` đang **PUBLIC**; nhánh `main` **đã được push lần đầu ở GĐ3** (2026-10-14, theo chỉ đạo của người điều phối) và theo dõi `origin/main`. GitHub Actions CI chạy trên push vào `main`, push vào nhánh `feature/**` (từ R02) và trên pull request; quyền `contents: read`, không dùng secret. Từ R01 (2026-10-16) công việc tái cấu trúc nằm trên nhánh **`feature/home-learning-redesign`**; không merge vào `main` khi chưa được phép. Mọi lần push vẫn cần được phép trong yêu cầu của phiên (§2.3) và phải rà soát secret/dữ liệu trước.
- Ngày 2026-10-16 thư mục dự án là **bản clone mới** từ GitHub (cấu hình git cục bộ đã được đặt lại — xem §2.1).
- Node 24 chạy được TypeScript gốc (bỏ kiểu) — dùng cho `npm run content:check`. `zod` 4.6.7 là phụ thuộc trực tiếp (GĐ3).
- `core.autocrlf=true` ở cấp hệ thống → `.gitattributes` chuẩn hóa LF.

## 5. Kiến trúc tóm tắt

- **Next.js 16 (App Router) + React 19 + TypeScript 5.9 (strict) + Tailwind 4**, một ứng dụng duy nhất trên **Vercel** (Node 24.x, Functions region `sin1`).
- **Supabase** (Postgres + Auth + Storage, region Singapore); không ORM — `supabase-js` + kiểu sinh tự động + SQL migrations. Khóa mới `sb_publishable_…`/`sb_secret_…`.
- Next 16 dùng **`src/proxy.ts`** (không phải `middleware.ts`) để làm mới phiên; xác thực lại trong từng Server Action/Route Handler; dùng `getClaims()`, không tin `getSession()` ở server.
- GV: email/mật khẩu (không tự đăng ký). HS: người dùng ẩn danh Supabase + liên kết thiết bị bằng thẻ học QR/mã dự phòng.
- **Student gateway**: mọi thao tác ghi của HS và nội dung phiên luyện đi qua server; HS chỉ đọc dữ liệu của mình qua RLS.
- **Exercise Type Module** (GĐ4 đã hiện thực): mỗi dạng bài là thư mục `src/features/exercises/types/<dạng>/` gồm `schema.ts` (zod), `variants.ts` (câu lệnh chuẩn, mục tiêu, `audioPolicy`, bản phiếu), `runtime.ts` (chấm, gợi ý, hiện đáp án — chạy ở trình duyệt và máy chủ, **không zod**), `module.ts` (`validate()`, chống lộ đáp án, `worksheet()` — máy chủ/lúc build), `generate.ts`, `Player.tsx`. Phần phiếu (`worksheet()`, bản phiếu trong `variants.ts`, `core/worksheet.ts`, `generation/pair.ts`, `ui/worksheet-preview.tsx`) và `Paper.tsx` **ngừng dùng** từ R01 (AD-51 — giữ mã, gỡ khỏi giao diện ở R02, xóa ở R11). Chi tiết: [docs/EXERCISE_ENGINE.md](docs/EXERCISE_ENGINE.md).
- **R02 (đã có, dữ liệu minh họa):** design system phiêu lưu `src/components/adventure/` (client chỉ `adventure-dialog`, `motion`), asset SVG tự vẽ `src/components/art/` (Server Components, chờ GV duyệt), hằng số điểm `src/features/gamification/rules.ts` + hàm thuần `unlocks.ts`, danh mục `features/game-world`, `features/avatars`, dữ liệu hư cấu `features/demo/adventure-data.ts`, giấy phép `content/media/licenses.json` (kiểm trong `content:check`). Chi tiết: [docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md).
- **R03 (đã có, Supabase local):** 3 migration `supabase/migrations/20261020090*` — RLS mọi bảng, **chỉ policy SELECT**, ghi qua hàm `teacher_*` (JWT GV, tự kiểm tra quyền, audit cùng giao dịch) và `gateway_*` (chỉ service_role); Auth Hook chặn tự đăng ký; **không có client Supabase ở trình duyệt** (cookie httpOnly). Mã: `src/proxy.ts`, `src/lib/supabase/`, `src/server/{auth,teacher,student-gateway}/`, `src/features/{students,login-codes,consent}/`. Chi tiết: [docs/RLS_SECURITY.md](docs/RLS_SECURITY.md), [docs/AUTHENTICATION.md](docs/AUTHENTICATION.md).
- **PLANNED (R04–R11):** Question Instance Service phát câu ở server và chấm ở server cho chế độ có điểm (đáp án không xuống client trước khi nộp); Scoring Engine trên sổ cái `point_events` chỉ ghi thêm; mùa theo lớp, reset bằng một giao dịch; bảng xếp hạng qua DTO không định danh; Game Engine = lõi TS thuần + React/SVG/CSS (không Phaser). Chi tiết: [docs/REDESIGN_ARCHITECTURE.md](docs/REDESIGN_ARCHITECTURE.md).
- Bài tập của `/demo` sinh **ở máy chủ lúc build** từ kho tri thức (chế độ `demo`, hồ sơ minh họa); chế độ `production` chỉ nhận hồ sơ `confirmed` + nội dung `approved` — hiện chưa có nên không tạo bài nào (đúng thiết kế).
- Kho tri thức lõi là dữ liệu JSON trong repo (`content/kb` — ngôn ngữ, `content/curriculum` — tiến độ) kiểm bằng zod + `npm run content:check`; thư viện ngôn ngữ xác định ở `src/lib/vietnamese/` (phân tích tiếng theo **danh mục vần**, quy ước qu/gi/kiểu dấu là **tham số hồ sơ lớp**), lớp nghiệp vụ ở `src/features/knowledge/` (`checkReadability`, `selectCorpusItems`). Chi tiết: [docs/VIETNAMESE_ENGINE.md](docs/VIETNAMESE_ENGINE.md).
- Âm thanh sinh trước (TTS) hoặc ghi âm GV; phân hóa dựa trên luật; AI chỉ sau MVP qua adapter thay thế được. (PDF phiếu học tập bằng `@react-pdf/renderer` — bỏ khỏi lộ trình ở R01.)

## 6. BẮT BUỘC — Bảo vệ trẻ em và dữ liệu

1. Không thu thập họ tên đầy đủ, ngày sinh, giới tính, ảnh thật, địa chỉ, số điện thoại, thông tin phụ huynh, giọng nói, vị trí của học sinh. Chỉ biệt danh, số thứ tự, ảnh đại diện có sẵn.
2. **RLS bật cho mọi bảng** trong `public`; mỗi bảng mới phải có policy và kiểm thử RLS trong cùng thay đổi.
3. Học sinh không có quyền ghi trực tiếp vào CSDL; server suy ra `student_id` từ phiên, **không bao giờ** tin `student_id`/`class_id` do client gửi.
4. Học sinh không bao giờ thấy nhóm năng lực, lộ trình, mức hỗ trợ hay dữ liệu học tập của bạn khác (câu trả lời, lỗi, tỉ lệ đúng, mức thành thạo). **Ngoại lệ có điều kiện duy nhất** (người điều phối quyết định 2026-10-16, R01): **bảng xếp hạng điểm thưởng trong phạm vi lớp** — chỉ hiển thị thứ hạng, tên hiển thị đã được GV duyệt, avatar có sẵn và điểm thưởng; chỉ gồm học sinh có đồng ý `learning_data` **và** `leaderboard_display`; bật theo từng lớp, **mặc định tắt** cho tới khi có đồng ý và rà soát pháp lý (Luật 91/2025 Điều 24); không bao giờ công khai ra ngoài lớp hay Internet; ngôn ngữ không gây xấu hổ. Chi tiết: [LEADERBOARD_SPEC](docs/LEADERBOARD_SPEC.md), [PRIVACY_AND_SECURITY §5](docs/PRIVACY_AND_SECURITY.md#5-bảng-xếp-hạng-điều-kiện-bật-và-kiểm-soát-hiển-thị).
5. Chỉ ghi dữ liệu học tập khi học sinh đã có ghi nhận đồng ý (`data_collection_enabled`).
6. **Không ghi âm trẻ**; `Permissions-Policy` tắt microphone/camera/geolocation ở khu vực học sinh (ngoại lệ duy nhất: `/teacher/audio` cho GV).
7. Không analytics, quảng cáo, script bên thứ ba, liên kết ra ngoài hay ô nhập văn bản tự do ở khu vực học sinh.
8. **Secret chỉ ở server**: không bao giờ dùng tiền tố `NEXT_PUBLIC_` cho secret; module dùng khóa secret phải `import 'server-only'`; không commit `.env*` (chỉ `.env.example`).
9. **Repo đang public**: không commit dữ liệu thật, bản xuất CSDL, bản ghi âm chưa được phép, ảnh/nội dung không rõ giấy phép.
10. Dev/Preview chỉ dùng dữ liệu giả; không sao chép dữ liệu production về máy hay vào repo.
11. Log chỉ chứa UUID/mã lỗi — không chứa biệt danh, câu trả lời, mã thẻ học.

## 7. BẮT BUỘC — Nội dung và sư phạm Tiếng Việt

1. **Âm thanh và văn bản hiển thị không được làm lộ đáp án** (PRD §12): câu lệnh không chứa đáp án hay nội dung trẻ phải tự đọc; với kỹ năng đọc (dạng 5, 6) không phát âm thanh chữ/từ/câu cần đọc trước khi chấm; âm thanh mẫu chỉ sau khi chấm; không hiển thị chữ làm lộ đáp án (ví dụ không hiện "bò" khi hỏi âm đầu của hình con bò). Bộ kiểm tra `AUDIO_LEAKS_ANSWER`/`TEXT_LEAKS_ANSWER` phải chặn duyệt.
2. **Chỉ dùng âm, vần, thanh đã học** theo vị trí bài học của lớp (Nhóm 3: đến bài trước), trừ khi GV cho phép.
3. **Mọi nội dung phải được GV duyệt** trước khi đến tay học sinh; phiên bản đã gửi duyệt là bất biến; AI không bao giờ tự duyệt.
4. Văn bản tiếng Việt luôn **chuẩn hóa NFC** trước khi lưu, so sánh, chấm, dựng PDF.
5. Quy tắc chính tả: k, gh, ngh đứng trước i, e, ê; c, g, ng trước các âm còn lại; q luôn đi với u; iê/yê, uô, ươ khi có âm cuối — ia/ya, ua, ưa khi không có; tiếng có âm cuối p, t, c, ch chỉ mang thanh sắc hoặc nặng.
6. Quy ước nhà trường (cách gọi tên âm, phân tích "qu"/"gi", vị trí dấu thanh, bộ sách) là **tham số cấu hình**, phải được GV xác nhận — không tự quyết định.
7. Âm/vần đơn lẻ dùng bản ghi âm giáo viên; TTS chỉ cho câu lệnh, từ, câu, lời khen.
8. Một dạng bài = một khuôn: cùng biểu tượng, câu lệnh, bố cục ở mọi nơi dạng bài xuất hiện trong ứng dụng — buổi luyện **và** câu hỏi trong game (từ R01 không còn phiếu giấy).
9. Không sao chép bài đọc/hình ảnh từ SGK; chỉ lưu thứ tự bài và đơn vị kiến thức. Mọi hình/âm thanh phải ghi nguồn và giấy phép.
10. Từ ngữ, hình ảnh phù hợp trẻ em và bối cảnh Việt Nam; lời nói, âm thanh, hình ảnh phản hồi luôn tích cực, không phạt, không đếm ngược thời gian, không gây sợ hãi. **Ngoại lệ có chủ đích duy nhất** (người điều phối quyết định 2026-10-16, R01): quy tắc điểm thưởng **−5 khi sai một lượt hợp lệ** (sàn 0) — chỉ là thay đổi con số, hiển thị trung tính; không âm thanh/hiệu ứng/lời nói mang tính phạt, không màu đỏ nhấp nháy, không gọi điểm thấp là "thua/kém/cuối bảng"; không trừ ở câu làm mẫu, câu chỉ xem, câu không tính điểm. Chi tiết: [GAMIFICATION_SPEC §10](docs/GAMIFICATION_SPEC.md#10-trình-bày-điểm-cho-trẻ).

## 8. BẮT BUỘC — AI

1. Không huấn luyện mô hình; chỉ gọi API phía server qua cổng `StructuredLlm` + adapter; mô hình/nhà cung cấp cấu hình bằng biến môi trường.
2. **Học sinh không bao giờ tương tác trực tiếp với AI tạo sinh.**
3. Không gửi bất kỳ dữ liệu học sinh nào (biệt danh, mã, kết quả) tới nhà cung cấp AI/TTS.
4. Đầu ra AI → zod → chuỗi kiểm tra xác định → bản nháp → GV duyệt.
5. Ứng dụng phải chạy đầy đủ khi `AI_PROVIDER=none` hoặc thiếu khóa API.
6. Trước khi viết mã gọi AI: đọc tài liệu SDK hiện hành (API thay đổi nhanh); ghi mô hình, token, chi phí ước tính vào `ai_generation_runs`.

## 9. Tiêu chuẩn mã nguồn

- TypeScript `strict`; không `any` không có lý do; kiểm tra dữ liệu ở mọi ranh giới (form, API, JSON từ CSDL, đầu ra AI) bằng **zod**.
- Server Components mặc định; `'use client'` chỉ khi cần tương tác. Server Actions/Route Handlers luôn: xác thực → kiểm tra quyền → zod → nghiệp vụ → kết quả có kiểu `{ ok, data } | { ok: false, code }`.
- Ba client Supabase tách biệt: `lib/supabase/browser.ts`, `server.ts`, `admin.ts` (`server-only`, chỉ dùng trong student gateway, `/join`, tác vụ nền, script quản trị).
- Đặt tên: mã nguồn, bảng, cột bằng tiếng Anh (`snake_case` cho SQL, `camelCase`/`PascalCase` cho TS); giao diện và tài liệu bằng tiếng Việt; câu chữ giao diện tập trung ở `src/strings/vi.ts`.
- Thay đổi CSDL chỉ bằng migration mới trong `supabase/migrations/`; không sửa migration đã áp dụng; kèm RLS + kiểm thử.
- Hàm `grade()`, `validate()`, thư viện `lib/vietnamese`, bộ máy phân hóa là **hàm thuần** và phải có unit test.
- Giao diện học sinh: vùng chạm ≥ 64 px, chạm-để-chọn (không bắt buộc kéo–thả), một nhiệm vụ/màn hình, không truyền tin chỉ bằng màu.
- Comment chỉ giải thích "vì sao"; commit theo Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`…).

### 9.1 Quy tắc kỹ thuật rút ra ở GĐ2 (BẮT BUỘC)

1. **Next.js 16.4 khác dữ liệu huấn luyện:** trước khi viết mã Next, đọc tài liệu đi kèm ở `node_modules/next/dist/docs/` (xem [AGENTS.md](AGENTS.md) — tệp do `next dev` quản lý, không sửa tay).
2. `cacheComponents` đang bật: **không** export `dynamic`, `revalidate`, `fetchCache` ở route (sẽ lỗi build) — dùng `'use cache'` + `cacheLife`; phần dữ liệu theo request đặt trong `<Suspense>`. Trang lỗi dùng prop `retry()` (không dùng `reset()`).
3. `typedRoutes` đang bật: liên kết nội bộ dùng kiểu `Route`; `npm run typecheck` chạy `next typegen` trước `tsc`.
4. `next.config.ts` được Node 24 nạp bằng TypeScript gốc: import nội bộ phải có đuôi `.ts`, không dùng alias `@/`, không dùng enum/namespace. Header bảo mật chỉ sửa ở `src/config/security-headers.ts` và cập nhật test tương ứng.
5. `cn()` chỉ nối class, **không** gộp class Tailwind xung đột: không truyền `hidden` để đè `inline-flex` của component — bọc bằng phần tử ngoài (ví dụ `<span className="hidden sm:inline-flex">`).
6. Câu chữ giao diện ở `src/strings/vi.ts`; dữ liệu miền (dạng bài, lộ trình) ở `src/features/*/catalog.ts`; dữ liệu minh họa phải **hư cấu** và nằm ở `src/features/demo/`.
7. Chức năng chưa hoạt động phải ghi rõ "Sắp có" / "Chức năng đang phát triển" / "Dự kiến"; không giả lập đăng nhập hay dữ liệu thật; không dùng `<form>` cho chức năng chưa có (tránh dữ liệu lọt vào query string) — dùng `fieldset disabled`.
8. Chữ tiếng Việt có dấu chồng (ví dụ "Mỗi", "Ấ"): không đặt line-height < 1.2 (như `leading-none`) vì dấu sẽ bị cắt hoặc chạm dòng trên.
9. Không cài gói với `--force`/`--legacy-peer-deps`, không chạy `npm audit fix --force`; không tắt luật lint/TypeScript hay bỏ qua test để "cho xanh".
10. Fixture Playwright: đặt tên tham số callback là `provide` (không phải `use`) để tránh báo nhầm của luật `react-hooks`.

### 9.2 Quy tắc rút ra ở GĐ3 (BẮT BUỘC)

1. `src/lib/vietnamese/**` và `src/features/knowledge/**` (trừ `default-kb.ts`) được `npm run content:check` chạy **trực tiếp bằng Node 24**: import nội bộ dùng đường dẫn **tương đối có đuôi `.ts`**, không dùng alias `@/`, không dùng enum/namespace. `content-validation.ts` dùng `node:crypto` — **không** import vào mã giao diện.
2. Ký tự đặc biệt trong mã (dấu tổ hợp U+0300…, ký tự ẩn U+200B/U+FEFF/U+00AD/U+00A0, chữ Kirin/Ð giả dạng) phải viết dạng thoát `\uXXXX`. GĐ3 đã gặp lỗi chuỗi thoát bị ghi thành ký tự thật → sau khi ghi tệp có ký tự đặc biệt, **kiểm tra byte thực tế**.
3. Dữ liệu kho tri thức chỉ sửa trong `content/`; mục mới luôn bắt đầu `draft`/`pending_review`; **không bao giờ** đặt `approved` thay giáo viên (cần `reviewedBy` là GV, `reviewedAt`, `contentHash`). Sau mọi thay đổi: `npm run content:check` phải 0 lỗi.
4. Điểm cần quyết định chuyên môn chưa được GV xác nhận (quy ước qu/gi, "i" dùng chung, kiểu đặt dấu, qu + y, thứ tự bài của bộ sách) phải trả `unknown`/cảnh báo — không mã hóa thành kết luận chắc chắn. Không tạo dữ liệu tiến độ rồi trình bày như chương trình thật của lớp (chuỗi bài minh họa có `seriesKind: "illustrative"`).
5. Thêm tệp bộ bài/hồ sơ trong `content/curriculum/` thì đăng ký vào `src/features/knowledge/default-kb.ts` (unit test báo nếu quên).
6. Fixture kiểm thử cần chuỗi giống email/số điện thoại phải **ghép chuỗi lúc chạy** để không vi phạm test vệ sinh repo.

### 9.3 Quy tắc rút ra ở GĐ4 (BẮT BUỘC)

1. Câu bài tập tách `content` (hiển thị) / `answer` (đáp án): `content` **không bao giờ** chứa đáp án hay tên tranh; Player chỉ nhận `view` (`type`, `variant`, `content`); đáp án chỉ tới giao diện qua `reveal` **sau khi** câu đã chấm. Nhãn tranh cho trình đọc màn hình trước khi chấm luôn trung tính ("Hình 1…").
2. Mã chạy ở trình duyệt (`types/*/runtime.ts`, `Player.tsx`, `ui/`, `session/`, `components/kid/`) **không** import giá trị từ `core/schemas.ts`, `types/*/schema.ts`, `types/*/module.ts`, `registry.ts`, `default-kb.ts` (chỉ `import type`); dùng `runtime-registry.ts`. Đo JS của `/demo` khi thêm phụ thuộc (GĐ4: ≈ 228 KB gzip, khung Next + React ≈ 192 KB).
3. Mọi câu bài tập phải qua `validateExerciseItem`; `unknown` của bộ máy tiếng Việt luôn là lỗi; không thêm đường tắt bỏ qua kiểm tra hay nới quy tắc khi thiếu dữ liệu — trả về lý do (`INSUFFICIENT_CONTENT`).
4. Âm thanh: không phát âm thanh khi chưa có tệp **đã duyệt**; không dùng Web Speech API; không tạo nút phát giả (dùng `AudioSlot` bị khóa). Chính sách âm thanh khai báo **theo mục tiêu học tập** của từng biến thể, kèm lý do; mọi khe âm thanh khai báo lời đọc để bộ kiểm tra soát.
5. Bộ sinh và reducer là hàm thuần: không `Math.random()`/`Date.now()` (dùng RNG có seed; thời điểm truyền vào từ sự kiện giao diện).
6. Bản chơi thử chỉ dùng hồ sơ minh họa và fixture riêng ở `src/features/demo/` (mục mới luôn `pending_review`). Test chế độ học thật dùng dữ liệu "đã duyệt" **giả lập trong bộ nhớ**, ghi rõ trong test — không sửa `content/`.
7. E2E lấy đáp án từ chính bộ sinh (`buildDemoPracticeData`, tái lập theo seed) và thao tác qua giao diện như người dùng; khớp tên thẻ theo "bắt đầu bằng chữ của thẻ" vì sau khi chấm tên có thêm ", chưa đúng".
8. Ký tự đặc biệt: GĐ4 lại gặp `\u0301`, `\u00a0` bị ghi thành ký tự thật, và `grep -P` trên Git Bash **không** bắt được — kiểm tra byte bằng Node (quét các tệp mới/sửa) trước khi commit.
9. Shell: script nhiều dòng có backtick/nháy/`${}` thì ghi ra tệp (scratchpad) rồi chạy bằng Node; không nhúng template literal vào `node -e` trong chuỗi bash.
10. Không đặt tên biến `module` (luật `@next/next/no-assign-module-variable`) — dùng `typeModule`.

### 9.4 Quy tắc gamification và game (BẮT BUỘC từ khi hiện thực — R04+)

1. Hằng số điểm/mở khóa chỉ ở **một nơi** (`src/features/gamification/rules.ts`), khớp [GAMIFICATION_SPEC §1](docs/GAMIFICATION_SPEC.md#1-hằng-số-chính-thức); đổi hằng số cần quyết định của người điều phối và tăng `SCORING_RULES_VERSION`.
2. Điểm, HP, mở khóa, thứ hạng **chỉ tính và lưu ở server**; mọi trường `is_correct`/`points`/`balance`/`student_id`/`class_id` từ client bị bỏ qua. Chế độ có điểm **không** gửi đáp án xuống client trước khi câu đóng.
3. Mọi lượt trả lời có `client_attempt_id`; ghi điểm trong **một** hàm CSDL có khóa dòng; sổ cái `point_events` chỉ ghi thêm.
4. Không nguồn điểm vô hạn: mỗi nội dung câu tính điểm một lần mỗi mùa; mỗi màn game một lượt tính điểm mỗi mùa; không bao giờ có cuộc chạm trán thứ 8 hay câu thay thế.
5. Không tiêu điểm, không mua bán, không phần thưởng may rủi, không chuỗi ngày gây áp lực.
6. Reset mùa chỉ GV `owner`, xác nhận hai bước, một giao dịch; **không** chạm dữ liệu học tập hay lớp khác.
7. Hoạt cảnh tôn trọng giảm chuyển động; không nhấp nháy > 3 lần/giây; asset game chỉ khi có giấy phép ghi trong repo.
8. Dữ liệu minh họa của game/bảng xếp hạng là **hư cấu**, nằm ở `src/features/demo/`, không lưu.

### 9.5 Quy tắc rút ra ở R02 (BẮT BUỘC)

1. Hình minh họa/nhân vật là SVG trong `src/components/art/` (Server Component), dùng `useSvgIds` cho id gradient (không trùng id khi một hình xuất hiện nhiều lần) và `artA11y(title)` (có tiêu đề → `role="img"`, không → `aria-hidden`). Mỗi tệp art phải có dòng trong `content/media/licenses.json` (unit test chặn); asset mới luôn `pending_review`.
2. Hoạt cảnh SVG: **không** đặt lớp `animate-*` lên phần tử có thuộc tính `transform` (CSS transform đè vị trí) — bọc `<g transform>` ngoài, hoạt cảnh ở phần tử trong; xoay/nhún dùng `origin-fill` + `origin-*`.
3. Mọi hoạt cảnh phải dừng dưới `[data-motion="reduce"]` (công tắc `MotionToggle` trong `MotionScope`) và `prefers-reduced-motion`; lựa chọn chỉ giữ trong React state (không localStorage ở khu vực học sinh).
4. Dữ liệu minh họa (điểm, huy hiệu, bảng xếp hạng) chỉ ở `src/features/demo/adventure-data.ts`, tên hư cấu, luôn kèm `PreviewRibbon`/chip "Minh họa"; không có thao tác nào sửa điểm; nút của chức năng chưa có (vd. "Vào chơi – Sắp có") luôn `disabled`, không `Link` tới route chưa tồn tại.
5. Nội dung bảng thông tin (`AdventureDialog`) truyền qua `children` từ Server Component để hình SVG không vào bundle JS; client component chỉ giữ trạng thái mở/đóng.
6. Không còn chữ "ở lớp/tại lớp/trên lớp/phiếu" trong giao diện (trừ nhánh ngừng dùng `vi.practice.worksheet`) — `tests/unit/redesign-copy.test.tsx`.
7. Bash tool trên Windows: script dài có dấu nháy/backtick ghi bằng công cụ Write vào scratchpad rồi chạy `node tệp.cjs` (heredoc trong lệnh đôi khi bị cắt); sau khi Turbopack dev chạy lâu mà tệp bị thay bằng script, khởi động lại `next dev` nếu thấy giá trị cũ.

### 9.6 Quy tắc rút ra ở R03 (BẮT BUỘC)

1. **Không tắt signup trong cấu hình Auth**: tắt toàn cục chặn người dùng ẩn danh (thiết bị học sinh); tắt `[auth.email] enable_signup` tắt cả **đăng nhập** email. Chặn tự đăng ký bằng Auth Hook `private.hook_before_user_created` (AD-54).
2. Bảng mới: RLS + **chỉ policy SELECT**; ghi qua hàm `teacher_*`/`gateway_*` có `security definer` + `set search_path = ''`; `revoke` từ `public, anon, authenticated` rồi GRANT tối thiểu; pgTAP `01_schema_security` kiểm theo catalog — không nới test. Mỗi bảng mới kèm kiểm thử tích hợp ma trận quyền (`tests/db`).
3. Thao tác học sinh: Server Action suy `auth_user_id` từ `getClaims()`, `studentId` chỉ là khóa tra cứu phải thuộc danh sách RLS trả về, rồi gọi `gateway_*` bằng `createSupabaseAdminClient()` (chỉ trong `src/server/student-gateway/`).
4. DAL đọc phiên phải `await connection()` trước `getClaims()` (supabase-js dùng `Date.now()`; Partial Prefetching dựng trước phần có cookie). Phần đọc phiên luôn trong `<Suspense>`; tham số `params` await bên trong Suspense.
5. Cookie phiên: dùng `AUTH_COOKIE_OPTIONS` (`cookie-options.ts`, không `server-only` vì proxy dùng); Safari bỏ cookie `Secure` trên http localhost — đừng "sửa" bằng cách tắt Secure ở production.
6. **Công cụ ghi tệp giải mã chuỗi thoát `\uXXXX` thành ký tự thật** (kể cả trong `.sql`, `.md`): khi cần ký tự thoát, dựng `\` bằng `String.fromCharCode(92)` trong script, rồi quét byte (ký tự điều khiển, U+00AD, U+200B–U+200F, U+2028–U+202E, U+2060–U+2064, U+FEFF, dấu tổ hợp) trước commit. Trong SQL kiểm thử dùng `chr(…)`.
7. Không chạy `db:seed`/script ghi lên CSDL không phải local (script tự từ chối); E2E/kiểm thử CSDL chỉ trên Supabase local; xóa bộ đếm `rate_limit_buckets` chỉ ở local.
8. `notFound()` trong phần stream trả HTTP 200 → kiểm thử theo nội dung. `next/experimental/testing/server` bản 16.4.0 xuất `unstable_doesMiddlewareMatch` (tài liệu ghi tên mới).
9. Next.js có vùng `role="alert"` riêng (route announcer) → E2E lọc `alert` theo nội dung.
10. Bash tool: heredoc dài có backtick/`$` dễ bị cắt hoặc `$$` bị `String.replace` đổi thành `$` — dùng Edit/Write cho văn bản dài.

## 10. Kiểm thử và Definition of Done

Một nhiệm vụ chỉ "xong" khi:

- [ ] `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm run content:check`, `npm run test:run` và `npm run build` đều xanh; thay đổi giao diện, route hay header thì chạy thêm `npm run test:e2e`.
- [ ] Logic mới có test; bảng mới có policy RLS + test cách ly.
- [ ] Không có secret, dữ liệu thật hay `.env` trong thay đổi.
- [ ] Tiêu chí nghiệm thu tương ứng trong `REDESIGN_TASKS.md` được kiểm tra thật (không suy đoán).
- [ ] `REDESIGN_PROGRESS.md` và tài liệu liên quan đã cập nhật.

## 11. Lệnh thường dùng

| Lệnh | Tác dụng |
|---|---|
| `npm ci` | Cài đúng theo `package-lock.json` |
| `npm run dev` | Máy chủ phát triển (Turbopack) ở http://localhost:3000 |
| `npm run build` · `npm run start` | Build production · chạy bản đã build |
| `npm run lint` | ESLint |
| `npm run typecheck` | `next typegen && tsc --noEmit` |
| `npm run test` · `npm run test:run` | Vitest chế độ theo dõi · chạy một lần |
| `npm run test:e2e` | Playwright: tự build + `next start` cổng 3100; Chromium/WebKit × desktop/điện thoại + iPad (riêng bản chơi thử, bố cục); có axe (lần đầu: `npx playwright install chromium webkit`) |
| `npm run format` · `npm run format:check` | Prettier (bỏ qua `*.md`, `package-lock.json`) |
| `npm run content:check` | Kiểm tra kho tri thức `content/`: lỗi (thoát mã 1) / cảnh báo cần GV rà soát / thông tin |

| `npm run check:bundle` | Sau build: bundle trình duyệt không chứa secret |
| `npm run db:start` · `db:stop` · `db:reset` | Supabase local (Docker) · dừng · dựng lại CSDL từ migration |
| `npm run db:env` · `db:seed` · `db:sync-content` · `db:types` | `.env.local` từ Supabase local · dữ liệu giả · đồng bộ `content/` · sinh kiểu TS |
| `npm run db:lint` · `db:test` · `test:db` · `test:e2e:db` | Lint CSDL · pgTAP · tích hợp RLS (JWT thật) · E2E có CSDL (cần `db:env` + `db:seed`) |

Thay đổi CSDL/route/xác thực: chạy thêm `db:lint`, `db:test`, `test:db`, `test:e2e:db`. Trong PowerShell nhớ đặt `$env:NEXT_TELEMETRY_DISABLED = '1'` nếu không muốn gửi telemetry của Next.js.

## 12. Thuật ngữ

| Tiếng Việt | Trong mã | Ghi chú |
|---|---|---|
| chữ cái | `letter` | 29 chữ cái |
| âm (chữ ghi âm) | `phoneme` | Gồm chữ ghép: ch, gh, gi, kh, ng, ngh, nh, ph, qu, th, tr |
| âm đầu / âm đệm / âm chính / âm cuối | `onset` / `medial` / `nucleus` / `coda` | |
| vần | `rime` | |
| thanh (dấu thanh) | `tone` | `ngang`, `huyen`, `sac`, `hoi`, `nga`, `nang` |
| tiếng | `syllable` | |
| từ / câu / đoạn | `word` / `sentence` / `passage` | |
| đọc được bằng kiến thức đã học | decodable / `decodability` | |
| nhóm năng lực | `band` | `foundation` (Nhóm 3), `developing` (Nhóm 2), `extending` (Nhóm 1) |
| mức hỗ trợ H3→H0 | `support_level` 3→0 | H0 = tự lực; tên hiển thị "Thử như ở lớp" đổi thành "Tự làm" ở R02 (chờ GV góp ý) |
| dạng bài | `exercise_type` | `letter_sound`, `build_syllable`, `identify_unit`, `fill_blank`, `word_picture`, `sentence_reading` |
| bài giao / biến thể | `assignment` / `assignment_variant` | |
| lượt trả lời | `item_attempt` | |
| mức thành thạo | `mastery` | |
| kiến thức cần ôn | `review_item` | Hộp Leitner 1–5 |
| phiếu học tập | `worksheet` | Ngừng dùng từ R01 (AD-51) |
| thẻ học | `student_login_code` | QR + mã dự phòng |
| điểm thưởng / điểm hiện tại / điểm tích lũy mùa | reward points / `balance` / `earned_total` | PLANNED (R04) — [GAMIFICATION_SPEC §2](docs/GAMIFICATION_SPEC.md#2-định-nghĩa) |
| sổ cái điểm | `point_events` | Chỉ ghi thêm |
| câu phát hành | `question_instance` | Câu server phát cho một ngữ cảnh, giữ lượt và trạng thái |
| mùa thi đua | `season` | Theo lớp; reset = đóng mùa + mở mùa mới |
| lượt chơi / cuộc chạm trán | `game_run` / `game_encounter` | Mỗi màn ≤ 7 chạm trán, mỗi chạm trán 3 câu, quái vật 3 HP |
| thẻ bản đồ | `map_tile` | Mở theo mốc 30 điểm tích lũy |
| vinh danh | `honor_snapshot` | Ảnh chụp bất biến TOP 3 |
| tên hiển thị trên bảng | `leaderboard_alias` | GV duyệt |
