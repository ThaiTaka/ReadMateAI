/**
 * Kiểu dữ liệu của điểm thưởng (docs/GAMIFICATION_SPEC.md §2). Dùng chung cho hàm thuần (apply.ts, unlocks.ts),
 * máy chủ (src/server/scoring) và giao diện. Không chứa logic.
 */

/** Điểm của một học sinh trong MỘT mùa — dữ liệu dẫn xuất, tính lại được hoàn toàn từ sổ cái `point_events`. */
export type SeasonScore = {
  /** Điểm hiện tại (số dư, sàn 0) — xếp hạng (R05) và điều kiện vào mini-game. */
  balance: number;
  /** Điểm tích lũy: tổng phần được cộng trong mùa, chỉ tăng — quyết định số thẻ bản đồ được khám phá. */
  earnedTotal: number;
  /** Tổng phần thực sự bị trừ (sau sàn 0) — chỉ để GV đối soát, không hiển thị cho học sinh. */
  deductedTotal: number;
};

export const EMPTY_SCORE: SeasonScore = Object.freeze({ balance: 0, earnedTotal: 0, deductedTotal: 0 });

/** Kết quả chấm của một lượt hợp lệ của câu tính điểm. */
export type AnswerOutcome = "correct" | "incorrect";

/** Một dòng sổ cái (phần số học — các cột định danh nằm ở CSDL). */
export type LedgerEntry = {
  outcome: AnswerOutcome;
  /** +10 hoặc −5 theo quy tắc. */
  nominalDelta: number;
  /** Phần thực sự áp dụng sau sàn 0 (−5 ≤ applied ≤ +10). */
  appliedDelta: number;
  balanceBefore: number;
  balanceAfter: number;
};
