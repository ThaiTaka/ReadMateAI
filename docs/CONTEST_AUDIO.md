# Chế độ trình diễn cuộc thi — âm thanh giọng máy tạo tự động

> **Phiên bản:** 1.0 (2026-10-29). **Phạm vi:** chuẩn bị TRÌNH DIỄN ReadMate AI trong một cuộc thi trên **máy local** với học sinh hư cấu. **Không** phải triển khai cho lớp học thật.
> Liên quan: [AUDIO_ENGINE §18](AUDIO_ENGINE.md), [AUDIO_COVERAGE §7](AUDIO_COVERAGE.md), [TTS_APPROVAL_CHECKLIST](TTS_APPROVAL_CHECKLIST.md), CLAUDE.md §9.11.

## 1. Vì sao có chế độ này

Duyệt thủ công từng tệp (34 câu hướng dẫn/phản hồi + 29 tên chữ cái + 39 âm) là quá nhiều cho một buổi trình diễn. Nhưng **không được giả danh giáo viên để tạo phê duyệt chuyên môn**. Giải pháp: một **miền dữ liệu riêng** cho âm thanh trình diễn — có nguồn gốc và trạng thái riêng — **không bao giờ** chuyển thành "giáo viên đã duyệt".

| | Bản ghi giáo viên | Giọng máy **đã duyệt** (R10.5) | **Giọng máy trình diễn** (tài liệu này) |
|---|---|---|---|
| Bảng | `audio_assets` / `audio_asset_versions` | `tts_script_reviews` / `tts_audio_versions` | `contest_audio_assets` |
| Bucket | `teacher-audio` | `tts-audio` | `contest-audio` |
| Hàm phát | `gateway_resolve_teacher_audio` / `gateway_resolve_learning_audio` | `gateway_resolve_tts_line` | `gateway_resolve_contest_audio` / `gateway_list_contest_audio` |
| Ai đảm bảo | giáo viên đã nghe + xác nhận cách đọc | giáo viên đã nghe + xác nhận | **máy**: chỉ kiểm tra kỹ thuật |
| Cột "đã duyệt/người duyệt/đã nghe" | có | có | **không có** (bị test cấm) |
| Chạy ở production | khi cờ + điều kiện mở | khi cờ + điều kiện mở | **không bao giờ** |

Nguồn gốc cố định bằng ràng buộc CSDL: `origin = 'ai_generated'`, `purpose = 'contest_preview'`, `technical_check = 'technical_check_passed'`, phiên bản cấu hình bắt đầu `contest-` (nên khóa tệp **luôn khác** khóa của thư viện đã duyệt), bucket cố định `contest-audio`. Không có đường nào ghi "teacher_recording" hay "approved".

## 2. Cổng an toàn (nhiều lớp)

1. **Hai cờ + một cổng, mặc định TẮT ở migration:** cờ `contest_audio_preview_enabled`, cờ `contest_audio_play_unverified`, và cổng `private.test_environment.contest_audio_allowed`. Hàm CSDL chỉ chạy khi **cờ chế độ VÀ cổng local cùng BẬT**. Migration không bật cái nào; chỉ `npm run audio:contest` (chỉ Supabase local) và kiểm thử đổi được. Production không có đường bật bằng mã ứng dụng.
2. **Mã ứng dụng chỉ chạy khi Supabase là máy này** (`127.0.0.1`/`localhost`), không phải Vercel và chưa đặt `CONTEST_AUDIO_PREVIEW=off` (`features/contest-audio/environment.ts`). Ngoài ra trả "không có" mà không hỏi CSDL, không đọc Storage, không hiện nhãn.
3. **Công cụ dòng lệnh từ chối** mọi URL Supabase không phải local (mọi nơi tạo client quản trị đều qua `localEnvOrThrow()`; test quét).
4. **Chính sách chống lộ đáp án AD-35 giữ nguyên:** câu lệnh/lời phản hồi dùng lại `decideBeforeGrading`/`decideAfterGrading` **trước** mọi truy vấn nguồn, nên nguồn trình diễn không thể phát thứ chính sách cấm (ví dụ H1/H0 vẫn giữ câu lệnh).
5. **Thu hồi toàn bộ một lệnh:** `npm run audio:contest -- revoke` (tắt chế độ, thu hồi mọi bản ghi, xóa đối tượng Storage). `gateway_revoke_contest_audio` luôn gọi được, kể cả khi chế độ đã tắt.
6. **Chỉ gửi văn bản cố định** của danh mục cho nhà cung cấp; không dữ liệu học sinh, không giọng giáo viên, không thông tin cá nhân (cổng `checkTtsRequest`).

