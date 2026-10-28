import "server-only";
import { z } from "zod";
import type { ReviewRow, VersionRow } from "@/features/tts-library/state";
import type { TeacherSession } from "@/server/auth/teacher";
import { fail, ok, type Result } from "@/server/result";
import { libraryProvider } from "./provider";

/**
 * Đọc dữ liệu thư viện giọng máy cho trang giáo viên bằng JWT của GV → RLS quyết định thấy gì (cùng trường).
 * KHÔNG chọn `storage_key`/`content_sha256`: đường dẫn lưu trữ không bao giờ rời máy chủ (nghe qua route proxy theo id).
 */

const reviewRow = z.object({
  entry_id: z.string(),
  content_hash: z.string(),
  decision: z.enum(["approved", "rejected"]),
  pronunciation_confirmed: z.boolean(),
});

const versionRow = z.object({
  id: z.uuid(),
  entry_id: z.string(),
  content_hash: z.string(),
  asset_key: z.string(),
  version_no: z.number().int(),
  status: z.enum(["pending_review", "approved", "rejected", "revoked", "superseded"]),
  test_only: z.boolean(),
  duration_ms: z.number().int(),
  review_note: z.string().nullable(),
  revoke_reason: z.string().nullable(),
  generated_at: z.string(),
});

const statusSchema = z.object({ library_enabled: z.boolean(), role: z.string() });

export type TtsLibraryData = {
  libraryEnabled: boolean;
  /** Đã đặt TTS_PROVIDER=viettel + token ở máy chủ (không lộ giá trị). */
  providerReady: boolean;
  reviews: ReviewRow[];
  versions: VersionRow[];
};

export async function loadTtsLibrary(teacher: TeacherSession): Promise<Result<TtsLibraryData>> {
  const { supabase } = teacher;
  const [status, reviews, versions] = await Promise.all([
    supabase.rpc("teacher_tts_status"),
    supabase.from("tts_script_reviews").select("entry_id, content_hash, decision, pronunciation_confirmed"),
    supabase
      .from("tts_audio_versions")
      .select(
        "id, entry_id, content_hash, asset_key, version_no, status, test_only, duration_ms, review_note, revoke_reason, generated_at",
      )
      .order("version_no", { ascending: false }),
  ]);
  if (status.error || reviews.error || versions.error) return fail("UNKNOWN");
  const parsedStatus = statusSchema.safeParse(status.data);
  const parsedReviews = z.array(reviewRow).safeParse(reviews.data);
  const parsedVersions = z.array(versionRow).safeParse(versions.data);
  if (!parsedStatus.success || !parsedReviews.success || !parsedVersions.success) return fail("UNKNOWN");
  return ok({
    libraryEnabled: parsedStatus.data.library_enabled,
    providerReady: libraryProvider().id !== "none",
    reviews: parsedReviews.data.map((row) => ({
      entryId: row.entry_id,
      contentHash: row.content_hash,
      decision: row.decision,
      pronunciationConfirmed: row.pronunciation_confirmed,
    })),
    versions: parsedVersions.data.map((row) => ({
      id: row.id,
      entryId: row.entry_id,
      contentHash: row.content_hash,
      assetKey: row.asset_key,
      versionNo: row.version_no,
      status: row.status,
      testOnly: row.test_only,
      durationMs: row.duration_ms,
      reviewNote: row.review_note,
      revokeReason: row.revoke_reason,
      generatedAt: row.generated_at,
    })),
  });
}
