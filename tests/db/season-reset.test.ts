import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { setLocalHonorsApproval } from "../../scripts/lib/test-fixtures";
import { boardMember, player, type Mem } from "./board-helpers";
import { admin, buildWorld, newTeacher, publicClient, rpcOk, type Db, type World } from "./helpers";
import { confirmFixtureCurriculum, errorMessage, fixtures, submit } from "./scoring-helpers";

/**
 * R06.3 — kiểm thử tích hợp reset mùa trên Supabase LOCAL thật (JWT thật, hàm CSDL thật, điểm thật qua gateway ghi điểm):
 * quyền chỉ chủ nhiệm, xác nhận tên lớp + mùa đã xác nhận, khóa ý định, tranh chấp song song, rollback, hạng cuối 1-2-2-4,
 * mùa mới bắt đầu từ 0, không mất dữ liệu học tập/ảnh chụp vinh danh, không ảnh hưởng lớp khác, và tranh chấp với ghi điểm R04.
 */

let world: World;

type ResetResult = { new_season_id: string; seq_no: number; replayed: boolean };
const reset = (teacher: Db, classId: string, requestId: string, expected: string, confirmation: string) =>
  teacher.rpc("teacher_reset_season", {
    p_class_id: classId,
    p_request_id: requestId,
    p_expected_season_id: expected,
    p_confirmation: confirmation,
  });
const outcome = (result: { data: unknown }) => result.data as ResetResult;

async function newClass(teacher: Db): Promise<{ id: string; name: string }> {
  const name = `Lớp RS ${randomUUID().slice(0, 6)}`;
  const id = await rpcOk(teacher.rpc("teacher_create_class", { p_name: name, p_school_year: "2026-2027" }));
  await confirmFixtureCurriculum(teacher, id, 2);
  return { id, name };
}

async function seasonsOf(classId: string) {
  const { data } = await admin
    .from("seasons")
    .select("id, seq_no, status, ended_at, closed_by")
    .eq("class_id", classId)
    .order("seq_no");
  return data ?? [];
}

const activeOf = async (classId: string) => (await seasonsOf(classId)).find((season) => season.status === "active")!;

async function ledgerOf(classId: string) {
  const { data } = await admin
    .from("point_events")
    .select("id, season_id, student_id, applied_delta")
    .eq("class_id", classId)
    .order("id");
  return data ?? [];
}

async function attemptsCount(classId: string) {
  const { count } = await admin
    .from("item_attempts")
    .select("id", { count: "exact", head: true })
    .eq("class_id", classId);
  return count ?? 0;
}

async function scoresOf(classId: string) {
  const { data } = await admin
    .from("season_scores")
    .select("season_id, student_id, balance, earned_total, final_rank")
    .eq("class_id", classId)
    .order("student_id")
    .order("season_id");
  return data ?? [];
}

async function openWork(studentId: string) {
  const questions = await admin
    .from("question_instances")
    .select("id, status")
    .eq("student_id", studentId)
    .eq("status", "open");
  const sessions = await admin
    .from("practice_sessions")
    .select("id, status")
    .eq("student_id", studentId)
    .eq("status", "in_progress");
  return { questions: questions.data ?? [], sessions: sessions.data ?? [] };
}

const revealTile = (mem: Mem, tile: string) =>
  admin.rpc("gateway_reveal_map_tile", {
    p_auth_user_id: mem.device.id,
    p_student_id: mem.studentId,
    p_map_key: "season-map-1",
    p_tile_key: tile,
    p_tile_count: 8,
    p_neighbors: [],
    p_adjacent_to_start: true,
  });

beforeAll(async () => {
  setLocalHonorsApproval(false);
  await fixtures();
  world = await buildWorld();
}, 120_000);

afterAll(() => {
  setLocalHonorsApproval(false);
});

