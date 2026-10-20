import { describe, expect, it } from "vitest";
import {
  applyPointEvent,
  firstLedgerInconsistency,
  nominalDelta,
  replayOutcomes,
  scoreFromLedger,
} from "@/features/gamification/apply";
import { GAME_MIN_BALANCE } from "@/features/gamification/rules";
import { EMPTY_SCORE, type AnswerOutcome } from "@/features/gamification/score-types";
import {
  attemptGate,
  isSeasonActive,
  scorableDecision,
  statusAfterAttempt,
} from "@/features/gamification/score-validation";
import { canEnterGame, gameUnlockStates, tilesAllowed } from "@/features/gamification/unlocks";
import { createRng } from "@/features/exercises/generation/rng";

const C: AnswerOutcome = "correct";
const W: AnswerOutcome = "incorrect";

describe("công thức điểm (GAMIFICATION_SPEC §3)", () => {
  it("đúng +10, sai −5", () => {
    expect(nominalDelta(C)).toBe(10);
    expect(nominalDelta(W)).toBe(-5);
    expect(applyPointEvent(EMPTY_SCORE, C)).toMatchObject({ nominalDelta: 10, appliedDelta: 10, balanceAfter: 10 });
    expect(applyPointEvent({ balance: 20, earnedTotal: 20, deductedTotal: 0 }, W)).toMatchObject({
      nominalDelta: -5,
      appliedDelta: -5,
      balanceBefore: 20,
      balanceAfter: 15,
      score: { balance: 15, earnedTotal: 20, deductedTotal: 5 },
    });
  });

  it("sàn 0 tại từng sự kiện: sai khi đang 0 điểm vẫn 0 (nominal −5, applied 0); đúng ngay sau → 10", () => {
    const wrong = applyPointEvent(EMPTY_SCORE, W);
    expect(wrong).toMatchObject({ nominalDelta: -5, appliedDelta: 0, balanceBefore: 0, balanceAfter: 0 });
    expect(wrong.score).toEqual({ balance: 0, earnedTotal: 0, deductedTotal: 0 });
    expect(applyPointEvent(wrong.score, C).score.balance).toBe(10);
  });

  it("sai khi đang 3 điểm chỉ trừ 3 (không âm)", () => {
    expect(applyPointEvent({ balance: 3, earnedTotal: 10, deductedTotal: 7 }, W)).toMatchObject({
      appliedDelta: -3,
      balanceAfter: 0,
      score: { deductedTotal: 10 },
    });
  });

  it("ví dụ của người điều phối: 0 → 10 → 20 → 30 (mốc) → 25 (mốc giữ) → 35", () => {
    const { score, ledger } = replayOutcomes([C, C, C, W, C]);
    expect(ledger.map((entry) => entry.balanceAfter)).toEqual([10, 20, 30, 25, 35]);
    expect(score).toEqual({ balance: 35, earnedTotal: 40, deductedTotal: 5 });
    expect(tilesAllowed(30)).toBe(1);
    // Sau khi sai (25 điểm hiện tại) điểm tích lũy vẫn 30 → mốc đã đạt không mất.
    expect(tilesAllowed(replayOutcomes([C, C, C, W]).score.earnedTotal)).toBe(1);
  });

  it("bảng ví dụ §3: sai → đúng từ 0; từ 20 sai → sai → đúng", () => {
    expect(replayOutcomes([W, C]).score).toEqual({ balance: 10, earnedTotal: 10, deductedTotal: 0 });
    const from20 = [W, W, C].reduce((score, outcome) => applyPointEvent(score, outcome).score, {
      balance: 20,
      earnedTotal: 20,
      deductedTotal: 0,
    });
    expect(from20).toEqual({ balance: 20, earnedTotal: 30, deductedTotal: 10 });
  });

  it("tích lũy không bao giờ giảm khi trả lời sai", () => {
    let score = replayOutcomes([C, C, C, C]).score;
    for (let index = 0; index < 20; index += 1) {
      const next = applyPointEvent(score, W).score;
      expect(next.earnedTotal).toBe(score.earnedTotal);
      score = next;
    }
    expect(score.balance).toBe(0);
  });

  it("chịu được dữ liệu lạ (âm, NaN) mà không tạo điểm âm", () => {
    expect(applyPointEvent({ balance: -40, earnedTotal: Number.NaN, deductedTotal: -1 }, W).score).toEqual({
      balance: 0,
      earnedTotal: 0,
      deductedTotal: 0,
    });
  });
});

