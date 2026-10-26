# REDESIGN_TASKS — Lộ trình tái cấu trúc ReadMate AI (R01 → R11)

> **Cập nhật:** 2026-10-20 · **Giai đoạn hiện tại:** R04 — hoàn thành trên Supabase LOCAL, chờ người điều phối đánh giá (R01–R03 đã được chấp nhận). Dự án Supabase Cloud chưa tạo (cần xác nhận).
> **Quy ước:** mỗi giai đoạn giao bằng prompt riêng; **chỉ bắt đầu giai đoạn mới khi được phê duyệt**. Mọi giai đoạn kết thúc bằng: kiểm tra đầy đủ (CLAUDE.md §10) → quét secret → commit → push nhánh `feature/home-learning-redesign` → xác minh trên GitHub (CLAUDE.md §2, theo yêu cầu R01 §12).
> **Ký hiệu:** `[x]` xong · `[ ]` chưa · Quy mô: **S** ≤ 1 phiên · **M** 2–3 phiên · **L** ≥ 4 phiên.
> **Tài liệu:** [PRODUCT_REDESIGN](docs/PRODUCT_REDESIGN.md) · [GAMIFICATION_SPEC](docs/GAMIFICATION_SPEC.md) · [GAME_DESIGN](docs/GAME_DESIGN.md) · [LEADERBOARD_SPEC](docs/LEADERBOARD_SPEC.md) · [REDESIGN_ARCHITECTURE](docs/REDESIGN_ARCHITECTURE.md) · [PRIVACY_AND_SECURITY](docs/PRIVACY_AND_SECURITY.md) · [REDESIGN_PROGRESS](REDESIGN_PROGRESS.md)
> Lộ trình cũ GĐ5 → GĐ12 ở [TASKS.md](TASKS.md) **được thay thế** bởi tệp này (bảng đối chiếu ở cuối).

## Tổng quan

| R | Tên | Phụ thuộc | Quy mô | Trạng thái |
|---|---|---|---|---|
| R01 | Kiểm tra dự án, bảo toàn công việc, thiết kế lại kiến trúc | — | S | ✅ Đã chấp nhận |
| R02 | Giao diện mới, trang học sinh, Game World (dữ liệu minh họa) | R01 | L | ✅ Đã chấp nhận |
| R03 | Supabase, tài khoản, phân quyền, dữ liệu nền | R01 | L | ✅ Đã chấp nhận (local; Cloud chờ xác nhận) |
| R04 | Scoring Engine, phát câu ở server, điểm thưởng, mở khóa bản đồ | R03 (+ R02 cho giao diện) | L | ✅ Chờ duyệt (local) |
| R05 | Leaderboard kiểu FIFA, avatar, ranking | R04 | M | ✅ |
| R06 | Vinh danh TOP 3, reset mùa giải | R05 | M | ✅ |
| R07 | Mê cung kho báu, điều khiển nhân vật (Game Engine) | R02 (lõi), R04 (lưu tiến độ) | L | ✅ R07.6 xong (CI xanh `8701cfa`) — nghiệm thu R07 về engine/đồ họa/điều khiển/lưu vị trí/bảo mật lượt chơi; chưa phải mini-game hoàn chỉnh (R08) |
| R08 | Quái vật, chạm trán bằng câu hỏi, giới hạn 7 encounters | R07, R04 | L | 🔄 R08.1 (database chạm trán + schema 21 câu), R08.2 (phân bổ 7 × 21) và R08.3 (chơi chạm trán + kho báu ở máy chủ) và R08.4 (giao diện quái vật) xong; **R08.5 phần kỹ thuật xong** (soát chống lộ đáp án + giấy phép, hồ sơ GV `docs/reviews/R08_MONSTER_REVIEW.md` đã chuẩn bị; **GV phê duyệt hình/tên/lời thoại: CHỜ XÁC NHẬN THỰC TẾ** — chưa đóng R08.5 hoàn toàn); **R08.6 xong** (chơi lại màn đã hoàn thành không cộng/trừ điểm — migration `20261030090000`, REDESIGN_PROGRESS §5t) → **R08 xong về kỹ thuật**, nhưng **chưa được phê duyệt dùng thật** (GV chưa duyệt hình quái vật R08.5; kho học liệu 0 mục đã duyệt) |
| R09 | Ba mini-game còn lại | R08 | L | ⏸ **Tạm hoãn sau khi nộp dự án** |
| R10 | Audio Engine, giao diện kiểm duyệt học liệu, trải nghiệm học tại nhà | R03, R04 (có thể song song từ R04) | L | ⏸ |
| R11 | Kiểm thử tổng thể, bảo mật, responsive, dọn mã cũ, deploy Vercel | R02–R10 | M–L | ⏸ |

**Lộ trình nộp dự án (chủ dự án quyết định, 2026-10-21): R07 → R08 → R10 → R11 → NỘP DỰ ÁN.** R09 (ba mini-game còn lại) **tạm hoãn sau khi nộp**, không xóa khỏi kế hoạch và **không bắt đầu trước ngày nộp**. Ba mini-game còn lại hiển thị "Sắp ra mắt", không cho vào. Giữ nguyên mọi tiêu chí bảo mật, kiểm duyệt học liệu và bản quyền của R10–R11.

### Điều chỉnh thứ tự và lý do

Giữ thứ tự do người điều phối đề xuất, với ba điều chỉnh về **phụ thuộc thực tế** (không đổi số hiệu giai đoạn):

