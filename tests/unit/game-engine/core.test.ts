import { describe, expect, it } from "vitest";
import { DEMO_MAZE_ROWS } from "../../../src/features/demo/treasure-maze-data";
import {
  ENCOUNTERS_PER_LEVEL,
  createGrid,
  createInitialState,
  findPath,
  gameReducer,
  isTreasureOpenable,
  parseLevel,
  reachableFrom,
  revealedTriggers,
  step,
  validateLevel,
  type Direction,
  type GameAction,
  type GameState,
  type Level,
  type LevelErrorCode,
  type Position,
} from "../../../src/features/game-engine/core";

// Fixture: màn 11×11 của nguyên mẫu R07.1 + 7 điểm kích hoạt thử nghiệm (chưa phải màn chính thức, thuộc R07.3).
const TRIGGER_POSITIONS: readonly Position[] = [
  { row: 3, col: 1 },
  { row: 3, col: 3 },
  { row: 5, col: 1 },
  { row: 3, col: 8 },
  { row: 5, col: 8 },
  { row: 7, col: 7 },
  { row: 9, col: 4 },
];
const LEVEL: Level = {
  id: "fixture-11",
  rows: DEMO_MAZE_ROWS,
  triggers: TRIGGER_POSITIONS.map((p, i) => ({ id: `t${i + 1}`, ...p })),
};

function codes(level: Level): LevelErrorCode[] {
  return validateLevel(level).map((e) => e.code);
}
function withRows(rows: string[], triggers = LEVEL.triggers): Level {
  return { id: "x", rows, triggers };
}
function replaceCell(row: number, col: number, char: string): string[] {
  return DEMO_MAZE_ROWS.map((line, r) => (r === row ? line.slice(0, col) + char + line.slice(col + 1) : line));
}
function directionsOf(path: Position[]): Direction[] {
  return path.slice(1).map((p, i) => {
    const q = path[i] as Position;
    return p.row < q.row ? "up" : p.row > q.row ? "down" : p.col < q.col ? "left" : "right";
  });
}
function run(level: ReturnType<typeof parseLevel>, state: GameState, actions: readonly GameAction[]): GameState {
  return actions.reduce((s, a) => gameReducer(level, s, a), state);
}
function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object") {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

const parsed = parseLevel(LEVEL);
const fresh = () => createInitialState(parsed);
const move = (direction: Direction): GameAction => ({ type: "MOVE", direction });

/** Đi tới `to` rồi (nếu chạm trán) giải quyết; trả state cuối. */
function walkTo(state: GameState, to: Position): GameState {
  const path = findPath(parsed.grid, state.position, to)!;
  let s = state;
  for (const d of directionsOf(path)) {
    s = gameReducer(parsed, s, move(d));
    if (s.pendingEncounter)
      s = gameReducer(parsed, s, { type: "ENCOUNTER_RESOLVED", triggerId: s.pendingEncounter, outcome: "defeated" });
  }
  return s;
}

