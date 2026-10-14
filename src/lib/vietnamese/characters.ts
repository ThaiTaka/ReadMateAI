/**
 * Kho ký tự của chữ viết tiếng Việt — dữ kiện cố định của bảng chữ cái, dùng chung cho
 * thư viện ngôn ngữ và bộ kiểm tra nội dung (content/kb/letters.json phải khớp với tệp này).
 *
 * Mọi chuỗi ở dạng NFC. Chữ có dấu thanh (à, ế, ự…) KHÔNG phải chữ cái riêng: đó là chữ cái
 * nguyên âm mang thêm dấu thanh — xem tone.ts.
 */

/** 29 chữ cái theo thứ tự bảng chữ cái tiếng Việt hiện hành (chữ thường). */
export const VIETNAMESE_ALPHABET = [
  "a",
  "ă",
  "â",
  "b",
  "c",
  "d",
  "đ",
  "e",
  "ê",
  "g",
  "h",
  "i",
  "k",
  "l",
  "m",
  "n",
  "o",
  "ô",
  "ơ",
  "p",
  "q",
  "r",
  "s",
  "t",
  "u",
  "ư",
  "v",
  "x",
  "y",
] as const;

export type VietnameseLetter = (typeof VIETNAMESE_ALPHABET)[number];

/** 12 chữ cái nguyên âm (chưa mang dấu thanh). */
export const VOWEL_LETTERS: ReadonlySet<string> = new Set(["a", "ă", "â", "e", "ê", "i", "o", "ô", "ơ", "u", "ư", "y"]);

/** Chữ Latinh không thuộc bảng chữ cái tiếng Việt — thường xuất hiện ở từ mượn hoặc gõ nhầm. */
export const FOREIGN_LATIN_LETTERS: ReadonlySet<string> = new Set(["f", "j", "w", "z"]);

/**
 * Dấu phụ tạo chữ cái (không phải dấu thanh): ă (trăng), â ê ô (mũ), ơ ư (móc).
 * Dạng tổ hợp Unicode (combining) — dùng khi tách chữ thành chữ gốc + dấu.
 */
export const QUALITY_MARKS: ReadonlySet<string> = new Set(["\u0306", "\u0302", "\u031B"]);

const ALPHABET_SET: ReadonlySet<string> = new Set(VIETNAMESE_ALPHABET);

/** `true` nếu `char` (một ký tự, chữ thường, không dấu thanh) là một trong 29 chữ cái. */
export function isAlphabetLetter(char: string): boolean {
  return ALPHABET_SET.has(char);
}

/** `true` nếu `char` (chữ thường, không dấu thanh) là chữ cái nguyên âm. */
export function isVowelLetter(char: string): boolean {
  return VOWEL_LETTERS.has(char);
}

/** Chữ hoa tương ứng của một chữ cái (chữ hoa của đ là Đ). */
export function toUpperLetter(letter: VietnameseLetter): string {
  return letter.toUpperCase();
}

/** `true` nếu ký tự là dấu tổ hợp Unicode (Mark). */
export function isCombiningMark(char: string): boolean {
  return /^\p{M}$/u.test(char);
}