describe("reset mùa — luồng chính, quyền, xác nhận, bất biến", () => {
  let cls: { id: string; name: string };
  let other: { id: string; name: string };
  let a: Mem;
  let b: Mem;
  let c: Mem;
  let d: Mem;
  let e: Mem;
  let x: Mem;
  let season1: string;
  const requestId = randomUUID();
  let otherBefore: Awaited<ReturnType<typeof scoresOf>>;
  let ledgerBefore: Awaited<ReturnType<typeof ledgerOf>>;
  let attemptsBefore: number;

  beforeAll(async () => {
    const t = world.teacherA.client;
    cls = await newClass(t);
    a = await boardMember(t, cls.id, { alias: "Mai Vàng" });
    b = await boardMember(t, cls.id, { alias: "Nam Bé" });
    c = await boardMember(t, cls.id, { alias: "Lan Hồng" });
    d = await boardMember(t, cls.id, { alias: "Đức Nhỏ" });
    e = await boardMember(t, cls.id, { alias: "Hạt Đậu" });
    await player(a).correct(3);
    await player(b).correct(3);
    await player(c).correct(2);
    await player(d).correct(1); // buổi luyện còn dở: 3 câu đang mở
    // Một thẻ bản đồ đã khám phá trong mùa 1 (30 điểm tích lũy).
    expect((await revealTile(a, "lotus_pond")).error).toBeNull();
    // Lớp khác của cùng giáo viên: phải nguyên vẹn sau reset.
    other = await newClass(t);
    x = await boardMember(t, other.id, { alias: "Bạn Lớp Khác" });
    await player(x).correct(2);
    season1 = (await activeOf(cls.id)).id;
    otherBefore = await scoresOf(other.id);
    ledgerBefore = await ledgerOf(cls.id);
    attemptsBefore = await attemptsCount(cls.id);
  }, 300_000);

  it("chỉ chủ nhiệm: co_teacher, GV lớp khác, thiết bị học sinh, khách và service_role đều bị từ chối; không đổi gì", async () => {
    const co = await newTeacher(world.schoolId, "gv-co");
    await admin.from("class_staff").insert({ class_id: cls.id, staff_id: co.id, role: "co_teacher" });
    await admin.from("class_staff").update({ can_honor: true }).eq("class_id", cls.id).eq("staff_id", co.id);
    const attempts = [
      reset(co.client, cls.id, randomUUID(), season1, cls.name),
      reset(world.teacherB.client, cls.id, randomUUID(), season1, cls.name),
      reset(world.deviceA1.client, cls.id, randomUUID(), season1, cls.name),
      reset(publicClient(), cls.id, randomUUID(), season1, cls.name),
      reset(admin, cls.id, randomUUID(), season1, cls.name),
    ];
    for (const result of await Promise.all(attempts)) {
      expect(result.data).toBeNull();
      expect(result.error).not.toBeNull();
      expect(result.error?.message === "FORBIDDEN" || result.error?.code === "42501").toBe(true);
    }
    expect((await seasonsOf(cls.id)).map((s) => s.status)).toEqual(["active"]);
    const forClass = await admin.from("season_resets").select("request_id").eq("class_id", cls.id);
    expect(forClass.data).toEqual([]);
  });

  it("không gọi trực tiếp hàm nội bộ private.reset_class_season từ client", async () => {
    const t = world.teacherA.client;
    const privateApi = (t as unknown as { schema: (name: string) => Db }).schema("private");
    const result = await (privateApi as unknown as { rpc: (n: string, a: unknown) => Promise<{ error: unknown }> }).rpc(
      "reset_class_season",
      {
        p_class_id: cls.id,
        p_request_id: randomUUID(),
        p_expected_season_id: season1,
        p_confirmation: cls.name,
      },
    );
    expect(result.error).not.toBeNull();
  });

  it("sai tên lớp, sai mùa đã xác nhận, đầu vào thiếu → bị từ chối, không đổi gì", async () => {
    const t = world.teacherA.client;
    expect(errorMessage(await reset(t, cls.id, randomUUID(), season1, "1A9"))).toBe("CONFIRMATION_MISMATCH");
    expect(errorMessage(await reset(t, cls.id, randomUUID(), season1, "  "))).toBe("CONFIRMATION_MISMATCH");
    expect(errorMessage(await reset(t, cls.id, randomUUID(), randomUUID(), cls.name))).toBe("SEASON_MISMATCH");
    expect(
      errorMessage(
        await t.rpc("teacher_reset_season", {
          p_class_id: cls.id,
          p_request_id: randomUUID(),
          p_expected_season_id: season1,
          p_confirmation: null as unknown as string,
        }),
      ),
    ).toBe("INVALID_INPUT");
    expect((await seasonsOf(cls.id)).length).toBe(1);
  });

  it("rollback: lỗi giữa giao dịch (mùa 2 đã tồn tại) → toàn bộ hoàn tác, kể cả hạng cuối và việc đóng câu/buổi dở", async () => {
    const blocker = await admin.from("seasons").insert({
      class_id: cls.id,
      seq_no: 2,
      status: "closed",
      rules_version: "r1",
      started_at: new Date(Date.now() - 86_400_000).toISOString(),
      ended_at: new Date(Date.now() - 3_600_000).toISOString(),
    });
    expect(blocker.error).toBeNull();
    const failed = await reset(world.teacherA.client, cls.id, randomUUID(), season1, cls.name);
    expect(failed.error).not.toBeNull();
    expect((await seasonsOf(cls.id)).map((s) => [s.seq_no, s.status])).toEqual([
      [1, "active"],
      [2, "closed"],
    ]);
    const scores = await scoresOf(cls.id);
    expect(scores.every((row) => row.final_rank === null)).toBe(true);
    const work = await openWork(d.studentId);
    expect(work.questions.length).toBe(3);
    expect(work.sessions.length).toBe(1);
    const { count } = await admin
      .from("season_resets")
      .select("request_id", { count: "exact", head: true })
      .eq("class_id", cls.id);
    expect(count).toBe(0);
    const audit = await admin.from("audit_logs").select("id").eq("class_id", cls.id).eq("action", "season.reset");
    expect(audit.data).toEqual([]);
    await admin.from("seasons").delete().eq("class_id", cls.id).eq("seq_no", 2);
  });

  it("owner reset thành công: mùa cũ đóng, mùa mới seq 2 active, hạng cuối 1-1-3-4, câu/buổi dở bị hủy, điểm mới = 0", async () => {
    const done = await reset(world.teacherA.client, cls.id, requestId, season1, cls.name);
    expect(done.error).toBeNull();
    const result = outcome(done);
    expect(result).toMatchObject({ seq_no: 2, replayed: false });

    const seasons = await seasonsOf(cls.id);
    expect(seasons.map((s) => [s.seq_no, s.status])).toEqual([
      [1, "closed"],
      [2, "active"],
    ]);
    expect(seasons[0]!.ended_at).not.toBeNull();
    expect(seasons[0]!.closed_by).toBe(world.teacherA.id);
    expect(seasons[1]!.id).toBe(result.new_season_id);

    const scores = await scoresOf(cls.id);
    const rankOf = (mem: Mem) => scores.find((row) => row.student_id === mem.studentId && row.season_id === season1);
    // Mai Vàng 30, Nam Bé 30, Lan Hồng 20, Đức Nhỏ 10 → 1, 1, 3, 4 (Hạt Đậu chưa có điểm: không có dòng).
    expect([a, b, c, d].map((mem) => [rankOf(mem)?.balance, rankOf(mem)?.final_rank])).toEqual([
      [30, 1],
      [30, 1],
      [20, 3],
      [10, 4],
    ]);
    expect(rankOf(e)).toBeUndefined();
    expect(scores.filter((row) => row.season_id === result.new_season_id)).toEqual([]);

    const work = await openWork(d.studentId);
    expect(work).toEqual({ questions: [], sessions: [] });
    const voided = await admin
      .from("question_instances")
      .select("status")
      .eq("student_id", d.studentId)
      .eq("season_id", season1);
    expect(voided.data?.filter((row) => row.status === "void").length).toBe(3);

    const log = await admin.from("season_resets").select("*").eq("request_id", requestId).single();
    expect(log.data).toMatchObject({
      class_id: cls.id,
      old_season_id: season1,
      new_season_id: result.new_season_id,
      performed_by: world.teacherA.id,
      scored_students: 4,
      voided_questions: 7, // a:1 + b:1 + c:2 + d:3 câu còn mở
      voided_sessions: 4, // mỗi bạn có một buổi dở
    });
    const audit = await admin
      .from("audit_logs")
      .select("actor_id, target_id, metadata")
      .eq("class_id", cls.id)
      .eq("action", "season.reset");
    expect(audit.data).toHaveLength(1);
    expect(audit.data![0]).toMatchObject({ actor_id: world.teacherA.id, target_id: result.new_season_id });
    expect(JSON.stringify(audit.data![0]!.metadata)).not.toMatch(/Mai|Nam|Lan|Đức|Hạt/u);
  });

  it("gửi lại cùng requestId: trả mùa cũ, không reset lần hai; cùng requestId khác bộ tham số bị chặn", async () => {
    const t = world.teacherA.client;
    const first = (await seasonsOf(cls.id)).find((s) => s.seq_no === 2)!;
    const again = await reset(t, cls.id, requestId, season1, cls.name);
    expect(again.error).toBeNull();
    expect(outcome(again)).toEqual({ new_season_id: first.id, seq_no: 2, replayed: true });
    expect((await seasonsOf(cls.id)).length).toBe(2);
    // Cùng requestId nhưng khác mùa xác nhận → xung đột; GV khác lớp dùng lại requestId → xung đột.
    expect(errorMessage(await reset(t, cls.id, requestId, first.id, cls.name))).toBe("IDEMPOTENCY_CONFLICT");
    expect(errorMessage(await reset(world.teacherB.client, world.classB, requestId, season1, "x"))).toBe(
      "IDEMPOTENCY_CONFLICT",
    );
  });

  it("xác nhận cũ (requestId mới, cùng mùa cũ) không tạo thêm mùa", async () => {
    const stale = await reset(world.teacherA.client, cls.id, randomUUID(), season1, cls.name);
    expect(errorMessage(stale)).toBe("SEASON_MISMATCH");
    expect((await seasonsOf(cls.id)).length).toBe(2);
  });

  it("nộp câu của mùa cũ → SEASON_CLOSED; mùa mới tính điểm lại từ 0; bản đồ khóa lại", async () => {
    const season2 = (await activeOf(cls.id)).id;
    const questions = await admin
      .from("question_instances")
      .select("id")
      .eq("student_id", d.studentId)
      .eq("season_id", season1);
    const old = await submit(d.device, questions.data![0]!.id, "correct");
    expect(errorMessage(old)).toBe("SEASON_CLOSED");

    // Mai Vàng đã có thẻ ở mùa 1; mùa mới chưa có điểm tích lũy → không mở được thẻ nào.
    expect(errorMessage(await revealTile(a, "star_hill"))).toBe("NO_TILE_AVAILABLE");
    const tiles = await admin.from("map_tile_reveals").select("season_id").eq("student_id", a.studentId);
    expect(tiles.data).toEqual([{ season_id: season1 }]);
    const unlocks = await admin
      .from("game_unlocks")
      .select("season_id")
      .eq("class_id", cls.id)
      .eq("season_id", season2);
    expect(unlocks.data).toEqual([]);

    await player(a).correct(1);
    const after = await scoresOf(cls.id);
    const mine = after.filter((row) => row.student_id === a.studentId);
    expect(mine.map((row) => [row.season_id === season1 ? 1 : 2, row.balance, row.earned_total])).toEqual(
      expect.arrayContaining([
        [1, 30, 30],
        [2, 10, 10],
      ]),
    );
  });

  it("dữ liệu học tập và sổ cái không mất; lớp khác không đổi", async () => {
    const ledger = await ledgerOf(cls.id);
    // Sổ cái chỉ có thể dài thêm (điểm mùa mới); mọi dòng cũ còn nguyên.
    for (const row of ledgerBefore) expect(ledger).toContainEqual(row);
    expect(await attemptsCount(cls.id)).toBeGreaterThanOrEqual(attemptsBefore);
    expect(await scoresOf(other.id)).toEqual(otherBefore);
    expect((await seasonsOf(other.id)).map((s) => s.status)).toEqual(["active"]);
    const bands = await admin.from("student_band_assignments").select("student_id").eq("class_id", cls.id);
    expect(bands.data).toHaveLength(5);
  });

  it("season_resets bất biến và GV chỉ đọc được của lớp mình", async () => {
    expect(
      (await admin.from("season_resets").update({ performed_by: world.teacherB.id }).eq("request_id", requestId)).error
        ?.message,
    ).toBe("APPEND_ONLY");
    expect((await admin.from("season_resets").delete().eq("request_id", requestId)).error?.message).toBe("APPEND_ONLY");
    const own = await world.teacherA.client.from("season_resets").select("request_id").eq("class_id", cls.id);
    expect(own.data).toHaveLength(1);
    const foreign = await world.teacherB.client.from("season_resets").select("request_id").eq("class_id", cls.id);
    expect(foreign.data).toEqual([]);
    const direct = await world.teacherA.client.from("season_resets").insert({
      request_id: randomUUID(),
      class_id: cls.id,
      old_season_id: season1,
      new_season_id: season1,
      performed_by: world.teacherA.id,
      scored_students: 0,
      voided_questions: 0,
      voided_sessions: 0,
    });
    expect(direct.error).not.toBeNull();
  });
});

