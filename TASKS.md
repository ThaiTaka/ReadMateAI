# TASKS — Kế hoạch phát triển ReadMate AI

> **Cập nhật:** 2026-10-14 · **Giai đoạn hiện tại:** GĐ2 đã hoàn thành — chờ người điều phối đánh giá
> **Quy ước:** mỗi giai đoạn triển khai và kiểm thử độc lập; **chỉ bắt đầu giai đoạn mới khi được phê duyệt**.
> **Ký hiệu:** `[x]` xong · `[ ]` chưa làm · Quy mô ước lượng thô: **S** (≤ 1 phiên làm việc), **M** (2–3 phiên), **L** (≥ 4 phiên).
> **Tài liệu:** [PRD](docs/PRD.md) · [ARCHITECTURE](docs/ARCHITECTURE.md) · [DATA_MODEL](docs/DATA_MODEL.md) · [PROGRESS](PROGRESS.md)

## Tổng quan lộ trình

| GĐ | Tên | Kết quả có thể kiểm thử độc lập | Phụ thuộc | Quy mô | Trạng thái |
|---|---|---|---|---|---|
| 1 | Khởi tạo & thiết kế kiến trúc | Bộ tài liệu, Git cục bộ | — | S | ✅ Đã duyệt |
| 2 | Nền móng kỹ thuật | Ứng dụng khung build/lint/test xanh, CI | GĐ1 | M | ✅ Chờ duyệt |
| 3 | Lõi Tiếng Việt & kho tri thức dạng mã | Thư viện phân tích tiếng + dữ liệu lõi có kiểm thử | GĐ2 | M–L | ⏸ |
| 4 | Bộ máy bài tập + 6 dạng bài + `/demo` | Bản chơi thử chạy trên điện thoại, chưa cần CSDL | GĐ2, GĐ3 | L | ⏸ |
| 5 | Supabase: CSDL nền, RLS, xác thực | GV đăng nhập, thẻ học, liên kết thiết bị, kiểm thử RLS | GĐ3 | L | ⏸ |
| 6 | Soạn & kiểm duyệt nội dung + âm thanh | Thư viện bài đã duyệt có âm thanh | GĐ4, GĐ5 | L | ⏸ |
| 7 | Giao bài, luyện tại nhà, lưu kết quả, phân hóa | Luồng đầu–cuối GV giao → HS làm → GV thấy kết quả | GĐ6 | L | ⏸ |
| 8 | Phiếu PDF tương đương + tự lực tại lớp | PDF in được, ghi nhận tự lực | GĐ7 | M–L | ⏸ |
| 9 | Dashboard giáo viên cơ bản | Dashboard với số liệu kiểm chứng | GĐ7, GĐ8 | M | ⏸ |
| 10 | Sẵn sàng thí điểm & production | **MVP hoàn tất**, sẵn sàng thí điểm lớp 1A2 | GĐ2–GĐ9 | M | ⏸ |
| 11 | AI hỗ trợ tạo bài (sau MVP) | AI tạo bản nháp, GV duyệt | GĐ10 | M–L | ⏸ |
| 12+ | Nâng cao | — | — | — | Chưa lập kế hoạch |

**MVP = GĐ2 → GĐ10.** Gồm: ba nhóm học sinh, sáu dạng bài, nghe hướng dẫn, luyện tại nhà, phiếu tương đương, lưu kết quả, dashboard cơ bản, kho tri thức và quy trình duyệt. AI nâng cao chỉ làm từ GĐ11.

---

## GĐ1 — Khởi tạo và thiết kế kiến trúc ✅

**Mục tiêu:** kiểm tra môi trường, chốt kiến trúc, mô hình dữ liệu, kế hoạch và tài liệu nền.

