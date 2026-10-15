import type { UnitId } from "../../../lib/vietnamese/decodability.ts";
import { estimateDifficulty } from "../../../lib/vietnamese/difficulty.ts";
import { toLowerVi } from "../../../lib/vietnamese/normalize.ts";
import type { SyllableAnalysis } from "../../../lib/vietnamese/syllable.ts";
import { TONE_IDS, type ToneId } from "../../../lib/vietnamese/tone.ts";
import { syllableTokens } from "../../../lib/vietnamese/tokenize.ts";
import type { Band } from "../../../types/learning.ts";
import type { KnowledgeState } from "../../knowledge/curriculum.ts";
import type { KnowledgeBase } from "../../knowledge/load.ts";
import { checkReadability } from "../../knowledge/readability.ts";
import type { CurriculumProfile, ReviewStatus, SentenceItem, WordItem } from "../../knowledge/schema.ts";
import { BAND_CONSTRAINTS, type BandConstraints } from "../core/bands.ts";
import { analyzeStrict } from "../core/checks.ts";
import { reviewAllowed, type ContentMode } from "../core/content-mode.ts";
import type { MediaLibrary, PictureAsset } from "../core/media.ts";
import type { ItemCheckContext, VariantId } from "../core/module.ts";
import { rimeUnitId } from "../core/primitives.ts";
import type { Rng } from "./rng.ts";

/**
 * Bối cảnh sinh bài: ngữ liệu đã lọc theo chế độ (demo/học thật), trạng thái duyệt và kiến thức đã học
 * của nhóm — tất cả qua bộ máy GĐ3 (`checkReadability`, `analyzeStrict`). Bộ sinh của từng dạng bài chỉ
 * chọn trong các tập hữu hạn này, nên không bao giờ sinh vô hạn tổ hợp.
 */

/** Câu hỏi đọc hiểu khai báo sẵn (fixture) — bộ máy không tự đặt câu hỏi. */
export type ComprehensionSpec = {
  id: string;
  sentenceId: string;
  question: string;
  answer: string;
  distractors: readonly string[];
};

export type GenerationRequest = {
  kb: KnowledgeBase;
  profile: CurriculumProfile;
  band: Band;
  lessonOrdinal?: number;
  mode: ContentMode;
  media: MediaLibrary;
  variant: VariantId;
  count: number;
  /** Số câu tối thiểu; ít hơn thì trả về thất bại kèm lý do (mặc định = `count`). */
  minCount?: number;
  seed: string;
  comprehension?: readonly ComprehensionSpec[];
  fixtureReview?: (fixtureId: string) => ReviewStatus | null;
  /** Bỏ các mục tiêu này (dùng khi sinh bài ở lớp khác bài ở nhà). */
  excludeKeys?: ReadonlySet<string>;
  /** Chỉ giữ ứng viên có ít nhất một đơn vị trọng tâm thuộc tập này (ví dụ ôn b–d). */
  focusUnits?: ReadonlySet<UnitId>;
  /** Chỉ giữ ứng viên có độ khó trong khoảng [target − tolerance, target + tolerance]. */
  difficulty?: { target: number; tolerance: number };
  /** Bản chơi thử: cho phép câu thiếu âm thanh bắt buộc, chỉ để xem giao diện. */
  allowPreviewOnly?: boolean;
};

export type WordEntry = { item: WordItem; analyses: SyllableAnalysis[]; readable: boolean; difficulty: number };
export type SentenceEntry = { item: SentenceItem; analyses: SyllableAnalysis[]; difficulty: number };
export type SyllableEntry = { text: string; analysis: SyllableAnalysis; sourceId: string; difficulty: number };
export type PictureEntry = { asset: PictureAsset; word: WordEntry };

export type GenerationContext = {
  request: GenerationRequest;
  kb: KnowledgeBase;
  state: KnowledgeState;
  check: ItemCheckContext;
  limits: BandConstraints;
  words: WordEntry[];
  sentences: SentenceEntry[];
  /** Tiếng có thật trong ngữ liệu (ngân hàng tiếng + tiếng của từ/câu), đọc được, phân tích chắc chắn. */
  syllables: SyllableEntry[];
  pictures: PictureEntry[];
  taughtOnsets: string[];
  taughtSingleLetters: string[];
  taughtRimes: string[];
  taughtTones: ToneId[];
  isTaught(unit: UnitId): boolean;
  isReadable(text: string): boolean;
};

function analyzeAll(text: string, check: ItemCheckContext): SyllableAnalysis[] | null {
  const analyses: SyllableAnalysis[] = [];
  for (const token of syllableTokens(text)) {
    const result = analyzeStrict(token.text, check);
    if (!result.ok) return null;
    analyses.push(result.analysis);
  }
  return analyses.length > 0 ? analyses : null;
}

