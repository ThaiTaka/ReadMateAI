import { describe, expect, it } from "vitest";
import {
  BALANCE_FLOOR,
  GAME_KEYS,
  GAME_MIN_BALANCE,
  MAP_TILE_STEP,
  MONSTER_HP,
  POINTS_CORRECT,
  POINTS_INCORRECT,
  QUESTIONS_PER_ENCOUNTER,
  ENCOUNTERS_PER_LEVEL,
  SCORING_RULES_VERSION,
} from "@/features/gamification/rules";
import {
  canEnterGame,
  gameUnlockStates,
  milestonePoints,
  milestoneProgress,
  tilesAllowed,
} from "@/features/gamification/unlocks";

describe("hằng số điểm (khớp GAMIFICATION_SPEC §1 — nguồn duy nhất trong mã)", () => {
  it("đúng giá trị người điều phối quy định ở R01", () => {
    expect(SCORING_RULES_VERSION).toBe("r1");
    expect(POINTS_CORRECT).toBe(10);
    expect(POINTS_INCORRECT).toBe(-5);
    expect(BALANCE_FLOOR).toBe(0);
    expect(MAP_TILE_STEP).toBe(30);
    expect(GAME_MIN_BALANCE).toEqual({ treasure_maze: 50, wonder_forest: 120, tone_island: 200, rhyme_castle: 300 });
    expect(GAME_KEYS).toEqual(["treasure_maze", "wonder_forest", "tone_island", "rhyme_castle"]);
    expect([MONSTER_HP, QUESTIONS_PER_ENCOUNTER, ENCOUNTERS_PER_LEVEL]).toEqual([3, 3, 7]);
  });
});

describe("mốc khám phá bản đồ (mỗi 30 điểm tích lũy)", () => {
  it("tilesAllowed: làm tròn xuống, không âm, chịu được giá trị lạ", () => {
    expect([0, 29, 30, 59, 60, 135, 150].map(tilesAllowed)).toEqual([0, 0, 1, 1, 2, 4, 5]);
    expect(tilesAllowed(-20)).toBe(0);
    expect(tilesAllowed(Number.NaN)).toBe(0);
  });

  it("milestoneProgress: 135 điểm → đã 4 mốc, mốc kế 150, còn 15", () => {
    expect(milestoneProgress(135)).toEqual({ reached: 4, nextAt: 150, remaining: 15, ratio: 0.5 });
    expect(milestoneProgress(0)).toEqual({ reached: 0, nextAt: 30, remaining: 30, ratio: 0 });
    expect(milestoneProgress(60).remaining).toBe(30);
  });

  it("milestonePoints: 30, 60, 90, 120…", () => {
    expect(milestonePoints(4)).toEqual([30, 60, 90, 120]);
    expect(milestonePoints(0)).toEqual([]);
  });
});

describe("điều kiện vào mini-game (điểm hiện tại ≥ ngưỡng, không tốn điểm)", () => {
  it("đúng ngưỡng là đủ, thiếu 1 điểm là chưa đủ", () => {
    expect(canEnterGame(50, "treasure_maze")).toBe(true);
    expect(canEnterGame(49, "treasure_maze")).toBe(false);
    expect(canEnterGame(300, "rhyme_castle")).toBe(true);
    expect(canEnterGame(-10, "treasure_maze")).toBe(false);
  });

  it("gameUnlockStates(135): Mê cung, Rừng chữ đủ điểm; Đảo thiếu 65; Lâu đài thiếu 165", () => {
    expect(gameUnlockStates(135)).toEqual([
      { game: "treasure_maze", minBalance: 50, eligible: true, missing: 0 },
      { game: "wonder_forest", minBalance: 120, eligible: true, missing: 0 },
      { game: "tone_island", minBalance: 200, eligible: false, missing: 65 },
      { game: "rhyme_castle", minBalance: 300, eligible: false, missing: 165 },
    ]);
  });
});
