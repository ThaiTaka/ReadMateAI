# ReadMate AI — Hệ thống avatar (R05)

> **Trạng thái: ĐÃ HIỆN THỰC (R05).** Danh mục: `src/features/avatars/catalog.ts` · hình: `src/components/art/avatars.tsx` (`KidAvatar`) · giấy phép: `content/media/licenses.json` (`art.avatar.<key>`) · lưu: `students.avatar_key`. Xem [ASSET_MANIFEST.md](ASSET_MANIFEST.md), [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md), [LEADERBOARD_SPEC §7](LEADERBOARD_SPEC.md#7-avatar-và-tên-hiển-thị).

## 1. Bộ avatar (16)

R02 có 5 mẫu (`may`, `bong`, `na`, `ti`, `bin`); R05 thêm 11 mẫu cùng phong cách vẽ (đầu + vai, nền tròn gradient, mắt/má/miệng đồng nhất):

| Khóa | Mô tả | Khóa | Mô tả |
|---|---|---|---|
| `may` | tóc búi hai bên, kẹp sao | `lua` | tóc úp gọn |
| `bong` | tóc xoăn | `tre` | búi đỉnh đầu |
| `na` | tóc ngắn, băng đô tím | `xoai` | hai bím tóc tết |
| `ti` | mũ lưỡi trai xanh ngọc | `sen` | mũ len hồng |
| `bin` | kính tròn | `cam` | kính vuông, rẽ ngôi |
| `sao` | tóc dựng, tàn nhang | `dua` | mũ lưỡi trai đỏ |
| `nang` | đuôi ngựa, nơ vàng | `oi` | tóc xoăn bồng, băng đô cam |
| `bien` | hai búi bông | `gio` | tóc dài, kẹp sao hồng |

Đa dạng: 13 kiểu tóc/đồ đội (`HairStyle`), 9 tông da, 16 màu áo/nền, kính/tàn nhang/băng đô; **không** gắn giới tính hay nhóm năng lực; không mô phỏng trẻ thật; biểu cảm tích cực (cười). Khóa là chữ thường không dấu, khớp ràng buộc CSDL `^[a-z][a-z0-9-]{0,39}$`.

## 2. Giấy phép và duyệt

- Mọi avatar là **SVG tự vẽ bằng mã** trong repo (không dịch vụ tạo ảnh, không asset bên thứ ba): "Tác phẩm gốc của dự án ReadMate AI". 16 dòng `art.avatar.*` trong `licenses.json`; `npm run content:check` và unit test `media-licenses` chặn avatar thiếu dòng giấy phép.
- **Tất cả `pending_review`** (`teacherReviewed: false`, `reviewedBy: null`) — **không** tự đặt `approved` (CLAUDE.md §9.2.3). Chờ GV đánh giá mức độ phù hợp với trẻ 6–7 tuổi (RQ-M1, RQ-L3). Cùng chính sách với bộ R02; chưa có cơ chế duyệt asset trong ứng dụng (R10–R11).

## 3. Chọn và lưu avatar

- **Học sinh** (đã liên kết thẻ học) chọn ở `/learn/me` (`AvatarPicker` + Server Action `updateStudentPreferences`): `z.enum(AVATAR_OPTIONS keys)` → `gateway_update_student_preferences` bằng `student_id` suy ra từ thiết bị (không tin client) → chỉ hồ sơ **của chính em**. Không tải ảnh, không chụp ảnh, không văn bản tự do.
- **Giáo viên** chọn khi thêm/sửa học sinh (`teacher_create_student`/`teacher_update_student`).
- Hiển thị: `/learn/me`, `/learn/leaderboard` (nếu em đủ điều kiện lên bảng), khu GV (danh sách học sinh, bảng nội bộ, trình chiếu). Dữ liệu cũ có khóa lạ ⇒ `safeAvatarKey` dùng avatar mặc định.
- Bản chơi thử `/demo` cho thử đổi avatar của bạn hư cấu (chỉ trong state phiên).

## 4. Thêm avatar mới

1. Thêm khóa vào `AVATAR_KEYS` và một dòng `option(...)` ở `catalog.ts`.
2. Thêm `AvatarLook` (màu, kiểu tóc) trong `LOOKS` ở `avatars.tsx` (kiểu tóc mới ⇒ thêm vào `HairStyle` và `Hair`). `Record<AvatarKey, AvatarLook>` bắt buộc đủ mọi khóa.
3. Thêm dòng `art.avatar.<khóa>` vào `content/media/licenses.json` (`pending_review`).
4. `npm run content:check` + `npm run test:run` (bài kiểm thử: 16 khóa duy nhất, hình khác nhau, có giấy phép, chờ duyệt).

## 5. Giới hạn

- Danh mục nằm trong mã (không bảng `avatar_options`): đổi danh mục cần phát hành mã. CSDL chỉ kiểm định dạng khóa. Lý do: không thêm migration thừa; bảng danh mục sẽ có ích khi có quy trình duyệt asset trong ứng dụng.
- Đa dạng còn hạn chế (không có khăn/hijab, mắt kính khác, v.v.) — GV góp ý ở RQ-L3.
