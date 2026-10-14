import { diagnoseSyllable, type SyllableDiagnosis, type SyllableDiagnostic } from "./diagnostics.ts";
import {
  isBareVowelRime,
  type ConventionDependency,
  type SyllableAnalysis,
  type SyllableInventory,
} from "./syllable.ts";
import { checkTonePlacement, type TonePlacementStyle } from "./tone-placement.ts";
import { tokenize } from "./tokenize.ts";

/**
 * Kiểm tra một tiếng/từ/câu có GIẢI MÃ ĐƯỢC bằng các đơn vị chữ–âm đã học hay không.
 *
 * Phạm vi: CHỈ khả năng giải mã chữ–âm. Độ quen thuộc từ vựng và yêu cầu đọc hiểu được đánh giá
 * riêng (features/knowledge/readability.ts). Kết quả `readable` nghĩa là "mọi đơn vị cần thiết đều
 * nằm trong danh sách đã học được khai báo" — KHÔNG khẳng định học sinh thực tế đọc được.
 *
 * Đơn vị kiến thức (mã ổn định, khớp content/kb):
 * - âm đầu: `phoneme:<chữ ghi âm>` (ví dụ `phoneme:ngh`)
 * - vần: `rime:<vần>`; riêng vần chỉ gồm một nguyên âm đơn được tính là âm `phoneme:<nguyên âm>`
 * - thanh: `tone:<mã thanh>` (`tone:ngang`, `tone:huyen`…)
 */

export type UnitId = string;

/** Quy ước nhà trường; `null` = chưa được giáo viên xác nhận/khai báo. */
export type LanguageConventions = {
  quAnalysis: "qu_onset" | null;
  giAnalysis: "gi_onset" | null;
  giSharedI: "shared_i" | null;
  tonePlacement: TonePlacementStyle | "either" | null;
};

export const UNSET_CONVENTIONS: LanguageConventions = {
  quAnalysis: null,
  giAnalysis: null,
  giSharedI: null,
  tonePlacement: null,
};

export type DecodingVerdict = "readable" | "not_yet_learned" | "unknown" | "invalid";

export type ReasonCode =
  | "ALL_UNITS_TAUGHT"
  | "UNITS_NOT_TAUGHT"
  | "PARSE_INVALID"
  | "PARSE_UNRECOGNIZED"
  | "PARSE_AMBIGUOUS"
  | "SPELLING_ERROR"
  | "TONE_MARK_MISPLACED"
  | "CONVENTION_NOT_CONFIRMED"
  | "NUMBER_TOKEN"
  | "UNSUPPORTED_SYMBOL"
  | "EMPTY_TEXT"
  /** Dùng ở lớp nghiệp vụ: hồ sơ lớp chưa có dữ liệu tiến độ để kết luận. */
  | "PROFILE_NOT_USABLE";

export type Reason = { code: ReasonCode; message: string; details?: readonly string[] };

export type CaveatCode = "UPPERCASE_LETTERS" | "TONE_PLACEMENT_CONVENTION" | "TONE_PLACEMENT_STYLE_MISMATCH";
export type Caveat = { code: CaveatCode; message: string };

export type SyllableDecoding = {
  token: string;
  start: number;
  end: number;
  status: DecodingVerdict;
  analysis: SyllableAnalysis | null;
  requiredUnits: UnitId[];
  knownUnits: UnitId[];
  missingUnits: UnitId[];
  reasons: Reason[];
};

export type DecodingResult = {
  verdict: DecodingVerdict;
  syllables: SyllableDecoding[];
  /** Đơn vị cần biết (hợp của mọi tiếng, theo thứ tự xuất hiện). */
  requiredUnits: UnitId[];
  knownUnits: UnitId[];
  missingUnits: UnitId[];
  /** Những phần chưa thể xác minh (token, mã, lý do). */
  unverifiable: Array<{ token: string; code: ReasonCode; message: string }>;
  reasons: Reason[];
  caveats: Caveat[];
};

export type DecodingContext = {
  inventory: SyllableInventory;
  taughtUnits: ReadonlySet<UnitId>;
  conventions: LanguageConventions;
};

/** Các đơn vị cần biết để giải mã một tiếng đã phân tích (theo phân tích tạm thời của thư viện). */
export function requiredUnitsOf(analysis: SyllableAnalysis): { onset: UnitId | null; rime: UnitId; tone: UnitId } {
  return {
    onset: analysis.onset === null ? null : `phoneme:${analysis.onset}`,
    rime: isBareVowelRime(analysis) ? `phoneme:${analysis.nucleus}` : `rime:${analysis.rime}`,
    tone: `tone:${analysis.tone}`,
  };
}

