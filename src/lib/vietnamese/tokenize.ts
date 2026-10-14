import { toNFC } from "./normalize.ts";

/**
 * Tách văn bản thành các đơn vị: chuỗi chữ (ứng viên tiếng), dấu câu, số, ký hiệu khác.
 *
 * Chữ viết tiếng Việt tách tiếng bằng dấu cách; một TỪ có thể gồm nhiều tiếng ("quả na").
 * Việc gộp tiếng thành từ là bài toán khó — ở đây chỉ làm bằng đối chiếu ngân hàng từ
 * (xem features/knowledge/readability.ts) và không khẳng định ranh giới từ ngoài ngân hàng.
 */

export type TokenKind = "syllable" | "punctuation" | "number" | "symbol";

export type Token = { kind: TokenKind; text: string; start: number; end: number };

const TOKEN_PATTERN = /([\p{L}\p{M}]+)|(\p{N}+)|([.,!?;:…"'“”‘’()[\]«»\-–—])|(\S)/gu;

/** Tách văn bản (đã đưa về NFC) thành token; vị trí `start`/`end` tính theo chuỗi NFC. */
export function tokenize(text: string): Token[] {
  const source = toNFC(text);
  const tokens: Token[] = [];
  for (const match of source.matchAll(TOKEN_PATTERN)) {
    const [whole, letters, digits, punctuation] = match;
    const start = match.index;
    const kind: TokenKind = letters ? "syllable" : digits ? "number" : punctuation ? "punctuation" : "symbol";
    tokens.push({ kind, text: whole, start, end: start + whole.length });
  }
  return tokens;
}

/** Chỉ lấy các chuỗi chữ (ứng viên tiếng) theo thứ tự xuất hiện. */
export function syllableTokens(text: string): Token[] {
  return tokenize(text).filter((token) => token.kind === "syllable");
}
