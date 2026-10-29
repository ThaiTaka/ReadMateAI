# Audio Coverage — báo cáo độ phủ âm thanh

> **Mục đích:** trả lời chính xác, không tô hồng: **chữ, âm, vần và câu hướng dẫn nào đã có tệp âm thanh ĐÃ DUYỆT, còn thiếu gì, và tình trạng duyệt từng mục.** Báo cáo **không bao giờ** kết luận "mọi chữ đều đọc được" khi còn thiếu tệp đã duyệt.
> Nơi xem: trang giáo viên **`/teacher/audio-coverage`** (thanh bên: "Độ phủ âm thanh"). Mã: `src/features/audio-coverage/build.ts` (hàm thuần, có unit test), `src/app/teacher/(console)/audio-coverage/`. Kiến trúc âm thanh: [AUDIO_ENGINE §16–§17](AUDIO_ENGINE.md).

## 1. Quy tắc đếm (bất biến — có test)

1. **Chỉ tệp ĐÃ DUYỆT mới được tính là "có".** Bản nháp, chờ duyệt, bị từ chối, đã thu hồi, bản của giọng/chữ cũ (lỗi thời) và tệp kiểm thử (`test_only`) đều tính là **chưa có**.
2. Mỗi mục có **đúng một** trạng thái; tổng các trạng thái = tổng số mục.
3. Thứ **chưa được theo dõi** (vần, tiếng, từ, câu) được ghi là **"Chưa theo dõi"** — không tính là đủ, cũng không tính là thiếu.
4. Số liệu đọc bằng JWT của giáo viên (RLS) mỗi lần mở trang: giáo viên chỉ thấy dữ liệu **trường của mình**.
5. "Có tệp đã duyệt" **không có nghĩa học sinh nghe được ngay**: việc phát còn phụ thuộc cờ hệ thống (đang TẮT ở môi trường thật).

## 2. Các nhóm trong báo cáo

| Nhóm | Số mục | Nguồn tệp | "Có" khi |
|---|---|---|---|
| **Tên chữ cái** (ví dụ b → "bê") | 29 | Bản ghi giáo viên (`/teacher/audio`) | bản ghi đã **duyệt** (đã nghe + cách đọc đã xác nhận) |
| **Âm của chữ** (ví dụ b → "bờ"; gồm chữ ghép ngh, qu…) | 38 (danh mục P0 dự kiến; `i`/`y` dùng chung một bản) | Bản ghi giáo viên | như trên |
| **Nút nghe trong Học tập** | mỗi nút trên `/learn/me/study` | tên chữ cái hoặc âm ở trên | nút trỏ tới một mục **có** tệp đã duyệt; nút trỏ tới đơn vị không có trong danh sách ghi âm được báo riêng (hiện: **0**) |
| **Câu lệnh** (17 dạng/biến thể bài) | 17 | Giọng máy (Viettel AI Minh Quân 0,9) — [thư viện giọng máy](AUDIO_ENGINE.md) (§17) | lời đọc đã duyệt **và** tệp đã duyệt khớp cấu hình giọng hiện hành |
| **Lời phản hồi** (lời khen/nhắc thử lại) | 17 | Giọng máy | như trên — từ 2026-10-29 đã **nối vào màn hình học** (khe `feedback`, nút "Nghe lời nhắn"); báo cáo suy trạng thái nối từ danh sách khe phát thật |
| **Vần** | 153 trong kho tri thức | — | **Chưa theo dõi**: công cụ ghi âm hiện chỉ hỗ trợ tên chữ cái và âm; học sinh chưa có nút nghe vần; giáo viên cần quyết định cách đọc vần trước khi ghi |
| **Tiếng, từ, câu** | — | Giọng máy theo từng bài (chưa làm) | **Chưa theo dõi**: chưa tạo tệp nào; mỗi tệp sẽ cần giáo viên nghe và duyệt |

Trạng thái từng mục: tên chữ cái/âm — **Chưa ghi · Bản nháp · Chờ duyệt · Đã duyệt · Cần ghi lại**; lời đọc giọng máy — **lời đọc** (chờ duyệt/đã duyệt/bị từ chối) và **âm thanh** (chưa có/chờ nghe và duyệt/đã duyệt/bị từ chối/đã thu hồi) và cờ "tệp của giọng hoặc chữ cũ".

## 3. Tình trạng tại thời điểm viết (2026-10-29)

Trên máy dev của chủ dự án **chưa có bản ghi giáo viên nào và chưa có tệp giọng máy nào được duyệt**, nên:

| Nhóm | Đã duyệt / tổng |
|---|---|
| Tên chữ cái | **0 / 29** |
| Âm của chữ | **0 / 38** |
| Câu lệnh giọng máy | **0 / 17** |
| Lời phản hồi giọng máy | **0 / 17** |

