import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eligibilityBlockers } from "../../src/features/gamification/ranking";
import { buildPresentation, buildStudentLeaderboard, buildTeacherOverview } from "../../src/features/leaderboard/build";
import { setLocalLeaderboardApproval } from "../../scripts/lib/test-fixtures";
import { admin, buildWorld, rpcOk, type Actor, type Db, type World } from "./helpers";
import {
  candidates,
  confirmFixtureCurriculum,
  fixtures,
  linkedStudent,
  planItems,
  sessionQuestions,
  startSession,
  submit,
} from "./scoring-helpers";

/**
 * R05 — kiểm thử tích hợp bảng xếp hạng trên Supabase LOCAL thật: lọc đủ điều kiện, cách ly lớp, cờ hệ thống/cờ lớp,
 * cập nhật khi điểm đổi qua GATEWAY GHI ĐIỂM THẬT (không sửa CSDL để giả lập), rút đồng ý có hiệu lực ngay, và
 * DTO không lộ định danh. Cờ hệ thống được bật CHỈ trên local trong lúc chạy và trả về TẮT khi xong.
 */

let world: World;
let classC: string;
let classD: string;

beforeAll(async () => {
  setLocalLeaderboardApproval(false);
  await fixtures();
  world = await buildWorld();
  classC = await rpcOk(
    world.teacherA.client.rpc("teacher_create_class", {
      p_name: `Lớp BXH ${randomUUID().slice(0, 4)}`,
      p_school_year: "2026-2027",
    }),
  );
  classD = await rpcOk(
    world.teacherB.client.rpc("teacher_create_class", {
      p_name: `Lớp BXH ${randomUUID().slice(0, 4)}`,
      p_school_year: "2026-2027",
    }),
  );
  await confirmFixtureCurriculum(world.teacherA.client, classC, 2);
  await confirmFixtureCurriculum(world.teacherB.client, classD, 2);
});

afterAll(() => {
  setLocalLeaderboardApproval(false);
});

const suffix = () => randomUUID().slice(0, 4);

type Mem = { studentId: string; device: Actor; alias: string };

/** Học sinh thử với đủ/thiếu từng điều kiện hiển thị. */
async function member(
  teacher: Db,
  classId: string,
  options: { alias?: string | null; approved?: boolean; learning?: boolean; display?: boolean } = {},
): Promise<Mem> {
  const { alias = `Bạn ${suffix()}`, approved = true, learning = true, display = true } = options;
  const { studentId, device } = await linkedStudent(teacher, classId, { consent: learning });
  if (alias) {
    await rpcOk(teacher.rpc("teacher_set_leaderboard_alias", { p_student_id: studentId, p_alias: alias }));
    if (approved) await rpcOk(teacher.rpc("teacher_approve_leaderboard_alias", { p_student_id: studentId }));
  }
  if (display) {
    await rpcOk(
      teacher.rpc("teacher_record_consent", {
        p_student_id: studentId,
        p_scope: "leaderboard_display",
        p_notice_version: "kiem-thu-bxh",
        p_method: "paper_form",
        p_note: "",
        p_attested: true,
      }),
    );
  }
  return { studentId, device, alias: alias ?? "" };
}

async function enable(teacher: Db, classId: string, view: "top10_and_me" | "full" = "top10_and_me") {
  return teacher.rpc("teacher_set_leaderboard_settings", {
    p_class_id: classId,
    p_enabled: true,
    p_student_view: view,
  });
}

async function boardFor(mem: Mem) {
  const { data, error } = await admin.rpc("gateway_class_leaderboard", {
    p_auth_user_id: mem.device.id,
    p_student_id: mem.studentId,
  });
  if (error) throw new Error(JSON.stringify(error));
  return data;
}

