/**
 * Chuẩn hóa và soát văn bản tiếng Việt (docs/ARCHITECTURE.md §10, docs/VIETNAMESE_ENGINE.md §3).
 *
 * Cùng một chữ "ế" có thể được lưu ở dạng dựng sẵn (NFC, 1 ký tự) hoặc dạng tổ hợp
 * (NFD, chữ gốc + dấu). Mọi văn bản phải được đưa về NFC trước khi lưu, so sánh, chấm
 * điểm hay dựng PDF; nếu không, "Tiếng Việt" gõ từ hai nguồn khác nhau sẽ bị coi là khác nhau.
 *
 * Nguyên tắc: chỉ tự động áp dụng những biến đổi không đổi nghĩa (NFC, khoảng trắng). Mọi điểm
 * bất thường khác (ký tự ẩn, dấu sót, nghi bảng mã cũ) được BÁO CÁO, không âm thầm sửa.
 */

/** Đưa chuỗi về dạng NFC. */
export function toNFC(text: string): string {
  return text.normalize("NFC");
}

/** `true` nếu chuỗi đã ở dạng NFC. */
export function isNFC(text: string): boolean {
  return text === text.normalize("NFC");
}

/** So sánh hai chuỗi tiếng Việt sau khi cùng đưa về NFC (phân biệt dấu thanh, hoa/thường). */
export function equalsNFC(a: string, b: string): boolean {
  return toNFC(a) === toNFC(b);
}

/** Chữ thường theo quy tắc Unicode (Đ → đ, Ư → ư), giữ nguyên dấu; trả về NFC. */
export function toLowerVi(text: string): string {
  return toNFC(text).toLowerCase();
}

/** So sánh không phân biệt hoa/thường nhưng vẫn phân biệt dấu thanh và dấu chữ. */
export function equalsIgnoreCase(a: string, b: string): boolean {
  return toLowerVi(a) === toLowerVi(b);
}

/** Thu gọn mọi khoảng trắng (kể cả khoảng trắng không ngắt dòng U+00A0) thành một dấu cách và cắt hai đầu. */
export function normalizeWhitespace(text: string): string {
  return text.replace(/[\s\u00A0]+/gu, " ").trim();
}

const INVISIBLE_CHARS = /[\u200B-\u200D\u2060\uFEFF\u00AD]/u;
const CONTROL_CHARS = /[\p{Cc}]/u;
const NON_LATIN_LETTERS = /[\p{Script=Cyrillic}\p{Script=Greek}]/u;

/**
 * Ký tự Latin-1 không thuộc chữ viết tiếng Việt nhưng hay xuất hiện khi văn bản soạn bằng
 * bảng mã cũ được dán vào môi trường Unicode. Văn bản tiếng Việt Unicode hợp lệ không bao giờ
 * chứa các ký tự này, nên việc phát hiện không thể làm sai lệch chuỗi hợp lệ.
 */
const LEGACY_LETTERS =
  "\u00C4-\u00C7\u00CB\u00CE\u00CF\u00D0\u00D1\u00D6\u00D8\u00DB\u00DC\u00DE\u00DF\u00E4-\u00E7\u00EB\u00EE\u00EF\u00F0\u00F1\u00F6\u00F8\u00FB\u00FC\u00FE\u00FF";
/**
 * Ký hiệu chỉ bị nghi khi dính liền với chữ (như "Hµ Néi"), để "© 2026" hay "30°C" không bị báo nhầm.
 * Không gồm « » vì là dấu ngoặc kép hợp lệ.
 */
const LEGACY_SYMBOLS = "\u00A8-\u00AA\u00AC\u00AE\u00B5-\u00B9\u00BC-\u00BE\u00D7\u00F7";
const LEGACY_SUSPECT_CHARS = new RegExp(
  `[${LEGACY_LETTERS}]|(?<=\\p{L})[${LEGACY_SYMBOLS}]|[${LEGACY_SYMBOLS}](?=\\p{L})`,
  "gu",
);
const TCVN3_MARKERS = /[\u00A8-\u00AA\u00AC\u00AE\u00B5-\u00B9\u00BC-\u00BE\u00D6\u00D7\u00DE\u00DF\u00F7\u00FE]/u;
const VNI_MARKERS = /[aeiouyAEIOUY][\u00E4-\u00E7\u00EB\u00EF\u00F6\u00F8\u00FB\u00FC]|[\u00D1\u00F1]/u;

export type LegacyEncodingGuess = {
  suspected: boolean;
  /** Bảng mã có khả năng cao nhất; chỉ là phỏng đoán để người soạn biết cần chuyển mã. */
  likelyEncoding: "tcvn3" | "vni" | "unknown_legacy" | null;
  /** Các ký tự đáng ngờ tìm thấy (không trùng lặp). */
  characters: string[];
};

