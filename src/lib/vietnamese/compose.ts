import { analyzeSyllable, type SyllableAnalysis, type SyllableInventory } from "./syllable.ts";
import { applyTone, type ToneId } from "./tone.ts";
import { expectedToneIndex, type TonePlacementStyle } from "./tone-placement.ts";

/**
 * Ghép âm đầu + vần + thanh thành chữ viết của một tiếng — chiều ngược lại của `analyzeSyllable`.
 *
 * Dùng cho bài ghép tiếng / điền phần còn thiếu: hệ thống phải biết chắc học sinh ghép ra chữ gì
 * để so với đáp án. Kết quả luôn được phân tích lại (khứ hồi): nếu chữ ghép ra được bộ phân tích
 * hiểu theo cách khác (ví dụ "g" + "ia" đọc thành "gi" + "a"), phép ghép bị coi là mơ hồ thay vì
 * âm thầm chấp nhận. Hàm KHÔNG kiểm tra chính tả — chữ sai quy tắc ("k" + "a" → "ka") vẫn được ghép
 * để làm phương án nhiễu; nơi gọi dùng `diagnoseSyllable` khi cần biết chữ có viết đúng không.
 */

export type ComposeParts = { onset: string | null; rime: string; tone: ToneId };

export type ComposeFailureCode = "UNPARSABLE" | "AMBIGUOUS_COMPOSITION" | "TONE_STYLE_REQUIRED";

export type ComposeResult =
  | { ok: true; text: string; analysis: SyllableAnalysis; styleDependent: boolean }
  | { ok: false; code: ComposeFailureCode; detail: string };

/** Chữ viết của âm đầu + vần (chưa có dấu thanh). "gi" dùng chung chữ "i" với vần bắt đầu bằng "i". */
export function joinOnsetRime(onset: string | null, rime: string): string {
  if (onset === null) return rime;
  if (onset === "gi" && rime.startsWith("i")) return `g${rime}`;
  return `${onset}${rime}`;
}

/**
 * Ghép một tiếng. `style` là kiểu đặt dấu của nhà trường (quy ước chưa xác nhận → `null`):
 * với các vần mà hai kiểu đặt dấu khác nhau (oa, oe, uy không âm cuối), thiếu `style` thì không ghép.
 */
export function composeSyllable(
  parts: ComposeParts,
  inventory: SyllableInventory,
  style: TonePlacementStyle | "either" | null = null,
): ComposeResult {
  const base = joinOnsetRime(parts.onset, parts.rime);
  const parsed = analyzeSyllable(base, inventory);
  if (parsed.status !== "ok") {
    return { ok: false, code: "UNPARSABLE", detail: `Không phân tích được "${base}".` };
  }
  const analysis = parsed.analysis;
  if (analysis.onset !== parts.onset || analysis.rime !== parts.rime) {
    return {
      ok: false,
      code: "AMBIGUOUS_COMPOSITION",
      detail: `"${base}" được đọc thành ${analysis.onset ?? "∅"} + ${analysis.rime}, không phải ${parts.onset ?? "∅"} + ${parts.rime}.`,
    };
  }
  if (parts.tone === "ngang") return { ok: true, text: base, analysis, styleDependent: false };

  const expected = expectedToneIndex(analysis);
  const styleDependent = expected.on_main_vowel !== expected.traditional;
  if (styleDependent && style === null) {
    return {
      ok: false,
      code: "TONE_STYLE_REQUIRED",
      detail: `Vị trí dấu thanh của "${base}" phụ thuộc kiểu đặt dấu (hoà/hòa) chưa được xác nhận.`,
    };
  }
  const index = style === "traditional" ? expected.traditional : expected.on_main_vowel;
  const text = applyTone(base, parts.tone, index);
  const reparsed = analyzeSyllable(text, inventory);
  if (reparsed.status !== "ok" || reparsed.analysis.tone !== parts.tone) {
    return { ok: false, code: "UNPARSABLE", detail: `Không phân tích lại được "${text}".` };
  }
  return { ok: true, text, analysis: reparsed.analysis, styleDependent };
}

/**
 * Viết một vần kèm dấu thanh khi vần đứng riêng (ví dụ phương án "àn" trong bài điền vần).
 * Trả về `null` nếu không xác định được vị trí dấu.
 */
export function tonedRime(
  rime: string,
  tone: ToneId,
  inventory: SyllableInventory,
  style: TonePlacementStyle | "either" | null = null,
): string | null {
  const result = composeSyllable({ onset: null, rime, tone }, inventory, style);
  return result.ok ? result.text : null;
}
