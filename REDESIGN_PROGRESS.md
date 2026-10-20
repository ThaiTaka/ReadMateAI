# REDESIGN_PROGRESS — Tiến độ tái cấu trúc ReadMate AI

> **Cập nhật lần cuối:** 2026-10-20 — Phiên Claude Code R03
> Đọc tệp này **đầu tiên** ở mỗi phiên của lộ trình R (sau đó [REDESIGN_TASKS.md](REDESIGN_TASKS.md) và tài liệu liên quan). Lịch sử GĐ1–GĐ4 vẫn ở [PROGRESS.md](PROGRESS.md).

## 1. Trạng thái hiện tại

- **Giai đoạn:** R03 — Supabase, tài khoản, phân quyền, dữ liệu nền → **hoàn thành trên Supabase LOCAL; chờ người điều phối đánh giá.** Không tự chuyển sang R04.
- **Nhánh làm việc:** `feature/home-learning-redesign` — commit R03 đã push, GitHub Actions xanh (cả job `database`) — xem §4.3. `main` **không đổi**, không merge.
- **Mã nguồn:** R03 thêm CSDL Supabase (3 migration, 16 bảng, RLS), đăng nhập GV, thẻ học + liên kết thiết bị, quản lý lớp/học sinh/đồng ý, `/learn/me`. Điểm/bản đồ/xếp hạng vẫn là **dữ liệu minh họa hư cấu** (R04+). Bộ máy tiếng Việt và bài tập giữ nguyên.
- **Dịch vụ:** Supabase **local (Docker)** chạy và kiểm thử thật; **Supabase Cloud chưa tạo** (cần xác nhận tài khoản, tổ chức, region Singapore, chi phí). Vercel chưa liên kết; không AI, không TTS. CI có job `database` chạy Supabase local trên runner (không secret).

| R | Trạng thái |
|---|---|
| R01 | ✅ Đã chấp nhận (2026-10-20) |
| R02 | ✅ Đã chấp nhận (2026-10-20) |
| R03 | ✅ Hoàn thành (local) — chờ duyệt |
| R04–R11 | ⏸ Chưa bắt đầu ([REDESIGN_TASKS](REDESIGN_TASKS.md)) |

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
| GitHub Actions | ✅ Run [39381461701](https://github.com/ThaiTaka/ReadMateAI/actions/runs/39381461701) (checkpoint `4e5bb6a`): `verify` + `database` success; run của commit cuối ghi ở báo cáo R03 |

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

## 5. Nhật ký quyết định (lộ trình R)

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

## 6. Rủi ro mới (bổ sung PROGRESS §6)

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

## 7. Bước tiếp theo

**Đề xuất R04 — Scoring Engine, câu phát hành ở server, điểm thưởng, mở khóa bản đồ** ([REDESIGN_TASKS R04](REDESIGN_TASKS.md#r04--scoring-engine-điểm-thưởng-mở-khóa-bản-đồ-l)), dựng trên `getStudentLearningContext`, mùa 1 và student gateway của R03. Điều kiện trước: người điều phối duyệt R03; quyết định có tạo Supabase Cloud *dev* (Singapore) không; GV/nhà trường trả lời Q-01/Q-02 (bộ sách, tiến độ — không có thì học thật không có câu nào), duyệt kho câu (R10 song song), mẫu thông báo/phiếu đồng ý (Q-05). Vẫn chờ RQ-06 (nhánh âm thanh), RQ-M1/RQ-02.

## 8. Nhật ký phiên

| Ngày | Phiên | Giai đoạn | Tóm tắt |
|---|---|---|---|
| 2026-10-16 | R01 | R01 | Kiểm tra trạng thái (clone mới, không có công việc GĐ5); baseline xanh; nhánh `feature/home-learning-redesign` + checkpoint 2 PDF; hỏi 2 mâu thuẫn quy tắc BẮT BUỘC; 8 tài liệu mới + cập nhật 8 tài liệu; kiểm tra liên kết, NFC, secret; bộ kiểm tra xanh; commit + push nhánh. **Không** merge `main`, không deploy, không Supabase |
| 2026-10-20 | R02 | R02 | Kiểm tra trạng thái: thư mục ở `main` với công việc GĐ5 âm thanh chưa commit → cất vào nhánh cục bộ `local/gd5-audio-wip` (không push); chuyển sang `feature/home-learning-redesign`; baseline 729/729. Design system + 17 thành phần phiêu lưu; 22 asset SVG tự vẽ + `licenses.json` + kiểm tra trong `content:check`; trang chủ, `/learn` (Student Dashboard + Game World), `/demo` (xem trước Game World, H0 "Tự làm", bỏ phiếu), `/teacher` (menu 9 mục); CI `feature/**`; 781/781 unit, 254 E2E đạt (0 lỗi); đo khung hình và tối ưu vẽ; JS `/learn` 201 KB, `/demo` 227 KB gzip; tài liệu DESIGN_SYSTEM, ASSET_MANIFEST + cập nhật 8 tài liệu. Commit `8b178be` + push nhánh; GitHub Actions run 39357778681 xanh. **Không** merge `main`, không deploy, không Supabase |
| 2026-10-20 | R03 | R03 | Kiểm tra trạng thái (sạch; Audio WIP nguyên vẹn); bật Docker; Supabase CLI 2.121 local; 3 migration (16 bảng, RLS mọi bảng, hàm `teacher_*`/`gateway_*`, Auth Hook chặn tự đăng ký); proxy + DAL; `/login`, `/join`, `/learn/me`, `/teacher/classes/**`; đồng bộ kho tri thức + seed giả chạy lặp lại được; pgTAP 36, tích hợp CSDL 78, unit 819, E2E 262, E2E có CSDL 30; CI job `database` xanh; 4 tài liệu mới + cập nhật 10 tài liệu. Commit + push nhánh. **Không** tạo Supabase Cloud, không deploy, không merge `main` |
