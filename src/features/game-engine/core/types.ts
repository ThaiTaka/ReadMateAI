/*
 * Kiểu dữ liệu lõi Game Engine (R07.2). Thuần TypeScript, không zod, không DOM.
 * Lõi chỉ giữ trạng thái TRÌNH BÀY của mê cung; điểm, HP, câu hỏi do server quyết định (R04/R08).
 * Định dạng hàng tương thích nguyên mẫu R07.1: # tường · . đường đi · S xuất phát · T rương.
 */

export const ENCOUNTERS_PER_LEVEL = 7;
export const MIN_LEVEL_SIZE = 9;
export const MAX_LEVEL_SIZE = 13;

export type Direction = "up" | "down" | "left" | "right";

export type Position = { readonly row: number; readonly col: number };

export type CellKind = "wall" | "path" | "start" | "treasure";

/** Điểm kích hoạt chạm trán; ẩn với người chơi cho tới khi bước vào. */
export type Trigger = Position & { readonly id: string };

export type Level = {
  readonly id: string;
  readonly rows: readonly string[];
  readonly triggers: readonly Trigger[];
};

/** Kết quả một cuộc chạm trán do R08 cung cấp; lõi chỉ ghi nhận, không suy ra. */
export type EncounterOutcome = "defeated" | "undefeated";

export type ResolvedEncounter = { readonly triggerId: string; readonly outcome: EncounterOutcome };

export type RejectReason = "paused" | "encounter_pending" | "completed" | "no_pending_encounter" | "wrong_encounter";

export type GameEvent =
  | { readonly type: "init" }
  | { readonly type: "moved" }
  | { readonly type: "blocked"; readonly by: "wall" | "edge" }
  | { readonly type: "encounter_triggered"; readonly triggerId: string }
  | { readonly type: "encounter_resolved"; readonly triggerId: string }
  | { readonly type: "treasure_locked" }
  | { readonly type: "treasure_opened" }
  | { readonly type: "paused" }
  | { readonly type: "resumed" }
  | { readonly type: "rejected"; readonly reason: RejectReason };

export type GameState = {
  readonly levelId: string;
  readonly position: Position;
  readonly facing: Direction;
  readonly paused: boolean;
  readonly completed: boolean;
  /** Điểm kích hoạt đã mở, theo thứ tự; mỗi điểm chỉ một lần. */
  readonly triggered: readonly string[];
  /** Cuộc chạm trán đang chờ R08 giải quyết (chặn di chuyển). */
  readonly pendingEncounter: string | null;
  readonly resolved: readonly ResolvedEncounter[];
  readonly moves: number;
  readonly lastEvent: GameEvent;
};

export type GameAction =
  | { readonly type: "MOVE"; readonly direction: Direction }
  | { readonly type: "PAUSE" }
  | { readonly type: "RESUME" }
  | { readonly type: "ENCOUNTER_RESOLVED"; readonly triggerId: string; readonly outcome: EncounterOutcome };

export type LevelErrorCode =
  | "SIZE_OUT_OF_RANGE"
  | "ROW_LENGTH_MISMATCH"
  | "UNKNOWN_CELL"
  | "START_COUNT"
  | "TREASURE_COUNT"
  | "TRIGGER_COUNT"
  | "TRIGGER_ID_DUPLICATE"
  | "TRIGGER_DUPLICATE_POSITION"
  | "TRIGGER_OUT_OF_BOUNDS"
  | "TRIGGER_NOT_ON_PATH"
  | "PATH_DISCONNECTED"
  | "TREASURE_UNREACHABLE"
  | "TRIGGER_UNREACHABLE";

export type LevelError = {
  readonly code: LevelErrorCode;
  readonly message: string;
  readonly position?: Position;
  readonly triggerId?: string;
};
