import { describe, expect, it } from "vitest";
import { mazeEnterable, mazeEntry, type MazeRunSummary } from "@/features/game-runs/entry";
import { gameWorld, isPlayable } from "@/features/game-world/catalog";

const LEVELS = ["level-01", "level-02", "level-03"] as const;
const SEASON = "season-now";

const run = (levelKey: string, status: string, overrides: Partial<MazeRunSummary> = {}): MazeRunSummary => ({
  levelKey,
  status,
  scored: true,
  seasonId: SEASON,
  ...overrides,
});

describe("mazeEntry — nút vào Mê cung nói đúng tình trạng lượt chơi thật", () => {
  it("chưa có lượt nào: vào mới ở màn 1", () => {
    expect(mazeEntry(LEVELS, [], SEASON)).toEqual({ mode: "start", level: 1 });
  });

  it("có lượt đang dở: tiếp tục đúng màn đó (kể cả màn 2 hay lượt chơi lại)", () => {
    expect(mazeEntry(LEVELS, [run("level-02", "in_progress")], SEASON)).toEqual({ mode: "resume", level: 2 });
    expect(mazeEntry(LEVELS, [run("level-01", "in_progress", { scored: false })], SEASON)).toEqual({
      mode: "resume",
      level: 1,
    });
  });

  it("lượt dở thắng lượt đã xong: đang đi dở màn 3 thì mở màn 3, không quay về màn chưa chơi", () => {
    const runs = [run("level-01", "completed"), run("level-03", "in_progress")];
    expect(mazeEntry(LEVELS, runs, SEASON)).toEqual({ mode: "resume", level: 3 });
  });

  it("đã xong màn 1: vào mới ở màn 2; xong cả ba màn có điểm: chơi lại (màn 1)", () => {
    expect(mazeEntry(LEVELS, [run("level-01", "completed")], SEASON)).toEqual({ mode: "start", level: 2 });
    const all = LEVELS.map((key) => run(key, "completed"));
    expect(mazeEntry(LEVELS, all, SEASON)).toEqual({ mode: "replay", level: 1 });
  });

  it("lượt chơi lại đã xong không tính là đã đi hết màn có điểm", () => {
    const runs = [run("level-01", "completed", { scored: false })];
    expect(mazeEntry(LEVELS, runs, SEASON)).toEqual({ mode: "start", level: 1 });
  });

  it("chỉ tính lượt của mùa hiện tại: lượt ở mùa đã đóng không làm hiện 'Tiếp tục' hay 'Chơi lại'", () => {
    const old = LEVELS.map((key) => run(key, "completed", { seasonId: "season-old" }));
    expect(mazeEntry(LEVELS, [...old, run("level-02", "in_progress", { seasonId: "season-old" })], SEASON)).toEqual({
      mode: "start",
      level: 1,
    });
    expect(mazeEntry(LEVELS, old, null)).toEqual({ mode: "start", level: 1 });
  });

  it("không có màn nào: về trạng thái vào mới (không ném lỗi)", () => {
    expect(mazeEntry([], [run("level-01", "in_progress")], SEASON)).toEqual({ mode: "start", level: 1 });
  });
});

describe("mazeEnterable — ngưỡng điểm chỉ áp dụng khi BẮT ĐẦU lượt tính điểm mới (R08.7)", () => {
  it("đủ điểm thì luôn vào được", () => {
    expect(mazeEnterable({ mode: "start", level: 1 }, true)).toBe(true);
  });

  it("thiếu điểm: không vào mới được, nhưng tiếp tục lượt dở hoặc chơi lại thì được", () => {
    expect(mazeEnterable({ mode: "start", level: 1 }, false)).toBe(false);
    expect(mazeEnterable({ mode: "resume", level: 2 }, false)).toBe(true);
    expect(mazeEnterable({ mode: "replay", level: 1 }, false)).toBe(true);
  });
});

describe("danh mục Game World — chỉ Mê cung kho báu có bản chơi thật", () => {
  it("Mê cung playable có đường vào thật và bản thử; ba game còn lại chưa phát hành, không đường vào", () => {
    expect(isPlayable("treasure_maze")).toBe(true);
    expect(gameWorld("treasure_maze")).toMatchObject({
      release: "playable",
      playPath: "/learn/me/games/treasure-maze",
      demoPath: "/demo/treasure-maze",
    });
    for (const key of ["wonder_forest", "tone_island", "rhyme_castle"] as const) {
      expect(isPlayable(key)).toBe(false);
      expect(gameWorld(key)).toMatchObject({ release: "unreleased", playPath: null, demoPath: null });
    }
  });
});
