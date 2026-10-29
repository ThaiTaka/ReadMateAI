# ReadMate AI — Scoring Engine (điểm thưởng)

> **Trạng thái:** ✅ hiện thực ở **R04 (2026-10-20)**, kiểm thử trên **Supabase LOCAL**. Chưa có dự án Supabase Cloud.
> **Nguồn quy tắc:** [GAMIFICATION_SPEC.md](GAMIFICATION_SPEC.md) (hằng số §1, công thức §3). Tài liệu này mô tả **cách hiện thực**, không định nghĩa lại con số.
> **Liên quan:** [QUESTION_INSTANCE_SERVICE.md](QUESTION_INSTANCE_SERVICE.md) · [MAP_UNLOCK_ENGINE.md](MAP_UNLOCK_ENGINE.md) · [R04_DATABASE_MIGRATIONS.md](R04_DATABASE_MIGRATIONS.md) · [REDESIGN_ARCHITECTURE.md](REDESIGN_ARCHITECTURE.md)

## 1. Tổng quan

| Lớp | Tệp | Vai trò |
|---|---|---|
| Hằng số (nguồn duy nhất trong mã) | `src/features/gamification/rules.ts` | `POINTS_CORRECT` +10, `POINTS_INCORRECT` −5, `BALANCE_FLOOR` 0, `MAP_TILE_STEP` 30, `GAME_MIN_BALANCE` 50/120/200/300, `SCORING_RULES_VERSION` `r1` |
| Kiểu | `src/features/gamification/score-types.ts` | `SeasonScore` (`balance`, `earnedTotal`, `deductedTotal`), `LedgerEntry`, `AnswerOutcome` |
| Công thức (hàm thuần) | `src/features/gamification/apply.ts` | `applyPointEvent`, `replayOutcomes`, `scoreFromLedger`, `firstLedgerInconsistency` |
| Quyền tính điểm, lượt hợp lệ (thuần) | `src/features/gamification/score-validation.ts` | `scorableDecision`, `attemptGate`, `statusAfterAttempt`, `isSeasonActive` |
| Mở khóa (thuần) | `src/features/gamification/unlocks.ts`, `src/features/game-world/map.ts` | `tilesAllowed(earned, cap)`, `canEnterGame`, `gameUnlockStates`, `canRevealTile` |
| Ghi điểm có thẩm quyền | `supabase/migrations/20261021090100_r04_functions.sql` | `private.record_graded_attempt` (gọi qua `public.gateway_record_attempt`, chỉ `service_role`) |
| Bản sao hằng số trong CSDL | `private.scoring_rules` (dòng `r1`) | Hàm CSDL đọc theo `seasons.rules_version`; **kiểm thử tích hợp đối chiếu với `rules.ts`** (`tests/db/scoring.test.ts`) và pgTAP (`03_scoring`) |

Hàm thuần dùng chung cho giao diện, kiểm thử và đối soát; **điểm chỉ được ghi trong CSDL** bởi một hàm duy nhất. Trình duyệt không bao giờ tính hay gửi điểm.

## 2. Công thức

```text
nominal_delta  = +10 nếu đúng, −5 nếu sai
balance_after  = max(0, balance_before + nominal_delta)      ← sàn 0 TẠI TỪNG sự kiện
applied_delta  = balance_after − balance_before              (−5 ≤ applied ≤ +10)
earned_total  += max(nominal_delta, 0)                       ← chỉ tăng
deducted_total += max(−applied_delta, 0)
```

Bất biến CSDL (ràng buộc `check`, không chỉ trong mã):

- `season_scores`: `balance ≥ 0`, `earned_total ≥ 0`, `deducted_total ≥ 0`, **`balance = earned_total − deducted_total`**.
- `point_events`: `applied_delta = balance_after − balance_before`, `balance_after = greatest(0, balance_before + nominal_delta)`, `outcome = 'correct' ⇔ nominal_delta > 0`, `idempotency_key = question_instance_id:attempt_no`.

## 3. Ba loại điểm

| Đại lượng | Cột | Dùng cho | Hiển thị cho học sinh |
|---|---|---|---|
| Điểm hiện tại | `season_scores.balance` | Điều kiện vào mini-game, xếp hạng (R05) | Có |
| Điểm tích lũy mùa | `season_scores.earned_total` | Số thẻ bản đồ được khám phá | Có ("Điểm tích lũy mùa này") |
| Tổng điểm đã trừ | `season_scores.deducted_total` | Đối soát của GV | **Không** |

## 4. Ví dụ đã kiểm thử

