import "server-only";
import { createHash } from "node:crypto";
import { AUDIO_MAX_BYTES } from "@/features/audio-library/limits";
import { feedbackRefAllowed } from "@/features/audio-playback/feedback-lines";
import { decideAfterGrading, decideBeforeGrading } from "@/features/exercises/core/audio";
import type { ExerciseItem } from "@/features/exercises/items";
import { VARIANTS } from "@/features/exercises/runtime-registry";
import { contestEntry } from "@/server/contest-audio/catalog";
import { loadContestAudio, resolveContestAudio } from "@/server/contest-audio/playback";
import {
  publicAudioCode,
  resolvedAudioSchema,
  supportLevelOf,
  type ResolvedAudio,
} from "@/server/audio-playback/resolve";
import { fail, mapDbError, ok, type Result } from "@/server/result";
import type { StudentContext } from "@/server/student-gateway/context";
import { instructionEntryId, libraryEntry, type LibraryEntry } from "./entries";
import { readTtsObject } from "./storage";

/**
 * Phát CÂU LỆNH và LỜI PHẢN HỒI bằng giọng máy cho học sinh (R10.5; docs/AUDIO_ENGINE.md §17). Đường phát này KHÔNG gọi nhà cung cấp,
 * KHÔNG import `provider.ts`, không tạo âm thanh: chỉ đọc tệp đã tạo từ trước.
 *
 *  - Nguồn thứ nhất: tệp thư viện ĐÃ DUYỆT (giáo viên đã nghe + xác nhận cách đọc). Nguồn thứ hai, CHỈ khi nguồn thứ nhất không có và
 *    chỉ ở máy local: tệp CHẾ ĐỘ TRÌNH DIỄN (docs/CONTEST_AUDIO.md) — miền dữ liệu riêng, nguồn `ai_generated`/`contest_preview`, chưa ai
 *    duyệt. Hai nguồn không bao giờ trộn trạng thái: kết quả luôn nói rõ `origin`.
 *  - Câu lệnh/lời phản hồi suy ra từ chính câu; trình duyệt không gửi mã tài nguyên/đường dẫn/chữ. Riêng lời phản hồi, trình duyệt gửi mã
 *    dòng (`audioRef`) nhưng máy chủ đối chiếu với TRẠNG THÁI THẬT của câu (feedback-lines.ts).
 *  - Chính sách chống lộ đáp án (AD-35) dùng lại `decideBeforeGrading`/`decideAfterGrading`. Chính sách chạy TRƯỚC mọi truy vấn nguồn, nên
 *    nguồn trình diễn không thể phát thứ mà chính sách cấm.
 *  - Hàm CSDL kiểm lại MỌI điều kiện ở mỗi yêu cầu. Không bộ nhớ đệm; tệp đối chiếu kích thước + SHA-256.
 */

export type LineOrigin = "tts_library" | "contest_preview";
export type LineAudio = ResolvedAudio & { origin: LineOrigin };

type QuestionFacts = {
  id: string;
  student_id: string;
  status: string;
  support_level: number;
  /** Chỉ lời phản hồi cần số lượt đã dùng (đối chiếu trạng thái thật của câu). */
  attempts_used?: number;
};

async function resolveLibraryLine(
  context: StudentContext,
  question: QuestionFacts,
  entry: LibraryEntry,
): Promise<Result<LineAudio>> {
  const resolved = await context.admin.rpc("gateway_resolve_tts_line", {
    p_auth_user_id: context.authUserId,
    p_student_id: question.student_id,
    p_entry_id: entry.id,
    p_content_hash: entry.contentHash,
    p_asset_key: entry.assetKey,
  });
  const original: Result<LineAudio> = resolved.error
    ? fail(publicAudioCode(mapDbError(resolved.error)))
    : (() => {
        const parsed = resolvedAudioSchema.safeParse(resolved.data);
        return parsed.success ? ok({ ...parsed.data, origin: "tts_library" as const }) : fail("AUDIO_NOT_AVAILABLE");
      })();
  if (original.ok) return original;

  // Không có bản đã duyệt → thử nguồn trình diễn (chỉ local, chỉ khi cờ riêng bật; nguồn này tự kiểm lại thiết bị/đồng ý).
  const contest = contestEntry(entry.id);
  if (!contest) return original;
  const preview = await resolveContestAudio(context, question.student_id, contest);
  return preview.ok ? ok({ ...preview.data, origin: "contest_preview" as const }) : original;
}

