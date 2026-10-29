import "server-only";
import { createHash } from "node:crypto";
import { AUDIO_MAX_BYTES } from "@/features/audio-library/limits";
import { bindingFor } from "@/features/audio-playback/bindings";
import { isTtsRole, PLAYBACK_ROLES, type PlaybackRole } from "@/features/audio-playback/roles";
import { readAudioObject } from "@/server/audio-library/storage";
import { loadItem, ownedQuestion, readableNow } from "@/server/question-instances/service";
import { fail, ok, type Result } from "@/server/result";
import {
  loadFeedbackAudio,
  loadInstructionAudio,
  resolveFeedbackAudio,
  resolveInstructionAudio,
} from "@/server/tts-library/playback";
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
  /**
   * Khe BỊ CHÍNH SÁCH GIỮ LẠI ở mức hỗ trợ này (ví dụ câu lệnh ở H1/H0): giao diện không vẽ nút, vì đó không phải "chưa có âm thanh".
   * Chỉ có khi không rỗng.
   */
  withheld?: PlaybackRole[];
  /** Khe nào đang phát bằng tệp CHẾ ĐỘ TRÌNH DIỄN (tạo tự động, chưa giáo viên duyệt) — giao diện ghi chú nhỏ "giọng trình diễn". */
  preview?: PlaybackRole[];
};

export async function audioStatus(
  context: StudentContext,
  questionId: string,
  feedbackRef?: string,
): Promise<Result<AudioStatusDto>> {
  const row = await ownedQuestion(context, questionId);
  if (!row || !(await readableNow(context.admin, row))) return fail("NOT_FOUND");
  const student = context.students.find((entry) => entry.id === row.student_id);
  if (!student) return fail("NOT_FOUND");
  if (student.soundPreference === "off") return ok({ muted: true, slots: {} });
  const item = await loadItem(context.admin, row.exercise_item_id);
  if (!item) return fail("UNKNOWN");

  const slots: AudioStatusDto["slots"] = {};
  const withheld: PlaybackRole[] = [];
  const preview: PlaybackRole[] = [];
  for (const role of PLAYBACK_ROLES) {
    if (isTtsRole(role)) {
      // Câu lệnh / lời phản hồi: giọng máy (thư viện đã duyệt, hoặc tệp trình diễn ở máy local), không phải bản ghi giáo viên.
      // Lời phản hồi chỉ được hỏi khi giao diện có mã dòng cụ thể và dòng đó khớp trạng thái thật của câu.
      if (role === "feedback" && !feedbackRef) continue;
      const line =
        role === "feedback"
          ? await resolveFeedbackAudio(context, row, item, feedbackRef as string)
          : await resolveInstructionAudio(context, row, item);
      if (line.ok) {
        slots[role] = { mimeType: line.data.mimeType };
        if (line.data.origin === "contest_preview") preview.push(role);
      } else if (line.code === "AUDIO_NOT_PERMITTED" && role === "instruction") withheld.push(role);
      continue;
    }
    if (!bindingFor(item, role)) continue;
    const resolved = await resolveTeacherAudio(context, row, item, role);
    if (resolved.ok) slots[role] = { mimeType: resolved.data.mimeType };
  }
  return ok({
    muted: false,
    slots,
    ...(withheld.length > 0 ? { withheld } : {}),
    ...(preview.length > 0 ? { preview } : {}),
  });
}

export type PlayableBytes = { bytes: Uint8Array<ArrayBuffer>; mimeType: string };

export async function loadPlayableAudio(
  context: StudentContext,
  questionId: string,
  role: PlaybackRole,
  feedbackRef?: string,
): Promise<Result<PlayableBytes>> {
  const row = await ownedQuestion(context, questionId);
  if (!row || !(await readableNow(context.admin, row))) return fail("NOT_FOUND");
  const item = await loadItem(context.admin, row.exercise_item_id);
  if (!item) return fail("UNKNOWN");
  if (isTtsRole(role)) {
    if (role === "feedback" && !feedbackRef) return fail("NOT_FOUND");
    const line =
      role === "feedback"
        ? await loadFeedbackAudio(context, row, item, feedbackRef as string)
        : await loadInstructionAudio(context, row, item);
    return line.ok ? ok(line.data) : fail(publicAudioCode(line.code));
  }
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