/** Các quy ước mà phân tích dựa vào nhưng hồ sơ chưa khai báo/xác nhận. */
export function unmetConventions(
  analysis: Pick<SyllableAnalysis, "conventionDependencies">,
  conventions: LanguageConventions,
): ConventionDependency[] {
  return analysis.conventionDependencies.filter((dependency) => {
    if (dependency === "qu_onset") return conventions.quAnalysis !== "qu_onset";
    if (dependency === "gi_onset") return conventions.giAnalysis !== "gi_onset";
    return conventions.giSharedI !== "shared_i";
  });
}

const CONVENTION_LABELS: Readonly<Record<ConventionDependency, string>> = {
  qu_onset: '"qu" là một âm đầu',
  gi_onset: '"gi" là một âm đầu',
  gi_shared_i: 'chữ "i" của "gi" dùng chung với vần (gì, gìn, giếng)',
};

export function checkSyllableDecodability(
  token: { text: string; start: number; end: number },
  context: DecodingContext,
): SyllableDecoding {
  const base = { token: token.text, start: token.start, end: token.end };
  const empty = { requiredUnits: [], knownUnits: [], missingUnits: [] };
  const diagnosis = diagnoseSyllable(token.text, context.inventory);

  if (diagnosis.status !== "ok" || diagnosis.analysis === null) {
    const isError = diagnosis.status === "error";
    const reasons = diagnosis.diagnostics
      .filter((diagnostic) => !isError || diagnostic.severity === "error")
      .map((diagnostic): Reason => {
        const details = diagnostic.suggestions.map((suggestion) => `gợi ý: ${suggestion}`);
        return {
          code: reasonCodeOf(diagnosis, diagnostic.code),
          message: `"${token.text}": ${diagnostic.message}`,
          ...(details.length > 0 ? { details } : {}),
        };
      });
    return { ...base, ...empty, status: isError ? "invalid" : "unknown", analysis: diagnosis.analysis, reasons };
  }

  const analysis = diagnosis.analysis;
  const units = requiredUnitsOf(analysis);
  const requiredUnits = [units.onset, units.rime, units.tone].filter((unit): unit is UnitId => unit !== null);
  const knownUnits = requiredUnits.filter((unit) => context.taughtUnits.has(unit));
  const missingUnits = requiredUnits.filter((unit) => !context.taughtUnits.has(unit));
  const unmet = unmetConventions(analysis, context.conventions);

  if (unmet.length > 0) {
    // Âm đầu và vần phụ thuộc quy ước; chỉ thanh là chắc chắn — thiếu thanh thì chắc chắn chưa học.
    const certainMissing = missingUnits.filter((unit) => unit === units.tone);
    const reasons: Reason[] = [
      {
        code: "CONVENTION_NOT_CONFIRMED",
        message: `"${token.text}": phân tích dựa vào quy ước chưa được xác nhận.`,
        details: unmet.map((dependency) => CONVENTION_LABELS[dependency]),
      },
    ];
    if (certainMissing.length > 0) {
      reasons.push({ code: "UNITS_NOT_TAUGHT", message: `"${token.text}": thanh chưa học.`, details: certainMissing });
    }
    return {
      ...base,
      status: certainMissing.length > 0 ? "not_yet_learned" : "unknown",
      analysis,
      requiredUnits,
      knownUnits,
      missingUnits,
      reasons,
    };
  }

  return {
    ...base,
    status: missingUnits.length > 0 ? "not_yet_learned" : "readable",
    analysis,
    requiredUnits,
    knownUnits,
    missingUnits,
    reasons:
      missingUnits.length > 0
        ? [{ code: "UNITS_NOT_TAUGHT", message: `"${token.text}": có đơn vị chưa học.`, details: missingUnits }]
        : [{ code: "ALL_UNITS_TAUGHT", message: `"${token.text}": mọi đơn vị đều đã học.` }],
  };
}

function reasonCodeOf(diagnosis: SyllableDiagnosis, code: SyllableDiagnostic["code"]): ReasonCode {
  if (diagnosis.parse.status === "ambiguous") return "PARSE_AMBIGUOUS";
  if (diagnosis.parse.status === "unrecognized") return "PARSE_UNRECOGNIZED";
  if (diagnosis.parse.status === "invalid") return "PARSE_INVALID";
  return code === "TONE_MARK_MISPLACED" ? "TONE_MARK_MISPLACED" : "SPELLING_ERROR";
}

