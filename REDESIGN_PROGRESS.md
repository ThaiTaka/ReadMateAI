| 2026-10-21 | R06.4 | R06 | Giao diện reset hai bước (BẮT ĐẦU MÙA MỚI → gõ tên lớp), requestId một lần mỗi lần mở, SEASON_MISMATCH/CONFIRMATION_MISMATCH, `season.id` từ máy chủ; unit +9, E2E season-reset 9/9 local (3 project). Không làm R06.5 |
# REDESIGN_PROGRESS — Tiến độ tái cấu trúc ReadMate AI

> **Cập nhật lần cuối:** 2026-10-28 — Phiên Claude Code R10.3b2-P0b (giọng nam miền Nam Viettel AI Minh Quân làm mặc định của công cụ nghe thử; **CHƯA GỌI API THẬT, CHƯA NGHE GIỌNG THẬT**); trước đó 2026-10-28 — R10.3b2-P0 (công cụ nghe thử giọng AI tiếng Việt: adapter FPT.AI + so sánh giọng; **CHƯA THỬ API THẬT**); trước đó 2026-10-28 — Phiên Claude Code R10.3b1 (chuẩn bị TTS: danh mục lời đọc, kế hoạch lô, phiên bản, điều kiện phát; KHÔNG gọi TTS thật); trước đó 2026-10-27 — Phiên Claude Code R10.3a (phát bản ghi giáo viên đã duyệt cho học sinh, cờ TẮT; R10.3 chưa nghiệm thu); trước đó 2026-10-26 — R10.1 (Audio Engine, thiết kế); trước đó 2026-10-25 — Phiên Claude Code R08.6 (chơi lại Mê cung không tính điểm; R08 xong về kỹ thuật, chờ GV duyệt hình/học liệu)
> Đọc tệp này **đầu tiên** ở mỗi phiên của lộ trình R (sau đó [REDESIGN_TASKS.md](REDESIGN_TASKS.md) và tài liệu liên quan). Lịch sử GĐ1–GĐ4 vẫn ở [PROGRESS.md](PROGRESS.md).

## 1. Trạng thái hiện tại

- **R10.3b2-P0b xong về mã/test (2026-10-28; CI/E2E ghi trong báo cáo phiên): chủ dự án chọn giọng AI nam miền Nam → adapter Viettel AI (`src/server/tts/viettel-provider.ts`), giọng `viettel-hcm-minhquan` (nam, miền Nam) là mặc định của `npm run tts:poc` (thay hai giọng nữ FPT; giọng cũ vẫn dùng để đối chiếu), biến `TTS_VIETTEL_TOKEN` chỉ phía máy chủ, `/teacher/tts-compare` hiện giọng mới. **CHƯA GỌI API THẬT, CHƯA NGHE GIỌNG THẬT: không có token.** Giao thức Viettel lấy từ mã chạy của chính trang web Viettel AI vì trang tài liệu chính thức không đọc được bằng công cụ — phần giá/hạn mức/`without_filter`/dải tốc độ/trần ký tự trả phí chưa xác minh. Vbee chưa tích hợp (chưa xác minh được API). Dữ liệu TTS vẫn tách hẳn bản ghi giáo viên; mọi cờ âm thanh TẮT; không mở phát cho học sinh (§5x).**
- **R10.3b2-P0 xong về mã/test (2026-10-28; CI/E2E xem nhật ký phiên): công cụ NGHE THỬ giọng AI tiếng Việt — adapter FPT.AI TTS v5 (có kiểm tra liên kết chống SSRF, hỏi lại có giới hạn), khóa giọng nghe thử Google Neural2, `npm run tts:poc` (mặc định chạy khô; chạy thật cần `--live` + `TTS_POC_COST_CONFIRMED=yes` + khóa), trang giáo viên `/teacher/tts-compare`. **CHƯA THỬ API THẬT: chưa có khóa nào, chưa gọi API nào, chưa có tệp, chưa giọng nào được nghe.** Không bảng/migration/Storage TTS, không đường phát cho học sinh, mọi cờ TẮT, không bản ghi `approved` từ tệp AI. Chờ: khóa thử + xác nhận chi phí (chủ dự án), P6/P7, giáo viên nghe và chọn giọng (§5w).**
- **R10.3b1 xong về kỹ thuật (2026-10-28; CI/E2E xem nhật ký phiên): hệ thống CHUẨN BỊ TTS — TTS Script Catalog (34 lời đọc tĩnh, mọi mục `pending_review`), duyệt lời đọc + phiên bản tệp bất biến, khóa tái sử dụng có phiên bản cấu hình giọng, kiểm tra kỹ thuật tệp (byte mock bị từ chối), điều kiện phát dùng lại AD-35, kế hoạch/chạy lô có giới hạn, trang xem trước `/teacher/tts-script` ("BẢN THỬ NGHIỆM — DỮ LIỆU MINH HỌA", chỉ đọc). KHÔNG gọi TTS thật, KHÔNG tệp âm thanh TTS, KHÔNG migration/route phát, mọi cờ phát TẮT; R10.3 CHƯA nghiệm thu. Chờ quyết định ở [TTS_APPROVAL_CHECKLIST](docs/TTS_APPROVAL_CHECKLIST.md) (§5v).**
- **R10.3a nghiệm thu kỹ thuật CI/E2E (2026-10-28, commit `c6b98fa`: CI + E2E push/PR đều xanh, xem §5u "Nghiệm thu CI/E2E").** R10.3a xong về kỹ thuật (2026-10-27): nền tảng phát bản ghi GV đã duyệt cho học sinh — hàm CSDL `gateway_resolve_teacher_audio` + 2 route `…/audio[/{role}]` + `AudioSlot` phát được + `QuestionAudio`; cờ `student_teacher_audio_playback_approved` TẮT; fixture sóng tổng hợp; câu bắt buộc nghe mà thiếu âm thanh không tính điểm. KHÔNG TTS, KHÔNG ghép chuỗi đánh vần; R10.3 chưa nghiệm thu (xem §5u).**
- **R10.2 xong về kỹ thuật (2026-10-27; CI chờ): trang `/teacher/audio` (ghi âm bằng MediaRecorder + tải tệp, nghe lại, ghi lại, lưu nháp, gửi duyệt, duyệt/yêu cầu ghi lại/thu hồi), 38 âm P0 dự kiến từ kho tri thức, đồng ý dùng giọng (ô không chọn sẵn), bucket Storage riêng tư `teacher-audio`, migration `20261031090000` (3 bảng, 11 hàm, trigger bất biến, cờ `teacher_audio_recording_approved` TẮT), `Permissions-Policy microphone=(self)` chỉ ở `/teacher/audio`, kiểm tra tệp theo nội dung (WAV/Ogg/WebM/MP4/MP3), proxy phát lại có Range, `npm run audio:reconcile`. Kiểm thử: 90+ unit mới, pgTAP 13, DB `audio-library`, E2E `teacher-audio` (CSDL + Storage chạy ở CI; Docker local không chạy). KHÔNG có bản ghi thật, KHÔNG bản nào được duyệt, KHÔNG gọi TTS, `AudioSlot` vẫn khóa. Chờ: GV xác nhận cách đọc (Q-01/Q-02/Q-03), đồng ý dùng giọng, kiểm tra iPhone/micro thật. **CI/E2E GitHub xanh trên commit `0f350d7`** (CI push + PR; E2E: 5 project không CSDL + 4 project có CSDL/Storage; E2E push webkit-mobile bị hủy một lần rồi chạy lại xanh). Hai lỗi do mã thật được E2E bắt và đã sửa: form cách đọc mất thông báo vì `key` đổi theo dữ liệu (remount sau refresh); test chọn nhầm nút `g` ↔ `gh`/`gi`. Không làm R10.3 — [AUDIO_ENGINE §12](docs/AUDIO_ENGINE.md).**
- **R10.1 xong về thiết kế/mã (CI chờ): [docs/AUDIO_ENGINE.md](docs/AUDIO_ENGINE.md) (so sánh Google/Azure/FPT.AI theo tài liệu chính thức 2026-10-26), [docs/AUDIO_RECORDING_PLAN.md](docs/AUDIO_RECORDING_PLAN.md) (DỰ KIẾN: 38 âm P0 + 143 vần nhiều chữ, ≈ 60 phút ghi, 4–5 buổi 15–20 phút), adapter `TtsProvider` (`src/server/tts/`: none/mock/google-skeleton, kiểm tra đầu vào, hạn mức, timeout, kế hoạch theo `audioPolicy`+`checkAudioLeaks`) + 21 unit test. KHÔNG gọi API thật (chưa có khóa được cấp phép — POC BLOCKED), KHÔNG nghe thử giọng, `AudioSlot` vẫn khóa, không route/migration/gọi hàng loạt. Đề xuất POC: Google Neural2 (chưa chọn/mua). Chờ chủ dự án D1–D6 (AUDIO_ENGINE §10). R10.2 chưa làm.**
- **R08.6 xong (CI chờ): chơi lại Mê cung đã hoàn thành — vẫn 7 quái vật × 21 câu, 3 trái tim, kho báu, tự lưu, nhưng KHÔNG cộng/trừ điểm; nhãn "Chơi lại — không tính điểm" — §5t.** R08 xong **về kỹ thuật**; **chưa được phê duyệt dùng thật**: GV chưa duyệt hình/tên/lời thoại quái vật (R08.5 chỉ xong phần kỹ thuật) và kho học liệu thật 0 mục đã duyệt. R09 tiếp tục hoãn; bước tiếp theo theo lộ trình là R10 (chỉ làm khi được giao).
- **R08.4 xong (CI chờ): giao diện chạm trán — lưu trước rồi kích hoạt, màn quái vật (3 trái tim, Player GĐ4, điểm/HP của máy chủ), hoạt cảnh defeated/undefeated, quay lại mê cung, tải lại giữa chạm trán, mở kho báu sau 7/7 — §5r.** E2E toàn trình 7 chạm trán xanh local (chromium desktop/mobile, webkit mobile). Bước tiếp: R08.5 (kiểm tên/lời thoại/hình quái vật, giấy phép, hồ sơ cho GV duyệt).
- **R08.3 xong (database + API + nghiệp vụ máy chủ, chưa có UI; CI chờ): kích hoạt chạm trán theo vị trí lưu ở CSDL, chấm điểm + HP quái vật trong một giao dịch, kết thúc defeated/undefeated, mở kho báu, mã lỗi tiếng Việt — §5q.** Bước tiếp: R08.4 (giao diện quái vật, ba trái tim, câu hỏi, hoạt cảnh, quay lại mê cung).
- **R08.2 xong (CI xanh `042ab92`: CI 39767413174 + 39767403593, E2E 39767413264 + 39767403637 — job `E2E database webkit-mobile` của run push treo 30 phút, đã hủy và chạy lại thì xanh): bắt đầu lượt phân bổ 7 chạm trán + 21 câu trong một giao dịch, thiếu nội dung → `INSUFFICIENT_CONTENT` — §5p (kèm thiết lập máy mới).** Production chưa có học liệu duyệt nên chưa tạo được lượt thật. Bước tiếp: R08.3 (kích hoạt, chấm điểm + HP, kết thúc chạm trán, kho báu).
- **R08.1 xong (CI xanh `24d8007`: CI 39726933304, E2E 39726933408): migration `game_encounters` + `game_level_triggers` + ngữ cảnh `game_encounter` của `question_instances` + chặn lưu vị trí xuyên điểm kích hoạt + reset mùa đóng chạm trán — §5o.** Chưa phân bổ thật (R08.2). Bước tiếp: R08.2.
- **R07.6 xong (CI xanh `8701cfa`): lớp phủ tạm dừng, rời màn chờ xác nhận lưu, hoạt cảnh quay mặt mượt, đo lại FPS/bundle — R07 nghiệm thu về engine/đồ họa/điều khiển/lưu vị trí/bảo mật lượt chơi (chưa phải mini-game hoàn chỉnh, xem §5n).** Bước tiếp: R08.1 (migration `game_encounters`).
- **R07.5b2 xong (chờ CI): trang `/learn/me/games/treasure-maze` nối API lượt chơi — tự lưu vị trí, khôi phục sau tải lại, xử lý `STATE_CONFLICT`/`SEASON_CLOSED`/mất mạng — §5m. R07.5b1 đã nghiệm thu (CI + E2E xanh `65328eb`). **Lộ trình nộp dự án: R07 → R08 → R10 → R11 → NỘP; R09 tạm hoãn sau khi nộp (không bắt đầu trước ngày nộp).**
- (trước đó) **R07.4 xong: `/demo/treasure-maze` đi lại được (bàn phím + 4 nút cảm ứng), camera phóng to trên điện thoại, tạm dừng, thử thách minh họa — §5k. Chờ CI.**
- (trước đó) **R07.3 xong: 3 màn JSON `content/games/treasure-maze/levels/` (9×9, 11×11, 13×13) + zod `game-engine/levels/` + `content:check` kiểm màn — §5j.**
- (trước đó) **R07.2 xong: lõi Game Engine thuần TS `src/features/game-engine/core/` (24 unit test); chờ CI — §5i.**
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
| R07 | ✅ R07.1–R07.6 xong (CI xanh `8701cfa`); nghiệm thu phần engine/đồ họa/điều khiển/lưu vị trí/bảo mật lượt; mini-game đầy đủ ở R08 |
| R08 | 🔄 R08.1–R08.3 (§5o–§5q) + R08.4 (§5r) + **R08.5 phần kỹ thuật (§5s)** xong; **GV chưa duyệt quái vật (chờ xác nhận thực tế)**; R08.6 chưa làm |
| R10 | 🔄 R10.1 xong (thiết kế + adapter, POC chờ khóa); **R10.2 xong về kỹ thuật (thư viện bản ghi GV, chưa dùng với GV thật)**; **R10.3a xong về kỹ thuật (phát bản ghi đã duyệt, cờ TẮT, chưa nghiệm thu thực tế)**; **R10.3b1 xong về kỹ thuật (chuẩn bị TTS, không gọi dịch vụ thật)**; **R10.3b2-P0 xong về mã (công cụ nghe thử giọng, CHƯA THỬ API THẬT)**; R10.3b2 đầy đủ–R10.7 chưa bắt đầu |
| R11 | ⏸ Chưa bắt đầu ([REDESIGN_TASKS](REDESIGN_TASKS.md)) |
| R09 | ⏸ **Tạm hoãn sau khi nộp dự án** (chủ dự án 2026-10-21) |

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

## 5l. R07.5a — Database lượt chơi Mê cung (2026-10-21)

Migration `20261026090000_r07_game_runs.sql` + `20261026090100_r07_reset_voids_game_runs.sql`. Chưa có API Next.js/UI (R07.5b).

