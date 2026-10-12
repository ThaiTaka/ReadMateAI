# PROGRESS — Tiến độ dự án ReadMate AI

> **Cập nhật lần cuối:** 2026-10-12 — Phiên Claude Code #1 (Giai đoạn 1)
> Tệp này là "bộ nhớ" giữa các phiên: đọc đầu tiên khi bắt đầu phiên mới; cập nhật trước khi kết thúc phiên.

## 1. Trạng thái hiện tại

- **Giai đoạn hiện tại:** GĐ1 — Khởi tạo và thiết kế kiến trúc → **HOÀN THÀNH, chờ người điều phối đánh giá**.
- **Giai đoạn kế tiếp đề xuất:** GĐ2 — Nền móng kỹ thuật → **chưa bắt đầu** (chỉ bắt đầu khi được phê duyệt).
- **Mã nguồn ứng dụng:** chưa có (đúng phạm vi GĐ1).
- **Git:** repo cục bộ nhánh `main`, chưa có commit, chưa có remote. Chưa push, chưa deploy, chưa tạo dịch vụ bên ngoài.

| GĐ | Tên | Trạng thái |
|---|---|---|
| 1 | Khởi tạo & thiết kế kiến trúc | ✅ Hoàn thành — chờ duyệt |
| 2 | Nền móng kỹ thuật | ⏸ Chưa bắt đầu |
| 3–10 | MVP (xem [TASKS.md](TASKS.md)) | ⏸ Chưa bắt đầu |
| 11+ | Sau MVP (AI, nâng cao) | ⏸ Chưa bắt đầu |

## 2. Môi trường đã kiểm tra (2026-10-12)

| Hạng mục | Kết quả |
|---|---|
| Thư mục thực tế | `D:\ReadMateAI` (không có dấu cách). `D:\ReadMate AI` **không tồn tại**. Thư mục ban đầu **rỗng** (0 tệp) |
| Hệ điều hành / shell | Windows 11 Pro; PowerShell 5.1 (CurrentUser `RemoteSigned` → `npm.ps1` chạy được); Git Bash có sẵn |
| Ổ đĩa D: | Còn trống khoảng 174 GB |
| Git | 2.54.0; **chưa khởi tạo** lúc đầu → đã `git init -b main`; `user.name`/`user.email` đã cấu hình toàn cục; `core.autocrlf=true` (system) |
| Git remote | Chưa có. Repo GitHub `ThaiTaka/ReadMateAI` tồn tại, **PUBLIC**, **rỗng** (tạo 2026-10-12, chưa có nhánh) |
| Node.js / npm | Node 24.18.0 (win32 x64), npm 11.16.0, npx 11.16.0, corepack 0.35.0; npm registry truy cập được |
| pnpm / yarn / bun | Không có |
| GitHub CLI | 2.100.0; đã đăng nhập tài khoản `ThaiTaka` (keyring, giao thức https, có quyền `repo`, `workflow`) |
| Vercel CLI | **Chưa cài** (phiên bản npm hiện tại: 63.1.2) |
| Supabase CLI | **Chưa cài** (phiên bản npm hiện tại: 2.120.0 — dùng qua `npx supabase`) |
| Docker | Docker Desktop đã cài (client 29.5.3) nhưng **daemon không chạy** |
| Windows long paths | `LongPathsEnabled = 0`, `core.longpaths` chưa bật — rủi ro thấp vì đường dẫn gốc ngắn |
| Khác | Phiên Claude Code có thêm thư mục làm việc phụ `d:\DYE LMS\packages\db\prisma` (dự án khác) — **không đụng tới** |

## 3. Công việc đã hoàn thành

### GĐ1 — 2026-10-12

