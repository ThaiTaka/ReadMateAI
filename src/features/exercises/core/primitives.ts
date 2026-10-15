import type { z } from "zod";
import type { UnitId } from "../../../lib/vietnamese/decodability.ts";
import { toLowerVi } from "../../../lib/vietnamese/normalize.ts";
import type { ToneId } from "../../../lib/vietnamese/tone.ts";
import type {
  audioSlotSchema,
  buildResponseSchema,
  choiceResponseSchema,
  itemAudioSchema,
  matchResponseSchema,
  multiResponseSchema,
  objectiveSchema,
  orderResponseSchema,
  pictureOptionSchema,
  pictureRefSchema,
  responseSchema,
  textOptionSchema,
} from "./schemas.ts";

/**
 * Kiểu và hàm trợ giúp dùng chung cho mọi dạng bài (docs/EXERCISE_ENGINE.md §3) — KHÔNG import zod khi chạy
 * (chỉ import kiểu), để phần chạy trên trình duyệt nhẹ. Lược đồ zod nằm ở schemas.ts.
 */

/** Phương án dạng chữ: chữ cái/âm, vần, tiếng, từ hoặc dấu thanh. */
export type TextOption = z.infer<typeof textOptionSchema>;
/** Tranh hiển thị cho học sinh: chỉ có mã tranh và mã biểu tượng, KHÔNG có tên tranh. */
export type PictureRef = z.infer<typeof pictureRefSchema>;
export type PictureOption = z.infer<typeof pictureOptionSchema>;

// ---------------------------------------------------------------------------
// Mục tiêu học tập và âm thanh
// ---------------------------------------------------------------------------

export const OBJECTIVE_CODES = [
  "recognize_onset_letter",
  "discriminate_letter_shape",
  "map_sound_to_letter",
  "encode_syllable",
  "blend_syllable",
  "analyze_onset",
  "analyze_rime",
  "analyze_tone",
  "find_unit_in_syllables",
  "apply_spelling_rule",
  "distinguish_rime",
  "distinguish_tone",
  "read_word_meaning",
  "read_sentence_meaning",
  "answer_literal_question",
  "build_sentence_order",
] as const;
export type ObjectiveCode = (typeof OBJECTIVE_CODES)[number];

export type LearningObjective = z.infer<typeof objectiveSchema>;

export const AUDIO_ROLES = ["instruction", "stimulus", "options", "model", "feedback"] as const;
export type AudioRole = (typeof AUDIO_ROLES)[number];

export type AudioSlot = z.infer<typeof audioSlotSchema>;
export type ItemAudio = z.infer<typeof itemAudioSchema>;

// ---------------------------------------------------------------------------
// Câu trả lời của học sinh
// ---------------------------------------------------------------------------

export type Response = z.infer<typeof responseSchema>;
export type ChoiceResponse = z.infer<typeof choiceResponseSchema>;
export type MultiResponse = z.infer<typeof multiResponseSchema>;
export type BuildResponse = z.infer<typeof buildResponseSchema>;
export type MatchResponse = z.infer<typeof matchResponseSchema>;
export type OrderResponse = z.infer<typeof orderResponseSchema>;

// ---------------------------------------------------------------------------
// Kết quả chấm, gợi ý, phần hiện đáp án
// ---------------------------------------------------------------------------

export type Mark = "correct" | "incorrect";

export type GradeResult = {
  correct: boolean;
  /** Thẻ lỗi (ví dụ `confusion:b-d`) — phục vụ phân tích lỗi, không hiển thị nguyên văn cho trẻ. */
  errorTags: string[];
  /**
   * Đánh dấu những gì HỌC SINH ĐÃ CHỌN (phương án, nhóm thẻ, cặp nối) là đúng/sai.
   * Không bao giờ đánh dấu phương án học sinh chưa chọn — tránh lộ đáp án khi còn lượt thử.
   */
  marks: Record<string, Mark>;
};

