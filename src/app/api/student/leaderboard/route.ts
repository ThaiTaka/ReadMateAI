import type { NextRequest } from "next/server";
import { getStudentLeaderboard } from "@/server/leaderboard/student";
import { fail } from "@/server/result";
import { studentQuerySchema } from "@/server/student-gateway/api-schemas";
import { limitDevice, pickStudent, STUDENT_RATE_LIMITS, studentContext } from "@/server/student-gateway/context";
import { json } from "@/server/student-gateway/http";

/**
 * GET /api/student/leaderboard — bảng điểm của lớp CỦA CHÍNH học sinh (R05).
 * Query chỉ nhận `studentId` (khóa tra cứu, phải thuộc thiết bị); KHÔNG nhận mã lớp/mùa. Bảng tắt → `{status:"disabled"}`
 * không kèm dữ liệu. Phản hồi luôn `private, no-store`.
 */
export async function GET(request: NextRequest) {
  const context = await studentContext();
  if (!context.ok) return json(context);
  const limited = await limitDevice(context.data, STUDENT_RATE_LIMITS.read);
  if (!limited.ok) return json(limited);
  const query = studentQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!query.success) return json(fail("INVALID_INPUT"));
  const student = pickStudent(context.data, query.data.studentId);
  if (!student.ok) return json(student);
  return json(await getStudentLeaderboard(context.data, student.data));
}