/** Học sinh làm bài qua đúng gateway ghi điểm; mỗi nội dung chỉ được tính điểm một lần mỗi mùa. */
function player(mem: Mem) {
  let items: string[] | null = null;
  let cursor = 0;
  let queue: string[] = [];
  const open = async () => {
    if (!items) {
      const result = await candidates(mem.device, mem.studentId);
      const list = (result.data as { items: Array<{ exerciseItemId: string; fingerprint: string }> }).items;
      const seen = new Set<string>();
      items = list
        .filter((item) => !seen.has(item.fingerprint) && seen.add(item.fingerprint))
        .map((i) => i.exerciseItemId);
    }
    const ids = items.slice(cursor, cursor + 4);
    cursor += ids.length;
    if (ids.length === 0) throw new Error("hết nội dung kiểm thử");
    const session = (await rpcOk(startSession(mem.device, mem.studentId, planItems(ids)))) as { sessionId: string };
    queue = (await sessionQuestions(session.sessionId)).map((q) => q.id);
  };
  return {
    async correct(times = 1) {
      for (let i = 0; i < times; i += 1) {
        if (queue.length === 0) await open();
        const id = queue.shift()!;
        await rpcOk(submit(mem.device, id, "correct"));
      }
    },
    /** Một lượt sai hợp lệ trên câu kế tiếp (câu vẫn mở). */
    async wrong() {
      if (queue.length === 0) await open();
      await rpcOk(submit(mem.device, queue[0]!, "wrong"));
    },
  };
}

describe("cờ hệ thống và cờ lớp", () => {
  it("cờ hệ thống tắt → GV không bật được bảng (LEADERBOARD_NOT_APPROVED); học sinh nhận 'disabled' không kèm dữ liệu", async () => {
    const a = await member(world.teacherA.client, classC);
    const tried = await enable(world.teacherA.client, classC);
    expect(tried.error?.message).toBe("LEADERBOARD_NOT_APPROVED");
    const { data } = await admin.from("classes").select("leaderboard_enabled").eq("id", classC).single();
    expect(data?.leaderboard_enabled).toBe(false);
    expect(await boardFor(a)).toEqual({ status: "disabled" });
  });

  it("cờ hệ thống bật nhưng lớp tắt (mặc định) → vẫn 'disabled', không lộ tên mùa hay hàng nào", async () => {
    setLocalLeaderboardApproval(true);
    const a = await member(world.teacherA.client, classC);
    const board = await boardFor(a);
    expect(board).toEqual({ status: "disabled" });
  });

  it("chỉ GV chủ nhiệm của CHÍNH lớp đổi được cài đặt; GV lớp khác, thiết bị học sinh, khách đều bị chặn", async () => {
    expect((await enable(world.teacherB.client, classC)).error?.message).toBe("FORBIDDEN");
    const student = await member(world.teacherA.client, classC);
    expect((await enable(student.device.client, classC)).error?.message).toBeTruthy();
    const anonymous = await world.unlinkedDevice.client.rpc("teacher_set_leaderboard_settings", {
      p_class_id: classC,
      p_enabled: true,
      p_student_view: "full",
    });
    expect(anonymous.error).not.toBeNull();
    const bad = await world.teacherA.client.rpc("teacher_set_leaderboard_settings", {
      p_class_id: classC,
      p_enabled: true,
      p_student_view: "everyone",
    });
    expect(bad.error?.message).toBe("INVALID_INPUT");
    const flag = await admin.from("classes").select("leaderboard_enabled").eq("id", classC).single();
    expect(flag.data?.leaderboard_enabled).toBe(false);
  });

  it("học sinh không thể tự bật bảng bằng cách ghi trực tiếp vào bảng classes", async () => {
    const student = await member(world.teacherA.client, classC);
    const result = await student.device.client
      .from("classes")
      .update({ leaderboard_enabled: true })
      .eq("id", classC)
      .select();
    expect(result.data ?? []).toHaveLength(0);
    const flag = await admin.from("classes").select("leaderboard_enabled").eq("id", classC).single();
    expect(flag.data?.leaderboard_enabled).toBe(false);
  });

  it("bật/tắt ghi nhật ký kiểm toán không chứa tên học sinh; tắt rồi bật lại được", async () => {
    await rpcOk(enable(world.teacherB.client, classD));
    const off = await world.teacherB.client.rpc("teacher_set_leaderboard_settings", {
      p_class_id: classD,
      p_enabled: false,
      p_student_view: "top10_and_me",
    });
    expect(off.error).toBeNull();
    const { data } = await admin
      .from("audit_logs")
      .select("action, metadata")
      .eq("class_id", classD)
      .eq("action", "leaderboard.configure")
      .order("id");
    expect(data).toHaveLength(2);
    expect(JSON.stringify(data)).not.toMatch(/Bạn|alias/u);
    await rpcOk(enable(world.teacherB.client, classD));
  });
});

