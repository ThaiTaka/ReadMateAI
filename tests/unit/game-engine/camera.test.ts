import { describe, expect, it } from "vitest";
import { FOLLOW_VIEW_CELLS, cameraOrigin, viewCells } from "../../../src/features/game-engine/ui/camera";

describe("camera (R07.4)", () => {
  it("khung nhìn không vượt kích thước bản đồ", () => {
    expect(viewCells(13, false)).toBe(FOLLOW_VIEW_CELLS);
    expect(viewCells(9, true)).toBe(9);
    expect(viewCells(5, false)).toBe(5);
  });

  it("nhân vật ở giữa khung khi đứng giữa bản đồ", () => {
    expect(cameraOrigin(13, 7, { row: 6, col: 6 })).toEqual({ x: 3, y: 3 });
  });

  it("kẹp ở mép: khung không đi ra ngoài bản đồ, nhân vật luôn trong khung", () => {
    for (const size of [9, 11, 13]) {
      for (let row = 0; row < size; row += 1) {
        for (let col = 0; col < size; col += 1) {
          const view = viewCells(size, false);
          const { x, y } = cameraOrigin(size, view, { row, col });
          expect(x).toBeGreaterThanOrEqual(0);
          expect(y).toBeGreaterThanOrEqual(0);
          expect(x + view).toBeLessThanOrEqual(size);
          expect(y + view).toBeLessThanOrEqual(size);
          expect(col).toBeGreaterThanOrEqual(x);
          expect(col + 1).toBeLessThanOrEqual(x + view);
          expect(row).toBeGreaterThanOrEqual(y);
          expect(row + 1).toBeLessThanOrEqual(y + view);
        }
      }
    }
  });

  it("toàn cảnh: gốc luôn (0,0)", () => {
    expect(cameraOrigin(11, 11, { row: 9, col: 9 })).toEqual({ x: 0, y: 0 });
  });
});
