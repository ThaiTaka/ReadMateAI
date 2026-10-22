import { activateEncounterRequestSchema } from "@/features/game-runs/encounter-dto";
import { activateEncounter } from "@/server/game-runs/encounters";
import { fail } from "@/server/result";
import { uuidSchema } from "@/server/student-gateway/api-schemas";
import { limitDevice, pickStudent, STUDENT_RATE_LIMITS, studentContext } from "@/server/student-gateway/context";
import { json, readJson } from "@/server/student-gateway/http";

/**
 * POST /api/student/game-runs/{runId}/encounters/activate — thân `{}` (hoặc `{ studentId }`). Không nhận tọa độ, HP hay mã
 * chạm trán: CSDL kích hoạt chạm trán gắn với ô nhân vật đang đứng (vị trí đã lưu). Gọi lại → chạm trán đang diễn ra.
 */
export async function POST(request: Request, ctx: RouteContext<"/api/student/game-runs/[runId]/encounters/activate">) {
  const { runId } = await ctx.params;
  if (!uuidSchema.safeParse(runId).success) return json(fail("NOT_FOUND"));
  const context = await studentContext();
  if (!context.ok) return json(context);
  const body = await readJson(request, activateEncounterRequestSchema);
  if (!body.ok) return json(body);
  const limited = await limitDevice(context.data, STUDENT_RATE_LIMITS.action);
  if (!limited.ok) return json(limited);
  const student = pickStudent(context.data, body.data.studentId);
  if (!student.ok) return json(student);
  return json(await activateEncounter(context.data, student.data.id, runId));
}
