import "server-only";
import { z } from "zod";
import { AUDIO_MAX_BYTES, AUDIO_MIME_TYPES } from "@/features/audio-library/limits";
import { bindingFor } from "@/features/audio-playback/bindings";
import { decidePlayback } from "@/features/audio-playback/policy";
import { isTtsRole, variantHasRecording, type PlaybackRole } from "@/features/audio-playback/roles";
import type { ExerciseItem } from "@/features/exercises/items";
import { VARIANTS } from "@/features/exercises/runtime-registry";
import { fail, mapDbError, ok, type ErrorCode, type Result } from "@/server/result";
import type { StudentContext } from "@/server/student-gateway/context";
import type { SupportLevel } from "@/types/learning";

/**
 * Kiểm tra quyền phát một bản ghi giáo viên cho một câu của học sinh (R10.3a). Đây là MỘT nơi duy nhất quyết định:
 * chính sách chống lộ đáp án (`decidePlayback`, dùng lại `decideBeforeGrading`/`decideAfterGrading`), cài đặt âm thanh của
 * học sinh, rồi hàm CSDL `gateway_resolve_teacher_audio` (cờ, liên kết thiết bị, đồng ý learning_data, trường, trạng thái
 * approved + đang dùng, cách đọc đã xác nhận và khớp, người ghi còn đồng ý). Gọi lại ở MỖI lần phát — không lưu kết quả.
 *
 * Kết quả chứa `storageKey`: CHỈ để máy chủ đọc tệp; không bao giờ đưa vào phản hồi cho trình duyệt.
 */

export const resolvedAudioSchema = z.object({
  versionId: z.uuid(),
  storageKey: z.string().min(1),
  mimeType: z.enum(AUDIO_MIME_TYPES),
  sizeBytes: z.number().int().positive().max(AUDIO_MAX_BYTES),
  durationMs: z.number().int().positive(),
  contentHash: z.string().regex(/^[0-9a-f]{64}$/u),
});
export type ResolvedAudio = z.infer<typeof resolvedAudioSchema>;

type QuestionFacts = { id: string; student_id: string; status: string; support_level: number };

export function supportLevelOf(value: number): SupportLevel {
  return value === 0 || value === 1 || value === 2 || value === 3 ? value : 3;
}

/**
 * Mã lỗi nội bộ → mã trả cho trình duyệt. Trẻ không cần biết VÌ SAO chưa có âm thanh (GV chưa duyệt, đã rút đồng ý, cách
 * đọc chưa khớp…): mọi nguyên nhân về nội dung gộp thành AUDIO_NOT_AVAILABLE. Mã nội bộ chi tiết vẫn có ở hàm CSDL (kiểm thử).
 */
export function publicAudioCode(code: ErrorCode): ErrorCode {
  switch (code) {
    case "PRONUNCIATION_UNCONFIRMED":
    case "LABEL_MISMATCH":
    case "VOICE_CONSENT_REQUIRED":
    case "INVALID_INPUT":
    case "UNKNOWN":
      return "AUDIO_NOT_AVAILABLE";
    default:
      return code;
  }
}

export async function resolveTeacherAudio(
  context: StudentContext,
  question: QuestionFacts,
  item: ExerciseItem,
  role: PlaybackRole,
  options: { ignoreSoundPreference?: boolean } = {},
): Promise<Result<ResolvedAudio>> {
  // Khe giọng máy (câu lệnh) KHÔNG đi qua bản ghi giáo viên: có đường riêng ở tts-library/playback.ts.
  if (isTtsRole(role)) return fail("AUDIO_NOT_AVAILABLE");
  const binding = bindingFor(item, role);
  if (!binding) return fail("AUDIO_NOT_AVAILABLE");
  const student = context.students.find((entry) => entry.id === question.student_id);
  if (!student) return fail("FORBIDDEN");
  if (question.status === "void") return fail("AUDIO_NOT_PERMITTED");
  if (student.soundPreference === "off" && !options.ignoreSoundPreference) return fail("AUDIO_NOT_PERMITTED");

  const decision = decidePlayback({
    policy: VARIANTS[item.variant].audioPolicy,
    role,
    supportLevel: supportLevelOf(question.support_level),
    graded: question.status === "correct" || question.status === "exhausted",
  });
  if (!decision.ok) return fail("AUDIO_NOT_PERMITTED");

  const resolved = await context.admin.rpc("gateway_resolve_teacher_audio", {
    p_auth_user_id: context.authUserId,
    p_question_instance_id: question.id,
    p_unit_text: binding.unitText,
    p_fallback_unit_text: binding.fallbackUnitText ?? "",
    p_expected_label: binding.expectedLabel,
  });
  if (resolved.error) return fail(publicAudioCode(mapDbError(resolved.error)));
  const parsed = resolvedAudioSchema.safeParse(resolved.data);
  return parsed.success ? ok(parsed.data) : fail("AUDIO_NOT_AVAILABLE");
}

/**
 * Câu mà việc NGHE bản ghi giáo viên là điều kiện để làm được (khe `stimulus` bắt buộc của biến thể, nguồn là bản ghi
 * giáo viên). Câu như vậy mà không có âm thanh đã duyệt thì không được tính điểm (xem `submitAttempt`).
 */
export function requiresTeacherRecording(item: ExerciseItem): boolean {
  return (
    variantHasRecording(item.variant, "stimulus") && VARIANTS[item.variant].audioPolicy.required.includes("stimulus")
  );
}