1. Kiểm tra môi trường (mục 2).
2. Khởi tạo Git cục bộ tại `D:\ReadMateAI` với nhánh `main`; **không** thêm remote, **không** commit.
3. Tạo `.gitignore` (chặn `.env*`, `node_modules`, build, dữ liệu xuất CSDL, cài đặt cá nhân của Claude Code) và `.gitattributes` (chuẩn hóa LF, đánh dấu tệp nhị phân).
4. Xác minh phiên bản thư viện bằng `npm view` (27 gói, kèm `engines`/`peerDependencies`) và tải `create-next-app@16.4.0` vào thư mục tạm để kiểm tra mẫu (TypeScript `^5`, ESLint `^9`, danh sách tệp được phép trong thư mục đích).
5. Xác minh tài liệu chính thức: Next.js 16 (`proxy.ts` thay `middleware.ts`); Supabase SSR (`getClaims()`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`), đăng nhập ẩn danh, khóa API mới, bảng giá; Vercel (giới hạn hàm, điều khoản Hobby, giá Pro, Node 24.x); Google Cloud TTS (giọng `vi-VN`); Google Fonts (Andika, Be Vietnam Pro có subset `vietnamese`); Luật 91/2025/QH15 (Điều 20, 24).
6. Viết tài liệu: `CLAUDE.md`, `docs/PRD.md`, `docs/ARCHITECTURE.md`, `docs/DATA_MODEL.md`, `TASKS.md`, `PROGRESS.md`.
7. Kiểm tra tệp trên ổ đĩa, đọc lại toàn bộ tài liệu, đối chiếu yêu cầu và sửa các điểm chưa nhất quán (mục 3.3).

### 3.1 Kết quả kiểm tra cuối GĐ1 (2026-10-12)

| Kiểm tra | Cách làm | Kết quả |
|---|---|---|
| Tệp tồn tại | `Test-Path`/`Get-Item` cho 8 tệp | ✅ Đủ 8 tệp: 6 tài liệu + `.gitignore` + `.gitattributes` |
| Mã hóa | Script Node: UTF-8 hợp lệ, không BOM, chuẩn NFC, xuống dòng LF | ✅ Cả 6 tài liệu đạt |
| Liên kết nội bộ | Script Node kiểm tra tệp đích + anchor theo quy tắc slug của GitHub | ✅ 93 liên kết, 0 lỗi |
| Sơ đồ Mermaid | `mermaid.parse()` (mermaid 12.1.0 + jsdom, cài ở thư mục tạm, không thuộc repo) | ✅ 6/6 sơ đồ hợp lệ; bộ kiểm tra đã được thử với mẫu sai cố ý (bắt đúng 2/2 lỗi) |
| Secret / thông tin cá nhân | Tìm mẫu token GitHub, khóa Supabase/Anthropic/AWS, JWT, email trong repo | ✅ Không có |
| Git | `git status`, `git remote -v`, `git rev-list --all --count` | ✅ Nhánh `main`, 8 tệp chưa theo dõi, 0 remote, 0 commit |
| Chưa thể kiểm tra | Build/lint/test (chưa có mã ứng dụng); hiển thị Mermaid trên GitHub (chưa push); deploy Vercel; kết nối Supabase; chất lượng TTS; dựng PDF | ⏸ Theo kế hoạch các giai đoạn sau |

### 3.2 Đối chiếu yêu cầu của GĐ1

| Yêu cầu | Nơi đáp ứng |
|---|---|
| NV1 — Kiểm tra môi trường (thư mục, Git, remote, Node/npm, gh, Vercel CLI, vấn đề môi trường) | Mục 2 của tệp này; CLAUDE.md §4 |
| NV1 — Khởi tạo Git nếu chưa có; không ghi đè remote; chưa push/deploy/tạo dịch vụ | Đã `git init -b main`; chưa thêm remote (lệnh đề xuất ở mục 7) |
| NV2 — Kiến trúc: frontend, backend/API, database, kho tri thức, bộ máy tạo bài, phân hóa, âm thanh, giao bài & theo dõi, dashboard, PDF, bảo mật & phân quyền, Vercel | ARCHITECTURE §6, §7, §9, §10, §11, §12, §13, §14, §15, §16, §8 + §18, §19 |
| NV3 — Mô hình dữ liệu (giáo viên, lớp, hồ sơ HS tối thiểu, kho kiến thức, dạng bài, nội dung, phiên bản, lộ trình, kết quả, cần ôn tập, trạng thái duyệt, phiếu) + bảo vệ dữ liệu, chống HS xem kết quả của nhau | DATA_MODEL §4, §13 (bảng đối chiếu), §7 (ma trận RLS + 6 bảo đảm then chốt), §8, §10 |
| NV4 — Kế hoạch theo giai đoạn, MVP trước (3 nhóm, 6 dạng bài, nghe hướng dẫn, luyện ở nhà, phiếu, lưu kết quả, dashboard, kho tri thức + duyệt), AI sau, tiêu chí nghiệm thu | TASKS.md (GĐ2–GĐ10 = MVP, GĐ11 = AI; mỗi GĐ có điều kiện bắt đầu + tiêu chí nghiệm thu) |
| NV5 — 6 tài liệu, tiếng Việt, bảo toàn tệp cũ | Đã tạo; thư mục ban đầu rỗng nên không có gì bị ghi đè |
| Nguyên tắc AI (không huấn luyện, KB + quy tắc + duyệt, chạy được khi không có AI, không chatbot cho HS) | PRD §15; ARCHITECTURE §17; CLAUDE.md §8 |
| Bảo vệ dữ liệu trẻ em | PRD §17; ARCHITECTURE §8, §18; DATA_MODEL §7, §10; CLAUDE.md §6 |
| Âm thanh không lộ đáp án | PRD §9.2, §12 (A1–A7); ARCHITECTURE §11.3, §13; CLAUDE.md §7 |

### 3.3 Điều chỉnh sau khi đọc lại

1. Đồng bộ định nghĩa mức **H1** với chính sách âm thanh từng dạng (âm thanh kích thích ở H1 chỉ phát khi trẻ bấm "Trợ giúp", tính là gợi ý).
2. Làm rõ F-AT-01: bốn loại tệp âm thanh + quy định không đọc phương án.
3. Sửa ví dụ JSON dạng 1: tên hình "bò" chuyển từ `content` sang `answer` (nếu hiển thị chữ "bò", trẻ nhìn chữ cái đầu là biết đáp án); bổ sung mã lỗi `TEXT_LEAKS_ANSWER` vào chuỗi kiểm tra, PRD, TASKS và CLAUDE.md.
4. Thống nhất: nội dung phiên luyện của HS do student gateway cung cấp (chỉ bản `approved`); HS không đọc trực tiếp bảng bài tập; hàm RLS dùng mẫu `private.my_class_ids()`.
5. Làm rõ Deployment Protection phụ thuộc gói Vercel; "không có dịch vụ hàng đợi riêng" (dùng bảng `background_jobs` + Cron khi cần).

## 4. Nhật ký quyết định kỹ thuật

Trạng thái: **Chốt** · **POC** (cần thử nghiệm) · **Hoãn** · **Chờ xác nhận** (cần GV/điều phối).

| Mã | Quyết định | Trạng thái | Chi tiết |
|---|---|---|---|
| D-001 | Gốc dự án là `D:\ReadMateAI` (khớp tên repo `ReadMateAI`, không dấu cách) | Chốt | |
| D-002 | Next.js 16.4 (App Router) + React 19.3 + TypeScript 5.9 + Tailwind 4.3; Node 24.x; npm | Chốt (kiểm tra lại khi scaffold) | ARCHITECTURE §3, AD-01/14/15 |
| D-003 | Không dùng TypeScript 7.0 (`latest`) và ESLint 10 lúc này — theo template chính thức của Next 16.4; dùng `@types/node@^24` | Chốt | ARCHITECTURE §3 |
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

## 5. Câu hỏi mở

| Mã | Câu hỏi | Ảnh hưởng tới |
|---|---|---|
| Q-01 | Lớp 1A2 dùng bộ sách Tiếng Việt 1 nào? | GĐ3 (thứ tự âm/vần) |
| Q-02 | Quy ước của lớp: cách gọi tên âm ("bờ", "cờ", "ngờ kép"…), phân tích "qu"/"gi", vị trí dấu thanh ("hoà"/"hòa") | GĐ3 |
| Q-03 | GV có thể ghi âm bao nhiêu âm/vần/câu lệnh? Giọng vùng miền của lớp? | GĐ4 (âm thanh demo), GĐ6 |
| Q-04 | Thiết bị và chất lượng mạng phổ biến của phụ huynh; thời gian trẻ luyện mỗi ngày | GĐ4, GĐ7 |
| Q-05 | Bên kiểm soát dữ liệu (nhà trường hay GV)? Quy trình xin đồng ý của phụ huynh? | GĐ10 (nên bắt đầu trao đổi sớm) |
| Q-06 | Máy in ở trường: đen trắng hay màu, khổ A4? | GĐ8 |
| Q-07 | Sĩ số lớp, số học sinh mỗi nhóm hiện tại | GĐ5, GĐ9 |
| Q-08 | Xưng hô trong lời đọc: "cô – con" hay "cô – em"? | GĐ4 |
| Q-09 | Ai duyệt nội dung: một GV hay tổ chuyên môn? | GĐ6 |
| Q-10 | Ngân sách cho Supabase Pro / Vercel Pro; có cần tên miền riêng? | GĐ10 |
| Q-11 | Repo GitHub để **public** là có chủ ý? Có muốn chuyển sang private? | Trước khi push (GĐ2) |
| Q-12 | GĐ2 có được commit/push, thêm remote, tạo dự án Vercel không? GĐ5 có được tạo dự án Supabase không? | GĐ2, GĐ5 |
| Q-13 | Email cấu hình trong Git cục bộ đã liên kết với tài khoản GitHub `ThaiTaka` chưa (để commit hiển thị đúng tác giả)? | GĐ2 |

## 6. Rủi ro đang theo dõi

| Mã | Rủi ro | Mức | Giảm thiểu |
|---|---|---|---|
| R-01 | Pháp lý: Luật 91/2025/QH15 (hiệu lực 01/01/2026) — dữ liệu trẻ em (Điều 24); xử lý trên nền tảng ở nước ngoài được coi là chuyển dữ liệu xuyên biên giới (Điều 20) | Cao | Tối thiểu hóa dữ liệu; `/demo` không lưu; chỉ thu dữ liệu thật sau rà soát pháp lý và đồng ý (GĐ10) |
| R-02 | Vercel Hobby chỉ cho sử dụng cá nhân phi thương mại; định nghĩa "thương mại" bao gồm cả người viết mã là nhân viên được trả lương | Trung bình | Xác nhận với Vercel/nhà trường hoặc dùng Pro (20 USD/tháng/thành viên) cho production |
| R-03 | Supabase Free tạm dừng sau 1 tuần không hoạt động và không có sao lưu | Cao (với production) | Dùng Supabase Pro (từ 25 USD/tháng) cho thí điểm |
| R-04 | Repo public: lộ secret hoặc dữ liệu nếu commit nhầm | Trung bình | `.gitignore`; quy tắc trong CLAUDE.md; quét bundle trong CI; GitHub secret scanning |
| R-05 | TTS phát âm sai âm/vần tách rời, khác giọng cô | Trung bình | Ghi âm GV cho âm/vần; POC TTS |
| R-06 | Trẻ 6 tuổi chưa tự thao tác được | Cao | Thử `/demo` ở GĐ4 trước khi xây CSDL |
| R-07 | Tương thích phiên bản: TypeScript 7, ESLint 10, Serwist + Turbopack, react-pdf trên Next 16 | Trung bình | Ghim phiên bản theo ARCHITECTURE §3; POC |
| R-08 | `create-next-app` từ chối thư mục đã có `CLAUDE.md`/`TASKS.md`/`PROGRESS.md` | Thấp | Scaffold vào thư mục tạm rồi hợp nhất, hoặc tạo thủ công |
| R-09 | Khóa `anon`/`service_role` của Supabase bị khai tử cuối 2026 | Thấp | Dùng khóa publishable/secret ngay từ đầu |
| R-10 | Lạm dụng đăng nhập ẩn danh (Supabase mặc định 30 lần/giờ/IP) | Thấp–TB | Giới hạn tần suất riêng + Turnstile ở `/join` + dọn người dùng ẩn danh |
| R-11 | Docker daemon chưa chạy; Windows long paths tắt | Thấp | Bật Docker Desktop khi cần Supabase local; bật long paths nếu gặp lỗi |
| R-12 | Bản quyền nội dung SGK, hình ảnh | Trung bình | Chỉ lưu thứ tự bài/đơn vị; ghi nguồn và giấy phép mọi media |
| R-13 | GV quá tải khi duyệt nội dung | Trung bình | Thư viện khởi đầu + tạo nhanh theo quy tắc + bộ kiểm tra tự động |

## 7. Bước tiếp theo

**Đề xuất GĐ2 — Nền móng kỹ thuật** (chi tiết và tiêu chí nghiệm thu: [TASKS.md](TASKS.md#gđ2--nền-móng-kỹ-thuật-m)).

Điều kiện trước khi bắt đầu:

1. Người điều phối phê duyệt kiến trúc, mô hình dữ liệu và kế hoạch GĐ1.
2. Trả lời Q-11, Q-12 (quyền commit/push/thêm remote, repo public/private, có tạo dự án Vercel không).
3. Nên trả lời sớm Q-01, Q-02 để chuẩn bị GĐ3.

Lệnh đề xuất để kết nối remote (chỉ chạy khi được phép):

```powershell
git -C D:\ReadMateAI remote add origin https://github.com/ThaiTaka/ReadMateAI.git
git -C D:\ReadMateAI remote -v
```

## 8. Nhật ký phiên

| Ngày | Phiên | Giai đoạn | Tóm tắt |
|---|---|---|---|
| 2026-10-12 | #1 | GĐ1 | Kiểm tra môi trường; `git init -b main`; xác minh phiên bản và tài liệu; tạo 6 tài liệu + `.gitignore` + `.gitattributes`; kiểm tra mã hóa, 93 liên kết, 6 sơ đồ Mermaid, quét secret — tất cả đạt; đọc lại và sửa 5 điểm chưa nhất quán. Không commit/push/deploy. **Kết thúc GĐ1 — chờ duyệt.** |
