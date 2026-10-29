import { describe, expect, it } from "vitest";
import { SUPPORT_POLICIES } from "@/features/exercises/core/support";
import { MONSTER_KEYS } from "@/features/game-runs/monsters";
import { GAME_QUESTION_COUNT, planGameRun } from "@/features/game-runs/planner";
import type { PracticeCandidate } from "@/features/scored-practice/planner";

const candidate = (index: number, patch: Partial<PracticeCandidate> = {}): PracticeCandidate => ({
  exerciseItemId: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
  fingerprint: `fp-${index}`,
  typeCode: "letter_sound",
  variant: "visual_match",
  lessonOrdinal: 1,
  scoredInSeason: false,
  ...patch,
});
const pool = (count: number, patch: (index: number) => Partial<PracticeCandidate> = () => ({})) =>
  Array.from({ length: count }, (_, index) => candidate(index, patch(index)));

describe("bộ lập kế hoạch lượt Mê cung (R08.2)", () => {
  it("21 = 7 × 3 và danh mục quái vật đủ chọn 7 mã khác nhau", () => {
    expect(GAME_QUESTION_COUNT).toBe(21);
    expect(new Set(MONSTER_KEYS).size).toBe(MONSTER_KEYS.length);
    expect(MONSTER_KEYS.length).toBeGreaterThanOrEqual(7);
    for (const key of MONSTER_KEYS) expect(key).toMatch(/^[a-z0-9][a-z0-9_-]{1,47}$/u);
  });

  it("đúng 21 ứng viên khác nhau → 7 chạm trán × 3 câu, mọi câu và mọi quái vật đôi một khác nhau", () => {
    const plan = planGameRun(pool(21), { band: "developing", seed: "s" })!;
    expect(plan.encounters).toHaveLength(7);
    expect(plan.encounters.every((e) => e.questions.length === 3)).toBe(true);
    const items = plan.encounters.flatMap((e) => e.questions.map((q) => q.exerciseItemId));
    expect(new Set(items).size).toBe(21);
    expect(new Set(plan.encounters.map((e) => e.monsterKey)).size).toBe(7);
    for (const e of plan.encounters) expect(MONSTER_KEYS as readonly string[]).toContain(e.monsterKey);
  });

  it("20 ứng viên → null (không nhân bản câu, không nới quy tắc)", () => {
    expect(planGameRun(pool(20), { band: "developing", seed: "s" })).toBeNull();
    expect(planGameRun([], { band: "developing", seed: "s" })).toBeNull();
  });

  it("bản sao nội dung (cùng vân tay) chỉ đếm một: 21 mã câu nhưng 20 nội dung → null", () => {
    const candidates = pool(21, (index) => (index === 20 ? { fingerprint: "fp-0" } : {}));
    expect(planGameRun(candidates, { band: "developing", seed: "s" })).toBeNull();
  });

  it("nội dung đã tính điểm trong mùa bị loại, kể cả khi chỉ một bản sao của nó đã tính điểm", () => {
    const scored = pool(21, (index) => (index === 0 ? { scoredInSeason: true } : {}));
    expect(planGameRun(scored, { band: "developing", seed: "s" })).toBeNull();
    const oneCopy = [...pool(21), candidate(99, { fingerprint: "fp-0", scoredInSeason: true })];
    expect(planGameRun(oneCopy, { band: "developing", seed: "s" })).toBeNull();
    const enough = pool(23, (index) => (index < 2 ? { scoredInSeason: true } : {}));
    const plan = planGameRun(enough, { band: "developing", seed: "s" })!;
    const ids = plan.encounters.flatMap((e) => e.questions.map((q) => q.exerciseItemId));
    expect(ids).not.toContain(candidate(0).exerciseItemId);
    expect(ids).not.toContain(candidate(1).exerciseItemId);
  });

  it("R08.6 chơi lại: dùng lại được câu đã tính điểm, vẫn bỏ trùng vân tay và đòi đủ 21 câu khác nhau", () => {
    const allScored = pool(21, () => ({ scoredInSeason: true }));
    expect(planGameRun(allScored, { band: "developing", seed: "s" })).toBeNull();
    const plan = planGameRun(allScored, { band: "developing", seed: "s", replay: true })!;
    const ids = plan.encounters.flatMap((e) => e.questions.map((q) => q.exerciseItemId));
    expect(plan.encounters).toHaveLength(7);
    expect(new Set(ids).size).toBe(21);
    expect(new Set(plan.encounters.map((e) => e.monsterKey)).size).toBe(7);
    // Không nhân bản để đủ số lượng: 20 nội dung khác nhau (kể cả khi có bản sao) thì không có kế hoạch.
    const twenty = [
      ...pool(20, () => ({ scoredInSeason: true })),
      candidate(99, { fingerprint: "fp-0", scoredInSeason: true }),
    ];
    expect(planGameRun(twenty, { band: "developing", seed: "s", replay: true })).toBeNull();
  });

  it("R08.6 chơi lại: cùng seed → cùng kế hoạch; khác seed → thứ tự khác (mỗi lần chơi lại không giống hệt)", () => {
    const items = pool(30, () => ({ scoredInSeason: true }));
    const a = planGameRun(items, { band: "developing", seed: "x:replay0", replay: true });
    expect(planGameRun(items, { band: "developing", seed: "x:replay0", replay: true })).toEqual(a);
    expect(planGameRun(items, { band: "developing", seed: "x:replay1", replay: true })).not.toEqual(a);
  });

  it("mức hỗ trợ và số lượt theo nhóm: Nhóm 3 → H3, Nhóm 2 → H2, Nhóm 1 → H1 với số lượt của chính sách GĐ4", () => {
    for (const [band, level] of [
      ["foundation", 3],
      ["developing", 2],
      ["extending", 1],
    ] as const) {
      const plan = planGameRun(pool(25), { band, seed: "s" })!;
      for (const q of plan.encounters.flatMap((e) => e.questions)) {
        expect(q).toMatchObject({ supportLevel: level, maxAttempts: SUPPORT_POLICIES[level].maxAttempts });
      }
    }
  });

  it("ưu tiên bài gần nhất khi dư ứng viên", () => {
    const candidates = pool(30, (index) => ({ lessonOrdinal: index < 21 ? 5 : 1 }));
    const plan = planGameRun(candidates, { band: "developing", seed: "s" })!;
    const ids = new Set(plan.encounters.flatMap((e) => e.questions.map((q) => q.exerciseItemId)));
    for (let index = 0; index < 21; index += 1) expect(ids.has(candidate(index).exerciseItemId)).toBe(true);
  });

  it("hàm thuần: cùng đầu vào + seed → cùng kế hoạch; đảo thứ tự ứng viên không đổi kết quả; seed khác → khác", () => {
    const candidates = pool(30);
    const a = planGameRun(candidates, { band: "developing", seed: "x" });
    expect(planGameRun(candidates, { band: "developing", seed: "x" })).toEqual(a);
    expect(planGameRun([...candidates].reverse(), { band: "developing", seed: "x" })).toEqual(a);
    expect(planGameRun(candidates, { band: "developing", seed: "y" })).not.toEqual(a);
    expect(candidates).toEqual(pool(30));
  });

  it("kế hoạch chỉ chứa mã câu, mã quái vật, mức hỗ trợ, số lượt — không đáp án, không điểm, không học sinh", () => {
    const plan = planGameRun(pool(21), { band: "developing", seed: "s" })!;
    const text = JSON.stringify(plan);
    for (const word of ["answer", "reveal", "scorable", "student", "class", "season", "points", "trigger"]) {
      expect(text).not.toContain(word);
    }
    expect(Object.keys(plan.encounters[0]!).sort()).toEqual(["monsterKey", "questions"]);
    expect(Object.keys(plan.encounters[0]!.questions[0]!).sort()).toEqual([
      "exerciseItemId",
      "maxAttempts",
      "supportLevel",
    ]);
  });
});
