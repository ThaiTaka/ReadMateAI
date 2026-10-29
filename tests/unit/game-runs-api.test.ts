import { describe, expect, it } from "vitest";
import {
  buildGamePosition,
  buildGameRun,
  savePositionRequestSchema,
  startGameRunRequestSchema,
} from "@/features/game-runs/dto";
import { ERROR_CODES, mapDbError } from "@/server/result";
import { statusFor } from "@/server/student-gateway/http";
import { vi } from "@/strings/vi";

const id = "5b1c3a52-7a43-4c43-9a3e-0d8f6a1d2e11";

describe("R07.5b1 — lược đồ request", () => {
  it("start: chỉ treasure_maze và 3 màn; không nhận trường lạ", () => {
    const ok = { gameKey: "treasure_maze", levelKey: "treasure-maze-02" };
    expect(startGameRunRequestSchema.safeParse(ok).success).toBe(true);
    expect(startGameRunRequestSchema.safeParse({ ...ok, levelKey: "treasure-maze-04" }).success).toBe(false);
    expect(startGameRunRequestSchema.safeParse({ ...ok, gameKey: "wonder_forest" }).success).toBe(false);
    // R08.6: chỉ có ý định "replay" (boolean); điểm/mùa/lớp/scored/loại lượt vẫn không nhận từ trình duyệt.
    expect(startGameRunRequestSchema.safeParse({ ...ok, replay: true }).success).toBe(true);
    expect(startGameRunRequestSchema.safeParse({ ...ok, replay: "yes" }).success).toBe(false);
    for (const extra of ["classId", "seasonId", "points", "scored", "fixture", "student_id", "isReplay", "runKind"]) {
      expect(startGameRunRequestSchema.safeParse({ ...ok, [extra]: "x" }).success).toBe(false);
    }
  });

  it("position: ≤ 64 bước, số nguyên không âm, không trường lạ", () => {
    const step = { row: 1, col: 2 };
    const base = { stateVersion: 1, path: [step] };
    expect(savePositionRequestSchema.safeParse(base).success).toBe(true);
    expect(savePositionRequestSchema.safeParse({ ...base, path: Array(64).fill(step) }).success).toBe(true);
    expect(savePositionRequestSchema.safeParse({ ...base, path: Array(65).fill(step) }).success).toBe(false);
    expect(savePositionRequestSchema.safeParse({ ...base, path: [{ row: -1, col: 0 }] }).success).toBe(false);
    expect(savePositionRequestSchema.safeParse({ ...base, path: [{ row: 1.5, col: 0 }] }).success).toBe(false);
    expect(savePositionRequestSchema.safeParse({ ...base, path: [{ row: 1, col: 0, hp: 3 }] }).success).toBe(false);
    expect(savePositionRequestSchema.safeParse({ ...base, stateVersion: 0 }).success).toBe(false);
    for (const extra of ["start", "points", "encounter", "position"]) {
      expect(savePositionRequestSchema.safeParse({ ...base, [extra]: 1 }).success).toBe(false);
    }
  });
});

describe("R07.5b1 — DTO", () => {
  const row = {
    id,
    level_key: "treasure-maze-01",
    level_version: "v",
    status: "in_progress",
    scored: false,
    replay: false,
    position: { row: 1, col: 1 },
    state_version: 1,
    encounter_count: 7,
    student_id: id,
    class_id: id,
    season_id: id,
  };

  it("dựng lại từng trường, không rò student/class/season", () => {
    const dto = buildGameRun({ outcome: "created", run: row });
    expect(dto).toEqual({
      outcome: "created",
      run: {
        id,
        levelKey: "treasure-maze-01",
        levelVersion: "v",
        position: { row: 1, col: 1 },
        stateVersion: 1,
        status: "in_progress",
        scored: false,
        replay: false,
      },
    });
    expect(buildGameRun({ outcome: "created", run: { ...row, replay: true } })?.run).toMatchObject({
      scored: false,
      replay: true,
    });
    expect(buildGameRun({ outcome: "created", run: { ...row, replay: undefined } })).toBeNull();
    expect(JSON.stringify(dto)).not.toMatch(/student|class|season/u);
  });

  it("phản hồi sai hình dạng → null", () => {
    expect(buildGameRun({ outcome: "x", run: row })).toBeNull();
    expect(buildGameRun(null)).toBeNull();
    expect(buildGamePosition({ outcome: "saved", state_version: 0, position: { row: 1, col: 1 } })).toBeNull();
    expect(buildGamePosition({ outcome: "replayed", state_version: 3, position: { row: 1, col: 4 } })).toEqual({
      outcome: "replayed",
      position: { row: 1, col: 4 },
      stateVersion: 3,
    });
  });
});

describe("R07.5b1 — mã lỗi", () => {
  it("bốn mã mới có trong danh mục, có câu chữ, mapDbError nhận đúng và HTTP phù hợp", () => {
    for (const code of [
      "INSUFFICIENT_POINTS",
      "STATE_CONFLICT",
      "INVALID_POSITION",
      "RUN_NOT_ACTIVE",
      "REPLAY_NOT_AVAILABLE",
    ] as const) {
      expect(ERROR_CODES).toContain(code);
      expect(vi.errors[code].length).toBeGreaterThan(10);
      expect(mapDbError({ code: "22023", message: code })).toBe(code);
    }
    expect(statusFor("STATE_CONFLICT")).toBe(409);
    expect(statusFor("INSUFFICIENT_POINTS")).toBe(409);
    expect(statusFor("RUN_NOT_ACTIVE")).toBe(409);
    expect(statusFor("INVALID_POSITION")).toBe(400);
    expect(mapDbError({ code: "22023", message: "INVALID_INPUT" })).toBe("INVALID_INPUT");
  });
});
