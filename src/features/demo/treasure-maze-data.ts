/*
 * Màn mê cung MINH HỌA cho nguyên mẫu đồ họa R07.1 (hư cấu, không lưu, không nối điểm thật).
 * Chưa phải dữ liệu màn chơi chính thức: lược đồ zod và kiểm tra màn thuộc R07.2.
 * Ký hiệu: # tường · . đường đi · S xuất phát · T rương kho báu.
 */
export const DEMO_MAZE_ROWS: readonly string[] = [
  "###########",
  "#S..#.....#",
  "#.#.#.###.#",
  "#.#...#...#",
  "#.#####.###",
  "#.....#...#",
  "###.#.###.#",
  "#...#.....#",
  "#.#######.#",
  "#........T#",
  "###########",
];

export type MazeCellKind = "wall" | "path" | "start" | "treasure";

export type MazeCell = { row: number; col: number; kind: MazeCellKind };

export function parseDemoMaze(rows: readonly string[] = DEMO_MAZE_ROWS): MazeCell[][] {
  return rows.map((line, row) =>
    Array.from(line, (char, col): MazeCell => {
      const kind: MazeCellKind = char === "#" ? "wall" : char === "S" ? "start" : char === "T" ? "treasure" : "path";
      return { row, col, kind };
    }),
  );
}
