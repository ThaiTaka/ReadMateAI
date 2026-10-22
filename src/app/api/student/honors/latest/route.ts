import type { NextRequest } from "next/server";
import { getStudentLatestHonors } from "@/server/honors/student";
import { fail } from "@/server/result";
import { studentQuerySchema } from "@/server/student-gateway/api-schemas";
import { limitDevice, pickStudent, STUDENT_RATE_LIMITS, studentContext } from "@/server/student-gateway/context";
import { json } from "@/server/student-gateway/http";

/**
 * GET /api/student/honors/latest — lần vinh danh TOP 3 gần nhất của lớp CỦA CHÍNH học sinh (R06.5).
 * Query chỉ nhận `studentId` (khóa tra cứu, phải thuộc thiết bị); KHÔNG nhận mã lớp/mùa. Tắt hoặc thiếu quyền →
 * `{status:"disabled"}` không kèm dữ liệu. Phản hồi `private, no-store` và không được lập chỉ mục.
 */
export async function GET(request: NextRequest) {
  const context = await studentContext();
  if (!context.ok) return noIndex(json(context));
  const limited = await limitDevice(context.data, STUDENT_RATE_LIMITS.read);
  if (!limited.ok) return noIndex(json(limited));
  const query = studentQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!query.success) return noIndex(json(fail("INVALID_INPUT")));
  const student = pickStudent(context.data, query.data.studentId);
  if (!student.ok) return noIndex(json(student));
  return noIndex(json(await getStudentLatestHonors(context.data, student.data)));
}

function noIndex(response: Response): Response {
  response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  return response;
}