export function buildContext(request: GenerationRequest, state: KnowledgeState): GenerationContext {
  const { kb, mode } = request;
  const check: ItemCheckContext = {
    kb,
    profile: request.profile,
    band: request.band,
    lessonOrdinal: request.lessonOrdinal,
    state,
    mode,
    media: request.media,
  };
  const readableCache = new Map<string, boolean>();
  const isReadable = (text: string) => {
    const cached = readableCache.get(text);
    if (cached !== undefined) return cached;
    const verdict = checkReadability(kb, text, {
      profile: request.profile,
      band: request.band,
      ...(request.lessonOrdinal !== undefined ? { lessonOrdinal: request.lessonOrdinal } : {}),
    }).verdict;
    readableCache.set(text, verdict === "readable");
    return verdict === "readable";
  };
  const allowed = (status: ReviewStatus) => reviewAllowed(mode, status);

  const words: WordEntry[] = [];
  for (const item of kb.words) {
    if (!allowed(item.review.status)) continue;
    const analyses = analyzeAll(item.text, check);
    if (!analyses) continue;
    words.push({
      item,
      analyses,
      readable: isReadable(item.text),
      difficulty: estimateDifficulty(analyses, "word").level,
    });
  }

  const sentences: SentenceEntry[] = [];
  for (const item of kb.sentences) {
    if (!allowed(item.review.status) || !isReadable(item.text)) continue;
    const analyses = analyzeAll(item.text, check);
    if (analyses) sentences.push({ item, analyses, difficulty: estimateDifficulty(analyses, "sentence").level });
  }

  const syllableMap = new Map<string, SyllableEntry>();
  const addSyllable = (text: string, sourceId: string) => {
    const key = toLowerVi(text);
    if (syllableMap.has(key) || !isReadable(key)) return;
    const result = analyzeStrict(key, check);
    if (!result.ok) return;
    syllableMap.set(key, {
      text: key,
      analysis: result.analysis,
      sourceId,
      difficulty: estimateDifficulty([result.analysis], "syllable").level,
    });
  };
  for (const item of kb.syllables) if (allowed(item.review.status)) addSyllable(item.text, item.id);
  for (const entry of words)
    for (const token of syllableTokens(entry.item.text)) addSyllable(token.text, entry.item.id);
  for (const entry of sentences)
    for (const token of syllableTokens(entry.item.text)) addSyllable(token.text, entry.item.id);

  const pictures: PictureEntry[] = [];
  for (const asset of request.media.pictures) {
    if (!allowed(asset.review.status)) continue;
    if (mode === "production" && asset.scope !== "library") continue;
    const word = words.find(
      (entry) => entry.item.id === asset.wordId && toLowerVi(entry.item.text) === toLowerVi(asset.word),
    );
    if (word) pictures.push({ asset, word });
  }

  const allowedUnits = state.allowedForPractice;
  const isTaught = (unit: UnitId) => allowedUnits.has(unit);
  const onsetGraphemes = kb.phonemes
    .filter((phoneme) => phoneme.positions.includes("onset"))
    .map((phoneme) => phoneme.text);

  return {
    request,
    kb,
    state,
    check,
    limits: BAND_CONSTRAINTS[request.band],
    words,
    sentences,
    syllables: Array.from(syllableMap.values()),
    pictures,
    taughtOnsets: onsetGraphemes.filter((grapheme) => isTaught(`phoneme:${grapheme}`)),
    taughtSingleLetters: kb.phonemes
      .filter((phoneme) => phoneme.graphemeType === "single" && isTaught(`phoneme:${phoneme.text}`))
      .map((phoneme) => phoneme.text),
    taughtRimes: kb.rimes.filter((rime) => isTaught(rimeUnitId(rime.text))).map((rime) => rime.text),
    taughtTones: TONE_IDS.filter((tone) => isTaught(`tone:${tone}`)),
    isTaught,
    isReadable,
  };
}

// ---------------------------------------------------------------------------
// Phương án nhiễu
// ---------------------------------------------------------------------------

export type UnitKind = "grapheme" | "rime" | "tone";
export type Alternative = { text: string; tag: string };

/** Bạn của một đơn vị trong các cặp dễ nhầm của kho tri thức (content/kb/confusions.json). */
export function confusionPartners(kb: KnowledgeBase, kind: UnitKind, text: string): Alternative[] {
  const prefixes = kind === "grapheme" ? ["phoneme:", "letter:"] : kind === "rime" ? ["rime:"] : ["tone:"];
  const partners: Alternative[] = [];
  for (const confusion of kb.confusions) {
    const parsed = confusion.units.map((unit) => {
      const prefix = prefixes.find((candidate) => unit.startsWith(candidate));
      return prefix ? unit.slice(prefix.length) : null;
    });
    const [first, second] = parsed;
    if (first === undefined || second === undefined || first === null || second === null) continue;
    if (first === text) partners.push({ text: second, tag: confusion.id });
    else if (second === text) partners.push({ text: first, tag: confusion.id });
  }
  return partners;
}

/**
 * Danh sách phương án nhiễu theo thứ tự ưu tiên: cặp dễ nhầm của kho tri thức → nhóm "giống nhau" do
 * nơi gọi cung cấp → phần còn lại (xáo trộn bằng rng có seed). Chỉ lấy trong `pool` (đơn vị đã học).
 */
export function rankedAlternatives(options: {
  kb: KnowledgeBase;
  kind: UnitKind;
  answer: string;
  pool: readonly string[];
  rng: Rng;
  similar?: readonly Alternative[];
  accept?: (text: string) => boolean;
}): Alternative[] {
  const { kb, kind, answer, pool, rng } = options;
  const accept = options.accept ?? (() => true);
  const inPool = new Set(pool);
  const result: Alternative[] = [];
  const seen = new Set([answer]);
  const push = (alternative: Alternative) => {
    if (seen.has(alternative.text) || !inPool.has(alternative.text) || !accept(alternative.text)) return;
    seen.add(alternative.text);
    result.push(alternative);
  };
  for (const partner of confusionPartners(kb, kind, answer)) push(partner);
  for (const similar of rng.shuffle(options.similar ?? [])) push(similar);
  for (const text of rng.shuffle(pool)) push({ text, tag: "distractor:other" });
  return result;
}
