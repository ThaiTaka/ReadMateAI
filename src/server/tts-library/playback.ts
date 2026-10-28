import "server-only";
import { createHash } from "node:crypto";
import { AUDIO_MAX_BYTES } from "@/features/audio-library/limits";
import { decideBeforeGrading } from "@/features/exercises/core/audio";
import type { ExerciseItem } from "@/features/exercises/items";
import { VARIANTS } from "@/features/exercises/runtime-registry";
import {
  publicAudioCode,
  resolvedAudioSchema,
  supportLevelOf,
  type ResolvedAudio,
} from "@/server/audio-playback/resolve";
import { fail, mapDbError, ok, type Result } from "@/server/result";
import type { StudentContext } from "@/server/student-gateway/context";
import { instructionEntryId, libraryEntry } from "./entries";
import { readTtsObject } from "./storage";

/**
 * Phát CÂU LỆNH bằng giọng máy ĐÃ DUYỆT cho học sinh (R10.5; docs/AUDIO_ENGINE.md §17). Đường phát này KHÔNG gọi nhà cung cấp, KHÔNG
 * import `provider.ts`, không tạo âm thanh: chỉ đọc tệp đã tạo từ trước, đã được giáo viên nghe và duyệt.
 *
 *  - Câu lệnh suy ra từ chính câu (biến thể → `instruction:<biến thể>`); trình duyệt không gửi mã tài nguyên/đường dẫn/chữ.
 *  - Chính sách chống lộ đáp án (AD-35) dùng lại `decideBeforeGrading` của khe `instruction`: H3/H2 phát được; H1 chỉ qua "Trợ giúp"
 *    (chưa có đường ghi nhận gợi ý bằng âm thanh → khóa); H0 không phát.
 *  - Hàm CSDL `gateway_resolve_tts_line` kiểm lại MỌI điều kiện ở mỗi yêu cầu (cờ, thiết bị, đồng ý, trường, bản approved đang dùng
 *    khớp bản băm chữ + khóa giọng hiện hành, lời đọc còn được duyệt). Không bộ nhớ đệm; tệp đối chiếu kích thước + SHA-256.
 */

type QuestionFacts = { id: string; student_id: string; status: string; support_level: number };

export async function resolveInstructionAudio(
  context: StudentContext,
  question: QuestionFacts,
  item: ExerciseItem,
): Promise<Result<ResolvedAudio>> {
  const entry = libraryEntry(instructionEntryId(item.variant));
  if (!entry) return fail("AUDIO_NOT_AVAILABLE");
  const student = context.students.find((candidate) => candidate.id === question.student_id);
  if (!student) return fail("FORBIDDEN");
  if (question.status === "void") return fail("AUDIO_NOT_PERMITTED");
  if (student.soundPreference === "off") return fail("AUDIO_NOT_PERMITTED");

  const decision = decideBeforeGrading(
    VARIANTS[item.variant].audioPolicy,
    "instruction",
    supportLevelOf(question.support_level),
  );
  if (!decision.permitted || decision.countsAsHint) return fail("AUDIO_NOT_PERMITTED");

  const resolved = await context.admin.rpc("gateway_resolve_tts_line", {
    p_auth_user_id: context.authUserId,
    p_student_id: question.student_id,
    p_entry_id: entry.id,
    p_content_hash: entry.contentHash,
    p_asset_key: entry.assetKey,
  });
  if (resolved.error) return fail(publicAudioCode(mapDbError(resolved.error)));
  const parsed = resolvedAudioSchema.safeParse(resolved.data);
  return parsed.success ? ok(parsed.data) : fail("AUDIO_NOT_AVAILABLE");
}

export async function loadInstructionAudio(
  context: StudentContext,
  question: QuestionFacts,
  item: ExerciseItem,
): Promise<Result<{ bytes: Uint8Array<ArrayBuffer>; mimeType: string }>> {
  const resolved = await resolveInstructionAudio(context, question, item);
  if (!resolved.ok) return resolved;
  const object = await readTtsObject(resolved.data.storageKey);
  if (!object.ok) return fail(object.code === "STORAGE_UNAVAILABLE" ? "STORAGE_UNAVAILABLE" : "AUDIO_NOT_AVAILABLE");
  const bytes = object.data;
  const intact =
    bytes.byteLength === resolved.data.sizeBytes &&
    bytes.byteLength <= AUDIO_MAX_BYTES &&
    createHash("sha256").update(bytes).digest("hex") === resolved.data.contentHash;
  return intact ? ok({ bytes, mimeType: resolved.data.mimeType }) : fail("AUDIO_NOT_AVAILABLE");
}