describe("validateLevel", () => {
  it("chấp nhận màn 11×11 hợp lệ", () => {
    expect(validateLevel(LEVEL)).toEqual([]);
  });
  it("báo kích thước ngoài 9–13", () => {
    expect(codes(withRows(DEMO_MAZE_ROWS.slice(0, 8)))).toContain("SIZE_OUT_OF_RANGE");
    const big = Array.from({ length: 14 }, () => "#".repeat(14));
    expect(codes(withRows(big))).toContain("SIZE_OUT_OF_RANGE");
  });
  it("chấp nhận cạnh biên 9 và 13", () => {
    const square = (n: number) => [
      "S" + ".".repeat(n - 2) + "T",
      ...Array.from({ length: n - 1 }, () => ".".repeat(n)),
    ];
    const triggers = Array.from({ length: 7 }, (_, i) => ({ id: `t${i}`, row: 1, col: i + 1 }));
    expect(validateLevel(withRows(square(9), triggers))).toEqual([]);
    expect(validateLevel(withRows(square(13), triggers))).toEqual([]);
  });
  it("báo hàng dài ngắn không đều kèm vị trí", () => {
    const rows = [...DEMO_MAZE_ROWS];
    rows[4] = (rows[4] ?? "").slice(0, -1);
    const err = validateLevel(withRows(rows)).find((e) => e.code === "ROW_LENGTH_MISMATCH");
    expect(err?.position).toEqual({ row: 4, col: 0 });
  });
  it("báo ký tự ô lạ", () => {
    const err = validateLevel(withRows(replaceCell(2, 2, "X"))).find((e) => e.code === "UNKNOWN_CELL");
    expect(err?.position).toEqual({ row: 2, col: 2 });
  });
  it("báo thiếu hoặc thừa xuất phát / rương", () => {
    expect(codes(withRows(replaceCell(1, 1, ".")))).toContain("START_COUNT");
    expect(codes(withRows(replaceCell(1, 2, "S")))).toContain("START_COUNT");
    expect(codes(withRows(replaceCell(9, 9, ".")))).toContain("TREASURE_COUNT");
    expect(codes(withRows(replaceCell(9, 8, "T")))).toContain("TREASURE_COUNT");
  });
  it("báo thiếu và thừa điểm kích hoạt", () => {
    expect(codes(withRows([...DEMO_MAZE_ROWS], LEVEL.triggers.slice(0, 6)))).toContain("TRIGGER_COUNT");
    expect(codes(withRows([...DEMO_MAZE_ROWS], [...LEVEL.triggers, { id: "t8", row: 7, col: 1 }]))).toContain(
      "TRIGGER_COUNT",
    );
  });
  it("báo điểm kích hoạt trùng tọa độ và trùng mã", () => {
    const dupPos = LEVEL.triggers.map((t, i) => (i === 6 ? { ...t, row: 3, col: 1 } : t));
    expect(codes(withRows([...DEMO_MAZE_ROWS], dupPos))).toContain("TRIGGER_DUPLICATE_POSITION");
    const dupId = LEVEL.triggers.map((t, i) => (i === 6 ? { ...t, id: "t1" } : t));
    expect(codes(withRows([...DEMO_MAZE_ROWS], dupId))).toContain("TRIGGER_ID_DUPLICATE");
  });
  it("báo điểm kích hoạt trên tường, trên xuất phát, trên rương và ngoài bản đồ", () => {
    const at = (row: number, col: number) => LEVEL.triggers.map((t, i) => (i === 0 ? { ...t, row, col } : t));
    expect(codes(withRows([...DEMO_MAZE_ROWS], at(0, 0)))).toContain("TRIGGER_NOT_ON_PATH");
    expect(codes(withRows([...DEMO_MAZE_ROWS], at(1, 1)))).toContain("TRIGGER_NOT_ON_PATH");
    expect(codes(withRows([...DEMO_MAZE_ROWS], at(9, 9)))).toContain("TRIGGER_NOT_ON_PATH");
    const oob = validateLevel(withRows([...DEMO_MAZE_ROWS], at(20, 1))).find((e) => e.code === "TRIGGER_OUT_OF_BOUNDS");
    expect(oob?.triggerId).toBe("t1");
  });
  it("báo bản đồ không liên thông và rương/điểm kích hoạt không tới được", () => {
    // Chặn lối duy nhất (3,1)->(5,1) ... đóng cổng quanh rương: (8,9) và (9,8).
    const rows = replaceCell(9, 8, "#").map((l, r) => (r === 8 ? l.slice(0, 9) + "#" + l.slice(10) : l));
    const found = codes(withRows(rows));
    expect(found).toContain("PATH_DISCONNECTED");
    expect(found).toContain("TREASURE_UNREACHABLE");
  });
  it("báo điểm kích hoạt nằm trong vùng bị cô lập", () => {
    const rows = [...DEMO_MAZE_ROWS];
    // Cô lập (9,4): bao bằng tường hai bên.
    const isolated = rows.map((l, r) => (r === 9 ? l.slice(0, 3) + "#.#" + l.slice(6) : l));
    expect(codes(withRows(isolated))).toContain("TRIGGER_UNREACHABLE");
  });
  it("trả nhiều lỗi cùng lúc và cùng kết quả khi gọi lại", () => {
    const bad = withRows(replaceCell(1, 1, "."), LEVEL.triggers.slice(0, 3));
    const first = validateLevel(bad);
    expect(first.length).toBeGreaterThan(1);
    expect(validateLevel(bad)).toEqual(first);
  });
});