describe("thuộc tính với chuỗi ngẫu nhiên có seed (GAMIFICATION_SPEC §13.2)", () => {
  for (const seed of ["s1", "s2", "s3", "chuoi-dai", "lop-1a2"]) {
    it(`seed ${seed}: balance ≥ 0, tích lũy không giảm, số dư tính lại từ sổ cái = số dư lưu`, () => {
      const rng = createRng(seed);
      const outcomes = Array.from({ length: 400 }, () => (rng.next() < 0.55 ? C : W));
      let previousEarned = 0;
      let score = EMPTY_SCORE;
      const ledger = [];
      for (const outcome of outcomes) {
        const { score: next, ...entry } = applyPointEvent(score, outcome);
        expect(next.balance).toBeGreaterThanOrEqual(0);
        expect(next.earnedTotal).toBeGreaterThanOrEqual(previousEarned);
        expect(entry.appliedDelta).toBeGreaterThanOrEqual(-5);
        expect(entry.appliedDelta).toBeLessThanOrEqual(10);
        previousEarned = next.earnedTotal;
        ledger.push(entry);
        score = next;
      }
      expect(scoreFromLedger(ledger)).toEqual(score);
      expect(firstLedgerInconsistency(ledger)).toBe(-1);
      expect(score.earnedTotal).toBe(outcomes.filter((outcome) => outcome === C).length * 10);
      expect(score.balance).toBe(score.earnedTotal - score.deductedTotal);
    });
  }

  it("phát hiện sổ cái bị sửa (lệch số dư, sai sàn, nối sai)", () => {
    const { ledger } = replayOutcomes([C, W, W, W, C]);
    expect(firstLedgerInconsistency(ledger)).toBe(-1);
    expect(firstLedgerInconsistency(ledger.map((e, i) => (i === 1 ? { ...e, balanceAfter: 99 } : e)))).toBe(1);
    expect(firstLedgerInconsistency(ledger.map((e, i) => (i === 3 ? { ...e, appliedDelta: -5 } : e)))).toBe(3);
    expect(firstLedgerInconsistency(ledger.map((e, i) => (i === 0 ? { ...e, nominalDelta: 999 } : e)))).toBe(0);
    expect(firstLedgerInconsistency(ledger.slice(1))).toBe(0);
  });
});

describe("mốc thẻ bản đồ và ngưỡng mini-game", () => {
  it("29 → 0 thẻ, 30 → 1, 59 → 1, 60 → 2, 90 → 3, 120 → 4; chặn bởi tổng số thẻ", () => {
    expect([29, 30, 59, 60, 89, 90, 119, 120, 149].map((earned) => tilesAllowed(earned))).toEqual([
      0, 1, 1, 2, 2, 3, 3, 4, 4,
    ]);
    expect(tilesAllowed(10_000, 8)).toBe(8);
    expect(tilesAllowed(60, 1)).toBe(1);
  });

  it("biên của bốn mini-game theo ĐIỂM HIỆN TẠI (không tiêu điểm)", () => {
    const cases: Array<[number, keyof typeof GAME_MIN_BALANCE, boolean]> = [
      [49, "treasure_maze", false],
      [50, "treasure_maze", true],
      [119, "wonder_forest", false],
      [120, "wonder_forest", true],
      [199, "tone_island", false],
      [200, "tone_island", true],
      [299, "rhyme_castle", false],
      [300, "rhyme_castle", true],
    ];
    for (const [balance, game, expected] of cases) expect(canEnterGame(balance, game)).toBe(expected);
    const states = gameUnlockStates(55);
    expect(states.find((state) => state.game === "treasure_maze")).toMatchObject({ eligible: true, missing: 0 });
    expect(states.find((state) => state.game === "wonder_forest")).toMatchObject({ eligible: false, missing: 65 });
  });

  it("từ 52 điểm sai 1 lượt → 47: tạm chưa vào được Mê cung (xét điểm hiện tại)", () => {
    const after = applyPointEvent({ balance: 52, earnedTotal: 60, deductedTotal: 8 }, W).score;
    expect(after.balance).toBe(47);
    expect(canEnterGame(after.balance, "treasure_maze")).toBe(false);
    expect(tilesAllowed(after.earnedTotal)).toBe(2);
  });
});

