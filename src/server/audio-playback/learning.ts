import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import { AUDIO_MAX_BYTES } from "@/features/audio-library/limits";
import { learningUnitInfo, type LearningUnitKind } from "@/features/audio-playback/learning-units";
import { STUDY_UNITS } from "@/features/audio-playback/study-catalog";
import { readAudioObject } from "@/server/audio-library/storage";
import { fail, mapDbError, ok, type Result } from "@/server/result";
import { ownsStudent, type StudentContext } from "@/server/student-gateway/context";
import { publicAudioCode, resolvedAudioSchema, type ResolvedAudio } from "./resolve";
import type { PlayableBytes } from "./service";

/**
 * Âm thanh KHI HỌC (R10.4 — docs/AUDIO_ENGINE.md §16): học sinh chạm vào chữ để nghe tên chữ cái hoặc âm của chữ trong khu vực
 * Học tập. Không có câu hỏi và không chấm điểm, nên KHÔNG đi qua chính sách chống lộ đáp án của buổi luyện/trò chơi (đường
 * `question-instances/{id}/audio` vẫn là đường duy nhất trong bài có điểm — AD-35 không đổi).
 *
 *  - Trình duyệt chỉ gửi mã học sinh (phải thuộc thiết bị) + loại + chữ; máy chủ tra danh mục (kho tri thức) để lấy cách đọc
 *    dự kiến — không nhận mã tài nguyên, đường dẫn hay cách đọc từ trình duyệt.
 *  - Mọi điều kiện (cờ, thiết bị, đồng ý, trường, bản approved đang dùng, cách đọc khớp, người ghi còn đồng ý) kiểm lại ở MỖI
 *    yêu cầu bằng hàm CSDL; tệp đọc bằng khóa secret từ bucket riêng tư và đối chiếu kích thước + SHA-256. Không URL công khai/ký.
 */

export type LearningAudioDto = {
  /** Học sinh đã tắt âm thanh trong cài đặt. */
  muted: boolean;
  /** Chữ/âm phát được NGAY BÂY GIỜ (kèm định dạng). Vắng mặt = chưa có bản ghi đã duyệt (không nói vì sao). */
  units: Array<{ kind: LearningUnitKind; text: string; mimeType: string }>;
};

const listSchema = z.array(
  z.object({ kind: z.enum(["letter", "phoneme"]), text: z.string().min(1).max(6), mimeType: z.string().min(1) }),
);

export async function learningAudioStatus(
  context: StudentContext,
  studentId: string,
): Promise<Result<LearningAudioDto>> {
  if (!ownsStudent(context, studentId)) return fail("FORBIDDEN");
  const student = context.students.find((entry) => entry.id === studentId);
  if (!student) return fail("FORBIDDEN");
  if (student.soundPreference === "off") return ok({ muted: true, units: [] });

  const asked = STUDY_UNITS.flatMap((unit) => {
    const info = learningUnitInfo(unit.kind, unit.text);
    return info ? [{ kind: info.kind, text: info.text, fallback: info.fallback ?? "", label: info.label }] : [];
  });
  const { data, error } = await context.admin.rpc("gateway_list_learning_audio", {
    p_auth_user_id: context.authUserId,
    p_student_id: studentId,
    p_units: asked,
  });
  if (error) return fail(publicAudioCode(mapDbError(error)));
  const parsed = listSchema.safeParse(data);
  return parsed.success ? ok({ muted: false, units: parsed.data }) : fail("AUDIO_NOT_AVAILABLE");
}

async function resolveLearningAudio(
  context: StudentContext,
  studentId: string,
  kind: string,
  text: string,
): Promise<Result<ResolvedAudio>> {
  if (!ownsStudent(context, studentId)) return fail("FORBIDDEN");
  const student = context.students.find((entry) => entry.id === studentId);
  if (!student) return fail("FORBIDDEN");
  if (student.soundPreference === "off") return fail("AUDIO_NOT_PERMITTED");
  const info = learningUnitInfo(kind, text);
  if (!info) return fail("NOT_FOUND");

  const resolved = await context.admin.rpc("gateway_resolve_learning_audio", {
    p_auth_user_id: context.authUserId,
    p_student_id: studentId,
    p_unit_kind: info.kind,
    p_unit_text: info.text,
    p_fallback_unit_text: info.fallback ?? "",
    p_expected_label: info.label,
  });
  if (resolved.error) return fail(publicAudioCode(mapDbError(resolved.error)));
  const parsed = resolvedAudioSchema.safeParse(resolved.data);
  return parsed.success ? ok(parsed.data) : fail("AUDIO_NOT_AVAILABLE");
}

export async function loadLearningAudio(
  context: StudentContext,
  studentId: string,
  kind: string,
  text: string,
): Promise<Result<PlayableBytes>> {
  const resolved = await resolveLearningAudio(context, studentId, kind, text);
  if (!resolved.ok) return resolved;
  const object = await readAudioObject(resolved.data.storageKey);
  if (!object.ok) return fail(object.code === "STORAGE_UNAVAILABLE" ? "STORAGE_UNAVAILABLE" : "AUDIO_NOT_AVAILABLE");
  const bytes = object.data;
  const intact =
    bytes.byteLength === resolved.data.sizeBytes &&
    bytes.byteLength <= AUDIO_MAX_BYTES &&
    createHash("sha256").update(bytes).digest("hex") === resolved.data.contentHash;
  return intact ? ok({ bytes, mimeType: resolved.data.mimeType }) : fail("AUDIO_NOT_AVAILABLE");
}
