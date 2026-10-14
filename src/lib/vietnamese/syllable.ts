import { FOREIGN_LATIN_LETTERS, isAlphabetLetter, isCombiningMark, isVowelLetter } from "./characters.ts";
import { toNFC } from "./normalize.ts";
import { extractTone, type ToneId } from "./tone.ts";

/**
 * Phân tích một tiếng (âm tiết) theo chữ viết: âm đầu + vần (âm đệm + âm chính + âm cuối) + thanh.
 *
 * Bộ phân tích KHÔNG tự tách chuỗi theo luật chung: phần vần phải khớp CHÍNH XÁC một mục trong
 * danh mục vần của kho tri thức (content/kb/rimes.json), nơi cấu tạo của từng vần được khai báo
 * tường minh và được giáo viên rà soát. Tiếng nào không khớp được trả về trạng thái chưa xác định
 * kèm lý do, thay vì đoán.
 *
 * Quy ước nhà trường (coi "qu", "gi" là một âm đầu; "i" dùng chung trong "gì", "giếng") được ghi
 * lại trong `conventionDependencies` để bộ kiểm tra kiến thức biết kết quả phụ thuộc quy ước nào.
 */

export type Medial = "o" | "u";

/** Một vần trong danh mục: chữ viết (không dấu thanh) và cấu tạo đã khai báo. */
export type RimeSpec = {
  text: string;
  medial: Medial | null;
  nucleus: string;
  coda: string | null;
};

/** Dữ liệu tối thiểu bộ phân tích cần: danh sách âm đầu và danh mục vần (lấy từ kho tri thức). */
export type SyllableInventory = {
  onsets: readonly string[];
  rimes: ReadonlyMap<string, RimeSpec>;
};

/**
 * Quy ước mà một kết quả phân tích dựa vào:
 * - `qu_onset`: "qu" là một âm đầu ("quả" = qu + a + hỏi).
 * - `gi_onset`: "gi" là một âm đầu ("giỏ" = gi + o + hỏi).
 * - `gi_shared_i`: chữ "i" của "gi" được dùng chung với vần ("gì" = gi + i; "giếng" = gi + iêng).
 */
export type ConventionDependency = "qu_onset" | "gi_onset" | "gi_shared_i";

export type SyllableAnalysis = {
  /** Chuỗi đầu vào như được cung cấp. */
  input: string;
  /** Chữ thường, NFC, giữ dấu thanh. */
  text: string;
  /** Chữ thường, NFC, đã bỏ dấu thanh. */
  toneless: string;
  hasUppercase: boolean;
  onset: string | null;
  medial: Medial | null;
  nucleus: string;
  coda: string | null;
  /** Vần = âm đệm + âm chính + âm cuối (không dấu thanh). */
  rime: string;
  tone: ToneId;
  /** Vị trí ký tự mang dấu thanh trong `toneless`; `null` với thanh ngang. */
  toneMarkIndex: number | null;
  /** Vị trí bắt đầu của vần trong `toneless` (nhỏ hơn độ dài âm đầu khi "i" được dùng chung). */
  rimeStart: number;
  conventionDependencies: ConventionDependency[];
};

export type ParseFailureCode =
  | "EMPTY"
  | "INVALID_CHARACTER"
  | "FOREIGN_LETTER"
  | "STRAY_COMBINING_MARK"
  | "MULTIPLE_TONE_MARKS"
  | "TONE_MARK_ON_CONSONANT"
  | "NO_VOWEL"
  | "Q_WITHOUT_U"
  | "CONSONANT_CLUSTER"
  | "RIME_FORM_INVALID"
  | "RIME_NOT_IN_CATALOG"
  | "AMBIGUOUS_QU_Y";

export type ParseCandidate = { onset: string | null; rime: string; note: string };

export type SyllableParseResult =
  | { status: "ok"; analysis: SyllableAnalysis }
  /** Chắc chắn không phải một tiếng viết đúng (ký tự lạ, hai dấu thanh, sai dạng vần…). */
  | { status: "invalid"; input: string; code: ParseFailureCode; detail: string; suggestions: string[] }
  /** Có thể hợp lệ nhưng nằm ngoài dữ liệu đã mô tả (vần chưa có trong danh mục, từ mượn…). */
  | { status: "unrecognized"; input: string; code: ParseFailureCode; detail: string }
  /** Có nhiều cách phân tích tùy quy ước; cần giáo viên xác nhận. */
  | { status: "ambiguous"; input: string; code: ParseFailureCode; detail: string; candidates: ParseCandidate[] };