1. **R02 chỉ dùng dữ liệu minh họa** (không CSDL) — vì R03 mới có Supabase. Giao diện điểm, bản đồ, bảng xếp hạng ở R02 là bản xem trước có nhãn "Bản chơi thử", dữ liệu hư cấu ở `src/features/demo/`.
2. **R07 có thể bắt đầu phần lõi game song song sau R02** (lõi TS thuần không cần CSDL), nhưng phần lưu tiến độ/vào game theo điểm chỉ nghiệm thu được sau R04.
3. **R10 (âm thanh, giao diện duyệt) có thể chạy song song từ sau R04** và là **điều kiện bắt buộc trước khi cho học sinh thật dùng** (R11): không có âm thanh câu lệnh thì Nhóm 3 không tự chơi được (R-24), không có nội dung đã duyệt thì chế độ học thật không tạo được câu nào cho cả buổi luyện lẫn game (T-23).

Ngoài ra: dọn mã luồng cũ chia hai bước — gỡ khỏi giao diện ở **R02**, xóa mã ở **R11** (AD-51).

---

## R01 — Kiểm tra, bảo toàn, thiết kế lại kiến trúc (S) ✅

- [x] 1.1 Kiểm tra thư mục, `git status`/log/nhánh/remote/stash/worktree/reflog, đối tượng git mồ côi, tệp chưa commit
- [x] 1.2 Đọc CLAUDE.md, TASKS, PROGRESS, PRD, ARCHITECTURE, DATA_MODEL, VIETNAMESE_ENGINE, EXERCISE_ENGINE (AUDIO_ENGINE **không tồn tại**)
- [x] 1.3 Tìm công việc GĐ5 / Prompt 05 (âm thanh, Vercel): **không có** trong thư mục, lịch sử git, GitHub (chỉ nhánh `main`) hay transcript phiên trước của thư mục này
- [x] 1.4 Kiểm tra Vercel (0 deployment, không `.vercel/`) và Supabase (không `supabase/`, không `.env`) → **chưa kết nối**
- [x] 1.5 Chạy baseline: format, lint, typecheck, content:check, test:run, build — đều xanh
- [x] 1.6 Tạo nhánh `feature/home-learning-redesign`; checkpoint 2 PDF chưa theo dõi (commit `6eca037`)
- [x] 1.7 Hỏi người điều phối 2 điểm mâu thuẫn quy tắc BẮT BUỘC (bảng xếp hạng vs §6.4; −5 vs §7.10) → chọn phương án có điều kiện
- [x] 1.8 Tạo 6 tài liệu thiết kế + REDESIGN_TASKS + REDESIGN_PROGRESS; cập nhật CLAUDE.md, PROGRESS, TASKS, README, PRD, ARCHITECTURE (+ ghi chú ở DATA_MODEL, EXERCISE_ENGINE)
- [x] 1.9 Kiểm tra liên kết Markdown, NFC/byte, quét secret; chạy lại bộ kiểm tra; commit + push nhánh

**Tiêu chí nghiệm thu**

- [x] Không xóa/ghi đè tệp chưa đọc; không `reset --hard`, `clean`, force push; `main` không đổi
- [x] Tài liệu tương lai ghi **PLANNED**; tài liệu cũ có ghi chú phần bị thay thế, không mâu thuẫn
- [x] Bộ kiểm tra xanh; không secret/dữ liệu học sinh trong commit
- [x] Người điều phối duyệt kiến trúc và lộ trình (chấp nhận chuyển sang R02, 2026-10-20)

**Đầu ra:** bộ tài liệu R01, nhánh trên GitHub, báo cáo R01.

---

## R02 — Giao diện mới, trang học sinh, Game World (L) ✅ Đã chấp nhận

**Phụ thuộc:** R01 được duyệt. **Không** CSDL, **không** tài khoản: mọi dữ liệu là minh họa hư cấu, không lưu.

Nhiệm vụ:

- [x] 2.1 Hệ thống thiết kế "Modern 2D Educational Adventure": token màu/chuyển động/bóng mới trong `src/styles/tokens.css`; thành phần nút lớn, khung cảnh, thẻ khóa, ô điểm, trái tim HP (chỉ giao diện)
- [x] 2.2 Asset minh họa đầu tiên **có giấy phép** (tự vẽ SVG hoặc nguồn CC0 có ghi công) + `content/media/licenses.json`; phác thảo nhân vật/avatar/quái vật để GV xem (RQ-M1)
- [x] 2.3 `/learn` thành **bản đồ thế giới** (thẻ sương mù, trạm luyện tập, 4 lối vào game có khóa + ngưỡng, ô điểm) — dữ liệu minh họa
- [x] 2.4 Trang chủ `/`, metadata, `package.json` `description`, `src/config/site.ts`: viết lại theo định hướng mới
- [x] 2.5 Gỡ luồng cũ khỏi giao diện (AD-51): `classroom_like` → "Tự làm" (H0), bỏ xem trước phiếu khỏi `/demo`, bỏ "giống phiếu" ở H1/H0, bỏ chỉ số "cần GV ghi nhận ở lớp"; cập nhật chuỗi `vi.ts` và test tương ứng (không xóa test để "cho xanh")
- [x] 2.6 `/demo` bổ sung bản xem trước bản đồ, ô điểm và bảng xếp hạng **hư cấu** (nhãn rõ)
- [x] 2.7 Cài đặt trẻ: giảm chuyển động (theo `prefers-reduced-motion` + công tắc trong trang, chưa lưu server — R03), âm lượng (khóa, chưa có âm thanh)
- [x] 2.8 Sidebar GV: mục Bảng điểm, Vinh danh, Mùa thi đua ("Sắp có"), bỏ "Phiếu học tập"
- [x] 2.9 CI: thêm kích hoạt cho nhánh `feature/**` (hiện workflow chỉ chạy trên `main` và pull request)

