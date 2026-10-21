import { z } from "zod";

/**
 * Lượt chơi Mê cung kho báu (R07.5b1) — lược đồ request và DTO. Phản hồi RPC được kiểm bằng zod rồi dựng lại từng
 * trường: DTO không bao giờ có student_id/class_id/season_id (RPC cũng không trả, đây là lớp phòng thủ thứ hai).
 */

export const TREASURE_MAZE_KEY = "treasure_maze";
export const TREASURE_MAZE_LEVEL_KEYS = ["treasure-maze-01", "treasure-maze-02", "treasure-maze-03"] as const;
export const MAX_POSITION_PATH = 64;

export const startGameRunRequestSchema = z.strictObject({
  studentId: z.uuid().optional(),
  gameKey: z.literal(TREASURE_MAZE_KEY),
  levelKey: z.enum(TREASURE_MAZE_LEVEL_KEYS),
});

const coordinate = z.number().int().min(0).max(1000);

export const savePositionRequestSchema = z.strictObject({
  studentId: z.uuid().optional(),
  stateVersion: z.number().int().min(1).max(2_000_000_000),
  path: z.array(z.strictObject({ row: coordinate, col: coordinate })).max(MAX_POSITION_PATH),
});

const positionSchema = z.object({ row: coordinate, col: coordinate });
const runRowSchema = z.object({
  id: z.uuid(),
  level_key: z.enum(TREASURE_MAZE_LEVEL_KEYS),
  level_version: z.string().min(1),
  status: z.enum(["in_progress", "completed", "abandoned", "void_season_reset"]),
  scored: z.boolean(),
  position: positionSchema,
  state_version: z.number().int().min(1),
});
const startResponseSchema = z.object({ outcome: z.enum(["created", "resumed"]), run: runRowSchema });
const saveResponseSchema = z.object({
  outcome: z.enum(["saved", "unchanged", "replayed"]),
  state_version: z.number().int().min(1),
  position: positionSchema,
});

export type GameRunDto = {
  outcome: "created" | "resumed";
  run: {
    id: string;
    levelKey: string;
    levelVersion: string;
    position: { row: number; col: number };
    stateVersion: number;
    status: string;
    scored: boolean;
  };
};
export type GamePositionDto = {
  outcome: "saved" | "unchanged" | "replayed";
  position: { row: number; col: number };
  stateVersion: number;
};

export function buildGameRun(raw: unknown): GameRunDto | null {
  const parsed = startResponseSchema.safeParse(raw);
  if (!parsed.success) return null;
  const { outcome, run } = parsed.data;
  return {
    outcome,
    run: {
      id: run.id,
      levelKey: run.level_key,
      levelVersion: run.level_version,
      position: { row: run.position.row, col: run.position.col },
      stateVersion: run.state_version,
      status: run.status,
      scored: run.scored,
    },
  };
}

export function buildGamePosition(raw: unknown): GamePositionDto | null {
  const parsed = saveResponseSchema.safeParse(raw);
  if (!parsed.success) return null;
  return {
    outcome: parsed.data.outcome,
    position: { row: parsed.data.position.row, col: parsed.data.position.col },
    stateVersion: parsed.data.state_version,
  };
}
