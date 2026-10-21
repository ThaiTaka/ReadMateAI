import "server-only";
import { buildStudentHonors, type StudentHonorsDto } from "@/features/honors/honors";
import { fail, mapDbError, ok, type Result } from "@/server/result";
import { ownsStudent, type StudentContext } from "@/server/student-gateway/context";
import type { LinkedStudent } from "@/server/student-gateway/session";

/**
 * Lần vinh danh gần nhất của lớp CỦA CHÍNH học sinh (R06.5). Lớp suy ra trong CSDL từ thiết bị đã liên kết
 * (`require_linked_device`) — không nhận class_id/season_id từ trình duyệt; bảng ảnh chụp không đọc trực tiếp được.
 * CSDL kiểm tra hai cờ, đồng ý học tập của học sinh xem, và lọc lại từng hàng ở mỗi lần đọc.
 */
export async function getStudentLatestHonors(
  context: StudentContext,
  student: LinkedStudent,
): Promise<Result<StudentHonorsDto>> {
  if (!ownsStudent(context, student.id)) return fail("FORBIDDEN");
  const { data, error } = await context.admin.rpc("gateway_latest_honors", {
    p_auth_user_id: context.authUserId,
    p_student_id: student.id,
  });
  if (error) return fail(mapDbError(error));
  const dto = buildStudentHonors(data);
  return dto ? ok(dto) : fail("UNKNOWN");
}
