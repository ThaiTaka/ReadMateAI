import { getQuestion } from "@/server/question-instances/service";
import { fail } from "@/server/result";
import { uuidSchema } from "@/server/student-gateway/api-schemas";
import { limitDevice, STUDENT_RATE_LIMITS, studentContext } from "@/server/student-gateway/context";
import { json } from "@/server/student-gateway/http";

/**
 * GET /api/student/question-instances/{id} — câu đã phát: `view` + trạng thái + số lượt; đáp án chỉ khi câu đã đóng.
 * Câu của học sinh khác và câu không tồn tại trả cùng một mã NOT_FOUND.
 */
export async function GET(_request: Request, ctx: RouteContext<"/api/student/question-instances/[id]">) {
  const { id } = await ctx.params;
  if (!uuidSchema.safeParse(id).success) return json(fail("NOT_FOUND"));
  const context = await studentContext();
  if (!context.ok) return json(context);
  const limited = await limitDevice(context.data, STUDENT_RATE_LIMITS.read);
  if (!limited.ok) return json(limited);
  return json(await getQuestion(context.data, id));
}
