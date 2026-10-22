import { describe, expect, it } from "vitest";
import {
  activateEncounterRequestSchema,
  buildActivation,
  buildTreasure,
  openTreasureRequestSchema,
} from "../../../src/features/game-runs/encounter-dto";
import { ERROR_CODES, mapDbError } from "../../../src/server/result";
import { vi } from "../../../src/strings/vi";

const ID = "7c6a2b52-0e4f-4a6e-8a62-0f3d3d2f1a10";

describe("R08.3 — lược đồ request chạm trán / kho báu", () => {
  it("chỉ nhận studentId tùy chọn; mọi trường khác (tọa độ, HP, điểm, mã chạm trán) bị từ chối", () => {
    for (const schema of [activateEncounterRequestSchema, openTreasureRequestSchema]) {
      expect(schema.safeParse({}).success).toBe(true);
      expect(schema.safeParse({ studentId: ID }).success).toBe(true);
      for (const extra of [
        { row: 1, col: 4 },
        { hp: 0 },
        { hpRemaining: 0 },
        { points: 10 },
        { encounterId: ID },
        { runId: ID },
        { classId: ID },
        { is_correct: true },
      ]) {
        expect(schema.safeParse(extra).success).toBe(false);
      }
      expect(schema.safeParse({ studentId: "x" }).success).toBe(false);
    }
  });
});

describe("R08.3 — dựng DTO từ phản hồi CSDL", () => {
  const encounter = { id: ID, encounterNo: 3, monsterKey: "mon-03", status: "active", hpRemaining: 2 };

  it("kích hoạt: chỉ giữ kết quả và mã chạm trán, bỏ trường lạ", () => {
    expect(buildActivation({ outcome: "activated", encounter, student_id: ID })).toEqual({
      outcome: "activated",
      encounterId: ID,
    });
    expect(buildActivation({ outcome: "resumed", encounter })?.outcome).toBe("resumed");
  });

  it("kích hoạt: sai hình dạng → null", () => {
    expect(buildActivation(null)).toBeNull();
    expect(buildActivation({ outcome: "activated" })).toBeNull();
    expect(buildActivation({ outcome: "other", encounter })).toBeNull();
    expect(buildActivation({ outcome: "activated", encounter: { ...encounter, hpRemaining: 4 } })).toBeNull();
    expect(buildActivation({ outcome: "activated", encounter: { ...encounter, encounterNo: 8 } })).toBeNull();
    expect(buildActivation({ outcome: "activated", encounter: { ...encounter, status: "defeated" } })).toBeNull();
  });

  it("kho báu: dựng đúng trường, không lộ mã học sinh/lớp/mùa", () => {
    const dto = buildTreasure({
      outcome: "opened",
      treasure: { runId: ID, status: "completed", completedAt: "2026-10-22T10:00:00Z", defeated: 3, undefeated: 4 },
      class_id: ID,
    });
    expect(dto).toEqual({
      outcome: "opened",
      runId: ID,
      completedAt: "2026-10-22T10:00:00Z",
      defeated: 3,
      undefeated: 4,
    });
    expect(buildTreasure({ outcome: "opened" })).toBeNull();
    expect(
      buildTreasure({
        outcome: "opened",
        treasure: { runId: ID, status: "completed", completedAt: "x", defeated: 8, undefeated: 0 },
      }),
    ).toBeNull();
  });
});

describe("R08.3 — mã lỗi chạm trán", () => {
  const codes = [
    "ENCOUNTER_PENDING",
    "ENCOUNTER_ACTIVE",
    "ENCOUNTERS_INCOMPLETE",
    "ENCOUNTER_LIMIT",
    "ENCOUNTER_FINISHED",
    "NOT_AT_TRIGGER",
    "NOT_AT_TREASURE",
    "QUESTION_NOT_CURRENT",
  ] as const;

  it("lỗi CSDL cùng tên được ánh xạ đúng (kể cả ràng buộc 23514 và lỗi nghiệp vụ 22023)", () => {
    for (const code of codes) {
      expect(ERROR_CODES).toContain(code);
      expect(mapDbError({ code: "22023", message: code })).toBe(code);
    }
    expect(mapDbError({ code: "23514", message: "ENCOUNTER_LIMIT" })).toBe("ENCOUNTER_LIMIT");
  });

  it("mỗi mã có câu tiếng Việt dễ hiểu, không lộ thuật ngữ kỹ thuật hay từ gây áp lực", () => {
    for (const code of codes) {
      const text = vi.errors[code];
      expect(text.length).toBeGreaterThan(10);
      expect(text).not.toMatch(/SQL|database|CSDL|lỗi hệ thống|thua|kém|phạt|sai rồi/i);
    }
  });
});
