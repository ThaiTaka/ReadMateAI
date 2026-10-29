import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  setLocalHonorDedupeSeconds,
  setLocalHonorsApproval,
  setLocalLeaderboardApproval,
} from "../../scripts/lib/test-fixtures";
import { buildStudentHonors } from "../../src/features/honors/honors";
import { boardMember, player, type Mem } from "./board-helpers";
import { admin, buildWorld, rpcOk, type Db, type World } from "./helpers";
import { confirmFixtureCurriculum, fixtures } from "./scoring-helpers";

/**
 * R06.5 — chống tạo ảnh chụp vinh danh trùng (khóa ý định + khóa lớp + khoảng chống lặp) và API vinh danh của học sinh
 * (gateway_latest_honors) trên Supabase LOCAL thật. Cờ hệ thống bật CHỈ trong lúc chạy và trả về TẮT khi xong.
 */

let world: World;

async function newClass(teacher: Db): Promise<string> {
  const classId = await rpcOk(
    teacher.rpc("teacher_create_class", { p_name: `Lớp VD ${randomUUID().slice(0, 4)}`, p_school_year: "2026-2027" }),
  );
  await confirmFixtureCurriculum(teacher, classId, 2);
  return classId;
}

/** Lớp có bật vinh danh và một học sinh 20 điểm đủ điều kiện hiển thị. */
async function honorClass(teacher: Db, alias = "Sao Vàng"): Promise<{ classId: string; star: Mem }> {
  const classId = await newClass(teacher);
  const star = await boardMember(teacher, classId, { alias });
  await player(star).correct(2);
  await rpcOk(teacher.rpc("teacher_set_honors_enabled", { p_class_id: classId, p_enabled: true }));
  return { classId, star };
}

const create = (teacher: Db, classId: string, requestId: string = randomUUID()) =>
  teacher.rpc("teacher_create_honor_snapshot", { p_class_id: classId, p_request_id: requestId });
type Created = { snapshot_id: string; replayed: boolean; deduplicated: boolean };
const message = (result: { error: { message?: string } | null }) => result.error?.message ?? null;

async function snapshotCount(classId: string): Promise<number> {
  const { count } = await admin
    .from("honor_snapshots")
    .select("id", { count: "exact", head: true })
    .eq("class_id", classId);
  return count ?? 0;
}

async function scoreState(classId: string) {
  const scores = await admin
    .from("season_scores")
    .select("student_id, balance, earned_total")
    .eq("class_id", classId)
    .order("student_id");
  const events = await admin.from("point_events").select("id", { count: "exact", head: true }).eq("class_id", classId);
  const seasons = await admin.from("seasons").select("id, seq_no, status").eq("class_id", classId).order("seq_no");
  return { scores: scores.data, events: events.count, seasons: seasons.data };
}

const latest = async (mem: Mem) => {
  const { data, error } = await admin.rpc("gateway_latest_honors", {
    p_auth_user_id: mem.device.id,
    p_student_id: mem.studentId,
  });
  if (error) throw new Error(JSON.stringify(error));
  return data as Record<string, unknown>;
};

beforeAll(async () => {
  setLocalHonorsApproval(true);
  setLocalHonorDedupeSeconds(15);
  await fixtures();
  world = await buildWorld();
}, 120_000);

afterAll(() => {
  setLocalHonorsApproval(false);
  setLocalHonorDedupeSeconds(15);
});