## 3. Mục có rủi ro cách đọc — KHÔNG phát mặc định

Máy không thể biết một cách đọc có đúng với quy ước của trường hay không. Mục bị đánh dấu `needs_verification` (hàm thuần `features/contest-audio/risk.ts`):

- phụ thuộc quy ước nhà trường: `k`, `q`, `gi`, `gh`, `ng`, `ngh`, `qu`, `i`, `y`, `ă`, `â`;
- lời đọc chỉ **một ký tự** (a, e, ê, o, ô, ơ, u, ư, á, ớ…): bộ tổng hợp có thể đọc như tên chữ cái nước ngoài;
- nhãn có từ mô tả ("kép").

Các mục này vẫn được tạo và kiểm tra kỹ thuật, nhưng **không phát** cho học sinh (nút khóa ghi "Chờ kiểm chứng cách đọc"; API trả không có). Chủ dự án có thể **chủ động** cho phép khi trình diễn: `npm run audio:contest -- allow-unverified on` — khi đó nút có ghi chú nhỏ "Cách đọc chờ kiểm chứng". Báo cáo luôn liệt kê các mục này.

Danh mục cách đọc lấy **nguyên văn** từ `content/kb` (`teachingLabel.proposed`, `name.proposed` — đề xuất chờ giáo viên xác nhận, Q-01/Q-02); phép biến đổi duy nhất là đổi dấu gạch nối của tên nhiều tiếng thành dấu cách ("e-lờ" → "e lờ"). Không bịa quy tắc phát âm.

## 4. Công cụ `npm run audio:contest -- <lệnh>`

| Lệnh | Việc làm |
|---|---|
| `status` | công tắc, số tệp trong bộ nhớ đệm, số yêu cầu đã gửi |
| `prepare` | kiểm tra tĩnh 102 lời đọc: NFC, ≤ 300 ký tự, không dữ liệu cá nhân, không dấu hiệu lộ đáp án, đếm tệp dùng chung (89 yêu cầu riêng biệt). **Không mạng** |
| `generate [--live] [--max-requests N] [--only id,id] [--retry-failed] [--gap-ms N]` | tạo tệp còn thiếu bằng Viettel AI (`hcm-minhquan`, 0,9). **Mặc định chạy khô.** `--live` cần `TTS_VIETTEL_TOKEN` (`.env.local`) **và** `TTS_POC_COST_CONFIRMED=yes`. Mặc định tối đa 40 yêu cầu/lần (trần 120), hạn mức tổng 150 theo sổ ghi; tuần tự, cách nhau ≥ 1,5 s, không thử lại, dừng sau 3 lỗi liên tiếp hoặc khi khóa sai/hết lượt; khóa từng lỗi không tự gọi lại; ưu tiên câu lệnh → phản hồi → tên chữ cái → âm, mục an toàn trước mục rủi ro |
| `verify [--force]` | **giải mã từng tệp bằng Chromium** (Playwright): thời lượng, biên độ đỉnh, RMS, tỉ lệ có tiếng → bắt tệp im lặng/quá nhỏ/hỏng; đối chiếu SHA-256 của tệp trong Storage. Đây là kiểm tra **kỹ thuật**, không phải kiểm duyệt phát âm |
| `report` | báo cáo trung thực: phát được / thiếu / không qua kiểm tra / cần kiểm chứng; số yêu cầu đã dùng |
| `setup [--live] [--yes]` | `prepare` → `generate` → `verify` → bật chế độ (cần xác nhận) → tạo bucket nếu thiếu → đăng ký cho các trường → `report`. Chạy lại không gọi lại API cho tệp đã có. **Không tạo/đổi tài khoản giáo viên** (nếu chưa có, dừng và hướng dẫn `teacher:bootstrap`) |
| `enable` / `disable` | bật/tắt chế độ (chỉ local) |
| `allow-unverified on|off` | cho phép/chặn phát mục chờ kiểm chứng |
| `cleanup-test` | dọn dấu vết trường "Trường thử …" do bộ kiểm thử tạo |
| `revoke` | thu hồi toàn bộ |

Tệp đã tạo lưu ở `.contest-audio/` (được `.gitignore`; **không bao giờ commit**) và được tái sử dụng: chạy lại hoặc `db:reset` rồi `setup` **không gọi lại API** cho khóa đã có tệp. Mặc định đăng ký cho mọi trường trên máy **trừ** trường do kiểm thử tạo; thu hẹp bằng `--school <mã>`.

### Quy trình trình diễn đề xuất

