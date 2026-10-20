import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { setLocalHonorsApproval } from "../../scripts/lib/test-fixtures";
import { buildHonorSnapshot, selectHonorees } from "../../src/features/honors/honors";
import type { RankableRow } from "../../src/features/gamification/ranking";
import { buildTeacherOverview } from "../../src/features/leaderboard/build";
import { boardMember, player, recordDisplayConsent, type Mem } from "./board-helpers";
import { admin, buildWorld, newTeacher, publicClient, rpcOk, type Db, type World } from "./helpers";
import { confirmFixtureCurriculum, fixtures } from "./scoring-helpers";

/**
 * R06.1 — kiểm thử tích hợp vinh danh TOP 3 trên Supabase LOCAL thật (JWT thật, hàm CSDL thật, không mock):
 * quy tắc TOP 3/đồng hạng, điều kiện hiển thị, cờ hệ thống/cờ lớp, phân quyền, bất biến, riêng tư khi đọc.
 * Điểm có được qua gateway ghi điểm thật. Cờ hệ thống được bật CHỈ trên local trong lúc chạy và trả về TẮT khi xong.
 */

let world: World;

async function newClass(teacher: Db): Promise<string> {
  const classId = await rpcOk(
    teacher.rpc("teacher_create_class", { p_name: `Lớp VD ${randomUUID().slice(0, 4)}`, p_school_year: "2026-2027" }),
  );
  await confirmFixtureCurriculum(teacher, classId, 2);
  return classId;
}

const message = (result: { error: { message?: string } | null }) => result.error?.message ?? null;
const create = (teacher: Db, classId: string) => teacher.rpc("teacher_create_honor_snapshot", { p_class_id: classId });
const get = (teacher: Db, id: string) => teacher.rpc("teacher_get_honor_snapshot", { p_snapshot_id: id });

type Entry = { rank: number; alias: string; avatar_key: string; points: number };
const entriesOf = (data: unknown) => (data as { entries: Entry[] }).entries;

async function storedEntries(snapshotId: string) {
  const { data } = await admin
    .from("honor_snapshot_entries")
    .select("student_id, rank, alias, points")
    .eq("snapshot_id", snapshotId)
    .order("rank")
    .order("alias");
  return data ?? [];
}

async function scoreState(classId: string) {
  const scores = await admin
    .from("season_scores")
    .select("student_id, balance, earned_total, deducted_total")
    .eq("class_id", classId)
    .order("student_id");
  const events = await admin.from("point_events").select("id", { count: "exact", head: true }).eq("class_id", classId);
  const seasons = await admin.from("seasons").select("id, seq_no, status").eq("class_id", classId).order("seq_no");
  return { scores: scores.data, events: events.count, seasons: seasons.data };
}

beforeAll(async () => {
  setLocalHonorsApproval(false);
  await fixtures();
  world = await buildWorld();
});

afterAll(() => {
  setLocalHonorsApproval(false);
});

describe("cờ hệ thống tắt (mặc định)", () => {
  it("GV không bật được vinh danh cho lớp và không tạo được ảnh chụp", async () => {
    const classId = await newClass(world.teacherA.client);
    const enable = await world.teacherA.client.rpc("teacher_set_honors_enabled", {
      p_class_id: classId,
      p_enabled: true,
    });
    expect(message(enable)).toBe("HONORS_NOT_APPROVED");
    const made = await create(world.teacherA.client, classId);
    expect(message(made)).toBe("HONORS_DISABLED");
    const listed = await world.teacherA.client.rpc("teacher_list_honor_snapshots", { p_class_id: classId });
    expect(message(listed)).toBe("HONORS_DISABLED");
    const { count } = await admin
      .from("honor_snapshots")
      .select("id", { count: "exact", head: true })
      .eq("class_id", classId);
    expect(count).toBe(0);
  });
});

