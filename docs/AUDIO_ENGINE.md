# ReadMate AI — Audio Engine (R10.1: thiết kế, nghiên cứu TTS, adapter)

> **Phiên bản:** 1.0 — R10.1 (2026-10-26). **Phạm vi:** thiết kế + nghiên cứu tài liệu + adapter `TtsProvider` kiểm thử bằng mock. **Chưa** có âm thanh nào được tạo, ghi hay phát; `AudioSlot` vẫn khóa (AD-39). R10.2–R10.7 chưa làm.
> Liên quan: [ARCHITECTURE §13](ARCHITECTURE.md#13-hệ-thống-âm-thanh), [EXERCISE_ENGINE §5](EXERCISE_ENGINE.md), [PRD §12](PRD.md), [AUDIO_RECORDING_PLAN](AUDIO_RECORDING_PLAN.md).

## 1. Trạng thái thật (đọc trước)

| Hạng mục | Trạng thái |
|---|---|
| Interface `TtsProvider`, chế độ `none`, mock, kiểm tra đầu vào, hạn mức, timeout, kế hoạch theo `audioPolicy` | **Đã hiện thực + unit test** (`src/server/tts/`, `tests/unit/tts/`) |
| Adapter Google Cloud TTS | **Skeleton** theo tài liệu REST; chỉ kiểm thử bằng `fetch` giả. **Chưa gọi API thật** |
| Adapter Azure / FPT.AI | **Chưa viết** (chỉ đánh giá tài liệu; hợp đồng interface đã đủ để thêm) |
| Gọi API thật, nghe thử chất lượng giọng Việt | **BLOCKED — chờ chủ dự án cấp phép tạo tài khoản/khóa thử nghiệm.** Chưa đánh giá chất lượng tổng hợp |
| Bảng/migration thư viện âm thanh, giao diện GV, phát trong Player | **Chưa làm** (R10.2–R10.3); chỉ có đề xuất ở §9 |
| Bản ghi âm GV | **Chưa có bản nào**; không yêu cầu ở R10.1 |

## 2. Hai nguồn âm thanh

| Nguồn | Dùng cho | Không dùng cho |
|---|---|---|
| **A. Bản ghi GV** | Âm đơn lẻ, vần đơn lẻ (PRD A7). Một bản ghi dùng lại ở mọi bài | — |
| **B. TTS** | Câu lệnh chuẩn của 17 biến thể, tên tranh/từ/câu *khi chính sách cho phép*, lời khen/động viên, âm thanh mẫu **sau** khi chấm | Âm/vần đơn lẻ; bất kỳ lời đọc nào bị `checkAudioLeaks` chặn |

Cấm: Web Speech API (đã có test quét `speechSynthesis`), TTS theo yêu cầu lúc học sinh mở bài, TTS từ trường nhập của học sinh.

## 3. Đánh giá nhà cung cấp (truy cập 2026-10-26)

> Thông tin lấy từ trang tài liệu chính thức qua công cụ đọc trang; các ô ghi **"chưa xác minh"** không được suy đoán. Chưa có tài khoản nên **không có kết quả nghe thử**.

### 3.1 So sánh

| Tiêu chí | Google Cloud TTS | Azure AI Speech | FPT.AI TTS |
|---|---|---|---|
| 1. Tiếng Việt | Có, `vi-VN` | Có, `vi-VN` | Có |
| Giọng | Standard A–D, WaveNet A–D, Neural2 A (nữ)/D (nam), Chirp 3 HD (nhiều giọng, tên thiên thể) — liệt kê theo trang; cần `ListVoices` để xác nhận | `HoaiMyNeural` (nữ), `NamMinhNeural` (nam), `Linh:MAI-Voice-2-Flash` (nữ, HD Flash); có thể còn giọng khác ở phần trang chưa đọc hết | `banmai`, `lannhi`, `linhsan`, `thuminh` (nữ), `leminh`, `giahuy` (nam), `myan` (nữ) |
| 3. Vùng miền | Không thấy ghi vùng miền (chưa xác minh) | Không thấy ghi vùng miền (chưa xác minh) | **Có ghi** Bắc (banmai, leminh, thuminh), Trung (myan, giahuy), Nam (lannhi, linhsan) |
| 4. Tốc độ chậm | `speakingRate` cho Standard/WaveNet/Neural2; **Chirp 3 HD không hỗ trợ speaking rate/pitch/SSML** | SSML `prosody` (nói chung; riêng tiếng Việt chưa xác minh) | `speed` −3…+3 |
| 5–6. Chi phí / gói thử | Chirp 3 HD 30 USD/1 triệu ký tự (miễn phí 1 triệu/tháng); Neural2 16 USD (miễn phí 1 triệu); Standard, WaveNet 4 USD (miễn phí 4 triệu theo bảng giá; một nguồn khác ghi WaveNet 1 triệu — **mâu thuẫn, kiểm lại**). **Phải bật thanh toán** | Bậc F0 miễn phí 0,5 triệu ký tự/tháng (giọng Neural); **đơn giá trả phí không đọc được từ trang** (chưa xác minh) | Miễn phí 100.000 ký tự (giọng v5), hàng đợi, giới hạn yêu cầu/ngày; gói trả phí bằng VND (500.000đ = +1,5 triệu ký tự … 5.000.000đ = +27 triệu); chưa rõ theo tháng hay một lần |
| 7. Giới hạn API | 5.000 byte/yêu cầu; 200 yêu cầu/phút (Chirp 3 HD), 1.000 (Neural2/khác) mỗi dự án | Chưa xác minh | 5.000 ký tự/yêu cầu (tối thiểu 3); phía miễn phí có giới hạn ngày |
| 8. Định dạng | MP3, LINEAR16, OGG_OPUS… (chưa đối chiếu đủ danh sách) | Nhiều định dạng (chưa đối chiếu) | `mp3`, `wav` |
| Cơ chế | Đồng bộ (JSON `audioContent` base64) | Đồng bộ (REST/SDK) | **Bất đồng bộ**: trả liên kết `async`, chờ 5 giây–2 phút, hoặc `callback_url`; thời hạn liên kết **không ghi** → phải tải về ngay |
| 9. Giấy phép tái dùng/phân phối tệp | **Chưa xác minh** (không tìm thấy điều khoản chính thức; chỉ có ý kiến cộng đồng — không dùng làm căn cứ) | **Chưa xác minh** | **Chưa xác minh** (không tìm thấy điều khoản của FPT.AI) |
| 10–11. Lưu nội dung gửi tới | "Google không ghi log văn bản/âm thanh TTS của khách; dịch vụ stateless" ([data-logging](https://docs.cloud.google.com/text-to-speech/docs/data-logging)) | API thời gian thực: "Microsoft không lưu văn bản và không lưu âm thanh" ([data-privacy-security](https://learn.microsoft.com/en-us/legal/cognitive-services/speech-service/text-to-speech/data-privacy-security)); batch có lưu ở Azure Storage, xóa được | **Chưa xác minh** (không tìm thấy chính sách của FPT.AI); âm thanh được lưu ở S3 một thời gian không rõ |
| 12. Thay nhà cung cấp | Dễ: giữ tệp đã duyệt, đổi adapter | Dễ | Dễ, nhưng cần tải tệp ngay (liên kết tạm) |

Nguồn: Google [bảng giá](https://cloud.google.com/text-to-speech/pricing) (số liệu qua tóm tắt tìm kiếm của trang chính thức — trang đầy đủ không đọc được), [hạn mức](https://docs.cloud.google.com/text-to-speech/quotas), [danh sách giọng](https://docs.cloud.google.com/text-to-speech/docs/list-voices-and-types); Azure [language support](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/language-support?tabs=tts), [bảng giá](https://azure.microsoft.com/en-us/pricing/details/cognitive-services/speech-services/); FPT.AI [API](https://docs.fpt.ai/docs/en/speech/api/text-to-speech), [giá](https://docs.fpt.ai/docs/en/speech/documentation/tts-pricing).

### 3.2 Đề xuất (chưa phải quyết định mua)

**Ứng viên ưu tiên cho POC: Google Cloud TTS, giọng `vi-VN-Neural2-A/D`** (chế độ tốc độ chậm có tham số, gói miễn phí lớn so với nhu cầu, không ghi log, đồng bộ nên đơn giản, quota rõ). **Phương án thứ hai: FPT.AI** — lợi thế giọng bản địa có ghi vùng Bắc/Trung/Nam (phù hợp Q-03 về giọng vùng miền) nhưng thiếu điều khoản lưu trữ/giấy phép và bất đồng bộ. Azure là phương án dự phòng (cần đọc đủ danh sách giọng/giá).

Lý do không chọn theo chất lượng: **chưa nghe thử bất kỳ giọng nào** — đề xuất dựa trên tính năng, chi phí, quyền riêng tư và độ đơn giản; GV phải nghe và quyết định.

### 3.3 Chi phí ước tính (chỉ tính phần TTS; phép tính của dự án)

Ngữ liệu hiện có: 17 câu lệnh chuẩn ≈ 1.100 ký tự, 60 từ ≈ 230, 31 câu ≈ 410 → < 2.000 ký tự; thêm lời khen/lời nhắc cỡ vài nghìn. Kể cả nhân 10–20 lần cho kho thật, vẫn **< 100.000 ký tự**, nằm trong mọi gói miễn phí ở bảng trên; nếu phải trả theo Neural2 (16 USD/1 triệu) thì ~1,6 USD cho 100.000 ký tự. Rủi ro chi phí chủ yếu là **bật thanh toán** (Google bắt buộc) và gọi lặp — đã giảm bằng cache khóa nội dung và hạn mức lô (§6).

### 3.4 Điều kiện còn phải xác minh trước khi chọn

1. Điều khoản chính thức về **lưu trữ lâu dài và phân phối lại tệp đã tổng hợp** trong ứng dụng cho học sinh (cả ba nhà cung cấp).
2. Danh sách giọng vi-VN thực tế (`ListVoices`/Voice Gallery) và đơn giá Azure.
3. **Nghe thử** (POC): phát âm dấu thanh, từ dễ nhầm (b/d, ch/tr, s/x), câu 4–6 tiếng, tốc độ chậm; giọng Bắc hay Nam hợp lớp (Q-03).
4. Bản quyền/nhãn "giọng tổng hợp" và yêu cầu ghi nguồn.
5. Điều kiện thanh toán cụ thể và đặt trần chi phí/cảnh báo ngân sách.
6. (FPT.AI) thời hạn liên kết âm thanh, điều khoản dữ liệu.

### 3.5 Kết quả POC

**Chưa thực hiện.** Không gọi API thật, không có mẫu âm thanh, không có đánh giá chất lượng. Mọi kiểm thử adapter dùng mock/`fetch` giả.

## 4. Kiến trúc và luồng dữ liệu

```mermaid
flowchart LR
  C[Học liệu / câu bài tập<br/>khe âm thanh + spokenText] --> P{Kế hoạch theo audioPolicy<br/>+ checkAudioLeaks}
  P -- âm/vần đơn lẻ --> R[Bản ghi GV<br/>/teacher/audio - R10.2]
  P -- được phép --> T[TtsProvider<br/>server, hạn mức, timeout]
  T --> Q[Kiểm tra kỹ thuật<br/>định dạng, thời lượng, im lặng]
  R --> Q
  Q --> V[GV nghe duyệt<br/>phiên bản bất biến]
  V --> L[(Thư viện âm thanh đã duyệt<br/>Storage + metadata)]
  L --> PL[Player: phát tệp đã duyệt<br/>theo audioPolicy H3-H0]
```

Nguyên tắc: **sinh trước → kiểm tra → GV duyệt → mới phát**. Học sinh chỉ nhận URL của tệp *đã duyệt* qua server; không có đường nào từ học sinh tới nhà cung cấp.

## 5. Interface `TtsProvider` (đã hiện thực)

```ts
interface TtsProvider {
  readonly id: "none" | "mock" | "google";
  readonly external: boolean;
  synthesize(request: TtsRequest, options: { signal: AbortSignal }): Promise<TtsOutcome>;
}
type TtsRequest = { text: string; purpose: "instruction"|"feedback"|"picture_name"|"word"|"sentence"|"model";
                    voiceKey: "vi-female-1"|"vi-male-1"; speed: "slow"|"normal" };
type TtsOutcome = { ok: true; data: { bytes: Uint8Array; mimeType: string } } | { ok: false; code: TtsErrorCode };
```

- `purpose` **không có** `phoneme`/`rime` → âm/vần đơn lẻ không thể đi qua TTS (kiểm bằng schema + `planSlotSynthesis` → `TEACHER_RECORDING_REQUIRED`).
- `voiceKey` là khóa nội bộ; adapter ánh xạ sang giọng nhà cung cấp → đổi nhà cung cấp không đổi dữ liệu bài.
- Mã lỗi: `NO_PROVIDER, INVALID_INPUT, PERSONAL_DATA_REJECTED, TEACHER_RECORDING_REQUIRED, AUDIO_ROLE_FORBIDDEN, AUDIO_LEAKS_ANSWER, BUDGET_EXCEEDED, TIMEOUT, PROVIDER_ERROR` — không mang nội dung yêu cầu, khóa hay phản hồi thô.
- `synthesizeSpeech()` (`service.ts`): zod → từ chối dữ liệu giống cá nhân → bỏ qua nếu `none` → trừ hạn mức ký tự (`CharBudget`, mặc định 3.000/lô) → timeout 8 giây → bắt mọi ngoại lệ.
- `createTtsProvider(env)`: `TTS_PROVIDER` = `none` (mặc định) | `mock` | `google`; `google` thiếu `TTS_GOOGLE_API_KEY` → `none`. Mô-đun `import "server-only"`; khóa chỉ đọc ở đây, đã thêm vào `check:bundle`.
- `ttsCacheKey()` = sha256(nhà cung cấp, mục đích, giọng, tốc độ, văn bản NFC) để dùng lại tệp, không chứa dữ liệu học sinh.
- Không có mã nào gọi `synthesizeSpeech` ở R10.1: **không có route, không tác vụ nền, không gọi hàng loạt**.

## 6. Bảo mật và quyền riêng tư

- Chỉ server; khóa nằm ở biến môi trường server (`TTS_GOOGLE_API_KEY`, không `NEXT_PUBLIC_`); không `fetch` từ trình duyệt; `redirect: "error"`.
- Văn bản gửi đi chỉ là học liệu/chuỗi cố định do GV duyệt; schema `strictObject` không nhận trường lạ (không `studentId`, `alias`…); chặn email, số điện thoại, URL, mã thẻ học, ký tự ẩn, `<`/`>` (chặn chèn SSML).
- Log chỉ UUID/mã lỗi (không văn bản, không khóa).
- Hạn mức ký tự mỗi lô, timeout, không thử lại tự động (tránh nhân chi phí); R10.2 thêm trần theo ngày/tháng và quyền GV `owner`.
- Chủ dự án quyết định trước khi gửi bất kỳ văn bản nào tới nhà cung cấp ngoài (PRIVACY_AND_SECURITY).

## 7. Chống lộ đáp án (giữ AD-35)

`planSlotSynthesis({ role, slot, policy, exposure })` dùng lại `checkAudioLeaks` và `audioPolicy` của biến thể, nên **không tạo logic thứ hai**:

| Tình huống | Kết quả (đã có test) |
|---|---|
| Kích thích là âm đơn lẻ (`listen_letter`) | `TEACHER_RECORDING_REQUIRED` |
| Bài đọc từ có `stimulus` đọc từ cần đọc | `AUDIO_ROLE_FORBIDDEN` |
| Câu lệnh chứa từ cần đọc | `AUDIO_LEAKS_ANSWER` |
| Câu lệnh chuẩn; âm thanh mẫu sau chấm (`modelAfterGrading`) | Được phép |
| Gợi ý (`hint`) | Chính sách H3–H0 quyết định lúc *phát* (R10.3): chỉ khi trẻ bấm, tính là gợi ý |

Không tạo khe âm thanh mới ngoài 5 vai trò (`instruction, stimulus, options, model, feedback`). `MISSING_AUDIO` của bài nghe âm giữ nguyên (test); mock không làm đổi kết quả kiểm tra. **R10.1 không mở khóa `AudioSlot`.**

## 8. Quy định bản ghi GV, giấy phép, duyệt

- Bản ghi GV là nguồn bắt buộc cho âm/vần đơn lẻ; GV chỉ ghi giọng của mình; **không ghi âm trẻ** (CLAUDE.md §6.6); `/teacher/audio` là route duy nhất bật micro.
- Mỗi tệp có: mã asset, văn bản đọc (NFC), loại (`phoneme|rime|instruction|word|sentence|feedback`), nguồn (`teacher_recording`|`tts`), người ghi/nhà cung cấp + giọng, định dạng, thời lượng, hash nội dung, phiên bản, giấy phép/nguồn, trạng thái (`draft → pending_review → approved|rejected`), `reviewedBy`, `reviewedAt`, `contentHash`.
- **Không bao giờ tự đặt `approved`.** Phiên bản đã gửi duyệt là bất biến; sửa = phiên bản mới. TTS cũng phải được GV nghe duyệt.
- Mở rộng `content/media/licenses.json` hiện chỉ có hình/phông (`kind`) — phần âm thanh dùng bảng riêng ở R10.2 vì tệp âm thanh không nằm trong repo công khai (CLAUDE.md §6.9).
- **46 tệp Piper** (nhánh `local/gd5-audio-wip`) chưa xác minh quyền sử dụng: **không** đưa vào repo, test, assets hay danh mục.

## 9. Lưu trữ, định dạng, bộ nhớ đệm, lỗi, offline (đề xuất cho R10.2–R10.3, chưa làm)

- **Lưu trữ:** Supabase Storage bucket riêng tư (không trong git); học sinh nhận URL ký ngắn hạn qua gateway; metadata trong bảng `audio_assets` (+ `audio_asset_versions`) — migration và RLS thuộc R10.2.
- **Định dạng:** MP3 mono 22,05–24 kHz (~32–48 kbps) cho TTS; bản ghi GV chuẩn hóa về MP3/AAC mono (iOS không phát WebM/Opus chắc chắn → cần POC; phương án: GV tải tệp ghi sẵn).
- **Kiểm tra kỹ thuật tự động (trước khi gửi duyệt):** thời lượng 0,3–10 giây (âm đơn lẻ ≤ 2 giây), không im lặng/cắt cụt, âm lượng chuẩn hóa, kích thước tối đa.
- **Bộ nhớ đệm:** khóa `ttsCacheKey`; tải trước câu kế tiếp; Cache-Control dài cho URL bất biến theo phiên bản.
- **Lỗi/offline:** thiếu tệp → bài vẫn làm được nhờ chữ và hình (câu lệnh luôn có bản chữ); riêng bài nghe âm bắt buộc có bản ghi → không phát câu đó (`MISSING_AUDIO`), không giả lập, không dùng giọng trình duyệt. Không có chế độ offline ở R10.
- **iOS:** mở khóa audio bằng thao tác "Bắt đầu" (R10.3).

## 10. Quyết định cần chủ dự án / GV xác nhận

| # | Ai | Quyết định |
|---|---|---|
| D1 | Chủ dự án | Cho phép tạo tài khoản/khóa thử nghiệm (Google trước) và đặt trần chi phí; chấp nhận bật thanh toán nếu bắt buộc |
| D2 | Chủ dự án | Đọc/chấp thuận điều khoản về lưu trữ và phân phối lại tệp TTS |
| D3 | GV | Nghe mẫu và chọn giọng (nữ/nam, Bắc/Nam) — Q-03 |
| D4 | GV | Xưng hô "con/em" trong lời đọc — Q-08 |
| D5 | GV | Cách gọi âm, tên chữ cái, vần cần ghi (xem [AUDIO_RECORDING_PLAN](AUDIO_RECORDING_PLAN.md) §6) — Q-01/Q-02 |
| D6 | Chủ dự án | Chấp nhận cho lời khen/câu lệnh chuẩn dùng TTS hay GV ghi hết |

## 11. Điều kiện chuyển R10.2

1. D1–D2 được chấp thuận (hoặc quyết định bỏ TTS, chỉ dùng bản ghi GV — thiết kế vẫn dùng được).
2. Kết quả nghe thử (nếu dùng TTS) được GV ghi lại.
3. GV xác nhận danh sách §6 của kế hoạch ghi âm (ít nhất nhóm P0).
4. Chủ dự án cho phép migration `audio_assets` và bucket Storage.
5. Q-03 (người ghi, giọng vùng) có trả lời.

R10.1 **không** tự chuyển sang R10.2.
