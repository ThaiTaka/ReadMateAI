import { audioStatus } from "@/server/audio-playback/service";
import { fail } from "@/server/result";
import { uuidSchema } from "@/server/student-gateway/api-schemas";
import { limitDevice, STUDENT_RATE_LIMITS, studentContext } from "@/server/student-gateway/context";
import { json } from "@/server/student-gateway/http";

/**
 * GET /api/student/question-instances/{id}/audio — khe âm thanh nào của câu phát được NGAY BÂY GIỜ (JSON nhỏ, không có
 * tệp âm thanh, không có khóa lưu trữ). Cờ tắt / chưa có bản ghi đã duyệt / chưa được phép → `slots` rỗng, không lỗi.
 * Câu của học sinh khác và câu không tồn tại trả cùng một mã NOT_FOUND.
 */
export async function GET(_request: Request, ctx: RouteContext<"/api/student/question-instances/[id]/audio">) {
  const { id } = await ctx.params;
  if (!uuidSchema.safeParse(id).success) return json(fail("NOT_FOUND"));
  const context = await studentContext();
  if (!context.ok) return json(context);
  const limited = await limitDevice(context.data, STUDENT_RATE_LIMITS.read);
  if (!limited.ok) return json(limited);
  return json(await audioStatus(context.data, id));
}
