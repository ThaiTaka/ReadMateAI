import type { HonorRank } from "./honors";

/**
 * Trình chiếu vinh danh (R06.2) — máy trạng thái THUẦN. Thứ tự và số bậc lấy từ `playbackOrder` của ảnh chụp đã lưu
 * (R06.1), không bao giờ tính lại hạng từ điểm hiện tại. Bậc trống (đồng hạng 1,1,3) đã bị loại khỏi `playbackOrder`.
 * `revealed` = số bậc đã hiện, tính từ đầu `playbackOrder` (hạng thấp nhất trước).
 */

export type PlaybackPhase = "ready" | "playing" | "summary";
export type PlaybackState = { phase: PlaybackPhase; revealed: number };
export type PlaybackAction = "start" | "next" | "skip" | "replay";

export const INITIAL_PLAYBACK: PlaybackState = { phase: "ready", revealed: 0 };

export function reducePlayback(state: PlaybackState, action: PlaybackAction, total: number): PlaybackState {
  switch (action) {
    case "start":
      if (state.phase !== "ready") return state;
      return total === 0 ? { phase: "summary", revealed: 0 } : { phase: "playing", revealed: 1 };
    case "next":
      if (state.phase === "ready") return reducePlayback(state, "start", total);
      if (state.phase === "summary") return state;
      // Bước cuối (HẠNG 1) đã hiện: bấm tiếp → màn tổng kết.
      return state.revealed >= total
        ? { phase: "summary", revealed: total }
        : { phase: "playing", revealed: state.revealed + 1 };
    case "skip":
      return { phase: "summary", revealed: total };
    case "replay":
      return INITIAL_PLAYBACK;
  }
}

/** Màn tổng kết hiện đủ mọi bậc. */
export const isTierRevealed = (state: PlaybackState, order: readonly HonorRank[], rank: HonorRank): boolean =>
  state.phase === "summary" || order.indexOf(rank) < state.revealed;

/** Bậc vừa hiện ở bước hiện tại (null khi chưa bắt đầu hoặc đã ở màn tổng kết). */
export const currentTierRank = (state: PlaybackState, order: readonly HonorRank[]): HonorRank | null =>
  state.phase === "playing" ? (order[state.revealed - 1] ?? null) : null;

export type PrimaryLabel = "start" | "next" | "summary";
export const primaryLabel = (state: PlaybackState, total: number): PrimaryLabel =>
  state.phase === "ready" ? "start" : state.revealed >= total ? "summary" : "next";

/** Mỗi bậc tối đa 6 avatar kiểu hàng; nhiều hơn → lưới nhỏ gọn (LEADERBOARD_SPEC §8.3). */
export const HONOR_TIER_ROW_LIMIT = 6;
export const tierLayout = (entryCount: number): "row" | "grid" => (entryCount > HONOR_TIER_ROW_LIMIT ? "grid" : "row");