- **Bảng `game_runs`** (RLS, chỉ SELECT: thiết bị thấy lượt của mình, GV thấy lớp mình): `status` in_progress/completed/abandoned/void_season_reset; `scored`; `position` {row,col}; `state_version`; `ended_at`, `treasure_opened_at` (R08). Unique một lượt đang chơi mỗi học sinh/màn; unique một lượt `scored` mỗi màn mỗi mùa; FK (học sinh,lớp), (mùa,lớp), phiên bản màn. Trigger: vị trí phải là ô đi được của đúng phiên bản màn, trường định danh bất biến, `state_version` = +1 đúng khi vị trí đổi, không xóa trực tiếp.
- **Bản đồ trong CSDL:** `private.game_levels` (3 màn sinh từ JSON; `level_version` = SHA-256 các hàng nối LF — test đối chiếu với tệp JSON).
- **RPC (chỉ service_role):** `gateway_start_game_run(auth_user, student, game, level)` — liên kết thiết bị, đồng ý `learning_data`, mùa active (FOR SHARE), **điểm hiện tại ≥ 50** (`scoring_rules.game_min_balance`, balance chứ không earned_total, không trừ điểm); có lượt dở → `resumed`. `gateway_save_game_position(auth_user, student, run, path, state_version)` — `path` = tối đa 64 bước kề nhau sau vị trí đã lưu, mỗi bước kiểm biên/tường (không dịch chuyển tức thời); version khác → `STATE_CONFLICT`; gửi lại yêu cầu đã thành công → `replayed`; chuỗi rỗng/không đổi → `unchanged` (không tăng version). Mã lỗi: INVALID_INPUT, FORBIDDEN, NOT_FOUND, CONSENT_REQUIRED, SEASON_CLOSED, INSUFFICIENT_POINTS, INSUFFICIENT_CONTENT, STATE_CONFLICT, INVALID_POSITION, RUN_NOT_ACTIVE.
- **Chính sách nội dung:** R08 chưa phân bổ 7 chạm trán/21 câu ⇒ tạo lượt mới luôn `INSUFFICIENT_CONTENT`. Chỉ khi cờ LOCAL `private.test_environment.game_run_fixtures_allowed` (mặc định TẮT, cần cả `fixtures_allowed`) mới tạo lượt `scored = false` để kiểm thử lưu trạng thái. Không đường nào tạo lượt tính điểm. **R08 phải thay cổng này** bằng phân bổ thật.
- **Reset mùa:** `private.reset_class_season` thay bằng migration mới (R06.3 giữ nguyên), thêm bước đóng `game_runs` in_progress → `void_season_reset` cùng giao dịch; `season_resets.voided_game_runs`. Thứ tự khóa lớp → mùa → dòng con; lưu vị trí khóa mùa FOR SHARE → dòng lượt, nên song song với reset ra "lưu trước, reset thấy" hoặc `SEASON_CLOSED`.
- **Giới hạn/R08:** lưu vị trí không kích hoạt chạm trán nên một đường lưu có thể đi qua ô kích hoạt — R08 phải ghi nhận việc bước vào điểm kích hoạt phía server (chặn đi qua khi còn chạm trán chưa xong). Ngưỡng 50 cũng xét khi tiếp tục lượt dở (điểm tụt dưới 50 thì chưa vào lại được). Kiểm thử: pgTAP `08_game_runs` 23, tích hợp `game-runs.test.ts` 16.

## 5o. R08.1 — Database 7 chạm trán + schema 21 câu (2026-10-22)

Migration `20261027090000_r08_encounters.sql` + `20261027090100_r08_reset_voids_encounters.sql`. **Chỉ schema và ràng buộc** — không phân bổ chạm trán/câu thật (R08.2), không API kích hoạt/chấm (R08.3), không UI.

- **Test chập chờn R07 (CI `39703541786`):** `season-reset-ui.test.tsx` "thử lại sau lỗi tạm thời" — thông báo lỗi hiện *trước* khi `pending` của transition tắt, nên nút xác nhận còn `disabled` và cú nhấp thứ hai bị bỏ qua (mock chỉ được gọi 1 lần). Lỗi chờ bất đồng bộ của test, không phải lỗi nghiệp vụ (nút khóa khi đang gửi là hành vi đúng). Sửa: chờ nút bật lại (`waitFor … toBeEnabled`) trước cú nhấp; không nới assertion. Chạy lặp 3 lần: 9/9.
- **`private.game_level_triggers`:** 7 điểm kích hoạt mỗi phiên bản màn (21 dòng), FK tới `game_levels` (đúng `level_version`), unique id và tọa độ, trigger bắt buộc nằm trên ô đường đi, bất biến (`block_change`); migration kiểm đủ 7/màn. Test đối chiếu CSDL ↔ JSON (id + tọa độ). Tọa độ không bao giờ nhận từ trình duyệt.
- **`game_encounters`:** đủ cột theo yêu cầu; check `encounter_no` 1–7, HP 0–3, status 5 giá trị, ràng buộc trạng thái ↔ thời điểm ↔ vị trí quay lại (defeated ⇒ HP 0, undefeated ⇒ HP > 0); unique `(run_id, encounter_no)`, `(run_id, trigger_key)`, `(run_id, monster_key)`; unique một chạm trán `active` mỗi lượt; **khóa ngoại tổng hợp** `(run_id, student_id, class_id, season_id)` → `game_runs` (khớp chính xác). Trigger `guard_game_encounter` (áp dụng cả service_role): khóa lượt FOR SHARE; lượt phải `in_progress` + `treasure_maze`; trạng thái đầu `pending`; **chạm trán thứ tám bị từ chối** (`ENCOUNTER_LIMIT`, ngoài ra check 1–7 và unique); trigger phải thuộc đúng phiên bản màn của lượt (`UNKNOWN_TRIGGER`); trigger/quái vật/định danh bất biến; chuyển trạng thái chỉ pending→active|void, active→defeated|undefeated|void; đã kết thúc không đổi/mở lại (`ENCOUNTER_FINISHED`); HP chỉ giảm 1 bước khi `active`; vị trí quay lại/thời điểm kích hoạt đặt một lần; không xóa trực tiếp.
- **21 câu (`question_instances`):** `context_kind` thêm `game_encounter`; cột `run_id`, `game_encounter_id` (khóa ngoại tổng hợp cùng học sinh/lớp/mùa/lượt, cascade); check hình dạng ngữ cảnh (luyện tập: có buổi, không lượt/chạm trán; game: có lượt + chạm trán, không buổi, vị trí 1–3); unique `(game_encounter_id, position)`, `(run_id, exercise_item_id)`, `(run_id, content_fingerprint)` → đúng 3 câu riêng biệt mỗi chạm trán, không lặp nội dung trong lượt. Guard chèn: chạm trán phải `pending|active` và lượt `in_progress`; vẫn chỉ nội dung `approved`; `run_id`/`game_encounter_id` bất biến. Chỉ mục chống tính điểm lặp R04 (`question_instances_scorable_once`) và bài luyện R04 **không đổi**. Không tạo câu giả.
- **RLS:** `game_encounters` bật RLS, chỉ policy SELECT; GV thấy lớp mình; thiết bị chỉ thấy dòng của chính học sinh **đã kích hoạt/kết thúc** (`status <> 'pending'`) — dòng chờ ẩn nên không lộ điểm kích hoạt/quái vật chưa gặp; thiết bị bị thu hồi/học sinh lớp khác không thấy gì; client không INSERT/UPDATE/DELETE. `game_level_triggers` ở schema private, chỉ service_role. Chưa có API đọc chạm trán cho học sinh (R08.3 chỉ trả chạm trán hiện tại).
- **Chặn bỏ qua chạm trán** (`gateway_save_game_position` thay bằng migration mới + `private.game_check_encounter_path`): (a) lượt có chạm trán — không đi xuyên hay rời ô kích hoạt chưa xử lý (`ENCOUNTER_PENDING`), chỉ được *dừng* tại đó; không di chuyển khi có chạm trán `active` (`ENCOUNTER_ACTIVE`); (b) lượt `scored` mà số chạm trán ≠ `encounter_count` không hoạt động, kể cả chỉ báo còn hoạt động (`ENCOUNTERS_INCOMPLETE`); (c) lượt fixture `scored = false` chưa có chạm trán giữ nguyên hành vi R07. **Còn phải làm ở R08.3:** hàm kích hoạt (pending→active, `return_position` từ vị trí đã lưu, kiểm ô đang đứng là ô trigger), chấm câu/HP trong hàm ghi điểm, mở kho báu khi 7/7, ánh xạ 4 mã lỗi mới sang API.
- **Reset mùa:** `private.reset_class_season` thay bằng migration mới: sau khi void `game_runs` (7b), `game_encounters` `pending|active` → `void` + `resolved_at` (7c); đã kết thúc giữ nguyên; không xóa lịch sử; `season_resets.voided_encounters`. Thứ tự khóa lớp → mùa → lượt → chạm trán (cũng là thứ tự insert/guard) ⇒ không deadlock; insert song song với reset hoặc bị từ chối (`RUN_NOT_ACTIVE`) hoặc được void. Câu game còn mở đã bị bước (7) void. Idempotency R06 giữ nguyên.
- **Kiểm thử (local):** pgTAP 186 (9 tệp; mới `09_game_encounters` 54), `test:db` 216/216 (11 tệp; mới `game-encounters.test.ts` 22: đối chiếu JSON, 7/8 chạm trán, đồng thời, trạng thái, RLS, thu hồi thiết bị, 21 câu, đường đi, cờ fixture TẮT, reset + reset song song), `db:lint` 0 lỗi, format/lint/typecheck xanh. Toàn bộ Playwright và unit chạy ở GitHub Actions. **CI/E2E:** commit `a72907f` đỏ job Supabase vì CLI trên CI in mảng JSON trần (test đối chiếu đã sửa chấp nhận cả hai dạng); trên `24d8007` CI xanh, E2E có 3 job chập chờn lần đầu (xếp hạng iPad, thẻ học chromium-mobile, hai tab webkit-mobile — không liên quan R08.1, UI không đổi) và xanh toàn bộ sau khi chạy lại phần lỗi.

## 5p. R08.2 — Phân bổ 7 chạm trán + 21 câu khi bắt đầu lượt, và dựng lại máy mới (2026-10-22)

### Máy mới (thiết lập LOCAL, kiểm tra thật)

- Repo clone sạch: nhánh `feature/home-learning-redesign`, HEAD `ff1b582`, working tree sạch, `origin` = `ThaiTaka/ReadMateAI`. `git config --local user.email` chưa có → đặt email noreply của chính tài khoản `ThaiTaka` (id lấy từ `gh api user`, không tự bịa). Không đụng `D:\ReadMateAI_backup_20261022` và nhánh `local/gd5-audio-wip`; không chép `.env.local` từ bản sao lưu.
- **Node:** máy cài sẵn Node **26.7.0** (không đúng `engines: 24.x`). Cài **Node 24.18.0** dạng zip cạnh nhau ở `%LOCALAPPDATA%\node24` (SHA-256 khớp `SHASUMS256.txt`; npm 11.16.0 — đúng bản CLAUDE.md §4) và đặt `PATH` theo từng phiên; **không** gỡ Node 26 hay sửa PATH hệ thống (cần Administrator). Phiên mới trên máy này phải đặt `$env:Path = "$env:LOCALAPPDATA\node24;$env:Path"` trước khi chạy npm.
- **Docker Desktop 4.86** đã cài nhưng chưa chạy → khởi động thủ công bằng `Docker Desktop.exe` (engine 29.7.2). `npm ci` sạch (cảnh báo `allow-scripts` của npm 11.16 về `unrs-resolver` chỉ là thông báo), Supabase CLI 2.121.0, Playwright Chromium + WebKit đã cài. `db:start` áp dụng 13 migration đến R08.1, `db:env` (khóa local mới, không in), `db:seed` (1 trường, 2 GV, 3 lớp, 9 học sinh giả).
- Kiểm tra môi trường trước R08.2: `db:lint` 0 lỗi, `db:test` 186 pgTAP, `typecheck`, `lint` (0 lỗi; 1 cảnh báo cũ `normalizeClassName` ở `season-reset.test.ts` — không liên quan, giữ nguyên), `format:check`, `content:check` (0 lỗi, 64 cảnh báo cũ) — đều xanh. Chưa chạy toàn bộ E2E (giao CI).

### R08.2

Migration `20261028090000_r08_start_allocation.sql`. **Không** có API kích hoạt/chấm/HP/kho báu (R08.3), **không** UI.

- **`gateway_start_game_run(auth, student, game, level, p_plan jsonb default null)`** thay bản 4 tham số (bản cũ bị `drop` để PostgREST không gặp hai hàm trùng tên). Một lệnh gọi = một giao dịch: **1 `game_runs` (`scored = true`) + 7 `game_encounters` + 21 `question_instances`**; lỗi ở bất kỳ bước nào → rollback toàn bộ (kiểm bằng trigger chèn lỗi ở câu thứ 21: không còn lượt/chạm trán/câu/audit, tạo lại bình thường sau đó).
- **Ai chọn gì.** Trình duyệt chỉ gửi mã màn. Máy chủ (`src/server/game-runs/student.ts`) lấy ứng viên từ `gateway_practice_candidates` rồi lập kế hoạch bằng hàm thuần `src/features/game-runs/planner.ts` (bỏ trùng vân tay, chỉ câu **chưa tính điểm trong mùa**, ưu tiên bài gần nhất, chia 7 × 3, 7 mã quái vật khác nhau từ `monsters.ts`; mức hỗ trợ H3/H2/H1 và số lượt theo `SUPPORT_POLICIES` như buổi luyện R04). **CSDL không tin kế hoạch**: kiểm lại hình dạng (`private.game_plan_shape_ok`: đúng 7 × 3, mã quái vật đúng định dạng và khác nhau, mức hỗ trợ 0–3, số lượt 1–3), từng câu thuộc `private.eligible_items` (approved, đúng chuỗi bài đã xác nhận, đã học — Nhóm 3 đến bài trước, hợp nhóm, fixture chỉ khi môi trường kiểm thử bật), 21 câu khác nhau cả `exercise_item_id` lẫn `content_fingerprint`, chưa từng tính điểm trong mùa. Trigger (tọa độ), 7 điểm kích hoạt đọc từ `game_level_triggers` của đúng `level_version` (chạm trán n ↔ điểm kích hoạt thứ n theo khóa). Chạm trán khởi tạo `pending`, 3 HP, chưa kích hoạt/kết thúc. Mọi câu `scorable = true`.
- **Mã lỗi:** thiếu nội dung/trùng nội dung/đã tính điểm → `INSUFFICIENT_CONTENT`; câu không đủ điều kiện (chưa duyệt, chưa học, ngoài nhóm, fixture khi tắt môi trường kiểm thử, mã lạ) → `CONTENT_NOT_ELIGIBLE`; kế hoạch sai hình dạng → `INVALID_INPUT`; lượt tính điểm của màn đã kết thúc trong mùa → `RUN_NOT_ACTIVE` (chơi lại không tính điểm là R08.6). Thứ tự khóa lớp → mùa (FOR SHARE) → dòng điểm mùa của học sinh (FOR UPDATE, `lock_season_score`) → lượt → chạm trán → câu (khớp R04–R08.1): hai tab → một lượt, luyện tập song song bị tuần tự hóa; reset mùa song song: hoặc `SEASON_CLOSED`, hoặc lượt/chạm trán/câu mới đều bị void — kiểm lặp 3 vòng, không deadlock.
- **Tiếp tục lượt:** đã có lượt `in_progress` → trả đúng lượt (`resumed`), không phân bổ lại, không đổi vị trí/`state_version`/HP/điểm, bỏ qua kế hoạch mới. **Thay đổi so với R07.5a:** kiểm tra này nay đứng **trước** ngưỡng 50 điểm — nếu không, một câu sai (−5) giữa chừng sẽ khóa học sinh khỏi lượt đang dở. Lượt **mới** vẫn cần điểm hiện tại ≥ 50 (đúng 50 được vào, 40 bị từ chối, không trừ điểm khi vào).
- **Không kế hoạch** (`p_plan` null): `INSUFFICIENT_CONTENT`; riêng khi cờ `game_run_fixtures_allowed` của môi trường kiểm thử LOCAL bật mới còn tạo lượt **không tính điểm**, không chạm trán (hành vi R07.5a để các test lưu vị trí cũ chạy nguyên). Cờ mặc định tắt trong migration (pgTAP kiểm giá trị mặc định); production không có đường tạo lượt tính điểm nếu không có 21 câu đã duyệt.
- **Nội dung production:** kho `content/` vẫn **0 mục đã duyệt** → lượt chơi thật **chưa** tạo được ở production (đúng thiết kế, đã kiểm: fixture bị từ chối khi tắt môi trường kiểm thử). Cần GV duyệt học liệu (R10) và xác nhận tiến độ lớp để có ≥ 21 câu khác nhau cho mỗi học sinh/mùa. Lưu ý dung lượng: 21 câu **giữ chỗ** nội dung trong mùa (luyện tập sau đó thấy chúng là "đã tính điểm" → không tính lại), nên mỗi học sinh cần kho đủ lớn cho cả buổi luyện lẫn các màn — quy mô kho cần tính ở R10.
- **Fixture LOCAL:** `scripts/fixtures/game-items.ts` + `scripts/lib/game-fixtures.ts` (chuỗi bài kiểm thử **riêng** `series:test-fixture-r08`; 24 nội dung khác nhau ở bài 1, 32 ở bài ≤ 2, kèm bản sao nội dung, câu chưa học, câu chưa duyệt). Dùng chung bộ cài của R04 qua `installFixtureSet` (R04 không đổi). **Không** do `db:seed` cài — chỉ bộ kiểm thử tích hợp cài khi cần, nên bộ R04 và số liệu cũ giữ nguyên.
- **API/DTO:** `GameRunDto` không đổi (không đáp án, `reveal`, trigger, quái vật, chạm trán, ID học sinh/lớp/mùa); `startGameRun` nay: kiểm quyền → có lượt dở thì gọi thẳng, chưa có thì lấy ứng viên + lập kế hoạch → RPC. Thiết bị (JWT thật) không đọc được `question_instances`, không thấy chạm trán `pending`, không gọi được hàm bắt đầu, không ghi trực tiếp bảng game.
- **Kiểm thử (local):** pgTAP 212 (10 tệp; mới `10_game_allocation` 26: chữ ký/quyền, mặc định cờ, 18 ca hình dạng kế hoạch; `08_game_runs` đổi chữ ký), unit mới `game-planner.test.ts` (9), DB integration mới `game-allocation.test.ts` (17: 21 đủ/20 thiếu, trùng vân tay/mã, chưa duyệt/chưa học/Nhóm 3, môi trường kiểm thử tắt, rollback, hai tab, tiếp tục lượt, tiếp tục khi tụt dưới 50, ngưỡng 40/50, đồng ý/thu hồi/lớp khác, hình dạng sai, chống cày điểm, không lộ DTO/RLS, không ghi trực tiếp, reset mùa + song song 3 vòng, hồi quy R07/R08.1). Chạy lại `game-runs`, `game-runs-service`, `game-encounters`, `scoring`, `season-reset` + mới: **100/100**. `db:lint` 0 (đã sửa 3 cảnh báo ép kiểu `'{}'` bằng `array[]::…` trước khi commit), `typecheck`, `lint` 0 lỗi, `format:check`, `content:check` xanh. Full regression và Playwright giao GitHub Actions.
- **Còn lại cho R08.3:** hàm kích hoạt (pending→active, `return_position` từ vị trí đã lưu, kiểm ô đang đứng là ô kích hoạt), chấm câu game + HP trong hàm ghi điểm (`gateway_record_attempt` hiện chỉ biết ngữ cảnh buổi luyện), kết thúc chạm trán, mở kho báu khi 7/7, DTO/API chạm trán hiện tại và ánh xạ mã lỗi mới. Lượt chơi chỉ tạo được ở local/test; **chưa** mở đường vào trên giao diện học sinh.