```
npm run db:start                       # Docker Desktop đang chạy
npm run audio:contest -- setup --live --yes   # lần đầu hoặc khi muốn bù tệp còn thiếu
npm run audio:contest -- report        # xem còn thiếu gì
# (tuỳ chọn) cho phép phát cả mục chờ kiểm chứng khi trình diễn:
npm run audio:contest -- allow-unverified on
npm run dev
```

Sau buổi trình diễn: `npm run audio:contest -- revoke`.

## 5. Nối vào ứng dụng

- **Học tập** `/learn/me/study`: chạm chữ → `GET /api/student/learning-audio/{kind}/{unit}`. Thứ tự nguồn: **bản ghi giáo viên đã duyệt trước**, thiếu mới dùng tệp trình diễn. Trạng thái nói đúng nguồn: "Chế độ trình diễn: có N âm thanh nghe được bằng giọng máy tạo sẵn…" và số chữ chờ kiểm chứng. Tên chữ cái và âm của chữ là hai loại khác nhau, hai tệp khác nhau. Chạm lại để nghe lại; chạm chữ khác dừng chữ trước (`claimAudio`); không tự phát.
- **Bài luyện** và **Mê cung kho báu**: câu lệnh (`/audio/instruction`) theo chính sách mức hỗ trợ; **lời nhắn sau khi trả lời** (`/audio/feedback?line=…`): khung phản hồi có nút "Nghe lời nhắn" (đúng → lời khen; còn lượt → lời nhắc theo nhóm lỗi; hết lượt → "Mình cùng xem đáp án nhé"). Máy chủ đối chiếu mã dòng với **trạng thái thật** của câu (feedback-lines.ts) nên không xin được lời khen cho câu chưa đúng; lời phản hồi cố định không chứa đáp án. Câu bắt buộc nghe bản ghi giáo viên mà thiếu vẫn không được tính điểm (R10.3a không đổi). Công thức điểm, HP, điều kiện kho báu **không đổi**.
- **Nút "Tắt tiếng"** ngay trong màn chơi (buổi luyện, Mê cung, Học tập): trạng thái tạm trong bộ nhớ của trang, không lưu; dừng âm đang phát và khóa các nút nghe.
- **Giao diện:** nhãn nhỏ "Chế độ trình diễn" và ghi chú "Giọng máy trình diễn" thay cho các khung cảnh báo lớn. Lỗi thật vẫn hiện thật ("Chưa tải được…"). Dữ liệu hư cấu không được trình bày như dữ liệu lớp thật.
- **Khu giáo viên** `/teacher/audio-coverage`: phần "Âm thanh trình diễn (tạo tự động)" **tách hẳn** các mục đã duyệt: có giọng máy trình diễn · cần xác minh phát âm · còn thiếu · tệp cũ không còn khớp. Không cộng vào số liệu "đã duyệt".

## 6. Muốn dùng thật cho học sinh

Chế độ này **không** là đường đi tới sản phẩm thật. Muốn dùng thật: giáo viên nghe và duyệt từng mục theo [AUDIO_ENGINE §12–§17](AUDIO_ENGINE.md) và đạt [TTS_APPROVAL_CHECKLIST §4](TTS_APPROVAL_CHECKLIST.md). Các tệp trình diễn **không tự động trở thành tệp đã duyệt** (khác bảng, khác bucket, khác khóa cấu hình, không cột duyệt). Khi chuyển sang môi trường thật: `revoke`, rồi tạo lại qua thư viện R10.5.

## 7. Giới hạn đã biết (trung thực)

- Máy **chưa nghe** bất kỳ tệp nào: chất lượng/phát âm chưa được ai kiểm chứng. Kiểm tra kỹ thuật chỉ bắt tệp hỏng/im lặng/quá nhỏ.
- Nhà cung cấp Viettel trả HTTP 500 (nguyên nhân CHƯA RÕ; xem REDESIGN_PROGRESS §5z): độ phủ phụ thuộc việc dịch vụ nhận yêu cầu; công cụ không tự thử lại để không tốn lượt. Điều khoản lưu & phân phối lại tệp (P6) và việc nhà cung cấp lưu văn bản (P7) vẫn **chưa xác minh** ([AUDIO_ENGINE §17.5](AUDIO_ENGINE.md)).
- Chưa thử trên iPhone/Android thật (chỉ Playwright Chromium/WebKit).
- Tiếng/từ/câu và vần chưa có âm thanh (không thuộc phạm vi).
- Xưng hô "con/em" (Q-08) và 3 câu có từ phủ định vẫn chờ giáo viên.