/** Phân tích một tiếng. Hàm thuần: cùng đầu vào và cùng kho dữ liệu luôn cho cùng kết quả. */
export function analyzeSyllable(input: string, inventory: SyllableInventory): SyllableParseResult {
  const nfc = toNFC(input);
  const text = nfc.toLowerCase();
  if (text.length === 0) return invalid(input, "EMPTY", "Không có chữ nào để phân tích.");

  for (const char of Array.from(text)) {
    if (isCombiningMark(char)) {
      return invalid(input, "STRAY_COMBINING_MARK", "Còn dấu tổ hợp không gắn được vào chữ (kiểm tra thứ tự gõ dấu).");
    }
    const letter = Array.from(char.normalize("NFD"))[0] ?? "";
    if (FOREIGN_LATIN_LETTERS.has(letter)) {
      return invalid(input, "FOREIGN_LETTER", `Chữ "${letter}" không thuộc bảng chữ cái tiếng Việt.`);
    }
    if (!/^[a-zđ]$/u.test(letter)) {
      return invalid(input, "INVALID_CHARACTER", `Ký tự "${char}" không phải chữ cái tiếng Việt.`);
    }
  }

  const extraction = extractTone(text);
  if (!extraction.ok) {
    const detail =
      extraction.code === "MULTIPLE_TONE_MARKS"
        ? "Một tiếng chỉ mang một dấu thanh."
        : extraction.code === "TONE_MARK_ON_CONSONANT"
          ? "Dấu thanh chỉ đặt trên chữ nguyên âm."
          : "Có dấu không thuộc chữ viết tiếng Việt.";
    const code = extraction.code === "UNKNOWN_MARK" ? "INVALID_CHARACTER" : extraction.code;
    return invalid(input, code, detail);
  }

  const { base, tone, markIndex } = extraction;
  const baseChars = Array.from(base);
  if (!baseChars.every(isAlphabetLetter)) {
    return invalid(input, "INVALID_CHARACTER", "Có ký tự không phải chữ cái tiếng Việt.");
  }
  if (!baseChars.some(isVowelLetter)) return invalid(input, "NO_VOWEL", "Tiếng phải có ít nhất một nguyên âm.");

  const common = { input, text, toneless: base, hasUppercase: nfc !== text, tone, toneMarkIndex: markIndex };

  // "qu": q luôn đi với u; theo quy ước tạm thời, "qu" là một âm đầu.
  if (base.startsWith("q")) {
    if (!base.startsWith("qu") || base.length === 2) {
      return invalid(input, "Q_WITHOUT_U", 'Chữ q luôn đi với u thành "qu" và phải có vần theo sau.');
    }
    const rest = base.slice(2);
    if (rest.startsWith("y")) {
      const candidates: ParseCandidate[] = [];
      if (inventory.rimes.has(rest)) {
        candidates.push({ onset: "qu", rime: rest, note: `qu + ${rest}` });
      }
      if (inventory.rimes.has(`u${rest}`)) {
        candidates.push({ onset: "qu", rime: `u${rest}`, note: `qu + u${rest} (u dùng chung)` });
      }
      if (candidates.length === 0) {
        return unrecognized(input, "RIME_NOT_IN_CATALOG", `Không có vần "${rest}" hay "u${rest}" trong danh mục.`);
      }
      return {
        status: "ambiguous",
        input,
        code: "AMBIGUOUS_QU_Y",
        detail: `"qu" đứng trước "y": cách phân tích "${nfc}" phụ thuộc quy ước của bộ sách (qu + ${rest} hay qu + u${rest}).`,
        candidates,
      };
    }
    return withRime(common, "qu", rest, 2, ["qu_onset"], inventory);
  }

  // "gi": theo quy ước tạm thời, "gi" là một âm đầu; "i" có thể được dùng chung với vần.
  // (Viết "g" + i/e/ê phải là "gh", nên chuỗi bắt đầu bằng "gi" luôn là âm đầu "gi".)
  if (base.startsWith("gi")) {
    const rest = base.slice(2);
    const sharesI =
      // "gì", "gìn": chữ i vừa thuộc "gi" vừa là âm chính của vần.
      !Array.from(rest).some(isVowelLetter) ||
      // "giếng", "giết": âm chính là iê, chữ i dùng chung với "gi".
      (rest.startsWith("ê") && rest.length > 1);
    return sharesI
      ? withRime(common, "gi", `i${rest}`, 1, ["gi_onset", "gi_shared_i"], inventory)
      : withRime(common, "gi", rest, 2, ["gi_onset"], inventory);
  }

  const onset = matchOnset(base, inventory.onsets);
  const rest = base.slice(onset?.length ?? 0);
  const first = Array.from(rest)[0];
  if (first === undefined || !isVowelLetter(first)) {
    return unrecognized(
      input,
      "CONSONANT_CLUSTER",
      `Sau âm đầu "${onset ?? ""}" là phụ âm "${first ?? ""}" — tiếng Việt không có cụm phụ âm này.`,
    );
  }
  return withRime(common, onset, rest, onset?.length ?? 0, [], inventory);
}

