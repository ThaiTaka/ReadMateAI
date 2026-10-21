| 2026-10-21 | R06.4 | R06 | Giao diện reset hai bước (BẮT ĐẦU MÙA MỚI → gõ tên lớp), requestId một lần mỗi lần mở, SEASON_MISMATCH/CONFIRMATION_MISMATCH, `season.id` từ máy chủ; unit +9, E2E season-reset 9/9 local (3 project). Không làm R06.5 |
# REDESIGN_PROGRESS — Tiến độ tái cấu trúc ReadMate AI

> **Cập nhật lần cuối:** 2026-10-21 — Phiên Claude Code R07.1 (nghiệm thu R06 + nguyên mẫu Mê cung kho báu)
> Đọc tệp này **đầu tiên** ở mỗi phiên của lộ trình R (sau đó [REDESIGN_TASKS.md](REDESIGN_TASKS.md) và tài liệu liên quan). Lịch sử GĐ1–GĐ4 vẫn ở [PROGRESS.md](PROGRESS.md).

## 1. Trạng thái hiện tại

- **R07.2 xong: lõi Game Engine thuần TS `src/features/game-engine/core/` (24 unit test); chờ CI — §5i.**
- (trước đó) **R06 đã nghiệm thu (CI + E2E xanh trên `ebb027a`); R07.1 (nguyên mẫu đồ họa Mê cung) xong, CI + E2E xanh trên `d912a56` — §5h.**
- (trước đó) **R06.5 xong: API `GET /api/student/honors/latest` + khóa ý định chống snapshot trùng — §5g. Sẵn sàng nghiệm thu R06 khi CI xanh.**
- **Giai đoạn trước: R06.4 — giao diện reset điểm hai bước (nghiệm thu: CI + E2E xanh trên `a918a56`).** Chi tiết §5f. R06.3 (backend reset) đã nghiệm thu: CI + E2E 9/9 xanh trên `17146c0`. Tiếp theo: R06.5 (API học sinh xem lần vinh danh gần nhất, rà chống snapshot trùng, nghiệm thu R06).
- **Giai đoạn trước:** R05 — Ranking Engine, bảng xếp hạng lớp, avatar → **hoàn thành, nghiệm thu bằng GitHub Actions trên commit `83b34a7`** (§5b). Cờ hệ thống bảng xếp hạng vẫn **tắt**. Không tự chuyển sang R06.
- (R04 trước đó: Scoring Engine, chấm bài ở máy chủ — hoàn thành trên Supabase LOCAL, đã được chấp nhận.)
- **Nhánh làm việc:** `feature/home-learning-redesign` — 3 checkpoint R04 + commit tài liệu đã push, GitHub Actions xanh (cả job `database`) — xem §5.3. `main` **không đổi**, không merge.
- **Mã nguồn:** R04 thêm 2 migration (11 bảng mới — 27 bảng), hàm ghi điểm một giao dịch, Question Instance Service, 6 API `/api/student/**`, `/learn/me` với điểm thật + bản đồ khám phá + bốn khu vực, `/learn/me/practice` (buổi luyện có điểm). Điểm thật **chỉ chạy với nội dung fixture kiểm thử hư cấu** trên Supabase local (kho thật 0 mục đã duyệt). `/learn` và `/demo` vẫn là bản minh họa.
- **Dịch vụ:** Supabase **local (Docker)**; **Supabase Cloud chưa tạo**. Vercel chưa liên kết; không AI, không TTS.

| R | Trạng thái |
|---|---|
| R01 | ✅ Đã chấp nhận (2026-10-20) |
| R02 | ✅ Đã chấp nhận (2026-10-20) |
| R03 | ✅ Đã chấp nhận (2026-10-20) |
| R04 | ✅ Hoàn thành (local) |
| R05 | ✅ Hoàn thành — nghiệm thu bằng CI (§5b), chờ người điều phối duyệt |
| R06 | ✅ Nghiệm thu (CI `39533560083`, E2E `39533560105`) |
| R07 | 🔄 R07.1, R07.2 xong (nguyên mẫu đồ họa, lõi engine) |
| R08–R11 | ⏸ Chưa bắt đầu ([REDESIGN_TASKS](REDESIGN_TASKS.md)) |

### 1.1 Trạng thái khi bắt đầu R02 (kiểm tra thật, 2026-10-20)

| Hạng mục | Kết quả |
|---|---|
| Thư mục `D:\ReadMateAI` | Đang ở `main` @ `0806c3d` (không phải nhánh R01), **có công việc chưa commit**: 25 tệp sửa + 1 tệp xóa + thư mục mới `src/features/audio`, `src/app/teacher/audio`, `scripts/audio`, `content/audio/manifest.json`, `public/audio/tts/*.mp3` (46 tệp, Piper `vi_VN-vais1000-medium`, ghi là CC-BY-4.0), `.vscode/`. Thời điểm tệp 2026-10-16 16:45–17:05 — đây chính là công việc GĐ5/"Prompt 05" (âm thanh) mà R01 ghi "không tìm thấy" (RQ-06) |
| Xử lý | **Không** đưa vào R02, **không** push: lưu nguyên trạng vào nhánh **cục bộ** `local/gd5-audio-wip` (commit `b5bf2de`), rồi chuyển sang `feature/home-learning-redesign` (theo dõi `origin`, @ `6395d02`). Working tree sạch trước khi làm R02. Cần người điều phối quyết định (RQ-06) |
| Baseline (trên `6395d02`) | `test:run` 24 tệp, **729/729** ✅ |
| `user.email` cục bộ | Email `noreply` của GitHub ✅ |

## 2. Trạng thái khi bắt đầu R01 (kiểm tra thật, 2026-10-16)

| Hạng mục | Kết quả |
|---|---|
| Thư mục | `D:\ReadMateAI` — **bản clone mới** từ GitHub lúc 17:12 (reflog chỉ có `clone`); không có worktree khác, không stash |
| Nhánh / commit | `main` @ `0806c3d` = `origin/main`; trên GitHub chỉ có nhánh `main` |
| Tệp chưa commit | `docs/BaoCao_ReadMateAI.pdf`, `docs/LuongHoatDong_ReadMateAI.pdf` (chưa theo dõi; do phiên Claude trước trong thư mục này tạo — báo cáo tổng quan và luồng hoạt động theo định hướng cũ; không secret, không dữ liệu học sinh). 5 blob mồ côi trong `.git` đều là các phiên bản cũ của 2 PDF này |
| Công việc GĐ5 / "Prompt 05" (âm thanh + Vercel) | **Không tìm thấy**: không có tệp, nhánh, commit, stash, blob hay transcript nào; `PROGRESS.md` ghi GĐ5 "chưa bắt đầu"; `docs/AUDIO_ENGINE.md` không tồn tại. Phiên duy nhất khác của thư mục này chỉ tạo 2 PDF. Nếu phiên GĐ5 chạy ở máy/phiên cloud khác, công việc đó **chưa được push** nên không khôi phục được từ đây (RQ-06) |
| Vercel | Không `.vercel/`; GitHub: 0 deployment, 0 environment, 0 webhook → chưa liên kết |
| Supabase | Không thư mục `supabase/`, không `.env*` (chỉ `.env.example`) → chưa tạo |
| Cấu hình git cục bộ | Bản clone mới **mất** `user.email` `noreply` cục bộ (Q-13) → đã đặt lại ở cấp repo (không đụng cấu hình toàn cục) |
| GitHub Actions | 3 run gần nhất trên `main` đều xanh; workflow chỉ chạy trên push `main` và pull request |

Baseline (chạy thật trước khi sửa): `format:check` ✅ · `lint` ✅ · `typecheck` ✅ · `content:check` ✅ 0 lỗi, 33 cảnh báo · `test:run` ✅ 24 tệp, 729/729 · `build` ✅ 7 route tĩnh.

### 2.1 Việc đã làm trong R01

1. Kiểm tra trạng thái (§2), đọc toàn bộ CLAUDE.md, TASKS, PROGRESS, PRD, ARCHITECTURE, DATA_MODEL, VIETNAMESE_ENGINE, EXERCISE_ENGINE, README và 2 PDF.
2. Tạo nhánh `feature/home-learning-redesign`; checkpoint 2 PDF (`6eca037`).
3. Phát hiện 2 mâu thuẫn với quy tắc BẮT BUỘC của CLAUDE.md và **hỏi người điều phối** (theo CLAUDE.md đầu tệp): bảng xếp hạng vs §6.4; −5 điểm vs §7.10. Người điều phối chọn phương án có điều kiện (RD-01, RD-02).
4. Tra phiên bản thư viện game ứng viên bằng `npm view` (không cài): phaser 4.2.1, pixi.js 8.22.0, @pixi/react 8.0.5, motion 14.3.0, kaplay 3001.0.19, lottie-web 5.13.0, @rive-app/react-canvas 4.36.0.
5. Tạo tài liệu (đều **PLANNED**): `docs/PRODUCT_REDESIGN.md`, `docs/GAMIFICATION_SPEC.md`, `docs/GAME_DESIGN.md`, `docs/LEADERBOARD_SPEC.md`, `docs/REDESIGN_ARCHITECTURE.md`, `docs/PRIVACY_AND_SECURITY.md`, `REDESIGN_TASKS.md`, tệp này.
6. Cập nhật: `CLAUDE.md` (định hướng, quy trình đọc tài liệu, §6.4 và §7.10 thành ngoại lệ có điều kiện, §9.4 quy tắc gamification, thuật ngữ), `PROGRESS.md`, `TASKS.md`, `README.md`, `docs/PRD.md` (v0.3), `docs/ARCHITECTURE.md` (v0.5), ghi chú đầu `docs/DATA_MODEL.md` và `docs/EXERCISE_ENGINE.md`.

## 3. Việc đã làm trong R02

