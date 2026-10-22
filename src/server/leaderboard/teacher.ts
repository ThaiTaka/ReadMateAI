import "server-only";
import { buildPresentation, buildTeacherOverview } from "@/features/leaderboard/build";
import type { PresentationDto, TeacherBoardOverview } from "@/features/leaderboard/types";
import type { TeacherSession } from "@/server/auth/teacher";
import { fail, mapDbError, ok, type Result } from "@/server/result";
import { z } from "zod";

/**
 * Bảng xếp hạng cho giáo viên (R05) — luôn bằng JWT của GV; hàm CSDL tự kiểm tra GV thuộc lớp.
 *  - `overview`: bảng nội bộ + đối soát (điểm tích lũy, đồng ý, tên hiển thị) — CHỈ cho màn hình quản trị.
 *  - `presentation`: dữ liệu trình chiếu — hàm CSDL riêng, chỉ học sinh đủ điều kiện, không mã định danh.
 */

const classIdSchema = z.uuid();

export async function getTeacherBoardOverview(
  session: TeacherSession,
  classId: string,
): Promise<Result<TeacherBoardOverview>> {
  if (!classIdSchema.safeParse(classId).success) return fail("NOT_FOUND");
  const { data, error } = await session.supabase.rpc("teacher_leaderboard_overview", { p_class_id: classId });
  if (error) return fail(mapDbError(error));
  const overview = buildTeacherOverview(data);
  return overview ? ok(overview) : fail("UNKNOWN");
}

export async function getPresentation(session: TeacherSession, classId: string): Promise<Result<PresentationDto>> {
  if (!classIdSchema.safeParse(classId).success) return fail("NOT_FOUND");
  const { data, error } = await session.supabase.rpc("teacher_leaderboard_display", { p_class_id: classId });
  if (error) return fail(mapDbError(error));
  const presentation = buildPresentation(data, new Date());
  return presentation ? ok(presentation) : fail("UNKNOWN");
}