const VERDICT_PRIORITY: readonly DecodingVerdict[] = ["invalid", "not_yet_learned", "unknown", "readable"];

/** Kiểm tra một văn bản (tiếng, từ hoặc câu). Dấu câu được bỏ qua; số và ký hiệu lạ là "chưa xác định". */
export function checkDecodability(text: string, context: DecodingContext): DecodingResult {
  const tokens = tokenize(text);
  const syllables: SyllableDecoding[] = [];
  const unverifiable: DecodingResult["unverifiable"] = [];
  let otherVerdict: DecodingVerdict | null = null;

  for (const token of tokens) {
    if (token.kind === "syllable") {
      syllables.push(checkSyllableDecodability(token, context));
    } else if (token.kind === "number") {
      unverifiable.push({
        token: token.text,
        code: "NUMBER_TOKEN",
        message: `"${token.text}": chữ số nằm ngoài phạm vi giải mã chữ–âm.`,
      });
      otherVerdict = otherVerdict ?? "unknown";
    } else if (token.kind === "symbol") {
      unverifiable.push({
        token: token.text,
        code: "UNSUPPORTED_SYMBOL",
        message: `"${token.text}": ký hiệu chưa được hỗ trợ.`,
      });
      otherVerdict = otherVerdict ?? "unknown";
    }
  }

  if (syllables.length === 0 && unverifiable.length === 0) {
    return {
      verdict: "invalid",
      syllables,
      requiredUnits: [],
      knownUnits: [],
      missingUnits: [],
      unverifiable,
      reasons: [{ code: "EMPTY_TEXT", message: "Không có chữ nào để kiểm tra." }],
      caveats: [],
    };
  }

  for (const syllable of syllables) {
    for (const reason of syllable.reasons) {
      if (syllable.status === "unknown" || reason.code === "CONVENTION_NOT_CONFIRMED") {
        unverifiable.push({ token: syllable.token, code: reason.code, message: reason.message });
      }
    }
  }

  const statuses = new Set<DecodingVerdict>([
    ...syllables.map((syllable) => syllable.status),
    ...(otherVerdict ? [otherVerdict] : []),
  ]);
  const verdict = VERDICT_PRIORITY.find((candidate) => statuses.has(candidate)) ?? "readable";
  const union = (pick: (syllable: SyllableDecoding) => UnitId[]) => Array.from(new Set(syllables.flatMap(pick)));

  return {
    verdict,
    syllables,
    requiredUnits: union((syllable) => syllable.requiredUnits),
    knownUnits: union((syllable) => syllable.knownUnits),
    missingUnits: union((syllable) => syllable.missingUnits),
    unverifiable,
    reasons: summarizeReasons(verdict, syllables),
    caveats: collectCaveats(syllables, context.conventions),
  };
}

function summarizeReasons(verdict: DecodingVerdict, syllables: readonly SyllableDecoding[]): Reason[] {
  const reasons = syllables.filter((syllable) => syllable.status === verdict).flatMap((syllable) => syllable.reasons);
  if (verdict === "readable") {
    return [{ code: "ALL_UNITS_TAUGHT", message: "Mọi tiếng đều giải mã được bằng các đơn vị đã khai báo là đã học." }];
  }
  return reasons;
}

function collectCaveats(syllables: readonly SyllableDecoding[], conventions: LanguageConventions): Caveat[] {
  const caveats: Caveat[] = [];
  const upper = syllables.filter((syllable) => syllable.analysis?.hasUppercase).map((syllable) => syllable.token);
  if (upper.length > 0) {
    caveats.push({
      code: "UPPERCASE_LETTERS",
      message: `Có chữ viết hoa (${upper.join(", ")}): cần chắc học sinh đã nhận biết chữ hoa tương ứng.`,
    });
  }
  for (const syllable of syllables) {
    if (!syllable.analysis) continue;
    const placement = checkTonePlacement(syllable.analysis);
    if (placement.status !== "style_dependent") continue;
    if (conventions.tonePlacement === null) {
      caveats.push({
        code: "TONE_PLACEMENT_CONVENTION",
        message: `"${syllable.token}": vị trí dấu thanh phụ thuộc quy ước (hoà/hòa) chưa được xác nhận.`,
      });
    } else if (conventions.tonePlacement !== "either" && conventions.tonePlacement !== placement.matches) {
      caveats.push({
        code: "TONE_PLACEMENT_STYLE_MISMATCH",
        message: `"${syllable.token}": đặt dấu khác kiểu nhà trường đã chọn.`,
      });
    }
  }
  return caveats;
}
