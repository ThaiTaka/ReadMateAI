import { checkSpelling, type SpellingIssueCode } from "./spelling-rules.ts";
import {
  analyzeSyllable,
  type ParseFailureCode,
  type SyllableAnalysis,
  type SyllableInventory,
  type SyllableParseResult,
} from "./syllable.ts";
import { checkTonePlacement } from "./tone-placement.ts";

/**
 * Chẩn đoán một tiếng: gộp phân tích cấu tạo, quy tắc chính tả chắc chắn, vị trí dấu thanh
 * và các quy ước cần xác nhận thành một danh sách có mức độ rõ ràng:
 * - `error`: sai chắc chắn theo quy tắc đã thừa nhận → phải sửa;
 * - `warning`: phụ thuộc quy ước hoặc nằm ngoài dữ liệu đã mô tả → cần giáo viên rà soát.
 */

export type DiagnosticCode =
  ParseFailureCode | SpellingIssueCode | "TONE_MARK_MISPLACED" | "TONE_PLACEMENT_CONVENTION" | "CONVENTION_DEPENDENT";

export type SyllableDiagnostic = {
  code: DiagnosticCode;
  severity: "error" | "warning";
  /** Mã quy tắc trong content/kb/rules.json (nếu có). */
  ruleId: string | null;
  message: string;
  suggestions: string[];
};

export type SyllableDiagnosis = {
  input: string;
  /** `ok`: không có lỗi (có thể có cảnh báo) · `error`: sai chắc chắn · `unverified`: chưa thể phân tích. */
  status: "ok" | "error" | "unverified";
  analysis: SyllableAnalysis | null;
  parse: SyllableParseResult;
  diagnostics: SyllableDiagnostic[];
};

/** Mọi mã quy tắc mà bộ máy tham chiếu — bộ kiểm tra nội dung đòi hỏi tất cả có trong rules.json. */
export const ENGINE_RULE_IDS: readonly string[] = [
  "spelling.c_k",
  "spelling.g_gh",
  "spelling.ng_ngh",
  "spelling.qu",
  "spelling.ie_ye",
  "spelling.diphthong_coda",
  "tone.stop_coda",
  "tone.single_mark",
  "syllable.has_vowel",
  "tone.placement",
  "tone.placement_style",
  "syllable.qu_onset",
  "syllable.gi_onset",
];

/** Mọi mã chẩn đoán bộ máy có thể trả về (rules.json chỉ được tham chiếu các mã này). */
export const ENGINE_DIAGNOSTIC_CODES: readonly DiagnosticCode[] = [
  "EMPTY",
  "INVALID_CHARACTER",
  "FOREIGN_LETTER",
  "STRAY_COMBINING_MARK",
  "MULTIPLE_TONE_MARKS",
  "TONE_MARK_ON_CONSONANT",
  "NO_VOWEL",
  "Q_WITHOUT_U",
  "CONSONANT_CLUSTER",
  "RIME_FORM_INVALID",
  "RIME_NOT_IN_CATALOG",
  "AMBIGUOUS_QU_Y",
  "SPELLING_C_K",
  "SPELLING_G_GH",
  "SPELLING_NG_NGH",
  "SPELLING_QU",
  "SPELLING_IE_YE",
  "TONE_STOP_CODA",
  "TONE_MARK_MISPLACED",
  "TONE_PLACEMENT_CONVENTION",
  "CONVENTION_DEPENDENT",
];

const PARSE_RULES: Partial<Record<ParseFailureCode, string>> = {
  MULTIPLE_TONE_MARKS: "tone.single_mark",
  NO_VOWEL: "syllable.has_vowel",
  Q_WITHOUT_U: "spelling.qu",
  RIME_FORM_INVALID: "spelling.diphthong_coda",
  AMBIGUOUS_QU_Y: "syllable.qu_onset",
};

export function diagnoseSyllable(input: string, inventory: SyllableInventory): SyllableDiagnosis {
  const parse = analyzeSyllable(input, inventory);
  if (parse.status !== "ok") {
    const diagnostic: SyllableDiagnostic = {
      code: parse.code,
      severity: parse.status === "invalid" ? "error" : "warning",
      ruleId: PARSE_RULES[parse.code] ?? null,
      message: parse.detail,
      suggestions:
        parse.status === "invalid"
          ? parse.suggestions
          : parse.status === "ambiguous"
            ? parse.candidates.map((candidate) => candidate.note)
            : [],
    };
    return {
      input,
      status: parse.status === "invalid" ? "error" : "unverified",
      analysis: null,
      parse,
      diagnostics: [diagnostic],
    };
  }

  const analysis = parse.analysis;
  const diagnostics: SyllableDiagnostic[] = checkSpelling(analysis).map((issue) => ({
    code: issue.code,
    severity: "error",
    ruleId: issue.ruleId,
    message: issue.message,
    suggestions: issue.suggestion ? [issue.suggestion] : [],
  }));

  const placement = checkTonePlacement(analysis);
  if (placement.status === "misplaced") {
    diagnostics.push({
      code: "TONE_MARK_MISPLACED",
      severity: "error",
      ruleId: "tone.placement",
      message: "Dấu thanh đặt sai vị trí (không khớp kiểu đặt dấu nào).",
      suggestions: [],
    });
  } else if (placement.status === "style_dependent") {
    diagnostics.push({
      code: "TONE_PLACEMENT_CONVENTION",
      severity: "warning",
      ruleId: "tone.placement_style",
      message:
        placement.matches === "on_main_vowel"
          ? "Dấu đặt trên âm chính (kiểu hoà) — cần nhà trường xác nhận kiểu đặt dấu."
          : "Dấu đặt trên âm đệm (kiểu hòa) — cần nhà trường xác nhận kiểu đặt dấu.",
      suggestions: [],
    });
  }

  const dependencies = analysis.conventionDependencies;
  if (dependencies.includes("qu_onset")) {
    diagnostics.push({
      code: "CONVENTION_DEPENDENT",
      severity: "warning",
      ruleId: "syllable.qu_onset",
      message: 'Phân tích dựa vào quy ước "qu" là một âm đầu.',
      suggestions: [],
    });
  }
  if (dependencies.includes("gi_onset")) {
    diagnostics.push({
      code: "CONVENTION_DEPENDENT",
      severity: "warning",
      ruleId: "syllable.gi_onset",
      message: dependencies.includes("gi_shared_i")
        ? 'Phân tích dựa vào quy ước "gi" là âm đầu và chữ "i" dùng chung với vần.'
        : 'Phân tích dựa vào quy ước "gi" là một âm đầu.',
      suggestions: [],
    });
  }

  return {
    input,
    status: diagnostics.some((diagnostic) => diagnostic.severity === "error") ? "error" : "ok",
    analysis,
    parse,
    diagnostics,
  };
}
