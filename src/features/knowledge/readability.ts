import {
  checkDecodability,
  UNSET_CONVENTIONS,
  type DecodingResult,
  type DecodingVerdict,
  type Reason,
} from "../../lib/vietnamese/decodability.ts";
import { toLowerVi } from "../../lib/vietnamese/normalize.ts";
import { syllableTokens, tokenize } from "../../lib/vietnamese/tokenize.ts";
import type { Band } from "../../types/learning.ts";
import { resolveKnowledgeState, type KnowledgeState, type ResolveFailureCode } from "./curriculum.ts";
import type { KnowledgeBase } from "./load.ts";
import type { CurriculumProfile, ReviewStatus, WordItem } from "./schema.ts";

/**
 * Bộ kiểm tra kiến thức đã học theo hồ sơ lớp — tách bạch ba khía cạnh:
 * 1. Giải mã (decoding): mọi đơn vị chữ–âm cần thiết đã được khai báo là đã học chưa.
 * 2. Từ vựng (vocabulary): từ có trong ngân hàng từ hay không — KHÔNG suy ra trẻ đã hiểu từ.
 * 3. Đọc hiểu (comprehension): bộ máy không đánh giá; chỉ nêu yêu cầu để GV xem xét.
 *
 * Kết luận `readable` chỉ có nghĩa "phù hợp với kiến thức đã khai báo" — không khẳng định
 * học sinh thực tế đọc được.
 */

export type ReadabilityVerdict = DecodingVerdict;

export type VocabularyEntry = {
  text: string;
  wordId: string | null;
  familiarity: WordItem["familiarity"] | null;
  reviewStatus: ReviewStatus | null;
};

export type VocabularyReport = {
  status: "all_in_bank" | "partially_in_bank" | "none_in_bank";
  entries: VocabularyEntry[];
  note: string;
};

export type ComprehensionReport = {
  assessed: false;
  demand: "word_meaning" | "sentence_meaning";
  /** Câu hỏi đọc hiểu gợi ý (nếu câu có trong ngân hàng câu). */
  teacherPrompt: string | null;
  note: string;
};

export type ReadabilityReport = {
  text: string;
  verdict: ReadabilityVerdict;
  profile: {
    id: string;
    status: CurriculumProfile["status"];
    band: Band | null;
    lessonOrdinal: number | null;
    effectiveLessonOrdinal: number | null;
  };
  /** Lý do hồ sơ không dùng được (nếu có). */
  profileProblem: { code: ResolveFailureCode; message: string } | null;
  decoding: DecodingResult;
  vocabulary: VocabularyReport;
  comprehension: ComprehensionReport;
  reasons: Reason[];
  caveats: string[];
};

export type ReadabilityOptions = { profile: CurriculumProfile; band?: Band; lessonOrdinal?: number };

const ALWAYS_CAVEAT =
  "Kết quả chỉ cho biết ngữ liệu khớp với kiến thức đã khai báo trong hồ sơ; không khẳng định học sinh thực tế đọc được.";

