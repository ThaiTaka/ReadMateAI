# ReadMate AI — Kế hoạch ghi âm của giáo viên (DỰ KIẾN)

> **Trạng thái: DỰ KIẾN — chưa giáo viên nào duyệt.** Lập ngày 2026-10-26 (R10.1) từ `content/kb/phonemes.json`, `rimes.json`, `letters.json` và 17 biến thể bài tập. Cách gọi âm trong kho là **đề xuất của AI, chờ GV xác nhận** (Q-02). Lớp 1A2 **chưa có hồ sơ tiến độ** (bộ sách Q-01 chưa biết) nên **chưa thể** nói lớp cần ghi những âm/vần nào. R10.1 không yêu cầu GV ghi âm.
> Liên quan: [AUDIO_ENGINE](AUDIO_ENGINE.md), [PRD A7](PRD.md).

## 1. Nguyên tắc: không ghi hết nếu chưa cần

Chỉ **một** biến thể hiện nay bắt buộc bản ghi GV: `listen_letter` (Nghe âm – chọn chữ), khe `stimulus` = **âm** (`required: ["instruction","stimulus"]`). Vần đơn lẻ **chưa** được biến thể nào bắt buộc (PRD A7 nói vần đơn lẻ cũng dùng bản ghi GV khi cần phát). Vì vậy:

| Nhóm | Nội dung | Bắt buộc theo mã hiện tại? | Số bản ghi duy nhất |
|---|---|---|---|
| **P0** | Cách gọi âm của chữ ghi âm (phoneme) | **Có** (cho `listen_letter`), nhưng chỉ những âm lớp đã học | **38** (trần cho 39 âm; xem §3) |
| **P1** | Vần nhiều chữ xuất hiện trong ngữ liệu hiện có | Chưa (chỉ khi bật nghe vần/âm thanh mẫu vần) | **19** (từ ngữ liệu *minh họa*, không phải của lớp) |
| **P2** | Các vần nhiều chữ còn lại trong danh mục | Chưa | **124** (143 − 19) |
| **P3** (tùy chọn) | Tên 29 chữ cái | Chưa | **18** (11 tên trùng cách gọi âm nguyên âm) |
| **P3** (tùy chọn) | Tên 5–6 thanh | Chưa (có thể dùng TTS nếu GV đồng ý) | 5–6 |

**Tổng tối đa nếu ghi toàn bộ danh mục:** 38 + 143 = **181** (+ tùy chọn ≈ 24). **Con số cần thật sự:** phụ thuộc bộ sách/vị trí bài của 1A2 — thường là P0 của các âm đã học (≤ 38) và một phần P1/P2. Đề nghị **bắt đầu chỉ với P0 của các âm đã học đến hiện tại**.

## 2. Trùng và tái sử dụng

- 10 vần đơn nguyên âm (`a e ê i y o ô ơ u ư`) **không cần bản ghi riêng**: dùng lại bản ghi âm nguyên âm tương ứng (AD-28).
- `i` và `y` có cùng cách gọi đề xuất "i" → 1 bản ghi dùng chung, **trừ khi GV muốn "i dài" cho y** (+1).
- Mỗi bản ghi dùng ở mọi bài (nghe âm, âm thanh mẫu, gợi ý) — một đơn vị, một tệp, nhiều phiên bản chỉ khi GV ghi lại.
- Chữ ghép: 10 chữ đôi + 1 chữ ba (`ch gh gi kh ng ngh nh ph qu th tr`, `ngh`) đã nằm trong 38.

## 3. Danh mục dự kiến

### P0 — 38 cách gọi âm (đề xuất AI, chờ GV)

- **Phụ âm đơn (16):** b bờ · c cờ · d dờ · đ đờ · g gờ · h hờ · k "ca" · l lờ · m mờ · n nờ · p pờ · r rờ · s sờ · t tờ · v vờ · x xờ
- **Phụ âm ghép (11):** ch chờ · gh "gờ kép" · gi "di" · kh khờ · ng ngờ · ngh "ngờ kép" · nh nhờ · ph phờ · qu quờ · th thờ · tr trờ
- **Nguyên âm (11 nhãn cho 12 chữ):** a · ă "á" · â "ớ" · e · ê · i (dùng chung y) · o · ô · ơ · u · ư

Điểm cần GV chốt trước khi ghi: nhãn **k** ("ca" hay "cờ"/"ka"), **gh/ngh** ("gờ kép", "gờ"/"ngờ" hay "gờ ghép"), **gi** ("di"/"gi"/"giờ"), **qu**, ă/â ("á", "ớ" hay "ắ", "ấ"), y.

### P1 — 19 vần nhiều chữ có trong ngữ liệu minh họa

`ia ua ưa ach am an anh au ay oi on ot iêng yêu oa oe uy uya uyên` — *lấy từ 57 tiếng minh họa của kho, không phải chương trình của lớp; một số (uya, uyên) ít gặp ở lớp 1.*

### P2 — 124 vần còn lại, nhóm theo cấu tạo (để chia buổi)

