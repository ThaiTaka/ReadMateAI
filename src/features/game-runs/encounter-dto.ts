import { z } from "zod";
import type { PublicQuestion } from "../scored-practice/types.ts";

/**
 * Chạm trán và kho báu của Mê cung (R08.3) — lược đồ request và DTO. Phản hồi RPC được kiểm bằng zod rồi dựng lại từng
 * trường: DTO chỉ nói về chạm trán ĐANG DIỄN RA (không có điểm kích hoạt, chạm trán/quái vật chưa xuất hiện, 21 câu,
 * student_id/class_id/season_id).
 */

export const activateEncounterRequestSchema = z.strictObject({ studentId: z.uuid().optional() });
export const openTreasureRequestSchema = z.strictObject({ studentId: z.uuid().optional() });

const encounterRowSchema = z.object({
  id: z.uuid(),
  encounterNo: z.number().int().min(1).max(7),
  monsterKey: z.string().regex(/^[a-z0-9][a-z0-9_-]{1,47}$/),
  status: z.literal("active"),
  hpRemaining: z.number().int().min(0).max(3),
});
const activateResponseSchema = z.object({ outcome: z.enum(["activated", "resumed"]), encounter: encounterRowSchema });
const treasureResponseSchema = z.object({
  outcome: z.enum(["opened", "replayed"]),
  treasure: z.object({
    runId: z.uuid(),
    status: z.literal("completed"),
    completedAt: z.string().min(1),
    defeated: z.number().int().min(0).max(7),
    undefeated: z.number().int().min(0).max(7),
  }),
});

export type EncounterDto = {
  id: string;
  encounterNo: number;
  monsterKey: string;
  /** Số trái tim còn lại của quái vật (0–3). */
  hpRemaining: number;
  /** Ba câu của chạm trán: chỉ mã, thứ tự và trạng thái đóng/mở — nội dung chỉ có ở `current`. */
  questions: Array<{ id: string; position: number; status: PublicQuestion["status"] }>;
  /** Câu hiện tại (câu mở đầu tiên); null khi cả ba câu đã đóng. */
  current: PublicQuestion | null;
  progress: { total: number; closed: number; correct: number };
};

export type EncounterStateDto = {
  runId: string;
  /** Chạm trán đang diễn ra, hoặc null. */
  encounter: EncounterDto | null;
  /** Số chạm trán đã kết thúc / tổng (không nói chạm trán nào, ở đâu). */
  progress: { resolved: number; total: number };
};

export type ActivateEncounterDto = { outcome: "activated" | "resumed"; state: EncounterStateDto };

export type TreasureDto = {
  outcome: "opened" | "replayed";
  runId: string;
  completedAt: string;
  defeated: number;
  undefeated: number;
};

export function buildActivation(raw: unknown): { outcome: "activated" | "resumed"; encounterId: string } | null {
  const parsed = activateResponseSchema.safeParse(raw);
  return parsed.success ? { outcome: parsed.data.outcome, encounterId: parsed.data.encounter.id } : null;
}

export function buildTreasure(raw: unknown): TreasureDto | null {
  const parsed = treasureResponseSchema.safeParse(raw);
  if (!parsed.success) return null;
  const { outcome, treasure } = parsed.data;
  return {
    outcome,
    runId: treasure.runId,
    completedAt: treasure.completedAt,
    defeated: treasure.defeated,
    undefeated: treasure.undefeated,
  };
}
