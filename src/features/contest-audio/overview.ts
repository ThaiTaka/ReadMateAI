import type { ContestEntry } from "./catalog.ts";

/**
 * Tổng quan cho GIÁO VIÊN về âm thanh TRÌNH DIỄN (/teacher/audio-coverage). HÀM THUẦN. Bốn nhóm TÁCH BIỆT, không trộn với tệp đã duyệt thật:
 *  - `auto`: có tệp giọng máy tạo tự động, khớp danh mục hiện hành (chưa ai nghe/duyệt — chỉ dùng để trình diễn);
 *  - `stale`: có tệp nhưng chữ/giọng đã đổi nên không còn khớp (không phát);
 *  - `missing`: chưa có tệp trình diễn;
 *  - `needsVerification`: mục có rủi ro cách đọc — phải được người có chuyên môn nghe trước khi dùng thật.
 */

export type ContestRow = { entryId: string; contentHash: string; assetKey: string; riskClass: string };

export type ContestOverview = {
  total: number;
  auto: ContestEntry[];
  stale: ContestEntry[];
  missing: ContestEntry[];
  needsVerification: Array<{ entry: ContestEntry; hasFile: boolean }>;
  byKind: Record<string, { total: number; auto: number }>;
};

export function buildContestOverview(entries: readonly ContestEntry[], rows: readonly ContestRow[]): ContestOverview {
  const byId = new Map(rows.map((row) => [row.entryId, row]));
  const auto: ContestEntry[] = [];
  const stale: ContestEntry[] = [];
  const missing: ContestEntry[] = [];
  const byKind: ContestOverview["byKind"] = {};
  for (const entry of entries) {
    const bucket = (byKind[entry.kind] ??= { total: 0, auto: 0 });
    bucket.total += 1;
    const row = byId.get(entry.id);
    if (!row) missing.push(entry);
    else if (row.contentHash === entry.contentHash && row.assetKey === entry.assetKey) {
      auto.push(entry);
      bucket.auto += 1;
    } else stale.push(entry);
  }
  const autoIds = new Set(auto.map((entry) => entry.id));
  return {
    total: entries.length,
    auto,
    stale,
    missing,
    needsVerification: entries
      .filter((entry) => entry.riskClass === "needs_verification")
      .map((entry) => ({ entry, hasFile: autoIds.has(entry.id) })),
    byKind,
  };
}
