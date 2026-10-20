# REDESIGN_PROGRESS — Tiến độ tái cấu trúc ReadMate AI

> **Cập nhật lần cuối:** 2026-10-20 — Phiên Claude Code R02
> Đọc tệp này **đầu tiên** ở mỗi phiên của lộ trình R (sau đó [REDESIGN_TASKS.md](REDESIGN_TASKS.md) và tài liệu liên quan). Lịch sử GĐ1–GĐ4 vẫn ở [PROGRESS.md](PROGRESS.md).

## 1. Trạng thái hiện tại

- **Giai đoạn:** R02 — giao diện mới, trang học sinh, Game World (dữ liệu minh họa) → **hoàn thành; chờ người điều phối đánh giá.** Không tự chuyển sang R03.
- **Nhánh làm việc:** `feature/home-learning-redesign` — commit R02 `8b178be` đã push; CI run 39357778681 xanh. `main` **không đổi**, không merge.
- **Mã nguồn:** giao diện đã theo định hướng mới (trang chủ, `/learn`, `/demo`, `/teacher`); bộ máy tiếng Việt và bộ máy bài tập GĐ3–GĐ4 giữ nguyên (chỉ đổi nhãn H0 và bố cục H1/H0). Điểm/bản đồ/xếp hạng là **dữ liệu minh họa hư cấu**, không lưu.
- **Dịch vụ:** Vercel **chưa liên kết**; Supabase **chưa tạo**; không AI, không TTS. CI GitHub Actions nay chạy cả trên push `feature/**`.

| R | Trạng thái |
|---|---|
| R01 | ✅ Đã chấp nhận (2026-10-20) |
| R02 | ✅ Hoàn thành — chờ duyệt |
| R03–R11 | ⏸ Chưa bắt đầu ([REDESIGN_TASKS](REDESIGN_TASKS.md)) |

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

## 4. Nhật ký quyết định (lộ trình R)

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
| RD-14 | Công việc GĐ5 âm thanh tìm thấy chưa commit trên máy → giữ ở nhánh cục bộ `local/gd5-audio-wip`, không push, chờ quyết định | Chờ người điều phối (RQ-06) | §1.1 |

## 5. Rủi ro mới (bổ sung PROGRESS §6)

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

## 6. Bước tiếp theo

**Đề xuất R03 — Supabase, tài khoản, phân quyền, dữ liệu nền** ([REDESIGN_TASKS R03](REDESIGN_TASKS.md#r03--supabase-tài-khoản-phân-quyền-dữ-liệu-l)). Điều kiện trước: người điều phối duyệt R02; cho phép tạo dự án Supabase *dev* (Singapore) và dùng `npx supabase`; bật Docker Desktop (Supabase local); hướng trả lời Q-05. Cần quyết định RQ-06 (nhánh `local/gd5-audio-wip`) và GV góp ý bộ phác thảo (RQ-M1, RQ-02).

## 7. Nhật ký phiên

| Ngày | Phiên | Giai đoạn | Tóm tắt |
|---|---|---|---|
| 2026-10-16 | R01 | R01 | Kiểm tra trạng thái (clone mới, không có công việc GĐ5); baseline xanh; nhánh `feature/home-learning-redesign` + checkpoint 2 PDF; hỏi 2 mâu thuẫn quy tắc BẮT BUỘC; 8 tài liệu mới + cập nhật 8 tài liệu; kiểm tra liên kết, NFC, secret; bộ kiểm tra xanh; commit + push nhánh. **Không** merge `main`, không deploy, không Supabase |
| 2026-10-20 | R02 | R02 | Kiểm tra trạng thái: thư mục ở `main` với công việc GĐ5 âm thanh chưa commit → cất vào nhánh cục bộ `local/gd5-audio-wip` (không push); chuyển sang `feature/home-learning-redesign`; baseline 729/729. Design system + 17 thành phần phiêu lưu; 22 asset SVG tự vẽ + `licenses.json` + kiểm tra trong `content:check`; trang chủ, `/learn` (Student Dashboard + Game World), `/demo` (xem trước Game World, H0 "Tự làm", bỏ phiếu), `/teacher` (menu 9 mục); CI `feature/**`; 781/781 unit, 254 E2E đạt (0 lỗi); đo khung hình và tối ưu vẽ; JS `/learn` 201 KB, `/demo` 227 KB gzip; tài liệu DESIGN_SYSTEM, ASSET_MANIFEST + cập nhật 8 tài liệu. Commit `8b178be` + push nhánh; GitHub Actions run 39357778681 xanh. **Không** merge `main`, không deploy, không Supabase |
