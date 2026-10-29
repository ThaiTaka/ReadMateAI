import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import { AUDIO_MAX_BYTES } from "@/features/audio-library/limits";
import type { ContestEntry } from "@/features/contest-audio/catalog";
import { isContestPreviewEnvironment } from "@/features/contest-audio/environment";
import { resolvedAudioSchema, type ResolvedAudio } from "@/server/audio-playback/resolve";
import { fail, mapDbError, ok, type Result } from "@/server/result";
import type { StudentContext } from "@/server/student-gateway/context";
import { readContestObject } from "./storage";

/**
 * Phát âm thanh TRÌNH DIỄN cho học sinh hư cấu (docs/CONTEST_AUDIO.md). ĐỌC THÔI: không gọi nhà cung cấp, không tạo, không duyệt.
 *
 *  - Chỉ chạy ở môi trường local (`isContestPreviewEnvironment`); ngoài ra trả "không có" mà không hỏi CSDL.
 *  - Hàm CSDL `gateway_resolve_contest_audio` kiểm lại MỌI điều kiện ở mỗi lần phát: chế độ + cổng local đang BẬT, thiết bị liên kết đúng
 *    học sinh, đồng ý learning_data, cùng trường, tệp chưa thu hồi, băm nội dung + khóa tệp khớp danh mục hiện hành, và mục rủi ro cách
 *    đọc (needs_verification) chỉ phát khi cờ riêng bật.
 *  - Tệp đọc từ bucket riêng `contest-audio`, đối chiếu kích thước + SHA-256 với metadata. Không URL công khai/URL ký.
 *  - Đây KHÔNG phải chính sách chống lộ đáp án: nơi gọi (câu lệnh, phản hồi, Học tập) tự áp chính sách của nó TRƯỚC khi gọi.
 */

export type ContestResolved = ResolvedAudio & { riskClass: "standard" | "needs_verification" };

const resolvedSchema = resolvedAudioSchema.extend({ riskClass: z.enum(["standard", "needs_verification"]) });

const listSchema = z.array(
  z.object({
    entryId: z.string().min(3).max(80),
    state: z.enum(["playable", "held"]),
    mimeType: z.string().min(1),
    riskClass: z.enum(["standard", "needs_verification"]),
  }),
);
export type ContestListItem = z.infer<typeof listSchema>[number];

const args = (context: StudentContext, studentId: string, entry: ContestEntry) => ({
  p_auth_user_id: context.authUserId,
  p_student_id: studentId,
  p_entry_id: entry.id,
  p_content_hash: entry.contentHash,
  p_asset_key: entry.assetKey,
});

export async function resolveContestAudio(
  context: StudentContext,
  studentId: string,
  entry: ContestEntry,
): Promise<Result<ContestResolved>> {
  if (!isContestPreviewEnvironment(process.env)) return fail("AUDIO_NOT_AVAILABLE");
  const resolved = await context.admin.rpc("gateway_resolve_contest_audio", args(context, studentId, entry));
  if (resolved.error) return fail(mapDbError(resolved.error));
  const parsed = resolvedSchema.safeParse(resolved.data);
  return parsed.success ? ok(parsed.data) : fail("AUDIO_NOT_AVAILABLE");
}

export async function loadContestAudio(
  context: StudentContext,
  studentId: string,
  entry: ContestEntry,
): Promise<Result<{ bytes: Uint8Array<ArrayBuffer>; mimeType: string }>> {
  const resolved = await resolveContestAudio(context, studentId, entry);
  if (!resolved.ok) return resolved;
  const object = await readContestObject(resolved.data.storageKey);
  if (!object.ok) return fail(object.code === "STORAGE_UNAVAILABLE" ? "STORAGE_UNAVAILABLE" : "AUDIO_NOT_AVAILABLE");
  const bytes = object.data;
  const intact =
    bytes.byteLength === resolved.data.sizeBytes &&
    bytes.byteLength <= AUDIO_MAX_BYTES &&
    createHash("sha256").update(bytes).digest("hex") === resolved.data.contentHash;
  return intact ? ok({ bytes, mimeType: resolved.data.mimeType }) : fail("AUDIO_NOT_AVAILABLE");
}

/** Mục nào có tệp trình diễn ngay bây giờ (phát được hoặc bị giữ vì rủi ro cách đọc). Chế độ tắt / không phải local → rỗng, không lỗi. */
export async function listContestAudio(
  context: StudentContext,
  studentId: string,
  entries: readonly ContestEntry[],
): Promise<Result<ContestListItem[]>> {
  if (!isContestPreviewEnvironment(process.env) || entries.length === 0) return ok([]);
  const { data, error } = await context.admin.rpc("gateway_list_contest_audio", {
    p_auth_user_id: context.authUserId,
    p_student_id: studentId,
    p_units: entries.map((entry) => ({ entryId: entry.id, contentHash: entry.contentHash, assetKey: entry.assetKey })),
  });
  if (error) return fail(mapDbError(error));
  const parsed = listSchema.safeParse(data);
  return parsed.success ? ok(parsed.data) : fail("AUDIO_NOT_AVAILABLE");
}

/** Chế độ trình diễn có đang phát được gì cho học sinh này không (để hiện nhãn "Chế độ trình diễn"). */
export function contestPreviewVisible(items: readonly ContestListItem[]): boolean {
  return items.length > 0;
}
