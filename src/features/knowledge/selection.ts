import type { Band } from "../../types/learning.ts";
import type { KnowledgeBase } from "./load.ts";
import { checkReadability, type ReadabilityVerdict } from "./readability.ts";
import type { CurriculumProfile, ReviewStatus, SentenceItem, SyllableItem, WordItem } from "./schema.ts";

/**
 * Chọn ngữ liệu theo hồ sơ lớp — điểm chặn "chỉ nội dung đã duyệt" cho các giai đoạn sau.
 *
 * - `assignment` (giao bài thật): bắt buộc hồ sơ ĐÃ ĐƯỢC GV XÁC NHẬN và chỉ trả về mục `approved`.
 * - `preview` (GV xem trước, demo, kiểm thử): trả về mọi mục chưa bị từ chối, kèm trạng thái duyệt.
 */

export type CorpusKind = "syllable" | "word" | "sentence";
export type SelectionPurpose = "assignment" | "preview";
export type CorpusItem = SyllableItem | WordItem | SentenceItem;

export type SelectedItem = {
  item: CorpusItem;
  kind: CorpusKind;
  reviewStatus: ReviewStatus;
  verdict: ReadabilityVerdict;
};

export type SelectionResult =
  | {
      ok: true;
      purpose: SelectionPurpose;
      items: SelectedItem[];
      /** Số mục bị loại vì trạng thái duyệt (để GV biết còn bao nhiêu mục chờ duyệt). */
      excludedByReview: Record<ReviewStatus, number>;
    }
  | { ok: false; code: "PROFILE_NOT_CONFIRMED"; message: string };

export type SelectionOptions = {
  profile: CurriculumProfile;
  purpose: SelectionPurpose;
  kind: CorpusKind;
  band?: Band;
  lessonOrdinal?: number;
  /** Chỉ giữ mục có kết luận này (mặc định: `readable`). `null` = giữ mọi kết luận. */
  verdict?: ReadabilityVerdict | null;
};

export function corpusOf(kb: KnowledgeBase, kind: CorpusKind): readonly CorpusItem[] {
  return kind === "syllable" ? kb.syllables : kind === "word" ? kb.words : kb.sentences;
}

export function selectCorpusItems(kb: KnowledgeBase, options: SelectionOptions): SelectionResult {
  if (options.purpose === "assignment" && options.profile.status !== "confirmed") {
    return {
      ok: false,
      code: "PROFILE_NOT_CONFIRMED",
      message: "Chỉ hồ sơ lớp đã được giáo viên xác nhận mới được dùng để giao bài.",
    };
  }
  const wanted = options.verdict === undefined ? "readable" : options.verdict;
  const excludedByReview: Record<ReviewStatus, number> = { draft: 0, pending_review: 0, approved: 0, rejected: 0 };
  const items: SelectedItem[] = [];

  for (const item of corpusOf(kb, options.kind)) {
    const status = item.review.status;
    const allowed = options.purpose === "assignment" ? status === "approved" : status !== "rejected";
    if (!allowed) {
      excludedByReview[status] += 1;
      continue;
    }
    const report = checkReadability(kb, item.text, {
      profile: options.profile,
      ...(options.band !== undefined ? { band: options.band } : {}),
      ...(options.lessonOrdinal !== undefined ? { lessonOrdinal: options.lessonOrdinal } : {}),
    });
    if (wanted !== null && report.verdict !== wanted) continue;
    items.push({ item, kind: options.kind, reviewStatus: status, verdict: report.verdict });
  }
  return { ok: true, purpose: options.purpose, items, excludedByReview };
}
