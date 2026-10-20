/**
 * Chuẩn hóa và kiểm tra biệt danh / tên hiển thị trên bảng xếp hạng (R03).
 *
 * Hàm thuần, chạy được trực tiếp bằng Node 24 (script seed) — import tương đối có đuôi `.ts`.
 * Quy tắc trùng khớp ràng buộc CSDL `private.is_clean_text` (migration 20261020090000): NFC, cắt khoảng
 * trắng, không ký tự điều khiển/ẩn; thêm ở đây: chỉ chữ (kể cả tiếng Việt có dấu), số, khoảng trắng đơn,
 * gạch nối — chặn emoji, ký hiệu và chuỗi giống liên kết/email.
 */

export const DISPLAY_NAME_MAX = 30;
export const ALIAS_MAX = 20;
/** Biệt danh từ 3 tiếng trở lên dễ là họ tên đầy đủ — không thu họ tên đầy đủ của trẻ (CLAUDE.md §6.1). */
export const MAX_NAME_WORDS = 2;

export type NameIssue = "EMPTY" | "TOO_LONG" | "INVALID_CHARACTERS" | "LOOKS_LIKE_FULL_NAME";
export type NameCheck = { ok: true; value: string } | { ok: false; issue: NameIssue };

const ALLOWED = /^[\p{L}\p{M}\p{N}]+(?:[ -][\p{L}\p{M}\p{N}]+)*$/u;

/** NFC + gộp mọi khoảng trắng (kể cả khoảng trắng không ngắt) thành một dấu cách + cắt hai đầu. */
export function normalizeName(raw: string): string {
  return raw.normalize("NFC").replace(/\s+/gu, " ").trim();
}

function checkName(raw: string, max: number): NameCheck {
  const value = normalizeName(raw);
  if (value.length === 0) return { ok: false, issue: "EMPTY" };
  // Đếm theo điểm mã (như char_length của Postgres).
  if ([...value].length > max) return { ok: false, issue: "TOO_LONG" };
  if (!ALLOWED.test(value)) return { ok: false, issue: "INVALID_CHARACTERS" };
  if (value.split(" ").length > MAX_NAME_WORDS) return { ok: false, issue: "LOOKS_LIKE_FULL_NAME" };
  return { ok: true, value };
}

/** Biệt danh ở lớp (1–30 ký tự, tối đa 2 tiếng). */
export function checkDisplayName(raw: string): NameCheck {
  return checkName(raw, DISPLAY_NAME_MAX);
}

/** Tên hiển thị trên bảng xếp hạng (1–20 ký tự, tối đa 2 tiếng) — chỉ công khai trong lớp sau khi GV duyệt. */
export function checkLeaderboardAlias(raw: string): NameCheck {
  return checkName(raw, ALIAS_MAX);
}

/** Khóa so trùng trong lớp — khớp chỉ mục unique `lower(display_name)` của CSDL. */
export function nameKey(value: string): string {
  return normalizeName(value).toLocaleLowerCase("vi");
}
