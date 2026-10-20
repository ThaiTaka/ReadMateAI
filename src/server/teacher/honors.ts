"use server";

import { z } from "zod";
import { getTeacherSession } from "@/server/auth/teacher";
import { fail, mapDbError, ok, type Result } from "@/server/result";

/**
 * Server Actions vinh danh TOP 3 (R06.1): xác thực → zod → hàm CSDL bằng JWT của GV. Quyền (chủ nhiệm hoặc co_teacher
 * có can_honor), cờ hệ thống `honors_feature_approved`, cờ lớp, mùa đang diễn ra, xếp hạng và ghi nhật ký đều được
 * CSDL kiểm tra/thực hiện trong một giao dịch — trình duyệt không gửi hạng hay điểm.
 */

const classInput = z.strictObject({ classId: z.uuid() });
const enabledInput = z.strictObject({ classId: z.uuid(), enabled: z.boolean() });

export async function createHonorSnapshot(input: unknown): Promise<Result<{ snapshotId: string }>> {
  const parsed = classInput.safeParse(input);
  if (!parsed.success) return fail("INVALID_INPUT");
  const auth = await getTeacherSession();
  if (!auth.ok) return fail(auth.code === "STUDENT_DEVICE" || auth.code === "NOT_STAFF" ? "FORBIDDEN" : auth.code);
  const { data, error } = await auth.data.supabase.rpc("teacher_create_honor_snapshot", {
    p_class_id: parsed.data.classId,
  });
  if (error) return fail(mapDbError(error));
  const id = z.uuid().safeParse(data);
  return id.success ? ok({ snapshotId: id.data }) : fail("UNKNOWN");
}

/** Chủ nhiệm bật/tắt vinh danh cho lớp. Bật chỉ được khi cờ hệ thống đã bật (HONORS_NOT_APPROVED). */
export async function setHonorsEnabled(input: unknown): Promise<Result<{ enabled: boolean }>> {
  const parsed = enabledInput.safeParse(input);
  if (!parsed.success) return fail("INVALID_INPUT");
  const auth = await getTeacherSession();
  if (!auth.ok) return fail(auth.code === "STUDENT_DEVICE" || auth.code === "NOT_STAFF" ? "FORBIDDEN" : auth.code);
  const { error } = await auth.data.supabase.rpc("teacher_set_honors_enabled", {
    p_class_id: parsed.data.classId,
    p_enabled: parsed.data.enabled,
  });
  if (error) return fail(mapDbError(error));
  return ok({ enabled: parsed.data.enabled });
}