- [x] 1.1 Kiểm tra môi trường: thư mục, Git, remote, Node/npm, GitHub CLI, Vercel CLI, Supabase CLI, Docker, mạng
- [x] 1.2 Khởi tạo Git cục bộ (nhánh `main`); thêm `.gitignore` (chặn `.env*`, dữ liệu xuất) và `.gitattributes` (LF); **không** thêm remote, **không** commit
- [x] 1.3 Xác minh phiên bản thư viện bằng `npm view` và tài liệu chính thức (Next.js 16 `proxy.ts`, khóa API mới của Supabase, đăng nhập ẩn danh, giá/giới hạn Supabase & Vercel, Node trên Vercel, Luật 91/2025/QH15, giọng TTS `vi-VN`, font Andika)
- [x] 1.4 `docs/PRD.md`
- [x] 1.5 `docs/ARCHITECTURE.md`
- [x] 1.6 `docs/DATA_MODEL.md`
- [x] 1.7 `TASKS.md`
- [x] 1.8 `CLAUDE.md`
- [x] 1.9 `PROGRESS.md`

**Tiêu chí nghiệm thu**

- [x] Sáu tài liệu tồn tại trên ổ đĩa, đã đọc lại và đối chiếu với yêu cầu giai đoạn
- [x] Không push GitHub, không deploy, không tạo dịch vụ bên ngoài
- [x] Không xóa/ghi đè dữ liệu có sẵn (thư mục ban đầu rỗng)
- [x] Người điều phối phê duyệt kiến trúc và kế hoạch (khi giao GĐ2)

---

## GĐ2 — Nền móng kỹ thuật (M) ✅

**Điều kiện bắt đầu:** GĐ1 được duyệt · chủ dự án quyết định có commit/push lên GitHub (repo đang **public**) trong GĐ2 hay không · (tùy chọn) tài khoản Vercel nếu muốn có Preview.
**Phạm vi được giao (2026-10-12):** chỉ commit cục bộ — **không push, không đổi public/private, không deploy Vercel**.

- [x] 2.1 Scaffold Next.js 16.4 + React 19.3 + TypeScript 5.9 + Tailwind 4.3 (App Router, `src/`, alias `@/*`) bằng `create-next-app@16.4.0` trong thư mục tạm rồi hợp nhất — không ghi đè tài liệu; đã xóa thư mục tạm
- [x] 2.2 Kiểm tra lại phiên bản bằng `npm view` ngay trước khi cài; cập nhật ARCHITECTURE §3.1
- [x] 2.3 `package.json`: `engines.node = "24.x"`; scripts `dev`, `build`, `start`, `lint`, `typecheck`, `test`, `test:run`, `test:e2e`, `format`, `format:check` — *điều chỉnh:* **không** thêm `content:check` tạm thời (yêu cầu GĐ2: mọi script phải chạy thật) → chuyển sang 3.8
- [x] 2.4 TypeScript `strict` (+ `noUncheckedIndexedAccess`, `erasableSyntaxOnly`); ESLint 9 + `eslint-config-next` 16.4; Prettier 3
- [x] 2.5 Vitest 5 + jsdom + Testing Library (7 tệp, 80 test); Playwright 1.64 với 4 cấu hình: Desktop Chrome, Pixel 7, Desktop Safari, iPhone 13 (6 tệp spec) — *điều chỉnh:* cấu hình iPad chuyển sang 4.8
- [x] 2.6 Cấu trúc thư mục — thực tế ghi ở ARCHITECTURE §5.1 (chỉ tạo thư mục có mã thật)
- [x] 2.7 Font Andika + Be Vietnam Pro (subset `vietnamese`), design tokens, `<html lang="vi">`; trang `/`, `/demo`, `/teacher`, `/learn`, `/join` (khung giao diện, ghi rõ "bản xem trước"/"đang phát triển"), trang 404 và trang lỗi
- [x] 2.8 Header bảo mật: CSP, `Permissions-Policy` (tắt camera/microphone/geolocation/payment/usb), `Referrer-Policy` (`/join`: `no-referrer`), `X-Content-Type-Options`, `X-Frame-Options`, tắt `X-Powered-By`
- [x] 2.9 `src/strings/vi.ts` (NFC, có test); `.env.example` chỉ chứa tên biến và giá trị không bí mật
- [x] 2.10 GitHub Actions CI (`.github/workflows/ci.yml`): `npm ci` → lint → typecheck → unit test → build — **chưa chạy trên GitHub** vì chưa push
- [x] 2.11 Commit cục bộ đầu tiên + thêm remote `origin` → `https://github.com/ThaiTaka/ReadMateAI.git` (đã xác minh repo thuộc tài khoản đang đăng nhập) — **không push**; Vercel chưa liên kết (ngoài phạm vi GĐ2)