1. **Design system** "Modern 2D Educational Adventure" ([docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md)): token `jade`/`magic`/`deep`/`sun-600`, `radius-world`, bóng "khối" `shadow-press-*`, `shadow-world`, 8 hoạt cảnh; `[data-motion="reduce"]` trong `globals.css`; tiện ích `origin-fill`.
2. **Thành phần** `src/components/adventure/`: AdventureButton/Link, GameCard, LockedGameCard, WorldMapCard, GameWorldMap, ScoreBadge (+StarMark), ProgressBar, AvatarFrame, AchievementBadge, HeartIndicator, GameWorldHeader, CharacterPreview, MilestoneTrail, LeaderboardPreview, AdventureDialog (`<dialog>` gốc), MotionScope/MotionToggle, PreviewRibbon; `ui/coming-soon-state.tsx`.
3. **Asset SVG tự vẽ** `src/components/art/` (22 dòng giấy phép, tất cả `pending_review`): Bạn nhỏ thám hiểm, Cú Bông, Bé Mây Bông, 5 avatar, rương kho báu, bục vinh danh, 4 cảnh game, bản đồ thế giới, phông cảnh trang chủ, 8 ô mốc + ô sương ([docs/ASSET_MANIFEST.md](docs/ASSET_MANIFEST.md)). `content/media/licenses.json` + `src/features/media/license-validation.ts` chạy trong `content:check`. Gỡ `mascot-owl.tsx`, `syllable-builder-art.tsx`.
4. **Miền/dữ liệu**: `features/gamification/rules.ts` (hằng số GAMIFICATION_SPEC §1, `SCORING_RULES_VERSION = "r1"`) + `unlocks.ts` (`tilesAllowed`, `milestoneProgress`, `canEnterGame`, `gameUnlockStates`); `features/game-world/catalog.ts`; `features/avatars/catalog.ts`; `features/demo/adventure-data.ts` (Mây, 135 điểm; huy hiệu; bảng xếp hạng hư cấu Bống/Mây/Na/Tí/Bin).
5. **Trang**: `/` viết lại (thông điệp mới, ba bước, ba lộ trình, Game World, công cụ GV, an toàn); `/learn` thành Student Adventure Dashboard + Game World + mốc khám phá + huy hiệu + công tắc giảm chuyển động; `/demo` thêm xem trước Game World, bảng xếp hạng minh họa, lời nhắc điểm minh họa và nút "Về Game World" ở màn kết quả; `/teacher` menu 9 mục + phần Duyệt học liệu (bộ phác thảo), Bảng điểm, Vinh danh, Mùa thi đua, Cài đặt ("Sắp có – Đang phát triển", không nút reset).
6. **Gỡ luồng cũ khỏi giao diện (AD-51)**: H0 "Tự làm"; `layout` `paper_like` → `focused`; bỏ prop `paperLike`, cờ `classroomLike` → `independent`; `practice-data.ts` không còn gọi `generateHomeClassPair`; `results-panel.tsx` chỉ hiện chỉ số đo trong ứng dụng; `vi.ts` viết lại (nhánh `practice.worksheet` giữ cho mã ngừng dùng). Mã phiếu/cặp nhà–lớp **giữ nguyên** kèm test (xóa ở R11).
7. **Metadata**: `site.ts` (mô tả, tagline, keywords, themeColor), Open Graph (không url/ảnh — chưa có tên miền), `package.json` `description`.
8. **CI**: `.github/workflows/ci.yml` thêm `push: feature/**` (quyền `contents: read`).
9. **Kiểm thử**: unit mới `gamification/unlocks`, `redesign-copy`, `adventure-components`, `media-licenses`, `game-world-data`; E2E mới `game-world.spec.ts` (thẻ khóa/mở, bảng chi tiết, Esc + trả focus, bàn phím, giảm chuyển động theo công tắc và theo hệ điều hành, không request/không bộ nhớ trình duyệt, điều hướng đáy, axe, 6 cỡ màn hình 360→1440 kèm ảnh chụp). Cập nhật test cũ do đổi định hướng chính thức (xem §3.2).
10. **Hiệu năng** (đo khung hình WebKit của Playwright trên Windows — vẽ bằng CPU): bỏ `filter: blur` lớn (thay bằng gradient tỏa tròn), cảnh trong thẻ và bản đồ lớn mặc định **tĩnh** (`animated` = false), cú trên `/learn` nhún bằng một lớp HTML. Kết quả: `/`, `/demo`, `/teacher` ≈ 16 ms/khung; `/learn` 55 → 36 ms/khung (phần còn lại do bóng đổ lớn — xem rủi ro RR-11).

### 3.1 Kết quả kiểm tra cuối R02 (chạy thật 2026-10-20)

