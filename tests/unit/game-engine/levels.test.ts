import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import {
  ENCOUNTERS_PER_LEVEL,
  createInitialState,
  findPath,
  gameReducer,
  isTreasureOpenable,
  parseLevel,
  positionKey,
  validateLevel,
  type Direction,
  type GameState,
  type Position,
} from "../../../src/features/game-engine/core";
import {
  LEVELS_DIR,
  REQUIRED_LEVELS,
  parseLevelFile,
  toLevel,
  validateLevelFiles,
  type LevelFile,
} from "../../../src/features/game-engine/levels";

const CONTENT = join(process.cwd(), "content");
const LEVELS_ABS = join(CONTENT, LEVELS_DIR);

function loadRepoFiles(): Map<string, string> {
  const files = new Map<string, string>();
  for (const name of readdirSync(LEVELS_ABS)) {
    files.set(`${LEVELS_DIR}${name}`, readFileSync(join(LEVELS_ABS, name), "utf8"));
  }
  return files;
}
const repoFiles = loadRepoFiles();
const levels: LevelFile[] = REQUIRED_LEVELS.map((entry) => {
  const parsed = parseLevelFile(entry.file, repoFiles.get(entry.file) ?? "");
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.issues));
  return parsed.level;
});

function withFile(file: string, mutate: (level: LevelFile) => unknown): Map<string, string> {
  const copy = new Map(repoFiles);
  copy.set(file, JSON.stringify(mutate(JSON.parse(repoFiles.get(file) ?? "{}") as LevelFile)));
  return copy;
}
const FILE_1 = REQUIRED_LEVELS[0]!.file;
const FILE_2 = REQUIRED_LEVELS[1]!.file;
const codesOf = (files: Map<string, string>) => validateLevelFiles(files).map((i) => i.code);

describe("3 màn Mê cung kho báu (dữ liệu trong repo)", () => {
  it("đạt schema và validateLevel, kích thước 9/11/13", () => {
    expect(validateLevelFiles(repoFiles)).toEqual([]);
    expect(levels.map((l) => l.rows.length)).toEqual([9, 11, 13]);
    for (const level of levels) expect(validateLevel(toLevel(level))).toEqual([]);
  });

  it("mỗi màn đúng 7 trigger, không trùng mã hoặc tọa độ, mã màn khác nhau", () => {
    for (const level of levels) {
      expect(level.triggers).toHaveLength(ENCOUNTERS_PER_LEVEL);
      expect(new Set(level.triggers.map((t) => t.id)).size).toBe(7);
      expect(new Set(level.triggers.map(positionKey)).size).toBe(7);
    }
    expect(new Set(levels.map((l) => l.id)).size).toBe(3);
  });

  it("rương và mọi trigger tới được từ xuất phát", () => {
    for (const level of levels) {
      const parsed = parseLevel(toLevel(level));
      expect(findPath(parsed.grid, parsed.start, parsed.treasure)).not.toBeNull();
      for (const t of parsed.triggers) expect(findPath(parsed.grid, parsed.start, t)).not.toBeNull();
    }
  });

  it("ba bản đồ khác nhau, không chứa dữ liệu học sinh/điểm/câu hỏi", () => {
    expect(new Set(levels.map((l) => l.rows.join("|"))).size).toBe(3);
    for (const [, raw] of repoFiles) {
      expect(raw).not.toMatch(/point|score|question|student|answer/iu);
    }
    for (const level of levels) expect(Object.keys(level).sort()).toEqual(["id", "name", "rows", "triggers"]);
  });

  it("hoàn tất cả 7 trigger rồi mở rương bằng Game Engine", () => {
    for (const level of levels) {
      const parsed = parseLevel(toLevel(level));
      let state: GameState = createInitialState(parsed);
      const walk = (to: Position) => {
        const path = findPath(parsed.grid, state.position, to) ?? [];
        for (let i = 1; i < path.length; i += 1) {
          const from = path[i - 1] as Position;
          const target = path[i] as Position;
          const direction: Direction =
            target.row < from.row ? "up" : target.row > from.row ? "down" : target.col < from.col ? "left" : "right";
          state = gameReducer(parsed, state, { type: "MOVE", direction });
          if (state.pendingEncounter) {
            state = gameReducer(parsed, state, {
              type: "ENCOUNTER_RESOLVED",
              triggerId: state.pendingEncounter,
              outcome: "defeated",
            });
          }
        }
      };
      // Đến rương sớm: bị khóa.
      walk(parsed.treasure);
      expect(state.completed).toBe(false);
      for (const t of parsed.triggers) if (!state.triggered.includes(t.id)) walk(t);
      expect(state.resolved).toHaveLength(7);
      expect(isTreasureOpenable(state)).toBe(true);
      walk(parsed.treasure);
      expect(state.completed).toBe(true);
    }
  });
});

