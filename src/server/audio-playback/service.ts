import "server-only";
import { createHash } from "node:crypto";
import { AUDIO_MAX_BYTES } from "@/features/audio-library/limits";
import { bindingFor } from "@/features/audio-playback/bindings";
import { PLAYBACK_ROLES, type PlaybackRole } from "@/features/audio-playback/roles";
import { readAudioObject } from "@/server/audio-library/storage";
import { loadItem, ownedQuestion, readableNow } from "@/server/question-instances/service";
import { fail, ok, type Result } from "@/server/result";
import type { StudentContext } from "@/server/student-gateway/context";
import { publicAudioCode, resolveTeacherAudio } from "./resolve";

/**
 * Phát bản ghi giáo viên đã duyệt cho học sinh (R10.3a — docs/AUDIO_ENGINE.md §13).
 *
 *  - Học sinh chỉ gửi mã CÂU (thuộc thiết bị) và khe (`stimulus`/`model`); KHÔNG gửi mã tài nguyên nào. Máy chủ suy ra âm
 *    từ chính câu → không thể tải tùy ý một bản ghi khác.
 *  - Mọi kiểm tra chạy lại ở mỗi yêu cầu; tệp đọc bằng khóa secret từ bucket riêng tư, đối chiếu kích thước + băm với
 *    metadata đã duyệt (tệp bị thay/hỏng → không phát). Không URL công khai, không URL ký.
 */

export type AudioStatusDto = {
  /** Học sinh đã tắt âm thanh trong cài đặt (lớp giao diện hiện thông báo thay vì nút). */
  muted: boolean;
  /** Khe nào phát được NGAY BÂY GIỜ (kèm định dạng để trình duyệt kiểm khả năng phát). Khe vắng mặt = không phát. */
  slots: Partial<Record<PlaybackRole, { mimeType: string }>>;
};

export async function audioStatus(context: StudentContext, questionId: string): Promise<Result<AudioStatusDto>> {
  const row = await ownedQuestion(context, questionId);
  if (!row || !(await readableNow(context.admin, row))) return fail("NOT_FOUND");
  const student = context.students.find((entry) => entry.id === row.student_id);
  if (!student) return fail("NOT_FOUND");
  if (student.soundPreference === "off") return ok({ muted: true, slots: {} });
  const item = await loadItem(context.admin, row.exercise_item_id);
  if (!item) return fail("UNKNOWN");

  const slots: AudioStatusDto["slots"] = {};
  for (const role of PLAYBACK_ROLES) {
    if (!bindingFor(item, role)) continue;
    const resolved = await resolveTeacherAudio(context, row, item, role);
    if (resolved.ok) slots[role] = { mimeType: resolved.data.mimeType };
    // Cờ tắt: không còn gì để hỏi nữa (các khe khác cũng sẽ bị từ chối cùng lý do).
    else if (resolved.code === "AUDIO_PLAYBACK_DISABLED") break;
  }
  return ok({ muted: false, slots });
}

export type PlayableBytes = { bytes: Uint8Array<ArrayBuffer>; mimeType: string };

export async function loadPlayableAudio(
  context: StudentContext,
  questionId: string,
  role: PlaybackRole,
): Promise<Result<PlayableBytes>> {
  const row = await ownedQuestion(context, questionId);
  if (!row || !(await readableNow(context.admin, row))) return fail("NOT_FOUND");
  const item = await loadItem(context.admin, row.exercise_item_id);
  if (!item) return fail("UNKNOWN");
  const resolved = await resolveTeacherAudio(context, row, item, role);
  if (!resolved.ok) return fail(publicAudioCode(resolved.code));

  const object = await readAudioObject(resolved.data.storageKey);
  if (!object.ok) return fail(object.code === "STORAGE_UNAVAILABLE" ? "STORAGE_UNAVAILABLE" : "AUDIO_NOT_AVAILABLE");
  const bytes = object.data;
  const intact =
    bytes.byteLength === resolved.data.sizeBytes &&
    bytes.byteLength <= AUDIO_MAX_BYTES &&
    createHash("sha256").update(bytes).digest("hex") === resolved.data.contentHash;
  if (!intact) return fail("AUDIO_NOT_AVAILABLE");
  return ok({ bytes, mimeType: resolved.data.mimeType });
}