describe("reset mùa — tranh chấp song song", () => {
  it("hai request CÙNG requestId đồng thời: đúng một mùa mới, cả hai nhận cùng kết quả", async () => {
    const cls = await newClass(world.teacherA.client);
    await boardMember(world.teacherA.client, cls.id, { alias: "Bạn Một" });
    const season1 = (await activeOf(cls.id)).id;
    const id = randomUUID();
    const results = await Promise.all([
      reset(world.teacherA.client, cls.id, id, season1, cls.name),
      reset(world.teacherA.client, cls.id, id, season1, cls.name),
    ]);
    expect(results.map((r) => r.error)).toEqual([null, null]);
    const [first, second] = results.map(outcome) as [ResetResult, ResetResult];
    expect(first.new_season_id).toBe(second.new_season_id);
    expect([first.replayed, second.replayed].sort()).toEqual([false, true]);
    const seasons = await seasonsOf(cls.id);
    expect(seasons.map((s) => [s.seq_no, s.status])).toEqual([
      [1, "closed"],
      [2, "active"],
    ]);
  });

  it("hai request KHÁC requestId cùng xác nhận một mùa: một thành công, một SEASON_MISMATCH, không có mùa 3", async () => {
    const cls = await newClass(world.teacherA.client);
    await boardMember(world.teacherA.client, cls.id, { alias: "Bạn Hai" });
    const season1 = (await activeOf(cls.id)).id;
    const results = await Promise.all([
      reset(world.teacherA.client, cls.id, randomUUID(), season1, cls.name),
      reset(world.teacherA.client, cls.id, randomUUID(), season1, cls.name),
    ]);
    expect(results.filter((r) => r.error === null)).toHaveLength(1);
    expect(results.map(errorMessage).filter(Boolean)).toEqual(["SEASON_MISMATCH"]);
    const seasons = await seasonsOf(cls.id);
    expect(seasons.map((s) => s.seq_no)).toEqual([1, 2]);
    expect(seasons.filter((s) => s.status === "active")).toHaveLength(1);
  });

  it("reset đồng thời với ghi điểm R04: không mất điểm, không ghi nhầm mùa (ba vòng)", async () => {
    const teacher = world.teacherA.client;
    const cls = await newClass(teacher);
    const m = await boardMember(teacher, cls.id, { alias: "Bạn Đua" });
    for (let round = 1; round <= 3; round += 1) {
      const active = await activeOf(cls.id);
      await player(m).correct(1); // +10 trong mùa hiện tại, mở buổi luyện mới còn 3 câu
      const open = (await openWork(m.studentId)).questions;
      expect(open.length).toBeGreaterThanOrEqual(1);
      const [attempt, resetResult] = await Promise.all([
        submit(m.device, open[0]!.id, "correct"),
        reset(teacher, cls.id, randomUUID(), active.id, cls.name),
      ]);
      expect(resetResult.error).toBeNull();
      const submitted = attempt.error === null;
      if (!submitted) expect(errorMessage(attempt)).toBe("SEASON_CLOSED");

      // Bất biến: số dư mỗi mùa = tổng điểm áp dụng của sổ cái mùa đó; mọi dòng sổ cái cùng mùa với câu của nó.
      const events = await admin
        .from("point_events")
        .select("season_id, applied_delta, question_instance_id")
        .eq("student_id", m.studentId);
      const scores = await scoresOf(cls.id);
      for (const score of scores) {
        const sum = (events.data ?? [])
          .filter((event) => event.season_id === score.season_id)
          .reduce((total, event) => total + event.applied_delta, 0);
        expect(score.balance).toBe(sum);
      }
      const questions = await admin.from("question_instances").select("id, season_id").eq("student_id", m.studentId);
      const seasonOf = new Map((questions.data ?? []).map((q) => [q.id, q.season_id]));
      for (const event of events.data ?? []) expect(event.season_id).toBe(seasonOf.get(event.question_instance_id));
      // Mùa vừa đóng: nếu lượt nộp thắng thì điểm của nó nằm trong mùa cũ (20), ngược lại 10; mùa mới chưa có điểm.
      const oldScore = scores.find((row) => row.season_id === active.id)!;
      expect(oldScore.balance).toBe(submitted ? 20 : 10);
      expect(oldScore.final_rank).toBe(1);
      const newest = await activeOf(cls.id);
      expect(scores.filter((row) => row.season_id === newest.id)).toEqual([]);
    }
    expect((await seasonsOf(cls.id)).map((s) => s.seq_no)).toEqual([1, 2, 3, 4]);
  }, 300_000);
});

