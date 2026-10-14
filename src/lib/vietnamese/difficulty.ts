import type { SyllableAnalysis } from "./syllable.ts";

/**
 * Ước lượng độ khó GIẢI MÃ (1–5) từ cấu tạo tiếng — không chỉ dựa vào độ dài.
 *
 * Đây là ước lượng có thể giải thích để giáo viên đối chiếu với "độ khó dự kiến" do người soạn
 * ghi; trọng số là giả định ban đầu, cần hiệu chỉnh bằng dữ liệu thí điểm. Không phản ánh
 * độ quen thuộc của từ hay độ khó đọc hiểu.
 */

export type DifficultyFactorCode =
  | "BASE"
  | "ONSET_MULTI_LETTER"
  | "ONSET_SPELLING_VARIANT"
  | "RIME_CODA"
  | "RIME_DIPHTHONG"
  | "RIME_MEDIAL"
  | "TONE_HOI_NGA"
  | "SYLLABLE_COUNT";

export type DifficultyFactor = { code: DifficultyFactorCode; points: number; detail: string };

export type DifficultyEstimate = { level: 1 | 2 | 3 | 4 | 5; score: number; factors: DifficultyFactor[] };

/** Âm đầu có nhiều cách viết theo vị trí (c/k/q, g/gh, ng/ngh) hoặc quy ước riêng (gi). */
const SPELLING_VARIANT_ONSETS = new Set(["k", "gh", "ngh", "qu", "gi"]);

/** Điểm phức tạp của một tiếng và các yếu tố tạo nên điểm đó. */
export function syllableComplexity(analysis: SyllableAnalysis): { score: number; factors: DifficultyFactor[] } {
  const factors: DifficultyFactor[] = [{ code: "BASE", points: 1, detail: analysis.text }];
  const onsetLength = analysis.onset === null ? 0 : Array.from(analysis.onset).length;
  if (onsetLength >= 2) {
    factors.push({ code: "ONSET_MULTI_LETTER", points: onsetLength >= 3 ? 0.5 : 0.25, detail: analysis.onset ?? "" });
  }
  if (analysis.onset !== null && SPELLING_VARIANT_ONSETS.has(analysis.onset)) {
    factors.push({ code: "ONSET_SPELLING_VARIANT", points: 0.25, detail: analysis.onset });
  }
  let rimePoints = 0;
  const rimeFactors: DifficultyFactor[] = [];
  if (analysis.medial !== null) rimeFactors.push({ code: "RIME_MEDIAL", points: 0.75, detail: analysis.rime });
  if (Array.from(analysis.nucleus).length === 2)
    rimeFactors.push({ code: "RIME_DIPHTHONG", points: 0.75, detail: analysis.rime });
  if (analysis.coda !== null) rimeFactors.push({ code: "RIME_CODA", points: 0.5, detail: analysis.rime });
  for (const factor of rimeFactors) {
    // Phần vần đóng góp tối đa 1,75 điểm để vần rất dài không lấn át các yếu tố khác.
    const points = Math.min(factor.points, 1.75 - rimePoints);
    if (points <= 0) break;
    rimePoints += points;
    factors.push({ ...factor, points });
  }
  if (analysis.tone === "hoi" || analysis.tone === "nga") {
    factors.push({ code: "TONE_HOI_NGA", points: 0.25, detail: analysis.tone });
  }
  return { score: factors.reduce((sum, factor) => sum + factor.points, 0), factors };
}

/**
 * Độ khó của một đơn vị gồm một hoặc nhiều tiếng: tiếng khó nhất + phần cộng theo số tiếng
 * (từ: 0,5/tiếng thêm; câu: 0,25/tiếng thêm).
 */
export function estimateDifficulty(
  analyses: readonly SyllableAnalysis[],
  kind: "syllable" | "word" | "sentence",
): DifficultyEstimate {
  if (analyses.length === 0) return { level: 1, score: 0, factors: [] };
  const scored = analyses.map(syllableComplexity);
  const hardest = scored.reduce((max, current) => (current.score > max.score ? current : max));
  const factors = [...hardest.factors];
  const extraSyllables = analyses.length - 1;
  if (extraSyllables > 0) {
    const perSyllable = kind === "sentence" ? 0.25 : 0.5;
    factors.push({ code: "SYLLABLE_COUNT", points: extraSyllables * perSyllable, detail: `${analyses.length} tiếng` });
  }
  const score = factors.reduce((sum, factor) => sum + factor.points, 0);
  const level = Math.min(5, Math.max(1, Math.floor(score + 0.5))) as DifficultyEstimate["level"];
  return { level, score, factors };
}
