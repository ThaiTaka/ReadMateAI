import { z } from "zod";
import type { TtsScriptEntry } from "./catalog.ts";

/**
 * Duyệt LỜI ĐỌC (chữ + mục đích + cách đọc) — bước 1 trong hai bước duyệt của TTS (docs/AUDIO_ENGINE.md §14.3).
 * Bước 2 (nghe và duyệt tệp âm thanh) nằm ở versions.ts. HÀM THUẦN.
 *
 * Không có hàm nào ở đây TẠO bản duyệt: bản duyệt là dữ liệu do giáo viên đặt (sau này qua hàm CSDL có kiểm tra quyền).
 * Mục mới dựng luôn `pending_review`; chỉ một bản duyệt `approved` KHỚP `contentHash` hiện tại, có người duyệt và thời điểm,
 * có xác nhận cách đọc mới đưa mục sang `approved`. Đổi chữ → hash khác → bản duyệt cũ không còn hiệu lực.
 */

export type TtsScriptStatus = "pending_review" | "approved" | "rejected";

export const ttsScriptReviewSchema = z.strictObject({
  entryId: z.string().min(1),
  contentHash: z.string().regex(/^[0-9a-f]{64}$/u),
  decision: z.enum(["approved", "rejected"]),
  reviewedBy: z.uuid(),
  reviewedAt: z.iso.datetime(),
  /** Giáo viên đã xác nhận cách đọc (xưng hô, cách đọc từ) — bắt buộc để duyệt. */
  pronunciationConfirmed: z.boolean(),
});
export type TtsScriptReview = z.infer<typeof ttsScriptReviewSchema>;

export function scriptStatusOf(entry: TtsScriptEntry, reviews: readonly unknown[]): TtsScriptStatus {
  let latest: TtsScriptReview | null = null;
  for (const raw of reviews) {
    const parsed = ttsScriptReviewSchema.safeParse(raw);
    if (!parsed.success) continue;
    const review = parsed.data;
    if (review.entryId !== entry.id || review.contentHash !== entry.contentHash) continue;
    if (latest === null || Date.parse(review.reviewedAt) >= Date.parse(latest.reviewedAt)) latest = review;
  }
  if (latest === null) return "pending_review";
  if (latest.decision === "rejected") return "rejected";
  return latest.pronunciationConfirmed ? "approved" : "pending_review";
}