| Diễn biến (từ 0) | Số dư | Tích lũy | Đã trừ | Thẻ | Kiểm thử |
|---|---|---|---|---|---|
| Đúng → đúng → đúng | 30 | 30 | 0 | 1 | unit `scoring.test.ts` |
| … → sai | 25 | 30 | 5 | 1 (giữ) | unit + tích hợp |
| … → đúng | 35 | 40 | 5 | 1 | unit |
| Sai ở 0 điểm | 0 (nominal −5, applied 0) | 0 | 0 | 0 | unit + tích hợp |
| Sai → đúng | 10 | 10 | 0 | 0 | unit |
| Từ 20: sai → sai → đúng | 20 | +10 | +10 | — | unit |
| Từ 52: sai | 47 → chưa vào Mê cung | — | — | — | unit |
| 5 câu đúng | 50 → `game_unlocks.treasure_maze` | 50 | 0 | 1 | tích hợp |
| 400 kết quả ngẫu nhiên có seed × 5 seed | `≥ 0`; tích lũy không giảm; số dư = tính lại từ sổ cái | | | | unit |

## 5. Sổ cái `point_events`

- Mỗi lượt hợp lệ của câu **tính điểm** tạo **đúng một** dòng (`unique item_attempt_id`, `unique idempotency_key`).
- **Chỉ ghi thêm:** trigger `point_events_append_only` chặn `UPDATE` và `DELETE` trực tiếp — kể cả `service_role`. Xóa chỉ xảy ra theo dây chuyền khi xóa hồ sơ học sinh/lớp (quyền xóa dữ liệu; `pg_trigger_depth() > 1`).
- Ghi `rules_version` (khóa ngoại tới `private.scoring_rules`), số dư trước/sau, tích lũy sau.
- Không ai (học sinh, GV, API thường) sửa số dư: không có policy ghi, không GRANT ghi cho `authenticated`; `service_role` sửa trực tiếp số dư lệch sổ cái bị ràng buộc `check` chặn (kiểm thử tích hợp).

## 6. Giao dịch ghi điểm — `private.record_graded_attempt`

Một giao dịch, theo thứ tự (GAMIFICATION_SPEC §4.1, §9):

1. Đọc câu phát hành; **thiết bị phải đang liên kết với đúng học sinh của câu** (`private.require_linked_device`) — học sinh suy ra từ câu, không từ request.
2. **Khóa ý định:** `client_attempt_id` đã có → trả **kết quả cũ** (`outcome: replayed`), không lượt/điểm mới; khác câu hoặc khác câu trả lời (`request_hash`) → `IDEMPOTENCY_CONFLICT`.
3. Đồng ý `learning_data` còn hiệu lực (`CONSENT_REQUIRED`).
4. Khóa **mùa** `FOR SHARE`; mùa không `active` → `SEASON_CLOSED`.
5. Khóa **câu** `FOR UPDATE`; kiểm tra lại khóa ý định (hai request cùng mã song song).
6. Câu `open` (`QUESTION_CLOSED`), còn lượt (`NO_ATTEMPTS_LEFT`), câu trả lời khác mọi lần trước (`DUPLICATE_RESPONSE` — không tốn lượt, không trừ).
7. Ghi `item_attempts` (kết quả chấm do **máy chủ** truyền vào).
8. Nếu câu tính điểm: khóa **dòng điểm** `FOR UPDATE` → tính theo §2 → cập nhật `season_scores` → ghi `point_events` → ghi `game_unlocks` cho ngưỡng **lần đầu** đạt (`on conflict do nothing`).
9. Đóng câu khi đúng (`correct`, `rewarded`) hoặc hết lượt (`exhausted`); buổi luyện `completed` khi mọi câu đã đóng.

**Thứ tự khóa cố định:** mùa (chia sẻ) → câu → điểm của học sinh. Reset mùa ở R06 sẽ khóa mùa `FOR UPDATE` → nộp bài song song chờ rồi nhận `SEASON_CLOSED` (đã mô phỏng trong kiểm thử tích hợp). Lập buổi luyện và mở thẻ bản đồ khóa mùa → dòng điểm theo cùng thứ tự.

## 7. Chống gian lận và tích điểm vô hạn

