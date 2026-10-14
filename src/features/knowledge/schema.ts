import { z } from "zod";
import { isNFC } from "../../lib/vietnamese/normalize.ts";
import { TONE_IDS } from "../../lib/vietnamese/tone.ts";

/**
 * Lược đồ zod cho dữ liệu kho tri thức trong content/ (docs/VIETNAMESE_ENGINE.md §2).
 *
 * Mọi đối tượng dùng `strictObject`: trường lạ (ví dụ một trường "họ tên học sinh" thêm nhầm)
 * làm hỏng kiểm tra thay vì bị bỏ qua. Mọi chuỗi phải ở dạng NFC.
 */

export const nfcText = z
  .string()
  .min(1, "Không được để trống")
  .refine(isNFC, { message: "Chuỗi phải ở dạng Unicode NFC" });

export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày phải theo định dạng YYYY-MM-DD");

/** Trạng thái kiểm duyệt nội dung. Không có nội dung tự sinh nào mặc định là `approved`. */
export const REVIEW_STATUSES = ["draft", "pending_review", "approved", "rejected"] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

export const reviewSchema = z
  .strictObject({
    status: z.enum(REVIEW_STATUSES),
    /** Người duyệt (giáo viên). Bắt buộc khi `approved`; không được là AI/hệ thống. */
    reviewedBy: nfcText.optional(),
    reviewedAt: isoDate.optional(),
    /** SHA-256 của nội dung tại thời điểm duyệt — nội dung đổi sau khi duyệt sẽ bị phát hiện. */
    contentHash: z
      .string()
      .regex(/^[0-9a-f]{64}$/u, "contentHash phải là SHA-256 dạng hex")
      .optional(),
    note: nfcText.optional(),
  })
  .superRefine((review, ctx) => {
    if (review.status !== "approved") return;
    for (const field of ["reviewedBy", "reviewedAt", "contentHash"] as const) {
      if (!review[field]) {
        ctx.addIssue({ code: "custom", path: [field], message: `Nội dung đã duyệt phải có ${field}` });
      }
    }
  });
export type Review = z.infer<typeof reviewSchema>;

export const PROVENANCE_ORIGINS = ["ai_assisted", "project_team", "teacher", "standard_reference"] as const;
export const provenanceSchema = z.strictObject({
  /** `ai_assisted`: do trợ lý AI soạn (cần GV duyệt); `standard_reference`: dữ kiện chuẩn (bảng chữ cái…). */
  origin: z.enum(PROVENANCE_ORIGINS),
  author: nfcText,
  createdAt: isoDate,
  note: nfcText.optional(),
});
export type Provenance = z.infer<typeof provenanceSchema>;

/** Một cách gọi do hệ thống đề xuất, CHƯA được giáo viên xác nhận cho tới khi mục được duyệt. */
const proposedLabelSchema = z.strictObject({
  proposed: nfcText,
  alternatives: z.array(nfcText).optional(),
  note: nfcText.optional(),
});

const difficultySchema = z.int().min(1).max(5);
const versionSchema = z.int().min(1);

/** Tiêu đề chung của mọi tệp dữ liệu. */
function fileSchema<Item extends z.ZodType>(kind: string, item: Item) {
  return z.strictObject({
    kind: z.literal(kind),
    description: nfcText,
    review: reviewSchema,
    provenance: provenanceSchema,
    items: z.array(item).min(1),
  });
}

// ---------------------------------------------------------------------------
// Lớp 1 — kiến thức ngôn ngữ nền tảng (content/kb)
// ---------------------------------------------------------------------------

export const letterSchema = z.strictObject({
  id: z.string().regex(/^letter:\p{Ll}$/u),
  lower: nfcText,
  upper: nfcText,
  order: z.int().min(1).max(29),
  letterClass: z.enum(["vowel", "consonant"]),
  /** Tên chữ cái (khi đọc bảng chữ cái) — khác với cách gọi âm khi đánh vần. */
  name: proposedLabelSchema,
  note: nfcText.optional(),
});
export type Letter = z.infer<typeof letterSchema>;

export const PHONEME_POSITIONS = ["onset", "medial", "nucleus", "coda"] as const;
export const phonemeSchema = z.strictObject({
  id: z.string().regex(/^phoneme:\p{Ll}{1,3}$/u),
  text: nfcText,
  letters: z
    .array(z.string().regex(/^letter:/u))
    .min(1)
    .max(3),
  phonemeClass: z.enum(["vowel", "consonant"]),
  graphemeType: z.enum(["single", "digraph", "trigraph"]),
  positions: z.array(z.enum(PHONEME_POSITIONS)).min(1),
  /** Cách gọi âm khi dạy đánh vần (ví dụ "bờ") — quy ước của lớp, cần GV xác nhận. */
  teachingLabel: proposedLabelSchema,
  /** Nhóm chữ ghi cùng một âm theo vị trí (c/k/q, g/gh, ng/ngh, i/y). */
  soundGroup: nfcText.optional(),
  spellingRule: z.string().optional(),
  note: nfcText.optional(),
});
export type Phoneme = z.infer<typeof phonemeSchema>;