describe("câu tính điểm và lượt hợp lệ (GAMIFICATION_SPEC §4)", () => {
  const base = {
    mode: "production" as const,
    learningDataConsent: true,
    seasonActive: true,
    alreadyScoredInSeason: false,
  };

  it("chỉ tính điểm khi học thật + có đồng ý + mùa đang diễn ra + chưa từng tính điểm trong mùa", () => {
    expect(scorableDecision(base)).toEqual({ scorable: true, reason: null });
    expect(scorableDecision({ ...base, mode: "demo" }).reason).toBe("DEMO_MODE");
    expect(scorableDecision({ ...base, learningDataConsent: false }).reason).toBe("NO_LEARNING_DATA_CONSENT");
    expect(scorableDecision({ ...base, seasonActive: false }).reason).toBe("SEASON_NOT_ACTIVE");
    expect(scorableDecision({ ...base, alreadyScoredInSeason: true }).reason).toBe("ALREADY_SCORED_IN_SEASON");
    expect(scorableDecision({ ...base, previewOnly: true }).reason).toBe("PREVIEW_ONLY");
    expect(scorableDecision({ ...base, workedExample: true }).reason).toBe("WORKED_EXAMPLE");
  });

  it("mùa đang diễn ra", () => {
    expect(isSeasonActive({ status: "active" })).toBe(true);
    expect(isSeasonActive({ status: "closed" })).toBe(false);
    expect(isSeasonActive(null)).toBe(false);
  });

  it("lượt hợp lệ: mùa, trạng thái câu, số lượt, câu trả lời trùng", () => {
    const gate = {
      seasonActive: true,
      status: "open" as const,
      attemptsUsed: 1,
      maxAttempts: 3,
      previousResponseKeys: ["a"],
      responseKey: "b",
    };
    expect(attemptGate(gate)).toEqual({ ok: true, attemptNo: 2 });
    expect(attemptGate({ ...gate, seasonActive: false })).toEqual({ ok: false, code: "SEASON_CLOSED" });
    expect(attemptGate({ ...gate, status: "correct" })).toEqual({ ok: false, code: "QUESTION_CLOSED" });
    expect(attemptGate({ ...gate, attemptsUsed: 3 })).toEqual({ ok: false, code: "NO_ATTEMPTS_LEFT" });
    expect(attemptGate({ ...gate, responseKey: "a" })).toEqual({ ok: false, code: "DUPLICATE_RESPONSE" });
  });

  it("trạng thái sau lượt: đúng đóng câu; sai hết lượt → exhausted; còn lượt → open", () => {
    expect(statusAfterAttempt(true, 1, 3)).toBe("correct");
    expect(statusAfterAttempt(false, 1, 3)).toBe("open");
    expect(statusAfterAttempt(false, 3, 3)).toBe("exhausted");
    expect(statusAfterAttempt(false, 1, 1)).toBe("exhausted");
  });
});
