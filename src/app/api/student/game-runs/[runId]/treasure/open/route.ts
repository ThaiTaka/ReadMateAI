import { openTreasureRequestSchema } from "@/features/game-runs/encounter-dto";
import { openTreasure } from "@/server/game-runs/encounters";
import { fail } from "@/server/result";
import { uuidSchema } from "@/server/student-gateway/api-schemas";
import { limitDevice, pickStudent, STUDENT_RATE_LIMITS, studentContext } from "@/server/student-gateway/context";
import { json, readJson } from "@/server/student-gateway/http";

/**
 * POST /api/student/game-runs/{runId}/treasure/open — thân `{}` (hoặc `{ studentId }`). CSDL chỉ mở khi nhân vật đứng ở ô rương
 * và đủ 7 chạm trán đã kết thúc; không cộng điểm, không phần thưởng ngẫu nhiên. Gửi lại → kết quả cũ.
 */
export async function POST(request: Request, ctx: RouteContext<"/api/student/game-runs/[runId]/treasure/open">) {
  const { runId } = await ctx.params;
  if (!uuidSchema.safeParse(runId).success) return json(fail("NOT_FOUND"));
  const context = await studentContext();
  if (!context.ok) return json(context);
  const body = await readJson(request, openTreasureRequestSchema);
  if (!body.ok) return json(body);
  const limited = await limitDevice(context.data, STUDENT_RATE_LIMITS.action);
  if (!limited.ok) return json(limited);
  const student = pickStudent(context.data, body.data.studentId);
  if (!student.ok) return json(student);
  return json(await openTreasure(context.data, student.data.id, runId));
}