**Tiêu chí nghiệm thu**

- [x] `npm run lint`, `npm run typecheck`, `npm run test:run`, `npm run build` thành công trên Windows — [ ] trên CI (Linux): **chưa kiểm chứng** (cần push)
- [x] `/` và `/demo` (và cả 5 route) hiển thị đúng tiếng Việt có dấu ở chiều rộng 360 px, không cuộn ngang (E2E)
- [x] Playwright xanh trên Chromium và WebKit (desktop + điện thoại)
- [x] Header bảo mật có trong response của bản production (Vitest + Playwright + kiểm tra HTTP thủ công)
- [x] Không có secret trong repo (test vệ sinh repo, đã thử âm tính); `git status` không chứa tệp `.env`
- [x] Phiên bản thực tế đã ghi vào ARCHITECTURE §3.1

---

## GĐ3 — Lõi Tiếng Việt và kho tri thức dạng mã (M–L)

**Điều kiện bắt đầu:** GV xác nhận bộ sách, cách gọi tên âm, cách phân tích "qu"/"gi", quy ước vị trí dấu thanh (Q-01, Q-02 trong PROGRESS). Nếu chưa có, làm với quy ước tạm và đánh dấu "chờ xác nhận".

- [ ] 3.1 `lib/vietnamese/normalize`: NFC; phát hiện văn bản dán từ bảng mã cũ (TCVN3, VNI); chuẩn hóa vị trí dấu thanh theo cấu hình
- [ ] 3.2 `lib/vietnamese/syllable`: phân tích tiếng → âm đầu, âm đệm, âm chính, âm cuối, thanh, vần (quy ước nhà trường là tham số)
- [ ] 3.3 `lib/vietnamese/spelling-rules`: c/k/q; g/gh; ng/ngh; iê/ia/yê/ya; uô/ua; ươ/ưa; âm cuối p, t, c, ch chỉ đi với thanh sắc/nặng
- [ ] 3.4 `lib/vietnamese/decodability`: tính đơn vị cấu thành, `isDecodable(word, taughtSet)`
- [ ] 3.5 `content/kb`: 29 chữ cái; các âm (kể cả chữ ghép) kèm cách gọi khi dạy; 6 thanh; danh sách vần; quy tắc dạng máy đọc được; quan hệ nhầm lẫn (b–d, p–q, l–n, an–ang, hỏi–ngã…)
- [ ] 3.6 `content/curriculum/<bộ-sách>.json`: thứ tự bài và đơn vị được giới thiệu (chỉ dữ kiện)
- [ ] 3.7 Bộ từ vựng khởi đầu 300–500 từ phù hợp trẻ em, theo chủ đề, gắn hình có ghi nguồn/giấy phép
- [ ] 3.8 Lệnh `npm run content:check` kiểm tra toàn bộ dữ liệu lõi; thêm bước này vào `.github/workflows/ci.yml`
- [ ] 3.9 *(Tùy chọn)* trang tra cứu kho tri thức tĩnh để GV rà soát

**Tiêu chí nghiệm thu**

- [ ] ≥ 300 ca kiểm thử parser, bao phủ gi, qu, ngh, oa/oe/uy, iê/yê/ia/ya, uô/ua, ươ/ưa và đủ 6 thanh — 100% đạt
- [ ] 100% từ trong dữ liệu khởi đầu phân tích được và qua quy tắc chính tả
- [ ] Danh sách từ "đọc được" ở 3 mốc bài học mẫu được GV xem và xác nhận hợp lý
- [ ] Không có bài đọc/hình sao chép từ SGK (chỉ thứ tự bài và đơn vị kiến thức)
- [ ] Quy ước ngôn ngữ được ghi lại kèm trạng thái xác nhận của GV

---

## GĐ4 — Bộ máy bài tập, 6 dạng bài và bản chơi thử `/demo` (L)

**Điều kiện bắt đầu:** GĐ2, GĐ3 xong · có bộ âm thanh mẫu tạm thời cho demo (ghi âm GV hoặc TTS sinh trước, ghi rõ nguồn).