| Mối nguy | Biện pháp | Kiểm thử thật |
|---|---|---|
| Gửi `points`, `is_correct`, `balance`, `student_id`, `class_id` | Lược đồ zod `strictObject` → 400 `INVALID_INPUT`; máy chủ tự chấm | unit (lược đồ) + E2E có CSDL (5 trường + `response.correct`) |
| Double click / mạng chập chờn | `client_attempt_id` (UUID, giữ nguyên khi "Gửi lại") | tích hợp: 5 tuần tự + 5 song song → 1 lượt, 1 sự kiện; E2E: replay |
| Hai tab gửi hai câu trả lời khác nhau khi còn 1 lượt | Khóa dòng câu + `unique (question_instance_id, attempt_no)` | tích hợp: đúng một lượt được ghi |
| Nhiều câu đúng song song | Khóa dòng điểm | tích hợp: 6 song song → 60 điểm, chuỗi số dư 10…60 |
| Làm lại cùng câu lấy điểm | Mỗi **vân tay nội dung** tính điểm 1 lần/mùa/học sinh (chỉ mục duy nhất từng phần) | tích hợp: bản sao khác mã → "luyện thêm", 0 điểm |
| Tải lại để đổi câu | Buổi luyện lưu ở CSDL; một buổi `in_progress`/học sinh | tích hợp + E2E (tải lại giữa câu) |
| Câu của học sinh khác / thiết bị thu hồi | Liên kết thiết bị kiểm tra trong hàm; API trả `NOT_FOUND`/401 | tích hợp + E2E |
| Request khác nguồn (CSRF) | Origin/Sec-Fetch-Site phải cùng nguồn | unit + E2E (403) |
| Đoán hàng loạt | 30 lượt/phút/thiết bị; số lượt mỗi câu có hạn; sai −5 | — (giới hạn chung `rate_limit_buckets`) |
| Nộp vào mùa đã đóng | `SEASON_CLOSED` | tích hợp (mô phỏng reset) |

Tổng điểm tối đa một mùa bị chặn trên bởi số **nội dung đã duyệt khác nhau** (×10).

## 8. Câu không tính điểm

`question_instances.scorable = false` với lý do `ALREADY_SCORED_IN_SEASON` (CSDL quyết định theo vân tay) hoặc `PRACTICE_ONLY` (máy chủ đề nghị — bộ lập buổi luyện thêm câu đã tính điểm khi thiếu câu mới). Vẫn chấm, phản hồi, gợi ý, lưu `item_attempts`; **không** `point_events`. Giao diện: nhãn **"Câu luyện thêm – Không tính điểm"**.

## 9. Trình bày điểm cho trẻ (CLAUDE.md §7.10)

- Đúng: thẻ "+10" xanh, ngôi sao, hoạt cảnh `pop-in` nhẹ (tắt khi giảm chuyển động — E2E kiểm `animation-name: none`).
- Sai: "−5" nhỏ, nền xám trung tính (E2E kiểm không nền đỏ), lời nhắc tích cực của GĐ4; sai ở 0 điểm → "Điểm giữ nguyên".
- Không âm thanh phạt, không đếm giờ, không hiển thị tổng điểm bị trừ. Điểm chỉ đổi khi máy chủ trả kết quả ("Cô đang xem…" khi chờ) — **không** cập nhật lạc quan.

## 10. Hiệu năng (đo thật, 2026-10-20)

| Hạng mục | Kết quả |
|---|---|
| Công cụ | `tests/e2e-db/perf.spec.ts` (`PERF=1`, Playwright `APIRequestContext`, đo khứ hồi từng request) |
| Môi trường | Windows 11, Node 24.18, bản build production `next start` (cổng 3200), Supabase local trong Docker 29.5.3, cùng một máy (không có độ trễ mạng), một client tuần tự |
| Mẫu | **216** request `POST …/attempts` (9 học sinh × 8 câu × 3 lượt: sai, sai, đúng — gồm câu tính điểm và trừ điểm) |
| Kết quả | min 57 ms · **median 90 ms** · **p95 104 ms** · p99 107 ms · max 108 ms; lập buổi luyện median 106 ms (9 mẫu) |
| Đánh giá | Đạt mục tiêu tham khảo p95 ≤ 400 ms **trên máy local**. Chưa phản ánh 4G hay Vercel `sin1` ↔ Supabase Singapore (chưa có Cloud) — cần đo lại ở R11 |
| Hướng tối ưu nếu cần | Gộp các truy vấn đọc lại sau khi ghi (câu, lượt, số thẻ) vào kết quả của hàm CSDL (bớt 1 vòng); bỏ giới hạn tần suất ở GET; chỉ mục đã có cho mọi cột lọc |

## 11. Giới hạn hiện tại

- Chưa có giao diện GV xem điểm/sổ cái (R05), chưa reset mùa (R06 — cấu trúc đã sẵn sàng).
- Chưa giới hạn số câu tính điểm mỗi ngày (`dailyScorableQuestionCap`, RQ-G5 — mặc định không giới hạn).
- `game_unlocks` chỉ hiện hoạt cảnh "Đã khám phá khu vực mới!" trong phản hồi của lượt đạt ngưỡng (chưa lưu "đã chúc mừng").
- Kho nội dung thật có **0 mục đã duyệt** → học thật luôn `INSUFFICIENT_CONTENT`/`CURRICULUM_UNCONFIRMED`; luồng điểm chỉ chạy với **fixture kiểm thử** trên Supabase local.