- **Âm cuối p/t/c/ch (51):** ac ap at ăc ăp ăt âc âp ât ec ep et êch êp êt ich ip it oc op ooc ôc ôp ôt ơp ơt uc up ut ưc ưt iêc iêp iêt yêt uôc uôt ươc ươp ươt oac oach oap oat oăc oăt oet uych uyt uyêt uât
- **Âm cuối m/n/ng/nh (50):** ang ăm ăn ăng âm ân âng em en eng êm ên ênh im in inh om ong oong ôm ôn ông ơm ơn um un ung ưng iêm iên yêm yên uôm uôn uông ươm ươn ương oam oan oang oanh oăm oăn oăng oen uynh uênh uân uâng
- **Vần mở / bán nguyên âm (23):** ai ao âu ây eo êu iu ôi ơi ui ưi ưu iêu uôi ươi ươu oai oay oeo uyu uê uây uơ

Nhiều vần trong danh mục được ghi chú "ít gặp ở lớp 1" (ví dụ `oăc`, `oam`, `uych`, `ooc`, `oong`): **không cần ghi** nếu bộ sách không dạy — đây là lý do danh mục 143 chỉ là trần.

### P3 (tùy chọn)

- Tên chữ cái trùng cách gọi nguyên âm (a á ớ e ê i o ô ơ u ư) không cần ghi lại; 18 tên còn lại: bê, xê, dê, đê, giê, hát, ca, e-lờ, em-mờ, en-nờ, pê, quy, e-rờ, ét-xì, tê, vê, ích-xì, i dài. Tên chữ cái ≠ cách gọi âm khi đánh vần (kho tách hai trường).
- Tên thanh: ngang, huyền, sắc, hỏi, ngã, nặng — GV quyết định ghi hay dùng TTS.

## 4. Thời gian ghi âm (ước lượng)

Giả định *chưa đo*: mỗi đơn vị ≈ 3 lần đọc + nghe chọn bản tốt ≈ **20 giây**; mỗi buổi nghỉ giữa chừng.

| Phạm vi | Số bản ghi | Thời gian ghi | + nghe duyệt (≈ 40%) |
|---|---|---|---|
| P0 | 38 | ≈ 13 phút | ≈ 18 phút |
| P1 | 19 | ≈ 6 phút | ≈ 9 phút |
| P2 | 124 | ≈ 41 phút | ≈ 58 phút |
| **P0+P1+P2** | **181** | **≈ 60 phút** | **≈ 85 phút** |
| P3 tùy chọn | ≈ 24 | ≈ 8 phút | ≈ 11 phút |

**Tối thiểu để mở khóa bài nghe âm (chỉ P0 các âm đã học):** khoảng 15–30 phút trong một buổi.

## 5. Chia buổi 15–20 phút

| Buổi | Nội dung | Số bản ghi | Ghi chú |
|---|---|---|---|
| 1 | P0 phụ âm (27) | 27 | Mỗi nhóm 9: đơn → ghép; nghe lại cuối buổi |
| 2 | P0 nguyên âm (11) + P1 (19) | 30 | Nguyên âm trước, rồi vần có trong ngữ liệu |
| 3 | P2 vần mở/bán nguyên âm (23) + một phần vần âm cuối nasal | ~40 | Chỉ ghi vần lớp thật sự dạy |
| 4 | P2 vần âm cuối m/n/ng/nh | ≤ 50 | Chia 2 buổi nếu cần |
| 5 | P2 vần âm cuối p/t/c/ch | ≤ 51 | Chia 2 buổi nếu cần |
| (6) | P3 tùy chọn | ≈ 24 | |

Có thể dừng sau buổi 1–2 rồi làm tiếp theo tiến độ dạy (ghi dần theo bài).

## 6. Môi trường và cách đọc

- Phòng yên tĩnh, đóng cửa, tắt quạt/điều hòa/thông báo; vải mềm quanh bàn nếu vang.
- Micro tai nghe hoặc điện thoại cách miệng ~15–20 cm, lệch một bên để tránh hơi gió; không dùng loa ngoài.
- **Một đơn vị mỗi tệp**; đọc rõ, **đúng cách cô dạy trên lớp** (không thêm "âm", "vần"), nhịp chậm, ngữ điệu không lên giọng; ngừng nửa giây trước và sau.
- Đọc cùng một giọng/khoảng cách trong cả buổi; không ghi âm trẻ em, không để tiếng trẻ vào nền.
- Cuối buổi nghe lại **từng** bản bằng tai nghe; đánh dấu bản cần ghi lại. Bản ghi chỉ dùng cho học sinh sau khi **GV nghe duyệt trong giao diện duyệt** (R10.2).
- Tệp chỉ lưu trong Storage riêng tư của dự án, không đưa vào repo công khai.

## 7. Điều GV cần xác nhận trước khi ghi

1. Bộ sách/vị trí bài hiện tại của 1A2 (Q-01) → danh sách âm/vần *thật sự* cần ghi.
2. Cách gọi từng âm trong P0 (Q-02), đặc biệt k, gh, ngh, gi, qu, ă, â, y.
3. Vần nào lớp dạy, vần nào bỏ ("ít gặp").
4. Giọng/xưng hô trong lời đọc ("con"/"em") (Q-08) và người ghi (Q-03).
5. Có ghi tên chữ cái và tên thanh không; có đồng ý TTS cho câu lệnh/lời khen không.
6. GV đồng ý để bản ghi giọng của mình được lưu và dùng trong ứng dụng (quyền sử dụng).

**Kết luận:** danh sách trên là *dự kiến*; chỉ trở thành kế hoạch chính thức khi GV duyệt các mục §7.
