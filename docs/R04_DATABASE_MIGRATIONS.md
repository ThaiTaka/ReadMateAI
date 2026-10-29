# ReadMate AI — Migration R04 (điểm thưởng, câu phát hành, bản đồ)

> **Trạng thái:** ✅ áp dụng và kiểm thử trên **Supabase LOCAL** (2026-10-20) và trong CI (job `database`). **Chưa** áp dụng lên dự án Cloud nào (chưa tạo).
> **Tệp:** `supabase/migrations/20261021090000_r04_scoring.sql` (bảng, ràng buộc, trigger, RLS, GRANT) · `supabase/migrations/20261021090100_r04_functions.sql` (hàm ghi).
> **Liên quan:** [RLS_SECURITY.md](RLS_SECURITY.md) · [DATA_MODEL.md](DATA_MODEL.md) · [REDESIGN_ARCHITECTURE §5](REDESIGN_ARCHITECTURE.md#5-mô-hình-dữ-liệu-dự-kiến) · [SCORING_ENGINE.md](SCORING_ENGINE.md)

## 1. Bảng mới (11) — tổng cộng 27 bảng `public`

| Bảng | Chức năng | RLS (chỉ SELECT) | Ghi bằng |
|---|---|---|---|
| `exercises` | Bài tập — định danh ổn định `key`, dạng bài, `origin` (`library`/`teacher`/`rule_generator`/`ai`/`test_fixture`), nhóm phù hợp | GV đang hoạt động | Quản trị/script (R10: giao diện duyệt) |
| `exercise_versions` | Phiên bản nội dung; `series_id` + `lesson_ordinal` = phạm vi "đã học"; `content_hash`; vòng đời `draft → in_review → approved/changes_requested/rejected`, `approved → retired`; một phiên bản `approved`/bài | GV | như trên |
| `exercise_items` | Câu: `content` (hiển thị, không có khóa `answer`) / `answer` (chỉ máy chủ, GV) / mục tiêu / đơn vị cần / `content_fingerprint` | GV — **học sinh không có policy** | như trên (chỉ khi phiên bản `draft`) |
| `content_reviews` | Nhật ký duyệt (chỉ ghi thêm); `approve` phải khớp `content_hash` của phiên bản `in_review`; người duyệt là GV đang hoạt động | GV | như trên |
| `practice_sessions` | Buổi luyện có điểm: học sinh, lớp, mùa, thiết bị, kế hoạch cố định, trạng thái; **một buổi `in_progress`/học sinh** | GV lớp; thiết bị: của mình | `gateway_start_practice_session` |
| `question_instances` | Câu phát hành: ngữ cảnh, vị trí, câu + phiên bản, vân tay, `view` (không đáp án), mức hỗ trợ, lượt, `scorable` + lý do, `rewarded`, trạng thái | GV lớp — **học sinh không có policy** | hàm gateway |
| `item_attempts` | Lượt trả lời (dữ liệu học tập, không reset theo mùa): `client_attempt_id` duy nhất, `request_hash`, `response_key`, kết quả do máy chủ chấm; chỉ ghi thêm | GV lớp; thiết bị: của mình | `gateway_record_attempt` |
| `season_scores` | Điểm mùa: `balance = earned_total − deducted_total`, tất cả ≥ 0 | GV lớp; thiết bị: của mình | `gateway_record_attempt` |
| `point_events` | Sổ cái chỉ ghi thêm; ràng buộc công thức + khóa ý định | GV lớp; thiết bị: của mình | `gateway_record_attempt` |
| `map_tile_reveals` | Thẻ bản đồ đã mở trong mùa (PK mùa+học sinh+thẻ, `ordinal` duy nhất); chỉ ghi thêm | GV lớp; thiết bị: của mình | `gateway_reveal_map_tile` |
| `game_unlocks` | Lần đầu đạt ngưỡng game trong mùa (không cấp quyền vào chơi); chỉ ghi thêm | GV lớp; thiết bị: của mình | `gateway_record_attempt` |

Mọi bảng dữ liệu học sinh có `class_id` phi chuẩn hóa, khóa ngoại kép `(student_id, class_id) → students` và `(season_id, class_id) → seasons` (thêm ràng buộc `seasons_id_class_id_key`) — mùa luôn thuộc đúng lớp.

## 2. Bảng riêng tư mới (schema `private`, không lộ qua API)

| Bảng | Nội dung |
|---|---|
| `private.scoring_rules` | Hằng số theo phiên bản quy tắc (`r1`: +10/−5/0/30, ngưỡng 50/120/200/300) — **bất biến** (trigger); kiểm thử đối chiếu `rules.ts` |
| `private.test_environment` | Một dòng `fixtures_allowed` (mặc định **false**). Chỉ `scripts/lib/test-fixtures.ts` bật bằng `supabase db query --local` |

## 3. Thay đổi trên bảng R03

- `curriculum_series.series_kind` thêm giá trị `test_fixture` (trigger `curriculum_series_guard`: chỉ khi môi trường kiểm thử cho phép).
- `private.guard_class` (thay thế): xác nhận tiến độ chấp nhận bộ sách thật đã duyệt **hoặc** chuỗi kiểm thử đã duyệt khi môi trường kiểm thử cho phép; chuỗi minh họa vẫn không bao giờ xác nhận được.
- `public.teacher_withdraw_consent` (thay thế, giữ quyền R03): rút `learning_data` còn hủy (`void`) buổi luyện và câu đang mở — không trừ điểm.

## 4. Hàm

| Hàm | Ai gọi | Việc |
|---|---|---|
| `gateway_practice_candidates(auth_user, student)` | `service_role` | Ứng viên đủ điều kiện (`private.eligible_items`) + đã tính điểm trong mùa chưa |
| `gateway_start_practice_session(auth_user, student, items, planner_version)` | `service_role` | Mở lại buổi dở hoặc tạo buổi + câu phát hành (kiểm tra lại từng câu; CSDL quyết định `scorable`) |
| `gateway_record_attempt(...)` → `private.record_graded_attempt` | `service_role` | Ghi lượt + điểm + mở khóa game trong một giao dịch ([SCORING_ENGINE §6](SCORING_ENGINE.md#6-giao-dịch-ghi-điểm--privaterecord_graded_attempt)) |
| `gateway_reveal_map_tile(...)` | `service_role` | Mở thẻ bản đồ (số lượt + kề nhau) |
| `gateway_scoring_rules(version)` | `service_role` | Đọc hằng số (kiểm thử đối chiếu) |
| `private.require_linked_device`, `lock_season_score`, `attempt_result`, `eligible_items`, `exercise_version_hash`, `test_fixtures_allowed` | nội bộ | Trợ giúp |

Tất cả `security definer`, `set search_path = ''`; `revoke` từ `public, anon, authenticated`. pgTAP `01_schema_security` (theo catalog) tự áp lên mọi bảng/hàm mới.

## 5. Trigger bảo vệ

`exercises_guard` (fixture, bất biến), `exercise_versions_guard` (bắt đầu `draft`; bất biến sau khi gửi duyệt; chuyển trạng thái hợp lệ; `content_hash` = băm thật; duyệt cần dòng `content_reviews` của GV), `exercise_items_guard` (chỉ sửa khi `draft`, đúng dạng bài), `content_reviews_guard`/`_append_only`, `question_instances_guard` (chỉ từ `approved`; `view`/vân tay khớp câu gốc; phần nội dung bất biến; lượt tăng từng bước; `open → correct|exhausted|void`), `item_attempts_append_only`, `point_events_append_only`, `map_tile_reveals_append_only`, `game_unlocks_append_only`, `scoring_rules_immutable`.

## 6. Kiểm thử

| Bộ | Kết quả cuối R04 |
|---|---|
| `npm run db:lint` | 0 vấn đề |
| `npm run db:test` (pgTAP) | 3 tệp, **52/52** (36 cũ + 16 `03_scoring`: hằng số, bất biến, chỉ mục chống cày điểm, khóa ý định, chỉ ghi thêm, không policy thiết bị cho câu/nội dung, môi trường production từ chối fixture, phiên bản không tạo thẳng `approved`) |
| `npm run test:db` | 4 tệp, **106/106** (78 cũ + 28 `scoring.test.ts`) |
| CI job `database` | xanh (run 39400938083) |

## 7. Dữ liệu kiểm thử (chỉ local)

`npm run db:seed` bật môi trường kiểm thử local, cài 5 bài tập fixture hư cấu (`scripts/fixtures/scoring-items.ts`: 21 câu "Tìm chữ giống chữ mẫu" — 16 nội dung phát được, 1 bản sao trùng vân tay, 2 chưa học, 2 chưa duyệt) qua đúng quy trình gửi duyệt → GV hư cấu duyệt, chuỗi bài kiểm thử 3 bài và lớp **"Thử Điểm"** (GV hư cấu A, tiến độ đã xác nhận ở bài 2) với 3 học sinh hư cấu. Kho tri thức thật (`content/`) **không** bị đổi trạng thái; production không nhận được dữ liệu này (cờ tắt + trigger).

## 8. Triển khai lên Cloud (khi được phép)

1. `supabase db push` theo thứ tự (R03 → R04). **Không** chạy `db:seed` hay script fixture trên Cloud (script tự từ chối URL không local; `db query --local` không tới Cloud).
2. Kiểm tra `select fixtures_allowed from private.test_environment` = `false`.
3. Chạy pgTAP trên nhánh/dự án dev trước production.