**Tệp/module dự kiến:** `src/styles/tokens.css`, `src/components/{world,kid,ui}/`, `src/app/learn/**`, `src/app/(site)/page.tsx`, `src/app/(site)/demo/**`, `src/features/demo/**`, `src/features/exercises/core/support.ts`, `src/strings/vi.ts`, `src/components/layout/teacher-sidebar.tsx`, `.github/workflows/ci.yml`, `tests/unit/**`, `tests/e2e/**`.

**Tiêu chí nghiệm thu**

- [x] Không còn chuỗi "Thử như ở lớp", "phiếu ở lớp", "tự thực hiện ở lớp" trong giao diện học sinh và trang chủ (unit test soát chuỗi)
- [x] Bản đồ dùng được ở 360 px, iPhone, iPad, desktop; vùng chạm ≥ 64 px; không cuộn ngang; axe không lỗi critical/serious
- [x] Giảm chuyển động tắt mọi hoạt cảnh di chuyển; không hiệu ứng nhấp nháy
- [x] Mọi asset có dòng giấy phép; không ảnh/nhân vật của SGK hay thương hiệu khác
- [x] `/demo` vẫn không request ghi, không `localStorage` (E2E giữ nguyên)
- [x] JS route `/learn` đo và ghi lại (ngân sách ≈ 200 KB gzip)

**Kiểm thử bắt buộc:** format, lint, typecheck, content:check, test:run, build, **test:e2e** (thay đổi giao diện/route).
**Đầu ra:** giao diện mới chạy với dữ liệu minh họa; danh sách asset + giấy phép; ảnh chụp các màn ở 4 cỡ thiết bị.

