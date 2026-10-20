import { BALANCE_FLOOR, GAME_KEYS, GAME_MIN_BALANCE, MAP_TILE_STEP, type GameKey } from "./rules.ts";

/**
 * Hàm thuần về mở khóa — dùng chung cho hiển thị (R02, dữ liệu minh họa) và cho server (R04 luôn tính lại).
 * Không đọc thời gian, không ngẫu nhiên, không lưu gì.
 */

/** Số mốc bản đồ được phép khám phá từ điểm tích lũy trong mùa (chỉ tăng, không trừ phần bị trừ). */
export function tilesAllowed(earnedTotal: number): number {
  if (!Number.isFinite(earnedTotal) || earnedTotal <= 0) return 0;
  return Math.floor(earnedTotal / MAP_TILE_STEP);
}

export type MilestoneProgress = {
  /** Số mốc đã đạt. */
  reached: number;
  /** Điểm tích lũy của mốc kế tiếp. */
  nextAt: number;
  /** Còn thiếu bao nhiêu điểm tới mốc kế tiếp (luôn > 0). */
  remaining: number;
  /** Tiến độ trong đoạn hiện tại, 0 ≤ ratio < 1. */
  ratio: number;
};

export function milestoneProgress(earnedTotal: number): MilestoneProgress {
  const earned = Number.isFinite(earnedTotal) ? Math.max(0, earnedTotal) : 0;
  const reached = tilesAllowed(earned);
  const nextAt = (reached + 1) * MAP_TILE_STEP;
  return { reached, nextAt, remaining: nextAt - earned, ratio: (earned - reached * MAP_TILE_STEP) / MAP_TILE_STEP };
}

/** Điểm của mốc thứ n (bắt đầu từ 1): 30, 60, 90… */
export function milestonePoints(count: number): number[] {
  return Array.from({ length: Math.max(0, Math.floor(count)) }, (_, index) => (index + 1) * MAP_TILE_STEP);
}

/** Đủ điểm hiện tại để vào game (so sánh ≥ ngưỡng; vào chơi không tốn điểm). */
export function canEnterGame(balance: number, game: GameKey): boolean {
  return Math.max(BALANCE_FLOOR, balance) >= GAME_MIN_BALANCE[game];
}

export type GameUnlockState = {
  game: GameKey;
  minBalance: number;
  eligible: boolean;
  /** Còn thiếu bao nhiêu điểm (0 khi đã đủ). */
  missing: number;
};

export function gameUnlockStates(balance: number): GameUnlockState[] {
  return GAME_KEYS.map((game) => {
    const minBalance = GAME_MIN_BALANCE[game];
    const eligible = canEnterGame(balance, game);
    return { game, minBalance, eligible, missing: eligible ? 0 : minBalance - Math.max(BALANCE_FLOOR, balance) };
  });
}
