import { tilesAllowed } from "../gamification/unlocks.ts";
import { MAP_TILES, type MapTileKey } from "./catalog.ts";

/**
 * Bản đồ khám phá của mùa (GAMIFICATION_SPEC §6, GAME_DESIGN §2) — HÀM THUẦN, dùng chung cho giao diện và máy chủ.
 *
 * Lưới 3 × 3: ô giữa là Trạm luyện tập (luôn mở, không tính là thẻ); 8 thẻ xung quanh là 8 cảnh đã vẽ ở R02
 * (`MAP_TILES`). Một thẻ chỉ mở được khi KỀ CẠNH (trên/dưới/trái/phải) Trạm luyện tập hoặc một thẻ đã mở —
 * bốn thẻ góc cần mở thẻ cạnh trước. Số thẻ hữu hạn (8) → không có nguồn khám phá vô hạn.
 */

export const WORLD_MAP_KEY = "season-map-1";

export type MapCell = { row: number; col: number };

/** Vị trí của từng thẻ (hàng, cột) trên lưới 3 × 3; Trạm luyện tập ở (1, 1). */
export const MAP_LAYOUT: Readonly<Record<MapTileKey, MapCell>> = {
  flower_meadow: { row: 0, col: 0 },
  lotus_pond: { row: 0, col: 1 },
  bamboo_grove: { row: 0, col: 2 },
  rice_field: { row: 1, col: 0 },
  wooden_bridge: { row: 1, col: 2 },
  kite_hill: { row: 2, col: 0 },
  lantern_village: { row: 2, col: 1 },
  star_lookout: { row: 2, col: 2 },
};

export const MAP_START_CELL: MapCell = { row: 1, col: 1 };
export const MAP_SIZE = 3;
export const MAP_TILE_COUNT = MAP_TILES.length;
export const MAP_TILE_KEYS: readonly MapTileKey[] = MAP_TILES.map((tile) => tile.key);

export function isMapTileKey(value: unknown): value is MapTileKey {
  return typeof value === "string" && (MAP_TILE_KEYS as readonly string[]).includes(value);
}

function touches(a: MapCell, b: MapCell): boolean {
  return Math.abs(a.row - b.row) + Math.abs(a.col - b.col) === 1;
}

/** Thẻ kề cạnh (không tính Trạm luyện tập), theo thứ tự của `MAP_TILES`. */
export function tileNeighbors(key: MapTileKey): MapTileKey[] {
  return MAP_TILE_KEYS.filter((other) => other !== key && touches(MAP_LAYOUT[key], MAP_LAYOUT[other]));
}

export function isAdjacentToStart(key: MapTileKey): boolean {
  return touches(MAP_LAYOUT[key], MAP_START_CELL);
}

/** Thẻ còn sương mù nhưng đã kề vùng đã mở (người chơi có thể chọn khi còn lượt khám phá). */
export function frontierTiles(revealed: ReadonlySet<string>): MapTileKey[] {
  return MAP_TILE_KEYS.filter(
    (key) => !revealed.has(key) && (isAdjacentToStart(key) || tileNeighbors(key).some((other) => revealed.has(other))),
  );
}

export type MapProgress = {
  /** Số thẻ được phép mở theo điểm tích lũy (đã chặn bởi tổng số thẻ). */
  allowed: number;
  revealed: number;
  /** Số lượt khám phá còn lại (≥ 0). */
  available: number;
  total: number;
};

export function mapProgress(earnedTotal: number, revealedCount: number): MapProgress {
  const allowed = tilesAllowed(earnedTotal, MAP_TILE_COUNT);
  const revealed = Math.max(0, Math.min(MAP_TILE_COUNT, Math.trunc(revealedCount)));
  return { allowed, revealed, available: Math.max(0, allowed - revealed), total: MAP_TILE_COUNT };
}

export type RevealCheck =
  { ok: true } | { ok: false; code: "UNKNOWN_TILE" | "ALREADY_REVEALED" | "NO_TILE_AVAILABLE" | "NOT_ADJACENT" };

/**
 * Kiểm tra một yêu cầu mở thẻ. Máy chủ chạy trước khi gọi CSDL; hàm CSDL kiểm tra lại số lượt và tính kề nhau trong
 * giao dịch (thẻ đã mở không bao giờ bị che lại trong mùa, nên tính kề nhau không bị phá bởi yêu cầu song song).
 */
export function canRevealTile(input: {
  tileKey: string;
  revealed: ReadonlySet<string>;
  earnedTotal: number;
}): RevealCheck {
  if (!isMapTileKey(input.tileKey)) return { ok: false, code: "UNKNOWN_TILE" };
  if (input.revealed.has(input.tileKey)) return { ok: false, code: "ALREADY_REVEALED" };
  if (mapProgress(input.earnedTotal, input.revealed.size).available <= 0) {
    return { ok: false, code: "NO_TILE_AVAILABLE" };
  }
  if (!frontierTiles(input.revealed).includes(input.tileKey)) return { ok: false, code: "NOT_ADJACENT" };
  return { ok: true };
}

export type MapGridCell = { key: MapTileKey | "station"; row: number; col: number };

/** Mọi ô của lưới (kể cả Trạm luyện tập) theo thứ tự hàng rồi cột — để giao diện dựng lưới 3 × 3. */
export const MAP_GRID: readonly MapGridCell[] = [
  ...MAP_TILE_KEYS.map((key) => ({ key, ...MAP_LAYOUT[key] })),
  { key: "station" as const, ...MAP_START_CELL },
].sort((a, b) => a.row - b.row || a.col - b.col);
