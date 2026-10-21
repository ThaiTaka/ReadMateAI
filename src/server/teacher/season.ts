"use server";

import { confirmationMatches, resetSeasonInput, resetSeasonOutput } from "@/features/gamification/season-reset";
import { getTeacherSession } from "@/server/auth/teacher";
import { fail, mapDbError, ok, type Result } from "@/server/result";

/**
 * Server Action reset mùa (R06.3): xác thực → zod → chủ nhiệm → so khớp tên lớp → hàm CSDL bằng JWT của GV.
 * CSDL kiểm tra lại quyền (owner theo auth.uid()), tên lớp, mùa đã xác nhận và khóa ý định trong MỘT giao dịch —
 * dữ liệu từ trình duyệt chỉ là đầu vào cần xác minh, không bao giờ được tin.
 */
export async function resetSeason(input: unknown): Promise<Result<{ newSeasonId: string; seqNo: number }>> {
  const parsed = resetSeasonInput.safeParse(input);
  if (!parsed.success) return fail("INVALID_INPUT");
  const { classId, requestId, expectedSeasonId, confirmation } = parsed.data;
  const auth = await getTeacherSession();
  if (!auth.ok) return fail(auth.code === "STUDENT_DEVICE" || auth.code === "NOT_STAFF" ? "FORBIDDEN" : auth.code);
  const { supabase } = auth.data;

  // RLS: lớp không thuộc GV → không có dòng. Chỉ chủ nhiệm được tiếp tục (CSDL cũng chặn).
  const { data: cls } = await supabase
    .from("classes")
    .select("name, class_staff(staff_id, role, removed_at)")
    .eq("id", classId)
    .maybeSingle();
  const membership = cls?.class_staff.find((row) => row.staff_id === auth.data.userId && row.removed_at === null);
  if (!cls || !membership || membership.role !== "owner") return fail("FORBIDDEN");
  if (!confirmationMatches(confirmation, cls.name)) return fail("CONFIRMATION_MISMATCH");

  const { data, error } = await supabase.rpc("teacher_reset_season", {
    p_class_id: classId,
    p_request_id: requestId,
    p_expected_season_id: expectedSeasonId,
    p_confirmation: confirmation,
  });
  if (error) return fail(mapDbError(error));
  const result = resetSeasonOutput.safeParse(data);
  return result.success ? ok({ newSeasonId: result.data.new_season_id, seqNo: result.data.seq_no }) : fail("UNKNOWN");
}