type CommonFields = Pick<SyllableAnalysis, "input" | "text" | "toneless" | "hasUppercase" | "tone" | "toneMarkIndex">;

function withRime(
  common: CommonFields,
  onset: string | null,
  rimeText: string,
  rimeStart: number,
  conventionDependencies: ConventionDependency[],
  inventory: SyllableInventory,
): SyllableParseResult {
  const spec = inventory.rimes.get(rimeText);
  if (!spec) {
    const diagnosis = diagnoseRimeForm(rimeText);
    if (diagnosis) {
      return { status: "invalid", input: common.input, code: "RIME_FORM_INVALID", ...diagnosis };
    }
    return unrecognized(
      common.input,
      "RIME_NOT_IN_CATALOG",
      `Vần "${rimeText}" chưa có trong danh mục vần — chưa thể phân tích chắc chắn.`,
    );
  }
  return {
    status: "ok",
    analysis: {
      ...common,
      onset,
      medial: spec.medial,
      nucleus: spec.nucleus,
      coda: spec.coda,
      rime: spec.text,
      rimeStart,
      conventionDependencies,
    },
  };
}

/** Âm đầu dài nhất khớp ở đầu chuỗi ("ngh" trước "ng" trước "n"). */
function matchOnset(base: string, onsets: readonly string[]): string | null {
  let best: string | null = null;
  for (const onset of onsets) {
    if (onset === "qu" || onset === "gi") continue;
    if (base.startsWith(onset) && (best === null || onset.length > best.length)) best = onset;
  }
  return best;
}

/**
 * Nhận diện những dạng vần chắc chắn sai theo quy tắc chính tả của nguyên âm đôi:
 * iê/yê, uô, ươ khi có âm cuối; ia/ya, ua, ưa khi không có âm cuối.
 * Lỗi là chắc chắn; gợi ý sửa chỉ mang tính tham khảo (không tự áp dụng).
 */
export const DIPHTHONG_FORMS = {
  /** Dạng viết khi có âm cuối. */
  withCoda: ["iê", "yê", "uô", "ươ"],
  /** Dạng viết khi không có âm cuối (cùng thứ tự với `withCoda`). */
  withoutCoda: ["ia", "ya", "ua", "ưa"],
} as const;

const MISPLACED_CODA_PATTERN = new RegExp(
  `^(${DIPHTHONG_FORMS.withoutCoda.join("|")})(c|ch|m|n|ng|nh|p|t|i|u|o|y)$`,
  "u",
);

export function diagnoseRimeForm(rime: string): { detail: string; suggestions: string[] } | null {
  const withCoda = MISPLACED_CODA_PATTERN.exec(rime);
  if (withCoda) {
    const [, diphthong = "", coda = ""] = withCoda;
    const fixed: Record<string, string[]> = {
      ia: [`iê${coda}`],
      ya: [`yê${coda}`],
      ua: [`uô${coda}`, `oa${coda}`],
      ưa: [`ươ${coda}`],
    };
    return {
      detail: `"${diphthong}" chỉ viết khi không có âm cuối; có âm cuối thì nguyên âm đôi viết khác.`,
      suggestions: fixed[diphthong] ?? [],
    };
  }
  const index = (DIPHTHONG_FORMS.withCoda as readonly string[]).indexOf(rime);
  const replacement = index >= 0 ? DIPHTHONG_FORMS.withoutCoda[index] : undefined;
  if (replacement) {
    return {
      detail: `"${rime}" chỉ viết khi có âm cuối; không có âm cuối thì viết "${replacement}".`,
      suggestions: [replacement],
    };
  }
  return null;
}

/** Cách nhận diện vần cho một chữ nguyên âm đơn đứng một mình (a, ê, o…): dùng khi tính kiến thức cần biết. */
export function isBareVowelRime(analysis: Pick<SyllableAnalysis, "medial" | "coda" | "nucleus">): boolean {
  return analysis.medial === null && analysis.coda === null && Array.from(analysis.nucleus).length === 1;
}

function invalid(input: string, code: ParseFailureCode, detail: string): SyllableParseResult {
  return { status: "invalid", input, code, detail, suggestions: [] };
}

function unrecognized(input: string, code: ParseFailureCode, detail: string): SyllableParseResult {
  return { status: "unrecognized", input, code, detail };
}
