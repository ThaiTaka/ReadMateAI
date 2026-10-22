import { z } from "zod";
import { responseSchema } from "@/features/exercises/core/schemas";

/**
 * Lược đồ request của `/api/student/**` (zod `strictObject`). Không có trường điểm, đúng/sai, số dư, mã lớp hay mã
 * học sinh "của người khác": `studentId` chỉ là khóa tra cứu, máy chủ đối chiếu với danh sách RLS của thiết bị.
 */

export const uuidSchema = z.uuid();

export const studentQuerySchema = z.strictObject({ studentId: z.uuid().optional() });

export const practiceSessionRequestSchema = z.strictObject({ studentId: z.uuid().optional() });

export const attemptRequestSchema = z.strictObject({
  clientAttemptId: z.uuid(),
  response: responseSchema,
});

export const mapTileRequestSchema = z.strictObject({
  studentId: z.uuid().optional(),
  tileKey: z.string().regex(/^[a-z_]{3,40}$/u),
});
