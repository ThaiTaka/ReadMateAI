import { createHash } from "node:crypto";

/**
 * Vân tay nội dung của một câu bài tập (`content_fingerprint`) — CHỈ dùng ở máy chủ / script (node:crypto).
 *
 * Vì sao cần: bộ sinh GĐ4 đặt mã câu theo seed (`itemId(variant, key, seed)`) và gán mã phương án o1, o2… theo VỊ TRÍ
 * sau khi xáo. Hai lần sinh cùng một nội dung với hai seed khác nhau cho hai `id` khác nhau và thứ tự phương án khác
 * nhau. Quy tắc "mỗi nội dung câu tính điểm một lần mỗi mùa" (AD-43) vì thế KHÔNG được dựa vào `id` mà dựa vào vân
 * tay này: chuẩn hóa thứ tự phương án, đánh lại mã phương án theo nội dung, rồi băm SHA-256 phần
 * `{type, variant, content, answer}` (bỏ `id`, nguồn, âm thanh, độ khó — không đổi bản chất câu hỏi).
 */

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

/** JSON với khóa đối tượng sắp xếp — cùng dữ liệu luôn cho cùng chuỗi. */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value ?? null);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, entry]) => entry !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`).join(",")}}`;
}

function isIdObject(value: unknown): value is { id: string } & Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    typeof (value as { id?: unknown }).id === "string"
  );
}

function nfc(value: Json): Json {
  if (typeof value === "string") return value.normalize("NFC");
  if (Array.isArray(value)) return value.map(nfc);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, nfc(v)]));
  return value;
}

/**
 * Đánh lại mã cho mọi nhóm phương án (mảng đối tượng có `id`) trong `content`: sắp xếp theo nội dung (không tính
 * `id`) rồi gán `"{đường dẫn}#{thứ tự}"`. Trả về nội dung chuẩn và bảng đổi mã. Mã trùng giữa hai nhóm → không đổi
 * (an toàn: vân tay khi đó vẫn đúng, chỉ nhạy với thứ tự).
 */
function relabelContent(content: Json): { content: Json; mapping: Map<string, string> } {
  const mapping = new Map<string, string>();
  const ambiguous = new Set<string>();
  const walk = (value: Json, path: string): Json => {
    if (Array.isArray(value)) {
      if (value.length > 0 && value.every(isIdObject)) {
        const sorted = [...value]
          .map((entry) => {
            const { id, ...rest } = entry as { id: string } & Record<string, Json>;
            return { id, rest: walk(rest, `${path}[]`) as Record<string, Json>, key: stableStringify(rest) };
          })
          .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
        return sorted.map((entry, index) => {
          const canonical = `${path}#${index}`;
          if (mapping.has(entry.id)) ambiguous.add(entry.id);
          mapping.set(entry.id, canonical);
          return { ...entry.rest, id: canonical };
        });
      }
      return value.map((entry, index) => walk(entry, `${path}.${index}`));
    }
    if (value && typeof value === "object") {
      return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, walk(entry, `${path}.${key}`)]));
    }
    return value;
  };
  const relabeled = walk(content, "");
  for (const id of ambiguous) mapping.delete(id);
  if (ambiguous.size === 0) return { content: relabeled, mapping };
  // Có mã trùng giữa các nhóm: giữ mã gốc cho các mã đó để không gộp nhầm hai câu khác nhau.
  return { content: relabelContentKeepIds(content, mapping), mapping };
}

function relabelContentKeepIds(content: Json, mapping: Map<string, string>): Json {
  const walk = (value: Json): Json => {
    if (Array.isArray(value)) return value.map(walk);
    if (value && typeof value === "object") {
      return Object.fromEntries(
        Object.entries(value).map(([key, entry]) => [
          key,
          key === "id" && typeof entry === "string" ? (mapping.get(entry) ?? entry) : walk(entry),
        ]),
      );
    }
    return value;
  };
  return walk(content);
}

/** Thay mã phương án trong `answer` (giá trị chuỗi và khóa của bản ghi như `distractorTags`, `pairs`). */
function relabelAnswer(answer: Json, mapping: Map<string, string>): Json {
  const walk = (value: Json, key: string | null): Json => {
    if (typeof value === "string") return mapping.get(value) ?? value;
    if (Array.isArray(value)) {
      const mapped = value.map((entry) => walk(entry, null));
      // Tập đáp án (chọn nhiều) không phụ thuộc thứ tự; thứ tự thẻ (sắp xếp câu) thì giữ nguyên.
      return key === "optionIds"
        ? [...mapped].sort((a, b) => stableStringify(a).localeCompare(stableStringify(b)))
        : mapped;
    }
    if (value && typeof value === "object") {
      return Object.fromEntries(
        Object.entries(value).map(([entryKey, entry]) => [mapping.get(entryKey) ?? entryKey, walk(entry, entryKey)]),
      );
    }
    return value;
  };
  return walk(answer, null);
}

export type FingerprintInput = { type: string; variant: string; content: unknown; answer: unknown };

export function canonicalItemForFingerprint(item: FingerprintInput): Json {
  const { content, mapping } = relabelContent(nfc(item.content as Json));
  return { type: item.type, variant: item.variant, content, answer: relabelAnswer(nfc(item.answer as Json), mapping) };
}

/** SHA-256 (hex, 64 ký tự) của dạng chuẩn. */
export function contentFingerprint(item: FingerprintInput): string {
  return createHash("sha256")
    .update(stableStringify(canonicalItemForFingerprint(item)), "utf8")
    .digest("hex");
}
