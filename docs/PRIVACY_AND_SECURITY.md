# ReadMate AI — Quyền riêng tư và bảo mật (bản tái thiết kế)

> **Trạng thái: PLANNED** — thiết kế của Giai đoạn R01 (2026-10-16). Các bảo vệ đã hiện thực ở GĐ2–GĐ4 (header bảo mật, `Permissions-Policy`, `/demo` không lưu, test vệ sinh repo, `content:check` chặn dữ liệu cá nhân) **giữ nguyên**. Phần mới (điểm, bảng xếp hạng, vinh danh, game) **chưa hiện thực**.
> Không phải tư vấn pháp lý — mọi nhận định pháp lý cần nhà trường/chuyên gia xác nhận trước khi thu dữ liệu thật.
> **Tài liệu liên quan:** [CLAUDE.md §6](../CLAUDE.md#6-bắt-buộc--bảo-vệ-trẻ-em-và-dữ-liệu) · [PRD §17](PRD.md#17-quyền-riêng-tư-và-an-toàn-trẻ-em) · [DATA_MODEL §10](DATA_MODEL.md#10-bảo-vệ-dữ-liệu-lưu-giữ-và-xóa) · [REDESIGN_ARCHITECTURE §8](REDESIGN_ARCHITECTURE.md#8-phân-quyền-và-rls) · [LEADERBOARD_SPEC.md](LEADERBOARD_SPEC.md)

> ✅ **R03 (2026-10-20) đã hiện thực trên Supabase local:** đồng ý hai phạm vi (`guardian_consents.scope`, ghi nhận cần GV xác nhận đã nhận phiếu hợp lệ, bất biến, rút `learning_data` → thu hồi ngay mọi thiết bị và thẻ học); cờ `leaderboard_enabled`/`honors_enabled` mặc định tắt và **bị CSDL chặn bật** khi cờ hệ thống chưa được chấp thuận; thẻ học HMAC + pepper, giới hạn tần suất `/join` và đăng nhập (khóa HMAC, không lưu IP thô); cookie phiên httpOnly; không client Supabase ở trình duyệt; nhật ký kiểm toán chỉ ghi thêm, không chứa biệt danh/mã. **Chưa**: Turnstile, cron lưu giữ/xóa, quy trình xóa dữ liệu học sinh, thông báo xử lý dữ liệu đã duyệt (mẫu hiện tại là bản nháp `nhap-2026-10`, chỉ dùng với dữ liệu giả). Chi tiết: [AUTHENTICATION.md](AUTHENTICATION.md), [STUDENT_ACCESS.md](STUDENT_ACCESS.md), [RLS_SECURITY.md](RLS_SECURITY.md).

## Mục lục

1. [Nguyên tắc giữ nguyên](#1-nguyên-tắc-giữ-nguyên)
2. [Điều gì thay đổi về rủi ro](#2-điều-gì-thay-đổi-về-rủi-ro)
3. [Kiểm kê dữ liệu](#3-kiểm-kê-dữ-liệu)
4. [Đồng ý theo phạm vi](#4-đồng-ý-theo-phạm-vi)
5. [Bảng xếp hạng: điều kiện bật và kiểm soát hiển thị](#5-bảng-xếp-hạng-điều-kiện-bật-và-kiểm-soát-hiển-thị)
6. [Mô hình mối đe dọa](#6-mô-hình-mối-đe-dọa)
7. [Kiểm soát kỹ thuật](#7-kiểm-soát-kỹ-thuật)
8. [Lưu giữ và xóa dữ liệu mới](#8-lưu-giữ-và-xóa-dữ-liệu-mới)
9. [An toàn cảm xúc và sức khỏe số của trẻ](#9-an-toàn-cảm-xúc-và-sức-khỏe-số-của-trẻ)
10. [Repo công khai, dữ liệu demo và quy trình đẩy mã](#10-repo-công-khai-dữ-liệu-demo-và-quy-trình-đẩy-mã)
11. [Lưu ý pháp lý](#11-lưu-ý-pháp-lý)
12. [Danh mục kiểm tra trước khi bật cho học sinh thật](#12-danh-mục-kiểm-tra-trước-khi-bật-cho-học-sinh-thật)

---

## 1. Nguyên tắc giữ nguyên

Mọi quy tắc BẮT BUỘC ở CLAUDE.md §6 tiếp tục áp dụng. Tóm tắt:

- Chỉ biệt danh, số thứ tự, avatar có sẵn; không họ tên đầy đủ, ngày sinh, giới tính, ảnh thật, địa chỉ, số điện thoại, thông tin phụ huynh, giọng nói, vị trí.
- RLS cho mọi bảng; học sinh không ghi trực tiếp; server suy ra `student_id` từ phiên.
- Chỉ ghi dữ liệu học tập khi có đồng ý; không ghi âm trẻ; `Permissions-Policy` tắt microphone/camera/định vị ở khu vực học sinh.
- Không analytics, quảng cáo, script bên thứ ba, liên kết ra ngoài, ô nhập tự do ở khu vực học sinh.
- Secret chỉ ở server; log chỉ UUID/mã lỗi; dev/Preview chỉ dữ liệu giả.
- Học sinh **không bao giờ** thấy nhóm năng lực, lộ trình, mức hỗ trợ hay dữ liệu học tập chi tiết của bạn khác.

**Hai ngoại lệ có chủ đích** (người điều phối quyết định 2026-10-16, ghi vào CLAUDE.md §6.4 và §7.10):

1. Bảng xếp hạng điểm thưởng **trong lớp**, có điều kiện ([§5](#5-bảng-xếp-hạng-điều-kiện-bật-và-kiểm-soát-hiển-thị)).
2. Quy tắc −5 điểm khi sai, chỉ là thay đổi con số, trình bày trung tính ([GAMIFICATION_SPEC §10](GAMIFICATION_SPEC.md#10-trình-bày-điểm-cho-trẻ)).

## 2. Điều gì thay đổi về rủi ro

| Thay đổi | Rủi ro mới | Mức |
|---|---|---|
| Bảng xếp hạng lớp | Lộ thông tin trẻ cho bạn cùng lớp và phụ huynh của bạn; so sánh, trêu chọc, áp lực; nếu lỗi phân quyền → lộ ra ngoài lớp | Cao |
| Vinh danh trên máy chiếu | Tên/avatar hiện trước lớp; trẻ không được vinh danh có thể buồn | Trung bình |
| Điểm thưởng có giá trị với trẻ | Động cơ gian lận (phụ huynh làm hộ, đoán mò, tải lại trang, sửa request) | Trung bình |
| Chấm ở server, đáp án ở server | Lộ đáp án qua API nếu sai sót | Trung bình |
| Game hấp dẫn hơn | Thời gian dùng màn hình tăng | Trung bình |
| Asset hình/âm thanh mới | Vi phạm bản quyền trên repo công khai | Trung bình |

## 3. Kiểm kê dữ liệu

| Dữ liệu | Bảng (dự kiến) | Cá nhân? | Ai thấy | Mục đích |
|---|---|---|---|---|
| Biệt danh ở lớp | `students.display_name` | Có | GV lớp; HS (của mình) | Nhận ra hồ sơ |
| Tên hiển thị trên bảng | `students.leaderboard_alias` | Có | GV lớp; HS cùng lớp (nếu có đồng ý hiển thị) | Bảng xếp hạng, vinh danh |
| Avatar | `students.avatar_key` | Thấp (chọn từ bộ có sẵn) | Như trên | Nhận diện vui |
| Điểm hiện tại | `season_scores.balance` | Có (dữ liệu về trẻ) | GV lớp; HS (của mình); HS cùng lớp qua bảng (nếu có đồng ý) | Xếp hạng, vào game |
| Điểm tích lũy, đã trừ, sổ cái | `season_scores`, `point_events` | Có | GV lớp; HS (của mình, trừ "đã trừ") | Mở thẻ bản đồ, đối soát |
| Lượt trả lời | `item_attempts` | Có | GV lớp; HS (của mình) | Học tập, phân hóa |
| Tiến độ game, thẻ bản đồ | `game_*`, `map_tile_reveals` | Có | GV lớp; HS (của mình) | Lưu/tiếp tục |
| Ảnh chụp vinh danh | `honor_snapshots` | Có (alias + điểm) | GV lớp; HS cùng lớp (nếu bật) | Xem lại vinh danh |
| Đồng ý theo phạm vi | `guardian_consents` | Có | GV lớp | Điều kiện xử lý |
| Cài đặt (giảm chuyển động, âm lượng) | `students.preferences` | Thấp | HS (của mình), GV | Trợ năng |

**Không thu thêm** bất kỳ loại dữ liệu nào ngoài danh sách trên. Không dấu vân tay thiết bị, không IP thô, không user-agent đầy đủ (thiết kế GĐ1 giữ nguyên).

## 4. Đồng ý theo phạm vi

| Phạm vi (`guardian_consents.scope`) | Cho phép | Khi chưa có |
|---|---|---|
| `learning_data` | Lưu kết quả học tập, điểm thưởng, tiến độ game | Chỉ chơi thử, không lưu gì |
| `leaderboard_display` | Hiển thị alias + avatar + điểm cho bạn cùng lớp (bảng xếp hạng, vinh danh) | Không xuất hiện trên bảng/vinh danh; vẫn tích điểm và thấy điểm của mình |

- Hai phạm vi tách riêng: phụ huynh có thể đồng ý cho học nhưng không đồng ý hiển thị.
- Ghi nhận: trạng thái, ngày, phiên bản thông báo, phương thức (phiếu giấy), GV ghi (thiết kế GĐ1). Phiếu giấy do nhà trường lưu.
- Rút `leaderboard_display` → ẩn ngay khỏi bảng; ảnh chụp vinh danh cũ có tên trẻ bị **ẩn tên** (thay bằng "Một bạn") trong lần hiển thị kế tiếp và xóa theo [§8](#8-lưu-giữ-và-xóa-dữ-liệu-mới).
- Rút `learning_data` → quy trình rút đồng ý của DATA_MODEL §10 (dừng ghi, thu hồi thiết bị, xóa dữ liệu) áp dụng cả cho điểm, sổ cái, tiến độ game.
- Luật 91/2025 Điều 24: với trẻ từ đủ 7 tuổi, xử lý nhằm công bố thông tin của trẻ cần đồng ý của **cả trẻ và người đại diện** → khi bật hiển thị cho trẻ ≥ 7 tuổi, quy trình cần ghi nhận cả sự đồng ý của trẻ (cách làm phù hợp lứa tuổi do nhà trường quyết định — RQ-P2).

## 5. Bảng xếp hạng: điều kiện bật và kiểm soát hiển thị

Lớp chỉ bật được `leaderboard_enabled` / `honors_enabled` khi **tất cả** điều kiện sau đúng (server kiểm tra khi GV bật):

1. Đã có rà soát pháp lý/chấp thuận bằng văn bản của nhà trường cho tính năng (cờ cấu hình cấp hệ thống `LEADERBOARD_FEATURE_APPROVED`, mặc định tắt — R11).
2. Thông báo xử lý dữ liệu gửi phụ huynh đã nêu rõ bảng xếp hạng (phiên bản thông báo ghi trong `guardian_consents`).
3. GV đã duyệt alias của các học sinh sẽ hiển thị.

Khi bật, mỗi học sinh chỉ hiển thị khi có `learning_data` + `leaderboard_display` + alias đã duyệt ([LEADERBOARD_SPEC §2](LEADERBOARD_SPEC.md#2-dữ-liệu-một-hàng)).

Kiểm soát hiển thị:

- Chỉ người trong lớp (thiết bị đã liên kết, GV của lớp) — không URL công khai, `noindex`, `Cache-Control: private, no-store`.
- DTO không chứa `student_id`, `class_id`; khóa hàng ngẫu nhiên theo mùa.
- Không hiển thị nhóm năng lực, mức hỗ trợ, tỉ lệ đúng, số lần sai.
- Ngôn ngữ không gây xấu hổ; mặc định học sinh xem TOP 10 + hàng của mình ([LEADERBOARD_SPEC §5](LEADERBOARD_SPEC.md#5-ngôn-ngữ-và-trình-bày-không-gây-xấu-hổ)).
- GV tắt được bảng bất cứ lúc nào (có hiệu lực ở request kế tiếp).

## 6. Mô hình mối đe dọa

| # | Mối đe dọa | Biện pháp | Kiểm chứng |
|---|---|---|---|
| 1 | Sửa request để tự cộng điểm | Server chấm; client chỉ gửi câu trả lời; lược đồ `strictObject` từ chối trường lạ | Test tích hợp gửi `is_correct/points/balance` |
| 2 | Gửi lại / song song để nhân điểm | Khóa ý định + unique + khóa dòng ([GAMIFICATION_SPEC §5](GAMIFICATION_SPEC.md#5-chống-cộng-điểm-trùng-và-chống-cày-điểm)) | Test song song |
| 3 | Xem đáp án trong mạng/DevTools trước khi nộp | Chỉ `view` trước khi đóng câu (AD-41) | Test payload |
| 4 | Giả `student_id`/`class_id` để đọc/ghi dữ liệu bạn khác | Suy ra từ phiên; RLS; tham số chỉ là khóa tra cứu được kiểm tra sở hữu | Test RLS + gateway |
| 5 | GV lớp khác reset/vinh danh | Kiểm tra `class_staff` ở Server Action **và** trong hàm CSDL | Test RLS |
| 6 | Tài khoản GV bị chiếm → reset phá hoại | Reset không xóa dữ liệu (mùa cũ lưu nguyên); xác nhận hai bước; `audit_logs`; MFA khuyến nghị (sau MVP) | Test reset không chạm dữ liệu học tập |
| 7 | Dò mã thẻ học | HMAC + pepper, giới hạn tần suất, Turnstile ở `/join` (thiết kế GĐ1) | R03 |
| 8 | Bỏ qua chạm trán để mở kho báu | Server kiểm tra 7/7 cuộc chạm trán đã kết thúc | Test |
| 9 | Đổi câu khó bằng tải lại | Câu phát hành cố định theo ngữ cảnh | Test |
| 10 | Lộ dữ liệu qua log/giám sát | Log chỉ UUID/mã lỗi; không gửi dữ liệu HS cho dịch vụ bên thứ ba | Rà soát mã |
| 11 | Preview dùng dữ liệu thật | Preview nối CSDL dev, dữ liệu giả; Deployment Protection | R11 |
| 12 | Bắt nạt/so sánh do bảng xếp hạng | Cờ tắt mặc định, ngôn ngữ trung tính, TOP 10 + mình, GV tắt được, không thông báo "bị vượt" | Duyệt giao diện với GV |
| 13 | Nội dung chưa duyệt vào game | Chế độ `production` chỉ `approved` (AD-38); trigger chỉ gắn phiên bản đã duyệt | Test |
| 14 | XSS qua alias | React tự thoát; alias kiểm tra ký tự; không `dangerouslySetInnerHTML` | Test |

## 7. Kiểm soát kỹ thuật

- **Header:** giữ CSP không nonce (AD-20 — xem lại khi có dữ liệu thật, R-16), `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()`; route game không cần quyền nào thêm. Ngoại lệ microphone duy nhất vẫn là `/teacher/audio`.
- **Secret:** `SUPABASE_SECRET_KEY`, `LOGIN_CODE_PEPPER`, `CRON_SECRET` chỉ ở server; module dùng secret có `import 'server-only'`; không tiền tố `NEXT_PUBLIC_`. Không thêm secret mới cho gamification.
- **RLS:** ma trận [REDESIGN_ARCHITECTURE §8](REDESIGN_ARCHITECTURE.md#8-phân-quyền-và-rls); bảng sổ cái và ảnh chụp không sửa/xóa được.
- **Giới hạn tần suất:** mọi `POST/PATCH` của học sinh; `/join`; Server Action reset/vinh danh (chống bấm dồn).
- **Lưu trữ phía trình duyệt:** khu vực học sinh không dùng `localStorage`/`sessionStorage` cho dữ liệu học tập hay điểm (giữ kiểm thử E2E của GĐ4); cài đặt trợ năng lưu ở server.
- **Kiểm thử bắt buộc:** RLS, gateway, payload không đáp án, vệ sinh repo, quét bundle không chứa khóa secret.

## 8. Lưu giữ và xóa dữ liệu mới

Đề xuất (cần nhà trường xác nhận; áp dụng bằng cron như DATA_MODEL §10):

| Dữ liệu | Thời hạn đề xuất | Xử lý |
|---|---|---|
| `point_events`, `season_scores`, `map_tile_reveals`, `game_unlocks`, `game_runs`, `game_encounters`, `question_instances` | Hết năm học + 6 tháng (như `item_attempts`) | Xóa |
| `honor_snapshots` | Hết năm học + 6 tháng; ẩn tên ngay khi rút `leaderboard_display` | Xóa |
| `season_resets` | 12 tháng (như `audit_logs`) | Xóa |
| Mùa đã đóng | Giữ trong năm học để GV xem lại | Xóa cùng dữ liệu trên |

Reset mùa **không phải** là xóa dữ liệu: dữ liệu mùa cũ vẫn tồn tại theo thời hạn trên.

## 9. An toàn cảm xúc và sức khỏe số của trẻ

- Không đồng hồ đếm ngược, không "game over", không mất lượt chơi, không quái vật đáng sợ, không âm thanh giật mình, không hiệu ứng nhấp nháy > 3 lần/giây.
- Không mua bán, không quảng cáo, không phần thưởng may rủi, không chuỗi ngày gây áp lực, không thông báo đẩy.
- Gợi ý nghỉ sau khoảng 15 phút; GV có thể bật giới hạn câu tính điểm mỗi ngày.
- Trừ điểm trình bày trung tính; điểm 0 không bị gọi là thua.
- Góc phụ huynh (R10) giải thích điểm thưởng là trò chơi khích lệ, **không** phải điểm đánh giá học tập; khuyến khích không làm hộ con.

## 10. Repo công khai, dữ liệu demo và quy trình đẩy mã

- Repo `ThaiTaka/ReadMateAI` đang **PUBLIC**: không commit `.env*` thật, khóa, token, dữ liệu học sinh, bản xuất CSDL, bản ghi âm chưa được phép, asset không rõ giấy phép.
- `/demo` và mọi dữ liệu minh họa (bảng xếp hạng mẫu, tiến độ game mẫu) dùng **tên hư cấu**, nằm ở `src/features/demo/`, có cờ `DEMO_DATA_IS_FICTIONAL`; không lưu, không gửi dữ liệu.
- Trước mỗi lần push: quét secret (mẫu khóa Anthropic/OpenAI/Supabase/GitHub/AWS/Google, JWT, khóa riêng, gán `PASSWORD|SECRET|TOKEN|API_KEY|PEPPER=`), email, số điện thoại; kiểm tra `.gitignore`; quét byte NFC/ký tự ẩn bằng Node (CLAUDE.md §9.3.8); chạy test vệ sinh repo.
- Commit dùng email `noreply` của GitHub ở cấu hình **cục bộ** của repo (Q-13).

## 11. Lưu ý pháp lý

- **Luật Bảo vệ dữ liệu cá nhân số 91/2025/QH15** (hiệu lực 01/01/2026): Điều 24 về dữ liệu cá nhân của trẻ em; xử lý nhằm công bố/tiết lộ thông tin của trẻ từ đủ 7 tuổi cần đồng ý của trẻ và người đại diện (theo ghi chép ở PRD §17 — cần chuyên gia xác nhận cách áp dụng cho bảng xếp hạng nội bộ lớp).
- Điều 20: xử lý dữ liệu thu thập tại Việt Nam trên nền tảng ở nước ngoài (Supabase, Vercel — Singapore) được coi là chuyển dữ liệu xuyên biên giới → cần hồ sơ đánh giá tác động theo văn bản hướng dẫn trước khi thu dữ liệu thật (R-01).
- Bên kiểm soát dữ liệu (nhà trường hay GV) vẫn chưa xác định (Q-05).

## 12. Danh mục kiểm tra trước khi bật cho học sinh thật

- [ ] Nhà trường xác nhận bằng văn bản: bên kiểm soát dữ liệu, thông báo xử lý dữ liệu (có nêu điểm thưởng và bảng xếp hạng), phiếu đồng ý hai phạm vi, thời hạn lưu giữ.
- [ ] Rà soát pháp lý Luật 91/2025 (Điều 20, 24) cho Supabase/Vercel Singapore và cho bảng xếp hạng.
- [ ] Kiểm thử RLS + gateway + payload không đáp án đều xanh trên CSDL sạch.
- [ ] GV duyệt: bộ avatar, quái vật, câu chữ bảng xếp hạng/vinh danh, alias của từng học sinh.
- [ ] Nội dung đã duyệt đủ cho buổi luyện và ít nhất một màn Mê cung (21 câu khác nhau theo từng nhóm).
- [ ] Âm thanh câu lệnh tối thiểu cho Nhóm 3 (R10) — học sinh chưa đọc được câu lệnh không tự chơi được.
- [ ] Không còn phát hiện bảo mật mức cao chưa xử lý.

| Mã | Câu hỏi mở |
|---|---|
| RQ-P1 | Nhà trường có chấp thuận bảng xếp hạng nội bộ lớp và vinh danh trên máy chiếu không? |
| RQ-P2 | Ghi nhận đồng ý của trẻ ≥ 7 tuổi (Điều 24) bằng cách nào phù hợp lứa tuổi? |
| RQ-P3 | Thời hạn lưu giữ dữ liệu điểm và ảnh chụp vinh danh? |
