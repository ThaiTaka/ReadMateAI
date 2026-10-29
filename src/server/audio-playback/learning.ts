import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import { AUDIO_MAX_BYTES } from "@/features/audio-library/limits";
import { learningUnitInfo, type LearningUnitKind } from "@/features/audio-playback/learning-units";
import { STUDY_UNITS } from "@/features/audio-playback/study-catalog";
import { contestUnitEntry } from "@/server/contest-audio/catalog";
import { loadContestAudio, listContestAudio } from "@/server/contest-audio/playback";
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
  /**
   * Chữ/âm phát được NGAY BÂY GIỜ (kèm định dạng). Vắng mặt = chưa có bản ghi đã duyệt (không nói vì sao).
   * `source: "contest_preview"` = tệp CHẾ ĐỘ TRÌNH DIỄN (giọng máy tạo tự động, chưa giáo viên duyệt; chỉ ở máy local) — luôn nói rõ.
   * `unverified` = mục có rủi ro cách đọc, chỉ phát khi chủ dự án bật cờ riêng.
   */
  units: Array<{
    kind: LearningUnitKind;
    text: string;
    mimeType: string;
    source?: "contest_preview";
    unverified?: true;
  }>;
  /** Chữ/âm có tệp trình diễn nhưng BỊ GIỮ LẠI vì cách đọc chưa kiểm chứng: giao diện nói đúng lý do, không phát. */
  held?: Array<{ kind: LearningUnitKind; text: string }>;
  /** Chế độ trình diễn đang cung cấp ít nhất một âm trên trang (để hiện nhãn nhỏ "Chế độ trình diễn"). */
  preview?: boolean;
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
  if (!parsed.success) return fail("AUDIO_NOT_AVAILABLE");

  // Bản ghi giáo viên ĐÃ DUYỆT luôn được ưu tiên; chỉ chữ/âm còn thiếu mới hỏi nguồn trình diễn (miền riêng, chỉ ở máy local).
  const have = new Set(parsed.data.map((unit) => `${unit.kind}:${unit.text}`));
  const missing = asked.flatMap((unit) => {
    const entry = have.has(`${unit.kind}:${unit.text}`) ? undefined : contestUnitEntry(unit.kind, unit.text);
    return entry ? [{ unit, entry }] : [];
  });
  const listed = await listContestAudio(
    context,
    studentId,
    missing.map((item) => item.entry),
  );
  if (!listed.ok || listed.data.length === 0) return ok({ muted: false, units: parsed.data });
  const units: LearningAudioDto["units"] = [...parsed.data];
  const held: NonNullable<LearningAudioDto["held"]> = [];
  for (const { unit, entry } of missing) {
    const found = listed.data.find((item) => item.entryId === entry.id);
    if (!found) continue;
    if (found.state === "held") held.push({ kind: unit.kind, text: unit.text });
    else {
      units.push({
        kind: unit.kind,
        text: unit.text,
        mimeType: found.mimeType,
        source: "contest_preview",
        ...(found.riskClass === "needs_verification" ? { unverified: true as const } : {}),
      });
    }
  }
  return ok({
    muted: false,
    units,
    ...(held.length > 0 ? { held } : {}),
    ...(units.some((unit) => unit.source === "contest_preview") ? { preview: true } : {}),
  });
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
  if (!resolved.ok) {
    // Chưa có bản ghi giáo viên đã duyệt (hoặc phát bản ghi đang TẮT) → thử tệp trình diễn của chính chữ/âm này (chỉ local). Lỗi khác
    // (thiết bị lạ, thiếu đồng ý, học sinh tắt âm…) giữ nguyên, không đi vòng.
    if (resolved.code !== "AUDIO_NOT_AVAILABLE" && resolved.code !== "AUDIO_PLAYBACK_DISABLED") return resolved;
    const info = learningUnitInfo(kind, text);
    const entry = info ? contestUnitEntry(info.kind, info.text) : undefined;
    if (!entry) return resolved;
    const preview = await loadContestAudio(context, studentId, entry);
    return preview.ok ? preview : resolved;
  }
  const object = await readAudioObject(resolved.data.storageKey);
  if (!object.ok) return fail(object.code === "STORAGE_UNAVAILABLE" ? "STORAGE_UNAVAILABLE" : "AUDIO_NOT_AVAILABLE");
  const bytes = object.data;
  const intact =
    bytes.byteLength === resolved.data.sizeBytes &&
    bytes.byteLength <= AUDIO_MAX_BYTES &&
    createHash("sha256").update(bytes).digest("hex") === resolved.data.contentHash;
  return intact ? ok({ bytes, mimeType: resolved.data.mimeType }) : fail("AUDIO_NOT_AVAILABLE");
}