describe("điều kiện xuất hiện trên bảng", () => {
  it("chỉ học sinh đủ cả sáu điều kiện có hàng; thiếu một điều kiện → không có hàng và không lộ tên", async () => {
    const ok1 = await member(world.teacherA.client, classC, { alias: "Hiện Một" });
    await member(world.teacherA.client, classC, { alias: "Hiện Hai" });
    const noDisplay = await member(world.teacherA.client, classC, { alias: "Ẩn Thiếu Hiển Thị", display: false });
    const unapproved = await member(world.teacherA.client, classC, { alias: "Ẩn Chưa Duyệt", approved: false });
    const noAlias = await member(world.teacherA.client, classC, { alias: null });
    const noLearning = await member(world.teacherA.client, classC, { alias: "Ẩn Thiếu Dữ Liệu", learning: false });
    const paused = await member(world.teacherA.client, classC, { alias: "Ẩn Tạm Ngưng" });
    await rpcOk(
      world.teacherA.client.rpc("teacher_set_student_status", { p_student_id: paused.studentId, p_status: "paused" }),
    );
    const withdrawn = await member(world.teacherA.client, classC, { alias: "Ẩn Đã Rút" });
    await rpcOk(
      world.teacherA.client.rpc("teacher_withdraw_consent", {
        p_student_id: withdrawn.studentId,
        p_scope: "leaderboard_display",
      }),
    );
    await rpcOk(enable(world.teacherA.client, classC, "full"));

    const player1 = player(ok1);
    await player1.correct(3);

    const json = JSON.stringify(await boardFor(ok1));
    for (const hidden of ["Ẩn Thiếu Hiển Thị", "Ẩn Chưa Duyệt", "Ẩn Thiếu Dữ Liệu", "Ẩn Tạm Ngưng", "Ẩn Đã Rút"]) {
      expect(json).not.toContain(hidden);
    }
    const dto = buildStudentLeaderboard(await boardFor(ok1), new Date());
    if (dto?.status !== "ok") throw new Error("expected ok");
    const aliases = dto.rows.map((row) => row.alias);
    expect(aliases).toContain("Hiện Một");
    expect(aliases).toContain("Hiện Hai");
    expect(aliases.filter((name) => name.startsWith("Ẩn"))).toEqual([]);
    expect(dto.viewerListed).toBe(true);
    expect(dto.rows.find((row) => row.alias === "Hiện Một")).toMatchObject({ points: 30, rank: 1, isMe: true });
    expect(dto.rows.find((row) => row.alias === "Hiện Hai")).toMatchObject({ points: 0, isMe: false });

    // Học sinh không đủ điều kiện vẫn xem được bảng (nếu bật) nhưng KHÔNG có hàng của mình; vẫn học và tích điểm.
    const hiddenView = buildStudentLeaderboard(await boardFor(noDisplay), new Date());
    if (hiddenView?.status !== "ok") throw new Error("expected ok");
    expect(hiddenView.viewerListed).toBe(false);
    expect(hiddenView.rows.some((row) => row.isMe)).toBe(false);
    expect(hiddenView.myRow).toBeNull();
    await player(noDisplay).correct(1);
    const score = await admin.from("season_scores").select("balance").eq("student_id", noDisplay.studentId).single();
    expect(score.data?.balance).toBe(10);
    void [unapproved, noAlias, noLearning];
  });

  it("bản TypeScript và CSDL đồng ý về học sinh nào đủ điều kiện (đối soát trên màn hình GV)", async () => {
    const overview = await rpcOk(world.teacherA.client.rpc("teacher_leaderboard_overview", { p_class_id: classC }));
    const parsed = buildTeacherOverview(overview);
    if (!parsed) throw new Error("overview");
    expect(parsed.featureApproved).toBe(true);
    expect(parsed.enabled).toBe(true);
    expect(parsed.ranked.length).toBeGreaterThanOrEqual(8);
    for (const student of parsed.ranked) {
      const blockers = eligibilityBlockers({
        key: student.studentId,
        status: student.status,
        alias: student.alias,
        aliasApproved: student.aliasApproved,
        learningDataConsent: student.learningConsent,
        leaderboardConsent: student.leaderboardConsent,
        points: student.balance,
        reachedAt: null,
        avatarKey: student.avatarKey,
      });
      expect(student.eligible, `${student.displayName}: ${blockers.join(",")}`).toBe(blockers.length === 0);
    }
  });

  it("chế độ TOP 10 + Con: tối đa phần đầu bảng, hàng của em tách riêng khi nằm ngoài", async () => {
    const dto = buildStudentLeaderboard(
      {
        status: "ok",
        view: "top10_and_me",
        season_no: 1,
        viewer_listed: true,
        rows: Array.from({ length: 12 }, (_, i) => ({
          alias: `Bạn ${i}`,
          avatar_key: "may",
          points: 120 - i * 10,
          reached_at: null,
          is_me: i === 11,
        })),
      },
      new Date(),
    );
    if (dto?.status !== "ok") throw new Error("expected ok");
    expect(dto.rows).toHaveLength(10);
    expect(dto.myRow?.alias).toBe("Bạn 11");
  });
});

