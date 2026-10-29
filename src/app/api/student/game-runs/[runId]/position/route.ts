import { savePositionRequestSchema } from "@/features/game-runs/dto";
import { saveGamePosition } from "@/server/game-runs/student";
import { fail } from "@/server/result";
import { uuidSchema } from "@/server/student-gateway/api-schemas";
import { limitDevice, pickStudent, STUDENT_RATE_LIMITS, studentContext } from "@/server/student-gateway/context";
import { json, readJson } from "@/server/student-gateway/http";

/**
 * PATCH /api/student/game-runs/{runId}/position — lưu các bước đi tiếp theo (≤ 64). CSDL kiểm từng bước theo bản đồ,
 * quyền sở hữu, mùa hiện tại và `stateVersion`; không ghi điểm, không mở rương, không hoàn tất thử thách.
 */
export async function PATCH(request: Request, ctx: RouteContext<"/api/student/game-runs/[runId]/position">) {
  const { runId } = await ctx.params;
  if (!uuidSchema.safeParse(runId).success) return json(fail("NOT_FOUND"));
  const context = await studentContext();
  if (!context.ok) return json(context);
  const body = await readJson(request, savePositionRequestSchema);
  if (!body.ok) return json(body);
  const limited = await limitDevice(context.data, STUDENT_RATE_LIMITS.action);
  if (!limited.ok) return json(limited);
  const student = pickStudent(context.data, body.data.studentId);
  if (!student.ok) return json(student);
  return json(await saveGamePosition(context.data, student.data.id, runId, body.data.path, body.data.stateVersion));
}
