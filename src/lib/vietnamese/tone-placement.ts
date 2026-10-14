import type { SyllableAnalysis } from "./syllable.ts";

/**
 * Vị trí đặt dấu thanh.
 *
 * Hai kiểu đặt dấu cùng tồn tại và chỉ khác nhau ở các vần có âm đệm, không có âm cuối,
 * với âm chính a, e, y: "hoà/hòa", "khoẻ/khỏe", "thuỷ/thủy".
 * - `on_main_vowel`: dấu đặt trên âm chính (hoà, khoẻ, thuỷ).
 * - `traditional`: dấu đặt trên âm đệm trong các vần đó (hòa, khỏe, thủy).
 * Chọn kiểu nào là QUY ƯỚC của nhà trường (Q-02) — thư viện chỉ báo cáo, không tự quyết.
 * Mọi vị trí khác (ví dụ "muà", "qủa", "gìa") là sai theo cả hai kiểu → lỗi chắc chắn.
 */

export type TonePlacementStyle = "on_main_vowel" | "traditional";

export type TonePlacementCheck =
  | { status: "no_mark" }
  | { status: "ok"; index: number }
  | {
      status: "style_dependent";
      index: number;
      matches: TonePlacementStyle;
      expected: Record<TonePlacementStyle, number>;
    }
  | { status: "misplaced"; index: number; expected: Record<TonePlacementStyle, number> };

/** Vị trí (trong `toneless`) mà dấu thanh phải nằm theo từng kiểu đặt dấu. */
export function expectedToneIndex(
  analysis: Pick<SyllableAnalysis, "rimeStart" | "medial" | "nucleus" | "coda">,
): Record<TonePlacementStyle, number> {
  const nucleusChars = Array.from(analysis.nucleus);
  const medialLength = analysis.medial === null ? 0 : 1;
  // Nguyên âm đôi: có âm cuối (iê, yê, uô, ươ, oo) → dấu ở chữ thứ hai; không có âm cuối (ia, ya, ua, ưa) → chữ thứ nhất.
  const offsetInNucleus = nucleusChars.length === 2 && analysis.coda !== null ? 1 : 0;
  const onMainVowel = analysis.rimeStart + medialLength + offsetInNucleus;
  const traditional =
    analysis.medial !== null && analysis.coda === null && ["a", "e", "y"].includes(analysis.nucleus)
      ? analysis.rimeStart
      : onMainVowel;
  return { on_main_vowel: onMainVowel, traditional };
}

export function checkTonePlacement(analysis: SyllableAnalysis): TonePlacementCheck {
  if (analysis.tone === "ngang" || analysis.toneMarkIndex === null) return { status: "no_mark" };
  const index = analysis.toneMarkIndex;
  const expected = expectedToneIndex(analysis);
  if (expected.on_main_vowel === expected.traditional) {
    return index === expected.on_main_vowel ? { status: "ok", index } : { status: "misplaced", index, expected };
  }
  if (index === expected.on_main_vowel) return { status: "style_dependent", index, matches: "on_main_vowel", expected };
  if (index === expected.traditional) return { status: "style_dependent", index, matches: "traditional", expected };
  return { status: "misplaced", index, expected };
}