describe("cách ly giữa các lớp", () => {
  it("học sinh lớp C chỉ thấy học sinh lớp C; học sinh lớp D chỉ thấy lớp D", async () => {
    const c = await member(world.teacherA.client, classC, { alias: "Chỉ Lớp C" });
    const d = await member(world.teacherB.client, classD, { alias: "Chỉ Lớp D" });
    const seenByC = JSON.stringify(await boardFor(c));
    const seenByD = JSON.stringify(await boardFor(d));
    expect(seenByC).toContain("Chỉ Lớp C");
    expect(seenByC).not.toContain("Chỉ Lớp D");
    expect(seenByD).toContain("Chỉ Lớp D");
    expect(seenByD).not.toContain("Chỉ Lớp C");
  });

  it("thiết bị không dùng được hồ sơ của học sinh khác lớp; thiết bị chưa liên kết/đã thu hồi → FORBIDDEN", async () => {
    const d = await member(world.teacherB.client, classD);
    const c = await member(world.teacherA.client, classC);
    for (const [device, studentId] of [
      [c.device, d.studentId],
      [world.unlinkedDevice, c.studentId],
      [world.revokedDevice, c.studentId],
    ] as const) {
      const { error } = await admin.rpc("gateway_class_leaderboard", {
        p_auth_user_id: device.id,
        p_student_id: studentId,
      });
      expect(error?.message).toBe("FORBIDDEN");
    }
  });

  it("hàm gateway_class_leaderboard không gọi được bằng JWT thiết bị hay khách (chỉ service_role)", async () => {
    const c = await member(world.teacherA.client, classC);
    const viaDevice = await c.device.client.rpc("gateway_class_leaderboard", {
      p_auth_user_id: c.device.id,
      p_student_id: c.studentId,
    });
    expect(viaDevice.error).not.toBeNull();
  });

  it("GV lớp khác không xem được tổng quan hay dữ liệu trình chiếu; thiết bị học sinh cũng không", async () => {
    expect(
      (await world.teacherB.client.rpc("teacher_leaderboard_overview", { p_class_id: classC })).error?.message,
    ).toBe("FORBIDDEN");
    expect(
      (await world.teacherB.client.rpc("teacher_leaderboard_display", { p_class_id: classC })).error?.message,
    ).toBe("FORBIDDEN");
    const c = await member(world.teacherA.client, classC);
    expect((await c.device.client.rpc("teacher_leaderboard_display", { p_class_id: classC })).error?.message).toBe(
      "FORBIDDEN",
    );
  });

  it("học sinh không đọc được điểm của bạn qua REST (RLS chỉ cho dòng của mình)", async () => {
    const a = await member(world.teacherA.client, classC);
    const b = await member(world.teacherA.client, classC);
    await player(b).correct(1);
    const seen = await a.device.client.from("season_scores").select("student_id, balance");
    expect((seen.data ?? []).every((row) => row.student_id === a.studentId)).toBe(true);
    const other = await a.device.client.from("season_scores").select("balance").eq("student_id", b.studentId);
    expect(other.data ?? []).toHaveLength(0);
  });
});