export const toneSchema = z.strictObject({
  id: z.string().regex(/^tone:[a-z]+$/u),
  toneId: z.enum(TONE_IDS),
  name: nfcText,
  markName: nfcText,
  /** Mã Unicode của dấu tổ hợp, ví dụ "U+0300"; `null` với thanh ngang. */
  combiningMark: z
    .string()
    .regex(/^U\+[0-9A-F]{4}$/u)
    .nullable(),
  markPosition: z.enum(["none", "above", "below"]),
  example: nfcText,
  allowedWithStopCoda: z.boolean(),
});
export type Tone = z.infer<typeof toneSchema>;

export const rimeSchema = z.strictObject({
  id: z.string().regex(/^rime:\p{Ll}+$/u),
  text: nfcText,
  medial: z.enum(["o", "u"]).optional(),
  nucleus: nfcText,
  coda: nfcText.optional(),
  note: nfcText.optional(),
});
export type Rime = z.infer<typeof rimeSchema>;

export const ruleSchema = z.strictObject({
  id: z.string().regex(/^[a-z]+\.[a-z_]+$/u),
  ruleType: z.enum(["spelling", "tone", "tone_placement", "syllable_structure"]),
  /** `established`: quy tắc chính tả chắc chắn → lỗi; `convention`: quy ước cần GV xác nhận → cảnh báo. */
  certainty: z.enum(["established", "convention"]),
  title: nfcText,
  description: nfcText,
  spec: z.record(z.string(), z.unknown()).optional(),
  /** Mã lỗi/cảnh báo mà bộ máy trả về khi quy tắc bị vi phạm. */
  detectedBy: z.array(z.string().regex(/^[A-Z_]+$/u)).min(1),
  examples: z.array(nfcText),
  counterExamples: z.array(z.strictObject({ text: nfcText, expectedCode: z.string().regex(/^[A-Z_]+$/u) })),
});
export type Rule = z.infer<typeof ruleSchema>;

export const confusionSchema = z.strictObject({
  id: z.string().regex(/^confusion:[\p{Ll}-]+$/u),
  units: z.array(z.string()).length(2),
  confusionType: z.enum(["visual", "sound", "spelling", "tone"]),
  dialectDependent: z.boolean(),
  note: nfcText,
});
export type Confusion = z.infer<typeof confusionSchema>;

export const prerequisiteSchema = z.strictObject({
  unit: z.string(),
  requires: z.array(z.string()).min(1),
  basis: z.enum(["pedagogical", "orthographic"]),
  note: nfcText,
});
export type PrerequisiteEdge = z.infer<typeof prerequisiteSchema>;

export const topicSchema = z.strictObject({
  id: z.string().regex(/^topic:[a-z_]+$/u),
  label: nfcText,
});
export type Topic = z.infer<typeof topicSchema>;

/** Trường chung của ngữ liệu (tiếng, từ, câu): mỗi mục được duyệt riêng. */
const corpusItemFields = {
  text: nfcText,
  /** Độ khó dự kiến (1–5) do người soạn ghi; bộ kiểm tra so với ước lượng theo cấu tạo. */
  difficulty: difficultySchema,
  review: reviewSchema,
  version: versionSchema,
  provenance: provenanceSchema.optional(),
  note: nfcText.optional(),
};

export const syllableItemSchema = z.strictObject({
  id: z.string().regex(/^syllable:\p{Ll}+$/u),
  ...corpusItemFields,
  /**
   * Phân tích do người soạn khai báo — bộ kiểm tra đối chiếu với kết quả của bộ phân tích.
   * `null` khi chưa thể phân tích chắc chắn (phụ thuộc quy ước chưa xác nhận); khi đó bộ phân tích
   * cũng phải trả về "chưa xác định".
   */
  expected: z
    .strictObject({
      onset: nfcText.nullable(),
      rime: nfcText,
      tone: z.enum(TONE_IDS),
    })
    .nullable(),
});
export type SyllableItem = z.infer<typeof syllableItemSchema>;

export const wordItemSchema = z.strictObject({
  id: z.string().regex(/^word:[\p{Ll}-]+$/u),
  ...corpusItemFields,
  topics: z.array(z.string().regex(/^topic:/u)).min(1),
  /** Độ quen thuộc ƯỚC LƯỢNG với trẻ lớp 1 (không phải dữ liệu về một học sinh cụ thể). */
  familiarity: z.enum(["everyday", "common", "less_common"]),
  /** Có thể minh họa rõ nghĩa bằng một hình (cần cho dạng bài đọc từ – chọn hình). */
  imageable: z.boolean(),
  meaningNote: nfcText.optional(),
});
export type WordItem = z.infer<typeof wordItemSchema>;

