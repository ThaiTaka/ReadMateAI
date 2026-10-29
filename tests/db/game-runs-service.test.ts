import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { setLocalGameRunFixtures } from "../../scripts/lib/test-fixtures";
import { saveGamePosition, startGameRun } from "@/server/game-runs/student";
import type { StudentContext } from "@/server/student-gateway/context";
import { player, type Mem } from "./board-helpers";
import { admin, buildWorld, rpcOk, type Db, type World } from "./helpers";
import { confirmFixtureCurriculum, fixtures, linkedStudent } from "./scoring-helpers";

/**
 * R07.5b1 — lớp dịch vụ API lượt chơi (DTO + mã lỗi) trên Supabase LOCAL, dùng client đặc quyền thật như route.
 * Quy tắc nghiệp vụ chi tiết đã kiểm ở game-runs.test.ts (R07.5a); ở đây kiểm đường API: quyền sở hữu, DTO không rò ID,
 * ánh xạ mã lỗi, chống ghi đúp, reset mùa.
 */

const LEVEL = "treasure-maze-01";
let world: World;

const ctx = (mem: Mem): StudentContext => ({
  authUserId: mem.device.id,
  admin: admin as unknown as StudentContext["admin"],
  students: [
    {
      id: mem.studentId,
      displayName: "Bạn",
      avatarKey: "a",
      motionPreference: "system",
      soundPreference: "on",
      className: "L",
    },
  ],
});
const east = (from: number, to: number) => Array.from({ length: to - from }, (_, i) => ({ row: 1, col: from + i + 1 }));

async function newClass(teacher: Db) {
  const id = await rpcOk(
    teacher.rpc("teacher_create_class", { p_name: `GRS ${randomUUID().slice(0, 6)}`, p_school_year: "2026-2027" }),
  );
  await confirmFixtureCurriculum(teacher, id, 2);
  return id;
}

async function member(teacher: Db, classId: string, points: number): Promise<Mem> {
  const { studentId, device } = await linkedStudent(teacher, classId);
  const mem: Mem = { studentId, device, alias: "" };
  if (points > 0) await player(mem).correct(points / 10);
  return mem;
}

beforeAll(async () => {
  await fixtures();
  setLocalGameRunFixtures(false);
  world = await buildWorld();
}, 120_000);
afterAll(() => setLocalGameRunFixtures(false));