/**
 * Phát hiện văn bản có dấu hiệu được dán từ bảng mã cũ (TCVN3/ABC, VNI).
 * Chỉ phát hiện — KHÔNG chuyển mã (chuyển mã tự động dễ làm hỏng chữ; cần người soạn làm lại từ nguồn).
 */
export function detectLegacyEncoding(text: string): LegacyEncodingGuess {
  const found = Array.from(new Set(text.match(LEGACY_SUSPECT_CHARS) ?? []));
  if (found.length === 0) return { suspected: false, likelyEncoding: null, characters: [] };
  const likelyEncoding = TCVN3_MARKERS.test(text) ? "tcvn3" : VNI_MARKERS.test(text) ? "vni" : "unknown_legacy";
  return { suspected: true, likelyEncoding, characters: found };
}

export type TextIssueCode =
  | "NOT_NFC"
  | "RESIDUAL_COMBINING_MARK"
  | "INVISIBLE_CHARACTER"
  | "CONTROL_CHARACTER"
  | "IRREGULAR_WHITESPACE"
  | "NON_LATIN_LETTER"
  | "LEGACY_ENCODING_SUSPECTED";

export type TextIssue = { code: TextIssueCode; message: string };

const TEXT_ISSUE_MESSAGES: Readonly<Record<TextIssueCode, string>> = {
  NOT_NFC: "Văn bản chưa ở dạng Unicode NFC (dấu được lưu tách rời khỏi chữ).",
  RESIDUAL_COMBINING_MARK:
    "Còn dấu tổ hợp không gắn được vào chữ sau khi chuẩn hóa — thường do gõ dấu thanh trước dấu mũ/móc hoặc dấu đặt sai chỗ.",
  INVISIBLE_CHARACTER: "Có ký tự ẩn (zero-width, BOM, gạch nối mềm) — thường lọt vào khi sao chép.",
  CONTROL_CHARACTER: "Có ký tự điều khiển (tab, xuống dòng hoặc ký tự lạ) trong văn bản một dòng.",
  IRREGULAR_WHITESPACE: "Khoảng trắng không chuẩn: thừa ở đầu/cuối, hai dấu cách liền nhau hoặc khoảng trắng đặc biệt.",
  NON_LATIN_LETTER: "Có chữ Kirin/Hy Lạp trông giống chữ Latinh (ví dụ '\u0430' Kirin thay cho 'a').",
  LEGACY_ENCODING_SUSPECTED: "Nghi văn bản được dán từ bảng mã cũ (TCVN3/VNI) — cần soạn lại bằng Unicode.",
};

/** Soát một chuỗi văn bản một dòng; không sửa gì, chỉ liệt kê vấn đề. */
export function inspectText(text: string): TextIssue[] {
  const codes: TextIssueCode[] = [];
  if (!isNFC(text)) codes.push("NOT_NFC");
  if (hasResidualMarks(text)) codes.push("RESIDUAL_COMBINING_MARK");
  if (INVISIBLE_CHARS.test(text)) codes.push("INVISIBLE_CHARACTER");
  if (CONTROL_CHARS.test(text)) codes.push("CONTROL_CHARACTER");
  if (text !== normalizeWhitespace(text) || /\u00A0/u.test(text)) codes.push("IRREGULAR_WHITESPACE");
  if (NON_LATIN_LETTERS.test(text)) codes.push("NON_LATIN_LETTER");
  if (detectLegacyEncoding(text).suspected) codes.push("LEGACY_ENCODING_SUSPECTED");
  return codes.map((code) => ({ code, message: TEXT_ISSUE_MESSAGES[code] }));
}

/** `true` nếu sau NFC vẫn còn dấu tổ hợp đứng riêng (không ghép được với chữ trước nó). */
export function hasResidualMarks(text: string): boolean {
  return Array.from(toNFC(text)).some((char) => /^\p{M}$/u.test(char));
}

export type PreparedText = {
  /** Văn bản sau khi áp dụng các biến đổi an toàn (NFC + khoảng trắng). */
  text: string;
  /** Những biến đổi đã thực sự xảy ra — để ghi nhận, không âm thầm. */
  changes: Array<"nfc" | "whitespace">;
  /** Những vấn đề còn lại cần người soạn xử lý (không tự sửa). */
  issues: TextIssue[];
};

/**
 * Chuẩn bị văn bản trước khi lưu/so sánh: chỉ áp dụng NFC và chuẩn hóa khoảng trắng,
 * báo cáo rõ đã đổi gì; mọi vấn đề khác được trả về trong `issues`.
 */
export function prepareText(text: string): PreparedText {
  const changes: PreparedText["changes"] = [];
  let result = text;
  if (!isNFC(result)) {
    result = toNFC(result);
    changes.push("nfc");
  }
  const spaced = normalizeWhitespace(result);
  if (spaced !== result) {
    result = spaced;
    changes.push("whitespace");
  }
  return { text: result, changes, issues: inspectText(result) };
}