export function checkReadability(kb: KnowledgeBase, text: string, options: ReadabilityOptions): ReadabilityReport {
  const resolved = resolveKnowledgeState(kb, options.profile, {
    ...(options.band !== undefined ? { band: options.band } : {}),
    ...(options.lessonOrdinal !== undefined ? { lessonOrdinal: options.lessonOrdinal } : {}),
  });
  const state: KnowledgeState | null = resolved.ok ? resolved.state : null;

  const decoding = checkDecodability(text, {
    inventory: kb.inventory,
    taughtUnits: state?.allowedForPractice ?? new Set(),
    conventions: state?.conventions ?? UNSET_CONVENTIONS,
  });

  let verdict: ReadabilityVerdict = decoding.verdict;
  let reasons = decoding.reasons;
  if (!resolved.ok && decoding.verdict !== "invalid") {
    // Không có hồ sơ dùng được thì không thể kết luận "đã học" hay "chưa học" — chỉ lỗi chính tả là chắc chắn.
    verdict = "unknown";
    reasons = [{ code: "PROFILE_NOT_USABLE", message: resolved.message }];
  }

  const caveats = [ALWAYS_CAVEAT, ...decoding.caveats.map((caveat) => caveat.message)];
  if (options.profile.status !== "confirmed") {
    caveats.push(
      options.profile.status === "illustrative"
        ? "Hồ sơ minh họa (hư cấu) — chỉ dùng để kiểm thử/xem trước, không dùng cho lớp thật."
        : "Hồ sơ chưa được giáo viên xác nhận — chỉ dùng để xem trước, không dùng để giao bài.",
    );
  }

  return {
    text,
    verdict,
    profile: {
      id: options.profile.id,
      status: options.profile.status,
      band: options.band ?? null,
      lessonOrdinal: state?.lessonOrdinal ?? options.lessonOrdinal ?? options.profile.currentLessonOrdinal,
      effectiveLessonOrdinal: state?.effectiveLessonOrdinal ?? null,
    },
    profileProblem: resolved.ok ? null : { code: resolved.code, message: resolved.message },
    decoding,
    vocabulary: analyzeVocabulary(kb, text),
    comprehension: describeComprehension(kb, text),
    reasons,
    caveats,
  };
}

/**
 * Ghép các tiếng thành từ bằng đối chiếu ngân hàng từ (khớp dài nhất, tối đa 3 tiếng).
 * Tiếng không khớp được báo "không có trong ngân hàng" — không tự đoán ranh giới từ.
 */
export function analyzeVocabulary(kb: KnowledgeBase, text: string): VocabularyReport {
  const byText = new Map(kb.words.map((word) => [toLowerVi(word.text), word]));
  const syllables = syllableTokens(text).map((token) => toLowerVi(token.text));
  const entries: VocabularyEntry[] = [];
  let index = 0;
  while (index < syllables.length) {
    let matched: WordItem | undefined;
    let length = 0;
    for (let size = Math.min(3, syllables.length - index); size >= 1 && !matched; size -= 1) {
      matched = byText.get(syllables.slice(index, index + size).join(" "));
      if (matched) length = size;
    }
    if (matched) {
      entries.push({
        text: matched.text,
        wordId: matched.id,
        familiarity: matched.familiarity,
        reviewStatus: matched.review.status,
      });
      index += length;
    } else {
      entries.push({ text: syllables[index] ?? "", wordId: null, familiarity: null, reviewStatus: null });
      index += 1;
    }
  }
  const inBank = entries.filter((entry) => entry.wordId !== null).length;
  return {
    status: inBank === 0 ? "none_in_bank" : inBank === entries.length ? "all_in_bank" : "partially_in_bank",
    entries,
    note: "Có trong ngân hàng từ không có nghĩa là học sinh đã hiểu từ; độ quen thuộc chỉ là ước lượng chung cho lứa tuổi.",
  };
}

function describeComprehension(kb: KnowledgeBase, text: string): ComprehensionReport {
  const isSentence =
    tokenize(text).some((token) => token.kind === "punctuation" && /[.!?]/u.test(token.text)) ||
    syllableTokens(text).length > 3;
  const normalized = toLowerVi(text.trim());
  const sentence = kb.sentences.find((item) => toLowerVi(item.text) === normalized);
  return {
    assessed: false,
    demand: isSentence ? "sentence_meaning" : "word_meaning",
    teacherPrompt: sentence?.comprehensionFocus ?? null,
    note: isSentence
      ? "Bộ máy không đánh giá đọc hiểu câu; GV kiểm tra bằng câu hỏi hoặc hình ảnh."
      : "Bộ máy không đánh giá việc hiểu nghĩa từ; GV kiểm tra bằng hình ảnh hoặc ngữ cảnh.",
  };
}
