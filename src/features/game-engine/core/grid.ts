import type { CellKind, Direction, Level, Position, Trigger } from "./types.ts";

const DELTAS: Readonly<Record<Direction, Position>> = {
  up: { row: -1, col: 0 },
  down: { row: 1, col: 0 },
  left: { row: 0, col: -1 },
  right: { row: 0, col: 1 },
};

// Thứ tự cố định để tìm đường xác định.
const DIRECTIONS: readonly Direction[] = ["up", "right", "down", "left"];

export type Grid = {
  readonly rowCount: number;
  readonly colCount: number;
  /** undefined = ngoài bản đồ hoặc ký tự lạ. */
  kindAt(position: Position): CellKind | undefined;
};

export type StepResult =
  { readonly kind: "moved"; readonly position: Position } | { readonly kind: "blocked"; readonly by: "wall" | "edge" };

export type ParsedLevel = {
  readonly id: string;
  readonly grid: Grid;
  readonly start: Position;
  readonly treasure: Position;
  readonly triggers: readonly Trigger[];
};

const CHAR_KIND: Readonly<Record<string, CellKind>> = { "#": "wall", ".": "path", S: "start", T: "treasure" };

export function positionKey(p: Position): string {
  return `${p.row},${p.col}`;
}

export function createGrid(rows: readonly string[]): Grid {
  return {
    rowCount: rows.length,
    colCount: rows.reduce((max, line) => Math.max(max, line.length), 0),
    kindAt: ({ row, col }) => {
      const char = rows[row]?.[col];
      return char === undefined ? undefined : CHAR_KIND[char];
    },
  };
}

export function isWalkable(grid: Grid, position: Position): boolean {
  const kind = grid.kindAt(position);
  return kind !== undefined && kind !== "wall";
}

export function step(grid: Grid, from: Position, direction: Direction): StepResult {
  const delta = DELTAS[direction];
  const next = { row: from.row + delta.row, col: from.col + delta.col };
  const kind = grid.kindAt(next);
  if (kind === undefined) return { kind: "blocked", by: "edge" };
  if (kind === "wall") return { kind: "blocked", by: "wall" };
  return { kind: "moved", position: next };
}

export function neighbors(grid: Grid, from: Position): Position[] {
  const result: Position[] = [];
  for (const direction of DIRECTIONS) {
    const s = step(grid, from, direction);
    if (s.kind === "moved") result.push(s.position);
  }
  return result;
}

/** Tập khóa vị trí đi tới được từ `from` (BFS). */
export function reachableFrom(grid: Grid, from: Position): Set<string> {
  const seen = new Set<string>();
  if (!isWalkable(grid, from)) return seen;
  seen.add(positionKey(from));
  const queue: Position[] = [from];
  for (const current of queue) {
    for (const next of neighbors(grid, current)) {
      const key = positionKey(next);
      if (!seen.has(key)) {
        seen.add(key);
        queue.push(next);
      }
    }
  }
  return seen;
}

/** Đường ngắn nhất (gồm cả hai đầu); null nếu không tới được. */
export function findPath(grid: Grid, from: Position, to: Position): Position[] | null {
  if (!isWalkable(grid, from) || !isWalkable(grid, to)) return null;
  const parent = new Map<string, Position | null>([[positionKey(from), null]]);
  const queue: Position[] = [from];
  for (const current of queue) {
    if (current.row === to.row && current.col === to.col) {
      const path: Position[] = [];
      for (let p: Position | null = current; p; p = parent.get(positionKey(p)) ?? null) path.unshift(p);
      return path;
    }
    for (const next of neighbors(grid, current)) {
      const key = positionKey(next);
      if (!parent.has(key)) {
        parent.set(key, current);
        queue.push(next);
      }
    }
  }
  return null;
}

/** Phân tích màn đã qua `validateLevel`; ném lỗi nếu thiếu S/T (lỗi lập trình). */
export function parseLevel(level: Level): ParsedLevel {
  const grid = createGrid(level.rows);
  let start: Position | undefined;
  let treasure: Position | undefined;
  level.rows.forEach((line, row) => {
    for (let col = 0; col < line.length; col += 1) {
      if (line[col] === "S") start = { row, col };
      if (line[col] === "T") treasure = { row, col };
    }
  });
  if (!start || !treasure) throw new Error(`Màn ${level.id} thiếu xuất phát hoặc rương; hãy chạy validateLevel trước.`);
  return { id: level.id, grid, start, treasure, triggers: level.triggers };
}
