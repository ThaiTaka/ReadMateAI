import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { SUPPORT_POLICIES } from "../../src/features/exercises/core/support";
import { GAME_QUESTION_COUNT, type GameRunPlan } from "../../src/features/game-runs/planner";
import { setLocalGameRunFixtures } from "../../scripts/lib/test-fixtures";
import { startGameRun } from "@/server/game-runs/student";
import type { StudentContext } from "@/server/student-gateway/context";
import type { Mem } from "./board-helpers";
import { admin, buildWorld, rpcOk, type World } from "./helpers";
import {
  counts,
  fakePlan,
  gameFixtures,
  gameMember,
  itemIdsOf,
  LEVEL,
  localSql,
  newGameClass,
  realPlan,
  runOf,
  startWith,
  withItem,
} from "./game-helpers";
import {
  candidates,
  errorMessage,
  planItems,
  sessionQuestions,
  setTestFixturesAllowed,
  startSession,
  submit,
} from "./scoring-helpers";

/**
 * R08.2 — bắt đầu lượt Mê cung kho báu: phân bổ 7 chạm trán + 21 câu trong MỘT giao dịch (Supabase LOCAL, JWT thật,
 * nội dung fixture hư cấu riêng của game — KHÔNG phải học liệu thật; production vẫn INSUFFICIENT_CONTENT).
 */

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

const triggerKeys = (
  JSON.parse(readFileSync("content/games/treasure-maze/levels/level-01.json", "utf8")) as {
    triggers: Array<{ id: string }>;
  }
).triggers
  .map((t) => t.id)
  .sort();

const activeSeason = async (classId: string) =>
  (await admin.from("seasons").select("id").eq("class_id", classId).eq("status", "active").single()).data!.id;

const encounterRows = async (runId: string) =>
  (await admin.from("game_encounters").select("*").eq("run_id", runId).order("encounter_no")).data!;
const questionRows = async (runId: string) =>
  (await admin.from("question_instances").select("*").eq("run_id", runId).order("position")).data!;

/** Kế hoạch thủ công từ 21 mã câu (7 × 3), mức hỗ trợ H2. */
function planFromIds(ids: string[]): GameRunPlan {
  return {
    encounters: Array.from({ length: 7 }, (_, e) => ({
      monsterKey: `mon-test-${e + 1}`,
      questions: ids
        .slice(e * 3, e * 3 + 3)
        .map((exerciseItemId) => ({ exerciseItemId, supportLevel: 2 as const, maxAttempts: 3 })),
    })),
  };
}

beforeAll(async () => {
  await gameFixtures();
  setLocalGameRunFixtures(false);
  world = await buildWorld();
}, 180_000);
afterAll(() => {
  setLocalGameRunFixtures(false);
  setTestFixturesAllowed(true);
});

