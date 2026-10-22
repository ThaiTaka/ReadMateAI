import { createHash, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { setLocalGameRunFixtures } from "../../scripts/lib/test-fixtures";
import { player, type Mem } from "./board-helpers";
import { admin, buildWorld, rpcOk, type Db, type World } from "./helpers";
import { confirmFixtureCurriculum, errorMessage, fixtures, linkedStudent } from "./scoring-helpers";

/**
 * R07.5a — kiểm thử tích hợp lượt chơi Mê cung kho báu trên Supabase LOCAL (JWT thật, hàm CSDL thật, điểm thật qua
 * gateway ghi điểm). Chỉ lượt KHÔNG tính điểm được tạo, và chỉ khi cờ fixture LOCAL bật (R08 chưa có chạm trán/câu hỏi).
 * Bản đồ màn 1:  hàng 1 = "#S......#" (xuất phát (1,1)), hàng 2 chỉ thông ở cột 7, (2,1) là tường.
 */

const LEVEL = "treasure-maze-01";
type Pos = { row: number; col: number };
type RunDto = {
  id: string;
  level_version: string;
  scored: boolean;
  status: string;
  position: Pos;
  state_version: number;
};

let world: World;

const start = (mem: Mem, level = LEVEL, game = "treasure_maze") =>
  admin.rpc("gateway_start_game_run", {
    p_auth_user_id: mem.device.id,
    p_student_id: mem.studentId,
    p_game_key: game,
    p_level_key: level,
  });
const save = (mem: Mem, runId: string, path: Pos[], version: number) =>
  admin.rpc("gateway_save_game_position", {
    p_auth_user_id: mem.device.id,
    p_student_id: mem.studentId,
    p_run_id: runId,
    p_path: path,
    p_state_version: version,
  });
const east = (from: number, to: number): Pos[] =>
  Array.from({ length: to - from }, (_, i) => ({ row: 1, col: from + i + 1 }));
const runOf = (result: { data: unknown }) => (result.data as { outcome: string; run: RunDto }).run;
const saved = (result: { data: unknown }) => result.data as { outcome: string; state_version: number; position: Pos };

async function newClass(teacher: Db) {
  const name = `Lớp GR ${randomUUID().slice(0, 6)}`;
  const id = await rpcOk(teacher.rpc("teacher_create_class", { p_name: name, p_school_year: "2026-2027" }));
  await confirmFixtureCurriculum(teacher, id, 2);
  return { id, name };
}

async function member(teacher: Db, classId: string, points: number): Promise<Mem> {
  const { studentId, device } = await linkedStudent(teacher, classId);
  const mem: Mem = { studentId, device, alias: "" };
  if (points > 0) await player(mem).correct(points / 10);
  return mem;
}

const runRow = async (id: string) => (await admin.from("game_runs").select("*").eq("id", id).single()).data!;
const activeSeason = async (classId: string) =>
  (await admin.from("seasons").select("id").eq("class_id", classId).eq("status", "active").single()).data!.id;

beforeAll(async () => {
  await fixtures();
  setLocalGameRunFixtures(false);
  world = await buildWorld();
}, 120_000);

afterAll(() => {
  setLocalGameRunFixtures(false);
});

describe("R07.5a — bắt đầu/tiếp tục, ngưỡng điểm, chính sách nội dung", () => {
  let cls: { id: string; name: string };
  let rich: Mem; // 50 điểm
  let poor: Mem; // 40 điểm

  beforeAll(async () => {
    cls = await newClass(world.teacherA.client);
    rich = await member(world.teacherA.client, cls.id, 50);
    poor = await member(world.teacherA.client, cls.id, 40);
  }, 120_000);

  it("đúng 50 điểm hiện tại đủ ngưỡng; chưa đủ nội dung → INSUFFICIENT_CONTENT, không tạo lượt, không trừ điểm", async () => {
    const result = await start(rich);
    expect(errorMessage(result)).toBe("INSUFFICIENT_CONTENT");
    const rows = await admin.from("game_runs").select("id").eq("student_id", rich.studentId);
    expect(rows.data).toHaveLength(0);
    const score = await admin.from("season_scores").select("balance").eq("student_id", rich.studentId).single();
    expect(score.data!.balance).toBe(50);
  });

  it("dưới 50 điểm (40) bị từ chối với INSUFFICIENT_POINTS", async () => {
    expect(errorMessage(await start(poor))).toBe("INSUFFICIENT_POINTS");
  });

  it("chỉ chấp nhận treasure_maze và 3 màn đã định nghĩa", async () => {
    expect(errorMessage(await start(rich, "treasure-maze-04"))).toBe("INVALID_INPUT");
    expect(errorMessage(await start(rich, LEVEL, "wonder_forest"))).toBe("INVALID_INPUT");
    expect(errorMessage(await start(rich, "x'; drop table game_runs;--"))).toBe("INVALID_INPUT");
  });

  it("với cờ fixture LOCAL: tạo lượt KHÔNG tính điểm, tiếp tục trả lại chính lượt đó; version màn khớp tệp JSON", async () => {
    setLocalGameRunFixtures(true);
    try {
      const first = await start(rich);
      expect(first.error).toBeNull();
      const run = runOf(first);
      expect((first.data as { outcome: string }).outcome).toBe("created");
      expect(run.scored).toBe(false);
      expect(run.status).toBe("in_progress");
      expect(run.position).toEqual({ row: 1, col: 1 });
      expect(run.state_version).toBe(1);
      const file = JSON.parse(readFileSync(`content/games/treasure-maze/levels/level-01.json`, "utf8")) as {
        rows: string[];
      };
      expect(run.level_version).toBe(createHash("sha256").update(file.rows.join("\n"), "utf8").digest("hex"));

      const again = await start(rich);
      expect((again.data as { outcome: string }).outcome).toBe("resumed");
      expect(runOf(again).id).toBe(run.id);
      const parallel = await Promise.all([start(rich), start(rich), start(rich)]);
      for (const r of parallel) expect(runOf(r).id).toBe(run.id);
      const all = await admin.from("game_runs").select("id, scored").eq("student_id", rich.studentId);
      expect(all.data).toHaveLength(1);
      expect(all.data!.every((r) => r.scored === false)).toBe(true);
      // Điểm không đổi khi vào.
      const score = await admin
        .from("season_scores")
        .select("balance, earned_total")
        .eq("student_id", rich.studentId)
        .single();
      expect(score.data).toEqual({ balance: 50, earned_total: 50 });
      // Dưới ngưỡng vẫn bị từ chối kể cả khi cờ fixture bật.
      expect(errorMessage(await start(poor))).toBe("INSUFFICIENT_POINTS");
    } finally {
      setLocalGameRunFixtures(false);
    }
  });

  it("cờ fixture tắt: không có lượt tính điểm nào được tạo", async () => {
    const scored = await admin.from("game_runs").select("id").eq("class_id", cls.id).eq("scored", true);
    expect(scored.data).toHaveLength(0);
  });

  it("không có đồng ý learning_data → CONSENT_REQUIRED", async () => {
    const { studentId, device } = await linkedStudent(world.teacherA.client, cls.id, { consent: false });
    const mem: Mem = { studentId, device, alias: "" };
    expect(errorMessage(await start(mem))).toBe("CONSENT_REQUIRED");
  });

  it("thiết bị bị thu hồi / chưa liên kết / của học sinh khác → FORBIDDEN", async () => {
    const revoked = { studentId: world.studentsA[1]!, device: world.revokedDevice, alias: "" };
    expect(errorMessage(await start(revoked))).toBe("FORBIDDEN");
    const unlinked = { studentId: rich.studentId, device: world.unlinkedDevice, alias: "" };
    expect(errorMessage(await start(unlinked))).toBe("FORBIDDEN");
    const crossed = { studentId: rich.studentId, device: poor.device, alias: "" };
    expect(errorMessage(await start(crossed))).toBe("FORBIDDEN");
  });
});

describe("R07.5a — lưu vị trí, đồng thời, RLS", () => {
  let cls: { id: string; name: string };
  let a: Mem;
  let b: Mem;
  let run: RunDto;

  beforeAll(async () => {
    cls = await newClass(world.teacherA.client);
    a = await member(world.teacherA.client, cls.id, 50);
    b = await member(world.teacherA.client, cls.id, 50);
    setLocalGameRunFixtures(true);
    try {
      run = runOf(await start(a));
    } finally {
      setLocalGameRunFixtures(false);
    }
  }, 120_000);

  it("lưu chuỗi bước hợp lệ → vị trí mới, state_version tăng; điểm và dữ liệu khác không đổi", async () => {
    const before = await admin.from("season_scores").select("balance").eq("student_id", a.studentId).single();
    const res = await save(a, run.id, east(1, 4), 1);
    expect(res.error).toBeNull();
    expect(saved(res)).toMatchObject({ outcome: "saved", state_version: 2, position: { row: 1, col: 4 } });
    const row = await runRow(run.id);
    expect(row.position).toEqual({ row: 1, col: 4 });
    expect(row.state_version).toBe(2);
    expect(row.treasure_opened_at).toBeNull();
    const after = await admin.from("season_scores").select("balance").eq("student_id", a.studentId).single();
    expect(after.data!.balance).toBe(before.data!.balance);
  });

  it("gửi lại đúng yêu cầu (phiên bản cũ, đích = vị trí hiện tại) → replayed, không ghi; chuỗi rỗng → unchanged", async () => {
    const replay = await save(a, run.id, east(1, 4), 1);
    expect(saved(replay)).toMatchObject({ outcome: "replayed", state_version: 2, position: { row: 1, col: 4 } });
    expect((await runRow(run.id)).state_version).toBe(2);
    const noop = await save(a, run.id, [], 2);
    expect(saved(noop)).toMatchObject({ outcome: "unchanged", state_version: 2 });
    const sameCell = await save(
      a,
      run.id,
      [
        { row: 1, col: 5 },
        { row: 1, col: 4 },
      ],
      2,
    );
    expect(saved(sameCell)).toMatchObject({ outcome: "unchanged", state_version: 2, position: { row: 1, col: 4 } });
  });

  it("hai thiết bị ghi cùng version: một thắng, thiết bị còn lại nhận STATE_CONFLICT và không ghi đè", async () => {
    const [x, y] = await Promise.all([
      save(a, run.id, [{ row: 1, col: 5 }], 2),
      save(a, run.id, [{ row: 1, col: 3 }], 2),
    ]);
    const outcomes = [errorMessage(x), errorMessage(y)].sort();
    expect(outcomes).toEqual(["STATE_CONFLICT", null].sort());
    const row = await runRow(run.id);
    expect(row.state_version).toBe(3);
    const winner = errorMessage(x) === null ? { row: 1, col: 5 } : { row: 1, col: 3 };
    expect(row.position).toEqual(winner);
  });

  it("phiên bản cũ với đích khác hoặc phiên bản tương lai → STATE_CONFLICT", async () => {
    expect(errorMessage(await save(a, run.id, [{ row: 1, col: 6 }], 1))).toBe("STATE_CONFLICT");
    expect(errorMessage(await save(a, run.id, [{ row: 1, col: 6 }], 99))).toBe("STATE_CONFLICT");
  });

  it("tường, ngoài bản đồ, dịch chuyển tức thời, đi chéo, đầu vào sai hình dạng → bị từ chối, vị trí giữ nguyên", async () => {
    const row0 = await runRow(run.id);
    const v = row0.state_version;
    const here = row0.position as Pos;
    const bad: Array<[string, unknown]> = [
      ["tường", [{ row: here.row + 1, col: 1 }]],
      ["ngoài bản đồ", [{ row: 99, col: 1 }]],
      ["âm", [{ row: -1, col: 1 }]],
      ["tức thời", [{ row: 1, col: 7 }]],
      ["đi chéo", [{ row: here.row + 1, col: here.col + 1 }]],
      [
        "xuyên tường (bước thứ hai là tường)",
        [
          { row: 1, col: here.col + 1 },
          { row: 2, col: here.col + 1 },
        ],
      ],
      ["số thực", [{ row: 1.5, col: 1 }]],
      ["chuỗi", [{ row: "1", col: "2" }]],
      ["thiếu khóa", [{ row: 1 }]],
    ];
    for (const [label, path] of bad) {
      const res = await admin.rpc("gateway_save_game_position", {
        p_auth_user_id: a.device.id,
        p_student_id: a.studentId,
        p_run_id: run.id,
        p_path: path as never,
        p_state_version: v,
      });
      expect(errorMessage(res), label).toBe("INVALID_POSITION");
    }
    const tooLong = Array.from({ length: 65 }, (_, i) => ({ row: 1, col: i % 2 === 0 ? here.col + 1 : here.col }));
    expect(errorMessage(await save(a, run.id, tooLong, v))).toBe("INVALID_INPUT");
    const row1 = await runRow(run.id);
    expect(row1.position).toEqual(row0.position);
    expect(row1.state_version).toBe(v);
  });

  it("học sinh khác không lưu/đọc được lượt của bạn; không tự ghi trực tiếp qua RLS", async () => {
    const v = (await runRow(run.id)).state_version;
    expect(errorMessage(await save(b, run.id, [], v))).toBe("NOT_FOUND");
    const crossed = { studentId: a.studentId, device: b.device, alias: "" };
    expect(errorMessage(await save(crossed, run.id, [], v))).toBe("FORBIDDEN");

    const own = await a.device.client.from("game_runs").select("id, position");
    expect(own.data).toHaveLength(1);
    expect((await b.device.client.from("game_runs").select("id")).data).toHaveLength(0);
    const insert = await a.device.client.from("game_runs").insert({
      class_id: cls.id,
      student_id: a.studentId,
      season_id: await activeSeason(cls.id),
      game_key: "treasure_maze",
      level_key: LEVEL,
      level_version: run.level_version,
      position: { row: 1, col: 1 },
    });
    expect(insert.error).not.toBeNull();
    const update = await a.device.client
      .from("game_runs")
      .update({ position: { row: 7, col: 1 } })
      .eq("id", run.id)
      .select();
    expect(update.data ?? []).toHaveLength(0);
    const del = await a.device.client.from("game_runs").delete().eq("id", run.id).select();
    expect(del.data ?? []).toHaveLength(0);
    expect((await runRow(run.id)).position).toEqual(own.data![0]!.position);
  });

  it("thu hồi thiết bị → không lưu được nữa", async () => {
    const m = await member(world.teacherA.client, cls.id, 50);
    setLocalGameRunFixtures(true);
    let r: RunDto;
    try {
      r = runOf(await start(m));
    } finally {
      setLocalGameRunFixtures(false);
    }
    const dev = await admin.from("student_devices").select("id").eq("student_id", m.studentId).single();
    await rpcOk(world.teacherA.client.rpc("teacher_revoke_device", { p_device_id: dev.data!.id }));
    expect(errorMessage(await save(m, r.id, east(1, 2), 1))).toBe("FORBIDDEN");
  });
});

describe("R07.5a — reset mùa đóng lượt chơi đang dở", () => {
  it("reset: lượt in_progress → void_season_reset, giữ lịch sử, lớp khác nguyên vẹn; lưu sau reset → SEASON_CLOSED; reset lặp idempotent", async () => {
    const t = world.teacherA.client;
    const cls = await newClass(t);
    const other = await newClass(t);
    const a = await member(t, cls.id, 50);
    const x = await member(t, other.id, 50);
    setLocalGameRunFixtures(true);
    let runA: RunDto;
    let runX: RunDto;
    try {
      runA = runOf(await start(a));
      runX = runOf(await start(x));
    } finally {
      setLocalGameRunFixtures(false);
    }
    expect(errorMessage(await save(a, runA.id, east(1, 3), 1))).toBeNull();
    const season1 = await activeSeason(cls.id);
    const request = randomUUID();
    const args = { p_class_id: cls.id, p_request_id: request, p_expected_season_id: season1, p_confirmation: cls.name };
    const res = await t.rpc("teacher_reset_season", args);
    expect(res.error).toBeNull();

    const voided = await runRow(runA.id);
    expect(voided.status).toBe("void_season_reset");
    expect(voided.ended_at).not.toBeNull();
    expect(voided.season_id).toBe(season1);
    expect(voided.position).toEqual({ row: 1, col: 3 });
    expect((await runRow(runX.id)).status).toBe("in_progress");

    expect(errorMessage(await save(a, runA.id, [{ row: 1, col: 4 }], 2))).toBe("SEASON_CLOSED");
    // Mùa mới bắt đầu từ 0 điểm → chưa đủ ngưỡng; trạng thái mùa cũ không dùng lại.
    expect(errorMessage(await start(a))).toBe("INSUFFICIENT_POINTS");

    const replay = await t.rpc("teacher_reset_season", args);
    expect(replay.error).toBeNull();
    expect((replay.data as { replayed: boolean }).replayed).toBe(true);
    const log = await admin.from("season_resets").select("voided_game_runs").eq("request_id", request).single();
    expect(log.data!.voided_game_runs).toBe(1);
    expect((await runRow(runA.id)).status).toBe("void_season_reset");
  });

  it("reset và lưu vị trí chạy đồng thời: không deadlock, kết quả luôn nhất quán", async () => {
    const t = world.teacherA.client;
    for (let round = 0; round < 3; round += 1) {
      const cls = await newClass(t);
      const a = await member(t, cls.id, 50);
      setLocalGameRunFixtures(true);
      let r: RunDto;
      try {
        r = runOf(await start(a));
      } finally {
        setLocalGameRunFixtures(false);
      }
      const season = await activeSeason(cls.id);
      const [resetRes, saveRes] = await Promise.all([
        t.rpc("teacher_reset_season", {
          p_class_id: cls.id,
          p_request_id: randomUUID(),
          p_expected_season_id: season,
          p_confirmation: cls.name,
        }),
        save(a, r.id, east(1, 4), 1),
      ]);
      expect(resetRes.error).toBeNull();
      const row = await runRow(r.id);
      expect(row.status).toBe("void_season_reset");
      const saveError = errorMessage(saveRes);
      if (saveError === null) {
        // Lưu vào trước: reset thấy vị trí đó.
        expect(row.position).toEqual({ row: 1, col: 4 });
        expect(row.state_version).toBe(2);
      } else {
        expect(saveError).toBe("SEASON_CLOSED");
        expect(row.position).toEqual({ row: 1, col: 1 });
        expect(row.state_version).toBe(1);
      }
      const inProgress = await admin.from("game_runs").select("id").eq("class_id", cls.id).eq("status", "in_progress");
      expect(inProgress.data).toHaveLength(0);
    }
  }, 120_000);
});