- [ ] 4.1 Giao diện `ExerciseTypeModule` + registry: lược đồ zod, `grade()`, `validate()`, thang gợi ý, `audioPolicy`, câu lệnh chuẩn
- [ ] 4.2 Sáu dạng bài (`letter_sound`, `build_syllable`, `identify_unit`, `fill_blank`, `word_picture`, `sentence_reading`) với Player chạm-để-chọn và ≥ 10 câu mẫu mỗi dạng
- [ ] 4.3 Bộ chạy phiên: nút "Bắt đầu" mở khóa âm thanh, mức H3→H0, "Cô làm mẫu", gợi ý theo bậc, phản hồi, chúc mừng
- [ ] 4.4 Dịch vụ phát âm thanh: tải trước, nút loa cố định, thực thi `audioPolicy`
- [ ] 4.5 Bộ kiểm tra chung: NFC, đáp án duy nhất, phương án trùng, `AUDIO_LEAKS_ANSWER`, `TEXT_LEAKS_ANSWER`
- [ ] 4.6 Bộ biểu tượng hướng dẫn SVG (có bản đen trắng cho phiếu)
- [ ] 4.7 `/demo`: chơi đủ 6 dạng, không đăng nhập, không gửi dữ liệu
- [ ] 4.8 Kiểm thử component + E2E (Pixel, iPhone, Desktop đã có từ GĐ2; thêm cấu hình iPad) + kiểm tra trợ năng axe
- [ ] 4.9 Buổi thử khả dụng với GV (và học sinh nếu nhà trường, phụ huynh đồng ý — không thu dữ liệu); ghi nhận phản hồi vào PROGRESS

**Tiêu chí nghiệm thu**

- [ ] Mỗi dạng bài chơi trọn vẹn (đúng, sai, gợi ý, hết lượt) ở 360×640, iPad và desktop
- [ ] E2E chứng minh: dạng 5 và 6 không phát âm thanh chứa từ/câu cần đọc trước khi chấm; âm thanh mẫu chỉ phát sau khi chấm
- [ ] Bộ kiểm tra chặn 100% fixture vi phạm cố ý (lộ đáp án, đáp án mơ hồ, phương án trùng)
- [ ] Vùng chạm ≥ 64 px; axe không có lỗi mức nghiêm trọng
- [ ] `/demo` không phát sinh request ghi dữ liệu (kiểm tra mạng bằng Playwright)
- [ ] GV xác nhận câu lệnh và biểu tượng dễ hiểu với học sinh lớp 1

---

## GĐ5 — Supabase: CSDL nền, RLS và xác thực (L)

**Điều kiện bắt đầu:** chủ dự án cho phép tạo dự án Supabase *dev* (region Singapore) · Docker Desktop đang chạy (cho Supabase local) · quyết định dùng Turnstile cho `/join` ở production.