describe("R07.5b1 — dịch vụ lượt chơi", () => {
  it("cờ fixture tắt không tạo lượt; 40 điểm bị từ chối; hồ sơ không thuộc thiết bị bị chặn", async () => {
    const t = world.teacherA.client;
    const classId = await newClass(t);
    const rich = await member(t, classId, 50);
    const poor = await member(t, classId, 40);
    expect(await startGameRun(ctx(rich), rich.studentId, LEVEL)).toEqual({ ok: false, code: "INSUFFICIENT_CONTENT" });
    expect(await startGameRun(ctx(poor), poor.studentId, LEVEL)).toEqual({ ok: false, code: "INSUFFICIENT_POINTS" });
    expect(await startGameRun(ctx(rich), poor.studentId, LEVEL)).toEqual({ ok: false, code: "FORBIDDEN" });
    // Danh sách hồ sơ bị giả ở tầng ứng dụng: CSDL vẫn từ chối vì thiết bị không liên kết với em kia.
    const spoof = { ...ctx(rich), students: ctx(poor).students };
    const forged = await startGameRun(spoof, poor.studentId, LEVEL);
    expect(forged.ok).toBe(false);
    const none = await admin.from("game_runs").select("id").eq("student_id", rich.studentId);
    expect(none.data).toHaveLength(0);
  });

  it("fixture LOCAL: lượt scored=false, DTO không rò ID; lưu bước; retry replayed; xung đột; tường; lượt người khác", async () => {
    const t = world.teacherA.client;
    const classId = await newClass(t);
    const a = await member(t, classId, 50);
    const b = await member(t, classId, 50);
    setLocalGameRunFixtures(true);
    let created;
    let createdB;
    try {
      created = await startGameRun(ctx(a), a.studentId, LEVEL);
      createdB = await startGameRun(ctx(b), b.studentId, LEVEL);
    } finally {
      setLocalGameRunFixtures(false);
    }
    if (!created.ok || !createdB.ok) throw new Error("không tạo được lượt");
    expect(created.data.outcome).toBe("created");
    const run = created.data.run;
    expect(run).toMatchObject({ scored: false, status: "in_progress", stateVersion: 1, position: { row: 1, col: 1 } });
    const text = JSON.stringify(created);
    expect(text).not.toContain(a.studentId);
    expect(text).not.toContain(classId);
    expect(text).not.toMatch(/season|student_id|class_id/u);

    // Bắt đầu lại (cờ đã tắt) trả đúng lượt cũ.
    const again = await startGameRun(ctx(a), a.studentId, LEVEL);
    expect(again.ok && again.data.run.id).toBe(run.id);

    const saved = await saveGamePosition(ctx(a), a.studentId, run.id, east(1, 6), 1);
    expect(saved).toEqual({ ok: true, data: { outcome: "saved", position: { row: 1, col: 6 }, stateVersion: 2 } });
    const replay = await saveGamePosition(ctx(a), a.studentId, run.id, east(1, 6), 1);
    expect(replay.ok && replay.data.outcome).toBe("replayed");
    const row = await admin.from("game_runs").select("state_version").eq("id", run.id).single();
    expect(row.data!.state_version).toBe(2);

    // Hai yêu cầu cùng stateVersion: chỉ một thắng.
    const results = await Promise.all([
      saveGamePosition(ctx(a), a.studentId, run.id, [{ row: 1, col: 7 }], 2),
      saveGamePosition(ctx(a), a.studentId, run.id, [{ row: 1, col: 5 }], 2),
    ]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.filter((r) => !r.ok)).toEqual([{ ok: false, code: "STATE_CONFLICT" }]);

    // Vị trí giả / đi xuyên tường (ô (2,1) là tường).
    const latest = (await admin.from("game_runs").select("state_version, position").eq("id", run.id).single()).data!;
    expect(await saveGamePosition(ctx(a), a.studentId, run.id, [{ row: 2, col: 1 }], latest.state_version)).toEqual({
      ok: false,
      code: "INVALID_POSITION",
    });
    // Lượt của người khác.
    expect(await saveGamePosition(ctx(a), a.studentId, createdB.data.run.id, [{ row: 1, col: 2 }], 1)).toEqual({
      ok: false,
      code: "NOT_FOUND",
    });
  });

  it("reset mùa khi đang chơi → SEASON_CLOSED, không ghi đè", async () => {
    const t = world.teacherA.client;
    const name = `GRS ${randomUUID().slice(0, 6)}`;
    const classId = await rpcOk(t.rpc("teacher_create_class", { p_name: name, p_school_year: "2026-2027" }));
    await confirmFixtureCurriculum(t, classId, 2);
    const a = await member(t, classId, 50);
    setLocalGameRunFixtures(true);
    let started;
    try {
      started = await startGameRun(ctx(a), a.studentId, LEVEL);
    } finally {
      setLocalGameRunFixtures(false);
    }
    if (!started.ok) throw new Error("không tạo được lượt");
    const season = (await admin.from("seasons").select("id").eq("class_id", classId).eq("status", "active").single())
      .data!.id;
    const reset = await t.rpc("teacher_reset_season", {
      p_class_id: classId,
      p_request_id: randomUUID(),
      p_expected_season_id: season,
      p_confirmation: name,
    });
    expect(reset.error).toBeNull();
    expect(await saveGamePosition(ctx(a), a.studentId, started.data.run.id, [{ row: 1, col: 2 }], 1)).toEqual({
      ok: false,
      code: "SEASON_CLOSED",
    });
  });
});
