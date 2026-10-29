# Hướng dẫn: tạo tài khoản giáo viên cho chủ dự án (máy dev, Supabase local)

> **Phạm vi:** chỉ Supabase **local** trên máy của bạn. Không Supabase Cloud, không production. Tài liệu kỹ thuật: [AUTHENTICATION §7](AUTHENTICATION.md#7-tài-khoản-giáo-viên-đầu-tiên-trên-máy-dev), [SUPABASE_SETUP](SUPABASE_SETUP.md).

## 1. Trạng thái (sự thật, 2026-10-29)

| Hạng mục | Tình trạng |
|---|---|
| Công cụ `npm run teacher:bootstrap` | **Đã làm và đã kiểm thử** (15 unit + 5 kiểm thử với Supabase thật; chạy thử bằng tài khoản tạm rồi đã xóa). |
| Tài khoản giáo viên của chủ dự án | **CHƯA ĐƯỢC TẠO.** Mật khẩu chỉ được nhập tại terminal của chính bạn nên công cụ này chưa chạy với email của bạn. Bạn chạy lệnh ở §3. |
| Supabase Cloud / production | **Không tạo, không đụng tới.** Công cụ từ chối mọi địa chỉ không phải `127.0.0.1`/`localhost`. |
| Mật khẩu | **Không có** trong mã, migration, seed, tài liệu, kiểm thử, dòng lệnh hay biến môi trường. |

> **Khuyến nghị bảo mật:** mật khẩu ban đầu từng được gửi qua cuộc trò chuyện. Hãy **đặt mật khẩu mới** ở lần chạy đầu tiên (đừng dùng lại mật khẩu đó) và đổi cả ở dịch vụ khác nếu bạn từng dùng chung.

## 2. Chuẩn bị (một lần)

1. Mở **Docker Desktop** và đợi nó chạy xong.
2. Trong PowerShell, thư mục `D:\ReadMateAI`:
   ```powershell
   npm run db:start       # Supabase local, gồm Storage cho âm thanh
   npm run db:env         # tạo .env.local trỏ vào Supabase local (nếu chưa có)
   ```
   > Máy ít RAM có thể dùng `npm run db:start:lite`, nhưng bản này **bỏ Storage**: đăng nhập và các trang vẫn chạy, còn **ghi âm, tạo và nghe tệp âm thanh thì không** (không có nơi lưu tệp).
3. (Tùy chọn, muốn dữ liệu sạch) `npm run db:reset` rồi `npm run db:seed`. **Chỉ chạy trên máy local** — các script tự từ chối CSDL khác.

## 3. Tạo tài khoản

Chạy trong **terminal tương tác của bạn** (PowerShell) — không chạy qua công cụ không có bàn phím:

```powershell
npm run teacher:bootstrap -- --email <email-của-bạn> --name "Tên hiển thị"
```

Công cụ sẽ:

1. In **dự án và địa chỉ API** đang dùng (để bạn xác nhận là local) rồi hỏi `Tiếp tục? Gõ y để đồng ý`.
2. Hỏi **mật khẩu hai lần, nhập ẩn** (không hiện khi gõ; ít nhất 10 ký tự, không quá đơn giản, không chứa phần đầu của email).
3. Tạo người dùng bằng **Admin API**, tạo hồ sơ giáo viên (`staff_profiles`) ở trường **"Trường phát triển ReadMate AI"** và quyền **chủ nhiệm (`owner`)** của **"Lớp phát triển"** (hư cấu, không phải lớp thật).
4. (Mặc định) cài **nội dung thử nghiệm hư cấu** cho lớp phát triển để bạn chơi thử luyện tập và Mê cung trên máy (`--no-test-content` để bỏ).
5. **Đăng nhập thử** bằng mật khẩu vừa đặt (chỉ trong bộ nhớ) và đọc hồ sơ/lớp qua RLS bằng phiên của chính giáo viên — nếu thấy hồ sơ và lớp là phân quyền đúng.

Tùy chọn: `--reset-password` (đặt lại mật khẩu của tài khoản **đã có**), `--test-content`/`--no-test-content`, `--yes` (bỏ câu hỏi xác nhận), `--password-stdin` (đọc mật khẩu từ dòng đầu của đầu vào chuẩn khi không có terminal tương tác), `--help`.

**Chạy lại an toàn:** không tạo tài khoản/lớp trùng và **không đổi mật khẩu** tài khoản đã có (trừ khi bạn thêm `--reset-password`). Mật khẩu không bao giờ được in ra, ghi tệp hay đưa vào Git; công cụ không có tham số hay biến môi trường nào nhận mật khẩu.

## 4. Đăng nhập và các trang giáo viên

```powershell
npm run dev            # http://localhost:3000
```

Vào `/login`, đăng nhập bằng email và mật khẩu bạn đã đặt. Tài khoản này là phiên Supabase Auth bình thường (cookie `httpOnly`, **không** dùng `service_role` trong trình duyệt, RLS vẫn áp dụng).

| Trang | Việc làm |
|---|---|
| `/teacher` | Tổng quan |
| `/teacher/classes` | Lớp, học sinh, thẻ học, đồng ý, bảng xếp hạng, vinh danh, mùa |
| `/teacher/audio` | **Ghi âm** tên chữ cái và âm của chữ, nghe lại, gửi duyệt, duyệt/yêu cầu ghi lại/thu hồi |
| `/teacher/tts-script` | **Giọng máy**: duyệt lời đọc câu lệnh/phản hồi cố định → tạo âm thanh → nghe → duyệt/thu hồi |
| `/teacher/audio-coverage` | **Độ phủ âm thanh**: chữ, âm, câu lệnh nào đã có tệp đã duyệt, còn thiếu gì ([AUDIO_COVERAGE](AUDIO_COVERAGE.md)) |
| `/teacher/tts-compare` | Nghe so sánh giọng AI (cần chạy `npm run tts:poc` trước) |

## 5. Thử âm thanh trên máy (cờ chỉ bật ở local)

Bốn cờ âm thanh **mặc định TẮT ở mọi môi trường**. Để tự thử trọn quy trình trên máy bạn:

```powershell
npm run audio:local-flags -- status      # xem trạng thái bốn cờ
npm run audio:local-flags -- on          # bật (hỏi xác nhận; --yes để bỏ qua) — CHỈ Supabase local
npm run audio:local-flags -- off         # tắt lại
```

Sau `on`/`off`, công cụ **đọc lại từ CSDL** và chỉ báo thành công khi cả bốn cờ đúng giá trị. Nếu báo "Đã cập nhật … nhưng không đọc lại được" thì lệnh đổi đã chạy xong — **đừng chạy lại**, chỉ cần `status`. Kết quả sai định dạng hoặc thiếu cờ là lỗi (mã thoát 4/5/6), không bao giờ bị hiểu thành "TẮT". Công cụ gọi `supabase db query --local --agent no --output-format json` cố định nên đầu ra không phụ thuộc việc chạy trong terminal thường hay trong môi trường agent.

Công cụ chỉ nói chuyện với CSDL Docker trên máy bạn, từ chối khi địa chỉ không phải local và chỉ đổi đúng bốn cờ cố định (`teacher_audio_recording_approved`, `student_teacher_audio_playback_approved`, `tts_library_approved`, `student_tts_playback_approved`). `npm run db:reset` đưa cả bốn về **TẮT**. Production vẫn **TẮT**: đổi bằng migration, sau khi đạt điều kiện ở [TTS_APPROVAL_CHECKLIST §4](TTS_APPROVAL_CHECKLIST.md#4-điều-kiện-mở-cho-học-sinh-thật).

Quy trình đầy đủ:

1. `/teacher/audio`: ghi âm (hoặc tải tệp) tên chữ cái và âm → nghe lại → **xác nhận cách đọc** → gửi duyệt → duyệt (đã nghe).
2. `/teacher/tts-script`: **duyệt lời đọc** → **Tạo âm thanh** → nghe → duyệt. Nút Tạo âm thanh chỉ mở khi máy chủ có `TTS_PROVIDER=viettel` và `TTS_VIETTEL_TOKEN` (đặt trong `.env.local`, không commit). **Mỗi lần bấm là một yêu cầu thật tới Viettel AI** — chỉ gửi đúng chữ của lời đọc, không dữ liệu học sinh; hạn mức dùng thử của nhà cung cấp có thể hết.
3. `/teacher/audio-coverage`: xem còn thiếu gì.
4. Cấp **thẻ học** cho một học sinh thử (`/teacher/classes` → học sinh), mở `/join` trên thiết bị khác (hoặc cửa sổ ẩn danh) để học: chạm chữ ở **Học tập** (`/learn/me/study`) để nghe, mở **buổi luyện** để nghe câu lệnh. Học sinh chỉ nghe được tệp **đã duyệt** và khi các cờ tương ứng bật.

## 6. Đổi hoặc đặt lại mật khẩu sau này

```powershell
npm run teacher:bootstrap -- --email <email-của-bạn> --reset-password
```

## 7. Sự cố thường gặp

| Hiện tượng | Cách xử lý |
|---|---|
| `Chưa kết nối được Supabase local` | Mở Docker Desktop, chạy `npm run db:start`, rồi `npm run db:env`. |
| "Từ chối: địa chỉ không phải local" | Đúng thiết kế — công cụ không bao giờ chạy với Cloud/production. Kiểm tra `.env.local` trỏ vào `127.0.0.1`. |
| "Cần terminal tương tác hoặc --password-stdin" | Chạy trong PowerShell của bạn (không phải qua công cụ không có bàn phím). |
| Đăng nhập báo sai mật khẩu | Dùng `--reset-password`. Mỗi email chỉ có một tài khoản; chạy lại không tạo thêm. |
| Bộ đếm "thử lại quá nhiều" ở `/login` | Chỉ trên máy local: chờ khoảng 15 phút hoặc `npm run db:reset`. |

## 8. Điều công cụ này **không** làm

Không tạo Supabase Cloud/tài khoản production; không dùng `service_role` cho phiên trình duyệt; không bỏ qua RLS; không tạo học sinh thật; không bật điểm/xếp hạng/vinh danh cho học sinh thật; không gửi gì tới dịch vụ bên ngoài.
