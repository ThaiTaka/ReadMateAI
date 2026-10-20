import { startOrResumePractice } from "@/server/question-instances/service";
import { practiceSessionRequestSchema } from "@/server/student-gateway/api-schemas";
import { limitDevice, pickStudent, STUDENT_RATE_LIMITS, studentContext } from "@/server/student-gateway/context";
import { json, readJson } from "@/server/student-gateway/http";

/**
 * POST /api/student/practice-sessions — mở buổi luyện đang dở hoặc lập buổi mới từ nội dung ĐÃ DUYỆT.
 * Thiếu nội dung → 409 INSUFFICIENT_CONTENT (không nới quy tắc).
 */
export async function POST(request: Request) {
  const context = await studentContext();
  if (!context.ok) return json(context);
  const body = await readJson(request, practiceSessionRequestSchema);
  if (!body.ok) return json(body);
  const limited = await limitDevice(context.data, STUDENT_RATE_LIMITS.action);
  if (!limited.ok) return json(limited);
  const student = pickStudent(context.data, body.data.studentId);
  if (!student.ok) return json(student);
  return json(await startOrResumePractice(context.data, student.data.id, new Date()));
}