export async function resolveInstructionAudio(
  context: StudentContext,
  question: QuestionFacts,
  item: ExerciseItem,
): Promise<Result<LineAudio>> {
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
  return resolveLibraryLine(context, question, entry);
}

/**
 * Lời phản hồi sau khi trả lời. `ref` là mã dòng trên khung phản hồi; máy chủ chỉ phát khi dòng khớp trạng thái thật của câu
 * (đúng → lời khen, còn lượt → lời nhắc, hết lượt → tiêu đề xem đáp án) và chính sách cho phép phản hồi.
 */
export async function resolveFeedbackAudio(
  context: StudentContext,
  question: QuestionFacts,
  item: ExerciseItem,
  ref: string,
): Promise<Result<LineAudio>> {
  const entry = libraryEntry(`feedback:${ref}`);
  if (!entry) return fail("AUDIO_NOT_AVAILABLE");
  const student = context.students.find((candidate) => candidate.id === question.student_id);
  if (!student) return fail("FORBIDDEN");
  if (question.status === "void") return fail("AUDIO_NOT_PERMITTED");
  if (student.soundPreference === "off") return fail("AUDIO_NOT_PERMITTED");
  if (!feedbackRefAllowed(ref, { status: question.status, attemptsUsed: question.attempts_used ?? 0 })) {
    return fail("AUDIO_NOT_PERMITTED");
  }
  if (!decideAfterGrading(VARIANTS[item.variant].audioPolicy, "feedback")) return fail("AUDIO_NOT_PERMITTED");
  return resolveLibraryLine(context, question, entry);
}

async function readLine(
  context: StudentContext,
  question: QuestionFacts,
  resolved: LineAudio,
  contestId: string,
): Promise<Result<{ bytes: Uint8Array<ArrayBuffer>; mimeType: string }>> {
  if (resolved.origin === "contest_preview") {
    const contest = contestEntry(contestId);
    if (!contest) return fail("AUDIO_NOT_AVAILABLE");
    const loaded = await loadContestAudio(context, question.student_id, contest);
    return loaded.ok ? loaded : fail(publicAudioCode(loaded.code));
  }
  const object = await readTtsObject(resolved.storageKey);
  if (!object.ok) return fail(object.code === "STORAGE_UNAVAILABLE" ? "STORAGE_UNAVAILABLE" : "AUDIO_NOT_AVAILABLE");
  const bytes = object.data;
  const intact =
    bytes.byteLength === resolved.sizeBytes &&
    bytes.byteLength <= AUDIO_MAX_BYTES &&
    createHash("sha256").update(bytes).digest("hex") === resolved.contentHash;
  return intact ? ok({ bytes, mimeType: resolved.mimeType }) : fail("AUDIO_NOT_AVAILABLE");
}

export async function loadInstructionAudio(
  context: StudentContext,
  question: QuestionFacts,
  item: ExerciseItem,
): Promise<Result<{ bytes: Uint8Array<ArrayBuffer>; mimeType: string }>> {
  const resolved = await resolveInstructionAudio(context, question, item);
  if (!resolved.ok) return resolved;
  return readLine(context, question, resolved.data, instructionEntryId(item.variant));
}

export async function loadFeedbackAudio(
  context: StudentContext,
  question: QuestionFacts,
  item: ExerciseItem,
  ref: string,
): Promise<Result<{ bytes: Uint8Array<ArrayBuffer>; mimeType: string }>> {
  const resolved = await resolveFeedbackAudio(context, question, item, ref);
  if (!resolved.ok) return resolved;
  return readLine(context, question, resolved.data, `feedback:${ref}`);
}
