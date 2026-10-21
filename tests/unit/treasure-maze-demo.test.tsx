import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MazeBoard } from "@/components/art/maze-board";
import { DEMO_MAZE_ROWS, parseDemoMaze } from "@/features/demo/treasure-maze-data";

/** Nguyên mẫu R07.1: chỉ kiểm cấu trúc cơ bản của màn minh họa; kiểm tra màn chính thức thuộc R07.2. */

describe("màn mê cung minh họa (R07.1)", () => {
  const grid = parseDemoMaze();
  const flat = grid.flat();

  it("lưới vuông 11×11, viền ngoài là tường, đúng một xuất phát và một rương", () => {
    expect(grid).toHaveLength(11);
    expect(DEMO_MAZE_ROWS.every((row) => row.length === 11)).toBe(true);
    const border = flat.filter((cell) => cell.row === 0 || cell.col === 0 || cell.row === 10 || cell.col === 10);
    expect(border.every((cell) => cell.kind === "wall")).toBe(true);
    expect(flat.filter((cell) => cell.kind === "start")).toHaveLength(1);
    expect(flat.filter((cell) => cell.kind === "treasure")).toHaveLength(1);
  });

  it("mọi ô đi được liên thông với xuất phát và tới được rương", () => {
    const walkable = flat.filter((cell) => cell.kind !== "wall");
    const start = flat.find((cell) => cell.kind === "start")!;
    const seen = new Set([`${start.row},${start.col}`]);
    const queue = [start];
    while (queue.length > 0) {
      const { row, col } = queue.shift()!;
      for (const [dr, dc] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const) {
        const next = grid[row + dr]?.[col + dc];
        if (next && next.kind !== "wall" && !seen.has(`${next.row},${next.col}`)) {
          seen.add(`${next.row},${next.col}`);
          queue.push(next);
        }
      }
    }
    expect(seen.size).toBe(walkable.length);
    const treasure = flat.find((cell) => cell.kind === "treasure")!;
    expect(seen.has(`${treasure.row},${treasure.col}`)).toBe(true);
  });

  it("kết xuất ổn định (xác định) và có nhãn trợ năng cho nhân vật, rương, bản đồ", () => {
    const html = renderToStaticMarkup(<MazeBoard title="Bản đồ thử" />);
    expect(renderToStaticMarkup(<MazeBoard title="Bản đồ thử" />)).toBe(html);
    expect(html).toContain('aria-label="Bản đồ thử"');
    expect(html).toContain('aria-label="Bạn nhỏ thám hiểm"');
    expect(html).toContain('aria-label="Rương kho báu"');
  });
});