**Kết quả R02 (2026-10-20)** — chi tiết ở [REDESIGN_PROGRESS §3](REDESIGN_PROGRESS.md#3-việc-đã-làm-trong-r02):

- 2.1: token `jade`/`magic`/`deep`, bóng "khối", 8 hoạt cảnh; 17 thành phần ở `src/components/adventure/` + `ComingSoonState` — [docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md).
- 2.2: 22 dòng giấy phép (`content/media/licenses.json`, kiểm trong `content:check`): Bạn nhỏ thám hiểm, Cú Bông, Bé Mây Bông, 5 avatar, rương, bục vinh danh, 4 cảnh game, bản đồ thế giới, phông cảnh, 8 ô mốc — tất cả `pending_review`, xem ở `/teacher#duyet-hoc-lieu` — [docs/ASSET_MANIFEST.md](docs/ASSET_MANIFEST.md).
- 2.3: `/learn` = Student Adventure Dashboard (hồ sơ hư cấu "Mây", 135 điểm) + Game World (bản đồ, 4 thẻ khóa/đủ điểm, bảng chi tiết, "Vào chơi – Sắp có" khóa) + 8 mốc khám phá + huy hiệu. Mốc bản đồ hiện là dải 8 ô (chưa phải lưới 24 thẻ chạm để mở — thao tác mở thuộc R04).
- 2.5: H0 "Tự làm", `layout` `focused`, bỏ xem trước phiếu, bỏ chỉ số ghi nhận ở lớp; buổi luyện mẫu kết thúc bằng "Thử thách tự làm".
- 2.7: âm lượng **chưa làm** (chưa có âm thanh nào — để R10); giảm chuyển động có công tắc trong `/learn` và `/demo`.
- 2.9: `.github/workflows/ci.yml` chạy trên push `feature/**`.
- Ngoài kế hoạch: `src/features/gamification/rules.ts` + `unlocks.ts` (hằng số và hàm thuần, kế hoạch gốc R04) tạo sớm để giao diện không chép số.

---

## R03 — Supabase, tài khoản, phân quyền, dữ liệu (L) ✅

**Phụ thuộc:** R01. **Điều kiện trước:** người điều phối cho phép tạo dự án Supabase *dev* (Singapore) và dùng `npx supabase`; Docker daemon chạy (Supabase local, R-11); hướng trả lời Q-05 (bên kiểm soát dữ liệu).

Nhiệm vụ:

- [x] 3.1 Kiểm tra phiên bản `@supabase/supabase-js`, `@supabase/ssr`, CLI bằng `npm view` → cập nhật ARCHITECTURE §3; `supabase init`
- [x] 3.2 **POC trước**: đăng nhập ẩn danh + liên kết thiết bị bằng thẻ học + `proxy.ts` (`getClaims()`) — **Turnstile chưa làm** (cần dịch vụ Cloudflare + dự án Cloud; ghi ở STUDENT_ACCESS §5)
- [x] 3.3 Migrations nền ([REDESIGN_ARCHITECTURE §12](docs/REDESIGN_ARCHITECTURE.md#12-kế-hoạch-migration-theo-giai-đoạn-r), hàng R03): bảng DATA_MODEL GĐ5 + cột mới (cờ bảng xếp hạng/vinh danh, `guardian_consents.scope`, `leaderboard_alias`, `preferences`) + `seasons` (mùa đầu tạo cùng lớp); schema `private` + hàm trợ giúp; RLS mọi bảng
- [x] 3.4 Client Supabase `server.ts`, `admin.ts` (`server-only`), `proxy.ts`; **không tạo `browser.ts`** — không mã trình duyệt nào cần (AD-55); sinh kiểu `database.types.ts`
- [x] 3.5 Đăng nhập GV (email/mật khẩu, tắt tự đăng ký); script tạo GV/admin dữ liệu giả
- [x] 3.6 Thẻ học: tạo mã (HMAC + pepper), `/join`, liên kết, thu hồi; giới hạn tần suất
- [x] 3.7 Màn GV: lớp, học sinh (biệt danh, số thứ tự, avatar), thẻ học, thiết bị, ghi nhận đồng ý **hai phạm vi**, duyệt alias, nhóm, vị trí bài học
- [x] 3.8 Seed kho tri thức từ `content/` (chạy lặp lại không lỗi); `audit_logs`
- [x] 3.9 Kiểm thử RLS tự động: ≥ 2 lớp × 2 GV × 3 HS, thiết bị thu hồi, ẩn danh chưa liên kết; CI quét bundle không chứa khóa secret

**Tệp/module dự kiến:** `supabase/{config.toml,migrations,tests}/`, `src/lib/supabase/*`, `src/proxy.ts`, `src/server/student-gateway/`, `src/app/join/**`, `src/app/teacher/classes/**`, `scripts/seed-*.ts`, `.env.example`.

**Tiêu chí nghiệm thu**

- [x] Migration áp dụng sạch trên CSDL mới; seed lặp lại không lỗi (máy dev + CI)
- [x] Kiểm thử RLS chứng minh bảo đảm then chốt của DATA_MODEL §7 và REDESIGN_ARCHITECTURE §8 cho mọi bảng R03
- [x] Quét QR → vào `/learn/me` trên Android Chrome và iPhone Safari (**giả lập Playwright** Pixel 7 / iPhone 13 — chưa thử máy thật); thu hồi có hiệu lực ở request kế tiếp
- [x] Mã thẻ không lưu dạng gốc; không khóa secret trong bundle; không dùng khóa `anon`/`service_role` cũ
- [x] Chỉ dữ liệu giả trong dev; không `.env` trong commit

**Kiểm thử bắt buộc:** bộ đầy đủ + RLS + test:e2e (route mới).
**Đầu ra:** CSDL dev có RLS, đăng nhập GV, liên kết thiết bị, quản lý đồng ý.

**Kết quả R03 (2026-10-20)** — chi tiết ở [REDESIGN_PROGRESS §4](REDESIGN_PROGRESS.md#4-việc-đã-làm-trong-r03):

- 3 migration (`supabase/migrations/20261020090*`): 16 bảng, RLS mọi bảng, chỉ policy SELECT; ghi qua 15 hàm `teacher_*` và 5 hàm `gateway_*`; Auth Hook chặn tự đăng ký (AD-54).
- Supabase local (Docker) — **chưa có dự án Cloud** (cần xác nhận tài khoản/tổ chức/region/chi phí).
- Giao diện: `/login`, `/join` (QR fragment + mã dự phòng), `/learn/me` (avatar, giảm chuyển động, âm thanh), `/teacher/classes`, `/teacher/classes/[id]` (đổi tên, tiến độ chương trình — chưa xác nhận, cờ bảng xếp hạng khóa, nhật ký), `/teacher/classes/[id]/students`, `…/students/[id]` (hồ sơ, trạng thái, lộ trình, alias + duyệt, đồng ý hai phạm vi, thẻ học + QR, thiết bị).
- Kiểm thử: pgTAP 36 · tích hợp CSDL 78 · unit 819 (781 cũ + 38 mới) · E2E 262 · E2E có CSDL 30 · CI job `database`.
- Chưa làm trong R03 (ghi rõ): Turnstile; dự án Cloud; cron dọn người dùng ẩn danh/thiết bị thu hồi; quên mật khẩu/MFA GV; giao diện quản trị cấp tài khoản GV, thêm GV cùng dạy; quy trình xóa dữ liệu học sinh; thông báo xử lý dữ liệu đã duyệt.

---

## R04 — Scoring Engine, điểm thưởng, mở khóa bản đồ (L) ✅

**Phụ thuộc:** R03 (CSDL, gateway), R02 (giao diện điểm/bản đồ).

Nhiệm vụ:

- [x] 4.1 `src/features/gamification/`: `rules.ts` (hằng số [GAMIFICATION_SPEC §1](docs/GAMIFICATION_SPEC.md#1-hằng-số-chính-thức), `SCORING_RULES_VERSION`), `apply.ts`, `unlocks.ts` (`tilesAllowed`, `canEnterGame`) — hàm thuần + unit test
- [x] 4.2 Migrations R04: bảng nội dung có phiên bản (`exercises`, `exercise_versions`, `exercise_items`, `content_reviews`), `practice_sessions`, `item_attempts` (cột mới), `question_instances`, `season_scores`, `point_events`, `map_tile_reveals`, `game_unlocks` + RLS + trigger chỉ phiên bản `approved`
- [x] 4.3 Hàm CSDL `private.record_graded_attempt` (khóa, lượt hợp lệ, sổ cái, sàn 0, chống trùng)
- [x] 4.4 Question Instance Service: lập buổi luyện (câu cố định theo ngữ cảnh), `view` không đáp án, chấm ở server bằng `runtime.ts`, `reveal` sau khi đóng
- [x] 4.5 API: `/api/student/home`, `practice-sessions`, `question-instances/{id}`, `.../attempts`, `map-tiles`
- [x] 4.6 Giao diện: ô điểm thật, "+10"/"−5" trung tính, khám phá thẻ bản đồ, khóa game theo ngưỡng, "Câu luyện thêm — không tính điểm"
- [x] 4.7 Đồng ý: chưa có `learning_data` → chơi thử không lưu

**Tệp/module dự kiến:** `src/features/gamification/*`, `src/server/{question-instances,scoring}/*`, `src/app/api/student/**`, `src/app/learn/**`, `supabase/migrations/*`, `supabase/tests/*`.

**Tiêu chí nghiệm thu**

- [x] Kiểm thử của [GAMIFICATION_SPEC §13](docs/GAMIFICATION_SPEC.md#13-kiểm-thử-bắt-buộc-khi-hiện-thực) xanh: mục 1–9 và 11 đầy đủ; mục 10 (reset) **mô phỏng** trạng thái CSDL sau reset (`SEASON_CLOSED`, buổi dở bị hủy, mùa mới tính điểm lại) — hàm reset thật thuộc R06
- [x] Payload câu trước khi đóng không chứa đáp án (unit 10 biến thể + E2E soát phản hồi API và HTML); `is_correct`/`points`/`balance`/`student_id`/`class_id` từ client → 400, không tạo điểm
- [x] Gửi lại/song song không nhân điểm; tải lại không đổi câu (tích hợp + E2E)
- [x] Phản hồi chấm đo thật: p95 **104 ms**, median 90 ms (216 request, `next start` + Supabase local cùng máy — chưa đo trên Cloud/4G)
- [x] Không câu chưa duyệt/chưa học nào được phát; dữ liệu "đã duyệt" chỉ là **fixture trong CSDL kiểm thử local** (gắn `test_fixture`, môi trường production từ chối)

**Kiểm thử bắt buộc:** bộ đầy đủ + RLS + tích hợp CSDL + test:e2e.
**Đầu ra:** luồng luyện → điểm → mở thẻ bản đồ chạy đầu–cuối trên CSDL dev.

**Kết quả R04 (2026-10-20)** — chi tiết ở [REDESIGN_PROGRESS §5](REDESIGN_PROGRESS.md#5-việc-đã-làm-trong-r04):

- 4.1: `apply.ts`, `score-types.ts`, `score-validation.ts`, `unlocks.ts` (chặn trên số thẻ), `game-world/map.ts` — [docs/SCORING_ENGINE.md](docs/SCORING_ENGINE.md).
- 4.2–4.3: 2 migration, 11 bảng mới (27 bảng `public`), `private.record_graded_attempt` + 4 hàm `gateway_*` mới — [docs/R04_DATABASE_MIGRATIONS.md](docs/R04_DATABASE_MIGRATIONS.md). `item_attempts` tạo mới (R03 chưa có bảng này).
- 4.4–4.5: Question Instance Service + 6 Route Handler `/api/student/**` — [docs/QUESTION_INSTANCE_SERVICE.md](docs/QUESTION_INSTANCE_SERVICE.md).
- 4.6: `/learn/me` (điểm thật, bản đồ 3 × 3, bốn khu vực "Mini-game đang phát triển"), `/learn/me/practice` — [docs/MAP_UNLOCK_ENGINE.md](docs/MAP_UNLOCK_ENGINE.md).
- 4.7: chưa có đồng ý `learning_data` → không lập buổi, không ghi điểm; dẫn tới chơi thử không lưu.
- Kiểm thử: unit 900 (819 + 81) · pgTAP 52 (36 + 16) · tích hợp CSDL 106 (78 + 28) · E2E 262 · E2E có CSDL 40 (30 + 10) · CI xanh.
- Chưa làm (ghi rõ): giao diện GV xem điểm (R05), reset mùa thật (R06), giới hạn câu tính điểm/ngày, gợi ý trước lượt đầu và "Cô làm mẫu" ở chế độ có điểm, âm thanh (R10), học liệu thật đã duyệt (R10).

---

## R05 — Leaderboard kiểu FIFA, avatar, ranking (M)

**Phụ thuộc:** R04.

- [x] 5.1 `ranking.ts` (`rankScores`, đồng hạng 1-2-2-4) + unit test
- [x] 5.2 Bộ avatar hình người có giấy phép (`src/features/avatars/catalog.ts` — danh mục trong mã, **không** bảng `avatar_options`, RD-R05-02), chọn avatar ở `/learn/me`
- [x] 5.3 `GET /api/student/leaderboard` (DTO không định danh, lọc điều kiện hiển thị, `private, no-store`)
- [x] 5.4 Giao diện bảng thanh ngang (`/learn/leaderboard`, `/teacher/classes/[id]/leaderboard`), chế độ TOP 10 + mình / toàn lớp, trình chiếu cho GV
- [x] 5.5 Bật/tắt bảng theo lớp với kiểm tra điều kiện ([PRIVACY_AND_SECURITY §5](docs/PRIVACY_AND_SECURITY.md#5-bảng-xếp-hạng-điều-kiện-bật-và-kiểm-soát-hiển-thị))

**Tệp/module dự kiến:** `src/features/gamification/ranking.ts`, `src/features/avatars/*`, `src/server/leaderboard/*`, `src/app/learn/leaderboard/**`, `src/app/teacher/classes/[classId]/leaderboard/**`, migration `avatar_options`.

**Tiêu chí nghiệm thu:** 8 kiểm thử của [LEADERBOARD_SPEC §11](docs/LEADERBOARD_SPEC.md#11-kiểm-thử-bắt-buộc) xanh; thiết bị lớp A không lấy được bảng lớp B; DTO không có `student_id`; 360 px không cuộn ngang; câu chữ không gây xấu hổ (unit test soát từ cấm).
**Kiểm thử bắt buộc:** bộ đầy đủ + RLS + test:e2e.
**Đầu ra:** bảng xếp hạng trong lớp (mặc định tắt), avatar.

**Nghiệm thu R05 (2026-10-21) — dựa trên GitHub Actions, đúng commit `83b34a7`** (không chạy lại bộ nặng ở máy cục bộ vì thiếu RAM):

| Hạng mục | Kết quả | Nơi chạy |
|---|---|---|
| Format, lint, typecheck, content check, build | ✅ PASS | CI [run 39514016955](https://github.com/ThaiTaka/ReadMateAI/actions/runs/39514016955) |
| Unit | ✅ 952/952 (40 tệp) | CI |
| Bundle không chứa secret | ✅ 55 tệp, 0 giá trị secret | CI |
| db:lint, pgTAP | ✅ pgTAP 65/65 | CI |
| Seed hai lần + tích hợp CSDL (RLS) | ✅ 129/129 (5 tệp) | CI |
| E2E thông thường (5 project) | ✅ chromium-desktop 69 · chromium-mobile 54 · webkit-desktop 61 · webkit-mobile 54 · webkit-tablet 24 đạt; 0 lỗi; bỏ qua có điều kiện theo kích thước màn hình | E2E [run 39514016837](https://github.com/ThaiTaka/ReadMateAI/actions/runs/39514016837) |
| E2E có CSDL (4 project) | ✅ chromium-desktop 22 · chromium-mobile 15 · webkit-mobile 15 · webkit-ipad 4 đạt; 0 lỗi | E2E |

Trợ năng (axe) và responsive nằm trong các spec trên nên đã chạy ở mọi project tương ứng.

---

## R06 — Vinh danh TOP 3, reset mùa giải (M)

**Phụ thuộc:** R05.

- [x] 6.1 Migrations: `honor_snapshots` (+ `honor_snapshot_entries`) **xong ở R06.1** (`20261023090000_r06_honors.sql`); `season_resets`, cột `final_rank`, hàm `private.reset_class_season` **xong ở R06.3** (`20261024090000_r06_season_reset.sql`) ([REDESIGN_ARCHITECTURE §7.3](docs/REDESIGN_ARCHITECTURE.md#73-reset-mùa-trong-một-giao-dịch))
- [x] 6.2 Server Actions: `createHonorSnapshot` (+ `setHonorsEnabled`, đọc/liệt kê ảnh chụp) **xong ở R06.1**; `resetSeason({classId, requestId, expectedSeasonId, confirmation})` **xong ở R06.3** (`src/server/teacher/season.ts`)
- [x] 6.3 Màn vinh danh TOP 3 → 2 → 1, hào quang TOP 1, Bỏ qua, Xem lại, giảm chuyển động, đồng hạng — **xong ở R06.2** (`/teacher/classes/[classId]/honors/[snapshotId]`, nút + lịch sử ở trang bảng điểm GV)
- [x] 6.4 Màn reset hai bước (gõ tên lớp) — **xong ở R06.4** (`season-reset.tsx`, unit + E2E `season-reset.spec.ts`; chờ CI)
- [x] 6.5 `GET /api/student/honors/latest` + chống tạo snapshot trùng (khóa ý định `requestId`, khóa lớp, khoảng chống lặp 15 giây) — **xong ở R06.5** (`20261025090000_r06_honor_dedupe.sql`; chờ CI)

**Tiêu chí nghiệm thu:** reset nguyên tử (lỗi giữa chừng → không thay đổi gì), lớp khác không đổi, dữ liệu học tập không đổi, gửi lại `requestId` không tạo mùa thứ ba, nộp vào mùa cũ → `SEASON_CLOSED`; ảnh chụp bất biến; chỉ GV có quyền.
**Kiểm thử bắt buộc:** bộ đầy đủ + RLS + tích hợp (song song reset/nộp đáp án) + test:e2e.
**Đầu ra:** vinh danh và mùa giải hoạt động trên CSDL dev.

---

## R07 — Mê cung kho báu, điều khiển nhân vật (L)

**Phụ thuộc:** R02 (lõi có thể bắt đầu sớm); R04 (lưu tiến độ, ngưỡng vào game).

- [x] 7.1 (xong, chờ CI — PROGRESS §5h) POC kết xuất (SVG/CSS) + đo FPS có CPU throttling + đo bundle route game (T-22, T-26); kiểm tra `npm view` nếu cần PixiJS
- [x] 7.2 (xong, chờ CI) `src/features/game-engine/core/` (types, grid, reducer, level-validate) + 24 unit test
- [x] 7.3 (xong) Lược đồ màn + 3 màn Mê cung trong `content/games/treasure-maze/levels/`; mở rộng `content:check` chạy `level-validate`
- [x] 7.4 (xong) Điều khiển: 4 nút mũi tên ≥ 64 px, phím mũi tên/WASD, giữ để đi, `aria-live`
- [x] 7.5a (xong, chờ CI — PROGRESS §5l) Migrations `game_runs` (+ RLS), RPC bắt đầu/tiếp tục/lưu vị trí (`state_version`), ngưỡng 50 điểm, reset mùa đóng lượt dở
- [x] 7.5b1 (xong, CI + E2E xanh trên `65328eb`) API Next.js `POST /api/student/game-runs` + `PATCH …/[runId]/position`
- [x] 7.5b2 (xong, chờ CI) Trang `/learn/me/games/treasure-maze` nối API: chọn hồ sơ, ngưỡng 50 điểm, `INSUFFICIENT_CONTENT` → bản thử nghiệm, tự lưu (5 bước/3 giây/tạm dừng/ẩn trang), khôi phục sau tải lại, `STATE_CONFLICT`/`SEASON_CLOSED`/mất mạng; ba mini-game còn lại "Sắp ra mắt"
- [x] 7.6 (xong, CI + E2E xanh trên `8701cfa` — PROGRESS §5n) Lớp phủ tạm dừng ("Chơi tiếp"/"Về bản đồ", focus + Esc + Tab vòng), rời màn chờ máy chủ xác nhận lưu (không hứa đã lưu), quay mặt mượt, đo FPS/bundle lại

**Tiêu chí nghiệm thu:** đi hết mê cung bằng nút và phím trên 5 cấu hình Playwright; tải lại giữ vị trí; không vào được khi < 50 điểm; mọi màn qua `level-validate`.
**Kiểm thử bắt buộc:** bộ đầy đủ + test:e2e + đo hiệu năng.
**Đầu ra:** Mê cung chơi được (chưa có quái vật).

---

## R08 — Quái vật, chạm trán bằng câu hỏi, giới hạn 7 encounters (L)

**Phụ thuộc:** R07, R04.

- [x] 8.1 Migrations `game_encounters` (check 1–7, unique, trigger chặn thứ 8), cột `run_id` của `question_instances` — 2026-10-22: schema + ràng buộc + RLS + reset; phân bổ thật ở 8.2 (REDESIGN_PROGRESS §5o)
- [x] 8.2 Bắt đầu lượt chơi phân bổ 7 chạm trán + 21 câu khác nhau từ bộ máy bài tập (`production`); thiếu → `INSUFFICIENT_CONTENT` — 2026-10-22: một giao dịch, CSDL kiểm lại kế hoạch của máy chủ, fixture riêng; production chưa có nội dung duyệt nên chưa tạo lượt thật (REDESIGN_PROGRESS §5p)
- [x] 8.3 API kích hoạt chạm trán, mở kho báu; HP trong `record_graded_attempt` — 2026-10-22: `gateway_activate_encounter`, nhánh `game_encounter` của `record_graded_attempt`, `gateway_open_treasure`, 3 API; chưa có UI (8.4)
- [x] 8.4 (2026-10-22, REDESIGN_PROGRESS §5r) Màn thử thách: quái vật thân thiện, 3 trái tim có nhãn chữ, Player GĐ4 nhúng; hoạt cảnh xuất hiện phép thuật, biến thành sao, bay đi ngủ; quay lại đúng vị trí
- [x] 8.5 (phần kỹ thuật, 2026-10-23, REDESIGN_PROGRESS §5s) Bộ soát lộ đáp án cho tên/lời thoại quái vật; asset quái vật có giấy phép — **GV CHƯA duyệt/xem phác thảo**: `review: pending_review`, `teacherReviewed: false`, phiếu `docs/reviews/R08_MONSTER_REVIEW.md` chưa có chữ ký. Ô này đánh dấu phần kỹ thuật; **đóng hoàn toàn khi GV xác nhận**
- [x] 8.6 (2026-10-25, REDESIGN_PROGRESS §5t) Chơi lại màn đã hoàn thành không tính điểm: `game_runs.is_replay`, 7 chạm trán + 21 câu `GAME_REPLAY`, điểm/sổ cái/mở khóa không đổi, HP đúng/sai, khôi phục, kho báu, hai tab, reset mùa

**Tiêu chí nghiệm thu:** không thể tạo chạm trán thứ 8 (kiểm thử CSDL); đúng 3 câu riêng biệt mỗi chạm trán; đúng → +10 & HP−1, sai → −5 & HP giữ; hết câu → `undefeated`, không câu thay thế; kho báu chỉ mở khi 7/7; tạm dừng/thoát không trừ điểm.
**Kiểm thử bắt buộc:** bộ đầy đủ + RLS + tích hợp + test:e2e + axe.
**Đầu ra:** Mê cung kho báu hoàn chỉnh.

---

## R09 — Ba mini-game còn lại (L) — ⏸ TẠM HOÃN SAU KHI NỘP DỰ ÁN

> Quyết định chủ dự án 2026-10-21: không bắt đầu R09 trước ngày nộp; giữ nguyên nội dung kế hoạch bên dưới. Trong lúc hoãn, `/learn/me` ghi "Sắp ra mắt" cho ba game này và không có đường vào.

**Phụ thuộc:** R08.

- [ ] 9.1 Rừng chữ kỳ diệu (≥ 120 điểm), Đảo dấu thanh (≥ 200), Lâu đài ghép vần (≥ 300) dùng chung Game Engine
- [ ] 9.2 Luật di chuyển riêng (lối mòn, đảo, tầng) + dữ liệu màn + `level-validate` mở rộng
- [ ] 9.3 Ánh xạ dạng bài theo game ([GAME_DESIGN §6](docs/GAME_DESIGN.md#6-ba-mini-game-tiếp-theo)); tối đa 7 thử thách × 3 câu
- [ ] 9.4 Asset có giấy phép; đo bundle mỗi game

**Tiêu chí nghiệm thu:** cùng bộ kiểm thử R08 cho mỗi game; ngưỡng vào đúng; ≤ 7 thử thách; bundle trong ngân sách.
**Kiểm thử bắt buộc:** bộ đầy đủ + test:e2e.
**Đầu ra:** bốn mini-game.

---

## R10 — Audio Engine, kiểm duyệt học liệu, trải nghiệm học tại nhà (L)

**Phụ thuộc:** R03, R04. **Có thể chạy song song từ sau R04.** **Điều kiện trước:** quyết định nhà cung cấp TTS (được phép tạo tài khoản thử nghiệm), GV sẵn sàng ghi âm âm/vần (Q-03), GV trả lời Q-01/Q-02.

- [x] 10.1 (2026-10-26) `docs/AUDIO_ENGINE.md`, `docs/AUDIO_RECORDING_PLAN.md`, adapter `TtsProvider` + test. **POC bằng API thật CHƯA làm** (chờ khóa được cấp phép) — so sánh dựa trên tài liệu chính thức; GV chưa nghe giọng nào
- [x] 10.2 (2026-10-27, **hoàn thành về kỹ thuật; chưa nghiệm thu với GV thật**) Ghi âm/tải tệp của GV ở `/teacher/audio` (route duy nhất bật microphone); quy trình duyệt bản ghi; bucket Storage riêng tư; đồng ý dùng giọng; kiểm thử dữ liệu giả — [AUDIO_ENGINE §12](docs/AUDIO_ENGINE.md), [TEACHER_AUDIO_GUIDE](docs/TEACHER_AUDIO_GUIDE.md). Không bản ghi thật/đã duyệt nào
- [ ] 10.3 Phát âm thanh thật trong Player theo chính sách AD-35 (thay `AudioSlot` khóa); mở khóa âm thanh iOS; âm thanh mẫu chỉ sau khi chấm
- [ ] 10.4 Giao diện soạn/duyệt nội dung (6 khuôn, báo cáo kiểm tra, phiên bản bất biến) — trước đây GĐ6
- [ ] 10.5 Góc phụ huynh: tóm tắt buổi luyện, giải thích điểm thưởng không phải điểm đánh giá
- [ ] 10.6 Phân hóa: mastery, Leitner, mức hỗ trợ tự điều chỉnh (trước đây GĐ7) — tách nhỏ nếu cần
- [ ] 10.7 Dashboard GV cơ bản (trước đây GĐ9): ai chưa luyện, lỗi phổ biến, mức hỗ trợ — không dùng điểm thưởng để đánh giá

**Tiêu chí nghiệm thu:** E2E chứng minh bài đọc (dạng 5, 6) không phát âm thanh chữ/từ/câu trước khi chấm; âm/vần đơn lẻ dùng bản ghi GV; không thể sửa phiên bản đã gửi duyệt; nội dung chưa duyệt không xuất hiện trong buổi luyện/game.
**Kiểm thử bắt buộc:** bộ đầy đủ + RLS + test:e2e.
**Đầu ra:** âm thanh hoạt động, thư viện nội dung đã duyệt, góc phụ huynh, dashboard cơ bản.

---

## R11 — Kiểm thử tổng thể, bảo mật, responsive, deploy Vercel (M–L)

**Phụ thuộc:** R02–R08 và R10 (R09 hoãn sau khi nộp). **Điều kiện trước:** chủ dự án cho phép liên kết/deploy Vercel; xác nhận điều khoản gói (R-02); dự án Supabase prod (Pro) nếu thí điểm; rà soát pháp lý ([PRIVACY_AND_SECURITY §12](docs/PRIVACY_AND_SECURITY.md#12-danh-mục-kiểm-tra-trước-khi-bật-cho-học-sinh-thật)).

- [ ] 11.1 Xóa mã luồng cũ có kiểm soát ([PRODUCT_REDESIGN §5](docs/PRODUCT_REDESIGN.md#5-kiểm-kê-mã-cũ-và-phương-án-loại-bỏ-an-toàn)) cùng test tương ứng
- [ ] 11.2 Rà soát bảo mật: RLS, gateway, header (xem lại CSP nonce — R-16), phụ thuộc, quét secret toàn lịch sử
- [ ] 11.3 Kiểm thử tải nhẹ (40 HS × một lớp, nộp đồng thời); kiểm thử reset dưới tải
- [ ] 11.4 Responsive và trợ năng toàn bộ (Android, iPhone, iPad, laptop, desktop); giảm chuyển động
- [ ] 11.5 Liên kết Vercel (Node 24.x, `sin1`), biến môi trường theo môi trường, Preview chỉ CSDL dev + Deployment Protection; cron lưu giữ/xóa
- [ ] 11.6 Smoke test production; diễn tập khôi phục sao lưu; hướng dẫn GV và phụ huynh
- [ ] 11.7 Merge vào `main` **chỉ khi được phép**

**Tiêu chí nghiệm thu:** không phát hiện bảo mật mức cao chưa xử lý; production ở `sin1` + Supabase Singapore; smoke test xanh; danh mục kiểm tra trước khi bật cho học sinh thật đủ dấu; cờ bảng xếp hạng chỉ bật được khi có chấp thuận.
**Kiểm thử bắt buộc:** toàn bộ, kể cả E2E trên Preview.
**Đầu ra:** bản triển khai sẵn sàng thí điểm.

---

## Đối chiếu với lộ trình cũ (TASKS.md)

| GĐ cũ | Nội dung | Trong lộ trình mới |
|---|---|---|
| GĐ5 | Supabase, RLS, xác thực | R03 |
| GĐ6 | Soạn & duyệt nội dung, âm thanh | R10 (âm thanh, giao diện duyệt) |
| GĐ7 | Giao bài, luyện tại nhà, lưu kết quả, phân hóa | R04 (buổi luyện, lưu kết quả), R10 (phân hóa) — giao bài theo nhóm gộp vào lập buổi luyện theo nhóm |
| GĐ8 | Phiếu PDF + tự lực tại lớp | **Bỏ khỏi lộ trình** (AD-51) |
| GĐ9 | Dashboard GV | R10.7 (cơ bản), R05 (bảng điểm) |
| GĐ10 | Sẵn sàng thí điểm, production | R11 |
| GĐ11 | AI hỗ trợ tạo bài | Sau R11 (giữ thiết kế AD-12) |
