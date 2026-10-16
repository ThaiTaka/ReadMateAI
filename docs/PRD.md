# ReadMate AI — Tài liệu yêu cầu sản phẩm (PRD)

> **Phiên bản:** 0.3 — thêm "Thay đổi định hướng (R01)" và ghi chú tại chỗ các phần bị thay thế
> **Ngày cập nhật:** 2026-10-16
> **Trạng thái:** ⚠️ **Một phần đã được thay thế** bởi [PRODUCT_REDESIGN.md](PRODUCT_REDESIGN.md) (R01, định hướng mới). Đọc mục [Thay đổi định hướng (R01)](#thay-đổi-định-hướng-r01) trước. Các phần không bị nêu tên vẫn còn hiệu lực (6 dạng bài, chính sách âm thanh, mức hỗ trợ, kiểm duyệt, quyền riêng tư).
> **Tài liệu liên quan:** [ARCHITECTURE.md](ARCHITECTURE.md) · [DATA_MODEL.md](DATA_MODEL.md) · [TASKS.md](../TASKS.md) · [PROGRESS.md](../PROGRESS.md) · [CLAUDE.md](../CLAUDE.md)

## Mục lục

1. [Tóm tắt sản phẩm](#1-tóm-tắt-sản-phẩm)
2. [Bối cảnh và vấn đề](#2-bối-cảnh-và-vấn-đề)
3. [Mục tiêu và phi mục tiêu](#3-mục-tiêu-và-phi-mục-tiêu)
4. [Người dùng](#4-người-dùng)
5. [Nguyên tắc sư phạm và thiết kế](#5-nguyên-tắc-sư-phạm-và-thiết-kế)
6. [Hành trình người dùng](#6-hành-trình-người-dùng)
7. [Phạm vi phát hành](#7-phạm-vi-phát-hành)
8. [Yêu cầu chức năng](#8-yêu-cầu-chức-năng)
9. [Sáu dạng bài tập MVP](#9-sáu-dạng-bài-tập-mvp)
10. [Ba nhóm năng lực và phân hóa](#10-ba-nhóm-năng-lực-và-phân-hóa)
11. [Mức hỗ trợ và cơ chế giảm dần](#11-mức-hỗ-trợ-và-cơ-chế-giảm-dần)
12. [Âm thanh](#12-âm-thanh)
13. [Phiếu học tập tương đương](#13-phiếu-học-tập-tương-đương)
14. [Dashboard giáo viên và chỉ số](#14-dashboard-giáo-viên-và-chỉ-số)
15. [AI hỗ trợ tạo bài (sau MVP)](#15-ai-hỗ-trợ-tạo-bài-sau-mvp)
16. [Yêu cầu phi chức năng](#16-yêu-cầu-phi-chức-năng)
17. [Quyền riêng tư và an toàn trẻ em](#17-quyền-riêng-tư-và-an-toàn-trẻ-em)
18. [Chỉ số thành công](#18-chỉ-số-thành-công)
19. [Giả định, rủi ro và câu hỏi mở](#19-giả-định-rủi-ro-và-câu-hỏi-mở)

---

## Thay đổi định hướng (R01)

Ngày 2026-10-16 người điều phối đổi định hướng: **nền tảng tự luyện Tiếng Việt tại nhà kết hợp trò chơi phiêu lưu, điểm thưởng và bảng xếp hạng lớp học**; học sinh chỉ dùng ở nhà; GV quản lý nội dung, theo dõi kết quả, vinh danh và tổ chức mùa thi đua. Mọi chức năng mới là **PLANNED**.

| Phần của PRD này | Tình trạng | Thay bằng |
|---|---|---|
| §1 triết lý "học có hướng dẫn ở nhà → tự thực hiện ở lớp", vòng lặp GV in phiếu | **Thay thế** | [PRODUCT_REDESIGN §1, §3](PRODUCT_REDESIGN.md#1-tuyên-bố-định-hướng) |
| §3.1 G2 (bản phiếu giấy tương đương), §3.2 "Không xếp hạng, không bảng thi đua" | **Thay thế** (đã ghi chú tại chỗ) | Bảng xếp hạng trong lớp có điều kiện — [LEADERBOARD_SPEC](LEADERBOARD_SPEC.md) |
| §5 P1 ("Thử như ở lớp"), P2 (khuôn trên phiếu), P7 (không phạt, không xếp hạng) | **Sửa** (đã ghi chú tại chỗ) | [GAMIFICATION_SPEC §10](GAMIFICATION_SPEC.md#10-trình-bày-điểm-cho-trẻ), CLAUDE.md §6.4, §7.10 |
| §6.2 bước 7, §6.3 bước 5–6 (in phiếu, ghi nhận tại lớp) | **Bỏ** | Buổi luyện + điểm + game ([GAME_DESIGN](GAME_DESIGN.md)) |
| §8.5 phiếu học tập, F-GV-09 ghi nhận tự lực tại lớp, F-DB-04 "sẵn sàng tự làm ở lớp" | **Bỏ khỏi lộ trình** | — |
| §11 tên H0 "Thử như ở lớp" | **Đổi tên** ("Tự làm", chờ GV) | [PRODUCT_REDESIGN §4.2](PRODUCT_REDESIGN.md#42-thay-đổi) |
| §13 phiếu học tập tương đương | **Bỏ khỏi lộ trình** | — |
| §14 "Không có xếp hạng học sinh" (dashboard GV) | **Giữ cho dashboard học tập**; bảng điểm thưởng là tính năng riêng | [LEADERBOARD_SPEC](LEADERBOARD_SPEC.md) |
| §18 chỉ số chính (tự làm phiếu tại lớp) | **Thay thế** | [PRODUCT_REDESIGN §8](PRODUCT_REDESIGN.md#8-chỉ-số-thành-công-đề-xuất) |

## 1. Tóm tắt sản phẩm

> ⚠️ *R01:* triết lý và vòng lặp dưới đây là **định hướng cũ** — xem [Thay đổi định hướng (R01)](#thay-đổi-định-hướng-r01).

**ReadMate AI** là website giúp học sinh lớp 1 luyện Tiếng Việt — nhận diện chữ, âm, vần, đánh vần, đọc trơn, phát triển vốn từ — **tại nhà**, với âm thanh đọc yêu cầu, hình ảnh trực quan, hướng dẫn từng bước, gợi ý theo bậc và phản hồi đúng/sai. Khi đã quen dạng bài, học sinh **tự thực hiện** các bài tương tự (khác nội dung) trên vở bài tập hoặc phiếu học tập **tại lớp**.

> **Triết lý cốt lõi: HỌC CÓ HƯỚNG DẪN Ở NHÀ → TỰ THỰC HIỆN Ở LỚP.**

Sản phẩm vận hành bằng hai vòng lặp:

- **Vòng lặp học sinh:** luyện ở nhà với hỗ trợ đầy đủ → hỗ trợ giảm dần → làm thử "như ở lớp" → ở lớp tự làm phiếu tương đương.
- **Vòng lặp giáo viên (hằng tuần):** cập nhật bài đã học → chọn và duyệt bài tập → giao theo ba nhóm → in phiếu tương đương → ghi nhận mức tự lực tại lớp → xem dashboard, điều chỉnh nhóm và ôn tập.

AI chỉ là công cụ **hỗ trợ giáo viên tạo bản nháp** bài tập (sau MVP); mọi nội dung đều qua bộ kiểm tra tự động và **giáo viên duyệt** trước khi đến tay học sinh. Website phải chạy đầy đủ với các bài đã duyệt **ngay cả khi không có AI**.

## 2. Bối cảnh và vấn đề

Sản phẩm xuất phát từ thực tế lớp **1A2**. Lớp có ba nhóm học sinh — **linh hoạt, không gắn nhãn cố định**:

| Nhóm (cách gọi của GV) | Đặc điểm | Nhu cầu |
|---|---|---|
| **Nhóm 1 – Đọc tốt** | Nhận diện tốt các chữ đã học; đánh vần và đọc trơn được | Mở rộng vốn từ, đọc hiểu, tăng lưu loát; bài mở rộng để không phải chờ bạn |
| **Nhóm 2 – Đang phát triển** | Tương đối nhớ chữ đã học; đánh vần, đọc trơn còn chậm | Luyện ghép tiếng, củng cố âm – vần, tăng độ chính xác và lưu loát |
| **Nhóm 3 – Cần hỗ trợ nền tảng** | Hơn 7 em chưa nhớ vững chữ sau một tháng học; chưa đánh vần, đọc trơn độc lập | Luyện nhận diện chữ – âm, ghi nhớ, ôn lặp lại, ghép tiếng theo từng bước nhỏ |

**Vấn đề cần giải quyết**

1. Giáo viên phải hướng dẫn riêng từng em cách làm từng dạng bài; các em khác phải chờ.
2. Nhóm 3 cần lặp lại nhiều lần theo bước nhỏ — thời gian trên lớp không đủ.
3. Nhóm 1 cần bài mở rộng để tiếp tục tiến bộ.
4. Phụ huynh muốn hỗ trợ ở nhà nhưng không biết hướng dẫn theo đúng cách cô dạy ở lớp.

**Giả thuyết sản phẩm:** nếu học sinh được làm quen trước **khuôn dạng bài** (biểu tượng, câu lệnh, cách thao tác) ở nhà với mức hỗ trợ giảm dần, thì ở lớp các em có thể tự làm bài tương tự với nội dung khác mà ít cần giáo viên hướng dẫn riêng.

## 3. Mục tiêu và phi mục tiêu

### 3.1 Mục tiêu MVP

| Mã | Mục tiêu |
|---|---|
| G1 | Học sinh cả ba nhóm có bài luyện phù hợp năng lực, làm tại nhà trên điện thoại, máy tính bảng, máy tính trong 10–15 phút/buổi |
| G2 | Sáu dạng bài cơ bản, mỗi dạng có bản tương tác ~~và bản phiếu giấy tương đương~~ (*R01:* bỏ bản phiếu) |
| G3 | Âm thanh đọc yêu cầu, hướng dẫn và nghe mẫu — **không làm lộ đáp án** của bài kiểm tra kỹ năng đọc |
| G4 | Hỗ trợ giảm dần (H3 → H0) để học sinh chuyển sang tự lực |
| G5 | 100% nội dung được giáo viên duyệt trước khi học sinh nhìn thấy |
| G6 | Lưu kết quả, phân tích dạng lỗi, đề xuất ôn tập; dashboard giáo viên cơ bản |
| G7 | Bảo vệ dữ liệu trẻ em ngay từ thiết kế (privacy by design) |

### 3.2 Phi mục tiêu

- Không có chatbot hay AI tạo sinh tương tác trực tiếp với học sinh — **kể cả sau MVP**.
- Không ghi âm, không nhận dạng giọng nói của trẻ (MVP); mọi tính năng giọng nói về sau phải có đồng ý riêng và đánh giá tác động.
- Không huấn luyện mô hình ngôn ngữ.
- ~~Không xếp hạng, không bảng thi đua công khai~~ → *R01:* có bảng xếp hạng điểm thưởng **trong phạm vi lớp**, có điều kiện, mặc định tắt ([LEADERBOARD_SPEC](LEADERBOARD_SPEC.md)); vẫn không có bảng công khai ra ngoài lớp. Không quảng cáo, không mua bán trong ứng dụng (giữ nguyên).
- Không có tài khoản phụ huynh, không nhắn tin trong MVP.
- Không dạy tập viết chữ tay (phiếu có thể có dòng kẻ để viết).
- Không sao chép nội dung sách giáo khoa; chỉ tham chiếu **thứ tự bài học**.

## 4. Người dùng

| Vai trò | Mô tả | Nhu cầu chính | Thiết bị chủ yếu |
|---|---|---|---|
| Học sinh lớp 1 (6–7 tuổi) | Chưa đọc thạo; thao tác bằng chạm | Biết phải làm gì mà không cần tự đọc yêu cầu; ít chữ, nhiều hình; phản hồi nhẹ nhàng, vui | Điện thoại/máy tính bảng của gia đình |
| Phụ huynh | Mở ứng dụng, ngồi cạnh khi cần | Thiết lập một lần (quét QR); biết con luyện gì và cách hỗ trợ mà không làm thay | Điện thoại |
| Giáo viên chủ nhiệm | Giao bài, duyệt nội dung, theo dõi | Tiết kiệm thời gian; biết em nào cần giúp, lỗi gì; in phiếu nhanh | Máy tính, điện thoại |
| Người biên soạn/quản trị nội dung | Chuẩn hóa kho tri thức | Công cụ nhập liệu có kiểm tra quy tắc tự động | Máy tính |
| Quản trị hệ thống | Cấp tài khoản giáo viên, vận hành | Phân quyền, nhật ký, sao lưu | Máy tính |

## 5. Nguyên tắc sư phạm và thiết kế

| Mã | Nguyên tắc | Hệ quả cho sản phẩm |
|---|---|---|
| P1 | ~~Học có hướng dẫn ở nhà → tự làm ở lớp~~ *R01:* **Tự luyện có hướng dẫn tại nhà** (giữ chuyển giao dần trách nhiệm: *Cô làm mẫu → Con làm có gợi ý → Con tự làm*) | Mỗi dạng bài có bước làm mẫu, gợi ý theo bậc và mức tự làm H0 (tên cũ "Thử như ở lớp") |
| P2 | **Một dạng bài = một khuôn cố định**: cùng biểu tượng, cùng câu lệnh ngắn, cùng bố cục trên màn hình và trên phiếu | Thư viện biểu tượng hướng dẫn dùng chung cho app và PDF (bản đen trắng) |
| P3 | **Âm thanh không làm lộ đáp án** | Chính sách âm thanh theo từng dạng bài + bộ kiểm tra tự động (§12) |
| P4 | **Chỉ dùng âm, vần, thanh đã học** theo vị trí bài học của lớp (trừ khi GV cho phép, ví dụ Nhóm 1) | Bộ kiểm tra "đọc được bằng kiến thức đã học" (decodability) |
| P5 | **Bước nhỏ, lặp lại có khoảng cách** cho Nhóm 3 | Hàng đợi ôn tập (Leitner), câu "bắc cầu" khi sai liên tiếp |
| P6 | **Không gắn nhãn** — học sinh không bao giờ thấy tên nhóm; nhóm linh hoạt do giáo viên quyết định | Nhóm chỉ hiển thị cho GV; hệ thống chỉ *đề xuất* đổi nhóm |
| P7 | Phản hồi tích cực, không phạt, không áp lực thời gian, không so sánh | Không đồng hồ đếm ngược, không bảng xếp hạng. *R01 sửa:* lời nói/âm thanh/hình ảnh vẫn tích cực; ngoại lệ có chủ đích là điểm thưởng −5 trình bày trung tính và bảng xếp hạng trong lớp có điều kiện ([GAMIFICATION_SPEC §10](GAMIFICATION_SPEC.md#10-trình-bày-điểm-cho-trẻ), [LEADERBOARD_SPEC §5](LEADERBOARD_SPEC.md#5-ngôn-ngữ-và-trình-bày-không-gây-xấu-hổ)) |
| P8 | Ít chữ, nhiều hình; vùng chạm lớn; một nhiệm vụ trên một màn hình | Vùng chạm ≥ 64 px; ưu tiên **chạm để chọn** thay vì kéo–thả |
| P9 | Nhất quán với cách dạy ở lớp: cách gọi tên âm, cách đánh vần, giọng của cô | Ưu tiên bản ghi âm giáo viên; xưng hô cấu hình được (cô/thầy – con/em) |
| P10 | Giáo viên quyết định cuối cùng (human-in-the-loop) | Mọi nội dung và mọi thay đổi nhóm đều cần GV xác nhận |

**Biểu tượng hướng dẫn dùng chung** (thiết kế ở GĐ4; ký hiệu dưới đây chỉ minh họa): 👂 Nghe · 👀 Nhìn · 👆 Chọn/Khoanh · 🔗 Nối · 🧩 Ghép · ✏️ Điền/Viết · 🔀 Sắp xếp · 📖 Đọc. Biểu tượng in trên phiếu giống hệt trên màn hình, để ở lớp học sinh nhận ra ngay "đây là dạng bài con đã làm ở nhà".

## 6. Hành trình người dùng

### 6.1 Thiết lập lần đầu (phụ huynh và học sinh)

1. Giáo viên in **thẻ học** cho từng em (mã QR + mã dự phòng 8 ký tự), gửi về nhà cùng thư giới thiệu và phiếu đồng ý xử lý dữ liệu.
2. Phụ huynh ký phiếu đồng ý (giấy) → giáo viên ghi nhận trên hệ thống. **Chưa có đồng ý thì không thu dữ liệu học tập** (học sinh vẫn có thể dùng chế độ chơi thử không lưu).
3. Phụ huynh quét QR bằng camera điện thoại → mở trang ReadMate → đọc thông báo ngắn về dữ liệu → bấm "Bắt đầu".
4. Thiết bị được liên kết với hồ sơ của con (chỉ biệt danh + ảnh đại diện con vật). Một thiết bị có thể liên kết nhiều anh/chị/em.
5. Gợi ý "Thêm vào màn hình chính".

### 6.2 Một buổi luyện ở nhà (10–15 phút)

1. Mở ứng dụng → chạm ảnh đại diện của mình (nếu thiết bị có nhiều hồ sơ).
2. Màn hình **"Bài hôm nay"** với một nút lớn **"Bắt đầu"** (thao tác chạm này đồng thời mở khóa âm thanh trên iOS).
3. **Khởi động:** 1–2 câu ôn những kiến thức đến hạn ôn.
4. Với dạng bài mới hoặc đang ở mức H3: **"Cô làm mẫu"** — hoạt cảnh ngắn có lời đọc.
5. Làm từng câu: nghe yêu cầu (tự phát hoặc chạm loa, tùy mức hỗ trợ) → chạm chọn → phản hồi.
6. Khi sai: lần 1 — "Con thử lại nhé" kèm gợi ý hình ảnh; lần 2 — gợi ý mạnh hơn; sau đó hiện đáp án và cho nghe mẫu (nếu chính sách cho phép); câu được ghi nhận "cần hỗ trợ".
7. Cuối buổi: **"Thử như ở lớp"** (1–3 câu ở mức H1/H0 nếu đủ điều kiện) → chúc mừng bằng hình dán (sticker); không có điểm số so sánh.
8. **Góc phụ huynh:** hôm nay con luyện gì, con làm tốt điều gì, gợi ý cách hỗ trợ (không làm thay).

### 6.3 Vòng lặp tuần của giáo viên

1. Cập nhật "lớp đã học đến bài …" (mỗi tuần một lần).
2. Mở **"Bài tuần này"**: hệ thống gợi ý gói bài cho từng nhóm từ thư viện đã duyệt và công cụ tạo nhanh theo quy tắc (sau MVP: AI tạo bản nháp).
3. Xem **báo cáo kiểm tra tự động** (chính tả, chỉ dùng điều đã học, đáp án duy nhất, âm thanh không lộ đáp án) → duyệt hoặc sửa.
4. Giao bài theo nhóm (ba biến thể) → học sinh nhận bài.
5. In **phiếu tương đương** cho từng nhóm.
6. Trên lớp: học sinh tự làm phiếu; giáo viên ghi nhanh **mức tự lực** (3 mức) trên điện thoại.
7. Xem dashboard: ai chưa làm, lỗi phổ biến, ai cần ôn gì, đề xuất đổi nhóm → giáo viên quyết định.

Mục tiêu: các bước 1–5 mất **≤ 30 phút/tuần** khi thư viện bài đã đủ lớn.

## 7. Phạm vi phát hành

| Tính năng | MVP | Sau MVP |
|---|---|---|
| Ba nhóm năng lực, giao bài theo nhóm | ✅ | Nhóm theo từng kỹ năng |
| Sáu dạng bài cơ bản | ✅ | Thêm dạng: đọc đoạn, nghe – chọn câu, … |
| Âm thanh yêu cầu, nghe mẫu (TTS sinh trước + ghi âm giáo viên) | ✅ | |
| Hỗ trợ giảm dần H3 → H0 | ✅ (luật cố định, có tham số) | Mô hình thống kê (BKT/Elo) |
| Ôn tập lặp lại có khoảng cách | ✅ (hộp Leitner) | |
| Phiếu PDF tương đương | ✅ | Phiếu cá nhân hóa từng em |
| Kho tri thức + quy trình duyệt | ✅ | Nhiều bộ sách, nhiều trường cộng tác |
| Tạo bài nhanh theo quy tắc (không AI) | ✅ | |
| AI tạo bản nháp bài tập (GV duyệt) | — | ✅ |
| Dashboard giáo viên | ✅ cơ bản | Phân tích nâng cao, xuất báo cáo |
| Ghi nhận mức tự lực tại lớp | ✅ | |
| Ngoại tuyến | Chịu được mất mạng ngắn | PWA ngoại tuyến đầy đủ |
| Nhận dạng giọng đọc của trẻ | — | Chỉ khi có đồng ý riêng + đánh giá tác động |

## 8. Yêu cầu chức năng

Ưu tiên: **MVP** = bắt buộc cho bản thí điểm; **SAU** = sau MVP.

### 8.1 Khu vực học sinh (HS)

| ID | Yêu cầu | Ưu tiên |
|---|---|---|
| F-HS-01 | Vào học không cần gõ chữ: thiết bị được liên kết bằng QR/mã dự phòng do GV cấp; chọn hồ sơ bằng ảnh đại diện | MVP |
| F-HS-02 | Màn hình "Bài hôm nay" với một nút bấm; tiến độ thể hiện bằng hình (sao, bậc thang) | MVP |
| F-HS-03 | Bộ chạy phiên: ôn tập khởi động → bài được giao → thử thách tùy chọn; tổng thời lượng ≤ 15 phút | MVP |
| F-HS-04 | Mỗi câu có nút loa phát lại yêu cầu; phản hồi đúng/sai bằng hình + âm thanh nhẹ nhàng | MVP |
| F-HS-05 | Gợi ý theo bậc (ưu tiên gợi ý hình ảnh); số lần thử tối đa cấu hình theo dạng bài | MVP |
| F-HS-06 | Mức hỗ trợ H3 → H0 theo từng dạng bài, tự điều chỉnh theo kết quả | MVP |
| F-HS-07 | Không có ô nhập văn bản tự do, không liên kết ra ngoài, không quảng cáo, không chat | MVP |
| F-HS-08 | Chịu được mất mạng ngắn: lưu tạm kết quả trên máy, tự gửi lại, không ghi trùng | MVP |
| F-HS-09 | Góc phụ huynh: tóm tắt buổi luyện và mẹo hỗ trợ | MVP |
| F-HS-10 | Chế độ chơi thử `/demo` với dữ liệu mẫu, không đăng nhập, không lưu dữ liệu | MVP |
| F-HS-11 | Cài như ứng dụng (PWA), học ngoại tuyến đầy đủ | SAU |

### 8.2 Khu vực giáo viên (GV)

| ID | Yêu cầu | Ưu tiên |
|---|---|---|
| F-GV-01 | Đăng nhập email + mật khẩu; tài khoản do quản trị cấp (tắt tự đăng ký) | MVP |
| F-GV-02 | Quản lý lớp và học sinh: biệt danh, số thứ tự, ảnh đại diện có sẵn. **Không** nhập họ tên đầy đủ, ngày sinh, ảnh thật | MVP |
| F-GV-03 | In thẻ học (QR + mã dự phòng); cấp lại/thu hồi mã; xem và thu hồi thiết bị đã liên kết | MVP |
| F-GV-04 | Ghi nhận đồng ý của phụ huynh (trạng thái, ngày, phiên bản thông báo); chưa có đồng ý thì không lưu dữ liệu học tập | MVP |
| F-GV-05 | Phân nhóm học sinh (3 nhóm), xem lịch sử thay đổi, nhận đề xuất đổi nhóm từ hệ thống | MVP |
| F-GV-06 | Cập nhật vị trí bài học hiện tại của lớp | MVP |
| F-GV-07 | Tạo bài giao theo nhóm (3 biến thể), đặt thời gian mở/hạn, mở/đóng bài | MVP |
| F-GV-08 | Theo dõi tiến độ, kết quả qua dashboard | MVP |
| F-GV-09 | Ghi nhận mức tự lực khi học sinh làm phiếu tại lớp | MVP |
| F-GV-10 | Ghi âm giọng đọc của GV cho âm, vần, câu lệnh; nghe lại và thay thế | MVP |
| F-GV-11 | Đồng chủ nhiệm (nhiều GV một lớp) | SAU |

### 8.3 Nội dung và kiểm duyệt (ND)

| ID | Yêu cầu | Ưu tiên |
|---|---|---|
| F-ND-01 | Kho tri thức chuẩn hóa: chữ cái, âm, vần, thanh, tiếng, từ, câu, đoạn; quy tắc chính tả/thanh điệu; thứ tự bài học theo bộ sách | MVP |
| F-ND-02 | Bộ kiểm tra tự động: chuẩn hóa Unicode (NFC), chính tả, quy tắc ghép, "chỉ dùng điều đã học", đáp án duy nhất, phương án nhiễu hợp lệ, âm thanh và văn bản hiển thị không lộ đáp án, đủ hình/âm thanh, từ ngữ phù hợp trẻ em | MVP |
| F-ND-03 | Soạn bài theo khuôn của 6 dạng; **tạo nhanh theo quy tắc** từ kho tri thức (không cần AI) | MVP |
| F-ND-04 | Quy trình duyệt: nháp → chờ duyệt → duyệt / yêu cầu sửa / từ chối; phiên bản bất biến sau khi gửi duyệt; nhật ký duyệt | MVP |
| F-ND-05 | Thư viện media có ghi nguồn gốc và giấy phép | MVP |
| F-ND-06 | AI tạo bản nháp từ kho tri thức (luôn qua bộ kiểm tra + GV duyệt) | SAU |

### 8.4 Âm thanh (AT)

| ID | Yêu cầu | Ưu tiên |
|---|---|---|
| F-AT-01 | Bốn loại tệp âm thanh: *yêu cầu*, *kích thích* (âm/tiếng trẻ cần nghe để làm bài), *mẫu* (nghe sau khi chấm), *phản hồi*. Chính sách của mỗi dạng bài còn quy định rõ việc **không đọc các phương án** trước khi chấm | MVP |
| F-AT-02 | Mỗi dạng bài khai báo chính sách được/không được phát cho từng vai trò, trước và sau khi chấm (§12) | MVP |
| F-AT-03 | Âm thanh được **sinh trước** khi duyệt bài (TTS hoặc ghi âm GV), không sinh lúc học sinh đang học | MVP |
| F-AT-04 | Âm và vần đơn lẻ dùng bản ghi âm giáo viên (hoặc thư viện đã duyệt) | MVP |
| F-AT-05 | Tệp nhỏ (mono, nén), tải trước câu kế tiếp, phát lại không giới hạn ở H3/H2 | MVP |

### 8.5 Phiếu học tập (PH)

| ID | Yêu cầu | Ưu tiên |
|---|---|---|
| F-PH-01 | Sinh phiếu PDF **tương đương** (§13) cho mỗi biến thể bài giao | MVP |
| F-PH-02 | GV xem trước, duyệt phiếu, tải PDF khổ A4 | MVP |
| F-PH-03 | In đen trắng vẫn rõ; cỡ chữ phần đọc ≥ 20 pt; biểu tượng giống ứng dụng | MVP |
| F-PH-04 | Phiếu không in tên học sinh (chỉ có dòng trống để em tự viết tên) | MVP |
| F-PH-05 | Phiếu cá nhân hóa theo từng học sinh | SAU |

### 8.6 Dashboard (DB)

| ID | Yêu cầu | Ưu tiên |
|---|---|---|
| F-DB-01 | Tổng quan tuần: đã làm/chưa làm, thời lượng, tỉ lệ đúng | MVP |
| F-DB-02 | Bản đồ nhiệt học sinh × âm/vần của các bài gần đây | MVP |
| F-DB-03 | Dạng lỗi phổ biến: cặp nhầm lẫn (b–d, l–n, …), quy tắc chính tả (c/k, g/gh, ng/ngh), dấu thanh | MVP |
| F-DB-04 | Mức hỗ trợ theo dạng bài, chỉ báo "sẵn sàng tự làm ở lớp", đối chiếu với ghi nhận tại lớp | MVP |
| F-DB-05 | Danh sách việc cần làm: cần ôn, cần GV hỗ trợ trực tiếp, đề xuất đổi nhóm (GV xác nhận) | MVP |
| F-DB-06 | Trang chi tiết từng học sinh | MVP |
| F-DB-07 | Xuất CSV có giới hạn và ghi nhật ký | SAU |

### 8.7 Bảo mật và quyền riêng tư (BM)

| ID | Yêu cầu | Ưu tiên |
|---|---|---|
| F-BM-01 | Phân quyền theo lớp; học sinh chỉ đọc dữ liệu của mình; không công khai kết quả cá nhân | MVP |
| F-BM-02 | Không thu dữ liệu học tập khi chưa ghi nhận đồng ý; chế độ demo không lưu | MVP |
| F-BM-03 | Tắt microphone/camera trên khu vực học sinh bằng chính sách trình duyệt | MVP |
| F-BM-04 | Xóa dữ liệu học sinh theo yêu cầu; tự động xóa/ẩn danh theo thời hạn lưu giữ | MVP |
| F-BM-05 | Nhật ký các thao tác nhạy cảm (ghi nhận đồng ý, duyệt nội dung, thu hồi thiết bị, xóa, xuất dữ liệu) | MVP |

## 9. Sáu dạng bài tập MVP

Sáu dạng bài tạo thành một lộ trình kỹ năng: **nhận diện chữ – âm → ghép tiếng → phân tích tiếng → chính tả → đọc từ → đọc câu**. Mỗi dạng bài là một "khuôn" gồm: lược đồ nội dung, giao diện tương tác, giao diện phiếu, hàm chấm, thang gợi ý, chính sách âm thanh và bộ kiểm tra riêng (xem [ARCHITECTURE.md §11](ARCHITECTURE.md#11-bộ-máy-bài-tập)).

### 9.1 Bảng tổng hợp

| # | Mã (code) | Tên dạng bài | Kỹ năng chính | Nhóm chủ đạo | Phiếu tương đương |
|---|---|---|---|---|---|
| 1 | `letter_sound` | Nhận diện chữ – âm | Nối âm với chữ ghi âm; nhận ra âm đầu | Nhóm 3 (Nhóm 2 ôn) | Nhìn hình, khoanh chữ ghi âm đầu |
| 2 | `build_syllable` | Ghép tiếng | Ghép âm đầu + vần + thanh; quy tắc c/k, g/gh, ng/ngh | Nhóm 3, Nhóm 2 | Ghép rồi viết tiếng; nối âm với vần |
| 3 | `identify_unit` | Tìm âm, vần, thanh trong tiếng | Phân tích tiếng | Nhóm 2 (Nhóm 3: âm đầu; Nhóm 1: vần khó) | Gạch chân tiếng có vần …; khoanh vần trong tiếng |
| 4 | `fill_blank` | Điền âm, vần, dấu thanh còn thiếu | Chính tả, quy tắc ghép | Nhóm 2, Nhóm 1 | Điền c hay k; điền vần an hay ang |
| 5 | `word_picture` | Đọc từ – chọn/nối hình | Đọc trơn từ (kiểm tra kỹ năng đọc) | Nhóm 2, Nhóm 1 (Nhóm 3: từ một tiếng đã học kỹ) | Đọc rồi nối từ với hình |
| 6 | `sentence_reading` | Đọc câu – hiểu câu | Đọc hiểu câu ngắn, vốn từ, sắp xếp câu | Nhóm 1 (Nhóm 2: câu ≤ 5 tiếng) | Đọc câu, khoanh hình đúng; sắp xếp rồi viết lại câu |

### 9.2 Đặc tả từng dạng

Ký hiệu chính sách âm thanh *trước khi câu được chấm xong*: ✅ được phát · 💡 chỉ phát khi trẻ chủ động bấm gợi ý (được tính là gợi ý) · ❌ không được phát. Sau khi câu đã chấm xong, được phép phát **âm thanh mẫu** để trẻ học từ phản hồi.

**Dạng 1 — Nhận diện chữ – âm (`letter_sound`)**

- Biến thể: (a) *Nhìn hình – chọn chữ ghi âm đầu* (ví dụ hình con bò → b / d / p); (b) *Nghe âm – chọn chữ* (chỉ có trên ứng dụng).
- Tương tác: chạm chọn 1 trong 2–4 thẻ chữ.
- Âm thanh: yêu cầu ✅ · tên hình/âm kích thích ✅ ở H3–H2, 💡 ở H1, ❌ ở H0 (vì ở lớp trẻ phải tự gọi tên hình) · đọc các phương án ❌ (nếu đọc, trẻ chỉ cần so âm thanh).
- Gợi ý: phóng to hình và nhắc "Con nói thật chậm tên hình" → làm mờ một phương án sai → hiện chữ đúng kèm âm mẫu.
- Thẻ lỗi: nhầm hình dạng chữ (b/d, p/q, m/n, n/u), nhầm âm (l/n, s/x, tr/ch, r/d/gi — tùy phương ngữ).

**Dạng 2 — Ghép tiếng (`build_syllable`)**

- Biến thể: (a) *Nhìn hình – ghép tiếng* (mã hóa: trẻ biết tên hình, ghép ra chữ); (b) *Ghép – chọn tiếng đúng* (giải mã: cho sẵn các phần, chọn tiếng tạo thành).
- Tương tác: chạm thẻ âm đầu → chạm thẻ vần → chạm thẻ dấu thanh; tiếng hiện dần trong ô. Không bắt buộc kéo–thả.
- Âm thanh: yêu cầu ✅ · tên hình ở biến thể (a) ✅ H3–H2, 💡 H1, ❌ H0 · ở biến thể (b) **không** đọc tiếng kết quả trước khi chấm ❌.
- Gợi ý: tô sáng ô cần điền → loại bớt thẻ sai → hiện mô hình đánh vần bằng chữ (b – a – ba – huyền – bà).
- Quy tắc được luyện: c/k/q, g/gh, ng/ngh; tiếng có âm cuối p, t, c, ch chỉ mang thanh sắc hoặc nặng.

**Dạng 3 — Tìm âm, vần, thanh trong tiếng (`identify_unit`)**

- Biến thể: "Tiếng *bàn* có vần gì?"; "Chọn các tiếng có vần *an*"; "Tiếng *mẹ* mang dấu thanh gì?"; "Âm đầu của tiếng … là gì?".
- Âm thanh: yêu cầu ✅ nhưng câu lệnh **không chứa** tiếng/từ cần phân tích · đọc tiếng 💡 ở H3–H2 (tính là gợi ý), ❌ ở H1–H0 · phương án ❌.
- Gợi ý: tách màu âm đầu / vần → loại bớt phương án.
- Thẻ lỗi: nhầm vần gần nhau (an/ang, at/ac, en/eng), nhầm dấu hỏi/ngã.

**Dạng 4 — Điền âm, vần, dấu thanh còn thiếu (`fill_blank`)**

- Ví dụ: hình cái kẻ + "_ẻ" → c hay k; hình cây bàng + "b_" → an hay ang.
- Âm thanh: yêu cầu ✅ · đọc từ đích ✅ H3–H2, 💡 H1, ❌ H0 (đây là kỹ năng nghe – viết/chính tả, không phải kỹ năng đọc) · phương án ❌.
- Gợi ý: hiện quy tắc bằng hình (k, gh, ngh đi với i, e, ê) → loại bớt phương án.
- Thẻ lỗi: vi phạm quy tắc c/k, g/gh, ng/ngh; nhầm vần; nhầm dấu thanh.

**Dạng 5 — Đọc từ – chọn/nối hình (`word_picture`)**

- Ví dụ: hiện chữ "quả na" → chọn đúng hình trong 2–4 hình; hoặc nối 3 từ với 3 hình.
- Âm thanh: yêu cầu ✅ ("Con đọc từ rồi chọn hình đúng" — không chứa từ) · **đọc từ ❌ ở mọi mức** · **đọc tên hình ❌** · sau khi chấm: "Nghe lại cách đọc" ✅.
- Gợi ý (chỉ bằng hình ảnh, không âm thanh): tách tiếng bằng dấu chấm (quả • na) → tô màu âm đầu/vần → hiện các bước đánh vần bằng chữ.
- Đây là dạng **kiểm tra kỹ năng đọc thực sự** — chính sách âm thanh nghiêm ngặt nhất.

**Dạng 6 — Đọc câu – hiểu câu (`sentence_reading`)**

- Biến thể: "Đọc câu – chọn hình đúng"; "Đọc câu – chọn Đúng/Sai với hình"; "Sắp xếp từ thành câu".
- Âm thanh: yêu cầu ✅ · **đọc câu ❌ trước khi chấm** · phương án ❌ · sau khi chấm: nghe mẫu ✅.
- Gợi ý: tô sáng từ khóa → tách tiếng; với sắp xếp câu: cố định sẵn từ đầu câu (chữ viết hoa) và dấu chấm cuối câu.
- Ràng buộc: câu ≤ 8 tiếng (Nhóm 1), ≤ 5 tiếng (Nhóm 2); chỉ dùng từ đọc được bằng kiến thức đã học, trừ từ mới được GV cho phép.

### 9.3 Điều chỉnh khi hiện thực (GĐ4)

Sáu dạng bài và mã của chúng giữ nguyên. Bộ máy và bản chơi thử: [EXERCISE_ENGINE.md](EXERCISE_ENGINE.md).

| Điểm | PRD (GĐ1) | Hiện thực GĐ4 | Lý do |
|---|---|---|---|
| Đối chiếu với yêu cầu GĐ4 (A–F) | — | A, B → dạng 1; C → dạng 2; D → dạng 4; E → dạng 5; F → dạng 6; dạng 3 giữ nguyên | Giữ sáu dạng đã phê duyệt |
| Dạng 1 | (a) nhìn hình – chọn chữ, (b) nghe âm – chọn chữ | Thêm biến thể **"Tìm chữ giống chữ mẫu"** (`visual_match`) trong dạng 1 | Yêu cầu A: phân biệt chữ dễ nhầm hình dạng (b/d/p, m/n/u, o/ô/ơ…) |
| Dạng 1 (b) | Nghe âm – chọn chữ | Có giao diện và cơ chế chọn, **chưa chấm được** | Chưa có bản ghi âm GV đã duyệt (A7) |
| Dạng 6 | Chọn hình; Đúng/Sai; sắp xếp | Chọn hình; **trả lời câu hỏi đọc hiểu** (đáp án phải nằm nguyên văn trong câu); sắp xếp. **Đúng/Sai chưa làm** | Yêu cầu F: đọc hiểu, câu hỏi phải xác định được từ ngữ liệu |
| Gợi ý dạng 5 | Tách tiếng → tô màu âm đầu/vần → đánh vần bằng chữ | Tách tiếng → loại bớt một tranh | Giao diện không có bộ phân tích tiếng (giữ bundle nhỏ); xem lại khi cần |
| Số lượt | "Số lần thử tối đa cấu hình theo dạng bài" (F-HS-05) | Theo **mức hỗ trợ**: H3/H2 = 3, H1 = 2, H0 = 1 | H0 mô phỏng làm phiếu ở lớp (một lần) |
| Ràng buộc Nhóm 3 với câu | Chưa quy định | Câu ≤ 4 tiếng (tạm) | Dạng 6 không phải dạng chủ đạo của Nhóm 3 — chọn thận trọng |

## 10. Ba nhóm năng lực và phân hóa

Trong mã nguồn, nhóm được gọi bằng tên ngữ nghĩa để tránh nhầm thứ tự: Nhóm 1 – Đọc tốt = `extending`, Nhóm 2 – Đang phát triển = `developing`, Nhóm 3 – Cần hỗ trợ nền tảng = `foundation`. Giao diện giáo viên hiển thị đúng cách gọi "Nhóm 1/2/3" của lớp. **Học sinh không bao giờ thấy tên nhóm.**

| Nhóm | Mã | Trọng tâm | Ràng buộc nội dung mặc định | Mức hỗ trợ khởi đầu | Dạng bài chủ đạo |
|---|---|---|---|---|---|
| Nhóm 3 | `foundation` | Nhận diện chữ – âm, ghép tiếng từng bước | ≤ 3 phương án; tiếng một âm tiết; chỉ đơn vị đã học **đến bài trước** (đã có thời gian củng cố) | H3 | 1, 2, 3 (âm đầu), 5 (từ một tiếng) |
| Nhóm 2 | `developing` | Ghép, phân tích tiếng, chính tả, đọc từ | ≤ 4 phương án; từ 1–2 tiếng; đơn vị đã học **đến bài hiện tại** | H2 | 2, 3, 4, 5 |
| Nhóm 1 | `extending` | Đọc từ, đọc câu, mở rộng vốn từ, đọc hiểu | ≤ 4 phương án; từ nhiều tiếng; câu ≤ 8 tiếng; có thể dùng đơn vị chưa học nếu GV cho phép | H1 | 4, 5, 6 |

**Phân hóa trong một phiên luyện** (luật mặc định, có tham số cấu hình):

- Sai 2 câu liên tiếp cùng dạng → chèn một câu "bắc cầu" dễ hơn cho cùng mục tiêu (ví dụ đang ghép tiếng có âm b → chèn câu nhận diện chữ b) và tăng mức hỗ trợ của dạng đó thêm 1 bậc trong phiên.
- Làm đúng ≥ 90% với ít gợi ý → mời làm 1–2 câu "Thử thách" (lấy từ nhóm kế trên); không bắt buộc.

**Đề xuất đổi nhóm:** hệ thống tính hằng tuần dựa trên mức thành thạo các đơn vị của hai bài gần nhất và mức hỗ trợ theo dạng; chỉ là **đề xuất có kèm bằng chứng**, giáo viên chấp nhận hoặc bỏ qua.

## 11. Mức hỗ trợ và cơ chế giảm dần

Mức hỗ trợ được theo dõi **riêng cho từng học sinh × từng dạng bài**.

| Mức | Tên | Hành vi |
|---|---|---|
| **H3** | Hỗ trợ đầy đủ | Tự phát âm thanh yêu cầu; "Cô làm mẫu" trước câu đầu của dạng bài; gợi ý chủ động sau 1 lần sai; âm thanh kích thích (nếu chính sách cho phép) tự phát |
| **H2** | Hỗ trợ một phần | Yêu cầu chỉ phát khi chạm loa; không làm mẫu; gợi ý khi trẻ bấm nút "Gợi ý" |
| **H1** | Hỗ trợ tối thiểu | Bố cục gần giống phiếu (biểu tượng + câu lệnh chữ); âm thanh yêu cầu và âm thanh kích thích (nếu chính sách của dạng bài cho phép) chỉ phát khi trẻ bấm "Trợ giúp" — được tính là gợi ý |
| **H0** | Tự lực — "Thử như ở lớp" | Bố cục giống phiếu; không gợi ý; dùng để kiểm tra mức sẵn sàng |

**Luật mặc định (tham số cấu hình được, sẽ hiệu chỉnh bằng dữ liệu thí điểm):**

- **Giảm hỗ trợ một bậc** khi 2 phiên liên tiếp của dạng bài ở mức hiện tại đạt tỉ lệ đúng ≥ 80% và dùng ≤ 1 gợi ý trên 5 câu.
- **Tăng hỗ trợ một bậc** khi tỉ lệ đúng trong phiên < 50% hoặc sai 3 câu liên tiếp.
- **"Sẵn sàng tự làm ở lớp"** với một dạng bài khi đạt ≥ 80% ở H0 trong ít nhất 1 phiên, hoặc ≥ 90% ở H1.
- Giáo viên có thể ghi đè mức hỗ trợ của từng học sinh.

## 12. Âm thanh

### 12.1 Quy tắc chống lộ đáp án (bắt buộc)

| Mã | Quy tắc |
|---|---|
| A1 | Âm thanh **yêu cầu** chỉ mô tả việc cần làm; không chứa đáp án và không chứa nội dung mà trẻ phải tự đọc |
| A2 | Mỗi dạng bài khai báo chính sách cho từng vai trò âm thanh (yêu cầu, kích thích, phương án, mẫu, phản hồi), trước và sau khi chấm |
| A3 | Khi mục tiêu là kỹ năng **đọc**, không phát âm thanh của chữ/từ/câu cần đọc trước khi câu được chấm xong |
| A4 | Âm thanh **mẫu** chỉ phát sau khi câu đã chấm xong (học từ phản hồi) |
| A5 | Lời phản hồi khi sai không nói đáp án ở lần thử đầu; đáp án chỉ hiện/đọc khi kết thúc lượt |
| A6 | Bộ kiểm tra tự động so khớp nội dung lời đọc với đáp án (chuẩn hóa NFC, không phân biệt hoa thường, theo ranh giới từ) và **chặn duyệt** nếu vi phạm A1/A3 |
| A7 | Âm và vần đơn lẻ dùng bản ghi âm giáo viên; TTS thường không phát âm đúng âm/vần tách rời theo cách dạy ở trường |

### 12.2 Nguồn âm thanh

- **Ghi âm giáo viên** (ưu tiên cho âm, vần, câu lệnh chuẩn): giáo viên ghi trên trình duyệt hoặc tải tệp lên; nghe lại, duyệt rồi mới dùng. Giọng giáo viên là dữ liệu cá nhân của giáo viên → cần sự đồng ý của giáo viên.
- **TTS sinh trước** (cho câu lệnh, từ, câu, lời khen): nhà cung cấp được chọn sau thử nghiệm (POC) ở GĐ6 — tiêu chí: phát âm đúng thanh điệu, giọng phù hợp vùng miền của lớp, chi phí, điều khoản dữ liệu.
- **Không** dùng TTS của trình duyệt cho nội dung chính thức (chất lượng phụ thuộc thiết bị) — chỉ dùng trong `/demo` khi chưa có tệp. *Điều chỉnh GĐ4:* `/demo` **cũng không dùng** TTS của trình duyệt — giọng tiếng Việt của một số trình duyệt là giọng trực tuyến (gửi chữ ra máy chủ bên ngoài) và chất lượng chưa xác minh; nút loa hiển thị "Chưa có âm thanh" cho tới GĐ6 (AD-39).

### 12.3 Yêu cầu kỹ thuật

- Mono, nén (AAC/MP3 khoảng 48–64 kbps); đoạn ngắn ≤ 50 KB.
- Tải trước âm thanh của câu kế tiếp; nút loa luôn ở cùng vị trí.
- Xưng hô cấu hình theo lớp: "cô/thầy" – "con/em".

## 13. Phiếu học tập tương đương

> ⚠️ *R01:* phần này **bỏ khỏi lộ trình** (AD-51) — giữ để tra cứu.

**Định nghĩa "tương đương":** cùng dạng bài, cùng biểu tượng và câu lệnh, cùng mục tiêu kiến thức (hoặc cùng nhóm đơn vị), cùng độ khó (± 1 bậc), **khác nội dung cụ thể** (không trùng câu nào với bài ở nhà).

- Phiếu được sinh cho từng biến thể (theo nhóm) của bài giao; giáo viên xem trước và duyệt.
- Khổ A4 dọc; cỡ chữ phần đọc ≥ 20 pt; font thân thiện với người mới học đọc (chữ *a*, *g* một tầng) có đầy đủ dấu tiếng Việt.
- In đen trắng vẫn rõ: hình nét đậm hoặc thang xám, không dựa vào màu để phân biệt.
- Phần đầu phiếu: tên bài, ngày, dòng trống để em viết tên; **không in tên học sinh**.
- Mỗi phần bài có biểu tượng hướng dẫn giống hệt ứng dụng và câu lệnh chuẩn của dạng bài.

## 14. Dashboard giáo viên và chỉ số

| Chỉ số | Định nghĩa |
|---|---|
| Tỉ lệ hoàn thành tuần | Số học sinh hoàn thành ≥ 1 phiên của bài giao / số học sinh được giao |
| Tỉ lệ đúng độc lập | Câu đúng ở lần thử đầu, không dùng gợi ý / tổng số câu |
| Mức thành thạo đơn vị | Điểm 0–1 cho mỗi âm/vần/thanh (trung bình trượt có trọng số, ưu tiên câu đúng độc lập) |
| Chỉ số phụ thuộc hỗ trợ | (số gợi ý + số lần bấm trợ giúp ở H1/H0) / số câu |
| Sẵn sàng tự làm (theo dạng) | Theo luật ở §11 |
| Tự lực tại lớp (GV ghi nhận) | 3 mức: *Tự làm được* · *Cần nhắc 1–2 lần* · *Cần hướng dẫn riêng* |
| Cặp nhầm lẫn | Số lần chọn phương án nhiễu thuộc cặp nhầm lẫn đã gắn thẻ (b–d, l–n, an–ang, hỏi–ngã, …) |

Màn hình MVP: tổng quan lớp, bản đồ nhiệt, lỗi phổ biến, mức hỗ trợ và mức tự lực, danh sách việc cần làm, chi tiết học sinh. Biểu đồ không chỉ dựa vào màu (có ký hiệu/nhãn). Không có xếp hạng học sinh.

## 15. AI hỗ trợ tạo bài (sau MVP)

- Không huấn luyện mô hình; dùng mô hình có sẵn qua API, phía server, **thay thế được nhà cung cấp**.
- AI chỉ tạo **bản nháp** dựa trên kho tri thức có cấu trúc (danh sách âm/vần đã học, từ đọc được, hình có sẵn, lược đồ dạng bài).
- Đầu ra bắt buộc qua: kiểm tra lược đồ (zod) → bộ quy tắc xác định (chính tả, decodability, đáp án duy nhất, âm thanh không lộ đáp án, từ ngữ phù hợp) → **giáo viên duyệt**. AI không bao giờ tự duyệt.
- Không gửi bất kỳ dữ liệu học sinh nào (kể cả biệt danh, mã, kết quả) tới nhà cung cấp AI.
- Học sinh không bao giờ tương tác trực tiếp với AI.
- Website chạy đầy đủ khi tắt AI hoặc không có khóa API.

## 16. Yêu cầu phi chức năng

| Hạng mục | Yêu cầu |
|---|---|
| Thiết bị | Android phổ thông (2–3 GB RAM), iPhone/iPad (Safari), máy tính (Chrome/Edge); chiều rộng tối thiểu 360 px; dọc và ngang |
| Hiệu năng | Mở "Bài hôm nay" ≤ 3 giây trên 4G; phản hồi chạm ≤ 100 ms (chấm tại máy); âm thanh bắt đầu ≤ 300 ms sau khi chạm (đã tải trước) |
| Dữ liệu di động | ≤ khoảng 5 MB cho một phiên luyện |
| Độ tin cậy | Mất mạng giữa phiên không mất kết quả; gửi lại không tạo bản ghi trùng |
| Trợ năng | Khu vực GV: WCAG 2.2 AA. Khu vực HS: vùng chạm ≥ 64 px, tương phản cao, không nhấp nháy, màu không là tín hiệu duy nhất |
| Bảo mật | RLS cho mọi bảng; secret chỉ ở server; tiêu đề bảo mật (CSP, Permissions-Policy); giới hạn tần suất đăng nhập |
| Quyền riêng tư | Tối thiểu hóa dữ liệu; không công cụ theo dõi bên thứ ba ở khu vực HS; thời hạn lưu giữ rõ ràng |
| Chi phí | Phát triển trong gói miễn phí; thí điểm production dự kiến dùng gói trả phí tối thiểu (xem ARCHITECTURE §21) |
| Bảo trì | TypeScript strict, kiểm thử tự động, tài liệu cập nhật theo giai đoạn |

## 17. Quyền riêng tư và an toàn trẻ em

**Dữ liệu được thu thập (tối thiểu):** biệt danh/tên gọi ở lớp (≤ 30 ký tự), số thứ tự, ảnh đại diện chọn từ bộ có sẵn, lớp, nhóm năng lực (chỉ GV thấy), kết quả từng câu, thời lượng, số gợi ý, thiết bị đã liên kết (mã nội bộ, thời điểm dùng gần nhất).

**Không thu thập:** họ tên đầy đủ, ngày sinh, giới tính, ảnh thật, địa chỉ, số điện thoại, thông tin phụ huynh, thông tin sức khỏe/khuyết tật, giọng nói, vị trí, dấu vân tay thiết bị.

**Nguyên tắc vận hành:**

1. Chỉ thu dữ liệu học tập của học sinh **đã có ghi nhận đồng ý** của phụ huynh; phiếu đồng ý giấy do nhà trường lưu, hệ thống chỉ lưu trạng thái, ngày, phiên bản thông báo.
2. Học sinh chỉ xem được dữ liệu của mình; giáo viên chỉ xem lớp mình; không có trang công khai kết quả.
3. Không ghi âm trẻ; microphone và camera bị tắt bằng chính sách trình duyệt ở khu vực học sinh.
4. Không quảng cáo, không công cụ theo dõi/analytics bên thứ ba ở khu vực học sinh, không liên kết ra ngoài.
5. Không gửi dữ liệu học sinh tới nhà cung cấp AI hoặc TTS.
6. Có quy trình xóa dữ liệu khi phụ huynh rút đồng ý và tự động xóa theo thời hạn lưu giữ (đề xuất trong [DATA_MODEL.md §10](DATA_MODEL.md#10-bảo-vệ-dữ-liệu-lưu-giữ-và-xóa)).

**Lưu ý pháp lý (không phải tư vấn pháp lý — cần nhà trường xác nhận):**

- **Luật Bảo vệ dữ liệu cá nhân số 91/2025/QH15** có hiệu lực từ **01/01/2026**. Điều 24 quy định bảo vệ dữ liệu cá nhân của trẻ em (người đại diện theo pháp luật thực hiện quyền thay trẻ; xử lý nhằm công bố/tiết lộ thông tin đời sống riêng tư của trẻ từ đủ 7 tuổi cần sự đồng ý của trẻ và người đại diện; ngừng xử lý khi rút đồng ý).
- Điều 20 coi việc **xử lý dữ liệu thu thập tại Việt Nam trên nền tảng đặt ngoài lãnh thổ** là chuyển dữ liệu xuyên biên giới. Supabase và Vercel đặt máy chủ ngoài Việt Nam (dự kiến Singapore) → cần xác định nghĩa vụ lập hồ sơ đánh giá tác động và các văn bản hướng dẫn thi hành trước khi thu dữ liệu thật.
- Cần làm rõ **bên kiểm soát dữ liệu** là nhà trường hay cá nhân giáo viên, và quy trình xin đồng ý của phụ huynh.

## 18. Chỉ số thành công

Các ngưỡng dưới đây là **đề xuất** để thống nhất với giáo viên trước khi thí điểm:

| Chỉ số | Ngưỡng đề xuất (sau 4 tuần thí điểm) |
|---|---|
| **Chỉ số chính:** tỉ lệ lượt làm phiếu tại lớp đạt mức "Tự làm được" đối với các dạng bài học sinh đã "sẵn sàng" | ≥ 70% |
| Thời gian GV hướng dẫn riêng khi học sinh làm phiếu (GV tự ghi nhận trước/sau) | Giảm ≥ 30% |
| Nhóm 3: số âm/vần đạt mức thành thạo tăng thêm mỗi em | Do GV đặt theo tiến độ bài học |
| Tỉ lệ học sinh hoàn thành bài ở nhà mỗi tuần | ≥ 60% |
| Nội dung chưa duyệt đến tay học sinh | 0 |
| Sự cố lộ dữ liệu | 0 |

## 19. Giả định, rủi ro và câu hỏi mở

### 19.1 Giả định

- Đa số gia đình có ít nhất một điện thoại thông minh có mạng; phụ huynh có thể ngồi cạnh trong lần đầu.
- Giáo viên dành được khoảng 30 phút/tuần cho vòng lặp giao bài khi thư viện đủ lớn.
- Nhà trường đồng ý cho thí điểm và hỗ trợ quy trình xin đồng ý của phụ huynh.

### 19.2 Rủi ro sản phẩm

| Rủi ro | Giảm thiểu |
|---|---|
| Trẻ 6 tuổi chưa tự thao tác được trên điện thoại | Thử khả dụng với bản `/demo` (GĐ4) trước khi xây CSDL; vùng chạm lớn; chạm thay vì kéo |
| TTS phát âm sai âm/vần tách rời hoặc khác giọng cô | Ghi âm giáo viên cho âm/vần (A7); POC TTS ở GĐ6 |
| Hình minh họa gây hiểu nhầm tên gọi | GV duyệt hình; ưu tiên hình rõ nghĩa; ghi nhận câu có tỉ lệ sai bất thường |
| Phụ huynh làm thay | Góc phụ huynh hướng dẫn cách hỗ trợ; đối chiếu với ghi nhận tại lớp |
| Thứ tự bài học khác nhau giữa các bộ sách | Kho tri thức theo bộ sách; xác nhận bộ sách của lớp trước GĐ3 |
| Ràng buộc pháp lý về dữ liệu trẻ em | Tối thiểu hóa dữ liệu; chế độ demo không lưu; chỉ thu dữ liệu thật khi đủ điều kiện (GĐ10) |

### 19.3 Câu hỏi mở cần giáo viên/điều phối trả lời

1. Lớp 1A2 dùng **bộ sách Tiếng Việt 1** nào? (quyết định thứ tự âm/vần và cách gọi tên âm)
2. Quy ước của lớp: cách gọi tên âm ("bờ", "cờ", "ngờ kép", …), cách phân tích "qu", "gi"; vị trí dấu thanh ("hoà" hay "hòa").
3. Giáo viên có thể ghi âm khoảng bao nhiêu âm/vần/câu lệnh? Lớp nói giọng vùng miền nào?
4. Thiết bị phổ biến của phụ huynh (Android/iPhone), chất lượng mạng, thời gian trẻ có thể luyện mỗi ngày?
5. Ai là bên kiểm soát dữ liệu (nhà trường hay giáo viên)? Quy trình xin đồng ý của phụ huynh?
6. Máy in ở trường: đen trắng hay màu? Khổ A4?
7. Sĩ số lớp và số học sinh mỗi nhóm hiện tại?
8. Cách xưng hô trong lời đọc: "cô – con" hay "cô – em"?
9. Ai duyệt nội dung: một giáo viên hay tổ chuyên môn?
10. Ngân sách cho gói trả phí (Vercel Pro, Supabase Pro) và tên miền riêng (nếu có)?