describe("điểm đổi → xếp hạng đổi (qua gateway ghi điểm thật)", () => {
  it("A 50, B 60 → A đúng thêm: đồng hạng nhất; đúng nữa: A hạng 1; sai: A 65 vẫn hạng 1, B hạng 2", async () => {
    const a = await member(world.teacherB.client, classD, { alias: "Bạn A" });
    const b = await member(world.teacherB.client, classD, { alias: "Bạn B" });
    const pa = player(a);
    const pb = player(b);
    await pa.correct(5);
    await pb.correct(6);
    const view = async () => {
      const dto = buildStudentLeaderboard(await boardFor(a), new Date());
      if (dto?.status !== "ok") throw new Error("expected ok");
      return Object.fromEntries(dto.rows.filter((r) => r.alias.startsWith("Bạn ")).map((r) => [r.alias, r]));
    };

    let rows = await view();
    expect(rows["Bạn A"]).toMatchObject({ points: 50 });
    expect(rows["Bạn B"]).toMatchObject({ points: 60 });
    expect(rows["Bạn B"]!.rank).toBeLessThan(rows["Bạn A"]!.rank);

    await pa.correct(1); // A = 60: đồng điểm với B
    rows = await view();
    expect(rows["Bạn A"]!.points).toBe(60);
    expect(rows["Bạn A"]!.rank).toBe(rows["Bạn B"]!.rank);

    await pa.correct(1); // A = 70
    rows = await view();
    expect(rows["Bạn A"]).toMatchObject({ points: 70, rank: 1 });
    expect(rows["Bạn B"]!.rank).toBeGreaterThan(1);

    await pa.wrong(); // A = 65 (−5 theo Scoring Engine)
    rows = await view();
    expect(rows["Bạn A"]).toMatchObject({ points: 65, rank: 1 });
    expect(rows["Bạn B"]).toMatchObject({ points: 60, rank: 2 });
    const stored = await admin.from("season_scores").select("balance").eq("student_id", a.studentId).single();
    expect(stored.data?.balance).toBe(65);
  });

  it("bảng không thể dùng để đổi điểm: API chỉ đọc, hàm không nhận tham số điểm", async () => {
    const a = await member(world.teacherA.client, classC);
    const before = await admin.from("season_scores").select("balance").eq("student_id", a.studentId);
    await boardFor(a);
    await boardFor(a);
    const after = await admin.from("season_scores").select("balance").eq("student_id", a.studentId);
    expect(after.data).toEqual(before.data);
  });
});