describe("vinh danh TOP 3 (cờ hệ thống bật trên local)", () => {
  let classId: string;
  let a: Mem;
  let b: Mem;
  let c: Mem;
  let d: Mem;
  // Một người chơi giữ trạng thái buổi luyện: gọi player() mới sẽ mở lại buổi cũ với câu đã đóng.
  let playD: ReturnType<typeof player>;
  let unapproved: Mem;
  let noDisplay: Mem;
  let snapshotId: string;
  let before: Awaited<ReturnType<typeof scoreState>>;

  beforeAll(async () => {
    setLocalHonorsApproval(true);
    classId = await newClass(world.teacherA.client);
    const t = world.teacherA.client;
    a = await boardMember(t, classId, { alias: "Mai Vàng" });
    b = await boardMember(t, classId, { alias: "Nam Bé" });
    c = await boardMember(t, classId, { alias: "Lan Hồng" });
    d = await boardMember(t, classId, { alias: "Đức Nhỏ" });
    await boardMember(t, classId, { alias: "Hạt Đậu" });
    // Điểm cao nhưng KHÔNG đủ điều kiện hiển thị: không được vào vinh danh và không làm lệch hạng của người khác.
    unapproved = await boardMember(t, classId, { alias: "Chưa Duyệt", approved: false });
    noDisplay = await boardMember(t, classId, { alias: "Không Đồng Ý", display: false });
    await boardMember(t, classId, { alias: "Không Học", learning: false });
    await player(a).correct(3);
    await player(b).correct(3);
    await player(c).correct(2);
    playD = player(d);
    await playD.correct(1);
    await player(unapproved).correct(4);
    await player(noDisplay).correct(4);
    await rpcOk(t.rpc("teacher_set_honors_enabled", { p_class_id: classId, p_enabled: true }));
    before = await scoreState(classId);
  }, 300_000);

  it("lớp chưa bật vinh danh (cờ lớp tắt) → HONORS_DISABLED dù cờ hệ thống bật", async () => {
    const other = await newClass(world.teacherA.client);
    await boardMember(world.teacherA.client, other);
    expect(message(await create(world.teacherA.client, other))).toBe("HONORS_DISABLED");
  });

  it("TOP 3 đồng hạng 1–1–3: hai bạn 30 điểm cùng hạng 1, bậc 2 trống, bạn 20 điểm hạng 3; bạn 10 điểm và 0 điểm bị loại", async () => {
    snapshotId = await rpcOk(create(world.teacherA.client, classId));
    const stored = await storedEntries(snapshotId);
    expect(stored.map((e) => [e.alias, e.rank, e.points])).toEqual([
      ["Mai Vàng", 1, 30],
      ["Nam Bé", 1, 30],
      ["Lan Hồng", 3, 20],
    ]);
    expect(stored.some((e) => e.rank === 2)).toBe(false);
    const names = stored.map((e) => e.alias);
    for (const excluded of ["Đức Nhỏ", "Hạt Đậu", "Chưa Duyệt", "Không Đồng Ý", "Không Học"]) {
      expect(names).not.toContain(excluded);
    }
  });

  it("tạo ảnh chụp không đổi điểm, sổ cái hay mùa", async () => {
    expect(await scoreState(classId)).toEqual(before);
  });

  it("khớp Ranking Engine TypeScript (rankScores) trên cùng dữ liệu đủ điều kiện", async () => {
    const overview = buildTeacherOverview(
      await rpcOk(world.teacherA.client.rpc("teacher_leaderboard_overview", { p_class_id: classId })),
    )!;
    const rows = overview.ranked
      .filter((student) => student.eligible)
      .map<RankableRow>((student) => ({
        key: student.studentId,
        alias: student.alias!,
        avatarKey: student.avatarKey,
        points: student.balance,
        reachedAt: null,
        isMe: false,
      }));
    const expected = selectHonorees(rows)
      .map((row) => [row.alias, row.rank])
      .sort();
    const stored = (await storedEntries(snapshotId)).map((e) => [e.alias, e.rank]).sort();
    expect(stored).toEqual(expected);
  });

  it("đọc từ ảnh chụp: không có student_id/class_id/nhóm năng lực; DTO phát TOP 3 → TOP 1 bỏ bậc trống", async () => {
    const { data, error } = await get(world.teacherA.client, snapshotId);
    expect(error).toBeNull();
    expect(JSON.stringify(data)).not.toMatch(/student_id|class_id|band|foundation|developing|extending|email/u);
    const dto = buildHonorSnapshot(data)!;
    expect(dto.tiers.map((tier) => [tier.rank, tier.entries.length])).toEqual([
      [1, 2],
      [3, 1],
    ]);
    expect(dto.playbackOrder).toEqual([3, 1]);
    const listed = await rpcOk(world.teacherA.client.rpc("teacher_list_honor_snapshots", { p_class_id: classId }));
    expect(listed).toHaveLength(1);
    expect(JSON.stringify(listed)).not.toMatch(/student_id|class_id|created_by/u);
  });

  it("nhật ký kiểm toán ghi người tạo và số hàng, không chứa mã học sinh", async () => {
    const { data } = await admin
      .from("audit_logs")
      .select("actor_id, actor_kind, class_id, metadata")
      .eq("action", "honors.snapshot_create")
      .eq("target_id", snapshotId);
    expect(data).toHaveLength(1);
    expect(data![0]).toMatchObject({ actor_id: world.teacherA.id, actor_kind: "staff", class_id: classId });
    const text = JSON.stringify(data![0]!.metadata);
    expect(text).toContain('"entries":3');
    for (const mem of [a, b, c]) expect(text).not.toContain(mem.studentId);
  });

  it("bất biến: không sửa/xóa đầu ảnh chụp hay hàng vinh danh, kể cả bằng quyền máy chủ", async () => {
    const updateHead = await admin.from("honor_snapshots").update({ season_no: 9 }).eq("id", snapshotId);
    const deleteHead = await admin.from("honor_snapshots").delete().eq("id", snapshotId);
    const updateRow = await admin.from("honor_snapshot_entries").update({ points: 999 }).eq("snapshot_id", snapshotId);
    const deleteRow = await admin.from("honor_snapshot_entries").delete().eq("snapshot_id", snapshotId);
    for (const attempt of [updateHead, deleteHead, updateRow, deleteRow]) {
      expect(attempt.error?.message).toBe("APPEND_ONLY");
    }
    expect(await storedEntries(snapshotId)).toHaveLength(3);
  });

  it("điểm đổi sau khi chụp: ảnh chụp cũ không đổi; ảnh chụp mới phản ánh điểm mới", async () => {
    await playD.correct(3); // 10 → 40: vượt hai bạn 30 điểm (cùng một buổi luyện 4 câu).
    const old = entriesOf((await get(world.teacherA.client, snapshotId)).data);
    expect(old.map((e) => [e.alias, e.rank, e.points])).toEqual([
      ["Mai Vàng", 1, 30],
      ["Nam Bé", 1, 30],
      ["Lan Hồng", 3, 20],
    ]);
    const second = await rpcOk(create(world.teacherA.client, classId));
    expect(second).not.toBe(snapshotId);
    expect((await storedEntries(second)).map((e) => [e.alias, e.rank, e.points])).toEqual([
      ["Đức Nhỏ", 1, 40],
      ["Mai Vàng", 2, 30],
      ["Nam Bé", 2, 30],
    ]);
    expect(entriesOf((await get(world.teacherA.client, snapshotId)).data)).toHaveLength(3);
  });

  it("rút đồng ý hiển thị sau khi chụp → lần đọc sau không còn hàng đó; bản gốc vẫn nguyên; cấp lại → hiện lại", async () => {
    const t = world.teacherA.client;
    await rpcOk(t.rpc("teacher_withdraw_consent", { p_student_id: a.studentId, p_scope: "leaderboard_display" }));
    const after = entriesOf((await get(t, snapshotId)).data);
    expect(after.map((e) => e.alias)).toEqual(["Nam Bé", "Lan Hồng"]);
    expect(JSON.stringify(after)).not.toContain("Mai Vàng");
    expect(await storedEntries(snapshotId)).toHaveLength(3);
    await recordDisplayConsent(t, a.studentId);
    expect(entriesOf((await get(t, snapshotId)).data).map((e) => e.alias)).toContain("Mai Vàng");
  });

  it("rút đồng ý học tập hoặc đổi tên hiển thị (chưa duyệt lại) → bị ẩn khi đọc", async () => {
    const t = world.teacherA.client;
    await rpcOk(t.rpc("teacher_withdraw_consent", { p_student_id: b.studentId, p_scope: "learning_data" }));
    await rpcOk(t.rpc("teacher_set_leaderboard_alias", { p_student_id: c.studentId, p_alias: "Tên Mới" }));
    const hidden = entriesOf((await get(t, snapshotId)).data).map((e) => e.alias);
    expect(hidden).not.toContain("Nam Bé");
    expect(hidden).not.toContain("Lan Hồng");
    expect(hidden).not.toContain("Tên Mới");
    expect(await storedEntries(snapshotId)).toHaveLength(3);
  });

  it("GV lớp khác không đọc/tạo/liệt kê được; không đọc thẳng bảng hàng; khách không gọi được", async () => {
    const other = world.teacherB.client;
    expect(message(await create(other, classId))).toBe("FORBIDDEN");
    expect(message(await get(other, snapshotId))).toBe("FORBIDDEN");
    expect(message(await other.rpc("teacher_list_honor_snapshots", { p_class_id: classId }))).toBe("FORBIDDEN");
    expect(message(await get(world.teacherA.client, randomUUID()))).toBe("NOT_FOUND");
    const headers = await other.from("honor_snapshots").select("id").eq("class_id", classId);
    expect(headers.data ?? []).toEqual([]);
    const rowsB = await other.from("honor_snapshot_entries").select("student_id");
    const rowsA = await world.teacherA.client.from("honor_snapshot_entries").select("student_id");
    expect(rowsB.error).not.toBeNull();
    expect(rowsA.error).not.toBeNull();
    const mine = await world.teacherA.client.from("honor_snapshots").select("id").eq("class_id", classId);
    expect(mine.data?.length).toBe(2);
    const anon = publicClient();
    expect((await create(anon, classId)).error).not.toBeNull();
    expect((await get(anon, snapshotId)).error).not.toBeNull();
  });

  it("học sinh (thiết bị) không tạo, không đọc, không bật được vinh danh", async () => {
    const device = a.device.client;
    expect((await create(device, classId)).error).not.toBeNull();
    expect((await get(device, snapshotId)).error).not.toBeNull();
    expect(
      (await device.rpc("teacher_set_honors_enabled", { p_class_id: classId, p_enabled: false })).error,
    ).not.toBeNull();
    expect((await device.from("honor_snapshot_entries").select("student_id")).error).not.toBeNull();
    const headers = await device.from("honor_snapshots").select("id");
    expect(headers.data ?? []).toEqual([]);
  });

  it("co_teacher chỉ tạo được khi có can_honor; không bật/tắt được vinh danh (chỉ chủ nhiệm)", async () => {
    const co = await newTeacher(world.schoolId, "gv-co");
    const link = await admin.from("class_staff").insert({ class_id: classId, staff_id: co.id, role: "co_teacher" });
    expect(link.error).toBeNull();
    expect(message(await create(co.client, classId))).toBe("FORBIDDEN");
    expect(message(await co.client.rpc("teacher_set_honors_enabled", { p_class_id: classId, p_enabled: false }))).toBe(
      "FORBIDDEN",
    );
    await admin.from("class_staff").update({ can_honor: true }).eq("class_id", classId).eq("staff_id", co.id);
    const made = await create(co.client, classId);
    expect(made.error).toBeNull();
    expect(message(await get(co.client, made.data as string))).toBeNull();
    // Gỡ khỏi lớp → mất quyền ngay.
    await admin
      .from("class_staff")
      .update({ removed_at: new Date().toISOString() })
      .eq("class_id", classId)
      .eq("staff_id", co.id);
    expect(message(await create(co.client, classId))).toBe("FORBIDDEN");
  });

  it("cờ hệ thống tắt lại → không đọc được ảnh chụp cũ và không tạo được mới", async () => {
    setLocalHonorsApproval(false);
    try {
      expect(message(await get(world.teacherA.client, snapshotId))).toBe("HONORS_DISABLED");
      expect(message(await create(world.teacherA.client, classId))).toBe("HONORS_DISABLED");
    } finally {
      setLocalHonorsApproval(true);
    }
  });

  it("xóa hồ sơ học sinh (quyền xóa dữ liệu) xóa theo hàng vinh danh của em, không chạm hàng khác", async () => {
    const del = await admin.from("students").delete().eq("id", b.studentId);
    expect(del.error).toBeNull();
    const rows = await storedEntries(snapshotId);
    expect(rows.map((e) => e.alias)).toEqual(["Mai Vàng", "Lan Hồng"]);
  });
});

describe("không tạo ảnh chụp rỗng", () => {
  beforeAll(() => setLocalHonorsApproval(true));

  async function noHonorees(setup: (teacher: Db, classId: string) => Promise<void>) {
    const t = world.teacherA.client;
    const classId = await newClass(t);
    await setup(t, classId);
    await rpcOk(t.rpc("teacher_set_honors_enabled", { p_class_id: classId, p_enabled: true }));
    expect(message(await create(t, classId))).toBe("NO_HONOREES");
    const { count } = await admin
      .from("honor_snapshots")
      .select("id", { count: "exact", head: true })
      .eq("class_id", classId);
    expect(count).toBe(0);
  }

  it("lớp không có học sinh", async () => {
    await noHonorees(async () => {});
  });

  it("tất cả 0 điểm", async () => {
    await noHonorees(async (t, classId) => {
      await boardMember(t, classId);
      await boardMember(t, classId);
    });
  });

  it("có điểm nhưng không ai đủ điều kiện hiển thị (chưa đồng ý, tên chưa duyệt)", async () => {
    await noHonorees(async (t, classId) => {
      await player(await boardMember(t, classId, { display: false })).correct(2);
      await player(await boardMember(t, classId, { approved: false })).correct(2);
    });
  });
});
