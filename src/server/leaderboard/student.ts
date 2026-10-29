import "server-only";
import { buildStudentLeaderboard } from "@/features/leaderboard/build";
import type { LeaderboardDto } from "@/features/leaderboard/types";
import { fail, mapDbError, ok, type Result } from "@/server/result";
import { ownsStudent, type StudentContext } from "@/server/student-gateway/context";
import type { LinkedStudent } from "@/server/student-gateway/session";

/**
 * Bảng xếp hạng của học sinh (R05). Lớp được suy ra TRONG CSDL từ thiết bị đã liên kết (`require_linked_device`) —
 * không nhận class_id từ trình duyệt. CSDL lọc học sinh đủ điều kiện hiển thị và kiểm tra hai cờ (hệ thống + lớp);
 * khi bảng tắt, kết quả KHÔNG chứa dữ liệu nào. Xếp hạng/đồng hạng/thanh điểm do hàm thuần `ranking.ts` quyết định.
 */
export async function getStudentLeaderboard(
  context: StudentContext,
  student: LinkedStudent,
): Promise<Result<LeaderboardDto>> {
  if (!ownsStudent(context, student.id)) return fail("FORBIDDEN");
  const { data, error } = await context.admin.rpc("gateway_class_leaderboard", {
    p_auth_user_id: context.authUserId,
    p_student_id: student.id,
  });
  if (error) return fail(mapDbError(error));
  const dto = buildStudentLeaderboard(data, new Date());
  return dto ? ok(dto) : fail("UNKNOWN");
}