describe("rút đồng ý / tắt bảng có hiệu lực ngay", () => {
  it("rút leaderboard_display → biến mất ở request kế tiếp nhưng giữ điểm; cấp lại → xuất hiện lại", async () => {
    const x = await member(world.teacherB.client, classD, { alias: "Rút Đồng Ý" });
    const viewer = await member(world.teacherB.client, classD, { alias: "Người Quan Sát" });
    await player(x).correct(2);
    const names = async () => {
      const dto = buildStudentLeaderboard(await boardFor(viewer), new Date());
      if (dto?.status !== "ok") throw new Error("expected ok");
      return dto.rows.map((row) => row.alias);
    };
    expect(await names()).toContain("Rút Đồng Ý");
    await rpcOk(
      world.teacherB.client.rpc("teacher_withdraw_consent", {
        p_student_id: x.studentId,
        p_scope: "leaderboard_display",
      }),
    );
    expect(await names()).not.toContain("Rút Đồng Ý");
    expect(JSON.stringify(await boardFor(viewer))).not.toContain("Rút Đồng Ý");
    const kept = await admin.from("season_scores").select("balance").eq("student_id", x.studentId).single();
    expect(kept.data?.balance).toBe(20);
    await rpcOk(
      world.teacherB.client.rpc("teacher_record_consent", {
        p_student_id: x.studentId,
        p_scope: "leaderboard_display",
        p_notice_version: "kiem-thu-bxh",
        p_method: "paper_form",
        p_note: "",
        p_attested: true,
      }),
    );
    expect(await names()).toContain("Rút Đồng Ý");
  });

  it("đổi tên hiển thị → mất trạng thái duyệt → biến mất cho tới khi GV duyệt lại", async () => {
    const x = await member(world.teacherB.client, classD, { alias: "Tên Cũ Đã Duyệt" });
    const viewer = await member(world.teacherB.client, classD, { alias: "Người Quan Sát Hai" });
    const names = async () => {
      const dto = buildStudentLeaderboard(await boardFor(viewer), new Date());
      if (dto?.status !== "ok") throw new Error("expected ok");
      return dto.rows.map((row) => row.alias);
    };
    expect(await names()).toContain("Tên Cũ Đã Duyệt");
    await rpcOk(
      world.teacherB.client.rpc("teacher_set_leaderboard_alias", { p_student_id: x.studentId, p_alias: "Tên Mới" }),
    );
    const all = JSON.stringify(await boardFor(viewer));
    expect(all).not.toContain("Tên Mới");
    expect(all).not.toContain("Tên Cũ Đã Duyệt");
    await rpcOk(world.teacherB.client.rpc("teacher_approve_leaderboard_alias", { p_student_id: x.studentId }));
    expect(await names()).toContain("Tên Mới");
  });

  it("GV tắt bảng khi học sinh đang xem → request kế tiếp nhận 'disabled' không kèm hàng; điểm còn nguyên", async () => {
    const x = await member(world.teacherB.client, classD, { alias: "Đang Xem" });
    await player(x).correct(1);
    expect(((await boardFor(x)) as { status: string }).status).toBe("ok");
    await rpcOk(
      world.teacherB.client.rpc("teacher_set_leaderboard_settings", {
        p_class_id: classD,
        p_enabled: false,
        p_student_view: "top10_and_me",
      }),
    );
    expect(await boardFor(x)).toEqual({ status: "disabled" });
    const kept = await admin.from("season_scores").select("balance").eq("student_id", x.studentId).single();
    expect(kept.data?.balance).toBe(10);
    await rpcOk(enable(world.teacherB.client, classD));
  });

  it("cờ hệ thống bị rút lại → bảng của lớp đã bật cũng ngừng trả dữ liệu", async () => {
    const x = await member(world.teacherA.client, classC);
    expect(((await boardFor(x)) as { status: string }).status).toBe("ok");
    setLocalLeaderboardApproval(false);
    expect(await boardFor(x)).toEqual({ status: "disabled" });
    const display = await world.teacherA.client.rpc("teacher_leaderboard_display", { p_class_id: classC });
    expect(display.error?.message).toBe("LEADERBOARD_DISABLED");
    setLocalLeaderboardApproval(true);
  });
});

describe("dữ liệu trình chiếu của GV", () => {
  it("chỉ học sinh đủ điều kiện, không có mã định danh, không có học sinh bị ẩn", async () => {
    const hidden = await member(world.teacherA.client, classC, { alias: "Bị Ẩn Khỏi Chiếu", display: false });
    const shown = await member(world.teacherA.client, classC, { alias: "Được Chiếu" });
    void hidden;
    const raw = await rpcOk(world.teacherA.client.rpc("teacher_leaderboard_display", { p_class_id: classC }));
    const text = JSON.stringify(raw);
    expect(text).toContain("Được Chiếu");
    expect(text).not.toContain("Bị Ẩn Khỏi Chiếu");
    expect(text).not.toContain(shown.studentId);
    for (const key of ["student_id", "class_id", "balance", "earned_total", "consent"]) expect(text).not.toContain(key);
    const dto = buildPresentation(raw, new Date());
    expect(dto?.rows.length).toBeGreaterThan(0);
    expect(dto?.rows.every((row) => row.rank >= 1)).toBe(true);
  });

  it("tổng quan nội bộ có học sinh bị ẩn (chỉ GV của lớp thấy)", async () => {
    const raw = await rpcOk(world.teacherA.client.rpc("teacher_leaderboard_overview", { p_class_id: classC }));
    expect(JSON.stringify(raw)).toContain("student_id");
    const parsed = buildTeacherOverview(raw);
    expect(parsed?.ranked.some((student) => !student.eligible)).toBe(true);
  });
});