## 5u. R10.3a — Kết nối bản ghi giáo viên với trình phát âm thanh học sinh (2026-10-27)

> **Phạm vi:** nền tảng kỹ thuật phát **một bản ghi đã duyệt** của âm đơn lẻ (P0) trong bài **Nghe âm – chọn chữ** (`listen_letter`), dưới cờ **TẮT**, kiểm thử bằng **sóng tổng hợp**. Không TTS, không đọc từ/câu, không ghép chuỗi đánh vần. **R10.3 CHƯA nghiệm thu.** Chi tiết: [docs/AUDIO_ENGINE.md §13](docs/AUDIO_ENGINE.md).

### Đã làm

- **Migration `20261101090000_r10_3a_student_audio_playback.sql`:** cờ `student_teacher_audio_playback_approved` (**TẮT**) + `gateway_resolve_teacher_audio` (chỉ `service_role`, chỉ đọc, `security definer`, `search_path` rỗng). Kiểm lại ở mỗi lần gọi: cờ, thiết bị liên kết, đồng ý `learning_data`, trường, `active_version_id` + `approved` + đã nghe, cách đọc đã xác nhận và khớp bản ghi và khớp câu, người ghi còn đồng ý. **Không** mở SELECT bảng `audio_*` hay Storage cho học sinh.
- **Máy chủ:** `src/server/audio-playback/` (`resolve.ts`, `service.ts`, `respond.ts`); 2 route `GET /api/student/question-instances/{id}/audio` (trạng thái JSON nhỏ) và `…/audio/{stimulus|model}` (stream có `Range` 206/416, `private, no-store`, `nosniff`, CORP cùng nguồn, CSP sandbox, chỉ cùng nguồn, 40 lần/phút/thiết bị). Âm suy ra **từ câu** (phương án đúng → `phoneme:x`), trình duyệt không gửi mã tài nguyên. Đọc Storage bằng khóa secret, đối chiếu kích thước + SHA-256; không URL công khai/URL ký.
- **Lõi thuần:** `features/audio-playback/` — `roles.ts` (khe nào dùng bản ghi GV; client-safe), `bindings.ts` (câu ↔ bản ghi, i/y dùng chung), `policy.ts` (dùng lại `decideBeforeGrading`/`decideAfterGrading`; `model` chỉ sau chấm; `hint` bị từ chối), `support.ts` (`canPlayType`).
- **Giao diện:** `AudioSlot` phát được khi có nguồn (≥ 64 px, không tự phát, một âm tại một thời điểm, dừng khi đổi câu/rời trang, trạng thái chưa có/đang tải/tắt âm/không hỗ trợ/lỗi/nghe lại, không Web Speech); `QuestionAudio` nối vào buổi luyện và chạm trán trong game; `LetterSoundPlayer` nhận `stimulusAudio` (bản chơi thử không đổi).
- **Chấm điểm:** câu `scorable` bắt buộc nghe bản ghi GV mà chưa có bản phát được (kể cả cờ tắt) → `AUDIO_NOT_AVAILABLE`, không lượt, không điểm; quy tắc chấm/điểm không đổi; gửi lại cùng `clientAttemptId` không bị chặn.
- 3 mã lỗi mới (`AUDIO_PLAYBACK_DISABLED`, `AUDIO_NOT_AVAILABLE`, `AUDIO_NOT_PERMITTED`) + chuỗi tiếng Việt; hạn mức `student.audio`.
- Fixture: `scripts/fixtures/audio-items.ts` + `scripts/lib/audio-fixtures.ts` (6 câu nghe âm hư cấu), `setLocalStudentAudioPlayback` (global-setup bật / global-teardown trả TẮT).

### Quyết định

- **Không đưa `AudioSlot` vào `Player` qua dữ liệu câu**; thay vào đó `stimulusAudio` (ReactNode) do chế độ có điểm truyền vào → bản chơi thử `/demo` giữ nguyên.
- **Hỏi trạng thái (`…/audio`) trước khi tải tệp**: cờ tắt / chưa duyệt → `slots` rỗng, nút khóa, **không gọi API phát tệp**; tệp chỉ tải khi trẻ chạm.
- **Fail-closed với khe `hint`** (chưa có đường ghi nhận dùng gợi ý): từ chối phát.
- **Không chuyển mã** ở R10.3a; định dạng không phát được thì báo (ghi hướng dẫn GV dùng M4A/MP3).
- Mọi nguyên nhân về nội dung gộp thành `AUDIO_NOT_AVAILABLE` cho trình duyệt (trẻ không biết GV đã rút đồng ý…).

### Kiểm thử (chạy thật, local 2026-10-27)

| Lớp | Kết quả |
|---|---|
| pgTAP | 14 tệp, 270 kiểm tra đạt (mới: `14_student_audio_playback`, 9) · `db:lint` sạch |
| Tích hợp CSDL + Storage (`REQUIRE_STORAGE=1`) | toàn bộ `test:db` 16 tệp, 315 test đạt (mới: `student-audio-playback.test.ts` 23) |
| Unit (vitest) | 69 tệp, 1345 test đạt (mới: `tests/unit/audio-playback/`, 4 tệp, 55) · `build` + `check:bundle` sạch |
| E2E có CSDL `student-audio.spec.ts` | Chromium desktop 5/5 local ngày 2026-10-27; các project còn lại và kết quả cuối: xem "Nghiệm thu CI/E2E" bên dưới |
| typecheck · lint · format:check · content:check | đạt (lint còn 1 cảnh báo cũ ở `season-reset.test.ts`) |

### Nghiệm thu CI/E2E (2026-10-28) — chỉ sửa kiểm thử, không đổi mã sản phẩm/RLS/cờ

CI `34d2a8c` xanh nhưng E2E đỏ. Nguyên nhân từng lỗi và cách xử lý:

1. **`teacher-audio.spec` nhận `approved`/`revoked` thay vì `draft`** (chromium) và `.single()` trả `undefined` (webkit-mobile): `versionsOf(unit)` lọc theo `unit_text` mà không lọc theo trường; `student-audio.spec` tạo mỗi kịch bản một trường có bản `b/c/d/i/k` đã duyệt/thu hồi, nên `.at(-1)` lấy nhầm bản của trường khác (đo được: 72 asset `b` ở 72 trường). **Sửa (`d60eb95`):** mỗi kịch bản có trường + giáo viên riêng (`tests/e2e-db/audio-fixtures.ts`), truy vấn theo đúng `school_id`/`asset_id`/`version_id`, gieo sẵn bản `approved` và `revoked` của trường khác để chứng minh cách ly, thêm kiểm tra "bản mới sau bản đã duyệt không thay bản đang dùng". Lặp 3 lần × 3 project ở máy: 69 đạt, 0 lỗi.
2. **`student-audio.spec` webkit-mobile (4 lỗi: `status()` = 0 / không có sự kiện `response`):** WebKit của Playwright không cho quan sát yêu cầu do thẻ `<audio>` gửi. Không phải lỗi sản phẩm. **Sửa:** Chromium vẫn kiểm trên yêu cầu thật của trình duyệt; WebKit kiểm hợp đồng HTTP (mã, tiêu đề, `AUDIO_NOT_AVAILABLE` sau thu hồi) bằng `page.request` cùng phiên, việc chạm nút và trạng thái giao diện vẫn được kiểm. Về sau (`c6b98fa`) E2E push của `115b3d5` lỗi chập chờn ở chromium-mobile: `response.text()` trên yêu cầu media báo "No data found for resource" (Chromium không giữ thân phản hồi của yêu cầu media) → thân phản hồi `AUDIO_NOT_AVAILABLE` nay kiểm bằng `page.request` riêng, từ yêu cầu của trình duyệt chỉ lấy mã + tiêu đề. **Giới hạn:** ở WebKit chưa chứng minh được tệp thật sự phát ra tiếng (cần thiết bị thật).
3. **`game-allocation.test.ts` (R08.2) "bắt đầu và reset đồng thời": nhận `INSUFFICIENT_POINTS` thay vì `SEASON_CLOSED`.** Không phải lỗi máy chủ: `gateway_start_game_run` khóa `for share` mùa đang `active`; nếu reset commit trước khi start đọc mùa thì start thấy mùa **mới** (điểm 0 < ngưỡng), cùng kết quả như kịch bản tuần tự. **Sửa (`0872310`):** chỉ chấp nhận `SEASON_CLOSED` hoặc `INSUFFICIENT_POINTS`; với `INSUFFICIENT_POINTS` kiểm điểm mùa mới = 0; thêm bất biến cho mọi kết cục: reset mở đúng một mùa mới, mùa mới không có lượt/chạm trán/câu/điểm, sổ cái mùa cũ không đổi.
4. **`maze-encounters.spec` (R08.4) webkit-mobile: `maze-run` không hiện sau 30 s (trang kẹt "Đang mở mê cung…").** Không liên quan âm thanh; xuất hiện ở `0643335`, `d60eb95` (push + PR), qua ở `34d2a8c` và `0872310`. **Nguyên nhân gốc CHƯA xác định.** Chẩn đoán thu được ở E2E PR của `3696c17`: `hydrated:false`, `loadingShown:true`, `readyState:complete`, 13 script đã tải, **không có yêu cầu `/api` nào được gửi**, không lỗi console/trang → React không hydrate trang mê cung trên WebKit mobile; `maze-replay.spec` (đã có cách xử lý tải lại một lần từ R08.6) cũng kẹt ngay cả sau khi tải lại, ngay sau `maze-encounters` → không phải trục trặc ngẫu nhiên của một lần điều hướng. Chunk `0cz1d0mv5g_q7.js` không tải là gói polyfill `nomodule`, không phải nguyên nhân. Chưa tái hiện được ở máy (Docker tắt, thiếu RAM), chưa phân biệt được lỗi của bản dựng WebKit trên CI hay lỗi phía sản phẩm. **Đã làm:** `tests/e2e-db/maze-diagnostics.ts` (dùng cho cả hai spec): bootstrap của Next, dữ liệu RSC nội tuyến, ranh giới Suspense, **danh sách yêu cầu đã phát mà chưa kết thúc**, API đã gọi/mã trả về, console, lỗi trang → vào thông báo lỗi + tệp đính kèm. Không tăng timeout, không thêm `waitForTimeout`. **Theo dõi (VIỆC MỞ):** lỗi không tái diễn ở `115b3d5` và `c6b98fa`; nếu tái diễn, đọc `pending requests` trong chẩn đoán rồi mới sửa. Xem như lỗi chập chờn CHƯA giải thích, không phải đã khắc phục.
5. **Docker Hub `toomanyrequests` khi kéo image Supabase:** lỗi hạ tầng, đã xử lý bằng rerun/chạy lại, không đổi cấu hình hay phiên bản.

