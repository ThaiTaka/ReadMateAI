import { describe, expect, it } from "vitest";
import { MAP_TILES } from "@/features/game-world/catalog";
import {
  MAP_LAYOUT,
  MAP_START_CELL,
  MAP_TILE_COUNT,
  canRevealTile,
  frontierTiles,
  isAdjacentToStart,
  mapProgress,
  tileNeighbors,
} from "@/features/game-world/map";

describe("bản đồ khám phá 3 × 3 (Trạm luyện tập ở giữa + 8 thẻ)", () => {
  it("mỗi thẻ một ô riêng, không trùng Trạm luyện tập, đủ 8 thẻ đã vẽ", () => {
    expect(MAP_TILE_COUNT).toBe(8);
    const cells = Object.values(MAP_LAYOUT).map((cell) => `${cell.row},${cell.col}`);
    expect(new Set(cells).size).toBe(8);
    expect(cells).not.toContain(`${MAP_START_CELL.row},${MAP_START_CELL.col}`);
    expect(Object.keys(MAP_LAYOUT).sort()).toEqual(MAP_TILES.map((tile) => tile.key).sort());
  });

  it("kề nhau theo cạnh: 4 thẻ cạnh kề Trạm, 4 thẻ góc chỉ kề thẻ cạnh", () => {
    expect(MAP_TILES.filter((tile) => isAdjacentToStart(tile.key)).map((tile) => tile.key)).toEqual([
      "lotus_pond",
      "rice_field",
      "wooden_bridge",
      "lantern_village",
    ]);
    expect(tileNeighbors("flower_meadow")).toEqual(["lotus_pond", "rice_field"]);
    expect(tileNeighbors("lotus_pond")).toEqual(["flower_meadow", "bamboo_grove"]);
  });

  it("vùng biên: lúc đầu chỉ 4 thẻ cạnh; mở Ao sen → thêm Đồi hoa và Lũy tre", () => {
    expect(frontierTiles(new Set())).toEqual(["lotus_pond", "rice_field", "wooden_bridge", "lantern_village"]);
    expect(frontierTiles(new Set(["lotus_pond"]))).toEqual([
      "flower_meadow",
      "bamboo_grove",
      "rice_field",
      "wooden_bridge",
      "lantern_village",
    ]);
  });

  it("số lượt khám phá = min(8, floor(tích lũy / 30)) − đã mở", () => {
    expect(mapProgress(29, 0)).toEqual({ allowed: 0, revealed: 0, available: 0, total: 8 });
    expect(mapProgress(30, 0)).toEqual({ allowed: 1, revealed: 0, available: 1, total: 8 });
    expect(mapProgress(60, 1)).toEqual({ allowed: 2, revealed: 1, available: 1, total: 8 });
    expect(mapProgress(9999, 8)).toEqual({ allowed: 8, revealed: 8, available: 0, total: 8 });
  });

  it("không mở thẻ vượt quyền, thẻ không kề, thẻ lạ, thẻ đã mở", () => {
    const none = new Set<string>();
    expect(canRevealTile({ tileKey: "lotus_pond", revealed: none, earnedTotal: 29 })).toEqual({
      ok: false,
      code: "NO_TILE_AVAILABLE",
    });
    expect(canRevealTile({ tileKey: "lotus_pond", revealed: none, earnedTotal: 30 })).toEqual({ ok: true });
    expect(canRevealTile({ tileKey: "flower_meadow", revealed: none, earnedTotal: 30 })).toEqual({
      ok: false,
      code: "NOT_ADJACENT",
    });
    expect(canRevealTile({ tileKey: "castle_secret", revealed: none, earnedTotal: 300 })).toEqual({
      ok: false,
      code: "UNKNOWN_TILE",
    });
    const one = new Set(["lotus_pond"]);
    expect(canRevealTile({ tileKey: "lotus_pond", revealed: one, earnedTotal: 60 })).toEqual({
      ok: false,
      code: "ALREADY_REVEALED",
    });
    expect(canRevealTile({ tileKey: "flower_meadow", revealed: one, earnedTotal: 60 })).toEqual({ ok: true });
    expect(canRevealTile({ tileKey: "flower_meadow", revealed: one, earnedTotal: 59 }).ok).toBe(false);
  });

  it("đi hết bản đồ được bằng đúng 8 lượt (mọi thẻ tới được)", () => {
    const revealed = new Set<string>();
    for (let step = 1; step <= MAP_TILE_COUNT; step += 1) {
      const next = frontierTiles(revealed)[0];
      expect(next).toBeDefined();
      expect(canRevealTile({ tileKey: next!, revealed, earnedTotal: step * 30 })).toEqual({ ok: true });
      revealed.add(next!);
    }
    expect(frontierTiles(revealed)).toEqual([]);
    expect(canRevealTile({ tileKey: "lotus_pond", revealed, earnedTotal: 10_000 }).ok).toBe(false);
  });
});
