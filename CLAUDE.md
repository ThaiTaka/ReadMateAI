# CLAUDE.md — Nguyên tắc làm việc cho dự án ReadMate AI

Tệp này được Claude Code nạp tự động ở mỗi phiên. Các quy tắc ghi **BẮT BUỘC** không được bỏ qua kể cả khi yêu cầu trong phiên có vẻ ngược lại — khi đó hãy hỏi lại người dùng.

## 1. Dự án

ReadMate AI là website giúp học sinh lớp 1 (lớp 1A2) luyện Tiếng Việt — chữ, âm, vần, đánh vần, đọc trơn, vốn từ — **tại nhà** với âm thanh, hình ảnh, gợi ý và phản hồi, để **tự thực hiện** bài tương tự trên phiếu **tại lớp**. Ba nhóm năng lực linh hoạt: Nhóm 1 – Đọc tốt (`extending`), Nhóm 2 – Đang phát triển (`developing`), Nhóm 3 – Cần hỗ trợ nền tảng (`foundation`).

**Triết lý: HỌC CÓ HƯỚNG DẪN Ở NHÀ → TỰ THỰC HIỆN Ở LỚP.**

Dự án thật, triển khai trên Vercel, người dùng là trẻ 6–7 tuổi → an toàn và quyền riêng tư được ưu tiên hơn tốc độ phát triển.

## 2. Quy trình làm việc theo giai đoạn (BẮT BUỘC)