describe("grid", () => {
  it("đi 4 hướng, va tường và biên", () => {
    const grid = createGrid(DEMO_MAZE_ROWS);
    const origin = { row: 1, col: 2 };
    expect(step(grid, origin, "right")).toEqual({ kind: "moved", position: { row: 1, col: 3 } });
    expect(step(grid, origin, "left")).toEqual({ kind: "moved", position: { row: 1, col: 1 } });
    expect(step(grid, origin, "up")).toEqual({ kind: "blocked", by: "wall" });
    expect(step(grid, origin, "down")).toEqual({ kind: "blocked", by: "wall" });
    expect(step(grid, { row: 0, col: 0 }, "up")).toEqual({ kind: "blocked", by: "edge" });
    expect(step(grid, { row: 10, col: 10 }, "right")).toEqual({ kind: "blocked", by: "edge" });
  });
  it("tìm đường ngắn nhất và trả null khi không có", () => {
    const path = findPath(parsed.grid, parsed.start, parsed.treasure)!;
    expect(path[0]).toEqual(parsed.start);
    expect(path.at(-1)).toEqual(parsed.treasure);
    expect(findPath(parsed.grid, parsed.start, { row: 0, col: 0 })).toBeNull();
    expect(reachableFrom(parsed.grid, parsed.start).size).toBe(DEMO_MAZE_ROWS.join("").replaceAll("#", "").length);
  });
});

