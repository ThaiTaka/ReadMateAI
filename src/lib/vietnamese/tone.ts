import { isCombiningMark, isVowelLetter, QUALITY_MARKS } from "./characters.ts";

/**
 * Sáu thanh tiếng Việt và dấu thanh tương ứng.
 *
 * Một chữ có dấu như "ế" được tách thành: chữ cái "ê" (chữ gốc + dấu mũ) và dấu thanh sắc.
 * Thư viện làm việc trên dạng tách này nên không phụ thuộc chuỗi đầu vào là NFC hay NFD.
 */

export const TONE_IDS = ["ngang", "huyen", "sac", "hoi", "nga", "nang"] as const;
export type ToneId = (typeof TONE_IDS)[number];

/** Dấu thanh dạng tổ hợp Unicode. Thanh ngang không có dấu. */
export const TONE_COMBINING_MARKS: Readonly<Record<Exclude<ToneId, "ngang">, string>> = {
  huyen: "\u0300",
  sac: "\u0301",
  hoi: "\u0309",
  nga: "\u0303",
  nang: "\u0323",
};

const MARK_TO_TONE: ReadonlyMap<string, ToneId> = new Map(
  Object.entries(TONE_COMBINING_MARKS).map(([tone, mark]) => [mark, tone as ToneId]),
);

/** Thanh tương ứng với một dấu tổ hợp, hoặc `null` nếu đó không phải dấu thanh. */
export function toneOfMark(mark: string): ToneId | null {
  return MARK_TO_TONE.get(mark) ?? null;
}

export type ToneExtractionFailure = {
  ok: false;
  code: "MULTIPLE_TONE_MARKS" | "TONE_MARK_ON_CONSONANT" | "STRAY_COMBINING_MARK" | "UNKNOWN_MARK";
  /** Vị trí ký tự (tính theo ký tự, không theo đơn vị UTF-16) gây lỗi. */
  index: number;
};

export type ToneExtraction =
  | {
      ok: true;
      tone: ToneId;
      /** Chuỗi đã bỏ dấu thanh (vẫn giữ ă, â, ê, ô, ơ, ư, đ), ở dạng NFC. */
      base: string;
      /** Vị trí ký tự mang dấu thanh trong `base`; `null` với thanh ngang. */
      markIndex: number | null;
    }
  | ToneExtractionFailure;

/**
 * Tách dấu thanh khỏi một chuỗi chữ thường (thường là một tiếng).
 * Không sửa gì: chuỗi có hai dấu thanh, dấu thanh đặt trên phụ âm hoặc dấu lạ đều bị báo lỗi.
 */
export function extractTone(text: string): ToneExtraction {
  const chars = Array.from(text.normalize("NFC"));
  const baseChars: string[] = [];
  let tone: ToneId = "ngang";
  let markIndex: number | null = null;

  for (const [index, char] of chars.entries()) {
    if (isCombiningMark(char)) {
      // Dấu tổ hợp còn sót sau NFC: không gắn được vào chữ đứng trước (ví dụ gõ dấu thanh trước dấu mũ).
      return { ok: false, code: "STRAY_COMBINING_MARK", index };
    }
    const [letter = "", ...marks] = Array.from(char.normalize("NFD"));
    let qualityMarks = "";
    for (const mark of marks) {
      const markTone = toneOfMark(mark);
      if (markTone) {
        if (markIndex !== null) return { ok: false, code: "MULTIPLE_TONE_MARKS", index };
        tone = markTone;
        markIndex = index;
      } else if (QUALITY_MARKS.has(mark)) {
        qualityMarks += mark;
      } else {
        return { ok: false, code: "UNKNOWN_MARK", index };
      }
    }
    const base = (letter + qualityMarks).normalize("NFC");
    if (markIndex === index && !isVowelLetter(base)) {
      return { ok: false, code: "TONE_MARK_ON_CONSONANT", index };
    }
    baseChars.push(base);
  }

  return { ok: true, tone, base: baseChars.join(""), markIndex };
}

/** Bỏ dấu thanh, giữ nguyên các chữ ă, â, ê, ô, ơ, ư, đ (không dùng để so sánh đáp án). */
export function stripTones(text: string): string {
  return Array.from(text.normalize("NFD"))
    .filter((char) => toneOfMark(char) === null)
    .join("")
    .normalize("NFC");
}

/**
 * Đặt dấu thanh lên ký tự ở vị trí `index` của chuỗi không dấu thanh `base`.
 * Dùng để tạo gợi ý sửa lỗi (ví dụ "kà" → "cà"); trả về NFC.
 */
export function applyTone(base: string, tone: ToneId, index: number | null): string {
  if (tone === "ngang" || index === null) return base.normalize("NFC");
  const chars = Array.from(base.normalize("NFC"));
  const target = chars[index];
  if (target === undefined) throw new RangeError(`Vị trí đặt dấu thanh ${index} nằm ngoài chuỗi "${base}"`);
  chars[index] = (target + TONE_COMBINING_MARKS[tone]).normalize("NFC");
  return chars.join("");
}