| Lệnh | Kết quả |
|---|---|
| `npm run format:check` | ✅ |
| `npm run lint` | ✅ 0 lỗi |
| `npm run typecheck` | ✅ |
| `npm run content:check` | ✅ 0 lỗi, 52 cảnh báo (33 cũ của kho tri thức + 19 asset chờ GV duyệt) |
| `npm run test:run` | ✅ 29 tệp, **781/781** (729 cũ + 52 mới; 9 test cũ được cập nhật nội dung) |
| `npm run build` | ✅ 7 route tĩnh |
| `npm run test:e2e` | ✅ **254 đạt, 0 lỗi, 56 bỏ qua theo thiết kế** (test chỉ dành cho desktop/điện thoại; bố cục 6 cỡ chỉ chạy ở 2 cấu hình desktop) — 5 cấu hình: Chromium/WebKit × desktop/điện thoại + iPad |
| GitHub Actions | ✅ Run [39357778681](https://github.com/ThaiTaka/ReadMateAI/actions/runs/39357778681) — sự kiện `push` trên `feature/home-learning-redesign` (lần đầu workflow chạy cho nhánh tính năng), commit `8b178be`: format, lint, typecheck, content:check (0 lỗi), unit 29 tệp, build — **success** |
| JS (gzip, bản production) | `/` 199,5 KB · `/learn` **201,0 KB** · `/demo` **227,3 KB** (GĐ4: ≈ 228 KB) · `/teacher` 189,4 KB. Khung Next + React ≈ 189 KB; ngân sách route học sinh ≈ 200 KB → `/learn` vượt ≈ 1 KB, `/demo` vượt như GĐ4 (R-26). Hình SVG là Server Component nên không vào JS; HTML `/learn` 48 KB gzip |

### 3.2 Test cũ được cập nhật vì định hướng thay đổi chính thức (không xóa test nào)

| Test | Trước | Sau (R02) |
|---|---|---|
| `strings.test.ts` — khẩu hiệu | "Mỗi em một nhịp đọc – …" | "Học Tiếng Việt, khám phá thế giới kỳ diệu" + tagline |
| `leaks-audio.test.ts` — bố cục H1/H0 | `paper_like` | `focused`; H0 tên "Tự làm" |
| `exercises/ui.test.tsx` — H0 | "Giống phiếu ở lớp" hiện | "H0 – Tự làm" hiện; không có chữ phiếu/lớp |
| `catalog.test.ts` — buổi luyện mẫu | kết thúc `classroom_like` | kết thúc `independent` |
| `pages.test.tsx` | thông điệp/heading cũ, 4 công cụ GV, /learn "Chào con!" + nút Bắt đầu khóa | thông điệp mới, 5 công cụ GV, /learn "Chào Mây!" + nhãn minh họa; thêm test sidebar, xem trước Game World |
| E2E `fixtures.ts`, `navigation.spec.ts`, `responsive.spec.ts`, `demo-practice.spec.ts` | h1 cũ, "Bản demo", nút Bắt đầu ở /learn, "Cần GV ghi nhận ở lớp" | h1 mới, "Chơi thử", nút Luyện bài/Xem chi tiết ≥ 64 px, không còn chữ "ở lớp/phiếu" + lời nhắc điểm minh họa; WebKit đánh dấu `slow` cho luồng nhiều câu (CPU rendering) |

### 3.3 Lựa chọn mặc định (chưa phải phê duyệt cuối cùng)

- **RQ-02:** H0 tạm gọi **"Tự làm"**.
- **RQ-M1:** nhân vật/quái vật/avatar là phác thảo thân thiện, trạng thái **chờ GV duyệt** (`pending_review`).
- **RQ-M2:** SVG/vector **tự vẽ**, không mua asset, không dùng dịch vụ tạo ảnh.

## 4. Việc đã làm trong R03

### 4.1 Trạng thái khi bắt đầu R03 (kiểm tra thật, 2026-10-20)

| Hạng mục | Kết quả |
|---|---|
| Git | `feature/home-learning-redesign` @ `b65eb56` = origin, working tree sạch; `user.email` cục bộ = noreply ✅ |
| Nhánh Audio WIP | `local/gd5-audio-wip` @ `b5bf2de` còn nguyên — **không đụng tới**, không push, không cherry-pick; rà soát để tích hợp ở R10 (RQ-06) |
| Node / npm / gh | 24.18.0 / 11.16.0 / 2.100.0 |
| Docker | Desktop đã cài, daemon **dừng** → đã khởi động Docker Desktop trên máy (29.5.3) |
| Supabase / Vercel | Không `supabase/`, không dự án Cloud; Vercel CLI chưa cài (`npm view vercel` 64.7.0 — không dùng ở R03) |
| Thư viện | `npm view`: supabase-js 2.118.0, ssr 0.12.7, CLI 2.121.0 (cài đúng các bản này, ghim chính xác) |

### 4.2 Công việc

1. **Supabase local**: `supabase init` + `config.toml` có chú thích (không tự lộ bảng, ẩn danh bật, hook chặn đăng ký, mật khẩu ≥ 10 ký tự, tắt dịch vụ chưa dùng). Phát hiện khi kiểm thử: tắt signup chặn cả người dùng ẩn danh; tắt email signup tắt cả đăng nhập email → chuyển sang Auth Hook (AD-54).
2. **Migrations**: `20261020090000_r03_foundation` (16 bảng, helper RLS, trigger bất biến, policy SELECT, GRANT tường minh), `…090100_r03_functions` (15 hàm `teacher_*`, 5 hàm `gateway_*`, audit cùng giao dịch), `…090200_r03_signup_guard` (hook). `supabase db lint` 0 vấn đề.
3. **Next 16**: `src/proxy.ts` (getClaims, chuyển hướng thô), `lib/supabase/{env,cookie-options,server,admin,proxy}.ts`, kiểu sinh `database.types.ts`; DAL `server/auth/teacher.ts`, `server/student-gateway/session.ts`.
4. **Đăng nhập GV** `/login` + đăng xuất, giới hạn tần suất theo IP/email (HMAC). **Thẻ học** `/join`: QR fragment + mã dự phòng, HMAC + pepper, liên kết trong một giao dịch có khóa dòng. **`/learn/me`**: hồ sơ đã liên kết, chọn avatar, giảm chuyển động (áp dụng ngay), âm thanh (lưu), chọn hồ sơ khi một máy có nhiều em; `/learn` (minh họa) có lối vào "Đã có thẻ học? Vào trang của con".
5. **Khu vực GV**: danh sách/tạo lớp; chi tiết lớp (đổi tên — owner, tiến độ chương trình "Chưa xác nhận" với nút xác nhận khóa khi không phải bộ sách thật đã duyệt, cờ bảng xếp hạng/vinh danh khóa, nhật ký — owner); học sinh (thêm, biệt danh, số thứ tự, avatar, trạng thái, lộ trình — không gán sẵn, tên hiển thị + duyệt, đồng ý hai phạm vi ba trạng thái, thẻ học + QR hiện một lần, thiết bị + thu hồi). Sidebar: tên GV + đăng xuất; "Lớp học", "Học sinh" hoạt động.
6. **Kho tri thức → CSDL**: `scripts/lib/content-sync.ts` (chỉ chạy khi `content:check` 0 lỗi; trạng thái duyệt giữ nguyên; phiên bản theo băm; upsert lặp lại được; mục mất → `retired`). 376 đơn vị, 1 chuỗi minh họa (17 bài), **0 mục approved**.
7. **Seed** `npm run db:seed`: 1 trường, 2 GV, 2 lớp × 3 HS (hư cấu), đồng ý ở các trạng thái, lộ trình (có em chưa xếp), alias duyệt/chờ, thiết bị đang liên kết/đã thu hồi/chưa có; chạy 2 lần không sinh trùng.
8. **Điểm nối R04**: `getStudentLearningContext` (chỉ máy chủ — chứa nhóm năng lực); `canUseProductionContent` chỉ true khi tiến độ `confirmed` + đồng ý `learning_data` + có lộ trình.
9. **Kiểm thử mới**: pgTAP 36 (`supabase/tests/database`), tích hợp CSDL 78 (`tests/db`, JWT thật), unit 38 (`tests/unit/accounts`), E2E có CSDL 30 (`tests/e2e-db`: Chromium + Pixel 7 + iPhone 13, axe, 6 cỡ màn hình, ảnh chụp ở `test-results/db/` — không commit), quét bundle `npm run check:bundle`.
10. **CI**: job `database` (db:start → db:lint → db:test → db:env + db:seed ×2 → test:db); bước `check:bundle` trong job `verify`.
11. **Tài liệu**: tạo `docs/AUTHENTICATION.md`, `docs/SUPABASE_SETUP.md`, `docs/RLS_SECURITY.md`, `docs/STUDENT_ACCESS.md`; cập nhật CLAUDE.md, REDESIGN_ARCHITECTURE (§4.2, AD-54 → AD-57), DATA_MODEL, PRIVACY_AND_SECURITY, ARCHITECTURE §3, README, TASKS, PROGRESS, REDESIGN_TASKS, `.env.example`.

### 4.3 Kết quả kiểm tra cuối R03 (chạy thật 2026-10-20)

| Lệnh | Kết quả |
|---|---|
| `npm run format:check` · `lint` · `typecheck` | ✅ · ✅ 0 lỗi · ✅ |
| `npm run content:check` | ✅ 0 lỗi, 52 cảnh báo (như R02) |
| `npm run test:run` | ✅ 31 tệp, **819/819** (781 cũ + 38 mới) |
| `npm run build` | ✅ 14 route (trang GV và `/learn/me` là Partial Prerender) |
| `npm run check:bundle` | ✅ 49 tệp tĩnh, không khóa secret, không giá trị secret của môi trường (bundle không chứa cả URL Supabase) |
| `npm run test:e2e` | ✅ **262 đạt, 0 lỗi, 56 bỏ qua theo thiết kế** (5 cấu hình) |
| `npm run db:lint` | ✅ 0 vấn đề |
| `npm run db:test` (pgTAP) | ✅ 2 tệp, **36/36** |
| `npm run db:seed` ×2 sau `supabase db reset` | ✅ không lỗi, không trùng |
| `npm run test:db` | ✅ 3 tệp, **78/78** |
| `npm run test:e2e:db` | ✅ **30 đạt, 12 bỏ qua theo thiết kế** (đo bố cục chỉ ở chromium-desktop) |
| GitHub Actions | ✅ Run [39381461701](https://github.com/ThaiTaka/ReadMateAI/actions/runs/39381461701) (checkpoint `4e5bb6a`): `verify` + `database` success · Run [39383193222](https://github.com/ThaiTaka/ReadMateAI/actions/runs/39383193222) (tài liệu `e04686b`): cả hai job success |

### 4.4 Sự cố gặp và cách xử lý

| Sự cố | Xử lý |
|---|---|
| Tắt signup / email signup làm hỏng ẩn danh hoặc đăng nhập GV | Auth Hook `before_user_created` (AD-54); kiểm chứng: đăng ký email → 403, ẩn danh OK, Admin API OK |
| `Date.now()` trong `getClaims()` lúc Partial Prefetching dựng trước | `await connection()` đầu DAL phiên |
| Safari/WebKit bỏ cookie `Secure` trên http 127.0.0.1 | Chỉ bỏ `Secure` khi site là http localhost (`cookie-options.ts`, có unit test) |
| Ghi chú rỗng vi phạm ràng buộc văn bản | Hàm CSDL coi chuỗi rỗng là `null` |
| Công cụ ghi tệp giải mã chuỗi thoát → ký tự ẩn thật trong migration/test/tài liệu | Viết lại bằng `String.fromCharCode(92)`; quét byte mọi tệp mới (0 ký tự đặc biệt thật); pgTAP thêm ca U+00AD và ký tự điều khiển |
| `notFound()` trong phần stream trả HTTP 200 | Kiểm tra nội dung "Không tìm thấy trang" (đặc điểm streaming của Next) |
| Tài liệu Next nêu `unstable_doesProxyMatch` nhưng bản 16.4.0 chỉ có `unstable_doesMiddlewareMatch` | Dùng tên có thật, ghi chú trong test |

### 4.5 Test cũ được cập nhật vì hành vi đổi chính thức (không xóa test nào)

| Test | Trước | Sau (R03) |
|---|---|---|
| `pages.test.tsx` /teacher | "chưa được bảo vệ bằng tài khoản", nút "Tạo lớp mới" khóa | "Chỉ giáo viên đã đăng nhập…", liên kết "Mở danh sách lớp" → `/teacher/classes`; vẫn không có nút đặt lại điểm/bật bảng |
| `pages.test.tsx` /join | biểu mẫu khóa, không `<form>` | một biểu mẫu mã dự phòng hoạt động; không ô họ tên/email/điện thoại; có hướng dẫn nhờ GV |
| `strings.test.ts` | thông báo "chưa nhận… mã" | lỗi mã chung không lộ lý do |
| E2E `fixtures.ts` ROUTES | `/teacher` h1 bảng điều khiển | `/login`; thêm test `/teacher` → `/login` ở `routes.spec` |
| E2E `navigation.spec` | "Khu vực giáo viên" → `/teacher` | → `/login?reason=required` |
| E2E `privacy.spec` /join | không cách nào gửi mã | gửi qua POST, mã không vào URL/bộ nhớ trình duyệt; fragment QR bị xóa khỏi thanh địa chỉ |
| E2E `demo-practice` không gửi dữ liệu | cho phép prefetch GET các trang | thêm `/login` (prefetch `/teacher` bị chuyển hướng, chỉ tham số `reason`/`next`) |

## 5. Việc đã làm trong R04

### 5.1 Trạng thái khi bắt đầu R04 (kiểm tra thật, 2026-10-20)

| Hạng mục | Kết quả |
|---|---|
| Git | `feature/home-learning-redesign` @ `693be3e` = origin, working tree sạch; `user.email` cục bộ = noreply ✅ |
| Nhánh Audio WIP | `local/gd5-audio-wip` @ `b5bf2de` còn nguyên — **không đụng tới**, không push, không merge |
| Supabase local | Docker đang chạy (`supabase_db_readmate-ai` healthy); container `dye-lms-*` của dự án khác không đụng tới |
| Baseline | `test:run` 819/819, `test:db` 78/78 (chạy lại trên lược đồ mới trước khi viết test R04) |

### 5.2 Công việc (3 checkpoint)

1. **Scoring Engine thuần** (`7777f02`): `apply.ts` (+10/−5, sàn 0 tại từng sự kiện, sổ cái, tính lại, phát hiện sổ cái bị sửa), `score-types.ts`, `score-validation.ts`, `tilesAllowed(earned, cap)`, `game-world/map.ts` (lưới 3 × 3, kề theo cạnh); vân tay nội dung `fingerprint.ts`; khóa câu trả lời `response-key.ts`.
2. **Migration** `20261021090000_r04_scoring` + `…090100_r04_functions`: `exercises`, `exercise_versions`, `exercise_items`, `content_reviews`, `practice_sessions`, `question_instances`, `item_attempts`, `season_scores`, `point_events`, `map_tile_reveals`, `game_unlocks`; `private.scoring_rules`, `private.test_environment`; `private.record_graded_attempt` + `gateway_record_attempt`, `gateway_start_practice_session`, `gateway_practice_candidates`, `gateway_reveal_map_tile`, `gateway_scoring_rules`; `guard_class`/`teacher_withdraw_consent` thay thế ([R04_DATABASE_MIGRATIONS](docs/R04_DATABASE_MIGRATIONS.md)).
3. **Fixture kiểm thử** (chỉ local): `scripts/fixtures/scoring-items.ts` (21 câu visual_match dựng tay), `scripts/lib/scoring-fixtures.ts` (quy trình gửi duyệt → GV hư cấu duyệt qua đúng trigger), `scripts/lib/test-fixtures.ts`; `db:seed` thêm lớp "Thử Điểm" + 3 học sinh hư cấu.
4. **Máy chủ + API** (`8058243`): `server/question-instances/service.ts`, `server/scoring/home.ts`, `server/student-gateway/{context,http,api-schemas}.ts`, 6 Route Handler; `proxy.ts` chạy cho `/api/student/*`; 13 mã lỗi mới + câu chữ.
5. **Giao diện** (`5e9bf79`): `/learn/me` (điểm hiện tại/tích lũy, mùa, buổi luyện hoặc lý do, bản đồ khám phá, bốn khu vực "Đủ điểm/Đã khám phá/Mini-game đang phát triển"), `/learn/me/practice` (`ScoredPractice`, `ViewPlayer` dùng Player GĐ4 chỉ với `view`), `MapExplorer`, hoạt cảnh `fog-clear`, `WorldMapCard` chế độ dữ liệu thật, thanh điều hướng đáy theo khu vực.
6. **Kiểm thử mới**: unit 81 (`gamification/scoring`, `map`, `exercises/fingerprint`, `scoring/{planner,question-service,ui-safety}`), pgTAP 16 (`03_scoring`), tích hợp CSDL 28 (`tests/db/scoring.test.ts`), E2E có CSDL 4 kịch bản × 3 thiết bị (`tests/e2e-db/scoring.spec.ts`), bộ đo hiệu năng `perf.spec.ts` (`PERF=1`).
7. **Tài liệu**: tạo `docs/SCORING_ENGINE.md`, `docs/QUESTION_INSTANCE_SERVICE.md`, `docs/MAP_UNLOCK_ENGINE.md`, `docs/R04_DATABASE_MIGRATIONS.md`; cập nhật CLAUDE.md, README, TASKS, PROGRESS, REDESIGN_TASKS, REDESIGN_ARCHITECTURE, DATA_MODEL, GAMIFICATION_SPEC, tệp này.

### 5.3 Kết quả kiểm tra cuối R04 (chạy thật 2026-10-20)

| Lệnh | Kết quả |
|---|---|
| `npm run format:check` · `lint` · `typecheck` | ✅ · ✅ 0 lỗi · ✅ |
| `npm run content:check` | ✅ 0 lỗi, 52 cảnh báo (như R03) |
| `npm run test:run` | ✅ 37 tệp, **900/900** (819 cũ + 81 mới) |
| `npm run build` | ✅ 18 route (6 API động, `/learn/me` và `/learn/me/practice` Partial Prerender) |
| `npm run check:bundle` | ✅ 51 tệp tĩnh, không khóa/giá trị secret |
| `npm run test:e2e` | ✅ **262 đạt, 0 lỗi, 56 bỏ qua theo thiết kế** (5 cấu hình) |
| `supabase db reset` → `npm run db:lint` | ✅ 0 vấn đề |
| `npm run db:test` (pgTAP) | ✅ 3 tệp, **52/52** |
| `npm run db:seed` ×2 | ✅ không lỗi, không trùng |
| `npm run test:db` | ✅ 4 tệp, **106/106** |
| `npm run test:e2e:db` | ✅ **40 đạt, 0 lỗi, 17 bỏ qua theo thiết kế** (đo bố cục chỉ chromium-desktop; đo hiệu năng chỉ khi `PERF=1`); kịch bản R04 chạy lặp 2 lần × 3 thiết bị đều đạt |
| Hiệu năng (`PERF=1`) | 216 request chấm bài: median **90 ms**, p95 **104 ms**, p99 107 ms, max 108 ms (local, cùng máy) |
| GitHub Actions | ✅ Run [39400938083](https://github.com/ThaiTaka/ReadMateAI/actions/runs/39400938083) (checkpoint `5e9bf79`): `verify` + `database` success · Run [39434099659](https://github.com/ThaiTaka/ReadMateAI/actions/runs/39434099659) (tài liệu `40c961e`): cả hai job success |

### 5.4 Sự cố gặp và cách xử lý

| Sự cố | Xử lý |
|---|---|
| `request.url` của Route Handler dùng `localhost` trong khi trình duyệt gửi Origin `127.0.0.1` → mọi POST bị chặn khác nguồn | So Origin với header `Host`/`x-forwarded-host`; unit test |
| Next 16 giữ trang trước (ẩn) khi điều hướng phía client → selector văn bản E2E trùng | Giới hạn selector trong vùng (`#ban-do`) |
| WebKit so khớp tên truy cập bỏ dấu ("a" ~ "â") → E2E chọn nhầm | E2E chọn phương án theo vị trí + kiểm `toHaveText` |
| `useSearchParams` trong thanh điều hướng → Suspense thay DOM lúc hydrate, WebKit đo vùng chạm 0 px | Chỉ dùng `usePathname` |
| Test R02 "Game World không gửi request" chặn `MapExplorer` | Chuyển phần có xác thực sang `features/scored-practice/ui/` + test riêng: chỉ gọi `/api/student/*` |
| Luật lint `set-state-in-effect` | Gọi API trong effect bằng `.then` (setState trong callback), không tắt luật |
| Hậu tố ngẫu nhiên ngắn → trùng biệt danh khi lặp E2E | 6 chữ cái ngẫu nhiên |
| Lệnh `node -e` có backtick trong Git Bash bị cắt | Dùng Write/Edit (CLAUDE.md §9.3.9) |
| Axe `/demo` vượt 30 s khi cả bộ E2E chạy song song | `test.slow()` (không đổi khẳng định) |
| Sau khi Docker Desktop khởi động lại, `supabase db reset` để container `kong` **không có ánh xạ cổng** 54321 → seed/test:db `ECONNREFUSED` | `npm run db:stop` rồi `npm run db:start`; kiểm `docker port supabase_kong_readmate-ai` trước khi chạy test (lỗi môi trường, không phải mã) |
| Fixture ghi `reviewed_at` = 2026-10-21 (ngày trong tên migration, ở tương lai so với ngày làm) | Đổi thành 2026-10-20; không ràng buộc CSDL nào phụ thuộc, đã chạy lại seed ×2 + test:db + test:e2e:db |

### 5.5 Test cũ được cập nhật (không xóa test nào)

| Test | Thay đổi |
|---|---|
| `tests/unit/accounts/proxy-and-pages.test.tsx` | Thêm `/api/student/*` vào danh sách đường dẫn proxy phải chạy |
| `tests/e2e/demo-practice.spec.ts` (axe) | `test.slow()` — chỉ tăng thời gian chờ |

## 5b. Nghiệm thu R05 (2026-10-21)

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

**Lỗi tìm ra khi chuyển E2E lên CI và cách xử lý (đều là lỗi của test, không phải của mã sản phẩm):**

1. *E2E database webkit-mobile hết 90 giây* ở kịch bản điểm R04 (`scoring.spec.ts`): ảnh chụp trạng thái cho thấy test đã tới trang chủ với 55 điểm (gần cuối) — kịch bản dài ~20 bước chờ máy chủ + 3 lần axe, `test.slow()` (×3) không đủ trên runner WebKit. Đặt giới hạn rõ `test.setTimeout(180_000)` cho đúng test này (`ab72d12`). Lượt cuối: webkit-mobile database 15 đạt trong 6,6 phút, test không còn hết giờ.
2. *Hai test CSDL `scoring.test.ts` chập chờn* (số dư 50 thay vì 60; thiếu dấu mở khóa ở mốc 50): nguyên nhân là fixture có **một bản sao nội dung** trong 17 mục và test lấy `slice(0, n)` theo thứ tự UUID ngẫu nhiên; bản sao cùng fingerprint trong cùng mùa **đúng thiết kế** không tính điểm. Mã hàm CSDL không đổi (quy tắc "một nội dung một lần mỗi mùa" vẫn do test "cùng nội dung, khác mã câu" bảo vệ). Thêm `distinctItemIds` chọn mục khác fingerprint (`83b34a7`). CI chạy lại trên `83b34a7`: 129/129.
3. Hai sửa cuối từ `628bf64` (nhãn avatar "Bạn tóc bồng", vùng cuộn bảng GV `role="group"` + nhãn `tableScroll`) đã đạt trong E2E database (accounts/leaderboard, axe sạch) ở cả 4 project.

**Chiến lược chống thiếu RAM:** xem [docs/E2E_CI_STRATEGY.md](docs/E2E_CI_STRATEGY.md). Hạn chế: kết quả này là của CI Linux; chưa thử trên thiết bị thật.

## 5c. R06.1 — Backend vinh danh TOP 3 (2026-10-21)

**Migration** `20261023090000_r06_honors.sql` (không sửa migration cũ):
- `honor_snapshots` (lớp, mùa, số mùa, UUID người tạo, thời điểm) và `honor_snapshot_entries` (hạng 1–3, vị trí, tên hiển thị đã duyệt lúc chụp, avatar, điểm > 0; giữ `student_id` NỘI BỘ để lọc theo quyền hiện tại). Cả hai **bất biến** (trigger `block_direct_change`, kể cả với service_role); xóa hồ sơ học sinh/lớp xóa theo dây chuyền.
- RLS bật; `honor_snapshots` GV lớp đọc được; `honor_snapshot_entries` **không cấp SELECT** cho authenticated (policy từ chối) — chỉ đọc qua hàm đã lọc.
- Hàm: `teacher_create_honor_snapshot(class)` (một giao dịch, khóa dòng lớp, ghi audit `honors.snapshot_create`, rỗng → `NO_HONOREES` và hủy cả giao dịch), `teacher_get_honor_snapshot` / `teacher_list_honor_snapshots` (đọc từ ảnh chụp đã lưu, **không tính lại hạng**, lọc lại mỗi lần đọc), `teacher_set_honors_enabled` (chỉ chủ nhiệm). Nội bộ: `private.require_honor_staff` (owner hoặc co_teacher có `can_honor`), `private.honor_entry_visible`.

**Quy tắc:** nguồn là `private.leaderboard_rows` (cùng bộ lọc với bảng xếp hạng: học sinh hoạt động + đồng ý `learning_data` + `leaderboard_display` + tên hiển thị đã duyệt); `rank()` = 1 + số người điểm cao hơn (đúng Ranking Engine R05, đồng hạng 1,1,3 → không có hạng 2); chỉ hạng ≤ 3 và điểm > 0. Hạng tính ở CSDL vì GV có thể gọi RPC trực tiếp; `selectHonorees()` (TS) là bản đối chiếu, kiểm thử tích hợp so sánh hai bên. Không đổi điểm/mùa; không reset.

**Cờ và quyền:** tạo ảnh chụp cần cờ hệ thống `honors_feature_approved` (mặc định TẮT, không bật ngoài `setLocalHonorsApproval` trong kiểm thử local) **và** `classes.honors_enabled` (bật chỉ khi cờ hệ thống bật — trigger sẵn có). Đọc/liệt kê cũng yêu cầu cờ hệ thống. Không URL công khai, không API học sinh (thuộc R06.2+).

**Riêng tư khi đọc:** hàng bị ẩn khi học sinh không còn hoạt động, mất một trong hai đồng ý, hoặc tên hiển thị hiện tại khác/chưa duyệt lại so với lúc chụp. Không báo lý do, không đếm số bị ẩn; bản gốc giữ nguyên, cấp lại đồng ý thì hiện lại. DTO (`src/features/honors/honors.ts`): chỉ `rank, alias, avatarKey, points` + `playbackOrder` (TOP 3 → 2 → 1, bỏ bậc trống), không `student_id/class_id`/nhóm.

**Mã:** `src/features/honors/honors.ts` (thuần + zod), `src/server/teacher/honors.ts` (Server Actions `createHonorSnapshot({classId})`, `setHonorsEnabled`), `src/server/teacher/honor-queries.ts`, mã lỗi `HONORS_NOT_APPROVED/HONORS_DISABLED/NO_HONOREES`.

**Kiểm thử (local, chỉ phần mới/ảnh hưởng):** pgTAP 81/81 (mới 16), tích hợp `tests/db/honors.test.ts` 19/19 (JWT thật, điểm thật qua gateway), unit 967/967 (mới 15), db:lint sạch, format/lint/typecheck sạch. Kết quả CI của commit: xem nhật ký phiên bên dưới.

**Giới hạn:** chưa chống bấm đúp (hai lần bấm tạo hai ảnh chụp — chấp nhận ở R06.1, có thể thêm khóa ý định ở R06.2); `co_teacher` chưa có giao diện cấp `can_honor` (cột đã có, kiểm thử cấp qua máy chủ); chưa có API học sinh xem ảnh chụp gần nhất.

## 5d. R06.2 — Giao diện vinh danh TOP 3 (2026-10-21)

**Route:** `/teacher/classes/[classId]/honors/[snapshotId]` (khung trình chiếu `(present)`). Trang kiểm tra ảnh chụp thuộc đúng lớp (qua `listHonorSnapshots`), cờ hệ thống tắt → màn "chưa dùng được", lớp khác → 404. **Không** tính lại hạng: chỉ dựng từ `HonorSnapshotDto` (`tiers`, `playbackOrder`).
**Mã:** `src/features/honors/playback.ts` (máy trạng thái thuần: start/next/skip/replay, bố cục ≤ 6 hàng / lưới), `src/components/honors/honor-stage.tsx` (client: bục vàng/bạc/đồng, avatar `KidAvatar`, hào quang `animate-glow`, hoa giấy `animate-confetti` mới ở `tokens.css`, ẩn khi `data-motion=reduce`), `honor-launcher.tsx` (nút "Vinh danh TOP 3" khóa khi pending + bật/tắt của chủ nhiệm), mục "Lịch sử vinh danh" ở trang bảng điểm GV. Không âm thanh, không thư viện mới, không asset ngoài.
**Hành vi:** 3 → 2 → 1, bậc trống bị bỏ (1,1,3 → 3 → 1; 1,1,1 → chỉ bậc 1); đồng hạng cùng một bậc, >6 → lưới, không loại ai; Bỏ qua → tổng kết; Xem lại → về đầu (Next giữ trang ẩn nên state được đặt lại khi bị ẩn); không tạo ảnh chụp, không đổi điểm/mùa (E2E đối chiếu).
**Kiểm thử:** unit mới 11 (playback 5 nhóm + stage 6); E2E CSDL `tests/e2e-db/honors.spec.ts` (2 kịch bản) xanh cục bộ trên chromium-desktop và chromium-mobile; `global-setup/teardown` bật/trả cờ vinh danh về TẮT. WebKit + toàn bộ regression: GitHub Actions.
**Giới hạn:** chưa chống bấm đúp ở server (chỉ khóa nút ở giao diện; hai tab/thiết bị vẫn tạo hai ảnh chụp — cần khóa ý định ở bước backend sau); `KidAvatar` vào bundle client của trang vinh danh (chỉ khu GV); `co_teacher` có `can_honor` vẫn chưa có giao diện cấp quyền; chưa có API học sinh xem vinh danh (6.5); cờ hệ thống vẫn TẮT.

## 5e. R06.3 — Backend reset mùa (2026-10-21)

**Migration** `20261024090000_r06_season_reset.sql`: bảng `season_resets` (bất biến, RLS chỉ SELECT cho GV lớp; `request_id` PK, `unique(old_season_id)`, `unique(new_season_id)`), cột `season_scores.final_rank` (NULL đến khi đóng mùa), `private.reset_class_season` (chỉ service_role) + vỏ `public.teacher_reset_season(class, request_id, expected_season_id, confirmation)` cấp cho `authenticated`. **Server Action** `resetSeason` (`src/server/teacher/season.ts`; zod + so khớp tên lớp ở `features/gamification/season-reset.ts`), mã lỗi mới `CONFIRMATION_MISMATCH`, `SEASON_MISMATCH`.
**Một giao dịch:** quyền owner theo `auth.uid()` → khóa lớp `FOR UPDATE` → khóa ý định `request_id` → tên lớp → khóa mùa active `FOR UPDATE` + đối chiếu `expected_season_id` → `final_rank` (rank() = 1-2-2-4) → void câu mở + buổi luyện dở → đóng mùa cũ, mở mùa `seq_no+1` → `season_resets` + `audit_logs`.
**Chống reset trùng:** cùng `request_id` (kể cả đồng thời) → một mùa mới, lần sau `replayed: true`; cùng `request_id` khác tham số → `IDEMPOTENCY_CONFLICT`; `request_id` khác nhưng cùng mùa xác nhận → `SEASON_MISMATCH` (không bao giờ hai mùa liên tiếp). Thứ tự khóa lớp → mùa → dòng con; ghi điểm R04 khóa mùa `FOR SHARE` nên đi trước thì vào hạng cuối, đi sau thì `SEASON_CLOSED`.
**Điểm mùa mới = 0** vì `season_scores`/`map_tile_reveals`/`game_unlocks` gắn `season_id` (dòng tạo lúc ghi điểm đầu tiên); lịch sử (`point_events`, `item_attempts`, nhóm, ảnh chụp vinh danh) không bị đụng. **Quy tắc cho R07–R09:** mọi bảng trạng thái game phải có `season_id` và hàm reset phải void lượt chơi/chạm trán dở.
**Kiểm thử (local, chỉ phần mới/ảnh hưởng):** pgTAP 95/95 (mới 14), tích hợp `tests/db/season-reset.test.ts` 14/14 (quyền co_teacher/GV lớp khác/thiết bị/khách/service_role, sai tên lớp, sai mùa, rollback bằng mùa 2 chặn sẵn, hạng 1-1-3-4, replay, hai request đồng thời cùng/khác requestId, ba vòng reset ∥ ghi điểm với bất biến số dư = tổng sổ cái, SEASON_CLOSED, bản đồ khóa lại, lớp khác nguyên vẹn, ảnh chụp vinh danh còn đọc được), unit +12 (994 tổng), honors/rls DB vẫn xanh, db:lint sạch. Toàn bộ regression: GitHub Actions.
**Còn thiếu / giới hạn:** giao diện hai bước (R06.4); chưa void trạng thái game (bảng game chưa có); `requestId` do client sinh nên giao diện R06.4 phải sinh một lần cho mỗi lần mở hộp thoại; chưa có API học sinh thông báo "mùa mới" (học sinh nhận `SEASON_CLOSED` ở lần nộp kế tiếp); lớp chưa có dòng điểm nào ở mùa cũ vẫn reset được (`final_rank` trống).

## 5f. R06.4 — Giao diện reset mùa (2026-10-21)

**Giao diện:** `/teacher/classes/[classId]/leaderboard` thay nút khóa bằng **BẮT ĐẦU MÙA MỚI** (`season-reset.tsx`, `<dialog>` gốc: khóa focus, Esc hủy, focus về nút mở). Bước 1 nêu hệ quả (điểm về 0, bản đồ bắt đầu lại, mini-game khóa lại, mùa cũ lưu lịch sử, không xóa học sinh/bài đã làm/tiến độ, không ảnh hưởng lớp khác) + "không thể hoàn tác"; bước 2 hiện tên lớp, ô gõ lại, nút **XÁC NHẬN BẮT ĐẦU MÙA MỚI** chỉ bật khi `confirmationMatches`. Màu dịu (sun), không hoạt cảnh. Chỉ chủ nhiệm mở được (co-teacher: nút khóa kèm lý do); lớp chưa có mùa active: khóa.
**Kết nối:** `getClassDetail` trả thêm `season.id` (mùa active thật, không suy từ `seqNo`). `requestId` = `crypto.randomUUID()` **một lần mỗi lần mở hộp thoại**, giữ cho mọi lần thử lại; khóa nút bằng `useTransition` + ref đồng bộ (bấm đúp = 1 lời gọi); Esc bị chặn khi đang gửi. Thành công → đóng, "Đã bắt đầu mùa N…", `router.refresh()`. `SEASON_MISMATCH` → ẩn nút xác nhận, chỉ còn "Tải lại thông tin"; `CONFIRMATION_MISMATCH` → xóa ô, focus lại. Không log phía client.
**Kiểm thử:** unit `tests/unit/season-reset-ui.test.tsx` 9/9 (cả bộ 1003/1003); E2E local `tests/e2e-db/season-reset.spec.ts` 3 kịch bản × chromium-desktop, chromium-mobile, webkit-mobile = 9/9 (owner reset + Esc/Hủy/Quay lại không đổi dữ liệu + sai tên khóa nút + bấm đúp 1 mùa + điểm/bản đồ mùa mới = 0 + mùa cũ, `item_attempts`, `point_events` giữ nguyên + axe + không cuộn ngang; tab cũ → `SEASON_MISMATCH`, không mùa thứ ba; co-teacher bị khóa, lớp khác nguyên vẹn). Toàn bộ E2E ở GitHub Actions: lần đầu (`d6ff127`) axe báo `color-contrast` ở bước 2 trên chromium (không tái hiện local) → test đã bỏ hover + đợi chuyển màu + in mục tiêu vi phạm; `a918a56` xanh 9/9 job, CI xanh (nếu tái diễn: đọc mục tiêu trong thông báo lỗi). `leaderboard.spec.ts` sửa dòng cũ (nút Reset khóa → nút mùa mới bật cho chủ nhiệm).
**Giới hạn:** chưa test "retry dùng lại requestId" qua mạng thật ở E2E (chỉ unit + CSDL R06.3); mất phản hồi sau khi đã reset thì mở lại hộp thoại sẽ gặp `SEASON_MISMATCH` (đúng thiết kế, tải lại để thấy mùa mới); snapshot vinh danh không bị reset đụng tới (kiểm ở pgTAP/tích hợp R06.3); chưa đo bằng màn hình 360px thật (Playwright giả lập Pixel 7/iPhone 13).

## 5g. R06.5 — API vinh danh cho học sinh + chống snapshot trùng (2026-10-21)

**Xác minh đầu phiên:** CI + E2E xanh trên `6cde9a3`.
**API:** `GET /api/student/honors/latest` (`src/app/api/student/honors/latest/route.ts`, `src/server/honors/student.ts`, `buildStudentHonors`) → hàm `gateway_latest_honors(auth_user_id, student_id)` (chỉ service_role). Lớp suy ra từ thiết bị đã liên kết (`require_linked_device`); query chỉ nhận `studentId` (strict, `classId`/`seasonId` → 400). Trả `disabled` (cờ hệ thống `honors_feature_approved` hoặc cờ lớp tắt, hoặc người xem thiếu đồng ý `learning_data`; không kèm dữ liệu), `none` (chưa có snapshot) hoặc `ok` {số mùa, thời điểm, hàng}. Người xem KHÔNG cần đồng ý bảng; mỗi hàng vẫn lọc lại ở mỗi lần đọc bằng `honor_entry_visible` (hai đồng ý + tên hiển thị còn đúng + học sinh hoạt động). Không trả student_id/class_id/email/nhóm/số bị ẩn/lý do. `private, no-store` + `X-Robots-Tag: noindex`. Snapshot mùa cũ vẫn là "gần nhất" sau reset, mang số mùa cũ. Không có giao diện học sinh mới. Thiết bị bị thu hồi/khác lớp → FORBIDDEN.
**Chống trùng (tại CSDL):** `teacher_create_honor_snapshot(class, request_id)` (đường 1 tham số bị gỡ) trả `{snapshot_id, replayed, deduplicated}`. (1) khóa dòng lớp `FOR UPDATE` tuần tự hóa mọi yêu cầu cùng lớp; (2) bảng bất biến `honor_snapshot_requests` (PK `request_id`): cùng request_id → cùng snapshot; khác lớp/người tạo → `IDEMPOTENCY_CONFLICT` (kể cả đua khác lớp qua PK → `mapDbError`); (3) khoảng chống lặp `private.honor_settings.dedupe_seconds` (mặc định 15, chỉ đổi ở local qua `setLocalHonorDedupeSeconds`): yêu cầu khác request_id khi lớp vừa có snapshot → gộp vào snapshot đó và ghi nhớ request_id (thử lại sau 15 giây vẫn không tạo mới); hết khoảng → GV vinh danh lần mới được. Không sửa snapshot cũ/điểm/mùa. `honor-launcher.tsx`: một `requestId` mỗi ý định, giữ khi lỗi tạm (UNKNOWN/RATE_LIMITED), đổi sau thành công/lỗi dứt khoát.
**Kiểm thử (local):** unit 1007/1007; pgTAP 7 tệp / 109 test (mới `07_honor_dedupe`, `05` sửa chữ ký); DB tích hợp `honor-dedupe.test.ts` 13/13 (cùng requestId 2 lần, 5 yêu cầu đồng thời, 4 yêu cầu khác requestId đồng thời → 1 snapshot, vinh danh lại sau khoảng chống lặp, bất biến, rút đồng ý/đổi tên, cách ly lớp, thiết bị thu hồi, mùa cũ, cờ tắt, none) + `honors.test.ts` và `season-reset.test.ts` (cập nhật chữ ký) đạt; E2E `honors.spec.ts` -g R06.5 chromium-desktop đạt (hai tab bấm cùng lúc = 1 snapshot, API no-store/noindex/400/401, không rò dữ liệu). Hồi quy đầy đủ: GitHub Actions.
**Giới hạn:** gộp theo khoảng chống lặp trả snapshot cũ cho GV thứ hai (không báo "đã gộp" trên giao diện); khoảng 15 giây tính theo đồng hồ CSDL; `honors.test.ts` đặt khoảng chống lặp = 0 cục bộ để tạo nhiều snapshot liên tiếp (khôi phục 15 khi xong); chưa có giao diện học sinh dùng API (R07+/sau).

## 5i. R07.2 — Lõi Game Engine (2026-10-21)

`core/{types,grid,reducer,level-validate,index}.ts`, thuần TS (import `.ts` tương đối, không zod/DOM/ngẫu nhiên/thời gian). Màn = `{ id, rows (# . S T, tương thích nguyên mẫu 11×11), triggers[7] }`. Reducer `gameReducer(parsedLevel, state, action)` với `MOVE | PAUSE | RESUME | ENCOUNTER_RESOLVED{triggerId, outcome}`: đi từng ô, va tường/biên, tạm dừng chặn đi, điểm kích hoạt ẩn (`revealedTriggers` chỉ trả điểm đã bước vào) và mỗi điểm một lần, đang chạm trán thì chặn đi, rương chỉ mở khi đủ 7 chạm trán đã giải quyết. Lõi không đụng điểm/HP/dữ liệu học sinh. `validateLevel` trả `LevelError[]` có mã + vị trí (13 mã: kích thước 9–13, hàng đều, ký tự lạ, 1 S, 1 T, đúng 7 trigger, trùng mã/tọa độ, ngoài bản đồ, không trên đường, liên thông, rương/trigger tới được). Fixture chỉ ở `tests/unit/game-engine/`; 3 màn JSON + `content:check` thuộc R07.3; chưa có migration/API/điều khiển.

## 5h. Nghiệm thu R06 và R07.1 — nguyên mẫu đồ họa Mê cung kho báu (2026-10-21)

**R06 hoàn thành.** GitHub Actions trên commit `ebb027a`: CI run `39533560083` PASS, E2E run `39533560105` PASS (người điều phối xác minh). Cờ `leaderboard_feature_approved` và cờ vinh danh vẫn **tắt** mặc định. Giới hạn còn lại: chưa có giao diện học sinh xem vinh danh; chưa thử trên điện thoại thật; chống trùng snapshot gộp trong 15 giây.

**R07.1 (nghiệm thu: CI `39549482836` + E2E `39549482832` xanh trên `d912a56`):** route `/demo/treasure-maze` (nhãn "Bản thử nghiệm – Dữ liệu minh họa"), lưới 11×11 (`features/demo/treasure-maze-data.ts`), `components/art/maze-board.tsx` (SVG nền + lớp HTML cho nhân vật/rương theo phần trăm ô, sẵn sàng nội suy `transform` ở R07.2), nhân vật `HeroKid`, rương `TreasureChest`, hoạt cảnh `animate-bob/sway` dừng theo giảm chuyển động. Không điểm, không điều khiển, không migration, không dữ liệu học sinh. Asset mới có dòng `art.scene.treasure-maze-board` (`pending_review`).

**Số đo thật** (`node scripts/measure-maze-perf.mjs`, Chromium 156 headless trên máy phát triển, bản production, viewport 390×844, 5 giây/lần; rAF headless bị khóa ở 60 Hz nên FPS không vượt 60 — số hữu ích là tỉ lệ khung chậm và độ bận luồng chính):

| Điều kiện | FPS | Khung > 33 ms | Luồng chính bận |
|---|---|---|---|
| Bình thường | 60,2 | 0 | 5,7% |
| CPU chậm 4× | 60,2 | 0 | 46,9% |
| CPU chậm 6× | 59,7 | 2 / 299 | 59,9% (style 10%) |
| Giảm chuyển động | 60,4 | 0 | 0,9% |

JS tải về của route: **206,6 KB gzip** (18 tệp) so với `/login` 201,2 KB → route thêm ≈ 5 KB. DOM 954 nút (787 trong SVG), 17 hoạt cảnh chạy, heap JS ≈ 4,9 MB. Bố cục: bảng 328 px (ô 29,8 px) ở 360; 358 px (32,5) ở 390; 544 px (49,5) ở tablet 820 và desktop 1280 — không cuộn ngang. E2E `treasure-maze-demo.spec.ts` (nhãn, bố cục, không form/liên kết ngoài, axe nghiêm trọng, giảm chuyển động hệ điều hành + công tắc) đạt trên chromium-desktop/mobile, webkit-desktop/mobile/tablet (16/16 ở 4 project cuối + 4/4 chromium-desktop).

**Kết luận (đề xuất RD-07):** React + SVG/CSS đáp ứng — không cài PixiJS/Phaser. **Chưa đo** trên Android phổ thông thật (giả lập CPU chậm chỉ là xấp xỉ): ở 6× luồng chính bận ~60% do hoạt cảnh `sway` trên SVG (không lên compositor); nếu máy thật chậm, giảm số cây lắc hoặc chỉ lắc khi rảnh. Ô 29,8 px ở 360 px là nhỏ cho hoạt cảnh bước chân — R07.2/7.4 cân nhắc cuộn/phóng to quanh nhân vật cho màn rộng hơn 11×11.

## 6. Nhật ký quyết định (lộ trình R)

| Mã | Quyết định | Trạng thái | Chi tiết |
|---|---|---|---|
| RD-01 | Bảng xếp hạng trong lớp là ngoại lệ **có điều kiện** của CLAUDE.md §6.4 (chỉ lớp mình, alias đã duyệt + avatar + điểm, đồng ý hiển thị, không nhóm năng lực, mặc định tắt) | **Chốt** (người điều phối, 2026-10-16) | PD-03, AD-52 |
| RD-02 | Giữ −5 khi sai; §7.10 thành ngoại lệ có chủ đích, trình bày trung tính | **Chốt** (người điều phối, 2026-10-16) | PD-04, GAMIFICATION_SPEC §10 |
| RD-03 | "Điểm tích lũy" (thẻ bản đồ) = tổng điểm được cộng trong mùa; "điểm hiện tại" (game, xếp hạng) = số dư sàn 0 | Chờ xác nhận (RQ-G1) | GAMIFICATION_SPEC §2 |
| RD-04 | Mỗi nội dung câu tính điểm một lần mỗi mùa; mỗi màn game một lượt tính điểm mỗi mùa | Đề xuất | AD-43 |
| RD-05 | Câu hỏi trong chạm trán: tối đa 2 lượt (tham số 1–3) | Chờ xác nhận (RQ-G2) | GAMIFICATION_SPEC §4.3 |
| RD-06 | Chấm ở server cho chế độ có điểm; đáp án không xuống client trước khi đóng câu | Đề xuất | AD-41 |
| RD-07 | Game Engine: lõi TS thuần + React/SVG/CSS; PixiJS là phương án sau POC; không Phaser | Đề xuất (POC R07) | AD-47 |
| RD-08 | Bỏ luồng "ở lớp" khỏi giao diện ở R02, xóa mã ở R11 | Đề xuất | AD-51 |
| RD-09 | Bằng điểm → đồng hạng 1-2-2-4; thứ tự hiển thị theo thời điểm đạt điểm | Đề xuất | AD-45 |
| RD-10 | Đồng ý tách hai phạm vi `learning_data` / `leaderboard_display` | Đề xuất | PRIVACY_AND_SECURITY §4 |
| RD-11 | H0 đổi tên hiển thị "Thử như ở lớp" → "Tự làm" | Đã áp dụng ở R02 (tên tạm), chờ GV góp ý (RQ-02) | PRODUCT_REDESIGN §4.2 |
| RD-12 | Hằng số điểm + hàm mở khóa thuần (`rules.ts`, `unlocks.ts`) tạo ở R02 thay vì R04 để giao diện không chép số | Chốt (R02) | CLAUDE.md §9.4.1 |
| RD-13 | Cảnh SVG trong thẻ và bản đồ lớn mặc định tĩnh; hoạt cảnh chỉ cho nhân vật/cảnh đứng riêng; không dùng `filter: blur` lớn | Chốt (R02, theo số đo khung hình) | DESIGN_SYSTEM §3 |
| RD-14 | Công việc GĐ5 âm thanh tìm thấy chưa commit trên máy → giữ ở nhánh cục bộ `local/gd5-audio-wip`, không push, chờ quyết định | Chờ người điều phối (RQ-06); R03 không đụng tới, rà soát ở R10 | §1.1 |
| RD-15 | Chặn tự đăng ký bằng Auth Hook thay vì tắt signup | Chốt (R03, kiểm chứng thực tế) | AD-54 |
| RD-16 | Không có client Supabase ở trình duyệt; cookie httpOnly | Chốt (R03) | AD-55 |
| RD-17 | Chỉ policy SELECT; ghi qua hàm `teacher_*` / `gateway_*` | Chốt (R03) | AD-56 |
| RD-18 | Thẻ học: mặc định 14 ngày, 3 thiết bị (GV chọn 1/7/14/30 ngày, 1–5 thiết bị); cấp lại thu hồi thẻ cũ | Đề xuất (R03) — chờ GV góp ý | AD-57 |
| RD-19 | `/learn` giữ là bản minh họa Game World; khu vực học sinh có xác thực là `/learn/me` | Đề xuất (R03) | STUDENT_ACCESS |
| RD-20 | GV đang hoạt động tự tạo được lớp (thành chủ nhiệm); thêm GV cùng dạy chỉ qua quản trị | Đề xuất (R03) | AUTHENTICATION §6 |
| RD-21 | Rút `learning_data` → thu hồi ngay mọi thiết bị + thẻ; xóa dữ liệu học tập nối vào khi có bảng (R04) | Đề xuất (theo DATA_MODEL §10) | PRIVACY §4 |
| RD-22 | Biệt danh tối đa 2 tiếng (chặn nhập họ tên đầy đủ), không trùng trong lớp | Đề xuất (R03) — chờ GV góp ý | `features/students/names.ts` |
| RD-23 | Thông báo xử lý dữ liệu: chỉ bản nháp `nhap-2026-10` (dữ liệu giả) cho tới khi nhà trường duyệt | Chờ nhà trường (Q-05, RQ-P1–P3) | PRIVACY §12 |
| RD-24 | Chống tính điểm trùng theo **vân tay nội dung** (bất biến theo seed/thứ tự phương án), không theo mã câu | Chốt (R04, có kiểm thử) | SCORING_ENGINE §7 |
| RD-25 | Hằng số điểm có bản sao trong `private.scoring_rules` theo phiên bản; kiểm thử đối chiếu với `rules.ts` | Chốt (R04) | SCORING_ENGINE §1 |
| RD-26 | Dữ liệu "đã duyệt" để kiểm thử chỉ là **fixture** (`origin`/`series_kind = test_fixture`) trên Supabase local; `private.test_environment` mặc định tắt | Chốt (R04) | R04_DATABASE_MIGRATIONS §7 |
| RD-27 | Mức hỗ trợ mặc định của buổi luyện có điểm theo nhóm: Nhóm 3 → H3, Nhóm 2 → H2, Nhóm 1 → H1 (cho tới khi có `student_type_support` — R10) | Đề xuất — chờ GV | QUESTION_INSTANCE_SERVICE §5 |
| RD-28 | Chế độ có điểm: gợi ý chỉ sau lượt sai (H3 tự hiện, H2/H1 bấm); chưa "Cô làm mẫu", chưa gợi ý trước lượt đầu | Đề xuất — chờ GV | QUESTION_INSTANCE_SERVICE §4 |
| RD-29 | Bản đồ mùa đầu 3 × 3: Trạm luyện tập ở giữa + 8 thẻ (8 cảnh đã vẽ), kề theo cạnh (GAME_DESIGN gợi ý 24 thẻ) | Đề xuất | MAP_UNLOCK_ENGINE §1 |
| RD-30 | Buổi luyện 8 câu; thiếu câu mới thì thêm câu đã tính điểm làm "luyện thêm" | Đề xuất | QUESTION_INSTANCE_SERVICE §5 |
| RD-31 | RQ-G1 áp dụng mặc định: thẻ bản đồ theo `earned_total` (tổng điểm được cộng); game theo `balance` | Áp dụng mặc định — vẫn chờ xác nhận RQ-G1 | GAMIFICATION_SPEC §2 |

## 7. Rủi ro mới (bổ sung PROGRESS §6)

| Mã | Rủi ro | Mức | Giảm thiểu |
|---|---|---|---|
| RR-01 | Bảng xếp hạng gây áp lực/so bì, trái nguyên tắc sư phạm ban đầu (PRD P7) | Cao | Mặc định tắt, TOP 10 + mình, ngôn ngữ trung tính, GV tắt được, theo dõi phản hồi |
| RR-02 | Pháp lý: công bố thông tin trẻ ≥ 7 tuổi cần đồng ý của trẻ và người đại diện (Luật 91/2025 Điều 24) | Cao | Đồng ý phạm vi `leaderboard_display`; cờ hệ thống chỉ bật sau rà soát |
| RR-03 | Không có nội dung **đã duyệt** (0 mục) và hồ sơ 1A2 chưa xác nhận → học thật không tạo được câu nào cho buổi luyện lẫn game | Cao | Ưu tiên GV trả lời Q-01/Q-02 và duyệt kho câu (R10); demo dùng hồ sơ minh họa |
| RR-04 | Chưa có âm thanh → Nhóm 3 không tự chơi được (R-24 cũ) | Cao | R10 song song từ R04; điều kiện trước khi dùng thật |
| RR-05 | Công việc GĐ5/Prompt 05 có thể nằm ở môi trường khác, chưa push | Trung bình | Hỏi người điều phối (RQ-06); không đoán, không dựng lại |
| RR-06 | Chấm ở server làm phản hồi chậm hơn | Trung bình | Đo p95 ở R04 (T-20) |
| RR-07 | Asset game không rõ giấy phép trên repo public | Trung bình | `licenses.json`, chỉ asset tự vẽ/CC0/có hợp đồng |
| RR-08 | Hiệu năng game trên Android phổ thông | Trung bình | POC R07 (T-22) |
| RR-09 | Workflow CI không chạy trên push nhánh tính năng | Thấp | R02.9 thêm kích hoạt; hiện chạy cục bộ |
| RR-10 | Phiên sau quên đặt lại email `noreply` khi clone lại | Thấp | Ghi ở §2; kiểm tra `git config --local user.email` trước khi commit |
| RR-11 | Hiệu năng vẽ `/learn` (bóng đổ lớn + SVG nhiều lớp) trên máy yếu: 36 ms/khung ở WebKit vẽ bằng CPU | Trung bình | Đã bỏ blur, tắt hoạt cảnh SVG lớn; đo lại trên Android thật ở POC R07; có thể giảm bóng `shadow-world` |
| RR-12 | Mỹ thuật SVG tự vẽ ở mức phác thảo — GV/phụ huynh có thể thấy chưa đủ hấp dẫn hoặc nhân vật chưa phù hợp | Trung bình | GV duyệt ở `/teacher#duyet-hoc-lieu`; cân nhắc họa sĩ (RQ-M2) trước R07 |
| RR-13 | Công việc âm thanh GĐ5 (46 tệp MP3 TTS) chỉ nằm ở nhánh cục bộ — mất nếu xóa thư mục | Trung bình | Người điều phối quyết định hợp nhất (R10) hoặc bỏ; trước khi push phải xác minh giấy phép giọng Piper/VAIS-1000 |
| RR-14 | Giới hạn "người dùng ẩn danh/giờ/IP" của Supabase áp lên IP máy chủ — buổi phát thẻ cả lớp có thể chạm 30/giờ (mặc định Cloud) | Trung bình | Nâng hạn mức ở Dashboard + Turnstile trước production (STUDENT_ACCESS §5) |
| RR-15 | Chưa có dự án Supabase Cloud → cấu hình Dashboard (hook, ẩn danh, CAPTCHA) chưa kiểm chứng ngoài máy local | Trung bình | Danh mục SUPABASE_SETUP §5 khi được phép tạo |
| RR-16 | Người dùng ẩn danh mồ côi / thiết bị thu hồi tích tụ | Thấp | Cron dọn dẹp (R11) |
| RR-17 | Chưa thử trên điện thoại thật (chỉ giả lập Playwright) | Trung bình | Thử Android + iPhone thật khi có Cloud dev / Preview |
| RR-18 | Công cụ ghi tệp giải mã chuỗi thoát Unicode (lặp lại lỗi GĐ3/GĐ4) | Trung bình | CLAUDE.md §9.6: dựng `\` bằng `String.fromCharCode(92)`, quét byte trước commit |
| RR-19 | Điểm thật chỉ kiểm chứng với fixture; học liệu thật 0 mục đã duyệt, hồ sơ 1A2 chưa xác nhận → học sinh thật chưa có bài có điểm | Cao | Ưu tiên R10 (giao diện duyệt) + GV trả lời Q-01/Q-02 |
| RR-20 | Hiệu năng chỉ đo trên máy local (p95 104 ms); Vercel `sin1` ↔ Supabase Singapore và 4G chưa đo | Trung bình | Đo lại khi có Cloud dev (R11) bằng `perf.spec.ts` |
| RR-21 | Rút đồng ý chỉ hủy buổi dở + thu hồi thiết bị; **xóa** dữ liệu học tập/điểm đã lưu chưa hiện thực (cần xác nhận pháp lý thời hạn lưu giữ) | Trung bình | Quy trình xóa có kiểm soát (DATA_MODEL §10) — R10/R11 |
| RR-22 | Không giới hạn số câu tính điểm mỗi ngày (RQ-G5) — trẻ có thể dùng màn hình lâu | Thấp | Tham số `dailyScorableQuestionCap` khi GV yêu cầu |
| RR-23 | Script fixture bật `private.test_environment` bằng `supabase db query --local`; nếu ai đó áp dụng tay lên CSDL khác, fixture có thể ghi được | Thấp | Cờ mặc định tắt trong migration; script chỉ `--local`; danh mục triển khai Cloud kiểm cờ = false (R04_DATABASE_MIGRATIONS §8) |
| RR-24 | Thanh điều hướng đáy ở `/learn/me` không giữ `?student=` — thiết bị nhiều hồ sơ phải chọn lại hồ sơ | Thấp | Chấp nhận ở R04; cân nhắc lưu hồ sơ đang chọn ở cookie httpOnly |

## 8. Bước tiếp theo

**Đề xuất R05 — Leaderboard kiểu FIFA, avatar hình người, xếp hạng trong lớp** ([REDESIGN_TASKS R05](REDESIGN_TASKS.md#r05--leaderboard-kiểu-fifa-avatar-ranking-m)), dựng trên `season_scores` (chỉ mục `season_id, balance desc`, `balance_updated_at`) của R04. Điều kiện trước: người điều phối duyệt R04; rà soát pháp lý cờ `leaderboard_feature_approved` (Luật 91/2025 Điều 24); bộ avatar hình người có giấy phép (RQ-M1). Song song: R10 (giao diện duyệt học liệu, âm thanh) để có nội dung thật; quyết định tạo Supabase Cloud *dev*. Vẫn chờ RQ-06 (nhánh âm thanh), RQ-G1/G2/G5, RD-27/RD-28 (GV góp ý mức hỗ trợ và gợi ý).

## 9. Nhật ký phiên

| Ngày | Phiên | Giai đoạn | Tóm tắt |
|---|---|---|---|
| 2026-10-21 | R06.5 | R06 | API học sinh xem vinh danh gần nhất (`gateway_latest_honors`), chống snapshot trùng bằng khóa ý định + khóa lớp + khoảng chống lặp 15 giây; unit/pgTAP/DB/E2E đạt local. Không làm R07 |
| 2026-10-16 | R01 | R01 | Kiểm tra trạng thái (clone mới, không có công việc GĐ5); baseline xanh; nhánh `feature/home-learning-redesign` + checkpoint 2 PDF; hỏi 2 mâu thuẫn quy tắc BẮT BUỘC; 8 tài liệu mới + cập nhật 8 tài liệu; kiểm tra liên kết, NFC, secret; bộ kiểm tra xanh; commit + push nhánh. **Không** merge `main`, không deploy, không Supabase |
| 2026-10-20 | R02 | R02 | Kiểm tra trạng thái: thư mục ở `main` với công việc GĐ5 âm thanh chưa commit → cất vào nhánh cục bộ `local/gd5-audio-wip` (không push); chuyển sang `feature/home-learning-redesign`; baseline 729/729. Design system + 17 thành phần phiêu lưu; 22 asset SVG tự vẽ + `licenses.json` + kiểm tra trong `content:check`; trang chủ, `/learn` (Student Dashboard + Game World), `/demo` (xem trước Game World, H0 "Tự làm", bỏ phiếu), `/teacher` (menu 9 mục); CI `feature/**`; 781/781 unit, 254 E2E đạt (0 lỗi); đo khung hình và tối ưu vẽ; JS `/learn` 201 KB, `/demo` 227 KB gzip; tài liệu DESIGN_SYSTEM, ASSET_MANIFEST + cập nhật 8 tài liệu. Commit `8b178be` + push nhánh; GitHub Actions run 39357778681 xanh. **Không** merge `main`, không deploy, không Supabase |
| 2026-10-20 | R03 | R03 | Kiểm tra trạng thái (sạch; Audio WIP nguyên vẹn); bật Docker; Supabase CLI 2.121 local; 3 migration (16 bảng, RLS mọi bảng, hàm `teacher_*`/`gateway_*`, Auth Hook chặn tự đăng ký); proxy + DAL; `/login`, `/join`, `/learn/me`, `/teacher/classes/**`; đồng bộ kho tri thức + seed giả chạy lặp lại được; pgTAP 36, tích hợp CSDL 78, unit 819, E2E 262, E2E có CSDL 30; CI job `database` xanh; 4 tài liệu mới + cập nhật 10 tài liệu. Commit + push nhánh. **Không** tạo Supabase Cloud, không deploy, không merge `main` |
| 2026-10-20 | R04 | R04 | Kiểm tra trạng thái (sạch; Audio WIP nguyên vẹn; baseline 819 + 78). Scoring Engine thuần + vân tay nội dung; 2 migration (11 bảng, hàm ghi điểm một giao dịch, RLS chỉ SELECT, môi trường kiểm thử); fixture hư cấu chỉ local; Question Instance Service + 6 API; `/learn/me` điểm thật + bản đồ 3×3 + bốn khu vực, `/learn/me/practice`; unit 900, pgTAP 52, tích hợp 106, E2E 262 + 40 (CSDL); p95 chấm bài 104 ms (local); 4 tài liệu mới + cập nhật 9 tài liệu; 3 checkpoint + tài liệu push, CI xanh. **Không** tạo Supabase Cloud, không deploy, không merge `main`, không đụng nhánh Audio WIP |
| 2026-10-20 | R04 (tiếp, sau khi hết hạn mức) | R04 | Đọc lại tiến độ: 3 checkpoint đã push (CI run 39400938083 xanh), tài liệu R04 + sửa ngày fixture chưa commit. Khởi động lại Docker/Supabase local (sự cố `kong` mất ánh xạ cổng — §5.4). Chạy lại thật: format/lint/typecheck ✅, content:check 0 lỗi/52 cảnh báo, unit 900/900, build 18 route, check:bundle sạch, db:lint 0, pgTAP 52/52, seed ×2, test:db 106/106, test:e2e:db 40 đạt/17 bỏ qua; quét byte + secret 9 tệp sạch. Commit tài liệu `40c961e` + push nhánh; CI run 39434099659 xanh (`verify` + `database`). Không bắt đầu R05 |
| 2026-10-21 | R05 (nghiệm thu) | R05 | Chuyển kiểm thử nặng lên GitHub Actions (workflow E2E, 9 job, 1 worker); sửa 2 điểm chập chờn của test (hết giờ WebKit, fixture trùng fingerprint); CI + E2E xanh trên `83b34a7`; cập nhật tài liệu. Không bắt đầu R06 |
| 2026-10-21 | R06.1 | R06 | Backend vinh danh TOP 3: migration `20261023090000`, ảnh chụp bất biến, quyền owner/co_teacher+can_honor, cờ hệ thống tắt, đọc lọc theo quyền hiện tại; pgTAP 81, tích hợp 19 (mới), unit 967. Không làm giao diện/hoạt cảnh/reset |
| 2026-10-21 | R07.1 | R07 | Nghiệm thu R06; nguyên mẫu `/demo/treasure-maze` (SVG/CSS), đo FPS/bundle/bố cục thật, E2E 5 project; chọn React + SVG/CSS; CI chờ. Không làm R07.2 |