export const sentenceItemSchema = z.strictObject({
  id: z.string().regex(/^sentence:\d{3}$/u),
  ...corpusItemFields,
  topics: z.array(z.string().regex(/^topic:/u)).min(1),
  /** Câu hỏi đọc hiểu gợi ý cho GV (không phải đáp án tự động). */
  comprehensionFocus: nfcText.optional(),
  /** Tên riêng trong câu — phải là nhân vật hư cấu, không phải tên học sinh thật. */
  properNouns: z.array(nfcText).optional(),
});
export type SentenceItem = z.infer<typeof sentenceItemSchema>;

export const lettersFileSchema = fileSchema("letters", letterSchema);
export const phonemesFileSchema = fileSchema("phonemes", phonemeSchema);
export const tonesFileSchema = fileSchema("tones", toneSchema);
export const rimesFileSchema = fileSchema("rimes", rimeSchema);
export const rulesFileSchema = fileSchema("rules", ruleSchema);
export const confusionsFileSchema = fileSchema("confusions", confusionSchema);
export const prerequisitesFileSchema = fileSchema("prerequisites", prerequisiteSchema);
export const topicsFileSchema = fileSchema("topics", topicSchema);
export const syllablesFileSchema = fileSchema("syllables", syllableItemSchema);
export const wordsFileSchema = fileSchema("words", wordItemSchema);
export const sentencesFileSchema = fileSchema("sentences", sentenceItemSchema);

export const manifestSchema = z.strictObject({
  datasetVersion: z.string().regex(/^\d+\.\d+\.\d+$/u),
  updatedAt: isoDate,
  description: nfcText,
});

// ---------------------------------------------------------------------------
// Lớp 2 — tiến độ học tập (content/curriculum)
// ---------------------------------------------------------------------------

export const lessonSchema = z.strictObject({
  ordinal: z.int().min(1),
  code: nfcText,
  title: nfcText,
  lessonType: z.enum(["new_units", "review", "reading", "other"]),
  /** Đơn vị được giới thiệu ở bài này — tập "đã học" tính từ trường này. */
  introduces: z.array(z.string()),
  reviews: z.array(z.string()),
});
export type Lesson = z.infer<typeof lessonSchema>;

export const seriesSchema = z.strictObject({
  id: z.string().regex(/^series:[a-z0-9-]+$/u),
  /** `textbook`: thứ tự bài của một bộ sách (chỉ dữ kiện, có nguồn); `illustrative`: chuỗi minh họa để kiểm thử. */
  seriesKind: z.enum(["textbook", "illustrative", "teacher_custom"]),
  title: nfcText,
  description: nfcText,
  source: nfcText.nullable(),
  lessons: z.array(lessonSchema).min(1),
  review: reviewSchema,
  provenance: provenanceSchema,
  version: versionSchema,
});
export type Series = z.infer<typeof seriesSchema>;

export const conventionsSchema = z.strictObject({
  quAnalysis: z.enum(["qu_onset"]).nullable(),
  giAnalysis: z.enum(["gi_onset"]).nullable(),
  giSharedI: z.enum(["shared_i"]).nullable(),
  tonePlacement: z.enum(["on_main_vowel", "traditional", "either"]).nullable(),
});

export const PROFILE_STATUSES = ["unconfirmed", "confirmed", "illustrative"] as const;
export type ProfileStatus = (typeof PROFILE_STATUSES)[number];

export const profileSchema = z
  .strictObject({
    id: z.string().regex(/^profile:[a-z0-9-]+$/u),
    /** Tên lớp (không phải dữ liệu học sinh). */
    classLabel: nfcText,
    /** `unconfirmed`: chưa được GV xác nhận — không dùng để giao bài thật. */
    status: z.enum(PROFILE_STATUSES),
    seriesId: z.string().nullable(),
    currentLessonOrdinal: z.int().min(1).nullable(),
    /** Đơn vị lớp đã học ngoài bộ sách (GV thêm). */
    additionalTaughtUnits: z.array(z.string()),
    /** Đơn vị trong bộ sách nhưng lớp chưa học (GV bớt). */
    excludedUnits: z.array(z.string()),
    /** Đơn vị GV muốn tập trung ôn tập. */
    reviewFocusUnits: z.array(z.string()),
    /** Đơn vị chưa học mà GV cho phép Nhóm 1 (extending) dùng. */
    extendingAllowedUnits: z.array(z.string()),
    conventions: conventionsSchema,
    confirmation: z.strictObject({ confirmedBy: nfcText, confirmedAt: isoDate }).nullable(),
    notes: nfcText,
    updatedAt: isoDate,
    version: versionSchema,
  })
  .superRefine((profile, ctx) => {
    if (profile.status === "confirmed" && profile.confirmation === null) {
      ctx.addIssue({
        code: "custom",
        path: ["confirmation"],
        message: "Hồ sơ đã xác nhận phải có người và ngày xác nhận",
      });
    }
  });
export type CurriculumProfile = z.infer<typeof profileSchema>;
