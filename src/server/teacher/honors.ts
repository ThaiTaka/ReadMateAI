"use server";

import { z } from "zod";
import { getTeacherSession } from "@/server/auth/teacher";
import { fail, mapDbError, ok, type Result } from "@/server/result";

/**
 * Server Actions vinh danh TOP 3 (R06.1): xác thực → zod → hàm CSDL bằng JWT của GV. Quyền (chủ nhiệm hoặc co_teacher
 * có can_honor), cờ hệ thống `honors_feature_approved`, cờ lớp, mùa đang diễn ra, xếp hạng và ghi nhật ký đều được
 * CSDL kiểm tra/thực hiện trong một giao dịch — trình duyệt không gửi hạng hay điểm.
 */

const createInput = z.strictObject({ classId: z.uuid(), requestId: z.uuid() });
const createResultSchema = z.object({ snapshot_id: z.uuid(), deduplicated: z.boolean() });
const enabledInput = z.strictObject({ classId: z.uuid(), enabled: z.boolean() });

/**
 * `requestId` = khóa ý định (một UUID cho mỗi lần GV quyết định vinh danh, giữ nguyên khi thử lại). Chống trùng do CSDL
 * thực hiện: cùng requestId → cùng ảnh chụp; ảnh chụp vừa có trong khoảng chống lặp → được gộp (`deduplicated`).
 */
export async function createHonorSnapshot(
  input: unknown,
): Promise<Result<{ snapshotId: string; deduplicated: boolean }>> {
  const parsed = createInput.safeParse(input);
  if (!parsed.success) return fail("INVALID_INPUT");
  const auth = await getTeacherSession();
  if (!auth.ok) return fail(auth.code === "STUDENT_DEVICE" || auth.code === "NOT_STAFF" ? "FORBIDDEN" : auth.code);
  const { data, error } = await auth.data.supabase.rpc("teacher_create_honor_snapshot", {
    p_class_id: parsed.data.classId,
    p_request_id: parsed.data.requestId,
  });
  if (error) return fail(mapDbError(error));
  const created = createResultSchema.safeParse(data);
  return created.success
    ? ok({ snapshotId: created.data.snapshot_id, deduplicated: created.data.deduplicated })
    : fail("UNKNOWN");
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