→ **Hiện không thể nói "mọi chữ đều đọc được".** Mục tiêu kỹ thuật đã đạt: **mọi nút nghe trong Học tập đều được nối với đúng khe âm thanh** (unit test `study.unmapped === 0` trên danh mục thật) và báo cáo nêu chính xác mục còn thiếu để hoàn tất. Chạm vào chữ chưa có tệp đã duyệt hiện nút khóa ghi rõ "Chưa có âm thanh" — không giả lập.

## 4. Cách hoàn tất độ phủ (việc của giáo viên)

1. **Chốt cách đọc** các chữ có quy ước nhà trường (k, gh, ngh, gi, qu, ă, â, i, y… — [AUDIO_RECORDING_PLAN §3](AUDIO_RECORDING_PLAN.md), Q-01/Q-02).
2. `/teacher/audio`: ghi âm **29 tên chữ cái + 38 âm** (≈ 60 phút theo kế hoạch, 4–5 buổi 15–20 phút), nghe lại, xác nhận cách đọc, gửi duyệt rồi duyệt. Tệp có thể ghi bằng micro (chỉ trang này) hoặc tải lên.
3. `/teacher/tts-script`: duyệt 17 lời đọc câu lệnh (và 17 lời phản hồi), tạo âm thanh, **nghe từng tệp** rồi duyệt.
4. Mở `/teacher/audio-coverage` để kiểm lại; mục còn thiếu hiện trong khung **"Cần bổ sung"**.
5. Muốn học sinh nghe được: chủ dự án quyết định mở cờ phát theo [TTS_APPROVAL_CHECKLIST §4](TTS_APPROVAL_CHECKLIST.md#4-điều-kiện-mở-cho-học-sinh-thật) (kiểm thử iPhone/Android thật, quyền riêng tư…). Trên máy dev: `npm run audio:local-flags -- on`.

## 5. Kiểm thử

- Unit `tests/unit/audio-coverage/build.test.tsx` (19): danh mục thật (29 tên chữ cái, 17+17 lời đọc, `unmapped = 0`), chỉ tệp đã duyệt được tính (draft/chờ/từ chối/thu hồi không tính), `i`/`y` dùng chung, tổng trạng thái = tổng mục, tệp lỗi thời/`test_only`, "đủ" chỉ khi đủ **tất cả**, khung hiển thị không tuyên bố "đủ" khi thiếu.
- E2E `tests/e2e-db/teacher-audio-coverage.spec.ts` (Supabase thật + Storage): rỗng → "Chưa đủ", 0/tổng; có 1 tên chữ cái + 1 âm + 1 câu lệnh đã duyệt và 1 câu lệnh chờ duyệt → đếm đúng (1/29, 1/38…, chờ duyệt **không** tính); giáo viên trường khác thấy 0; 360 px không tràn ngang, axe sạch.

## 6. Giới hạn đã biết

- Danh mục 38 âm là **đề xuất chờ giáo viên xác nhận** (Q-02); đổi danh mục thì tổng đổi theo.
- Báo cáo **không phát hiện tệp im lặng hay chất lượng kém** — giáo viên phải **nghe** trước khi duyệt (bước bắt buộc của quy trình).
- Chưa có báo cáo cho vần/tiếng/từ/câu và chưa xuất ra tệp (CSV/PDF); chỉ xem trên trang.

## 7. Âm thanh TRÌNH DIỄN — tách riêng, không cộng vào số liệu "đã duyệt" (2026-10-29)

Từ chế độ trình diễn cuộc thi ([CONTEST_AUDIO](CONTEST_AUDIO.md)), cuối trang `/teacher/audio-coverage` có phần **"Âm thanh trình diễn (tạo tự động)"** — chỉ hiện ở máy local, đọc bằng JWT giáo viên (RLS theo trường), gồm bốn nhóm riêng:

| Nhóm | Nghĩa |
|---|---|
| **Đã có giọng máy trình diễn** | có tệp khớp danh mục hiện hành; mới qua kiểm tra kỹ thuật, **chưa ai nghe/duyệt** |
| **Cần xác minh phát âm** | k, q, gi, gh, ng, ngh, qu, i, y, ă, â, lời đọc một ký tự, nhãn có "kép" — mặc định học sinh không nghe được |
| **Còn thiếu** | chưa có tệp trình diễn |
| **Tệp cũ không còn khớp** | chữ/giọng đã đổi từ khi tạo tệp |

Quy tắc: **không bao giờ** cộng các số này vào "Tên chữ cái / Âm của chữ / Câu lệnh / Lời phản hồi đã duyệt" ở các mục trên; tệp trình diễn không bao giờ làm báo cáo chính nói "đủ". Báo cáo dòng lệnh: `npm run audio:contest -- report` (nêu số tệp qua kiểm tra kỹ thuật, số phát được ngay, số yêu cầu đã gửi nhà cung cấp, mục thiếu và mục cần kiểm chứng).
