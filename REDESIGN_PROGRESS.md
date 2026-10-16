# REDESIGN_PROGRESS — Tiến độ tái cấu trúc ReadMate AI

> **Cập nhật lần cuối:** 2026-10-16 — Phiên Claude Code R01
> Đọc tệp này **đầu tiên** ở mỗi phiên của lộ trình R (sau đó [REDESIGN_TASKS.md](REDESIGN_TASKS.md) và tài liệu liên quan). Lịch sử GĐ1–GĐ4 vẫn ở [PROGRESS.md](PROGRESS.md).

## 1. Trạng thái hiện tại

- **Giai đoạn:** R01 — kiểm tra, bảo toàn, thiết kế lại kiến trúc → **hoàn thành về tài liệu; chờ người điều phối đánh giá.** Không tự chuyển sang R02.
- **Nhánh làm việc:** `feature/home-learning-redesign` (tách từ `main` @ `0806c3d`). `main` **không đổi**, không merge.
- **Mã nguồn:** không đổi so với GĐ4 (R01 chỉ thêm/sửa tài liệu và lưu 2 PDF). Ứng dụng vẫn chạy theo định hướng cũ cho tới R02.
- **Dịch vụ:** Vercel **chưa liên kết**; Supabase **chưa tạo**; không AI, không TTS.

| R | Trạng thái |
|---|---|
| R01 | ✅ Hoàn thành — chờ duyệt |
| R02–R11 | ⏸ Chưa bắt đầu ([REDESIGN_TASKS](REDESIGN_TASKS.md)) |

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

## 3. Việc đã làm trong R01

1. Kiểm tra trạng thái (§2), đọc toàn bộ CLAUDE.md, TASKS, PROGRESS, PRD, ARCHITECTURE, DATA_MODEL, VIETNAMESE_ENGINE, EXERCISE_ENGINE, README và 2 PDF.
2. Tạo nhánh `feature/home-learning-redesign`; checkpoint 2 PDF (`6eca037`).
3. Phát hiện 2 mâu thuẫn với quy tắc BẮT BUỘC của CLAUDE.md và **hỏi người điều phối** (theo CLAUDE.md đầu tệp): bảng xếp hạng vs §6.4; −5 điểm vs §7.10. Người điều phối chọn phương án có điều kiện (RD-01, RD-02).
4. Tra phiên bản thư viện game ứng viên bằng `npm view` (không cài): phaser 4.2.1, pixi.js 8.22.0, @pixi/react 8.0.5, motion 14.3.0, kaplay 3001.0.19, lottie-web 5.13.0, @rive-app/react-canvas 4.36.0.
5. Tạo tài liệu (đều **PLANNED**): `docs/PRODUCT_REDESIGN.md`, `docs/GAMIFICATION_SPEC.md`, `docs/GAME_DESIGN.md`, `docs/LEADERBOARD_SPEC.md`, `docs/REDESIGN_ARCHITECTURE.md`, `docs/PRIVACY_AND_SECURITY.md`, `REDESIGN_TASKS.md`, tệp này.
6. Cập nhật: `CLAUDE.md` (định hướng, quy trình đọc tài liệu, §6.4 và §7.10 thành ngoại lệ có điều kiện, §9.4 quy tắc gamification, thuật ngữ), `PROGRESS.md`, `TASKS.md`, `README.md`, `docs/PRD.md` (v0.3), `docs/ARCHITECTURE.md` (v0.5), ghi chú đầu `docs/DATA_MODEL.md` và `docs/EXERCISE_ENGINE.md`.

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
| RD-11 | H0 đổi tên hiển thị "Thử như ở lớp" → "Tự làm" | Chờ GV góp ý (RQ-02) | PRODUCT_REDESIGN §4.2 |

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

## 6. Bước tiếp theo

**Đề xuất R02 — Giao diện mới, trang học sinh, Game World** ([REDESIGN_TASKS R02](REDESIGN_TASKS.md#r02--giao-diện-mới-trang-học-sinh-game-world-l)). Điều kiện: người điều phối duyệt R01; trả lời (hoặc chấp nhận mặc định) RQ-02 (tên H0), RQ-M1/RQ-M2 (ai vẽ asset, duyệt phác thảo). R03 có thể giao song song nếu được phép tạo Supabase dev và bật Docker.

## 7. Nhật ký phiên

| Ngày | Phiên | Giai đoạn | Tóm tắt |
|---|---|---|---|
| 2026-10-16 | R01 | R01 | Kiểm tra trạng thái (clone mới, không có công việc GĐ5); baseline xanh; nhánh `feature/home-learning-redesign` + checkpoint 2 PDF; hỏi 2 mâu thuẫn quy tắc BẮT BUỘC; 8 tài liệu mới + cập nhật 8 tài liệu; kiểm tra liên kết, NFC, secret; bộ kiểm tra xanh; commit + push nhánh. **Không** merge `main`, không deploy, không Supabase |