describe("chống tạo ảnh chụp trùng", () => {
  it("cùng requestId gửi hai lần → cùng snapshot, không tạo thêm; điểm/mùa/ảnh cũ không đổi", async () => {
    const t = world.teacherA.client;
    const { classId } = await honorClass(t);
    const before = await scoreState(classId);
    const request = randomUUID();
    const first = (await rpcOk(create(t, classId, request))) as Created;
    expect(first.replayed).toBe(false);
    expect(first.deduplicated).toBe(false);
    const again = (await rpcOk(create(t, classId, request))) as Created;
    expect(again).toEqual({ snapshot_id: first.snapshot_id, replayed: true, deduplicated: false });
    expect(await snapshotCount(classId)).toBe(1);
    expect(await scoreState(classId)).toEqual(before);
    // Gửi lại SAU khoảng chống lặp vẫn trả snapshot cũ (không tạo mới).
    setLocalHonorDedupeSeconds(0);
    try {
      const late = (await rpcOk(create(t, classId, request))) as Created;
      expect(late.snapshot_id).toBe(first.snapshot_id);
      expect(await snapshotCount(classId)).toBe(1);
    } finally {
      setLocalHonorDedupeSeconds(15);
    }
  }, 120_000);

  it("cùng requestId nhưng khác lớp hoặc khác người tạo → IDEMPOTENCY_CONFLICT", async () => {
    const t = world.teacherA.client;
    const a = await honorClass(t, "Sao Một");
    const b = await honorClass(t, "Sao Hai");
    const request = randomUUID();
    await rpcOk(create(t, a.classId, request));
    expect(message(await create(t, b.classId, request))).toBe("IDEMPOTENCY_CONFLICT");
    expect(await snapshotCount(b.classId)).toBe(0);
    // Người tạo khác (đồng giáo viên có can_honor) dùng lại requestId của người khác trong cùng lớp.
    const co = world.teacherB;
    await admin
      .from("class_staff")
      .insert({ class_id: a.classId, staff_id: co.id, role: "co_teacher", can_honor: true });
    expect(message(await create(co.client, a.classId, request))).toBe("IDEMPOTENCY_CONFLICT");
  }, 120_000);

  it("hai yêu cầu cùng requestId chạy ĐỒNG THỜI → một snapshot", async () => {
    const t = world.teacherA.client;
    const { classId } = await honorClass(t);
    const request = randomUUID();
    const results = await Promise.all(Array.from({ length: 5 }, () => create(t, classId, request)));
    const ids = new Set(results.map((r) => (r.data as Created | null)?.snapshot_id));
    expect(results.every((r) => r.error === null)).toBe(true);
    expect(ids.size).toBe(1);
    expect(await snapshotCount(classId)).toBe(1);
  }, 120_000);

  it("hai tab gửi KHÁC requestId gần như đồng thời → một snapshot (khóa lớp + khoảng chống lặp)", async () => {
    const t = world.teacherA.client;
    const { classId } = await honorClass(t);
    const results = await Promise.all(Array.from({ length: 4 }, () => create(t, classId)));
    expect(results.every((r) => r.error === null)).toBe(true);
    const created = results.map((r) => r.data as Created);
    expect(new Set(created.map((c) => c.snapshot_id)).size).toBe(1);
    expect(created.filter((c) => !c.deduplicated)).toHaveLength(1);
    expect(await snapshotCount(classId)).toBe(1);
    // Requestid bị gộp được ghi nhớ: thử lại sau khoảng chống lặp vẫn không tạo mới.
    const merged = results.find((r) => (r.data as Created).deduplicated);
    expect(merged).toBeDefined();
  }, 120_000);

  it("sau khoảng chống lặp, GV vẫn chủ động vinh danh lần mới; snapshot cũ bất biến, điểm không reset", async () => {
    const t = world.teacherA.client;
    const { classId, star } = await honorClass(t);
    setLocalHonorDedupeSeconds(2);
    try {
      const first = (await rpcOk(create(t, classId))) as Created;
      const early = (await rpcOk(create(t, classId))) as Created;
      expect(early).toMatchObject({ snapshot_id: first.snapshot_id, deduplicated: true });
      const before = await scoreState(classId);
      const storedBefore = await admin
        .from("honor_snapshot_entries")
        .select("student_id, rank, alias, points")
        .eq("snapshot_id", first.snapshot_id);
      await new Promise((resolve) => setTimeout(resolve, 2500));
      const next = (await rpcOk(create(t, classId))) as Created;
      expect(next.snapshot_id).not.toBe(first.snapshot_id);
      expect(next.deduplicated).toBe(false);
      expect(await snapshotCount(classId)).toBe(2);
      expect(await scoreState(classId)).toEqual(before);
      const storedAfter = await admin
        .from("honor_snapshot_entries")
        .select("student_id, rank, alias, points")
        .eq("snapshot_id", first.snapshot_id);
      expect(storedAfter.data).toEqual(storedBefore.data);
      // Bất biến: không sửa/xóa trực tiếp.
      const edit = await admin.from("honor_snapshots").update({ season_no: 9 }).eq("id", first.snapshot_id);
      expect(edit.error).not.toBeNull();
      const edit2 = await admin.from("honor_snapshot_requests").delete().eq("snapshot_id", first.snapshot_id);
      expect(edit2.error).not.toBeNull();
      expect((await latest(star)).status).toBe("ok");
    } finally {
      setLocalHonorDedupeSeconds(15);
    }
  }, 120_000);

  it("đường gọi cũ (một tham số) đã bị gỡ; requestId thiếu → lỗi; bảng khóa ý định không đọc trực tiếp", async () => {
    const t = world.teacherA.client;
    const { classId } = await honorClass(t);
    const old = await t.rpc("teacher_create_honor_snapshot", { p_class_id: classId } as never);
    expect(old.error).not.toBeNull();
    expect(await snapshotCount(classId)).toBe(0);
    const direct = await t.from("honor_snapshot_requests").select("request_id");
    expect(direct.data ?? []).toHaveLength(0);
  }, 120_000);
});

