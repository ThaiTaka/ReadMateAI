import "server-only";
import {
  buildHonorSnapshot,
  buildHonorSummaries,
  type HonorSnapshotDto,
  type HonorSnapshotSummary,
} from "@/features/honors/honors";
import type { TeacherSession } from "@/server/auth/teacher";
import { fail, mapDbError, ok, type Result } from "@/server/result";
import { z } from "zod";

/**
 * Đọc ảnh chụp vinh danh (R06.1) — bằng JWT của GV; hàm CSDL tự kiểm tra GV thuộc lớp, lấy dữ liệu từ ảnh chụp đã lưu
 * (không tính lại hạng) và LỌC lại theo quyền hiện tại (đồng ý, tên hiển thị) ở mỗi lần đọc.
 */

const idSchema = z.uuid();

export async function getHonorSnapshot(session: TeacherSession, snapshotId: string): Promise<Result<HonorSnapshotDto>> {
  if (!idSchema.safeParse(snapshotId).success) return fail("NOT_FOUND");
  const { data, error } = await session.supabase.rpc("teacher_get_honor_snapshot", { p_snapshot_id: snapshotId });
  if (error) return fail(mapDbError(error));
  const snapshot = buildHonorSnapshot(data);
  return snapshot ? ok(snapshot) : fail("UNKNOWN");
}

export async function listHonorSnapshots(
  session: TeacherSession,
  classId: string,
): Promise<Result<HonorSnapshotSummary[]>> {
  if (!idSchema.safeParse(classId).success) return fail("NOT_FOUND");
  const { data, error } = await session.supabase.rpc("teacher_list_honor_snapshots", { p_class_id: classId });
  if (error) return fail(mapDbError(error));
  const list = buildHonorSummaries(data);
  return list ? ok(list) : fail("UNKNOWN");
}