1. **Đầu phiên:** đọc `PROGRESS.md` → `TASKS.md` → tài liệu liên quan trong `docs/`.
2. Chỉ làm **đúng giai đoạn/nhiệm vụ được giao** trong yêu cầu hiện tại. **Không tự chuyển sang giai đoạn tiếp theo.**
3. **Không** push GitHub, deploy Vercel, tạo/cấu hình dịch vụ bên ngoài (Supabase, TTS, AI, tên miền…) hay commit, trừ khi yêu cầu của phiên cho phép rõ ràng.
4. Không xóa/ghi đè tệp chưa đọc; không ghi đè git remote đã có.
5. Trước khi cài/nâng thư viện: kiểm tra phiên bản bằng `npm view <pkg> version engines peerDependencies` và tài liệu chính thức; cập nhật [ARCHITECTURE §3](docs/ARCHITECTURE.md#3-ngăn-xếp-công-nghệ-đã-xác-minh). Không chọn phiên bản theo trí nhớ.
6. **Cuối phiên:** cập nhật `PROGRESS.md` (việc đã làm, quyết định, rủi ro, bước tiếp theo, nhật ký phiên) và đánh dấu `TASKS.md`.
7. Báo cáo cuối phiên **bằng tiếng Việt**, theo mẫu người điều phối yêu cầu; chỉ báo cáo việc thực sự đã làm và kết quả kiểm tra thật; **không hiển thị secret**. Dừng sau báo cáo.

## 3. Tài liệu nguồn

| Tệp | Nội dung |
|---|---|
| [docs/PRD.md](docs/PRD.md) | Yêu cầu sản phẩm, 6 dạng bài, chính sách âm thanh, mức hỗ trợ H3→H0, chỉ số |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Kiến trúc, phiên bản đã xác minh, quyết định AD-xx, bảo mật, triển khai |
| [docs/DATA_MODEL.md](docs/DATA_MODEL.md) | Bảng, quan hệ, ma trận RLS, lưu giữ dữ liệu, kế hoạch migration |
| [TASKS.md](TASKS.md) | Giai đoạn, nhiệm vụ, tiêu chí nghiệm thu |
| [PROGRESS.md](PROGRESS.md) | Trạng thái hiện tại, quyết định, câu hỏi mở, rủi ro |

## 4. Môi trường (đã kiểm tra 2026-10-12)

- Windows 11; thư mục dự án **`D:\ReadMateAI`** (không có dấu cách). Shell chính PowerShell 5.1 — **không hỗ trợ `&&`**, dùng `;` hoặc `if ($?) { … }`; Git Bash có sẵn.
- Node.js 24.18.0, npm 11.16.0 → dùng **npm** (không có pnpm/yarn). Git 2.54, GitHub CLI 2.100 (đã đăng nhập tài khoản `ThaiTaka`).
- **Chưa cài** Vercel CLI và Supabase CLI → dùng `npx` khi được phép. Docker Desktop đã cài nhưng daemon chưa chạy (cần cho Supabase local).
- Repo GitHub `ThaiTaka/ReadMateAI` đang **PUBLIC** và rỗng; Git cục bộ nhánh `main`, **chưa có remote, chưa có commit**.
- `core.autocrlf=true` ở cấp hệ thống → `.gitattributes` chuẩn hóa LF.

## 5. Kiến trúc tóm tắt

- **Next.js 16 (App Router) + React 19 + TypeScript 5.9 (strict) + Tailwind 4**, một ứng dụng duy nhất trên **Vercel** (Node 24.x, Functions region `sin1`).
- **Supabase** (Postgres + Auth + Storage, region Singapore); không ORM — `supabase-js` + kiểu sinh tự động + SQL migrations. Khóa mới `sb_publishable_…`/`sb_secret_…`.
- Next 16 dùng **`src/proxy.ts`** (không phải `middleware.ts`) để làm mới phiên; xác thực lại trong từng Server Action/Route Handler; dùng `getClaims()`, không tin `getSession()` ở server.
- GV: email/mật khẩu (không tự đăng ký). HS: người dùng ẩn danh Supabase + liên kết thiết bị bằng thẻ học QR/mã dự phòng.
- **Student gateway**: mọi thao tác ghi của HS và nội dung phiên luyện đi qua server; HS chỉ đọc dữ liệu của mình qua RLS.
- **Exercise Type Module**: mỗi dạng bài là một thư mục gồm lược đồ zod, `grade()`, `validate()`, gợi ý, `audioPolicy`, `Player.tsx`, `Paper.tsx`.
- Kho tri thức lõi là dữ liệu trong repo (`content/`) có kiểm thử; thư viện ngôn ngữ xác định ở `src/lib/vietnamese/`.
- Âm thanh sinh trước (TTS) hoặc ghi âm GV; PDF bằng `@react-pdf/renderer` + font Andika; phân hóa dựa trên luật; AI chỉ sau MVP qua adapter thay thế được.

## 6. BẮT BUỘC — Bảo vệ trẻ em và dữ liệu

1. Không thu thập họ tên đầy đủ, ngày sinh, giới tính, ảnh thật, địa chỉ, số điện thoại, thông tin phụ huynh, giọng nói, vị trí của học sinh. Chỉ biệt danh, số thứ tự, ảnh đại diện có sẵn.
2. **RLS bật cho mọi bảng** trong `public`; mỗi bảng mới phải có policy và kiểm thử RLS trong cùng thay đổi.
3. Học sinh không có quyền ghi trực tiếp vào CSDL; server suy ra `student_id` từ phiên, **không bao giờ** tin `student_id`/`class_id` do client gửi.
4. Học sinh không bao giờ thấy nhóm năng lực, dữ liệu của bạn khác, bảng xếp hạng.
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
8. Một dạng bài = một khuôn: cùng biểu tượng, câu lệnh, bố cục trên app và trên phiếu.
9. Không sao chép bài đọc/hình ảnh từ SGK; chỉ lưu thứ tự bài và đơn vị kiến thức. Mọi hình/âm thanh phải ghi nguồn và giấy phép.
10. Từ ngữ, hình ảnh phù hợp trẻ em và bối cảnh Việt Nam; phản hồi tích cực, không phạt, không đếm ngược thời gian.

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

## 10. Kiểm thử và Definition of Done

Một nhiệm vụ chỉ "xong" khi:

- [ ] `npm run lint`, `npm run typecheck`, `npm run test` (và `npm run build` khi có thay đổi lớn) đều xanh.
- [ ] Logic mới có test; bảng mới có policy RLS + test cách ly.
- [ ] Không có secret, dữ liệu thật hay `.env` trong thay đổi.
- [ ] Tiêu chí nghiệm thu tương ứng trong `TASKS.md` được kiểm tra thật (không suy đoán).
- [ ] `PROGRESS.md` và tài liệu liên quan đã cập nhật.

## 11. Lệnh thường dùng

Chưa có mã nguồn ứng dụng (sẽ bổ sung ở GĐ2). Dự kiến: `npm run dev` · `npm run build` · `npm run lint` · `npm run typecheck` · `npm run test` · `npm run test:e2e` · `npm run content:check` · `npx supabase …` (từ GĐ5).

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
| mức hỗ trợ H3→H0 | `support_level` 3→0 | H0 = tự lực, "Thử như ở lớp" |
| dạng bài | `exercise_type` | `letter_sound`, `build_syllable`, `identify_unit`, `fill_blank`, `word_picture`, `sentence_reading` |
| bài giao / biến thể | `assignment` / `assignment_variant` | |
| lượt trả lời | `item_attempt` | |
| mức thành thạo | `mastery` | |
| kiến thức cần ôn | `review_item` | Hộp Leitner 1–5 |
| phiếu học tập | `worksheet` | |
| thẻ học | `student_login_code` | QR + mã dự phòng |