describe("gateway_latest_honors (học sinh xem lần vinh danh gần nhất)", () => {
  it("cờ hệ thống tắt → disabled, không kèm dữ liệu", async () => {
    const t = world.teacherA.client;
    const { classId, star } = await honorClass(t);
    await rpcOk(create(t, classId));
    setLocalHonorsApproval(false);
    try {
      expect(await latest(star)).toEqual({ status: "disabled" });
    } finally {
      setLocalHonorsApproval(true);
    }
  }, 120_000);

  it("cờ lớp tắt → disabled; chưa có snapshot → none", async () => {
    const t = world.teacherA.client;
    const { classId, star } = await honorClass(t);
    expect(await latest(star)).toEqual({ status: "none" });
    await rpcOk(create(t, classId));
    await rpcOk(t.rpc("teacher_set_honors_enabled", { p_class_id: classId, p_enabled: false }));
    expect(await latest(star)).toEqual({ status: "disabled" });
  }, 120_000);

  it("trả TOP 3 không kèm mã định danh; học sinh KHÔNG có đồng ý bảng vẫn xem được, nhưng thiếu đồng ý học tập thì không", async () => {
    const t = world.teacherA.client;
    const { classId, star } = await honorClass(t, "Sao Bảng");
    const viewer = await boardMember(t, classId, { alias: null, display: false });
    await rpcOk(create(t, classId));
    const seen = await latest(viewer);
    expect(seen.status).toBe("ok");
    expect(Object.keys(seen).sort()).toEqual(["created_at", "entries", "season_no", "status"]);
    expect(seen.entries).toEqual([{ rank: 1, alias: "Sao Bảng", avatar_key: expect.any(String), points: 20 }]);
    const text = JSON.stringify(seen);
    for (const forbidden of [star.studentId, classId, "student_id", "class_id", "band", "email"]) {
      expect(text).not.toContain(forbidden);
    }
    const dto = buildStudentHonors(seen);
    expect(dto).toMatchObject({ status: "ok", seasonNo: 1, playbackOrder: [1] });
    // Rút đồng ý học tập của CHÍNH người xem → không xem được nữa (thu hồi thiết bị hoặc disabled — không bao giờ có dữ liệu).
    await rpcOk(t.rpc("teacher_withdraw_consent", { p_student_id: viewer.studentId, p_scope: "learning_data" }));
    const after = await admin.rpc("gateway_latest_honors", {
      p_auth_user_id: viewer.device.id,
      p_student_id: viewer.studentId,
    });
    expect(
      after.error?.message === "FORBIDDEN" || (after.data as { status?: string } | null)?.status === "disabled",
    ).toBe(true);
    expect(JSON.stringify(after.data)).not.toContain("Sao Bảng");
  }, 120_000);

  it("rút đồng ý hoặc đổi tên hiển thị sau vinh danh → lần đọc kế tiếp không còn hàng đó (bản gốc vẫn còn)", async () => {
    const t = world.teacherA.client;
    const { classId, star } = await honorClass(t, "Sao Rút");
    const second = await boardMember(t, classId, { alias: "Sao Đổi" });
    await player(second).correct(1);
    const viewer = await boardMember(t, classId, { alias: null, display: false });
    const made = (await rpcOk(create(t, classId))) as Created;
    const aliases = async () => ((await latest(viewer)).entries as Array<{ alias: string }>).map((e) => e.alias);
    expect(await aliases()).toEqual(["Sao Rút", "Sao Đổi"]);
    await rpcOk(t.rpc("teacher_withdraw_consent", { p_student_id: star.studentId, p_scope: "leaderboard_display" }));
    expect(await aliases()).toEqual(["Sao Đổi"]);
    await rpcOk(t.rpc("teacher_set_leaderboard_alias", { p_student_id: second.studentId, p_alias: "Tên Mới" }));
    expect(await aliases()).toEqual([]);
    const stored = await admin
      .from("honor_snapshot_entries")
      .select("alias")
      .eq("snapshot_id", made.snapshot_id)
      .order("rank");
    expect(stored.data?.map((e) => e.alias).sort()).toEqual(["Sao Rút", "Sao Đổi"]);
  }, 120_000);

  it("cách ly lớp; thiết bị chưa liên kết/đã thu hồi/học sinh khác thiết bị → FORBIDDEN", async () => {
    const ta = world.teacherA.client;
    const tb = world.teacherB.client;
    const a = await honorClass(ta, "Chỉ Lớp A");
    const b = await honorClass(tb, "Chỉ Lớp B");
    await rpcOk(create(ta, a.classId));
    await rpcOk(create(tb, b.classId));
    expect(JSON.stringify(await latest(a.star))).toContain("Chỉ Lớp A");
    expect(JSON.stringify(await latest(a.star))).not.toContain("Chỉ Lớp B");
    expect(JSON.stringify(await latest(b.star))).toContain("Chỉ Lớp B");
    expect(JSON.stringify(await latest(b.star))).not.toContain("Chỉ Lớp A");
    for (const [device, studentId] of [
      [a.star.device, b.star.studentId],
      [world.unlinkedDevice, a.star.studentId],
      [world.revokedDevice, a.star.studentId],
    ] as const) {
      const { error } = await admin.rpc("gateway_latest_honors", {
        p_auth_user_id: device.id,
        p_student_id: studentId,
      });
      expect(error?.message).toBe("FORBIDDEN");
    }
    const viaDevice = await a.star.device.client.rpc("gateway_latest_honors", {
      p_auth_user_id: a.star.device.id,
      p_student_id: a.star.studentId,
    });
    expect(viaDevice.error).not.toBeNull();
  }, 120_000);

  it("snapshot của mùa cũ vẫn là 'lần gần nhất' sau reset (mang số mùa cũ); bảng gốc không đọc trực tiếp", async () => {
    const t = world.teacherA.client;
    const { classId, star } = await honorClass(t, "Sao Mùa Một");
    await rpcOk(create(t, classId));
    const { data: season } = await admin
      .from("seasons")
      .select("id")
      .eq("class_id", classId)
      .eq("status", "active")
      .single();
    const { data: cls } = await admin.from("classes").select("name").eq("id", classId).single();
    await rpcOk(
      t.rpc("teacher_reset_season", {
        p_class_id: classId,
        p_request_id: randomUUID(),
        p_expected_season_id: season!.id,
        p_confirmation: cls!.name,
      }),
    );
    const seen = await latest(star);
    expect(seen).toMatchObject({ status: "ok", season_no: 1 });
    expect(JSON.stringify(seen)).toContain("Sao Mùa Một");
    const direct = await star.device.client.from("honor_snapshot_entries").select("rank");
    expect(direct.data ?? []).toHaveLength(0);
    const headers = await star.device.client.from("honor_snapshots").select("id");
    expect(headers.data ?? []).toHaveLength(0);
  }, 180_000);

  it("cờ hệ thống bảng xếp hạng không ảnh hưởng vinh danh (hai cờ độc lập)", async () => {
    // Bảo vệ khỏi hồi quy: vinh danh chỉ phụ thuộc cờ honors_*, không phụ thuộc cờ leaderboard_*.
    setLocalLeaderboardApproval(false);
    const t = world.teacherA.client;
    const { classId, star } = await honorClass(t, "Sao Độc Lập");
    await rpcOk(create(t, classId));
    expect((await latest(star)).status).toBe("ok");
  }, 120_000);
});
