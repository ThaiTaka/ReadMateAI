import { getPracticeSession } from "@/server/question-instances/service";
import { fail } from "@/server/result";
import { uuidSchema } from "@/server/student-gateway/api-schemas";
import { limitDevice, STUDENT_RATE_LIMITS, studentContext } from "@/server/student-gateway/context";
import { json } from "@/server/student-gateway/http";

/** GET /api/student/practice-sessions/{id} — trạng thái buổi luyện + câu đang mở (không đáp án trước khi đóng). */
export async function GET(_request: Request, ctx: RouteContext<"/api/student/practice-sessions/[id]">) {
  const { id } = await ctx.params;
  if (!uuidSchema.safeParse(id).success) return json(fail("NOT_FOUND"));
  const context = await studentContext();
  if (!context.ok) return json(context);
  const limited = await limitDevice(context.data, STUDENT_RATE_LIMITS.read);
  if (!limited.ok) return json(limited);
  return json(await getPracticeSession(context.data, id));
}