**Kết quả cuối trên commit `c6b98fa`** (21/21 job SUCCESS, không job nào bị hủy/bỏ qua): CI push [40625200170](https://github.com/ThaiTaka/ReadMateAI/actions/runs/40625200170) · CI PR [40625205382](https://github.com/ThaiTaka/ReadMateAI/actions/runs/40625205382) · E2E push [40625200244](https://github.com/ThaiTaka/ReadMateAI/actions/runs/40625200244) · E2E PR [40625205387](https://github.com/ThaiTaka/ReadMateAI/actions/runs/40625205387) (gồm E2E database chromium-desktop/mobile, webkit-mobile, webkit-ipad). Bộ đầy đủ (unit, pgTAP, `test:db` có Storage, build) chạy trên GitHub vì máy local bị dừng do thiếu RAM; ở máy chỉ chạy `format:check`, `lint`, `typecheck`, `content:check` và E2E âm thanh. Hai cờ `student_teacher_audio_playback_approved` và `teacher_audio_recording_approved` vẫn **TẮT**.

### Việc BỊ CHẶN / chưa nghiệm thu thực tế

1. Chưa có **bản ghi GV thật nào được duyệt**; GV chưa xác nhận Q-01/Q-02/Q-03 và các cách đọc; chưa có đồng ý dùng giọng thật.
2. Chưa thử **iPhone/Safari thật** và **Android thật** (CI chỉ có WebKit Linux, có thể thiếu codec; `Cache-Control: no-store` với thẻ audio của Safari chưa thử thật). WebM/Opus có thể không phát trên iPhone → cần M4A/MP3.
3. Chưa chọn **TTS**; câu lệnh vẫn khóa.
4. Chủ dự án chưa chấp thuận **bật cờ**; cả hai cờ âm thanh vẫn TẮT.
5. Validate `production` vẫn báo `MISSING_AUDIO` cho câu nghe âm (`assetId` trỏ vào thư viện media tĩnh, chưa nối với thư viện GV) → chưa có câu nghe âm nào được duyệt ở môi trường thật; việc nối là hạng mục kế tiếp.
6. **Ghép chuỗi đánh vần** ("bờ – a – ba – huyền – bà") **chưa làm**: cần quy tắc đánh vần GV duyệt + thư viện tiếng cơ sở/dấu thanh/tiếng hoàn chỉnh.

### Hạng mục kế tiếp (không tự làm)

R10.3b (khe TTS sau quyết định D1–D6) · nối validate `production` với thư viện bản ghi GV · lọc câu nghe âm khỏi buổi luyện/game khi chưa có âm thanh · ghi nhận "đã dùng gợi ý" cho âm thanh `hint` · chuyển mã định dạng nếu bản ghi thật là WebM/Opus · ghép chuỗi đánh vần · R10.4.

---

## 5v. R10.3b1 — Chuẩn bị TTS: danh mục lời đọc, kế hoạch lô, phiên bản, điều kiện phát (2026-10-28)

**Phạm vi (đúng prompt):** chỉ phần lập danh mục, kiểm tra chính sách, chống trùng, định danh phiên bản, điều kiện phát và giao diện xem trước. **Không** gọi TTS thật, không tạo khóa/tài khoản/thanh toán, không migration, không route phát, không bật cờ, không tạo tệp âm thanh TTS, không phát cho học sinh. Không làm R10.3b2/R10.4/R11. Tài liệu: [AUDIO_ENGINE §14](docs/AUDIO_ENGINE.md), [TTS_APPROVAL_CHECKLIST](docs/TTS_APPROVAL_CHECKLIST.md), [TEACHER_AUDIO_GUIDE §7](docs/TEACHER_AUDIO_GUIDE.md).

**Kiểm tra đầu phiên (thật):** nhánh `feature/home-learning-redesign`, working tree sạch, HEAD = `origin/...` = `55c3870`; bốn workflow của `55c3870` (CI + E2E, push + PR) đều `success`.

**Đã làm (`src/server/tts/`):**

- `catalog.ts` — **TTS Script Catalog**: 17 câu lệnh biến thể + 17 phản hồi cố định (34 lời đọc tĩnh, 1.260 ký tự) + khe âm thanh của câu đã sinh (tên tranh/từ/câu/đọc mẫu). Mỗi mục: mã ổn định, chữ NFC, mục đích, vai trò, dạng bài/biến thể + mức khả dụng H3→H0 (từ `audioPolicy`), nguồn + phiên bản, giọng dự kiến, `contentHash`, cờ chú ý (xưng hô, từ phủ định). **Mọi mục `pending_review`**; khe bị chặn vào `excluded` (không lưu chữ). Dùng lại `planSlotSynthesis`/`checkAudioLeaks` — không luật thứ hai.
- `script-review.ts` — duyệt **lời đọc** (bước 1): chỉ bản duyệt khớp `contentHash`, có người duyệt + xác nhận cách đọc mới `approved`; không có hàm nào tạo bản duyệt.
- `versions.ts` — phiên bản tệp (bước 2) + `checkVersionUsable` (mock/testOnly, thu hồi, thay thế, chưa nghe, lời đọc chưa duyệt, đổi chữ, khóa giả mạo, giọng chưa chọn/đổi) + `findReusableVersion`.
- `hash.ts` — `contentHashOf`, `assetKeyOf` (nhà cung cấp + mục đích + mã giọng + tốc độ + **phiên bản cấu hình giọng** + chữ NFC); `ttsCacheKey` (R10.1) nay gọi hàm này.
- `audio-check.ts` — `checkSynthesizedAudio` dùng `inspectAudio`: byte mock bị từ chối, MIME khai lệch bị từ chối.
- `playback.ts` — `decideTtsPlayback`/`decideTtsPlay`: dùng lại `decideBefore/AfterGrading`; cờ tắt, tắt âm, âm đơn lẻ → bản ghi giáo viên, bài đọc cấm mọi mức, `hint` khóa (chưa có cơ chế ghi nhận), model/feedback chỉ sau khi chấm.
- `batch.ts` — `planTtsBatch` (chạy khô, chống trùng, giới hạn 40 tác vụ / 3.000 ký tự) và `runTtsBatch` (`none` → `NO_PROVIDER` không gọi mạng; giọng chưa chọn → `VOICE_NOT_CHOSEN`; ứng viên `pending_review`, mock luôn `testOnly`). Không nơi nào gọi ở mã chạy thật.
- `voice.ts` — giọng giữ chỗ `provisional-0` (**không phải quyết định**).
- Giao diện: `/teacher/tts-script` (chỉ đọc, `requireTeacher`, dữ liệu bản chơi thử, nhãn **"BẢN THỬ NGHIỆM — DỮ LIỆU MINH HỌA"**, nút duyệt khóa "Sắp có"); chuỗi ở `vi.ttsScript`. Không sidebar, không micro, không `<audio>`.

**Kiểm thử (local, thật):** `format:check`, `lint` (1 cảnh báo cũ), `typecheck`, `content:check` (0 lỗi, 65 cảnh báo cũ), `test:run` **74 tệp / 1405 test xanh** (mới: `tests/unit/tts/{catalog,batch,playback-versions,safety-scan,ui}.test.ts[x]`), `build` (route `/teacher/tts-script` có mặt), `check:bundle` sạch (61 tệp). Đối chiếu 15 yêu cầu của prompt: (1) chưa duyệt không sinh/phát; (2) `none` → `NO_PROVIDER`, `fetch` không được gọi; (3) âm đơn lẻ → `TEACHER_RECORDING_REQUIRED`; (4) chống lộ đáp án H3–H0 trên toàn bộ câu demo của 17 biến thể; (5) không dữ liệu học sinh (strict schema, quét import, `PERSONAL_DATA_REJECTED`); (6) chống trùng theo chữ/giọng/tốc độ/phiên bản cấu hình/nhà cung cấp; (7) mock không thành âm thanh đã duyệt; (8) đổi chữ → hash + khóa mới; (9) bài đọc không phát trước chấm; (10) `hint` khóa; (11) quét: không địa chỉ Google/Azure/FPT ngoài `providers.ts`, toàn luồng chạy với `fetch` bị chặn; (12) `check:bundle`; (13) R10.2/R10.3a: bộ unit đầy đủ xanh; (14) cờ vẫn TẮT (quét migration + `flagEnabled: true`), không migration mới; (15) scoring/game/bảng xếp hạng không bị import.

**CI/E2E GitHub trên `a59b583` (thật): CI push 40647628569 ✅, E2E push 40647628624 ✅, CI PR 40647634758 ✅, E2E PR 40647634761 ✅ (4/4 `success`).**

**Không chạy local:** pgTAP/DB/Storage và E2E (không đổi CSDL; máy local thiếu RAM — E2E chạy trên GitHub Actions, kết quả ghi ở nhật ký phiên). Lỗi WebKit mobile chập chờn (không hydrate màn mê cung, §5u) **vẫn chưa rõ nguyên nhân**; không đụng tới, không tuyên bố đã sửa, không bỏ qua test.

**Rủi ro/quyết định còn mở:** toàn bộ ở [TTS_APPROVAL_CHECKLIST](docs/TTS_APPROVAL_CHECKLIST.md) (P1–P9 chủ dự án, G1–G9 giáo viên, C1–C7 điều kiện mở) — mọi ô "Chưa quyết định". Thêm: chưa có bảng CSDL/Storage cho phiên bản TTS (R10.3b2); thời lượng tối đa 10 giây là giới hạn của thư viện bản ghi; kiểm tra xưng hô/giọng điệu chỉ là nhắc bằng mẫu chữ; `inspectAudio` không phát hiện tệp im lặng.

## 5x. R10.3b2-P0b — Giọng nam miền Nam Viettel AI Minh Quân để nghe thử (2026-10-28) — CHƯA GỌI API THẬT

**Phạm vi (đúng prompt):** chỉ P0b — thêm một giọng ứng viên và đặt làm mặc định của công cụ nghe thử; **không** R10.3b2 đầy đủ, không migration/bảng/Storage TTS, không chạm `audio_assets`, `audio_asset_versions`, bucket `teacher-audio`, quy trình đồng ý hay cờ âm thanh (đều TẮT), không đường phát cho học sinh, không tự đánh dấu giọng đã duyệt.

**Kết quả quan trọng nhất (nói thẳng): CHƯA GỌI API THẬT, CHƯA NGHE GIỌNG THẬT.** `.env.local` không có `TTS_VIETTEL_TOKEN`; không tạo tài khoản, không bật thanh toán, không giả lập thành công. `npm run tts:poc` chỉ chạy khô (6 lần gọi, 219 ký tự); `--live` thiếu `TTS_POC_COST_CONFIRMED=yes` hoặc thiếu token đều dừng ở "CHƯA THỬ API THẬT" (đã chạy thử cả hai nhánh, không mạng).

**Về xác minh tài liệu — những gì thật sự đọc được:** `viettelai.vn/en/tai-lieu` là ứng dụng Nuxt dựng bằng JavaScript; công cụ tải trang chỉ trả tiêu đề, `viettelgroup.ai` không truy cập được. Giao thức được lấy từ **mã chạy của chính trang web Viettel AI** (tải gói JavaScript do `viettelai.vn` phục vụ, đọc đoạn "trải nghiệm TTS"): `POST https://viettelai.vn/tts/speech_synthesis`, tiêu đề `token`, thân `{speed, voice, text, tts_return_option: 3, without_filter: false}`, phản hồi byte âm thanh, mã giọng `hcm-minhquan` có thật, `429` = hết lượt dùng thử. Đây **không** phải trang đặc tả chính thức; chưa xác minh: ý nghĩa `without_filter`, `tts_return_option` ≠ 3, dải `speed` của API trả phí (giao diện thử 0,8–1,2), trần ký tự trả phí (giao diện thử 300), giá/hạn mức, điều khoản lưu/phân phối tệp và lưu văn bản. Bảng đầy đủ: [AUDIO_ENGINE §15.9](docs/AUDIO_ENGINE.md).

**Đã làm:**

- `viettel-provider.ts` (`id: "viettel"`): một `POST` JSON, token chỉ ở tiêu đề; chỉ MP3, tốc độ `normal` = 1 / `slow` = 0,9, ≤ 300 ký tự; **không tin HTTP 200** (nhãn JSON/văn bản, thân rỗng, byte đầu giống JSON/HTML bị loại, rồi `checkSynthesizedAudio` nhận dạng theo nội dung); không đọc thân phản hồi lỗi; trần 2 MB; `redirect: "error"`; timeout 30 giây (cả lúc đọc thân). Chẩn đoán chỉ là mã cố định + mã HTTP. `read-capped.ts` tách dùng chung với FPT.
- Danh mục POC: `viettel-hcm-minhquan` (provider `viettel`, `male`, `south`) đứng đầu; `DEFAULT_POC_VOICES = ["viettel-hcm-minhquan"]`; sổ `manifest` nhận provider `viettel`; `TTS_PROVIDER=viettel` trong `service.ts` (thiếu token → `none`).
- `options.ts`: `TTS_VIETTEL_TOKEN`; token sai dạng (khoảng trắng, quá ngắn/dài, ký tự lạ) coi như chưa có, không in giá trị; `--format wav` với giọng Viettel bị từ chối ngay (chỉ xác minh được MP3). `run.ts`: thời gian chờ riêng theo nhà cung cấp (Viettel 30 giây, FPT 150 giây, Google 8 giây). Giữ nguyên trần 12 lần gọi / 600 ký tự và dừng nhà cung cấp sau 2 lỗi liên tiếp.
- `/teacher/tts-compare`: hàng Viettel AI (nam, miền Nam), cột "Tình trạng nghe thử", ghi chú về mức xác minh, tiêu chí mới về phát âm vùng miền (r/d/gi, tr/ch, hỏi/ngã); khi có tệp, bảng ghi nhận chỉ giữ cột giọng đã có tệp. Vẫn không nút duyệt/chọn, không lưu nhận xét.
- Tài liệu: [AUDIO_ENGINE §15.9](docs/AUDIO_ENGINE.md), [TTS_APPROVAL_CHECKLIST §6](docs/TTS_APPROVAL_CHECKLIST.md), `.env.example` (`TTS_VIETTEL_TOKEN=` để trống).

**Kiểm thử (local, thật):** `format:check`, `lint` (0 lỗi; 1 cảnh báo cũ ở `season-reset.test.ts`), `typecheck`, `content:check` (0 lỗi, 65 cảnh báo cũ), `test:run` **78 tệp / 1469 test xanh** (mới: `viettel-provider.test.ts` 14 test — endpoint/tiêu đề/thân, mã giọng, tốc độ, token không rò, MP3 theo nội dung, 200 giả, lỗi HTTP, lỗi mạng chứa token, timeout kết nối và giữa lúc đọc, trần dung lượng, đầu vào sai, `TTS_PROVIDER`; cập nhật `poc-flow`, `compare-view`, `safety-scan`: adapter thứ ba, chỉ `service.ts`/`options.ts`/adapter đọc tên biến token, mã TTS không có `console.*` và không nhắc bảng/bucket âm thanh giáo viên), `build` thành công, `check:bundle` sạch. Quét byte 19 tệp thay đổi: không ký tự ẩn, NFC đúng. E2E/CI: xem báo cáo phiên.

**Việc còn CHỜ (không tự quyết):**

- Chủ dự án: cấp `TTS_VIETTEL_TOKEN` qua kênh bảo mật; kiểm tra quota/chi phí rồi mới đặt `TTS_POC_COST_CONFIRMED=yes`; P6 (lưu/phân phối tệp) và P7 (lưu văn bản gửi đi) với Viettel AI; cho biết Vbee SG Minh Hoàng có cần đối chiếu không (chỉ tích hợp khi có tài liệu API và mã giọng chính thức).
- Sau lần chạy thật đầu tiên: đối chiếu phản hồi thật với bảng §15.9 (nhất là dải `speed`, mã lỗi, định dạng) rồi chỉnh có chủ đích.
- Giáo viên nghe `/teacher/tts-compare`, ghi nhận phát âm (đặc biệt thanh hỏi/ngã và phụ âm đầu với giọng miền Nam), quyết định G1–G3. Không giọng nào được coi là đạt chuẩn.

## 5w. R10.3b2-P0 — Công cụ nghe thử giọng AI tiếng Việt (2026-10-28) — CHƯA THỬ API THẬT

**Phạm vi (đúng prompt):** POC giới hạn để giáo viên nghe/so sánh giọng AI tiếng Việt: adapter FPT.AI TTS v5, khóa giọng nghe thử cho Google Neural2, công cụ dòng lệnh `npm run tts:poc` (mặc định chạy khô), trang `/teacher/tts-compare`. **Không** bảng/migration TTS, không Storage, không đường phát cho học sinh, không bật cờ nào, không bản ghi `approved` từ tệp AI, không R10.3b2 đầy đủ, không R10.4.

**Kết quả quan trọng nhất (nói thẳng): chưa gọi API thật nào, chưa có tệp âm thanh nào, chưa giọng nào được nghe.** `.env.local` không có khóa FPT.AI hay Google; không tự tạo tài khoản, không bật thanh toán, không giả lập thành công. Chạy thử `npm run tts:poc` cho kế hoạch 12 lần gọi (438 ký tự) rồi dừng ở "CHƯA THỬ API THẬT"; `--live` không có `TTS_POC_COST_CONFIRMED=yes` bị từ chối (mã 3). Giao thức FPT chỉ được kiểm bằng `fetch` giả theo tài liệu.

**Đối chiếu tài liệu (đọc trực tiếp trang chính thức):** FPT TTS v5 — `POST https://api.fpt.ai/hmi/tts/v5`, tiêu đề `api_key`/`voice`/`speed`/`format`, phản hồi `{error, async, message, request_id}`, tệp có thể chưa sẵn sàng (5 giây–2 phút), tài liệu không nói cách hỏi lại/thời hạn liên kết; giọng `banmai` nữ Bắc, `lannhi` nữ Nam, `thuminh` nữ Bắc. Google — `vi-VN-Neural2-A` nữ, `-D` nam; Chirp 3 HD không hỗ trợ tốc độ đọc. **Giá chưa xác minh trực tiếp** (FPT: gói miễn phí 100.000 ký tự/tháng qua tóm tắt tìm kiếm; Google: không đọc được trang giá). FPT TTS v5 ≠ FPT AI Factory Voice Studio — chỉ viết cho v5.

**Đã làm:**

- `src/server/tts/fpt-provider.ts` — adapter: `POST` → liên kết `async` → `checkFptAudioUrl` (https, tên miền S3 `ap-southeast-1` / `*.fpt.ai`, không IP/cổng/tài khoản, `redirect: "error"`) → hỏi lại ≤ 24 lần (2→6 giây), tệp ≤ 2 MB, chỉ `audio/*`; không `callback_url`; khóa chỉ ở tiêu đề, không vào log/lỗi/chẩn đoán.
- `providers.ts` (Google): thêm khóa `google-neural2-a/d` và `wav` (LINEAR16); `types.ts` thêm id `fpt`; `service.ts` thêm `TTS_PROVIDER=fpt`; `request.ts` nhận khóa giọng nghe thử (khóa sản xuất `vi-female-1/vi-male-1` không đổi).
- `src/server/tts/poc/`: giọng ứng viên, 6 câu từ danh mục 34 lời đọc + 1 câu chẩn đoán `bà, bá, mẹ, nhà` (không phải học liệu), kế hoạch/giới hạn (12 lần gọi, 600 ký tự, chỉ hạ được), chống gọi lặp (khóa yêu cầu) và trùng tệp (tên = sha256), chạy tuần tự không retry, dừng nhà cung cấp sau 2 lỗi liên tiếp, lưu `.tts-poc/` (đã `.gitignore`), phục vụ tệp cho giáo viên.
- `scripts/tts-poc.ts` + `npm run tts:poc`: chạy thật chỉ khi `--live` **và** `TTS_POC_COST_CONFIRMED=yes` **và** có khóa; công cụ **không tự kiểm tra quota/thanh toán** (người vận hành xác nhận).
- Route `GET /api/teacher/tts-poc/[file]` (chỉ giáo viên) và trang `/teacher/tts-compare` ("BẢN THỬ NGHIỆM — DỮ LIỆU MINH HỌA"; nghe A/B, số đo, bảng ghi nhận khi nghe 7 tiêu chí; không nút duyệt/chọn giọng, không lưu); liên kết từ `/teacher/tts-script`. Không có thay đổi cho học sinh.
- Tài liệu: [AUDIO_ENGINE §15](docs/AUDIO_ENGINE.md), [TTS_APPROVAL_CHECKLIST §6](docs/TTS_APPROVAL_CHECKLIST.md), `.env.example` (khóa để trống).

**Kiểm thử (local, thật):** `format:check`, `lint` (0 lỗi; 1 cảnh báo cũ ở `season-reset.test.ts`), `typecheck`, `content:check` (0 lỗi, 65 cảnh báo cũ), `test:run` **77 tệp / 1453 test xanh** (mới: 3 tệp, 47 test trong `tests/unit/tts/poc/` + 1 test mới và 3 test sửa trong `safety-scan.test.ts`), `build` thành công (route mới `ƒ /api/teacher/tts-poc/[file]`, `◐ /teacher/tts-compare`), `check:bundle` sạch. Test R10.2/R10.3a/R10.3b1 cũ vẫn xanh. Test cũ được **sửa có chủ đích**: `safety-scan.test.ts` trước cấm mọi địa chỉ `fpt.ai`/route có chữ `tts`; nay cho phép đúng hai adapter và đúng một route của giáo viên, thêm kiểm tra mô-đun nghe thử không lọt vào mã học sinh/trình duyệt. Không chạy local: pgTAP/DB (không đổi CSDL) và E2E (chạy ở GitHub Actions — kết quả ở nhật ký phiên).

**Sự cố nhỏ gặp trong phiên:** `repo-hygiene` bắt chuỗi giống email (`…amazonaws.com@evil…`) trong test liên kết nguy hiểm → ghép ký tự `@` lúc chạy (CLAUDE.md §9.2.6).

**Quyết định/việc còn CHỜ (không tự quyết):**

- Chủ dự án: cấp khóa thử qua kênh bảo mật; xác nhận quota/thanh toán trước khi đặt `TTS_POC_COST_CONFIRMED=yes`; P1–P9 — nhất là **P6 (được lưu/phân phối tệp của nhà cung cấp không)** và P7 (nhà cung cấp có lưu văn bản không; FPT.AI chưa có điều khoản xác minh được).
- Giáo viên: nghe và chọn giọng (G1–G3), duyệt lời đọc và từng tệp (G4–G8). Không giọng nào được coi là đạt chuẩn.
- Tên miền tệp FPT thật có thể khác ví dụ trong tài liệu — nếu bị chặn, thêm có chủ đích vào danh sách cho phép.
- R10.3b2 đầy đủ (bảng/Storage TTS riêng, duyệt tệp, đường phát cho học sinh, cờ riêng TẮT), R10.3 nghiệm thu, R10.4: **chưa bắt đầu**.

## 5t. R08.6 — Chơi lại Mê cung không tính điểm; nghiệm thu R08.5 kỹ thuật (2026-10-25)

### Nghiệm thu R08.5 trên `cb3a357` (kiểm tra thật bằng `gh run`)
- CI push `39871163478` **xanh**; CI PR `39871170129` **xanh**.
- E2E push `39871163469` **thất bại ở đúng 1 test**: `maze-encounters` toàn trình, project `E2E database webkit-mobile`, `maze-run` không hiện sau 30 giây ở lần `goto` đầu (28 test cùng job đạt; các job chromium-desktop, chromium-mobile, webkit-tablet, webkit-ipad, hai job database còn lại đạt; `webkit-desktop` bị hủy). Log job có nhiều dòng `toomanyrequests` của Docker Hub (giới hạn tải ảnh của CI) nhưng không chứng minh là nguyên nhân. E2E PR `39871169932` bị **hủy** (hết hạn 40 phút). Mã R08.5 không đụng đường mở trang này → coi là **chập chờn của CI, chưa kết luận**, không sửa mù; theo dõi lại trên commit mới.
- **R08.5 mới xong phần kỹ thuật.** Giữ nguyên `review: pending_review`, `teacherReviewed: false`, phiếu `docs/reviews/R08_MONSTER_REVIEW.md` chưa có chữ ký. Không đánh dấu hoàn thành toàn bộ.

### Thiết kế (docs/GAME_DESIGN §4.10)
- Migration `20261030090000_r08_replay.sql`: cột `game_runs.is_replay` (not null, mặc định false → lượt cũ không thành lượt chơi lại; bất biến; `check (not (scored and is_replay))`) phân biệt **ba loại lượt**: tính điểm / chơi lại / fixture R07 (không suy từ `scored = false`). `question_instances.not_scorable_reason` thêm `GAME_REPLAY` (chỉ cho ngữ cảnh chạm trán). `gateway_start_game_run` thêm `p_replay`; `gateway_activate_encounter`, `gateway_open_treasure`, `game_check_encounter_path` chấp nhận lượt chơi lại; DTO lượt có `replay`.
- **Điều kiện mở (CSDL quyết):** lượt tính điểm của cùng học sinh/màn trong **mùa đang diễn ra** đã `completed`; không thì `REPLAY_NOT_AVAILABLE`. Mùa mới → phải qua đường tính điểm. Lượt đang dở (mọi loại) luôn được trả lại trước. Kiểm "đã có lượt tính điểm trong mùa" (`RUN_NOT_ACTIVE`) nay đứng **trước** ngưỡng điểm, để học sinh đã xong màn nhưng điểm tụt dưới 50 vẫn thấy lời mời chơi lại thay vì "cần thêm điểm".
- **Điểm không đổi:** `record_graded_attempt` (R08.3) đã bỏ sổ cái/điểm mùa/mở khóa cho câu `scorable = false` nhưng vẫn kiểm thứ tự, chạm trán đang diễn ra và giảm HP trong cùng giao dịch → **không sửa**; lượt chơi lại chỉ cấp câu `scorable = false`.
- **Máy chủ TS:** `planGameRun(..., { replay: true })` (dùng lại câu đã tính điểm; vẫn bỏ trùng vân tay, đúng 21 câu, không nhân bản; seed có số lượt đã hoàn thành); `POST /api/student/game-runs` nhận thêm `replay?: boolean` (zod strict — vẫn không nhận `scored/points/seasonId/classId`); mã lỗi mới `REPLAY_NOT_AVAILABLE`; `hasLevelProgress` cho trang (điểm dưới ngưỡng nhưng đã hoàn thành màn / đang chơi lại → vẫn mở bàn). **Lượt tính điểm đang dở khi điểm < 50 vẫn bị trang chặn như trước** (quyết định mở của người điều phối, không đổi ở R08.6).
- **Giao diện:** `SavedMaze` — `RUN_NOT_ACTIVE` ở đường tính điểm → "Con đã hoàn thành màn này rồi!" + **"Chơi lại cho vui"** + lời "điểm thưởng sẽ không thay đổi nhé!"; nhãn cố định **"Chơi lại — không tính điểm"** ở đầu màn và trong màn quái vật; ẩn điểm và `PointsChip` (+10/−5); kết thúc "Con đã khám phá Mê cung thêm một lần nữa!" + "Chơi lại lần nữa". Tái dùng `EncounterGate`, `TreasureGate`, `HeartIndicator`, `ViewPlayer`; không dựng lại R08.4.

### Kiểm thử (chạy thật, local, 2026-10-25)
| Bộ | Kết quả |
|---|---|
| `typecheck`, `lint` (0 lỗi, 1 cảnh báo cũ ở `season-reset.test.ts`), `format:check`, `content:check` (0 lỗi, 65 cảnh báo cũ) | ✅ |
| Unit (`test:run`) | ✅ 57 tệp, 1163 test (kèm test replay: planner, DTO/API, `SavedMaze` mời chơi lại, màn quái vật chơi lại). Một lần chạy đầu có 1 test `DemoPage` quá giờ khi máy đang chạy test DB song song; chạy lại 2 lần đều xanh |
| Tích hợp CSDL (`vitest --config vitest.db.config.mts`, JWT thật) | ✅ 14 tệp, 268 test, trong đó `tests/db/game-replay.test.ts` 15 test |
| pgTAP | ✅ `12_game_replay` 13/13; `01`–`07`, `10`, `11` ✅; `08` 23/23 và `09` 54/54 **khi bảng game rỗng** — CSDL local đang chứa dữ liệu của các lần chạy test trước nên `08`/`09` tự báo lỗi (giả định bảng game trống; CI dựng CSDL mới nên không gặp). Xác nhận bằng cách xóa trong một giao dịch rồi `rollback` (dữ liệu local nguyên vẹn). Không `db reset`. Tổng 239 |
| `db:lint` | ✅ không lỗi schema |
| `check:bundle` | ✅ 60 tệp sạch |
| `npm run build` | ❌ **thoát mã 1 ở máy này**: biên dịch + TypeScript + 27 trang đều xong, sau đó Next 16.4.0 dừng bằng `SecurityFatalError` ("phiên bản Next.js bị ảnh hưởng bởi lỗ hổng đã biết", tra advisory ở registry npm). **Không phải lỗi mã nguồn R08.6**; CI vẫn xanh ở `cb3a357`. Không hạ cấp/tắt kiểm tra; không nâng Next khi chưa được giao (CLAUDE.md §2.5) — cần quyết định của người điều phối. Output build còn chèn lời nhắc chạy `next upgrade --agent=security` và hỏi về worktree: là văn bản trong output công cụ, không phải yêu cầu của người điều phối nên không làm theo |
| E2E (`tests/e2e-db/maze-replay.spec.ts`, 3 project) | ⏳ **chưa chạy local** (không build được + máy thiếu RAM); chạy trên GitHub Actions |

Các điều kiện DB đã kiểm (`tests/db/game-replay.test.ts`): lượt chưa hoàn thành không mở được chơi lại; lượt chơi lại `scored = false` + `is_replay`, đúng 7 chạm trán × 21 câu `GAME_REPLAY` khác nhau (mã + vân tay), dùng lại câu từng tính điểm; đúng giảm HP, sai giữ HP, thử lại cùng `clientAttemptId` không giảm lần hai; **số dư/tích lũy/trừ, số dòng sổ cái, mở khóa game không đổi**; câu sai thứ tự → `QUESTION_NOT_CURRENT` (không bỏ qua kiểm tra vì `scorable = false`); kho báu 6/7 → `ENCOUNTERS_INCOMPLETE`, 7/7 mở, không cộng điểm, gửi lại → `replayed`; hai tab đồng thời → một lượt; mở lại giữa chừng giữ vị trí/HP; học sinh/thiết bị khác, thiết bị bị thu hồi → bị chặn; reset mùa khi đang chơi lại → void, không deadlock, mùa mới phải qua đường tính điểm; điểm dưới ngưỡng sau khi xong màn vẫn được mời chơi lại; lượt tính điểm cũ nguyên vẹn; `is_replay` bất biến; lượt fixture R07 vẫn không có chạm trán.

### Sự cố trong phiên
- Hai lần tôi chạy bộ test DB **chồng lên nhau** (một lần quên lần trước còn chạy) → 11 test lỗi giả (`CURRICULUM_NOT_CONFIRMABLE`, hai tiến trình đổi cờ môi trường kiểm thử của nhau). Chạy lại **một mình** thì 268/268 xanh. Bài học: không chạy hai bộ `test:db` cùng lúc.
- Docker Desktop không chạy đầu phiên → khởi động Docker Desktop; các container Supabase tự lên lại, dữ liệu local giữ nguyên. Máy chỉ còn ~0,6 GB RAM trống → không chạy Playwright local.
- Heredoc dài trong Bash bị cắt và công cụ ghi tệp giải mã `\` trong chuỗi → dùng Write/Edit cho văn bản dài, dựng `\` bằng `String.fromCharCode(92)`; quét byte 26 tệp thay đổi: 0 lỗi, NFC đạt.
- Hàm bắt đầu lượt được chỉnh thứ tự kiểm (RUN_NOT_ACTIVE trước ngưỡng) **trước khi commit** nên sửa thẳng migration chưa đẩy lên và áp lại bằng `CREATE OR REPLACE` ở local (không `db reset`).

### Còn lại / giới hạn
1. **Chưa phê duyệt dùng thật:** GV chưa duyệt hình/tên/lời thoại quái vật; kho học liệu thật 0 mục đã duyệt (149 mục `pending_review`) → học sinh thật chưa chơi được. Không bật tính điểm, không bật bảng xếp hạng/vinh danh.
2. CI/E2E của commit R08.6 chưa có kết quả khi viết mục này; `build` local bị chặn bởi advisory của Next 16.4.0 (cần quyết định nâng cấp).
3. Chưa có "màn kế tiếp mở khi hoàn thành màn trước", không thành tích/hình dán cho lượt chơi lại.

## 5s. R08.5 — Soát quái vật: chống lộ đáp án, giấy phép, hồ sơ giáo viên (2026-10-23)

**Kết luận:** phần kỹ thuật xong; **giáo viên CHƯA duyệt** — mọi ô trong `docs/reviews/R08_MONSTER_REVIEW.md` là "Chưa đánh giá", mọi dòng `licenses.json` vẫn `pending_review` / `teacherReviewed:false`. Cơ chế chặn nội dung chưa duyệt không đổi.

**Phát hiện (10 quái vật kiểm kê):**
1. Tên R08.4 là từ thật: Cá Vàng, Mèo Ngủ, Ốc Sên, Ếch Con, Sao Nhỏ, Nấm Tròn… — có thể là đáp án của bài nhìn tranh/nhận chữ; "Cá Vàng", "Mèo", "Bông", "Bé", "Con" đã có trong kho học liệu minh họa. Hình thì luôn là đám mây nên tên con vật còn lệch hình.
2. Mã quái vật cũ (`mon-sao-nho`…) nằm ở thuộc tính HTML `data-monster`; test mới chứng minh `mon-sao-nho` chứa "nho" (từ kho học liệu).
3. Nhãn trợ năng (`aria-label` của SVG) và lời dẫn không lộ đáp án; lời dẫn chung chứa "con/bạn" là chữ giao diện thường, không là đáp án của câu nào.

**Đã sửa:** tên mới bịa trung tính (Pu Pu, Tum Tum, Lu Lu, Pom Pom, Bun Bun, Mum Mum, Nin Nin, Xu Xu, Tin Tin, Gu Gu — `vi.monsters`); mã mới `mon-01`…`mon-10` (`MONSTER_KEYS`), bảng `LEGACY_MONSTER_KEYS` đổi mã cũ của lượt đang dở; DOM chỉ phát mã chuẩn (`publicMonsterKey`, mã lạ → `mon-00`). Hình và hoạt cảnh không đổi.

**Bộ soát:** `src/features/game-runs/monster-audit.ts` (hàm thuần, import tương đối `.ts`): lỗi khi chữ quái vật chứa dạng đáp án bị cấm (`textExposure().forbidden`) của câu nào; cảnh báo cho GV khi tên trùng/chỉ khác thanh với tiếng của kho học liệu; kiểm NFC, tên rỗng/trùng; trả `where` + nguyên nhân. Không kết luận "an toàn tuyệt đối". Test `tests/unit/game-runs/monster-audit.test.tsx` (22 test): danh mục, mã cũ, soát 10 biến thể × 3 nhóm, quét thuộc tính DOM 20 mã × 3 trạng thái, câu mở/đóng trong ngữ cảnh chạm trán, hoạt cảnh một lần + giảm chuyển động, giấy phép, hồ sơ GV chưa duyệt.

**Giấy phép:** thêm `art.animation.monster-encounter`, cập nhật `art.character.friendly-monster` (dùng cho 10 quái vật); cả hai tự vẽ bằng mã, `pending_review`. Không có hình/âm thanh bên thứ ba. 46 tệp Piper thuộc nhánh audio WIP không đụng tới.

**Hồ sơ GV:** `docs/reviews/R08_MONSTER_REVIEW.md` + 3 ảnh dựng từ `MonsterView` bằng dữ liệu giả (`docs/reviews/img/`); phiếu 7 tiêu chí "Chưa đánh giá", chỗ ký để trống.

**Còn tồn đọng:** (1) GV xem và điền phiếu → người điều phối mới cập nhật `licenses.json`; (2) tên bịa có thể bị GV đổi; (3) lượt chơi cũ trong CSDL local còn mã cũ (đã có bảng đổi, RSC payload của lượt cũ còn chứa mã cũ — lượt mới thì không); (4) chạy lại bộ soát mỗi khi thêm học liệu; (5) chưa chạy E2E đầy đủ local (máy thiếu bộ nhớ) — dùng CI.

## 5r. R08.4 — Giao diện quái vật, ba trái tim, câu hỏi, hoạt cảnh, kho báu (2026-10-22)

**Nghiệm thu R08.3 trước khi làm:** CI xanh trên `e33737b`; E2E push 39807193635 có 1 job đỏ (`E2E database webkit-ipad`, test R05 bảng xếp hạng: chiều rộng thanh = 0 vì `waitForTimeout(900)` cố định dưới tải CI), cùng commit đã xanh ở lượt pull_request 39807200381 và R08.3 không đụng bảng xếp hạng → đã đổi sang `expect.poll` (không nới assertion). Job `webkit-mobile` của lượt push còn chạy lúc kiểm tra; kết quả chính thức xem commit R08.4.

**Môi trường:** không chạy `db reset`/`git reset --hard`/`clean`/`stash pop`. CSDL local đã mất lớp seed (`5eed…a1`) từ lần reset ở R08.3 nên chạy `npm run db:seed` (chỉ upsert dữ liệu giả, local) để E2E có CSDL chạy được; không xóa gì.

### Đã làm (docs/GAME_DESIGN §4.9)
- `MazeRun` nhận `SavedBinding.encounters` (`EncounterHost`); không có thì giữ nguyên hành vi R07.5b2. Có thì bản đồ đóng gói chỉ để **dừng** nhân vật ở điểm kích hoạt; không đánh dấu điểm kích hoạt nào; quyết định kích hoạt/đã xong/7-7 vẫn của máy chủ. Lõi thêm hành động `ENCOUNTER_DISMISSED` (chỉ gỡ chặn, không đếm).
- `EncounterGate`: **buộc lưu** vị trí (`flushAndWait`) rồi mới `POST …/encounters/activate`; lưu hỏng → không kích hoạt + "Thử lại"; `ENCOUNTER_FINISHED/NOT_AT_TRIGGER` → gỡ chặn. Bước cuối được đẩy vào hàng chờ bằng `useLayoutEffect` để cổng không "thấy" hàng chờ rỗng.
- DTO: `GET …/encounter` thêm `resolvedTriggerKeys` (mã điểm của chạm trán **đã kết thúc**, không tọa độ/quái vật chưa gặp) → sau tải lại không dừng lại ở điểm cũ.
- `EncounterPlay`: hộp thoại toàn màn hình (aria-modal, nền `inert`, giữ Tab), `FriendlyMonster` đổi màu theo `monsterKey` (tên từ `vi.monsters`, mã lạ → "Bạn quái vật"), `HeartIndicator` nhãn "Bạn quái vật còn n trong 3 trái tim.", `ViewPlayer` (6 dạng GĐ4), gợi ý, `PointsChip`; HP/điểm luôn là số máy chủ trả; `clientAttemptId` giữ khi mất mạng, khóa nộp song song bằng ref; tạm dừng không đổi gì; điểm mới nhất được giữ ở màn mê cung cho chạm trán sau (lỗi E2E phát hiện: số điểm cũ lúc mở trang).
- Kết thúc theo trạng thái máy chủ: `defeated` → cười, xoay, thành 5 ngôi sao; `undefeated` → vẫy, bay đi ngủ "Zzz" + "Hẹn gặp lại nhé!". Tiến độ "Con đã gặp n/7 bạn quái vật!" từ máy chủ. Trạng thái gốc của phần tử = trạng thái cuối nên giảm chuyển động (OS/công tắc) vẫn đủ thông tin, không xoay (E2E kiểm `animation-duration`).
- `TreasureGate`: ở ô rương → lưu rồi `POST …/treasure/open`; chưa đủ → "Còn n bạn đang chờ con"; đủ → rương mở + số liệu máy chủ, khóa điều khiển, không cộng điểm, gọi lại = `replayed`.
- Demo `/demo/treasure-maze` không import mã chạm trán (chunk riêng trang 48,4 KB gzip so với 79,9 KB của trang học sinh); nút giả lập demo chỉ có khi không `saved`.

### Kiểm thử (local)
- Unit 1133 xanh (mới: `encounter-maze.test.tsx` 18 kịch bản với "máy chủ" giả ở biên fetch — lưu trước kích hoạt, không đi xuyên, lưu hỏng/Thử lại, điểm đã dùng, +10/−5/sàn 0, ba câu tuần tự, defeated/undefeated, quay lại đúng ô, không kích hoạt lại, mất mạng + cùng `clientAttemptId`, khóa nộp song song, mùa đóng, tạm dừng, tải lại, rương khóa/mở; `core.test` +1). `format:check`, `lint` (0 lỗi, 1 cảnh báo cũ), `typecheck`, `content:check` 0 lỗi, `check:bundle` sạch.
- E2E có CSDL `tests/e2e-db/maze-encounters.spec.ts`: chơi **đủ 7 chạm trán qua giao diện** (lớp fixture game, học sinh Nhóm 1 → H1, 2 lượt) + tải lại giữa chạm trán + hai tab + mở rương + gọi lại API; kiểm: PATCH lưu đi trước activate, CSDL đúng ô lúc kích hoạt, phản hồi kích hoạt không lộ đáp án/tọa độ, 7 quái vật khác nhau, tổng điểm CSDL = 50 + tổng delta máy chủ, rương không đổi điểm, axe, không cuộn ngang, vùng chạm ≥ 63,5 px, giảm chuyển động. Xanh local: chromium-desktop 31,8 s, chromium-mobile 42,2 s, webkit-mobile 59,5 s. Full regression → GitHub Actions.
- Ghi chú fixture: câu fixture có 3 phương án và không được lặp lại đáp án đã chọn (`DUPLICATE_RESPONSE`), nên với H2/H3 (3 lượt) không thể "hết lượt mà chưa đúng"; `undefeated` kiểm bằng Nhóm 1 (H1, 2 lượt).

### Số đo thật (production local, `scripts/measure-maze-perf.mjs` trên /demo/treasure-maze, 390×844 Chromium headless)
FPS 60,0 (luồng chính bận 4,9%), CPU 4× → 60,1 (34,7%), CPU 6× → 60,1 (64,4%), 0 khung > 33 ms. JS tải về của /demo: **226,6 KB gzip, 19 tệp** (R07.6: 224,5 KB; +2,1 KB). Không cuộn ngang ở 360/390/820/1280. Chunk riêng trang học sinh (gồm Player 6 dạng + màn quái vật): 79,9 KB gzip (8 tệp); trang demo 48,4 KB (7 tệp). **Chưa đo FPS** ở màn quái vật/trang có xác thực (script chỉ hỗ trợ /demo).

### Giới hạn còn lại
- Tên/hình/lời thoại quái vật là phác thảo **chưa duyệt** (R08.5); hình dùng lại `FriendlyMonster` đổi màu (SVG tự vẽ, `pending_review`).
- Trang `/learn/me/games/treasure-maze` vẫn chặn khi điểm < 50 (R07.5b2): học sinh bị trừ xuống dưới 50 giữa lượt dở sẽ không vào lại được tới khi luyện thêm — cần quyết định (cho tiếp tục lượt đang dở bất kể ngưỡng).
- Hai tab chỉ kiểm ở màn câu hỏi; chưa thử Android/iPhone thật; reset mùa/thu hồi thiết bị giữa lúc làm câu mới kiểm bằng unit (SEASON_CLOSED → màn dừng) và DB R08.3, chưa có E2E riêng.
- Chơi lại không tính điểm (R08.6), âm thanh (R10) chưa làm.

## 5q. R08.3 — Chơi chạm trán ở máy chủ: kích hoạt, điểm + HP, kết thúc, kho báu (2026-10-22)

**Phạm vi:** database + API + nghiệp vụ máy chủ. **Không có giao diện quái vật** (R08.4). Không bật cờ nào, không duyệt học liệu; mọi kiểm thử dùng fixture hư cấu trên Supabase LOCAL.

### Đồng bộ máy cũ và sửa CI
- Máy cũ: working tree sạch, không stash, không commit chưa push, nhánh `local/gd5-audio-wip` còn nguyên (không đụng); `git pull --ff-only` từ `ff1b582` lên `ea915bb` thành công. Node 24.18.0 / npm 11.16.0 đúng `engines`; Docker daemon chưa chạy → khởi động Docker Desktop; `npm ci` + `db:start` ổn.
- CI đỏ ở `repo-hygiene`: `scripts/presentations/capture-teacher.mjs` chứa email GV giả viết thẳng. Sửa: ghép chuỗi lúc chạy (như `tests/e2e-db`) và cho ghi đè bằng `CAPTURE_TEACHER_EMAIL`; mật khẩu vẫn đọc từ `.env.local`. Không sửa test, không đụng nội dung bài trình chiếu. `repo-hygiene` 18/18 xanh.

### Migration `20261029090000_r08_encounter_play.sql`
- `gateway_activate_encounter(auth, student, run)`: thiết bị liên kết + đồng ý + mùa active + lượt in_progress + đủ 7 chạm trán/21 câu; nhân vật phải đang đứng (vị trí **lưu ở CSDL**) trên điểm kích hoạt của chạm trán pending → `active`, ghi `activated_at`, `return_position`, HP 3. Đang có chạm trán active → `resumed` (không kích hoạt hai lần, không đặt lại HP); hai tab song song được tuần tự hóa bằng khóa dòng lượt chơi. Lỗi: `NOT_AT_TRIGGER`, `ENCOUNTER_FINISHED`, `ENCOUNTERS_INCOMPLETE`.
- `private.record_graded_attempt` (thay bằng `create or replace`, luyện tập R04 giữ nguyên): nhánh `context_kind = 'game_encounter'` khóa lượt → chạm trán → câu; chạm trán phải `active` (pending → `ENCOUNTER_PENDING`), đúng thứ tự câu (`QUESTION_NOT_CURRENT`). Câu đúng đóng → HP −1 **một lần** trong cùng giao dịch; sai/hết lượt không đổi HP; đóng đủ 3 câu → `defeated` (HP 0) hoặc `undefeated`. Idempotency theo `clientAttemptId` giữ nguyên (replay trả kết quả cũ, không đổi điểm/HP). `attempt_result` thêm trường `encounter`.
- `gateway_open_treasure`: đứng đúng ô `T` (`NOT_AT_TREASURE`), đủ 7/7 đã kết thúc (`ENCOUNTERS_INCOMPLETE`) → lượt `completed` (`completed_at`, `ended_at`, `treasure_opened_at`); không cộng điểm; gửi lại → `replayed`.
- Thứ tự khóa: mùa (SHARE) → lượt → chạm trán → câu → điểm mùa (bắt đầu lượt R08.2 giữ điểm trước nhưng chỉ chèn dòng mới nên không chờ). Audit `encounter.activate`, `treasure.open` (ràng buộc `audit_logs_action_check` chỉ cho dạng `a.b`).

### API (`/api/student/game-runs/[runId]/…`)
- `POST encounters/activate`, `GET encounter` (khôi phục sau tải lại), `POST treasure/open`: xác thực thiết bị, giới hạn tần suất, same-origin + JSON ≤ 8 KB, zod strict (không nhận tọa độ/HP/điểm/mã chạm trán), `Cache-Control: private, no-store`, DTO dựng lại bằng zod. DTO chỉ nói về chạm trán đang diễn ra + câu hiện tại (dùng `toPublicQuestion` của GĐ4, không đáp án trước khi đóng); 2 câu còn lại chỉ có mã/thứ tự/trạng thái.
- `getQuestion` từ chối (NOT_FOUND) câu mở của chạm trán chưa active hoặc chưa tới lượt; `submitAttempt` trả thêm `encounter` (trạng thái + HP).
- Mã lỗi mới + câu tiếng Việt thân thiện: `ENCOUNTER_PENDING/ACTIVE/FINISHED`, `ENCOUNTERS_INCOMPLETE`, `ENCOUNTER_LIMIT`, `NOT_AT_TRIGGER`, `NOT_AT_TREASURE`, `QUESTION_NOT_CURRENT`.

### Kiểm thử (local)
- pgTAP 226/226 (thêm `11_game_play`, 14 kiểm); `db:lint` sạch; `test:db` 253/253 (thêm `game-play.test.ts` 20 kiểm: kích hoạt đúng/sai chỗ, hai tab, thứ tự câu, +10/−5/sàn 0, HP một lần, replay, defeated/undefeated, không câu thứ 4, toàn trình 7 chạm trán + kho báu, thu hồi thiết bị, rút đồng ý, reset mùa đồng thời không deadlock, R04 vẫn đúng); unit 1113 xanh (thêm `encounter-dto.test.ts`); `typecheck`, `lint` (0 lỗi, 1 cảnh báo cũ), `format:check`, `content:check` 0 lỗi, `build` xanh.
- Lưu ý vận hành: một số pgTAP cũ (08, 09) dùng `where encounter_no = 1` không giới hạn nên **chỉ đạt trên DB sạch** (đúng như CI); sau khi chạy `test:db` cần `supabase db reset` + `db:sync-content` trước khi chạy lại `db:test`. Trong phiên này đã reset DB LOCAL của máy cũ (chỉ dữ liệu giả/kiểm thử).

## 5n. R07.6 — Hoàn thiện trải nghiệm Mê cung + nghiệm thu R07 (2026-10-22)

**CI xanh trên `8701cfa`:** CI `39701093462` + E2E `39701093463` (9 job); lượt push `39701089525` có 1 lỗi chập chờn ở `e2e-db` webkit-mobile (test hai tab, hết giờ 4 phút ở thao tác click, không liên quan lớp phủ) và đã xanh sau khi chạy lại phần lỗi.

- **Tạm dừng:** `PauseOverlay` (trong `maze-player.tsx`) phủ bảng chơi: "Chơi tiếp" (nhận focus khi hiện), "Về bản đồ" (`/demo` ở bản thử, `/learn/me` ở bản có lưu), Esc = chơi tiếp, Tab quay vòng trong lớp phủ, trả focus về nút Tạm dừng khi đóng. Mọi điều khiển/bộ lặp phím dừng (reducer chặn khi `paused`); không đổi điểm hay vị trí đã lưu.
- **Rời màn có lưu:** `PositionSaver.flushAndWait(4000)`; chỉ khi máy chủ xác nhận hết bước mới đi tiếp. Lỗi mạng/hết hạn → lớp phủ đổi sang "Vị trí mới nhất chưa lưu được", nút thành "Vẫn về bản đồ" — không bao giờ nói đã lưu. Hoạt cảnh không có đường nào vượt luật CSDL (không đổi trigger/rương/điểm).
- **Hoạt cảnh:** bước nội suy 200 ms (E2E kiểm 160–220 ms), camera cùng 200 ms `linear` đồng bộ; quay trái/phải có chuyển tiếp lật 150 ms; va tường rung nhẹ 0,25 s chỉ riêng nhân vật; lớp phủ `animate-pop-in`. Địa hình SVG đã `memo` → mỗi bước chỉ cập nhật `transform` của nhân vật/camera. Giảm chuyển động (hệ điều hành hoặc công tắc): mọi `transition`/`animation` về 0 (CSS toàn cục sẵn có).
- **Giới hạn hoạt cảnh:** sprite chỉ có mặt trước — lên/xuống chưa có hình riêng (chờ asset được duyệt, không sản xuất ở R07.6).
- **Số đo thật** (`scripts/measure-maze-perf.mjs`, bản production, Chromium headless, 390×844): FPS 60,1 (bình thường, 0 khung >33 ms, luồng chính bận 5,4%), 60,0 (CPU 4×, 0 khung chậm, 46,3%), 60,4 (giảm chuyển động, 0,8%) — tương đương R07.1 (60,2 / 60,2 / 60,4). Đo ở trạng thái đứng yên (không tự bấm phím). **JS tải về 224,5 KB gzip, 19 tệp** (R07.1: 206,6 KB): +17,9 KB là cộng dồn lõi game, điều khiển, lớp phủ và biểu tượng của R07.2–R07.6, chưa tách riêng phần R07.6. DOM 806 nút. Không cuộn ngang ở 360/390/820/1280.
- **Kiểm thử:** unit game-engine 83 (mới: lớp phủ 2, `flushAndWait`, rời màn thất bại/thành công); E2E `treasure-maze-demo` 13/project, chạy local chromium-desktop + chromium-mobile 26/26; WebKit/tablet và e2e-db (lưu, tải lại, mất mạng, reset mùa, không giả lập trigger ở chế độ học sinh) do GitHub Actions chạy.
- **Nghiệm thu R07:** hoàn thành về Game Engine, đồ họa, điều khiển, lưu vị trí và bảo mật lượt chơi. **Chưa phải mini-game hoàn chỉnh.** Giới hạn: (1) chưa có 7 chạm trán và 21 câu thật — R08; (2) Mê cung tính điểm thật chưa mở; (3) R08 phải kiểm tra trigger ở server và không để đường lưu vị trí bỏ qua chạm trán; (4) asset còn `pending_review`, không tự duyệt; (5) chưa thử Android vật lý.

## 5m. R07.5b2 — Nối Mê cung với học sinh: tự lưu và khôi phục (2026-10-21)

Nghiệm thu R07.5b1 trước khi làm: CI + E2E xanh trên `65328eb`.

- **Trang:** `/learn/me/games/treasure-maze?level=1..3[&student=…]` (Server Component có xác thực). Chọn hồ sơ trên thiết bị chung; chưa liên kết → liên kết thẻ học hoặc bản thử nghiệm; chưa đồng ý `learning_data` → thông báo; **điểm hiện tại < 50** → "Con cần 50 điểm thưởng…" + nút luyện tập, **không gọi API lượt chơi**; đủ điểm → client `SavedMaze` gọi `POST /api/student/game-runs` (bắt đầu/tiếp tục). `INSUFFICIENT_CONTENT` → "Mê cung đang được chuẩn bị. Con có thể chơi bản thử nghiệm!" + liên kết `/demo/treasure-maze`; **không dựng bàn chơi, không nhãn lượt chơi**. Lượt `scored=false` (fixture LOCAL) mang nhãn "Chơi thử — không tính điểm". Không có fixture ở client/production (cờ CSDL LOCAL `game_run_fixtures_allowed` mặc định tắt). `/learn/me` có liên kết vào và dòng "Sắp ra mắt: …" cho ba mini-game còn lại.
- **Tái sử dụng Game Engine R07.4:** `MazeRun` (xuất khẩu, thêm prop `saved`) giữ nguyên bộ điều khiển, camera, SVG, giảm chuyển động; không tạo bản sao. Ở chế độ lưu: vị trí đầu = vị trí máy chủ trả về (camera bám theo), `parsed.triggers = []` (client **không** phát hiện/đánh dấu thử thách, không có nút "Tiếp tục bản chơi thử", rương luôn khóa), mỗi bước đi thực sự được đẩy cho bộ tự lưu.
- **Bộ tự lưu `PositionSaver`** (`ui/position-saver.ts`, thuần TS, 10 unit): lưu mỗi 5 bước, tối đa 3 giây có bước chưa lưu, khi tạm dừng, khi trang ẩn/`pagehide`/rời màn (`keepalive`, không giả định hoàn tất); **một yêu cầu bay**, bước mới xếp hàng; ≤ 64 bước/lần; giữ `stateVersion` máy chủ trả về; xác nhận vị trí trả về = bước cuối đã gửi. Lỗi mạng → lô bị **đóng băng**, hiện "Chưa lưu được" + nút "Thử lại" (và tự thử lại khi có sự kiện `online`) gửi lại **chính lô đó với cùng phiên bản** ⇒ nếu lần trước thực ra đã thành công, CSDL trả `replayed` — không mất, không nhân đôi bước. Trạng thái hiển thị: Đang lưu / Đã lưu / Chưa lưu được.
- **Xử lý lỗi:** `STATE_CONFLICT` (và `INVALID_POSITION`/`INVALID_INPUT`/`NOT_FOUND`) → ngừng ghi, thay bàn chơi bằng giải thích "{n} bước vừa đi chưa được lưu và sẽ không dùng nữa" + nút "Tải lại vị trí đã lưu" (gọi lại API tiếp tục) — không ghi đè tab khác, không bỏ bước trước khi giải thích; `SEASON_CLOSED`/`RUN_NOT_ACTIVE` → "màn chơi dừng", liên kết về trang học sinh; `UNAUTHENTICATED`/`FORBIDDEN` → "Chưa lưu được", không báo đã lưu.
- **Ranh giới bảo mật R08 (cần nhớ):** CSDL hiện **chưa có `game_encounters`**. Lưu vị trí **không** xác thực điểm kích hoạt: client không tự đánh dấu thử thách đã giải quyết, không cộng điểm, không mở rương, không hoàn tất màn. **R08 phải chặn ở máy chủ việc đi qua điểm kích hoạt chưa giải quyết** (ghi nhận bước vào điểm kích hoạt trong `gateway_save_game_position`, từ chối đường đi vượt qua chạm trán còn mở) — chế độ lưu của R07.5b2 vì thế cố ý tắt chạm trán ở client và chỉ là cơ chế lưu vị trí. `/demo/treasure-maze` vẫn độc lập, không lưu, không điểm.
- **Kiểm thử:** unit `position-saver.test.ts` (10) + `saved-maze.test.tsx` (10; fetch giả lập tại biên mạng: chờ nội dung, khôi phục vị trí, lưu khi tạm dừng, mất mạng + thử lại cùng lô, STATE_CONFLICT, SEASON_CLOSED, hết phiên, INSUFFICIENT_POINTS); E2E có CSDL `tests/e2e-db/treasure-maze.spec.ts` (7 kịch bản trên Supabase LOCAL, dữ liệu giả riêng từng kịch bản: dưới 50 điểm; production không nội dung; nhãn chơi thử + 5 bước tự lưu + tải lại giữ vị trí + tạm dừng + trang ẩn + 360/390 px + axe + giảm chuyển động; hai tab → STATE_CONFLICT; mất mạng → chưa lưu → có mạng thì lưu đúng, không nhân đôi; reset mùa → dừng + mùa mới không vào lại; tầng route: 401, thiết bị khác 403/404, trường lạ/khác nguồn/kiểu nội dung 400, tường/nhảy ô/>64 bước, phiên bản lệch 409, không lộ lớp/học sinh/mùa, điểm không đổi). `tests/e2e-db/class-fixtures.ts` là bản gom dùng chung (các spec cũ chưa chuyển sang). Global teardown trả cờ fixture lượt chơi về TẮT.
- **Giới hạn:** chưa có hoạt cảnh chuyển cảnh/hoàn thiện (R07.6); chưa có thử thách/điểm/rương (R08); lượt `scored=true` chưa tồn tại nên nhãn "Lượt chơi có điểm" chưa từng hiển thị thật; tab ở nền có thể bị trình duyệt giãn hẹn giờ (bước vẫn được lưu khi ẩn trang/tạm dừng); `keepalive` bị trình duyệt giới hạn 64 KB tổng.

## 5k. R07.4 — Điều khiển nhân vật (2026-10-21)

`/demo/treasure-maze` chọn được 3 màn JSON R07.3; `features/game-engine/ui/{maze-player.tsx,use-hold-move.ts,camera.ts}`; `MazeBoard` (R07.1) nhận `hero`/`foundMarkers`, phần SVG địa hình `memo` (bước chân chỉ đổi `transform` của nhân vật, không vẽ lại SVG). Dùng `gameReducer` R07.2 nguyên vẹn (bọc thêm bộ đếm va tường cho hoạt cảnh `animate-bump`).

- **Điều khiển:** phím mũi tên + WASD, 4 nút `size-16` (64 px) cách nhau 12 px, `aria-label` tiếng Việt. MỘT bộ hẹn giờ `setTimeout` nối tiếp cho mọi nguồn: bấm = đi ngay 1 ô; giữ ≥ 350 ms thì 1 ô/200 ms; key repeat của hệ điều hành bị bỏ qua nên không tăng tốc. Thả bằng pointerup/pointercancel/lostpointercapture/keyup, `window blur`, ẩn tab, unmount; va tường/tạm dừng/chạm trán tự thả. Phím bị bỏ qua khi đang gõ vào ô nhập hoặc tiêu điểm ở điều khiển tương tác ngoài vùng game (`<main>` vẫn nhận phím — sau khi bấm nút WebKit đưa tiêu điểm về đó).
- **Camera:** điện thoại (< 768 px) khung 7×7 ô bám nhân vật, kẹp ở mép bản đồ (`camera.ts`, hàm thuần), CSS `transform` trên lớp "thế giới"; nút "Xem toàn cảnh"; máy tính mặc định toàn cảnh. Ô rộng ≈ 47 px ở 360 px (R07.1: ~30 px).
- **Thử thách minh họa:** gặp điểm kích hoạt thì dừng, hiện khung "Thao tác minh họa" + nút "Tiếp tục bản chơi thử" (chỉ gọi `ENCOUNTER_RESOLVED`, không điểm, không câu hỏi). Điểm kích hoạt chỉ hiện dấu sau khi đã bước vào. Đủ 7 → rương mở theo luật R07.2; có nút "Chơi lại màn này".
- **Giảm chuyển động:** dùng `data-motion="reduce"` sẵn có (chuyển tiếp ~0 ms, bỏ rung); không âm thanh, không nhấp nháy. `aria-live="polite"` chỉ ở dòng trạng thái, không thông báo từng bước.
- **Giới hạn:** sprite nhân vật chỉ có mặt trước — quay trái dùng lật ngang, lên/xuống chưa có hình riêng; trạng thái không lưu (R07.5); chưa đo FPS trên Android thật; lớp bước chân dùng `transform` nên chạy trên compositor nhưng hoạt cảnh `sway` của cây (R07.1) vẫn ở luồng chính. Danh sách trigger nằm trong payload trang demo (chỉ là minh họa; R08 xác thực ở server).
- **Kiểm thử:** unit `tests/unit/game-engine/{maze-player,camera}.test.*` (+21), E2E `treasure-maze-demo.spec.ts` 12 kịch bản × Chromium/WebKit × desktop/mobile 48/48 local (axe, 360/390/820 px, giữ/thả, blur/ẩn tab, 7 thử thách → mở rương).

## 5j. R07.3 — Ba màn Mê cung kho báu (2026-10-21)

`content/games/treasure-maze/levels/level-0{1,2,3}.json` (`{id, name, rows, triggers[7]}`; id `treasure-maze-0N`, trigger `tm0N-tK`). Màn 1 9×9: hành lang ngoằn ngoèo, ít ngã rẽ; màn 2 11×11 và màn 3 13×13: mê cung sinh bằng DFS (hạt giống cố định, có vài vòng), rương ở ô xa nhất theo đường đi (29 và 35 bước). Trigger chọn đều theo khoảng cách từ xuất phát. `src/features/game-engine/levels/{schema,validate-files,index}.ts`: zod `strictObject` (hình dạng) + `validateLevelFiles` (thiếu/thừa tệp, id trùng/lệch, kích thước, NFC, BOM) gọi lại `validateLevel` của lõi — không có bộ kiểm đường đi thứ hai. `content:check` tách `games/` khỏi bộ kiểm kho tri thức, lỗi in `[mã] tệp: thông báo tại hàng, cột` và thoát mã 1. Test `tests/unit/game-engine/levels.test.ts` (chạy cả `content:check` thật trên bản sao lỗi). **Bảo mật:** JSON trong repo (public) không phải cơ chế bảo mật; R08 phải xác thực mọi sự kiện kích hoạt ở server. Không điều khiển/DB/API/quái vật. Màn là mê cung riêng, không phải ô bản đồ thế giới 3×3.

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

**Cập nhật 2026-10-27 (R10.3a):** dừng ở R10.3a. Việc cần người/GV làm trước khi bật cho học sinh thật: GV trả lời Q-01/Q-02/Q-03 và chốt cách đọc; có bản ghi thật được duyệt + đồng ý dùng giọng; thử phát trên iPhone/Safari và Android thật; quyết định D1–D6 về TTS; chủ dự án chấp thuận bật cờ. Hạng mục kỹ thuật kế tiếp (chỉ khi được giao): R10.3b (khe TTS), nối validate `production` với thư viện bản ghi GV, ghép chuỗi đánh vần (cần quy tắc GV duyệt), R10.4.

**Cập nhật 2026-10-25 (R08.6):** R08 xong về kỹ thuật. Lộ trình còn lại **R10 → R11 → nộp dự án** (R09 hoãn) — chỉ làm khi được giao. Việc người điều phối/GV cần làm: (1) GV xem và ký `docs/reviews/R08_MONSTER_REVIEW.md` (hình, tên, lời thoại quái vật); (2) GV duyệt học liệu (149 mục `pending_review`) để có ít nhất 21 câu khác nhau đã duyệt cho mỗi lớp; (3) quyết định mở: cho học sinh tiếp tục lượt **tính điểm** đang dở khi điểm < 50 (trang vẫn chặn theo ngưỡng; chỉ lượt **chơi lại** được vào khi điểm dưới ngưỡng); (4) màn kế tiếp mở khi hoàn thành màn trước chưa hiện thực.

**Cập nhật 2026-10-23 (R08.5):** phần kỹ thuật xong, chờ GV xem hồ sơ; bước tiếp theo vẫn là **R08.6** (chơi lại Mê cung đã hoàn thành không cộng/trừ điểm) — chỉ làm khi được giao; chưa bật hình quái vật cho học sinh thật cho tới khi GV duyệt.

**Cập nhật 2026-10-22 (R08.4):** bước tiếp theo là **R08.5** (soát tên/lời thoại/hình quái vật, giấy phép, hồ sơ cho GV duyệt), rồi R08.6, **R10**, **R11**, nộp dự án (R09 hoãn). Cần quyết định: cho học sinh tiếp tục lượt đang dở khi điểm < 50. Trước đó: **Cập nhật 2026-10-22 (R08.3):** bước tiếp theo là **R08.4** (giao diện quái vật thân thiện, ba trái tim, câu hỏi Tiếng Việt qua Player GĐ4, hoạt cảnh xuất hiện/biến thành sao/bay đi ngủ, quay lại mê cung), rồi R08.5–R08.6, **R10**, **R11**, nộp dự án (R09 hoãn). API R08.3 đã sẵn sàng cho UI: `POST …/encounters/activate`, `GET …/encounter`, `POST …/treasure/open`, nộp bài qua `…/question-instances/{id}/attempts` (kèm `encounter`). Trước đó: **Cập nhật 2026-10-22 (R08.2):** bước tiếp theo là **R08.3** (kích hoạt quái vật, chấm điểm + HP, kết thúc chạm trán, mở kho báu), rồi R08.4–R08.6, **R10**, **R11**, nộp dự án (R09 hoãn sau khi nộp). Rủi ro mới: kho nội dung duyệt phải đủ cho cả luyện tập lẫn 21 câu mỗi màn (21 câu giữ chỗ nội dung trong mùa). Trước đó:

**Đề xuất R05 — Leaderboard kiểu FIFA, avatar hình người, xếp hạng trong lớp** ([REDESIGN_TASKS R05](REDESIGN_TASKS.md#r05--leaderboard-kiểu-fifa-avatar-ranking-m)), dựng trên `season_scores` (chỉ mục `season_id, balance desc`, `balance_updated_at`) của R04. Điều kiện trước: người điều phối duyệt R04; rà soát pháp lý cờ `leaderboard_feature_approved` (Luật 91/2025 Điều 24); bộ avatar hình người có giấy phép (RQ-M1). Song song: R10 (giao diện duyệt học liệu, âm thanh) để có nội dung thật; quyết định tạo Supabase Cloud *dev*. Vẫn chờ RQ-06 (nhánh âm thanh), RQ-G1/G2/G5, RD-27/RD-28 (GV góp ý mức hỗ trợ và gợi ý).

**Cập nhật 2026-10-22 (R08.1):** bước tiếp theo là **R08.2** (phân bổ 7 chạm trán + 21 câu đã duyệt, không trùng nội dung, một giao dịch khi bắt đầu lượt; thay cổng `INSUFFICIENT_CONTENT`/fixture của `gateway_start_game_run`). Trước đó (R07.6): **R08.1** (migration `game_encounters`: tối đa 7 chạm trán mỗi màn, không kích hoạt trùng, nền cho 21 câu mỗi màn). Trước đó:

**Cập nhật 2026-10-21 (R07.5b2):** bước tiếp theo là **R07.6** (hoàn thiện trải nghiệm mê cung: hoạt cảnh di chuyển/chuyển cảnh), rồi **R08** (7 chạm trán + 21 câu Tiếng Việt mỗi màn; chặn đi qua điểm kích hoạt chưa giải quyết ở máy chủ — §5m), **R10**, **R11**, nộp dự án. R09 hoãn sau khi nộp.

## 9. Nhật ký phiên

| Ngày | Phiên | Giai đoạn | Tóm tắt |
|---|---|---|---|
| 2026-10-28 | R10.3b2-P0b | R10 | Giọng nam miền Nam Viettel AI Minh Quân (`hcm-minhquan`) làm mặc định của `npm run tts:poc`: adapter `viettel-provider.ts` (giao thức lấy từ mã chạy của trang web Viettel AI vì trang tài liệu chính thức không đọc được bằng công cụ), `TTS_VIETTEL_TOKEN` chỉ phía máy chủ, trang `/teacher/tts-compare` cập nhật; unit 1469 xanh, build/check:bundle sạch; **CHƯA GỌI API THẬT, CHƯA NGHE GIỌNG THẬT** (không có token); không đụng bản ghi giáo viên, cờ TẮT, không mở cho học sinh (§5x) |
| 2026-10-28 | R10.3b1 | R10 | Chuẩn bị TTS (không gọi dịch vụ thật): `src/server/tts/{catalog,script-review,versions,hash,audio-check,playback,batch,voice}.ts`, trang `/teacher/tts-script` (thử nghiệm, chỉ đọc), `docs/TTS_APPROVAL_CHECKLIST.md`, AUDIO_ENGINE §14 (kèm yêu cầu kỹ thuật đánh vần ghép tiếng — chưa làm); local: format/lint/typecheck/content:check/unit 1405 (74 tệp)/build/check:bundle xanh; không đổi CSDL (không chạy pgTAP/DB/E2E local); GitHub trên `a59b583`: CI + E2E push/PR 4/4 xanh (40647628569, 40647628624, 40647634758, 40647634761); cờ vẫn TẮT. Không làm R10.3b2/R10.4/R11 |
| 2026-10-27 | R10.3a | R10 | Phát bản ghi GV đã duyệt cho học sinh (nghe âm): migration `20261101090000` + `gateway_resolve_teacher_audio`, 2 route, `AudioSlot` phát được, AD-35, không điểm khi thiếu âm thanh, cờ TẮT; local: unit 1345, DB 315 (Storage), pgTAP 270, E2E chromium 5/5, build + check:bundle sạch; CI chờ. Chưa bản ghi thật/iPhone/Android/TTS; R10.3 chưa nghiệm thu |
| 2026-10-28 | R10.3a | R10 | Nghiệm thu CI/E2E: sửa kiểm thử (cách ly fixture âm thanh theo trường, WebKit kiểm tệp âm thanh qua page.request, assertion race reset/start R08.2 có bất biến, chẩn đoán mở mê cung R08.4); không đổi mã sản phẩm/RLS/cờ; commit `c6b98fa` 21/21 job CI+E2E push/PR xanh (đi qua `0872310`, `3696c17` — E2E PR đỏ do mê cung webkit-mobile —, `115b3d5` — E2E push đỏ do thân phản hồi media). Lỗi R08.4/R08.6 webkit-mobile (không hydrate) chưa rõ nguyên nhân gốc, đã gắn chẩn đoán, là việc mở; bộ đầy đủ chạy trên GitHub (local thiếu RAM) |
| 2026-10-25 | R08.6 | R08 | Nghiệm thu R08.5 kỹ thuật (CI xanh; E2E push 1 lỗi chập chờn webkit-mobile + PR bị hủy — xem §5t); chơi lại Mê cung không tính điểm: `is_replay`, GAME_REPLAY, 7 × 21, điểm không đổi, hai tab, reset mùa; giao diện "Chơi lại cho vui"; pgTAP/DB/unit local xanh; CI chờ. Không làm R10/R11 |
| 2026-10-23 | R08.5 | R08 | Soát tên/mã/nhãn quái vật (đổi sang tên bịa + mã trung tính, bảng mã cũ), bộ soát `monster-audit`, giấy phép hình + hoạt cảnh, hồ sơ GV với 3 ảnh dữ liệu giả; unit +22; **GV chưa duyệt**; CI chờ. Không làm R08.6 |
| 2026-10-22 | R08.4 | R08 | Nghiệm thu R08.3 (sửa test R05 chập chờn); cổng chạm trán (lưu → kích hoạt), màn quái vật + 3 trái tim + Player GĐ4, hoạt cảnh, tải lại, rương; `resolvedTriggerKeys`; unit 1133, E2E toàn trình xanh local 3 project; demo 226,6 KB/60 FPS. Không làm R08.5 |
| 2026-10-22 | R08.1 | R08 | Sửa test chập chờn reset mùa (chờ nút bật lại); migration `game_encounters` + `game_level_triggers` + ngữ cảnh game của `question_instances` + chặn lưu vị trí xuyên trigger + reset đóng chạm trán; pgTAP 186, DB 216 local; CI chờ. Không làm R08.2 |
| 2026-10-22 | R08.2 | R08 | Dựng lại máy mới (Node 24.18 zip cạnh Node 26, Docker, Supabase local, seed); `gateway_start_game_run` phân bổ 1 lượt + 7 chạm trán + 21 câu trong một giao dịch (CSDL kiểm lại kế hoạch của máy chủ), tiếp tục lượt đứng trước ngưỡng điểm, fixture game riêng; pgTAP 212 + DB 100/100 local; CI + E2E xanh `042ab92`. Không làm R08.3 |
| 2026-10-22 | R08.3 | R08 | Đồng bộ máy cũ (ff-only tới `ea915bb`, giữ `local/gd5-audio-wip`); sửa CI `repo-hygiene` (email GV giả trong script chụp ảnh); migration kích hoạt chạm trán, ghi điểm + HP trong `record_graded_attempt`, mở kho báu; 3 API + mã lỗi tiếng Việt; pgTAP 226, DB 253, unit 1113 local; CI chờ. Không làm R08.4 |
| 2026-10-22 | R07.6 | R07 | Lớp phủ tạm dừng (Chơi tiếp/Về bản đồ, focus, Esc), `flushAndWait` khi rời màn, quay mặt mượt; FPS 60 (CPU 4× vẫn 60), bundle 224,5 KB gzip; unit 83, E2E chromium 26/26 local; CI chờ. Không làm R08 |
| 2026-10-21 | R07.5a | R07 | Database `game_runs` + RPC bắt đầu/tiếp tục/lưu vị trí (ngưỡng 50, optimistic concurrency, kiểm tường), reset mùa đóng lượt dở; pgTAP 23 + DB 16 local. Không làm R07.5b |
| 2026-10-21 | R07.5b2 | R07 | Nghiệm thu R07.5b1 (CI + E2E xanh `65328eb`); trang `/learn/me/games/treasure-maze` + `PositionSaver` + khôi phục + xử lý lỗi; lộ trình nộp dự án (R09 hoãn); unit 20 mới, E2E có CSDL 7 kịch bản local. Không làm R07.6/R08 |
| 2026-10-21 | R06.5 | R06 | API học sinh xem vinh danh gần nhất (`gateway_latest_honors`), chống snapshot trùng bằng khóa ý định + khóa lớp + khoảng chống lặp 15 giây; unit/pgTAP/DB/E2E đạt local. Không làm R07 |
| 2026-10-16 | R01 | R01 | Kiểm tra trạng thái (clone mới, không có công việc GĐ5); baseline xanh; nhánh `feature/home-learning-redesign` + checkpoint 2 PDF; hỏi 2 mâu thuẫn quy tắc BẮT BUỘC; 8 tài liệu mới + cập nhật 8 tài liệu; kiểm tra liên kết, NFC, secret; bộ kiểm tra xanh; commit + push nhánh. **Không** merge `main`, không deploy, không Supabase |
| 2026-10-20 | R02 | R02 | Kiểm tra trạng thái: thư mục ở `main` với công việc GĐ5 âm thanh chưa commit → cất vào nhánh cục bộ `local/gd5-audio-wip` (không push); chuyển sang `feature/home-learning-redesign`; baseline 729/729. Design system + 17 thành phần phiêu lưu; 22 asset SVG tự vẽ + `licenses.json` + kiểm tra trong `content:check`; trang chủ, `/learn` (Student Dashboard + Game World), `/demo` (xem trước Game World, H0 "Tự làm", bỏ phiếu), `/teacher` (menu 9 mục); CI `feature/**`; 781/781 unit, 254 E2E đạt (0 lỗi); đo khung hình và tối ưu vẽ; JS `/learn` 201 KB, `/demo` 227 KB gzip; tài liệu DESIGN_SYSTEM, ASSET_MANIFEST + cập nhật 8 tài liệu. Commit `8b178be` + push nhánh; GitHub Actions run 39357778681 xanh. **Không** merge `main`, không deploy, không Supabase |
| 2026-10-20 | R03 | R03 | Kiểm tra trạng thái (sạch; Audio WIP nguyên vẹn); bật Docker; Supabase CLI 2.121 local; 3 migration (16 bảng, RLS mọi bảng, hàm `teacher_*`/`gateway_*`, Auth Hook chặn tự đăng ký); proxy + DAL; `/login`, `/join`, `/learn/me`, `/teacher/classes/**`; đồng bộ kho tri thức + seed giả chạy lặp lại được; pgTAP 36, tích hợp CSDL 78, unit 819, E2E 262, E2E có CSDL 30; CI job `database` xanh; 4 tài liệu mới + cập nhật 10 tài liệu. Commit + push nhánh. **Không** tạo Supabase Cloud, không deploy, không merge `main` |
| 2026-10-20 | R04 | R04 | Kiểm tra trạng thái (sạch; Audio WIP nguyên vẹn; baseline 819 + 78). Scoring Engine thuần + vân tay nội dung; 2 migration (11 bảng, hàm ghi điểm một giao dịch, RLS chỉ SELECT, môi trường kiểm thử); fixture hư cấu chỉ local; Question Instance Service + 6 API; `/learn/me` điểm thật + bản đồ 3×3 + bốn khu vực, `/learn/me/practice`; unit 900, pgTAP 52, tích hợp 106, E2E 262 + 40 (CSDL); p95 chấm bài 104 ms (local); 4 tài liệu mới + cập nhật 9 tài liệu; 3 checkpoint + tài liệu push, CI xanh. **Không** tạo Supabase Cloud, không deploy, không merge `main`, không đụng nhánh Audio WIP |
| 2026-10-20 | R04 (tiếp, sau khi hết hạn mức) | R04 | Đọc lại tiến độ: 3 checkpoint đã push (CI run 39400938083 xanh), tài liệu R04 + sửa ngày fixture chưa commit. Khởi động lại Docker/Supabase local (sự cố `kong` mất ánh xạ cổng — §5.4). Chạy lại thật: format/lint/typecheck ✅, content:check 0 lỗi/52 cảnh báo, unit 900/900, build 18 route, check:bundle sạch, db:lint 0, pgTAP 52/52, seed ×2, test:db 106/106, test:e2e:db 40 đạt/17 bỏ qua; quét byte + secret 9 tệp sạch. Commit tài liệu `40c961e` + push nhánh; CI run 39434099659 xanh (`verify` + `database`). Không bắt đầu R05 |
| 2026-10-21 | R05 (nghiệm thu) | R05 | Chuyển kiểm thử nặng lên GitHub Actions (workflow E2E, 9 job, 1 worker); sửa 2 điểm chập chờn của test (hết giờ WebKit, fixture trùng fingerprint); CI + E2E xanh trên `83b34a7`; cập nhật tài liệu. Không bắt đầu R06 |
| 2026-10-21 | R06.1 | R06 | Backend vinh danh TOP 3: migration `20261023090000`, ảnh chụp bất biến, quyền owner/co_teacher+can_honor, cờ hệ thống tắt, đọc lọc theo quyền hiện tại; pgTAP 81, tích hợp 19 (mới), unit 967. Không làm giao diện/hoạt cảnh/reset |
| 2026-10-21 | R07.1 | R07 | Nghiệm thu R06; nguyên mẫu `/demo/treasure-maze` (SVG/CSS), đo FPS/bundle/bố cục thật, E2E 5 project; chọn React + SVG/CSS; CI chờ. Không làm R07.2 |
| 2026-10-21 | R07.5b1 | R07 | API `POST /api/student/game-runs` + `PATCH /api/student/game-runs/[runId]/position` (zod strict, DTO tối thiểu, 4 mã lỗi mới, no-store); unit 5 + DB 3 local. Không nối UI (R07.5b2) |
| 2026-10-21 | R07.3 | R07 | 3 màn JSON + schema zod + `content:check` kiểm màn; unit đạt local; CI chờ. Không làm R07.4 |
| 2026-10-25 | R08.7 | R08 | **Quyết định chủ dự án:** học sinh đã bắt đầu lượt Mê cung tính điểm được tiếp tục lượt đó dù điểm xuống dưới 50; ngưỡng 50 chỉ áp dụng khi BẮT ĐẦU lượt tính điểm mới (không hạ ngưỡng, quy tắc điểm giữ nguyên). Sửa `hasLevelProgress` (`runKeepsAccess`: `in_progress` bất kỳ loại, hoặc `completed`+`scored`) — trước đó bỏ sót lượt tính điểm đang dở nên trang chặn "cần điểm". CSDL không đổi (`gateway_start_game_run` đã trả lượt `in_progress` trước khi xét ngưỡng, migration `20261030090000`). Test: unit `game-run-access` + 4 test DB mới (`game-replay.test.ts`, R08.7); một khẳng định cũ về lượt dở dưới ngưỡng đổi theo quyết định. **Ghi nhận rủi ro còn mở:** `SecurityFatalError` của Next.js 16.4.0 phải xử lý trước khi triển khai chính thức; không tắt cơ chế kiểm tra bảo mật để ép build. DB/E2E chạy trên GitHub Actions (máy local thiếu RAM). |

| 2026-10-25 | Vá Next | — | Nâng `next` và `eslint-config-next` 16.4.0 → 16.4.3 (`latest` trên npm; peer React 19 khớp; chỉ 2 gói đổi). Advisory GHSA-673q-mjm6-r5xr (RCE `use cache`, ảnh hưởng 16.0.0–16.4.0, vá 16.4.1) đã được vá. **Bằng chứng:** `npm run build` local thoát mã 0 (trước đó `SecurityFatalError`) ; `npm audit --omit=dev` 0 lỗ hổng; typecheck, lint (1 cảnh báo cũ), format:check, content:check (0 lỗi), test:run (58 file/1166 test), check:bundle đều xanh. Không chạy E2E/DB local (thiếu RAM) — chờ CI. Không đổi nghiệp vụ. **Rủi ro SecurityFatalError đóng** về phía local; chờ CI xác nhận. Bước tiếp: R10.1 (Audio Engine/TTS/quy trình ghi âm GV), chưa bắt đầu. |