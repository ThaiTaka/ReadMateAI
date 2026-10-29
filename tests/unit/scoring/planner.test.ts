import { describe, expect, it } from "vitest";
import {
  PRACTICE_SESSION_SIZE,
  planPracticeSession,
  supportLevelForBand,
  type PracticeCandidate,
} from "@/features/scored-practice/planner";

const candidate = (index: number, patch: Partial<PracticeCandidate> = {}): PracticeCandidate => ({
  exerciseItemId: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
  fingerprint: `fp-${index}`,
  typeCode: "letter_sound",
  variant: "visual_match",
  lessonOrdinal: 1,
  scoredInSeason: false,
  ...patch,
});

describe("bộ lập buổi luyện có điểm", () => {
  it("không có ứng viên → null (máy chủ trả INSUFFICIENT_CONTENT)", () => {
    expect(planPracticeSession([], { band: "developing", seed: "s" })).toBeNull();
  });

  it("tối đa 8 câu; câu chưa tính điểm trước, đánh dấu tính điểm", () => {
    const plan = planPracticeSession(
      Array.from({ length: 12 }, (_, index) => candidate(index)),
      { band: "developing", seed: "s" },
    )!;
    expect(plan).toHaveLength(PRACTICE_SESSION_SIZE);
    expect(plan.every((entry) => entry.scorable)).toBe(true);
    expect(new Set(plan.map((entry) => entry.exerciseItemId)).size).toBe(8);
  });

  it("bỏ trùng theo vân tay: hai bản sao chỉ lấy một; bản sao đã tính điểm thì cả nội dung coi là đã tính", () => {
    const plan = planPracticeSession(
      [candidate(1, { fingerprint: "same" }), candidate(2, { fingerprint: "same", scoredInSeason: true })],
      { band: "developing", seed: "s" },
    )!;
    expect(plan).toHaveLength(1);
    expect(plan[0]!.scorable).toBe(false);
  });

  it("thiếu câu mới → thêm câu đã tính điểm làm 'luyện thêm' (không tính điểm)", () => {
    const plan = planPracticeSession(
      [candidate(1), candidate(2, { scoredInSeason: true }), candidate(3, { scoredInSeason: true })],
      { band: "developing", seed: "s" },
    )!;
    expect(plan.map((entry) => entry.scorable)).toEqual([true, false, false]);
  });

  it("ưu tiên bài gần nhất; tái lập được theo seed", () => {
    const pool = [candidate(1), candidate(2, { lessonOrdinal: 2 }), candidate(3), candidate(4, { lessonOrdinal: 2 })];
    const plan = planPracticeSession(pool, { band: "developing", seed: "abc", size: 2 })!;
    expect(new Set(plan.map((entry) => entry.exerciseItemId))).toEqual(
      new Set([pool[1]!.exerciseItemId, pool[3]!.exerciseItemId]),
    );
    expect(planPracticeSession(pool, { band: "developing", seed: "abc" })).toEqual(
      planPracticeSession([...pool].reverse(), { band: "developing", seed: "abc" }),
    );
  });

  it("mức hỗ trợ mặc định theo nhóm và số lượt từ SUPPORT_POLICIES", () => {
    expect([
      supportLevelForBand("foundation"),
      supportLevelForBand("developing"),
      supportLevelForBand("extending"),
    ]).toEqual([3, 2, 1]);
    const plan = (band: "foundation" | "developing" | "extending") =>
      planPracticeSession([candidate(1)], { band, seed: "s" })![0]!;
    expect(plan("foundation")).toMatchObject({ supportLevel: 3, maxAttempts: 3 });
    expect(plan("developing")).toMatchObject({ supportLevel: 2, maxAttempts: 3 });
    expect(plan("extending")).toMatchObject({ supportLevel: 1, maxAttempts: 2 });
  });
});