describe("R08.2 — tạo lượt: 1 lượt + 7 chạm trán + 21 câu", () => {
  it("đúng 21 nội dung chưa tính điểm: tạo đủ, đúng khuôn, không đổi điểm, không lộ trạng thái chưa kích hoạt", async () => {
    const t = world.teacherA.client;
    const cls = await newGameClass(t);
    // 32 nội dung − 11 đã làm = đúng 21 còn lại; 11 câu đúng = 110 điểm.
    const m = await gameMember(t, cls.id, { burn: 11 });
    const plan = (await realPlan(m))!;
    expect(plan).not.toBeNull();
    const before = await admin
      .from("season_scores")
      .select("balance, earned_total")
      .eq("student_id", m.studentId)
      .single();
    const eventsBefore = await admin.from("point_events").select("id").eq("student_id", m.studentId);

    const result = await startWith(m, plan);
    expect(result.error).toBeNull();
    expect((result.data as { outcome: string }).outcome).toBe("created");
    const run = runOf(result);
    expect(run.scored).toBe(true);
    expect(run.position).toEqual({ row: 1, col: 1 });
    expect(run.state_version).toBe(1);

    expect(await counts(m.studentId)).toEqual({ runs: 1, encounters: 7, questions: 21 });
    const season = await activeSeason(cls.id);
    const encounters = await encounterRows(run.id);
    expect(encounters.map((e) => e.encounter_no)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    for (const e of encounters) {
      expect(e).toMatchObject({
        status: "pending",
        hp_remaining: 3,
        activated_at: null,
        resolved_at: null,
        return_position: null,
        student_id: m.studentId,
        class_id: cls.id,
        season_id: season,
      });
    }
    expect(new Set(encounters.map((e) => e.monster_key)).size).toBe(7);
    expect(encounters.map((e) => e.monster_key)).toEqual(plan.encounters.map((e) => e.monsterKey));
    // 7 điểm kích hoạt do CSDL đọc từ đúng phiên bản màn, mỗi chạm trán một điểm khác nhau.
    expect(encounters.map((e) => e.trigger_key).sort()).toEqual(triggerKeys);

    const questions = await questionRows(run.id);
    expect(questions).toHaveLength(21);
    expect(new Set(questions.map((q) => q.exercise_item_id)).size).toBe(21);
    expect(new Set(questions.map((q) => q.content_fingerprint)).size).toBe(21);
    for (const e of encounters) {
      const own = questions.filter((q) => q.game_encounter_id === e.id);
      expect(own.map((q) => q.position)).toEqual([1, 2, 3]);
      expect(own.map((q) => q.exercise_item_id)).toEqual(
        plan.encounters[e.encounter_no - 1]!.questions.map((q) => q.exerciseItemId),
      );
    }
    for (const q of questions) {
      expect(q).toMatchObject({
        context_kind: "game_encounter",
        practice_session_id: null,
        status: "open",
        attempts_used: 0,
        scorable: true,
        not_scorable_reason: null,
        rewarded: false,
        support_level: 2,
        max_attempts: SUPPORT_POLICIES[2].maxAttempts,
        student_id: m.studentId,
        season_id: season,
      });
      expect(Object.keys(q.view as object).sort()).toEqual(["content", "type", "variant"]);
    }

    // Phân bổ không động tới điểm, không ghi sổ cái.
    const after = await admin
      .from("season_scores")
      .select("balance, earned_total")
      .eq("student_id", m.studentId)
      .single();
    expect(after.data).toEqual(before.data);
    expect((await admin.from("point_events").select("id").eq("student_id", m.studentId)).data).toHaveLength(
      eventsBefore.data!.length,
    );
  }, 120_000);

  it("20 nội dung chưa tính điểm → INSUFFICIENT_CONTENT, bộ lập trả null, không tạo gì", async () => {
    const t = world.teacherA.client;
    const cls = await newGameClass(t);
    const m = await gameMember(t, cls.id, { burn: 12 });
    expect(await realPlan(m)).toBeNull();
    expect(errorMessage(await startWith(m, null))).toBe("INSUFFICIENT_CONTENT");
    expect(await counts(m.studentId)).toEqual({ runs: 0, encounters: 0, questions: 0 });

    // Kế hoạch tự dựng có 20 câu mới + 1 câu ĐÃ tính điểm trong mùa: CSDL vẫn từ chối (không tin máy chủ lập kế hoạch).
    const list = (
      (await candidates(m.device, m.studentId)).data as {
        items: Array<{ exerciseItemId: string; fingerprint: string; scoredInSeason: boolean }>;
      }
    ).items;
    const seen = new Set<string>();
    const fresh = list
      .filter((i) => !i.scoredInSeason && !seen.has(i.fingerprint) && seen.add(i.fingerprint))
      .map((i) => i.exerciseItemId);
    const scored = list.filter((i) => i.scoredInSeason).map((i) => i.exerciseItemId);
    expect(fresh).toHaveLength(20);
    expect(errorMessage(await startWith(m, planFromIds([...fresh, scored[0]!])))).toBe("INSUFFICIENT_CONTENT");
    expect(await counts(m.studentId)).toEqual({ runs: 0, encounters: 0, questions: 0 });
    const service = await startGameRun(ctx(m), m.studentId, LEVEL);
    expect(service).toEqual({ ok: false, code: "INSUFFICIENT_CONTENT" });
  }, 120_000);

  it("từ chối kế hoạch trùng vân tay, trùng mã câu, câu chưa duyệt/chưa học/ngoài nhóm — không tạo gì", async () => {
    const t = world.teacherA.client;
    const cls = await newGameClass(t);
    const m = await gameMember(t, cls.id, { burn: 5 });
    const plan = (await realPlan(m))!;
    const flat = plan.encounters.flatMap((e) => e.questions.map((q) => q.exerciseItemId));
    const [dupOfFirst] = await itemIdsOf("fixture:r08:duplicate");
    const [firstOfA] = await itemIdsOf("fixture:r08:letters-a");
    const [unreviewed] = await itemIdsOf("fixture:r08:unreviewed");
    const [notTaught] = await itemIdsOf("fixture:r08:not-yet-taught");
    const none = { runs: 0, encounters: 0, questions: 0 };
    // Cả "câu gốc" lẫn "bản sao nội dung" cùng xuất hiện → trùng vân tay.
    const withBoth = withItem(withItem(plan, 0, firstOfA!), 1, dupOfFirst!);
    expect(errorMessage(await startWith(m, withBoth))).toBe("INSUFFICIENT_CONTENT");
    // Cùng mã câu hai lần.
    expect(errorMessage(await startWith(m, withItem(plan, 20, flat[0]!)))).toBe("INSUFFICIENT_CONTENT");
    // Câu chưa duyệt (in_review) và câu chưa học (bài 3 > bài 2).
    expect(errorMessage(await startWith(m, withItem(plan, 20, unreviewed!)))).toBe("CONTENT_NOT_ELIGIBLE");
    expect(errorMessage(await startWith(m, withItem(plan, 10, notTaught!)))).toBe("CONTENT_NOT_ELIGIBLE");
    // Mã câu không tồn tại.
    expect(errorMessage(await startWith(m, withItem(plan, 5, randomUUID())))).toBe("CONTENT_NOT_ELIGIBLE");
    expect(await counts(m.studentId)).toEqual(none);
    // Kế hoạch đúng vẫn tạo được ngay sau đó → các lần từ chối trước không để lại dấu vết cản trở.
    expect(errorMessage(await startWith(m, plan))).toBeNull();
    expect(await counts(m.studentId)).toEqual({ runs: 1, encounters: 7, questions: 21 });
  }, 120_000);

  it("Nhóm 3 (đến bài trước): câu của bài hiện tại bị từ chối; kế hoạch thật dùng H3 và số lượt theo chính sách", async () => {
    const t = world.teacherA.client;
    const cls = await newGameClass(t, 3);
    const m = await gameMember(t, cls.id, { band: "foundation", burn: 5 });
    const plan = (await realPlan(m))!;
    expect(plan).not.toBeNull();
    for (const e of plan.encounters) {
      for (const q of e.questions) {
        expect(q).toMatchObject({ supportLevel: 3, maxAttempts: SUPPORT_POLICIES[3].maxAttempts });
      }
    }
    const [taughtLast] = await itemIdsOf("fixture:r08:not-yet-taught");
    expect(errorMessage(await startWith(m, withItem(plan, 0, taughtLast!)))).toBe("CONTENT_NOT_ELIGIBLE");

    const lesson2 = await newGameClass(t, 2);
    const g = await gameMember(t, lesson2.id, { band: "foundation", burn: 5 });
    const [bài2] = await itemIdsOf("fixture:r08:letters-c");
    const ids = (await itemIdsOf("fixture:r08:letters-a")).concat(await itemIdsOf("fixture:r08:letters-b"));
    expect(errorMessage(await startWith(g, planFromIds([bài2!, ...ids.slice(0, 20)])))).toBe("CONTENT_NOT_ELIGIBLE");
    expect(await counts(g.studentId)).toEqual({ runs: 0, encounters: 0, questions: 0 });
    expect(errorMessage(await startWith(m, plan))).toBeNull();
  }, 120_000);

  it("nội dung fixture không phát được khi môi trường kiểm thử tắt (như production) — không tạo gì", async () => {
    const t = world.teacherA.client;
    const cls = await newGameClass(t);
    const m = await gameMember(t, cls.id, { burn: 5 });
    const plan = (await realPlan(m))!;
    setTestFixturesAllowed(false);
    try {
      expect(errorMessage(await startWith(m, plan))).toBe("CONTENT_NOT_ELIGIBLE");
      expect(errorMessage(await startWith(m, null))).toBe("INSUFFICIENT_CONTENT");
      expect(await counts(m.studentId)).toEqual({ runs: 0, encounters: 0, questions: 0 });
    } finally {
      setTestFixturesAllowed(true);
    }
  }, 120_000);
});

describe("R08.2 — một giao dịch: lỗi giữa chừng rollback toàn bộ", () => {
  it("lỗi khi thêm câu thứ 21 → không còn lượt, chạm trán hay câu; sau đó tạo bình thường", async () => {
    const t = world.teacherA.client;
    const cls = await newGameClass(t);
    const m = await gameMember(t, cls.id, { burn: 5 });
    const plan = (await realPlan(m))!;
    localSql(
      `create or replace function private.zz_fail_last_question() returns trigger language plpgsql as $f$
      begin
        if (select count(*) from public.question_instances q where q.run_id = new.run_id) = 20 then
          raise exception 'INJECTED_FAILURE' using errcode = '22023';
        end if;
        return new;
      end
      $f$`,
      `create trigger zz_fail_last_question before insert on public.question_instances
        for each row when (new.student_id = '${m.studentId}') execute function private.zz_fail_last_question()`,
    );
    try {
      const failed = await startWith(m, plan);
      expect(errorMessage(failed)).toBe("INJECTED_FAILURE");
      expect(await counts(m.studentId)).toEqual({ runs: 0, encounters: 0, questions: 0 });
      const audit = await admin.from("audit_logs").select("id").eq("action", "game.start").eq("class_id", cls.id);
      expect(audit.data).toEqual([]);
    } finally {
      localSql(
        "drop trigger if exists zz_fail_last_question on public.question_instances",
        "drop function if exists private.zz_fail_last_question()",
      );
    }
    expect((await startWith(m, plan)).error).toBeNull();
    expect(await counts(m.studentId)).toEqual({ runs: 1, encounters: 7, questions: 21 });
  }, 120_000);
});

describe("R08.2 — hai tab, tiếp tục lượt", () => {
  it("4 yêu cầu song song → đúng một lượt; gọi lại trả đúng lượt cũ, không phân bổ lại, không đổi trạng thái", async () => {
    const t = world.teacherA.client;
    const cls = await newGameClass(t);
    const m = await gameMember(t, cls.id, { burn: 5 });
    const plan = (await realPlan(m))!;
    const parallel = await Promise.all([1, 2, 3, 4].map(() => startWith(m, plan)));
    for (const r of parallel) expect(r.error).toBeNull();
    const outcomes = parallel.map((r) => (r.data as { outcome: string }).outcome).sort();
    expect(outcomes).toEqual(["created", "resumed", "resumed", "resumed"]);
    const ids = new Set(parallel.map((r) => runOf(r).id));
    expect(ids.size).toBe(1);
    expect(await counts(m.studentId)).toEqual({ runs: 1, encounters: 7, questions: 21 });
    const runId = [...ids][0]!;
    const snapshot = { enc: await encounterRows(runId), qs: await questionRows(runId) };

    // Lưu một bước rồi tiếp tục: vị trí/phiên bản giữ nguyên; kế hoạch KHÁC cũng không phân bổ lại.
    const save = await admin.rpc("gateway_save_game_position", {
      p_auth_user_id: m.device.id,
      p_student_id: m.studentId,
      p_run_id: runId,
      p_path: [{ row: 1, col: 2 }],
      p_state_version: 1,
    });
    expect(save.error).toBeNull();
    const other = (await realPlan(m, "hat-giong-khac"))!;
    const again = await startWith(m, other);
    expect((again.data as { outcome: string }).outcome).toBe("resumed");
    expect(runOf(again)).toMatchObject({ id: runId, position: { row: 1, col: 2 }, state_version: 2, scored: true });
    expect(await counts(m.studentId)).toEqual({ runs: 1, encounters: 7, questions: 21 });
    const enc = await encounterRows(runId);
    expect(enc.map((e) => [e.id, e.monster_key, e.trigger_key, e.status, e.hp_remaining])).toEqual(
      snapshot.enc.map((e) => [e.id, e.monster_key, e.trigger_key, e.status, e.hp_remaining]),
    );
    expect((await questionRows(runId)).map((q) => [q.id, q.exercise_item_id, q.status])).toEqual(
      snapshot.qs.map((q) => [q.id, q.exercise_item_id, q.status]),
    );
    const score = await admin.from("season_scores").select("balance").eq("student_id", m.studentId).single();
    expect(score.data!.balance).toBe(50);
    // Gọi không kế hoạch cũng chỉ tiếp tục lượt.
    expect(runOf(await startWith(m, null)).id).toBe(runId);
  }, 120_000);

  it("tiếp tục lượt vẫn được khi điểm hiện tại tụt dưới ngưỡng giữa chừng (−5 không khóa học sinh khỏi lượt dở)", async () => {
    const t = world.teacherA.client;
    const cls = await newGameClass(t);
    const m = await gameMember(t, cls.id, { burn: 5 });
    const runId = runOf(await startWith(m, (await realPlan(m))!)).id;
    // Một câu luyện tập sai thật qua gateway: 50 − 5 = 45 điểm hiện tại.
    const fresh = (
      (await candidates(m.device, m.studentId)).data as {
        items: Array<{ exerciseItemId: string; scoredInSeason: boolean }>;
      }
    ).items.find((i) => !i.scoredInSeason)!;
    const session = (await rpcOk(startSession(m.device, m.studentId, planItems([fresh.exerciseItemId])))) as {
      sessionId: string;
    };
    await rpcOk(submit(m.device, (await sessionQuestions(session.sessionId))[0]!.id, "wrong"));
    expect(
      (await admin.from("season_scores").select("balance").eq("student_id", m.studentId).single()).data!.balance,
    ).toBe(45);
    const resumed = await startWith(m, null);
    expect(resumed.error).toBeNull();
    expect(runOf(resumed).id).toBe(runId);
    // Nhưng lượt mới vẫn cần đủ ngưỡng.
    expect(errorMessage(await startWith(m, (await realPlan(m))!, "treasure-maze-02"))).toBe("INSUFFICIENT_POINTS");
  }, 120_000);
});

describe("R08.2 — điều kiện vào chơi", () => {
  it("điểm hiện tại 40 bị từ chối, đúng 50 được vào; không tạo gì khi bị từ chối; không trừ điểm", async () => {
    const t = world.teacherA.client;
    const cls = await newGameClass(t);
    const poor = await gameMember(t, cls.id, { burn: 4 });
    const rich = await gameMember(t, cls.id, { burn: 5 });
    expect(errorMessage(await startWith(poor, (await realPlan(poor))!))).toBe("INSUFFICIENT_POINTS");
    expect(await counts(poor.studentId)).toEqual({ runs: 0, encounters: 0, questions: 0 });
    expect(errorMessage(await startWith(rich, (await realPlan(rich))!))).toBeNull();
    const score = await admin
      .from("season_scores")
      .select("balance, earned_total")
      .eq("student_id", rich.studentId)
      .single();
    expect(score.data).toEqual({ balance: 50, earned_total: 50 });
  }, 120_000);

  it("thiếu đồng ý học tập, thiết bị bị thu hồi, hồ sơ lớp khác, màn không hợp lệ → bị chặn, không tạo gì", async () => {
    const t = world.teacherA.client;
    const cls = await newGameClass(t);
    const other = await newGameClass(t);
    const noConsent = await gameMember(t, cls.id, { consent: false });
    expect(errorMessage(await startWith(noConsent, fakePlan()))).toBe("CONSENT_REQUIRED");

    const revoked = await gameMember(t, cls.id, { burn: 5 });
    const plan = (await realPlan(revoked))!;
    const deviceRow = await admin.from("student_devices").select("id").eq("student_id", revoked.studentId).single();
    await rpcOk(t.rpc("teacher_revoke_device", { p_device_id: deviceRow.data!.id }));
    expect(errorMessage(await startWith(revoked, plan))).toBe("FORBIDDEN");

    const a = await gameMember(t, cls.id, { burn: 5 });
    const b = await gameMember(t, other.id, { burn: 5 });
    // Thiết bị của A không bắt đầu lượt cho học sinh B (cùng giáo viên, khác lớp) và ngược lại.
    expect(errorMessage(await startWith(a, (await realPlan(b))!, LEVEL, b.studentId))).toBe("FORBIDDEN");
    expect(errorMessage(await startWith(b, (await realPlan(a))!, LEVEL, a.studentId))).toBe("FORBIDDEN");
    expect(errorMessage(await startWith(a, fakePlan(), "treasure-maze-04"))).toBe("INVALID_INPUT");
    expect(errorMessage(await startWith(a, fakePlan(), "x'; drop table game_runs;--"))).toBe("INVALID_INPUT");
    for (const mem of [noConsent, revoked, a, b]) {
      expect(await counts(mem.studentId)).toEqual({ runs: 0, encounters: 0, questions: 0 });
    }
    // Hồ sơ giả ở tầng ứng dụng vẫn bị CSDL từ chối.
    const spoof = await startGameRun({ ...ctx(a), students: ctx(b).students }, b.studentId, LEVEL);
    expect(spoof.ok).toBe(false);
  }, 180_000);

  it("kế hoạch sai hình dạng (6 chạm trán, 2 câu, mã quái vật trùng, mức hỗ trợ lạ) → INVALID_INPUT", async () => {
    const t = world.teacherA.client;
    const cls = await newGameClass(t);
    const m = await gameMember(t, cls.id, { burn: 5 });
    const plan = (await realPlan(m))!;
    const six = { encounters: plan.encounters.slice(0, 6) };
    const eight = { encounters: [...plan.encounters, plan.encounters[0]!] };
    const twoQuestions = structuredClone(plan);
    twoQuestions.encounters[3]!.questions.pop();
    const fourQuestions = structuredClone(plan);
    fourQuestions.encounters[3]!.questions.push(fourQuestions.encounters[3]!.questions[0]!);
    const dupMonster = structuredClone(plan);
    dupMonster.encounters[1]!.monsterKey = dupMonster.encounters[0]!.monsterKey;
    const badSupport = structuredClone(plan) as unknown as {
      encounters: Array<{ questions: Array<{ supportLevel: number }> }>;
    };
    badSupport.encounters[0]!.questions[0]!.supportLevel = 9;
    for (const bad of [six, eight, twoQuestions, fourQuestions, dupMonster, badSupport]) {
      expect(errorMessage(await startWith(m, bad as unknown as GameRunPlan))).toBe("INVALID_INPUT");
    }
    expect(await counts(m.studentId)).toEqual({ runs: 0, encounters: 0, questions: 0 });
    // Chạm trán thứ tám vẫn không thể có ở tầng bảng (R08.1): kế hoạch hợp lệ chỉ ra đúng 7.
    expect(errorMessage(await startWith(m, plan))).toBeNull();
    expect(await encounterRows(runOf(await startWith(m, null)).id)).toHaveLength(7);
  }, 120_000);
});

describe("R08.2 — chống cày điểm và quyền riêng tư", () => {
  it("21 câu của lượt đã 'giữ chỗ' nội dung trong mùa: luyện tập không tính điểm lại, ứng viên đánh dấu đã tính điểm", async () => {
    const t = world.teacherA.client;
    const cls = await newGameClass(t);
    const m = await gameMember(t, cls.id, { burn: 5 });
    const plan = (await realPlan(m))!;
    expect((await startWith(m, plan)).error).toBeNull();
    const list = (
      (await candidates(m.device, m.studentId)).data as {
        items: Array<{ exerciseItemId: string; scoredInSeason: boolean }>;
      }
    ).items;
    const gameIds = new Set(plan.encounters.flatMap((e) => e.questions.map((q) => q.exerciseItemId)));
    expect(list.filter((i) => gameIds.has(i.exerciseItemId)).every((i) => i.scoredInSeason)).toBe(true);
    // Chỉ còn 32 − 5 − 21 = 6 nội dung mới → không thể lập kế hoạch thứ hai cho màn khác.
    expect(list.filter((i) => !i.scoredInSeason)).toHaveLength(6);
    expect(await realPlan(m, "man-khac")).toBeNull();
    expect(errorMessage(await startWith(m, null, "treasure-maze-02"))).toBe("INSUFFICIENT_CONTENT");
  }, 120_000);

  it("DTO dịch vụ và đọc trực tiếp của thiết bị không lộ đáp án, điểm kích hoạt, quái vật, mã học sinh/lớp/mùa", async () => {
    const t = world.teacherA.client;
    const cls = await newGameClass(t);
    const m = await gameMember(t, cls.id, { burn: 5 });
    const created = await startGameRun(ctx(m), m.studentId, LEVEL);
    if (!created.ok) throw new Error(`không tạo được lượt: ${created.code}`);
    expect(created.data.outcome).toBe("created");
    expect(created.data.run.scored).toBe(true);
    const text = JSON.stringify(created);
    const season = await activeSeason(cls.id);
    for (const secret of [
      m.studentId,
      cls.id,
      season,
      "monster",
      "mon-",
      "trigger",
      "tm01-",
      "answer",
      "reveal",
      "exercise",
      "encounter",
    ]) {
      expect(text).not.toContain(secret);
    }
    const resumed = await startGameRun(ctx(m), m.studentId, LEVEL);
    expect(resumed.ok && resumed.data.outcome).toBe("resumed");
    expect(resumed.ok && resumed.data.run.id).toBe(created.data.run.id);

    // Thiết bị (JWT thật) không đọc được câu phát hành, dòng chạm trán chưa kích hoạt; chỉ thấy lượt của chính mình.
    const device = m.device.client;
    expect((await device.from("question_instances").select("id")).data ?? []).toEqual([]);
    expect((await device.from("game_encounters").select("id")).data ?? []).toEqual([]);
    const ownRuns = await device.from("game_runs").select("id, scored");
    expect(ownRuns.data).toEqual([{ id: created.data.run.id, scored: true }]);
  }, 120_000);

  it("không có đường cho client sửa kết quả: authenticated không ghi được bảng game, không gọi được hàm bắt đầu", async () => {
    const t = world.teacherA.client;
    const cls = await newGameClass(t);
    const m = await gameMember(t, cls.id, { burn: 5 });
    const plan = (await realPlan(m))!;
    const viaDevice = await m.device.client.rpc("gateway_start_game_run", {
      p_auth_user_id: m.device.id,
      p_student_id: m.studentId,
      p_game_key: "treasure_maze",
      p_level_key: LEVEL,
      p_plan: plan as never,
    });
    expect(viaDevice.error).not.toBeNull();
    const direct = await m.device.client.from("game_encounters").insert({
      run_id: randomUUID(),
      student_id: m.studentId,
      class_id: cls.id,
      season_id: randomUUID(),
      encounter_no: 1,
      trigger_key: "tm01-t1",
      monster_key: "mon-x",
    });
    expect(direct.error).not.toBeNull();
    expect(await counts(m.studentId)).toEqual({ runs: 0, encounters: 0, questions: 0 });
  }, 120_000);
});

describe("R08.2 — reset mùa", () => {
  it("reset sau khi tạo lượt: lượt, chạm trán, câu đều void; mùa mới không kế thừa; bắt đầu lại cần điểm mới", async () => {
    const t = world.teacherA.client;
    const cls = await newGameClass(t);
    const m = await gameMember(t, cls.id, { burn: 5 });
    const run = runOf(await startWith(m, (await realPlan(m))!));
    const season1 = await activeSeason(cls.id);
    const reset = await t.rpc("teacher_reset_season", {
      p_class_id: cls.id,
      p_request_id: randomUUID(),
      p_expected_season_id: season1,
      p_confirmation: cls.name,
    });
    expect(reset.error).toBeNull();
    expect((await admin.from("game_runs").select("status").eq("id", run.id).single()).data!.status).toBe(
      "void_season_reset",
    );
    expect((await encounterRows(run.id)).every((e) => e.status === "void")).toBe(true);
    expect((await questionRows(run.id)).every((q) => q.status === "void")).toBe(true);
    expect(errorMessage(await startWith(m, (await realPlan(m))!))).toBe("INSUFFICIENT_POINTS");
  }, 120_000);

  it("bắt đầu và reset chạy đồng thời: không deadlock, không để lại chạm trán/câu mở ở mùa đã đóng", async () => {
    const t = world.teacherA.client;
    for (let round = 0; round < 3; round++) {
      const cls = await newGameClass(t);
      const m = await gameMember(t, cls.id, { burn: 5 });
      const plan = (await realPlan(m))!;
      const season1 = await activeSeason(cls.id);
      const ledgerBefore = await admin.from("point_events").select("id").eq("season_id", season1);
      const [start, reset] = await Promise.all([
        startWith(m, plan),
        t.rpc("teacher_reset_season", {
          p_class_id: cls.id,
          p_request_id: randomUUID(),
          p_expected_season_id: season1,
          p_confirmation: cls.name,
        }),
      ]);
      expect(reset.error).toBeNull();
      const season2 = await activeSeason(cls.id); // reset luôn đóng mùa cũ và mở đúng MỘT mùa mới
      expect(season2).not.toBe(season1);
      // Kết cục của lần bắt đầu phụ thuộc thứ tự giao dịch; chỉ có BA kết cục hợp lệ:
      //  - thành công: start xong trước, reset sau đó void lượt (vòng lặp bên dưới kiểm);
      //  - SEASON_CLOSED: reset xong trong lúc start đợi khóa `for share` → mùa cũ không còn `active`;
      //  - INSUFFICIENT_POINTS: reset đã commit TRƯỚC khi start đọc mùa → start thấy mùa MỚI (điểm 0 < ngưỡng), đúng như
      //    bắt đầu lượt sau reset ở kịch bản tuần tự phía trên. Mã này chỉ hợp lệ khi điểm mùa mới thật sự dưới ngưỡng.
      if (start.error) {
        const code = errorMessage(start);
        expect(["SEASON_CLOSED", "INSUFFICIENT_POINTS"]).toContain(code);
        if (code === "INSUFFICIENT_POINTS") {
          const score = await admin
            .from("season_scores")
            .select("balance")
            .eq("season_id", season2)
            .eq("student_id", m.studentId);
          expect((score.data ?? []).every((row) => row.balance === 0)).toBe(true);
        }
      }
      // Bất biến cho MỌI kết cục: mùa mới không nhận lượt/chạm trán/câu/điểm nào từ lần bắt đầu này, mùa cũ không bị ghi điểm.
      expect((await admin.from("game_runs").select("id").eq("season_id", season2)).data).toEqual([]);
      expect((await admin.from("game_encounters").select("id").eq("season_id", season2)).data).toEqual([]);
      expect((await admin.from("question_instances").select("id").eq("season_id", season2)).data).toEqual([]);
      expect((await admin.from("point_events").select("id").eq("season_id", season2)).data).toEqual([]);
      expect((await admin.from("point_events").select("id").eq("season_id", season1)).data).toHaveLength(
        ledgerBefore.data!.length,
      );
      const runs = await admin.from("game_runs").select("id, status, season_id").eq("student_id", m.studentId);
      for (const r of runs.data!) {
        expect(r.status).toBe("void_season_reset");
        expect((await encounterRows(r.id)).every((e) => e.status === "void")).toBe(true);
        expect((await questionRows(r.id)).every((q) => q.status === "void")).toBe(true);
      }
      const open = await admin.from("question_instances").select("id").eq("season_id", season1).eq("status", "open");
      expect(open.data).toEqual([]);
      const pending = await admin
        .from("game_encounters")
        .select("id")
        .eq("season_id", season1)
        .in("status", ["pending", "active"]);
      expect(pending.data).toEqual([]);
    }
  }, 240_000);
});

describe("R08.2 — hằng số và hồi quy", () => {
  it("mỗi lượt đúng 7 × 3 = 21 và R04/R07 không bị phá: ghi điểm luyện tập, lưu vị trí, ngưỡng vẫn hoạt động", async () => {
    expect(GAME_QUESTION_COUNT).toBe(21);
    const t = world.teacherA.client;
    const cls = await newGameClass(t);
    const m = await gameMember(t, cls.id, { burn: 5 });
    const run = runOf(await startWith(m, (await realPlan(m))!));
    // R07: lưu vị trí tới ô kích hoạt đầu tiên (dừng ở đó) vẫn được; đi tiếp xuyên qua nó bị chặn (R08.1).
    const walk = await admin.rpc("gateway_save_game_position", {
      p_auth_user_id: m.device.id,
      p_student_id: m.studentId,
      p_run_id: run.id,
      p_path: [
        { row: 1, col: 2 },
        { row: 1, col: 3 },
        { row: 1, col: 4 },
      ],
      p_state_version: 1,
    });
    expect(walk.error).toBeNull();
    const past = await admin.rpc("gateway_save_game_position", {
      p_auth_user_id: m.device.id,
      p_student_id: m.studentId,
      p_run_id: run.id,
      p_path: [{ row: 1, col: 5 }],
      p_state_version: 2,
    });
    expect(errorMessage(past)).not.toBeNull();
    // R04: bảng điểm giữ nguyên.
    const score = await admin
      .from("season_scores")
      .select("balance, earned_total, deducted_total")
      .eq("student_id", m.studentId)
      .single();
    expect(score.data).toEqual({ balance: 50, earned_total: 50, deducted_total: 0 });
  }, 120_000);
});