/** Một bậc gợi ý — chỉ mô tả cách hiển thị; không bao giờ chứa nguyên đáp án. */
export type HintView = {
  /** Mã câu gợi ý trong src/strings/vi.ts (practice.hints). */
  messageKey: HintMessageKey;
  /** Tham số chèn vào câu gợi ý (đã kiểm tra không chứa đáp án). */
  params?: Record<string, string>;
  /** Làm mờ (loại bớt) các phương án sai này. */
  eliminate?: string[];
  /** Tô màu âm đầu / vần trong chữ đang hiển thị. */
  highlightParts?: boolean;
  /** Cách tách tiếng đang hiển thị thành phần âm đầu / phần còn lại (để tô màu). */
  segments?: Array<{ text: string; part: "onset" | "rest" }>;
  /** Tách từ/câu thành từng tiếng có dấu chấm ngăn cách. */
  splitSyllables?: boolean;
  /** Phóng to tranh. */
  enlargePicture?: boolean;
  /** Cố định sẵn các thẻ từ này ở đúng vị trí (bài sắp xếp câu). */
  fixedTokenIds?: string[];
};

export const HINT_MESSAGE_KEYS = [
  "sayPictureSlowly",
  "lookAtShape",
  "listenAgain",
  "lookAtParts",
  "spellStepByStep",
  "lookAtColors",
  "lookAtToneMark",
  "spellingRule",
  "sayPictureName",
  "tryEachTone",
  "readSyllableBySyllable",
  "readSentenceSlowly",
  "findWordInSentence",
  "startWithCapital",
  "endWithPeriod",
  "removedOne",
] as const;
export type HintMessageKey = (typeof HINT_MESSAGE_KEYS)[number];

/** Phần hiện đáp án — CHỈ dùng sau khi câu đã chấm xong (đúng hoặc hết lượt). */
export type RevealView = {
  /** Đáp án dạng chữ để hiển thị, ví dụ "kẻ", "c", "Mẹ đi chợ.". */
  answerText: string;
  /** Mã phương án/thẻ đúng (để tô đáp án trên giao diện). */
  correctIds: string[];
  /** Tên tranh (nếu có) — chỉ hiện sau khi chấm. */
  pictureNames?: Record<string, string>;
  /** Giải thích ngắn, ví dụ quy tắc chính tả đã áp dụng. */
  explanation?: string;
};

// ---------------------------------------------------------------------------
// Kiểm tra nội dung
// ---------------------------------------------------------------------------

export type IssueSeverity = "error" | "warning";

export type ValidationIssueCode =
  | "SCHEMA_INVALID"
  | "NOT_NFC"
  | "TEXT_ISSUE"
  | "SPELLING_INVALID"
  | "CONTENT_NOT_TAUGHT"
  | "CONTENT_UNVERIFIED"
  | "CONTENT_INVALID"
  | "UNIT_NOT_TAUGHT"
  | "AMBIGUOUS_ANSWER"
  | "ANSWER_MISMATCH"
  | "DUPLICATE_OPTIONS"
  | "DISTRACTOR_IS_CORRECT"
  | "TOO_FEW_OPTIONS"
  | "ANSWER_NOT_IN_TEXT"
  | "DISTRACTOR_IN_TEXT"
  | "ORDER_MAY_HAVE_ALTERNATIVES"
  | "TEXT_LEAKS_ANSWER"
  | "AUDIO_LEAKS_ANSWER"
  | "AUDIO_ROLE_FORBIDDEN"
  | "MISSING_IMAGE"
  | "MISSING_AUDIO"
  | "AUDIO_NOT_AVAILABLE"
  | "BAND_CONSTRAINT"
  | "CONTENT_NOT_APPROVED"
  | "DEMO_UNREVIEWED_CONTENT"
  | "PROFILE_NOT_CONFIRMED"
  | "CONVENTION_REQUIRED";

export type ValidationIssue = {
  code: ValidationIssueCode;
  severity: IssueSeverity;
  message: string;
};

export function issue(code: ValidationIssueCode, message: string, severity: IssueSeverity = "error"): ValidationIssue {
  return { code, severity, message };
}

export function hasErrors(issues: readonly ValidationIssue[]): boolean {
  return issues.some((entry) => entry.severity === "error");
}

/** Khóa so sánh phương án: NFC + chữ thường (hai phương án "B" và "b" bị coi là trùng). */
export function optionKey(text: string): string {
  return toLowerVi(text).trim();
}

/** Mã đơn vị kiến thức của một vần: vần một nguyên âm đơn được tính là âm (AD-28). */
export function rimeUnitId(rime: string): UnitId {
  return Array.from(rime).length === 1 ? `phoneme:${rime}` : `rime:${rime}`;
}

export function toneUnitId(tone: ToneId): UnitId {
  return `tone:${tone}`;
}