describe("validateLevelFiles — dữ liệu sai", () => {
  it("ký tự ô sai chỉ rõ tệp, mã và tọa độ", () => {
    const files = withFile(FILE_1, (l) => ({ ...l, rows: l.rows.map((r, i) => (i === 1 ? r.replace("S", "X") : r)) }));
    const issue = validateLevelFiles(files).find((i) => i.code === "UNKNOWN_CELL");
    expect(issue).toMatchObject({ file: FILE_1, position: { row: 1, col: 1 } });
  });

  it("JSON sai schema: thiếu trường, trường lạ, tọa độ âm/không nguyên, mã sai, cú pháp", () => {
    expect(
      codesOf(withFile(FILE_1, (l) => Object.fromEntries(Object.entries(l).filter(([key]) => key !== "name")))),
    ).toContain("SCHEMA_INVALID");
    expect(codesOf(withFile(FILE_1, (l) => ({ ...l, hint: "x" })))).toContain("SCHEMA_INVALID");
    expect(codesOf(withFile(FILE_1, (l) => ({ ...l, triggers: [{ ...l.triggers[0], row: -1 }] })))).toContain(
      "SCHEMA_INVALID",
    );
    expect(codesOf(withFile(FILE_1, (l) => ({ ...l, triggers: [{ ...l.triggers[0], col: 1.5 }] })))).toContain(
      "SCHEMA_INVALID",
    );
    expect(codesOf(withFile(FILE_1, (l) => ({ ...l, id: "Bad Id" })))).toContain("SCHEMA_INVALID");
    expect(codesOf(new Map(repoFiles).set(FILE_1, "{ khong phai json"))).toContain("JSON_SYNTAX");
  });

  it("trigger không trên đường hoặc sai số lượng bị validateLevel chặn", () => {
    const wall = withFile(FILE_1, (l) => ({
      ...l,
      triggers: [{ ...l.triggers[0], row: 0, col: 0 }, ...l.triggers.slice(1)],
    }));
    expect(codesOf(wall)).toContain("TRIGGER_NOT_ON_PATH");
    expect(codesOf(withFile(FILE_1, (l) => ({ ...l, triggers: l.triggers.slice(1) })))).toContain("TRIGGER_COUNT");
  });

  it("thiếu một màn", () => {
    const files = new Map(repoFiles);
    files.delete(FILE_2);
    expect(validateLevelFiles(files)).toEqual([expect.objectContaining({ file: FILE_2, code: "MISSING_LEVEL_FILE" })]);
  });

  it("hai màn trùng ID", () => {
    const codes = codesOf(withFile(FILE_2, (l) => ({ ...l, id: "treasure-maze-01" })));
    expect(codes).toContain("LEVEL_ID_DUPLICATE");
    expect(codes).toContain("LEVEL_ID_MISMATCH");
  });

  it("tệp màn thừa ngoài danh sách bị báo", () => {
    const files = new Map(repoFiles).set(`${LEVELS_DIR}level-04.json`, repoFiles.get(FILE_1) ?? "");
    expect(codesOf(files)).toContain("UNEXPECTED_LEVEL_FILE");
  });
});

describe("npm run content:check với dữ liệu màn", () => {
  const temp = mkdtempSync(join(tmpdir(), "readmate-content-"));
  afterAll(() => rmSync(temp, { recursive: true, force: true }));
  const run = (cwd: string) =>
    spawnSync(
      process.execPath,
      ["--disable-warning=MODULE_TYPELESS_PACKAGE_JSON", join(process.cwd(), "scripts/content-check.ts")],
      { cwd, encoding: "utf8" },
    );

  it("thất bại (exit 1) khi một màn bị lỗi và báo đúng mã", () => {
    cpSync(CONTENT, join(temp, "content"), { recursive: true });
    const target = join(temp, "content", LEVELS_DIR, "level-03.json");
    const level = JSON.parse(readFileSync(target, "utf8")) as LevelFile;
    level.rows[1] = level.rows[1]!.replace("S", "?");
    writeFileSync(target, JSON.stringify(level));
    const result = run(temp);
    expect(result.status).toBe(1);
    expect(result.stdout).toContain("UNKNOWN_CELL");
    expect(result.stdout).toContain("level-03.json");
  }, 60_000);

  it("kho repo hiện tại đạt", () => {
    const result = run(process.cwd());
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Màn Mê cung kho báu: 3/3");
  }, 60_000);
});
