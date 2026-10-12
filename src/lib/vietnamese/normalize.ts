/**
 * Chuẩn hóa văn bản tiếng Việt — mầm của thư viện ngôn ngữ (docs/ARCHITECTURE.md §10).
 *
 * Cùng một chữ "ế" có thể được lưu ở dạng dựng sẵn (NFC, 1 ký tự) hoặc dạng tổ hợp
 * (NFD, chữ gốc + dấu). Mọi văn bản phải được đưa về NFC trước khi lưu, so sánh, chấm
 * điểm hay dựng PDF; nếu không, "Tiếng Việt" gõ từ hai nguồn khác nhau sẽ bị coi là khác nhau.
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