describe("reset mùa — ảnh chụp vinh danh còn nguyên", () => {
  it("ảnh chụp tạo ở mùa cũ vẫn đọc được sau reset (không tạo/đổi ảnh chụp)", async () => {
    setLocalHonorsApproval(true);
    try {
      const t = world.teacherA.client;
      const cls = await newClass(t);
      const m = await boardMember(t, cls.id, { alias: "Sao Vàng" });
      await player(m).correct(2);
      await rpcOk(t.rpc("teacher_set_honors_enabled", { p_class_id: cls.id, p_enabled: true }));
      const snapshotId = await rpcOk(t.rpc("teacher_create_honor_snapshot", { p_class_id: cls.id }));
      const season1 = (await activeOf(cls.id)).id;
      expect((await reset(t, cls.id, randomUUID(), season1, cls.name)).error).toBeNull();
      const snap = await t.rpc("teacher_get_honor_snapshot", { p_snapshot_id: snapshotId });
      expect(snap.error).toBeNull();
      expect(JSON.stringify(snap.data)).toContain("Sao Vàng");
      const headers = await admin.from("honor_snapshots").select("id, season_id").eq("class_id", cls.id);
      expect(headers.data).toEqual([{ id: snapshotId, season_id: season1 }]);
    } finally {
      setLocalHonorsApproval(false);
    }
  }, 120_000);
});
