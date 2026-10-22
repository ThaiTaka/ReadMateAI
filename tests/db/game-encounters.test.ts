import { randomUUID } from "node:crypto";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { TablesInsert, TablesUpdate } from "../../src/lib/supabase/database.types";
import { setLocalGameRunFixtures } from "../../scripts/lib/test-fixtures";
import { player, type Mem } from "./board-helpers";
import { admin, buildWorld, rpcOk, type Db, type World } from "./helpers";
import { confirmFixtureCurriculum, errorMessage, fixtures, linkedStudent } from "./scoring-helpers";

/**
 * R08.1 — nền tảng 7 chạm trán × 3 câu trên Supabase LOCAL (JWT thật, ràng buộc CSDL thật). Chưa có phân bổ thật (R08.2):
 * chạm trán/câu ở đây do service_role chèn trực tiếp để chứng minh trigger/ràng buộc chặn cả service_role.
 */

const LEVEL = "treasure-maze-01";
type Pos = { row: number; col: number };
type RunDto = { id: string; position: Pos; state_version: number };
type Trig = { id: string; row: number; col: number };

let world: World;

const start = (mem: Mem, level = LEVEL) =>
  admin.rpc("gateway_start_game_run", {
    p_auth_user_id: mem.device.id,
    p_student_id: mem.studentId,
    p_game_key: "treasure_maze",
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
const east = (from: number, to: number, row = 1): Pos[] =>
  Array.from({ length: to - from }, (_, i) => ({ row, col: from + i + 1 }));
const runOf = (result: { data: unknown }) => (result.data as { run: RunDto }).run;

async function newClass(teacher: Db) {
  const name = `Lớp EN ${randomUUID().slice(0, 6)}`;
  const id = await rpcOk(teacher.rpc("teacher_create_class", { p_name: name, p_school_year: "2026-2027" }));
  await confirmFixtureCurriculum(teacher, id, 2);
  return { id, name };
}

async function member(teacher: Db, classId: string, points = 50): Promise<Mem> {
  const { studentId, device } = await linkedStudent(teacher, classId);
  const mem: Mem = { studentId, device, alias: "" };
  if (points > 0) await player(mem).correct(points / 10);
  return mem;
}

const activeSeason = async (classId: string) =>
  (await admin.from("seasons").select("id").eq("class_id", classId).eq("status", "active").single()).data!.id;

/** Lượt KHÔNG tính điểm (cờ fixture LOCAL bật trong chốc lát). */
async function fixtureRun(mem: Mem, level = LEVEL): Promise<RunDto> {
  setLocalGameRunFixtures(true);
  try {
    const result = await start(mem, level);
    expect(result.error).toBeNull();
    return runOf(result);
  } finally {
    setLocalGameRunFixtures(false);
  }
}

const levelFile = (n: string) =>
  JSON.parse(readFileSync(`content/games/treasure-maze/levels/level-${n}.json`, "utf8")) as {
    id: string;
    triggers: Trig[];
  };
const TRIGGER_KEYS = levelFile("01").triggers.map((t) => t.id);

async function addEncounter(
  mem: Mem,
  classId: string,
  runId: string,
  no: number,
  extra: Partial<TablesInsert<"game_encounters">> = {},
) {
  const seasonId = await activeSeason(classId);
  return admin.from("game_encounters").insert({
    run_id: runId,
    student_id: mem.studentId,
    class_id: classId,
    season_id: seasonId,
    encounter_no: no,
    trigger_key: TRIGGER_KEYS[no - 1]!,
    monster_key: `monster-${no}`,
    ...extra,
  });
}

async function addSeven(mem: Mem, classId: string, runId: string) {
  for (let no = 1; no <= 7; no++) expect((await addEncounter(mem, classId, runId, no)).error).toBeNull();
}

const encRows = async (runId: string) =>
  (await admin.from("game_encounters").select("*").eq("run_id", runId).order("encounter_no")).data!;

async function setEncounter(runId: string, no: number, patch: TablesUpdate<"game_encounters">) {
  return admin.from("game_encounters").update(patch).eq("run_id", runId).eq("encounter_no", no);
}
const activate = (runId: string, no: number) =>
  setEncounter(runId, no, {
    status: "active",
    activated_at: new Date().toISOString(),
    return_position: { row: 1, col: 4 },
  });

beforeAll(async () => {
  await fixtures();
  setLocalGameRunFixtures(false);
  world = await buildWorld();
}, 120_000);

afterAll(() => {
  setLocalGameRunFixtures(false);
});

describe("R08.1 — điểm kích hoạt trong CSDL khớp tệp JSON", () => {
  it("21 điểm kích hoạt (3 màn × 7) trùng id và tọa độ với content/games/treasure-maze", () => {
    const out = execSync(
      'npx supabase db query --local -o json "select level_key, trigger_key, row_no, col_no from private.game_level_triggers t join private.game_levels l using (game_key, level_key, level_version) where l.is_current order by 1, 2"',
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
    );
    // CLI có thể in thêm dòng khác trước/sau JSON: chỉ lấy mảng "rows".
    const match = /"rows":\s*(\[[\s\S]*?\])/u.exec(out);
    expect(match).not.toBeNull();
    const rows = JSON.parse(match![1]!) as { level_key: string; trigger_key: string; row_no: number; col_no: number }[];
    const expected = ["01", "02", "03"].flatMap((n) => {
      const level = levelFile(n);
      return level.triggers.map((t) => ({ level_key: level.id, trigger_key: t.id, row_no: t.row, col_no: t.col }));
    });
    const sort = <T extends { trigger_key: string }>(list: T[]) =>
      [...list].sort((a, b) => a.trigger_key.localeCompare(b.trigger_key));
    expect(sort(rows)).toEqual(sort(expected));
    expect(rows).toHaveLength(21);
  });
});

describe("R08.1 — game_encounters: giới hạn 7 và quy tắc ghi (kể cả service_role)", () => {
  let cls: { id: string };
  let mem: Mem;
  let run: RunDto;

  beforeAll(async () => {
    cls = await newClass(world.teacherA.client);
    mem = await member(world.teacherA.client, cls.id);
    run = await fixtureRun(mem);
  }, 120_000);

  it("tạo 7 chạm trán hợp lệ; chạm trán thứ tám bị CSDL từ chối", async () => {
    await addSeven(mem, cls.id, run.id);
    const rows = await encRows(run.id);
    expect(rows).toHaveLength(7);
    expect(rows.every((r) => r.status === "pending" && r.hp_remaining === 3)).toBe(true);

    const eighth = await addEncounter(mem, cls.id, run.id, 8);
    expect(eighth.error).not.toBeNull();
    const reuse = await admin.from("game_encounters").insert({
      run_id: run.id,
      student_id: mem.studentId,
      class_id: cls.id,
      season_id: await activeSeason(cls.id),
      encounter_no: 7,
      trigger_key: "tm01-t9",
      monster_key: "monster-9",
    });
    expect(reuse.error).not.toBeNull();
    expect(await encRows(run.id)).toHaveLength(7);
  });

  it("trigger đã phân bổ và quái vật không đổi được; chuyển trạng thái chỉ theo đường hợp lệ", async () => {
    expect((await setEncounter(run.id, 1, { trigger_key: "tm01-t2" })).error).not.toBeNull();
    expect((await setEncounter(run.id, 1, { monster_key: "monster-x" })).error).not.toBeNull();
    expect((await setEncounter(run.id, 1, { status: "defeated", hp_remaining: 0 })).error).not.toBeNull();
    expect((await activate(run.id, 1)).error).toBeNull();
    // Chỉ một chạm trán đang diễn ra mỗi lượt.
    expect((await activate(run.id, 2)).error).not.toBeNull();
    // HP giảm từng bước; defeated chỉ khi HP = 0.
    expect((await setEncounter(run.id, 1, { hp_remaining: 1 })).error).not.toBeNull();
    for (const hp of [2, 1, 0]) expect((await setEncounter(run.id, 1, { hp_remaining: hp })).error).toBeNull();
    expect(
      (await setEncounter(run.id, 1, { status: "defeated", resolved_at: new Date().toISOString() })).error,
    ).toBeNull();
    // Đã kết thúc: không mở lại, không đổi.
    expect((await setEncounter(run.id, 1, { status: "active" })).error).not.toBeNull();
    expect(
      (await setEncounter(run.id, 1, { status: "void", resolved_at: new Date().toISOString() })).error,
    ).not.toBeNull();
    expect(
      (await admin.from("game_encounters").delete().eq("run_id", run.id).eq("encounter_no", 1)).error,
    ).not.toBeNull();
    // Chưa đánh bại: HP > 0 khi kết thúc.
    expect((await activate(run.id, 2)).error).toBeNull();
    expect((await setEncounter(run.id, 2, { hp_remaining: 2 })).error).toBeNull();
    expect(
      (await setEncounter(run.id, 2, { status: "undefeated", resolved_at: new Date().toISOString() })).error,
    ).toBeNull();
  });

  it("sai học sinh/lớp/mùa so với lượt chơi bị từ chối", async () => {
    const other = await newClass(world.teacherA.client);
    const stranger = await member(world.teacherA.client, other.id);
    const run2 = await fixtureRun(stranger);
    const season = await activeSeason(other.id);
    const base = { run_id: run2.id, encounter_no: 1, trigger_key: "tm01-t1", monster_key: "monster-1" };
    const attempts = [
      { ...base, student_id: mem.studentId, class_id: other.id, season_id: season },
      { ...base, student_id: stranger.studentId, class_id: cls.id, season_id: season },
      { ...base, student_id: stranger.studentId, class_id: other.id, season_id: await activeSeason(cls.id) },
    ];
    for (const row of attempts) expect((await admin.from("game_encounters").insert(row)).error).not.toBeNull();
    expect(await encRows(run2.id)).toHaveLength(0);
  });

  it("nhiều thao tác đồng thời không tạo chạm trán thừa", async () => {
    const c = await newClass(world.teacherA.client);
    const m = await member(world.teacherA.client, c.id);
    const r = await fixtureRun(m);
    const attempts = [1, 2, 3, 4, 5, 6, 7, 7, 6, 5].map((no) => addEncounter(m, c.id, r.id, no));
    const results = await Promise.all(attempts);
    expect(results.filter((x) => !x.error)).toHaveLength(7);
    expect(await encRows(r.id)).toHaveLength(7);
    const more = await Promise.all([addEncounter(m, c.id, r.id, 8), addEncounter(m, c.id, r.id, 1)]);
    expect(more.every((x) => x.error)).toBe(true);
    expect(await encRows(r.id)).toHaveLength(7);
  }, 60_000);

  it("lượt không còn hoạt động không nhận chạm trán mới", async () => {
    const c = await newClass(world.teacherA.client);
    const m = await member(world.teacherA.client, c.id);
    const r = await fixtureRun(m);
    await admin.from("game_runs").update({ status: "abandoned", ended_at: new Date().toISOString() }).eq("id", r.id);
    expect((await addEncounter(m, c.id, r.id, 1)).error).not.toBeNull();
  });
});

describe("R08.1 — RLS và quyền ghi của client", () => {
  let cls: { id: string };
  let mem: Mem;
  let mate: Mem;
  let run: RunDto;
  let otherClass: { id: string };
  let outsider: Mem;

  beforeAll(async () => {
    cls = await newClass(world.teacherA.client);
    mem = await member(world.teacherA.client, cls.id);
    mate = await member(world.teacherA.client, cls.id);
    run = await fixtureRun(mem);
    await addSeven(mem, cls.id, run.id);
    await activate(run.id, 1);
    otherClass = await newClass(world.teacherB.client);
    outsider = await member(world.teacherB.client, otherClass.id);
  }, 120_000);

  it("học sinh chỉ thấy chạm trán đã kích hoạt của chính mình; dòng pending ẩn", async () => {
    const mine = await mem.device.client.from("game_encounters").select("encounter_no, status, trigger_key");
    expect(mine.error).toBeNull();
    expect(mine.data).toEqual([{ encounter_no: 1, status: "active", trigger_key: TRIGGER_KEYS[0] }]);
    expect((await mate.device.client.from("game_encounters").select("id")).data).toEqual([]);
    expect((await outsider.device.client.from("game_encounters").select("id")).data).toEqual([]);
  });

  it("giáo viên lớp thấy đủ 7; giáo viên lớp khác không thấy gì", async () => {
    const own = await world.teacherA.client.from("game_encounters").select("id").eq("run_id", run.id);
    expect(own.data).toHaveLength(7);
    const foreign = await world.teacherB.client.from("game_encounters").select("id").eq("run_id", run.id);
    expect(foreign.data).toEqual([]);
  });

  it("client (học sinh và giáo viên) không ghi trực tiếp; anon không đọc", async () => {
    const season = await activeSeason(cls.id);
    const row = {
      run_id: run.id,
      student_id: mem.studentId,
      class_id: cls.id,
      season_id: season,
      encounter_no: 1,
      trigger_key: "tm01-t1",
      monster_key: "monster-1",
    };
    for (const client of [mem.device.client, world.teacherA.client]) {
      expect((await client.from("game_encounters").insert(row)).error).not.toBeNull();
      expect(
        (await client.from("game_encounters").update({ hp_remaining: 0 }).eq("run_id", run.id)).error,
      ).not.toBeNull();
      expect((await client.from("game_encounters").delete().eq("run_id", run.id)).error).not.toBeNull();
      expect(
        (await client.from("question_instances").update({ status: "void" }).eq("run_id", run.id)).error,
      ).not.toBeNull();
    }
    const rows = await encRows(run.id);
    expect(rows).toHaveLength(7);
    expect(rows[0]!.hp_remaining).toBe(3);
  });

  it("thiết bị bị thu hồi không còn đọc được chạm trán", async () => {
    const { studentId, device } = await linkedStudent(world.teacherA.client, cls.id);
    const m: Mem = { studentId, device, alias: "" };
    await player(m).correct(5);
    const r = await fixtureRun(m);
    await addSeven(m, cls.id, r.id);
    await activate(r.id, 1);
    expect(((await device.client.from("game_encounters").select("id")).data ?? []).length).toBe(1);
    const revoked = await admin
      .from("student_devices")
      .update({ revoked_at: new Date().toISOString(), revoke_reason: "teacher" })
      .eq("auth_user_id", device.id);
    expect(revoked.error).toBeNull();
    expect((await device.client.from("game_encounters").select("id")).data).toEqual([]);
  });
});

describe("R08.1 — question_instances cho ngữ cảnh game_encounter", () => {
  let cls: { id: string };
  let mem: Mem;
  let run: RunDto;
  let items: {
    id: string;
    exercise_version_id: string;
    content_fingerprint: string;
    type_code: string;
    variant: string;
    content: unknown;
  }[];
  let encIds: string[];

  const question = (encounterId: string, position: number, itemIndex: number, extra: Record<string, unknown> = {}) => {
    const item = items[itemIndex]!;
    return admin.from("question_instances").insert({
      student_id: mem.studentId,
      class_id: cls.id,
      season_id: seasonId,
      context_kind: "game_encounter",
      run_id: run.id,
      game_encounter_id: encounterId,
      position,
      exercise_item_id: item.id,
      exercise_version_id: item.exercise_version_id,
      content_fingerprint: item.content_fingerprint,
      view: { type: item.type_code, variant: item.variant, content: item.content } as never,
      support_level: 2,
      max_attempts: 3,
      scorable: false,
      not_scorable_reason: "PRACTICE_ONLY",
      ...extra,
    });
  };
  let seasonId: string;

  beforeAll(async () => {
    cls = await newClass(world.teacherA.client);
    mem = await member(world.teacherA.client, cls.id);
    seasonId = await activeSeason(cls.id);
    run = await fixtureRun(mem);
    await addSeven(mem, cls.id, run.id);
    encIds = (await encRows(run.id)).map((r) => r.id);
    const versions = (await admin.from("exercise_versions").select("id").eq("status", "approved")).data!;
    const found = await admin
      .from("exercise_items")
      .select("id, exercise_version_id, content_fingerprint, type_code, variant, content")
      .in(
        "exercise_version_id",
        versions.map((v) => v.id),
      );
    const seen = new Set<string>();
    items = (found.data ?? []).filter((i) => !seen.has(i.content_fingerprint) && seen.add(i.content_fingerprint));
    expect(items.length).toBeGreaterThanOrEqual(5);
  }, 120_000);

  it("3 câu riêng biệt mỗi chạm trán; vị trí 1–3; không câu thứ tư", async () => {
    for (const p of [1, 2, 3]) expect((await question(encIds[0]!, p, p - 1)).error).toBeNull();
    expect((await question(encIds[0]!, 4, 3)).error).not.toBeNull();
    expect((await question(encIds[0]!, 0, 3)).error).not.toBeNull();
    expect((await question(encIds[0]!, 2, 3)).error).not.toBeNull();
  });

  it("cùng lượt không phát lặp câu/nội dung, kể cả ở chạm trán khác", async () => {
    expect((await question(encIds[1]!, 1, 0)).error).not.toBeNull();
    expect((await question(encIds[1]!, 1, 3)).error).toBeNull();
  });

  it("câu thuộc đúng học sinh/lớp/mùa/lượt của chạm trán; nội dung đã phát bất biến", async () => {
    expect((await question(encIds[2]!, 1, 4, { student_id: randomUUID() })).error).not.toBeNull();
    expect((await question(encIds[2]!, 1, 4, { season_id: randomUUID() })).error).not.toBeNull();
    expect((await question(encIds[2]!, 1, 4, { run_id: randomUUID() })).error).not.toBeNull();
    expect((await question(encIds[2]!, 1, 4, { context_kind: "practice_session" })).error).not.toBeNull();
    const placed = (
      await admin.from("question_instances").select("id").eq("game_encounter_id", encIds[0]!).eq("position", 1)
    ).data![0]!;
    expect((await admin.from("question_instances").update({ position: 3 }).eq("id", placed.id)).error).not.toBeNull();
    expect(
      (await admin.from("question_instances").update({ game_encounter_id: encIds[2]! }).eq("id", placed.id)).error,
    ).not.toBeNull();
    expect((await admin.from("question_instances").update({ run_id: null }).eq("id", placed.id)).error).not.toBeNull();
  });

  it("chạm trán đã kết thúc không nhận thêm câu", async () => {
    await activate(run.id, 5);
    await setEncounter(run.id, 5, { hp_remaining: 2 });
    await setEncounter(run.id, 5, { status: "undefeated", resolved_at: new Date().toISOString() });
    expect((await question(encIds[4]!, 1, 4)).error).not.toBeNull();
  });

  it("bài luyện R04 vẫn hoạt động: buổi luyện có điểm, câu ở ngữ cảnh practice_session", async () => {
    const c = await newClass(world.teacherA.client);
    const m = await member(world.teacherA.client, c.id, 20);
    const score = await admin.from("season_scores").select("balance").eq("student_id", m.studentId).single();
    expect(score.data!.balance).toBe(20);
    const qs = await admin
      .from("question_instances")
      .select("context_kind, run_id, game_encounter_id")
      .eq("student_id", m.studentId);
    expect(qs.data!.length).toBeGreaterThan(0);
    expect(
      qs.data!.every((q) => q.context_kind === "practice_session" && q.run_id === null && q.game_encounter_id === null),
    ).toBe(true);
  });
});

describe("R08.1 — lưu vị trí không bỏ qua chạm trán", () => {
  let cls: { id: string };
  let mem: Mem;
  let run: RunDto;
  let version: number;

  beforeAll(async () => {
    cls = await newClass(world.teacherA.client);
    mem = await member(world.teacherA.client, cls.id);
    run = await fixtureRun(mem);
    version = run.state_version;
  }, 120_000);

  it("lượt fixture chưa có chạm trán: đi xuyên điểm kích hoạt như R07 (không phá fixture)", async () => {
    // Ô (1,4) là trigger tm01-t1; đi từ (1,1) đến (1,5) khi chưa phân bổ chạm trán vẫn được.
    const r = await save(mem, run.id, east(1, 5), version);
    expect(errorMessage(r)).toBeNull();
    version = (r.data as { state_version: number }).state_version;
    const back = await save(
      mem,
      run.id,
      [
        { row: 1, col: 4 },
        { row: 1, col: 3 },
        { row: 1, col: 2 },
        { row: 1, col: 1 },
      ],
      version,
    );
    expect(errorMessage(back)).toBeNull();
    version = (back.data as { state_version: number }).state_version;
  });

  it("sau khi phân bổ: không đi xuyên/rời điểm kích hoạt chưa xử lý, dừng tại đó được", async () => {
    await addSeven(mem, cls.id, run.id);
    expect(errorMessage(await save(mem, run.id, east(1, 5), version))).toBe("ENCOUNTER_PENDING");
    const stop = await save(mem, run.id, east(1, 4), version);
    expect(errorMessage(stop)).toBeNull();
    version = (stop.data as { state_version: number }).state_version;
    // Đứng trên điểm chưa kích hoạt rồi bước đi tiếp = bỏ qua chạm trán.
    expect(errorMessage(await save(mem, run.id, east(4, 5), version))).toBe("ENCOUNTER_PENDING");
    // Chỉ báo còn hoạt động vẫn được.
    expect(errorMessage(await save(mem, run.id, [], version))).toBeNull();
  });

  it("chạm trán đang diễn ra chặn di chuyển; xử lý xong thì đi tiếp", async () => {
    expect((await activate(run.id, 1)).error).toBeNull();
    expect(errorMessage(await save(mem, run.id, east(4, 5), version))).toBe("ENCOUNTER_ACTIVE");
    for (const hp of [2, 1, 0]) await setEncounter(run.id, 1, { hp_remaining: hp });
    await setEncounter(run.id, 1, { status: "defeated", resolved_at: new Date().toISOString() });
    const moved = await save(mem, run.id, east(4, 5), version);
    expect(errorMessage(moved)).toBeNull();
  });

  it("lượt tính điểm thiếu chạm trán không hoạt động được", async () => {
    const c = await newClass(world.teacherA.client);
    const m = await member(world.teacherA.client, c.id);
    const seasonId = await activeSeason(c.id);
    // Lượt scored chèn trực tiếp bằng service_role (không có đường nào của gateway tạo lượt tính điểm ở R08.1).
    const base = (await admin.from("game_runs").select("level_version").eq("level_key", LEVEL).limit(1).single()).data!;
    const inserted = await admin
      .from("game_runs")
      .insert({
        class_id: c.id,
        student_id: m.studentId,
        season_id: seasonId,
        game_key: "treasure_maze",
        level_key: LEVEL,
        level_version: base.level_version,
        scored: true,
        position: { row: 1, col: 1 },
      })
      .select("id, state_version")
      .single();
    expect(inserted.error).toBeNull();
    const r = inserted.data!;
    expect(errorMessage(await save(m, r.id, [], r.state_version))).toBe("ENCOUNTERS_INCOMPLETE");
    expect(errorMessage(await save(m, r.id, east(1, 2), r.state_version))).toBe("ENCOUNTERS_INCOMPLETE");
    for (let no = 1; no <= 6; no++) await addEncounter(m, c.id, r.id, no);
    expect(errorMessage(await save(m, r.id, east(1, 2), r.state_version))).toBe("ENCOUNTERS_INCOMPLETE");
    await addEncounter(m, c.id, r.id, 7);
    expect(errorMessage(await save(m, r.id, east(1, 2), r.state_version))).toBeNull();
  });
});

describe("R08.1 — cờ fixture TẮT không tạo lượt, chạm trán hay câu giả", () => {
  it("INSUFFICIENT_CONTENT: không có game_runs, game_encounters, question_instances game", async () => {
    const c = await newClass(world.teacherA.client);
    const m = await member(world.teacherA.client, c.id);
    expect(errorMessage(await start(m))).toBe("INSUFFICIENT_CONTENT");
    expect((await admin.from("game_runs").select("id").eq("student_id", m.studentId)).data).toEqual([]);
    expect((await admin.from("game_encounters").select("id").eq("student_id", m.studentId)).data).toEqual([]);
    const gameQs = await admin
      .from("question_instances")
      .select("id")
      .eq("student_id", m.studentId)
      .eq("context_kind", "game_encounter");
    expect(gameQs.data).toEqual([]);
  });
});

describe("R08.1 — reset mùa đóng chạm trán đang dở", () => {
  it("pending/active → void, đã kết thúc giữ nguyên, lớp khác nguyên vẹn, không xóa lịch sử, reset lặp idempotent", async () => {
    const t = world.teacherA.client;
    const cls = await newClass(t);
    const other = await newClass(t);
    const a = await member(t, cls.id);
    const x = await member(t, other.id);
    const runA = await fixtureRun(a);
    const runX = await fixtureRun(x);
    await addSeven(a, cls.id, runA.id);
    await addSeven(x, other.id, runX.id);
    // Encounter 1 đánh bại, 2 đang diễn ra, 3–7 chờ.
    await activate(runA.id, 1);
    for (const hp of [2, 1, 0]) await setEncounter(runA.id, 1, { hp_remaining: hp });
    await setEncounter(runA.id, 1, { status: "defeated", resolved_at: new Date().toISOString() });
    await activate(runA.id, 2);

    const season1 = await activeSeason(cls.id);
    const request = randomUUID();
    const args = { p_class_id: cls.id, p_request_id: request, p_expected_season_id: season1, p_confirmation: cls.name };
    expect((await t.rpc("teacher_reset_season", args)).error).toBeNull();

    const rows = await encRows(runA.id);
    expect(rows).toHaveLength(7);
    expect(rows[0]!.status).toBe("defeated");
    expect(rows.slice(1).every((r) => r.status === "void" && r.resolved_at !== null)).toBe(true);
    expect(rows[1]!.hp_remaining).toBe(3);
    expect((await encRows(runX.id)).every((r) => r.status === "pending")).toBe(true);
    const log = await admin
      .from("season_resets")
      .select("voided_encounters, voided_game_runs")
      .eq("request_id", request)
      .single();
    expect(log.data).toEqual({ voided_encounters: 6, voided_game_runs: 1 });

    const replay = await t.rpc("teacher_reset_season", args);
    expect((replay.data as { replayed: boolean }).replayed).toBe(true);
    expect((await encRows(runA.id)).filter((r) => r.status === "void")).toHaveLength(6);
    // Chạm trán của lượt void không mở lại được.
    expect((await activate(runA.id, 3)).error).not.toBeNull();
  });

  it("reset và chèn chạm trán chạy đồng thời: không deadlock, không để lại chạm trán chưa đóng trên lượt đã void", async () => {
    const t = world.teacherA.client;
    const cls = await newClass(t);
    const a = await member(t, cls.id);
    const run = await fixtureRun(a);
    await addEncounter(a, cls.id, run.id, 1);
    const season1 = await activeSeason(cls.id);
    const [reset, insert] = await Promise.all([
      t.rpc("teacher_reset_season", {
        p_class_id: cls.id,
        p_request_id: randomUUID(),
        p_expected_season_id: season1,
        p_confirmation: cls.name,
      }),
      addEncounter(a, cls.id, run.id, 2),
    ]);
    expect(reset.error).toBeNull();
    void insert;
    expect((await admin.from("game_runs").select("status").eq("id", run.id).single()).data!.status).toBe(
      "void_season_reset",
    );
    const open = (await encRows(run.id)).filter((r) => r.status === "pending" || r.status === "active");
    expect(open).toEqual([]);
  }, 60_000);
});
