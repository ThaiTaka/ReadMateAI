import type { NextRequest } from "next/server";
import { getStudentHome } from "@/server/scoring/home";
import { fail } from "@/server/result";
import { studentQuerySchema } from "@/server/student-gateway/api-schemas";
import { limitDevice, pickStudent, STUDENT_RATE_LIMITS, studentContext } from "@/server/student-gateway/context";
import { json } from "@/server/student-gateway/http";

/** GET /api/student/home — điểm, thẻ bản đồ, trạng thái bốn game, buổi luyện dở của CHÍNH học sinh. */
export async function GET(request: NextRequest) {
  const context = await studentContext();
  if (!context.ok) return json(context);
  const limited = await limitDevice(context.data, STUDENT_RATE_LIMITS.read);
  if (!limited.ok) return json(limited);
  const query = studentQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!query.success) return json(fail("INVALID_INPUT"));
  const student = pickStudent(context.data, query.data.studentId);
  if (!student.ok) return json(student);
  return json(await getStudentHome(context.data, student.data));
}