describe("gameReducer", () => {
  it("di chuyển từng ô theo 4 hướng và cập nhật hướng nhìn", () => {
    let s = run(parsed, fresh(), [move("right"), move("right")]);
    expect(s.position).toEqual({ row: 1, col: 3 });
    s = run(parsed, s, [move("down")]);
    expect(s.position).toEqual({ row: 2, col: 3 });
    s = run(parsed, s, [move("up")]);
    expect(s.position).toEqual({ row: 1, col: 3 });
    expect(s.facing).toBe("up");
  });
  it("không xuyên tường và không ra ngoài bản đồ", () => {
    const wall = gameReducer(parsed, fresh(), move("left"));
    expect(wall.position).toEqual(parsed.start);
    expect(wall.lastEvent).toEqual({ type: "blocked", by: "wall" });
    expect(wall.moves).toBe(0);
    const edge = gameReducer(parsed, { ...fresh(), position: { row: 0, col: 5 } }, move("up"));
    expect(edge.lastEvent).toEqual({ type: "blocked", by: "edge" });
  });
  it("tạm dừng chặn di chuyển, tiếp tục cho đi lại", () => {
    const paused = gameReducer(parsed, fresh(), { type: "PAUSE" });
    const blocked = gameReducer(parsed, paused, move("right"));
    expect(blocked.position).toEqual(parsed.start);
    expect(blocked.lastEvent).toEqual({ type: "rejected", reason: "paused" });
    const resumed = run(parsed, blocked, [{ type: "RESUME" }, move("right")]);
    expect(resumed.position).toEqual({ row: 1, col: 2 });
  });
  it("không sửa state đầu vào và cùng input cho cùng output", () => {
    const start = deepFreeze(fresh());
    const actions: GameAction[] = [move("right"), move("right"), move("down"), { type: "PAUSE" }, move("up")];
    const a = run(parsed, start, actions);
    const b = run(parsed, fresh(), actions);
    expect(a).toEqual(b);
    expect(start).toEqual(fresh());
  });
  it("kích hoạt chạm trán lần đầu, chặn di chuyển tới khi giải quyết", () => {
    const s = run(parsed, fresh(), [move("down"), move("down")]);
    expect(s.pendingEncounter).toBe("t1");
    expect(s.lastEvent).toEqual({ type: "encounter_triggered", triggerId: "t1" });
    const stuck = gameReducer(parsed, s, move("right"));
    expect(stuck.position).toEqual({ row: 3, col: 1 });
    expect(stuck.lastEvent).toEqual({ type: "rejected", reason: "encounter_pending" });
  });
  it("điểm đã xử lý không kích hoạt lần hai", () => {
    let s = run(parsed, fresh(), [move("down"), move("down")]);
    s = gameReducer(parsed, s, { type: "ENCOUNTER_RESOLVED", triggerId: "t1", outcome: "undefeated" });
    s = run(parsed, s, [move("up"), move("down")]);
    expect(s.position).toEqual({ row: 3, col: 1 });
    expect(s.pendingEncounter).toBeNull();
    expect(s.triggered).toEqual(["t1"]);
    expect(s.resolved).toEqual([{ triggerId: "t1", outcome: "undefeated" }]);
  });
  it("từ chối ENCOUNTER_RESOLVED sai mã hoặc khi không có chạm trán", () => {
    const none = gameReducer(parsed, fresh(), { type: "ENCOUNTER_RESOLVED", triggerId: "t1", outcome: "defeated" });
    expect(none.lastEvent).toEqual({ type: "rejected", reason: "no_pending_encounter" });
    const pending = run(parsed, fresh(), [move("down"), move("down")]);
    const wrong = gameReducer(parsed, pending, { type: "ENCOUNTER_RESOLVED", triggerId: "t2", outcome: "defeated" });
    expect(wrong.pendingEncounter).toBe("t1");
    expect(wrong.lastEvent).toEqual({ type: "rejected", reason: "wrong_encounter" });
  });
  it("ENCOUNTER_DISMISSED (lượt có lưu): chỉ gỡ chặn, không ghi nhận kết quả; sai mã/không có chạm trán bị từ chối", () => {
    const pending = run(parsed, fresh(), [move("down"), move("down")]);
    const wrong = gameReducer(parsed, pending, { type: "ENCOUNTER_DISMISSED", triggerId: "t2" });
    expect(wrong.pendingEncounter).toBe("t1");
    expect(wrong.lastEvent).toEqual({ type: "rejected", reason: "wrong_encounter" });
    const freed = gameReducer(parsed, pending, { type: "ENCOUNTER_DISMISSED", triggerId: "t1" });
    expect(freed.pendingEncounter).toBeNull();
    expect(freed.resolved).toEqual([]);
    expect(freed.triggered).toEqual(["t1"]);
    const none = gameReducer(parsed, fresh(), { type: "ENCOUNTER_DISMISSED", triggerId: "t1" });
    expect(none.lastEvent).toEqual({ type: "rejected", reason: "no_pending_encounter" });
    // Lõi không tự mở rương dựa trên số chạm trán đã gỡ chặn.
    expect(isTreasureOpenable(freed)).toBe(false);
  });
  it("không lộ điểm kích hoạt chưa dùng", () => {
    expect(revealedTriggers(parsed, fresh())).toEqual([]);
    const s = run(parsed, fresh(), [move("down"), move("down")]);
    expect(revealedTriggers(parsed, s).map((t) => t.id)).toEqual(["t1"]);
  });
  it("kho báu không mở khi chưa đủ 7 chạm trán", () => {
    const s = walkTo(fresh(), parsed.treasure);
    expect(s.completed).toBe(false);
    expect(s.lastEvent).toEqual({ type: "treasure_locked" });
    expect(isTreasureOpenable(s)).toBe(s.resolved.length >= ENCOUNTERS_PER_LEVEL);
  });
  it("kho báu mở khi đủ 7 chạm trán, sau đó khóa mọi hành động", () => {
    let s = fresh();
    for (const p of TRIGGER_POSITIONS) s = walkTo(s, p);
    expect(s.resolved).toHaveLength(ENCOUNTERS_PER_LEVEL);
    expect(s.triggered).toHaveLength(ENCOUNTERS_PER_LEVEL);
    expect(s.completed).toBe(false);
    s = walkTo(s, parsed.treasure);
    expect(s.completed).toBe(true);
    expect(s.lastEvent).toEqual({ type: "treasure_opened" });
    const after = gameReducer(parsed, s, move("up"));
    expect(after.lastEvent).toEqual({ type: "rejected", reason: "completed" });
    expect(after.position).toEqual(s.position);
  });
});
