import { DIPHTHONG_FORMS, type SyllableAnalysis } from "./syllable.ts";
import { applyTone } from "./tone.ts";

/**
 * Quy tắc chính tả ĐÃ ĐƯỢC THỪA NHẬN RỘNG RÃI của chữ quốc ngữ (CLAUDE.md §7.5).
 * Vi phạm các quy tắc này là lỗi chắc chắn. Các vấn đề phụ thuộc quy ước (vị trí dấu thanh
 * "hoà"/"hòa", phân tích "qu"/"gi") KHÔNG nằm ở đây — xem tone-placement.ts và syllable.ts.
 *
 * Bản mô tả máy đọc được của từng quy tắc nằm ở content/kb/rules.json; bộ kiểm tra nội dung
 * so khớp `spec` trong tệp đó với hằng số dưới đây để hai nơi không lệch nhau.
 */

export type SpellingIssueCode =
  "SPELLING_C_K" | "SPELLING_G_GH" | "SPELLING_NG_NGH" | "SPELLING_QU" | "SPELLING_IE_YE" | "TONE_STOP_CODA";

export type SpellingIssue = {
  code: SpellingIssueCode;
  ruleId: string;
  message: string;
  /** Cách viết đúng có khả năng nhất — chỉ để gợi ý, không tự áp dụng. */
  suggestion: string | null;
};

export type OnsetByVowelRule = {
  ruleId: string;
  code: Extract<SpellingIssueCode, "SPELLING_C_K" | "SPELLING_G_GH" | "SPELLING_NG_NGH">;
  /** Chữ ghi âm đứng trước i, e, ê (và y với c/k). */
  beforeFrontVowel: string;
  /** Chữ ghi âm đứng trước các nguyên âm còn lại. */
  elsewhere: string;
  frontVowels: readonly string[];
};

export const ONSET_BY_VOWEL_RULES: readonly OnsetByVowelRule[] = [
  {
    ruleId: "spelling.c_k",
    code: "SPELLING_C_K",
    beforeFrontVowel: "k",
    elsewhere: "c",
    frontVowels: ["i", "y", "e", "ê"],
  },
  {
    ruleId: "spelling.g_gh",
    code: "SPELLING_G_GH",
    beforeFrontVowel: "gh",
    elsewhere: "g",
    frontVowels: ["i", "e", "ê"],
  },
  {
    ruleId: "spelling.ng_ngh",
    code: "SPELLING_NG_NGH",
    beforeFrontVowel: "ngh",
    elsewhere: "ng",
    frontVowels: ["i", "e", "ê"],
  },
];

/** Âm cuối "tắc" — tiếng có âm cuối này chỉ mang thanh sắc hoặc nặng. */
export const STOP_CODAS: readonly string[] = ["p", "t", "c", "ch"];
export const STOP_CODA_ALLOWED_TONES: readonly string[] = ["sac", "nang"];

/** Đặc tả máy đọc được của các quy tắc đã hiện thực, theo `ruleId` (đối chiếu với content/kb/rules.json). */
export const SPELLING_RULE_SPECS: Readonly<Record<string, unknown>> = {
  ...Object.fromEntries(
    ONSET_BY_VOWEL_RULES.map((rule) => [
      rule.ruleId,
      {
        kind: "onset_by_following_vowel",
        beforeFrontVowel: rule.beforeFrontVowel,
        elsewhere: rule.elsewhere,
        frontVowels: [...rule.frontVowels],
      },
    ]),
  ),
  "spelling.qu": { kind: "labialized_k", onsetsReplaced: ["c", "k"], writtenAs: "qu" },
  "spelling.ie_ye": { kind: "ie_ye_by_onset", withOnset: "iê", withoutOnset: "yê" },
  "spelling.diphthong_coda": {
    kind: "diphthong_by_coda",
    withCoda: [...DIPHTHONG_FORMS.withCoda],
    withoutCoda: [...DIPHTHONG_FORMS.withoutCoda],
  },
  "tone.stop_coda": { kind: "tone_by_coda", codas: [...STOP_CODAS], allowedTones: [...STOP_CODA_ALLOWED_TONES] },
};

/** Soát một tiếng đã phân tích theo các quy tắc chính tả chắc chắn. */
export function checkSpelling(analysis: SyllableAnalysis): SpellingIssue[] {
  const issues: SpellingIssue[] = [];
  const { onset, medial, nucleus, coda, tone } = analysis;
  const firstRimeLetter = Array.from(analysis.rime)[0] ?? "";

  if ((onset === "c" || onset === "k") && medial !== null) {
    // /k/ + âm đệm luôn viết "qu": "qua" chứ không "coa", "quy" chứ không "cuy".
    issues.push({
      code: "SPELLING_QU",
      ruleId: "spelling.qu",
      message: `Âm "cờ" có âm đệm phải viết "qu" (không viết "${onset}${medial}").`,
      suggestion: rebuild(analysis, "qu", nucleus + (coda ?? ""), 1),
    });
  } else if (onset !== null) {
    for (const rule of ONSET_BY_VOWEL_RULES) {
      if (onset !== rule.beforeFrontVowel && onset !== rule.elsewhere) continue;
      const expected: string = rule.frontVowels.includes(firstRimeLetter) ? rule.beforeFrontVowel : rule.elsewhere;
      if (onset !== expected) {
        issues.push({
          code: rule.code,
          ruleId: rule.ruleId,
          message: `Trước "${firstRimeLetter}" phải viết "${expected}", không viết "${onset}".`,
          suggestion: rebuild(analysis, expected, analysis.rime, 0),
        });
      }
    }
  }

  if (medial === null && nucleus === "iê" && onset === null) {
    issues.push({
      code: "SPELLING_IE_YE",
      ruleId: "spelling.ie_ye",
      message: 'Không có âm đầu thì nguyên âm đôi viết "yê" (ví dụ "yên"), không viết "iê".',
      suggestion: rebuild(analysis, null, `yê${coda ?? ""}`, 0),
    });
  }
  if (medial === null && nucleus === "yê" && onset !== null) {
    issues.push({
      code: "SPELLING_IE_YE",
      ruleId: "spelling.ie_ye",
      message: 'Có âm đầu thì nguyên âm đôi viết "iê" (ví dụ "tiên"), không viết "yê".',
      suggestion: rebuild(analysis, onset, `iê${coda ?? ""}`, 0),
    });
  }

  if (coda !== null && STOP_CODAS.includes(coda) && !STOP_CODA_ALLOWED_TONES.includes(tone)) {
    issues.push({
      code: "TONE_STOP_CODA",
      ruleId: "tone.stop_coda",
      message: `Tiếng có âm cuối "${coda}" chỉ mang thanh sắc hoặc thanh nặng.`,
      suggestion: null,
    });
  }
  return issues;
}

/**
 * Dựng lại tiếng với âm đầu/vần mới, giữ dấu thanh trên cùng nguyên âm.
 * `droppedRimeChars`: số chữ đầu vần bị bỏ (âm đệm khi đổi sang "qu").
 */
function rebuild(analysis: SyllableAnalysis, onset: string | null, rime: string, droppedRimeChars: number): string {
  const prefix = onset ?? "";
  if (analysis.toneMarkIndex === null) return prefix + rime;
  const offsetInRime = Math.max(0, analysis.toneMarkIndex - analysis.rimeStart - droppedRimeChars);
  return applyTone(prefix + rime, analysis.tone, prefix.length + offsetInRime);
}
