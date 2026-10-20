import { submitAttempt } from "@/server/question-instances/service";
import { fail } from "@/server/result";
import { attemptRequestSchema, uuidSchema } from "@/server/student-gateway/api-schemas";
import { limitDevice, STUDENT_RATE_LIMITS, studentContext } from "@/server/student-gateway/context";
import { json, readJson } from "@/server/student-gateway/http";

/**
 * POST /api/student/question-instances/{id}/attempts — `{ clientAttemptId, response }`. Máy chủ chấm và ghi điểm trong
 * MỘT giao dịch; gửi lại cùng clientAttemptId nhận đúng kết quả cũ. Không có endpoint cộng điểm nào khác.
 */
export async function POST(request: Request, ctx: RouteContext<"/api/student/question-instances/[id]/attempts">) {
  const { id } = await ctx.params;
  if (!uuidSchema.safeParse(id).success) return json(fail("NOT_FOUND"));
  const context = await studentContext();
  if (!context.ok) return json(context);
  const body = await readJson(request, attemptRequestSchema);
  if (!body.ok) return json(body);
  const limited = await limitDevice(context.data, STUDENT_RATE_LIMITS.attempt);
  if (!limited.ok) return json(limited);
  return json(await submitAttempt(context.data, id, body.data));
}
