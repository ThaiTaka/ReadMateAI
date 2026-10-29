import { BALANCE_FLOOR, POINTS_CORRECT, POINTS_INCORRECT } from "./rules.ts";
import { EMPTY_SCORE, type AnswerOutcome, type LedgerEntry, type SeasonScore } from "./score-types.ts";

/**
 * Công thức tính điểm (docs/GAMIFICATION_SPEC.md §3) — HÀM THUẦN, không đọc CSDL/đồng hồ.
 *
 *   nominal_delta  = +10 nếu đúng, −5 nếu sai
 *   balance_after  = max(0, balance_before + nominal_delta)      ← sàn 0 áp dụng TẠI TỪNG sự kiện
 *   applied_delta  = balance_after − balance_before
 *   earned_total  += nominal_delta > 0 ? nominal_delta : 0       ← chỉ tăng
 *   deducted_total += applied_delta < 0 ? −applied_delta : 0
 *
 * Hàm CSDL `private.record_graded_attempt` thực hiện đúng công thức này trong giao dịch (hằng số đọc từ bảng
 * `private.scoring_rules`, đối chiếu với rules.ts bằng kiểm thử tích hợp). Máy chủ luôn tính lại; giao diện
 * không bao giờ tự cộng điểm.
 */

export function nominalDelta(outcome: AnswerOutcome): number {
  return outcome === "correct" ? POINTS_CORRECT : POINTS_INCORRECT;
}

function nonNegativeInt(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;
}

export type PointApplication = LedgerEntry & { score: SeasonScore };

export function applyPointEvent(score: SeasonScore, outcome: AnswerOutcome): PointApplication {
  const balanceBefore = Math.max(BALANCE_FLOOR, nonNegativeInt(score.balance));
  const nominal = nominalDelta(outcome);
  const balanceAfter = Math.max(BALANCE_FLOOR, balanceBefore + nominal);
  const appliedDelta = balanceAfter - balanceBefore;
  return {
    outcome,
    nominalDelta: nominal,
    appliedDelta,
    balanceBefore,
    balanceAfter,
    score: {
      balance: balanceAfter,
      earnedTotal: nonNegativeInt(score.earnedTotal) + (nominal > 0 ? nominal : 0),
      deductedTotal: nonNegativeInt(score.deductedTotal) + (appliedDelta < 0 ? -appliedDelta : 0),
    },
  };
}

/** Áp lần lượt một chuỗi kết quả từ điểm 0 (đầu mùa) — dùng cho kiểm thử và đối soát. */
export function replayOutcomes(outcomes: readonly AnswerOutcome[]): { score: SeasonScore; ledger: LedgerEntry[] } {
  let score: SeasonScore = EMPTY_SCORE;
  const ledger: LedgerEntry[] = [];
  for (const outcome of outcomes) {
    const { score: next, ...entry } = applyPointEvent(score, outcome);
    ledger.push(entry);
    score = next;
  }
  return { score, ledger };
}

/** Tính lại điểm mùa CHỈ từ sổ cái (số dư lưu phải bằng kết quả này — GAMIFICATION_SPEC §13.2). */
export function scoreFromLedger(
  ledger: ReadonlyArray<Pick<LedgerEntry, "nominalDelta" | "appliedDelta">>,
): SeasonScore {
  let balance = 0;
  let earnedTotal = 0;
  let deductedTotal = 0;
  for (const entry of ledger) {
    balance += entry.appliedDelta;
    if (entry.nominalDelta > 0) earnedTotal += entry.nominalDelta;
    if (entry.appliedDelta < 0) deductedTotal -= entry.appliedDelta;
  }
  return { balance, earnedTotal, deductedTotal };
}

/**
 * Sổ cái hợp lệ: bắt đầu từ 0, mỗi dòng nối tiếp dòng trước, áp đúng sàn 0 và chỉ chứa +10/−5.
 * Trả về chỉ số dòng sai đầu tiên (hoặc -1 khi hợp lệ) để kiểm thử/đối soát chỉ ra chỗ lệch.
 */
export function firstLedgerInconsistency(ledger: readonly LedgerEntry[]): number {
  let expectedBefore = 0;
  for (const [index, entry] of ledger.entries()) {
    const nominal = nominalDelta(entry.outcome);
    const after = Math.max(BALANCE_FLOOR, entry.balanceBefore + nominal);
    if (
      entry.balanceBefore !== expectedBefore ||
      entry.nominalDelta !== nominal ||
      entry.balanceAfter !== after ||
      entry.appliedDelta !== after - entry.balanceBefore
    ) {
      return index;
    }
    expectedBefore = entry.balanceAfter;
  }
  return -1;
}