- [ ] 5.1 Supabase CLI qua `npx supabase`; `supabase init`; cấu hình local
- [ ] 5.2 Migrations GĐ5 theo [DATA_MODEL §12](docs/DATA_MODEL.md#12-kế-hoạch-migration-theo-giai-đoạn) + schema `private` + hàm trợ giúp + RLS + `comment on`
- [ ] 5.3 Storage buckets và policies
- [ ] 5.4 Script seed kho tri thức từ `content/` (chạy lặp lại không lỗi)
- [ ] 5.5 Client Supabase (browser/server/admin có `server-only`); `proxy.ts` theo hướng dẫn hiện hành (`getClaims()`); sinh kiểu TypeScript; dùng khóa publishable/secret
- [ ] 5.6 Đăng nhập GV (email/mật khẩu, tắt tự đăng ký); script tạo tài khoản GV/admin
- [ ] 5.7 **POC trước**, rồi hiện thực luồng thẻ học: tạo mã (HMAC + pepper), trang in thẻ (HTML), `/join`, liên kết thiết bị, chọn hồ sơ, thu hồi
- [ ] 5.8 Giới hạn tần suất cho `/api/join`; chuẩn bị Turnstile
- [ ] 5.9 Màn hình GV: lớp, học sinh, thẻ học, thiết bị, ghi nhận đồng ý, nhóm, vị trí bài học
- [ ] 5.10 Kiểm thử RLS tự động: ≥ 2 lớp × 2 GV × 3 HS, thiết bị đã thu hồi, người dùng ẩn danh chưa liên kết
- [ ] 5.11 CI kiểm tra bundle client không chứa khóa secret
- [ ] 5.12 Ghi `audit_logs` cho thao tác của GĐ5

**Tiêu chí nghiệm thu**

- [ ] Toàn bộ migration áp dụng sạch trên CSDL mới; seed chạy lặp lại không lỗi
- [ ] Kiểm thử RLS chứng minh các bảo đảm then chốt ([DATA_MODEL §7](docs/DATA_MODEL.md#7-ma-trận-phân-quyền-rls)) cho mọi bảng của GĐ5
- [ ] Quét QR → vào học thành công trên Android Chrome và iPhone Safari; thu hồi thiết bị có hiệu lực ở request kế tiếp
- [ ] Mã thẻ học không được lưu dạng gốc; dò mã bị chặn bởi giới hạn tần suất
- [ ] Không có khóa secret trong bundle client; không dùng khóa `anon`/`service_role` cũ

---

## GĐ6 — Soạn và kiểm duyệt nội dung, hệ thống âm thanh (L)

**Điều kiện bắt đầu:** GĐ4, GĐ5 xong · GV sẵn sàng ghi âm âm/vần · được phép tạo tài khoản nhà cung cấp TTS để thử nghiệm (nếu dùng).

- [ ] 6.1 Migrations GĐ6 + trigger bất biến phiên bản + RLS + kiểm thử
- [ ] 6.2 Giao diện soạn bài theo 6 khuôn, chọn dữ liệu từ kho tri thức, xem trước như học sinh
- [ ] 6.3 Hiển thị báo cáo kiểm tra tự động (lỗi/cảnh báo) kèm gợi ý sửa
- [ ] 6.4 Quy trình duyệt: gửi, duyệt, yêu cầu sửa, từ chối, tạo phiên bản mới; ghi `content_reviews`
- [ ] 6.5 Tạo nhanh theo quy tắc cho 6 dạng (không AI)
- [ ] 6.6 POC 2–3 nhà cung cấp TTS → chọn; adapter `TtsProvider`; sinh âm thanh khi duyệt, dùng lại theo hash
- [ ] 6.7 Ghi âm/tải tệp của GV tại `/teacher/audio` (route duy nhất bật microphone); duyệt bản ghi; thay thế TTS
- [ ] 6.8 Thư viện media có nguồn gốc/giấy phép; danh sách chặn từ ngữ không phù hợp trẻ em
- [ ] 6.9 Thư viện khởi đầu: ≥ 20 bài đã duyệt cho mỗi dạng, bám các bài học đầu năm

**Tiêu chí nghiệm thu**

- [ ] GV tạo, kiểm tra và duyệt một bài của mỗi dạng trong ≤ 5 phút
- [ ] Không thể gửi duyệt khi còn lỗi; không thể sửa phiên bản đã gửi duyệt
- [ ] Kiểm thử chứng minh phiên bản chưa duyệt không thể xuất hiện trong phiên luyện của học sinh
- [ ] Mọi bài đã duyệt có đủ âm thanh bắt buộc; âm/vần đơn lẻ dùng bản ghi âm GV
- [ ] Có biên bản so sánh TTS (chất lượng, giọng vùng miền, giá, điều khoản dữ liệu) và quyết định được ghi vào PROGRESS

---

## GĐ7 — Giao bài, luyện tập tại nhà, lưu kết quả, phân hóa (L)

**Điều kiện bắt đầu:** GĐ6 xong · thư viện bài đã duyệt đủ cho ít nhất 2 tuần học.

- [ ] 7.1 Migrations GĐ7 + RLS + trigger chỉ gắn phiên bản đã duyệt
- [ ] 7.2 Giao bài theo nhóm (3 biến thể), phát hành/đóng, chụp danh sách người nhận
- [ ] 7.3 `/learn`: chọn hồ sơ, "Bài hôm nay", bộ chạy phiên nối CSDL
- [ ] 7.4 Student gateway: lập kế hoạch phiên, cung cấp nội dung đã duyệt, nhận kết quả theo lô, chấm lại, chống trùng, kiểm tra đồng ý
- [ ] 7.5 Hàng đợi kết quả cục bộ (IndexedDB) và tự gửi lại khi có mạng
- [ ] 7.6 Bộ máy phân hóa: mastery, Leitner, mức hỗ trợ, câu bắc cầu, thử thách, đề xuất đổi nhóm — cấu hình có phiên bản
- [ ] 7.7 Góc phụ huynh
- [ ] 7.8 Kiểm thử luật phân hóa bằng lịch sử học tập mô phỏng

**Tiêu chí nghiệm thu**

- [ ] Luồng đầu–cuối: GV giao bài → HS làm trên điện thoại → GV thấy kết quả
- [ ] Gửi lại cùng lô không tạo bản ghi trùng; mất mạng giữa phiên rồi có mạng lại không mất kết quả
- [ ] Kết quả do server chấm lại; giá trị `is_correct` do client gửi bị bỏ qua
- [ ] Học sinh chưa có đồng ý vẫn luyện được nhưng không có dòng dữ liệu nào được ghi
- [ ] Luật phân hóa cho kết quả đúng bảng kỳ vọng của các kịch bản mô phỏng
- [ ] Không màn hình nào của học sinh hiển thị nhóm năng lực

---

## GĐ8 — Phiếu PDF tương đương và ghi nhận tự lực tại lớp (M–L)

**Điều kiện bắt đầu:** GĐ7 xong · biết loại máy in của trường (Q-06).

- [ ] 8.1 POC `@react-pdf/renderer` + font Andika + dấu tiếng Việt trong Route Handler (Node.js runtime)
- [ ] 8.2 Component `Paper` cho 6 dạng bài (cùng biểu tượng và câu lệnh với app)
- [ ] 8.3 Bộ sinh "bài sinh đôi" cho phiếu (cùng dạng, cùng mục tiêu, cùng độ khó, không trùng câu)
- [ ] 8.4 Migrations GĐ8; xem trước → duyệt → dựng PDF → lưu bucket riêng tư → signed URL
- [ ] 8.5 Màn hình ghi nhận tự lực tại lớp (3 mức, thao tác nhanh trên điện thoại)
- [ ] 8.6 In thẻ học dạng PDF (QR + mã dự phòng)

**Tiêu chí nghiệm thu**

- [ ] PDF hiển thị đúng dấu tiếng Việt (văn bản trích xuất từ PDF trùng chuỗi NFC gốc)
- [ ] Mỗi phần phiếu có biểu tượng + câu lệnh giống app; 0 câu trùng với bài ở nhà
- [ ] Dựng phiếu 4 trang ≤ 10 giây
- [ ] GV in thử đen trắng và xác nhận dễ đọc
- [ ] GV ghi nhận tự lực cho lớp 40 em trong ≤ 3 phút

---

## GĐ9 — Dashboard giáo viên cơ bản (M)

**Điều kiện bắt đầu:** GĐ7, GĐ8 xong.

- [ ] 9.1 View/hàm tổng hợp (security invoker, chịu RLS)
- [ ] 9.2 Màn hình: tổng quan tuần, bản đồ nhiệt HS × âm/vần, lỗi phổ biến, mức hỗ trợ và "sẵn sàng", đối chiếu tự lực tại lớp, danh sách việc cần làm, chi tiết học sinh
- [ ] 9.3 Xử lý đề xuất đổi nhóm (chấp nhận/bỏ qua, ghi lịch sử)
- [ ] 9.4 Bộ dữ liệu giả (40 HS × 3 tháng) cho kiểm thử số liệu và hiệu năng

**Tiêu chí nghiệm thu**

- [ ] Số liệu khớp kết quả tính tay trên bộ dữ liệu mẫu
- [ ] Mỗi trang dashboard < 1 giây với bộ dữ liệu giả
- [ ] Không có xếp hạng học sinh; biểu đồ không chỉ dựa vào màu
- [ ] Kiểm thử RLS: GV không thấy dữ liệu lớp khác

---

## GĐ10 — Sẵn sàng thí điểm và production (M) — hoàn tất MVP

**Điều kiện bắt đầu:** nhà trường đồng ý thí điểm · xác định bên kiểm soát dữ liệu · ngân sách gói trả phí (Supabase Pro; Vercel Pro nếu không đủ điều kiện Hobby).

- [ ] 10.1 Bản thảo thông báo xử lý dữ liệu và phiếu đồng ý cho phụ huynh (để nhà trường duyệt)
- [ ] 10.2 Rà soát pháp lý với nhà trường/chuyên gia: Luật 91/2025/QH15 (dữ liệu trẻ em — Điều 24; chuyển dữ liệu xuyên biên giới — Điều 20) và văn bản hướng dẫn
- [ ] 10.3 Dự án Supabase prod (Pro, Singapore); Vercel production đúng điều khoản gói; SMTP riêng cho email GV; Turnstile cho `/join`
- [ ] 10.4 Cron lưu giữ/xóa dữ liệu; quy trình rút đồng ý; diễn tập khôi phục từ sao lưu
- [ ] 10.5 Rà soát bảo mật (RLS, header, secret, phụ thuộc); kiểm thử tải nhẹ
- [ ] 10.6 Hướng dẫn GV; hướng dẫn phụ huynh (1 trang)
- [ ] 10.7 Kế hoạch thí điểm 4 tuần với lớp 1A2; đo chỉ số nền

**Tiêu chí nghiệm thu**

- [ ] Checklist quyền riêng tư/pháp lý được nhà trường xác nhận bằng văn bản
- [ ] Mỗi học sinh tham gia có ghi nhận đồng ý trước khi có dữ liệu thật
- [ ] Production chạy ở `sin1` + Supabase Singapore; smoke test xanh
- [ ] Khôi phục thử từ bản sao lưu thành công
- [ ] Không còn phát hiện bảo mật mức cao chưa xử lý

---

## GĐ11 — AI hỗ trợ tạo bài (sau MVP, M–L)

**Điều kiện bắt đầu:** MVP vận hành ổn định · chủ dự án cấp khóa API và hạn mức chi phí · GV cùng xây bộ đánh giá chất lượng.

- [ ] 11.1 Cổng `StructuredLlm`; adapter `fixture`; adapter Anthropic qua SDK chính thức (mô hình cấu hình bằng `AI_MODEL`, mặc định `claude-opus-5-5`) — kiểm tra lại API hiện hành trước khi viết
- [ ] 11.2 Bộ dựng ngữ cảnh từ kho tri thức (tuyệt đối không có dữ liệu học sinh)
- [ ] 11.3 Prompt có phiên bản; structured output + zod; chạy chuỗi kiểm tra của ARCHITECTURE §11.3
- [ ] 11.4 `ai_generation_runs`; giới hạn chi phí/ngày; Batch API cho sinh hàng loạt; prompt caching
- [ ] 11.5 Bộ đánh giá: tỉ lệ qua kiểm tra, tỉ lệ được GV duyệt, lỗi thường gặp, chi phí/100 câu

**Tiêu chí nghiệm thu**

- [ ] `AI_PROVIDER=none`: toàn bộ ứng dụng vẫn hoạt động
- [ ] Kiểm thử chứng minh 0 bản nháp AI đến tay học sinh khi chưa duyệt
- [ ] Kiểm thử chứng minh yêu cầu gửi tới nhà cung cấp không chứa dữ liệu học sinh
- [ ] Có báo cáo chi phí/100 câu và tỉ lệ được duyệt

---

## GĐ12+ — Nâng cao (chưa lập kế hoạch chi tiết)

- Phân hóa thống kê (BKT/Elo), nhóm theo kỹ năng
- PWA ngoại tuyến đầy đủ
- Phiếu cá nhân hóa từng học sinh
- Nhiều lớp/nhiều trường, đồng chủ nhiệm
- Đọc đoạn văn và dạng bài mới
- Tính năng giọng nói — chỉ khi có đồng ý riêng và đánh giá tác động; ưu tiên xử lý trên thiết bị
