import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { setLocalGameRunFixtures } from "../../scripts/lib/test-fixtures";
import { planGameRun, type GameRunPlan } from "../../src/features/game-runs/planner";
import type { PracticeCandidate } from "../../src/features/scored-practice/planner";
import type { Json } from "../../src/lib/supabase/database.types";
import { getEncounterState } from "@/server/game-runs/encounters";
import { hasLevelProgress } from "@/server/game-runs/student";
import { getQuestion } from "@/server/question-instances/service";
import type { StudentContext } from "@/server/student-gateway/context";
import type { Mem } from "./board-helpers";
import { admin, buildWorld, rpcOk, type World } from "./helpers";
import { gameFixtures, gameMember, LEVEL, newGameClass, realPlan, runOf, startWith } from "./game-helpers";
import { candidates, errorMessage, ledger, scoreRow, setTestFixturesAllowed, submit } from "./scoring-helpers";

/**
 * R08.6 — chơi lại Mê cung KHÔNG tính điểm trên Supabase LOCAL (JWT thật, nội dung fixture hư cấu của game):
 * điều kiện mở, phân bổ 7 × 3 câu GAME_REPLAY, điểm tuyệt đối không đổi, HP, kho báu, đồng thời, reset mùa, quyền truy cập.
 */

type Pos = { row: number; col: number };
type Game = { mem: Mem; runId: string; version: number; classId: string; className: string };
type Enc = { id: string; encounter_no: number; status: string; hp_remaining: number };
type Question = { id: string; position: number; game_encounter_id: string | null; status: string };
type Attempt = {
  outcome: string;
  points: unknown;
  question: { status: string };
  encounter: { status: string; hpRemaining: number } | null;
  score: { balance: number; earnedTotal: number; deductedTotal: number };
  newlyUnlockedGames: string[];
};

let world: World;

const p = (row: number, col: number): Pos => ({ row, col });
const ROUTE = {
  t1: [p(1, 2), p(1, 3), p(1, 4)],
  t2: [p(1, 5), p(1, 6), p(1, 7), p(2, 7)],
  t3: [p(3, 7), p(4, 7), p(5, 7), p(5, 6)],
  t4: [p(5, 5), p(4, 5), p(3, 5)],
  t5: [p(3, 4), p(3, 3), p(3, 2)],
  t6: [p(3, 1), p(4, 1), p(5, 1), p(6, 1)],
  t7: [p(7, 1), p(7, 2), p(7, 3), p(7, 4), p(7, 5)],
  backToTreasure: [p(7, 4), p(7, 3), p(7, 2), p(7, 1)],
} as const;
const TRIGGER_ROUTES = [ROUTE.t1, ROUTE.t2, ROUTE.t3, ROUTE.t4, ROUTE.t5, ROUTE.t6, ROUTE.t7] as const;

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

const savePath = (g: Game, path: readonly Pos[], version = g.version) =>
  admin.rpc("gateway_save_game_position", {
    p_auth_user_id: g.mem.device.id,
    p_student_id: g.mem.studentId,
    p_run_id: g.runId,
    p_path: [...path],
    p_state_version: version,
  });
async function go(g: Game, path: readonly Pos[]) {
  const result = await savePath(g, path);
  expect(errorMessage(result)).toBeNull();
  g.version = (result.data as { state_version: number }).state_version;
}
const activate = (g: Game, mem = g.mem, studentId = g.mem.studentId) =>
  admin.rpc("gateway_activate_encounter", {
    p_auth_user_id: mem.device.id,
    p_student_id: studentId,
    p_run_id: g.runId,
  });
const openChest = (g: Game, mem = g.mem) =>
  admin.rpc("gateway_open_treasure", { p_auth_user_id: mem.device.id, p_student_id: mem.studentId, p_run_id: g.runId });

const encounters = async (runId: string) =>
  (await admin.from("game_encounters").select("*").eq("run_id", runId).order("encounter_no")).data as Enc[];
const questionsOf = async (runId: string) =>
  (await admin.from("question_instances").select("*").eq("run_id", runId).order("position")).data as Question[];
async function threeOf(runId: string, no: number): Promise<string[]> {
  const enc = (await encounters(runId)).find((e) => e.encounter_no === no)!;
  return (await questionsOf(runId)).filter((q) => q.game_encounter_id === enc.id).map((q) => q.id);
}
async function answer(g: Game, questionId: string, pick: string, attemptId?: string): Promise<Attempt> {
  return (await rpcOk(submit(g.mem.device, questionId, pick, attemptId))) as unknown as Attempt;
}

const snapshot = async (mem: Mem) => ({
  score: (await scoreRow(mem.studentId)).map(({ balance, earned_total, deducted_total }) => ({
    balance,
    earned_total,
    deducted_total,
  })),
  events: (await ledger(mem.studentId)).length,
  unlocks: (await admin.from("game_unlocks").select("game_key").eq("student_id", mem.studentId)).data!.length,
});

/** Lượt tính điểm mới (lớp riêng, 11 câu đã luyện, kế hoạch thật). */
async function newScored(): Promise<Game> {
  const t = world.teacherA.client;
  const cls = await newGameClass(t);
  const mem = await gameMember(t, cls.id, { burn: 11 });
  const plan = (await realPlan(mem, `r86-${randomUUID()}`))!;
  const started = await startWith(mem, plan);
  expect(errorMessage(started)).toBeNull();
  const run = runOf(started);
  return { mem, runId: run.id, version: run.state_version, classId: cls.id, className: cls.name };
}

/** Chơi hết 7 chạm trán toàn đúng rồi mở kho báu (lượt tính điểm hoặc chơi lại). */
async function finish(g: Game) {
  for (const [i, route] of TRIGGER_ROUTES.entries()) {
    await go(g, route);
    expect(errorMessage(await activate(g))).toBeNull();
    for (const q of await threeOf(g.runId, i + 1)) await answer(g, q, "correct");
  }
  await go(g, ROUTE.backToTreasure);
  const opened = await openChest(g);
  expect(errorMessage(opened)).toBeNull();
  return opened.data as { outcome: string; treasure: { defeated: number; undefeated: number } };
}

/** Kế hoạch chơi lại như student gateway lập (cùng hàm thuần, `replay: true`). */
async function replayPlan(mem: Mem, seed: string): Promise<GameRunPlan> {
  const result = await candidates(mem.device, mem.studentId);
  const payload = result.data as unknown as {
    band: "foundation" | "developing" | "extending";
    items: PracticeCandidate[];
  };
  const plan = planGameRun(payload.items, { band: payload.band, seed, replay: true });
  expect(plan).not.toBeNull();
  // Mức hỗ trợ H1 (tối đa 2 lượt/câu, 3 phương án): hai lần sai thì câu hết lượt — kiểm thử được cả nhánh undefeated.
  return {
    encounters: plan!.encounters.map((e) => ({
      monsterKey: e.monsterKey,
      questions: e.questions.map((q) => ({ ...q, supportLevel: 1 as const, maxAttempts: 2 })),
    })),
  };
}

const startReplay = (mem: Mem, plan: GameRunPlan | null, level = LEVEL) =>
  admin.rpc("gateway_start_game_run", {
    p_auth_user_id: mem.device.id,
    p_student_id: mem.studentId,
    p_game_key: "treasure_maze",
    p_level_key: level,
    ...(plan ? { p_plan: plan as unknown as Json } : {}),
    p_replay: true,
  });

async function newReplay(g: Game, seed = `replay-${randomUUID()}`): Promise<Game> {
  const started = await startReplay(g.mem, await replayPlan(g.mem, seed));
  expect(errorMessage(started)).toBeNull();
  expect((started.data as { outcome: string }).outcome).toBe("created");
  const run = runOf(started);
  return { ...g, runId: run.id, version: run.state_version };
}

const seasonOf = async (classId: string) =>
  (await admin.from("seasons").select("id").eq("class_id", classId).eq("status", "active").single()).data!.id;

beforeAll(async () => {
  await gameFixtures();
  setLocalGameRunFixtures(false);
  world = await buildWorld();
}, 180_000);
afterAll(() => {
  setLocalGameRunFixtures(false);
  setTestFixturesAllowed(true);
});

describe("R08.6 — điều kiện mở chơi lại", () => {
  it("chưa từng hoàn thành màn → REPLAY_NOT_AVAILABLE, không tạo gì; lượt tính điểm đang dở được trả lại nguyên vẹn", async () => {
    const t = world.teacherA.client;
    const cls = await newGameClass(t);
    const mem = await gameMember(t, cls.id, { burn: 11 });
    const before = await snapshot(mem);
    expect(errorMessage(await startReplay(mem, await replayPlan(mem, "chua-xong")))).toBe("REPLAY_NOT_AVAILABLE");
    expect((await admin.from("game_runs").select("id").eq("student_id", mem.studentId)).data).toEqual([]);

    // Có lượt tính điểm đang dở: bấm "Chơi lại" chỉ trả lại ĐÚNG lượt đó (không tạo lượt chơi lại, không mở khóa).
    const scoredStart = await startWith(mem, await realPlan(mem, "dang-do"));
    const scoredRun = runOf(scoredStart);
    const asked = await startReplay(mem, await replayPlan(mem, "dang-do-2"));
    expect(errorMessage(asked)).toBeNull();
    expect(asked.data).toMatchObject({ outcome: "resumed", run: { id: scoredRun.id, scored: true, replay: false } });
    expect((await admin.from("game_runs").select("id").eq("student_id", mem.studentId)).data).toHaveLength(1);
    expect(await snapshot(mem)).toEqual(before);
  }, 240_000);

  it("chơi lại không có đường fixture và không đi vòng ngưỡng điểm của lượt tính điểm", async () => {
    const t = world.teacherA.client;
    const cls = await newGameClass(t);
    const poor = await gameMember(t, cls.id, { burn: 2 });
    setLocalGameRunFixtures(true);
    try {
      expect(errorMessage(await startReplay(poor, null))).toBe("REPLAY_NOT_AVAILABLE");
    } finally {
      setLocalGameRunFixtures(false);
    }
    // Bắt đầu lượt tính điểm khi chưa đủ điểm vẫn bị chặn như R07/R08.2.
    expect(errorMessage(await startWith(poor, await realPlan(poor, "thieu-diem")))).toBe("INSUFFICIENT_POINTS");
  }, 240_000);
});

describe("R08.6 — lượt chơi lại: cấu trúc, điểm tuyệt đối không đổi, HP", () => {
  let scored: Game;
  let replay: Game;
  let firstRun: Record<string, unknown>;
  let firstEncounters: Enc[];
  let before: Awaited<ReturnType<typeof snapshot>>;

  beforeAll(async () => {
    scored = await newScored();
    const done = await finish(scored);
    expect(done.outcome).toBe("opened");
    expect(done.treasure).toMatchObject({ defeated: 7, undefeated: 0 });
    firstRun = (await admin.from("game_runs").select("*").eq("id", scored.runId).single()).data!;
    firstEncounters = await encounters(scored.runId);
    before = await snapshot(scored.mem);
    replay = await newReplay(scored, "r86-cau-truc");
  }, 300_000);

  it("chơi lại là lượt riêng; mở trang (đường tính điểm) khi đang chơi lại trả đúng lượt chơi lại, không tạo lượt tính điểm", async () => {
    const reopen = await startWith(scored.mem, await realPlan(scored.mem, "mo-lai"));
    expect(errorMessage(reopen)).toBeNull();
    expect(reopen.data).toMatchObject({ outcome: "resumed", run: { id: replay.runId, scored: false, replay: true } });
    const rows = (await admin.from("game_runs").select("*").eq("student_id", scored.mem.studentId)).data!;
    expect(rows).toHaveLength(2);
    expect(rows.find((r) => r.id === replay.runId)).toMatchObject({
      scored: false,
      is_replay: true,
      status: "in_progress",
      encounter_count: 7,
    });
    expect(rows.find((r) => r.id === scored.runId)).toMatchObject({
      scored: true,
      is_replay: false,
      status: "completed",
    });
  });

  it("đúng 7 chạm trán × 3 câu GAME_REPLAY, khác nhau cả mã câu lẫn vân tay; chạm trán pending 3 HP", async () => {
    const encs = await encounters(replay.runId);
    expect(encs).toHaveLength(7);
    expect(encs.every((e) => e.status === "pending" && e.hp_remaining === 3)).toBe(true);
    const qs = (await admin.from("question_instances").select("*").eq("run_id", replay.runId)).data!;
    expect(qs).toHaveLength(21);
    expect(qs.every((q) => !q.scorable && q.not_scorable_reason === "GAME_REPLAY" && q.status === "open")).toBe(true);
    expect(new Set(qs.map((q) => q.exercise_item_id)).size).toBe(21);
    expect(new Set(qs.map((q) => q.content_fingerprint)).size).toBe(21);
    for (const e of encs)
      expect(
        qs
          .filter((q) => q.game_encounter_id === e.id)
          .map((q) => q.position)
          .sort(),
      ).toEqual([1, 2, 3]);
  });

  it("dùng lại được câu từng tính điểm (chỉ ở chế độ này); lượt tính điểm cũ nguyên vẹn", async () => {
    const replayFingerprints = new Set(
      (await admin.from("question_instances").select("content_fingerprint").eq("run_id", replay.runId)).data!.map(
        (q) => q.content_fingerprint,
      ),
    );
    const scoredFingerprints = (
      await admin.from("question_instances").select("content_fingerprint").eq("run_id", scored.runId)
    ).data!.map((q) => q.content_fingerprint);
    expect(scoredFingerprints.some((f) => replayFingerprints.has(f))).toBe(true);
    expect((await admin.from("game_runs").select("*").eq("id", scored.runId).single()).data).toEqual(firstRun);
    expect(await encounters(scored.runId)).toEqual(firstEncounters);
  });

  it("không có thao tác nào đổi điểm: kích hoạt/vào câu, đúng giảm HP, sai giữ HP, thử lại không giảm lần hai", async () => {
    await go(replay, ROUTE.t1);
    expect(errorMessage(await activate(replay))).toBeNull();
    const [q1, q2, q3] = (await threeOf(replay.runId, 1)) as [string, string, string];

    // scorable = false KHÔNG bỏ qua kiểm tra thứ tự: câu 2 trước câu 1 → QUESTION_NOT_CURRENT.
    expect(errorMessage(await submit(replay.mem.device, q2, "correct"))).toBe("QUESTION_NOT_CURRENT");
    expect(await snapshot(replay.mem)).toEqual(before);

    const wrong = await answer(replay, q1, "wrong");
    expect(wrong.points).toBeNull();
    expect(wrong.encounter).toMatchObject({ status: "active", hpRemaining: 3 });
    expect(wrong.score.balance).toBe(before.score[0]!.balance);
    expect(await snapshot(replay.mem)).toEqual(before);

    const attemptId = randomUUID();
    const right = await answer(replay, q1, "correct", attemptId);
    expect(right.points).toBeNull();
    expect(right.question.status).toBe("correct");
    expect(right.encounter).toMatchObject({ status: "active", hpRemaining: 2 });
    expect(right.newlyUnlockedGames).toEqual([]);
    const retry = await answer(replay, q1, "correct", attemptId);
    expect(retry.outcome).toBe("replayed");
    expect(retry.encounter).toMatchObject({ hpRemaining: 2 });
    expect(await snapshot(replay.mem)).toEqual(before);

    expect((await answer(replay, q2, "correct")).encounter).toMatchObject({ hpRemaining: 1 });
    const last = await answer(replay, q3, "correct");
    expect(last.encounter).toMatchObject({ status: "defeated", hpRemaining: 0 });
    expect(await snapshot(replay.mem)).toEqual(before);
    // Không có dòng sổ cái nào cho câu của lượt chơi lại; lượt trả lời ghi scorable = false.
    const eventsOfReplay = await admin.from("point_events").select("id").in("question_instance_id", [q1, q2, q3]);
    expect(eventsOfReplay.data).toEqual([]);
    const attempts = (await admin.from("item_attempts").select("scorable").in("question_instance_id", [q1, q2, q3]))
      .data!;
    expect(attempts.length).toBeGreaterThanOrEqual(4);
    expect(attempts.every((a) => a.scorable === false)).toBe(true);
  }, 240_000);

  it("chạm trán hết lượt mà HP > 0 → undefeated; không câu thứ tư; điểm không đổi", async () => {
    await go(replay, ROUTE.t2);
    expect(errorMessage(await activate(replay))).toBeNull();
    const qs = await threeOf(replay.runId, 2);
    for (const q of qs) {
      await answer(replay, q, "wrong");
      expect((await answer(replay, q, "wrong2")).question.status).toBe("exhausted");
    }
    const row = (await encounters(replay.runId)).find((e) => e.encounter_no === 2)!;
    expect(row).toMatchObject({ status: "undefeated", hp_remaining: 3 });
    expect(await snapshot(replay.mem)).toEqual(before);
  }, 240_000);
});

describe("R08.6 — hoàn thành lượt chơi lại, chơi tiếp, kho báu", () => {
  it("kho báu chỉ mở khi đủ 7/7, không cộng điểm; gửi lại → replayed; chơi lại tiếp được lượt mới", async () => {
    const scored = await newScored();
    await finish(scored);
    const before = await snapshot(scored.mem);
    const replay = await newReplay(scored, "r86-kho-bau");

    // Chưa đứng ở ô rương: không mở.
    await go(replay, ROUTE.t1);
    expect(errorMessage(await activate(replay))).toBeNull();
    for (const q of await threeOf(replay.runId, 1)) await answer(replay, q, "correct");
    expect(errorMessage(await openChest(replay))).toBe("NOT_AT_TREASURE");
    for (const [i, route] of TRIGGER_ROUTES.slice(1).entries()) {
      await go(replay, route);
      expect(errorMessage(await activate(replay))).toBeNull();
      if (i === 5) {
        // Chạm trán cuối đang diễn ra mà thử mở rương ở ô rương: ENCOUNTERS_INCOMPLETE / NOT_AT_TREASURE (chưa đủ 7/7).
        expect(errorMessage(await openChest(replay))).toBe("NOT_AT_TREASURE");
      }
      for (const q of await threeOf(replay.runId, i + 2)) await answer(replay, q, "correct");
    }
    await go(replay, ROUTE.backToTreasure);
    const opened = await openChest(replay);
    expect(opened.data).toMatchObject({
      outcome: "opened",
      treasure: { status: "completed", defeated: 7, undefeated: 0 },
    });
    expect((await openChest(replay)).data).toMatchObject({ outcome: "replayed" });
    expect(await snapshot(scored.mem)).toEqual(before);
    // Lượt tính điểm đã xong không bao giờ mở lại thành lượt tính điểm, kể cả khi không còn lượt nào đang dở.
    expect(errorMessage(await startWith(scored.mem, await realPlan(scored.mem, "mo-lai-2")))).toBe("RUN_NOT_ACTIVE");

    const run = (await admin.from("game_runs").select("*").eq("id", replay.runId).single()).data!;
    expect(run).toMatchObject({ status: "completed", scored: false, is_replay: true });

    // Có thể chơi lại tiếp: lượt MỚI, id khác, vẫn không tính điểm.
    const again = await newReplay(scored, "r86-lan-hai");
    expect(again.runId).not.toBe(replay.runId);
    expect((await admin.from("game_runs").select("id").eq("student_id", scored.mem.studentId)).data).toHaveLength(3);
    expect(await snapshot(scored.mem)).toEqual(before);
  }, 360_000);

  it("kho báu của lượt chơi lại khi mới 6/7 → ENCOUNTERS_INCOMPLETE", async () => {
    const scored = await newScored();
    await finish(scored);
    const replay = await newReplay(scored, "r86-6-7");
    for (const [i, route] of TRIGGER_ROUTES.slice(0, 6).entries()) {
      await go(replay, route);
      expect(errorMessage(await activate(replay))).toBeNull();
      for (const q of await threeOf(replay.runId, i + 1)) await answer(replay, q, "correct");
    }
    await go(replay, [p(7, 1)]);
    expect(errorMessage(await openChest(replay))).toBe("ENCOUNTERS_INCOMPLETE");
    expect((await admin.from("game_runs").select("status").eq("id", replay.runId).single()).data?.status).toBe(
      "in_progress",
    );
  }, 360_000);
});

describe("R08.6 — đồng thời, khôi phục, quyền truy cập, reset mùa", () => {
  it("hai tab cùng bấm Chơi lại chỉ tạo một lượt; bấm lại khi đang dở trả đúng lượt đó với vị trí/HP/câu giữ nguyên", async () => {
    const scored = await newScored();
    await finish(scored);
    const plan = await replayPlan(scored.mem, "r86-hai-tab");
    const [a, b] = await Promise.all([startReplay(scored.mem, plan), startReplay(scored.mem, plan)]);
    expect(errorMessage(a)).toBeNull();
    expect(errorMessage(b)).toBeNull();
    expect(runOf(a).id).toBe(runOf(b).id);
    expect([a, b].map((r) => (r.data as { outcome: string }).outcome).sort()).toEqual(["created", "resumed"]);
    const active = (
      await admin.from("game_runs").select("id").eq("student_id", scored.mem.studentId).eq("status", "in_progress")
    ).data!;
    expect(active).toHaveLength(1);
    expect(await questionsOf(runOf(a).id)).toHaveLength(21);

    const g: Game = { ...scored, runId: runOf(a).id, version: runOf(a).state_version };
    await go(g, ROUTE.t1);
    expect(errorMessage(await activate(g))).toBeNull();
    const [q1] = await threeOf(g.runId, 1);
    await answer(g, q1!, "correct");
    // Tải lại / mất mạng rồi bấm lại: cùng lượt, cùng vị trí, chạm trán còn HP 2, kích hoạt lại là 'resumed'.
    const reopened = await startReplay(scored.mem, plan);
    expect(reopened.data).toMatchObject({ outcome: "resumed", run: { id: g.runId, replay: true, scored: false } });
    expect((await activate(g)).data).toMatchObject({ outcome: "resumed", encounter: { hpRemaining: 2 } });
    const state = await getEncounterState(ctx(g.mem), g.runId);
    expect(state.ok && state.data.encounter?.hpRemaining).toBe(2);
    expect(JSON.stringify(state)).not.toMatch(/student_id|class_id|season_id|"answer"|return_position|trigger/);
    // Câu đang mở không lộ đáp án; câu sau chưa đọc được.
    const [, q2, q3] = await threeOf(g.runId, 1);
    expect((await getQuestion(ctx(g.mem), q2!)).ok).toBe(true);
    expect((await getQuestion(ctx(g.mem), q3!)).ok).toBe(false);
  }, 360_000);

  it("thiết bị/học sinh khác, thiết bị bị thu hồi → bị chặn", async () => {
    const t = world.teacherA.client;
    const scored = await newScored();
    await finish(scored);
    const replay = await newReplay(scored, "r86-quyen");
    await go(replay, ROUTE.t1);
    const [q1] = await threeOf(replay.runId, 1);
    const stranger = await gameMember(t, scored.classId);
    expect(errorMessage(await activate(replay, stranger, replay.mem.studentId))).toBe("FORBIDDEN");
    expect(errorMessage(await activate(replay, stranger, stranger.studentId))).toBe("NOT_FOUND");
    expect(errorMessage(await openChest(replay, stranger))).toBe("NOT_FOUND");
    expect(errorMessage(await submit(stranger.device, q1!, "correct"))).toBe("FORBIDDEN");
    // Học sinh khác không bắt đầu được lượt chơi lại bằng thiết bị của bạn.
    expect(
      errorMessage(
        await admin.rpc("gateway_start_game_run", {
          p_auth_user_id: stranger.device.id,
          p_student_id: replay.mem.studentId,
          p_game_key: "treasure_maze",
          p_level_key: LEVEL,
          p_replay: true,
        }),
      ),
    ).toBe("FORBIDDEN");
    expect(errorMessage(await startReplay(stranger, await replayPlan(stranger, "x")))).toBe("REPLAY_NOT_AVAILABLE");
    const deviceRow = await admin.from("student_devices").select("id").eq("student_id", replay.mem.studentId).single();
    await rpcOk(t.rpc("teacher_revoke_device", { p_device_id: deviceRow.data!.id }));
    expect(errorMessage(await activate(replay))).toBe("FORBIDDEN");
    expect(errorMessage(await submit(replay.mem.device, q1!, "correct"))).toBe("FORBIDDEN");
    expect(errorMessage(await startReplay(replay.mem, null))).toBe("FORBIDDEN");
  }, 360_000);

  it("reset mùa khi đang chơi lại: lượt void, điểm lớp khác/dữ liệu cũ nguyên vẹn; mùa mới phải qua đường tính điểm", async () => {
    const t = world.teacherA.client;
    const scored = await newScored();
    await finish(scored);
    const replay = await newReplay(scored, "r86-reset");
    await go(replay, ROUTE.t1);
    expect(errorMessage(await activate(replay))).toBeNull();
    const [q1] = await threeOf(replay.runId, 1);
    const season = await seasonOf(scored.classId);
    const [reset, submitted] = await Promise.all([
      t.rpc("teacher_reset_season", {
        p_class_id: scored.classId,
        p_request_id: randomUUID(),
        p_expected_season_id: season,
        p_confirmation: scored.className,
      }),
      submit(replay.mem.device, q1!, "correct"),
    ]);
    expect(reset.error).toBeNull();
    expect(String(submitted.error?.message ?? "")).not.toMatch(/deadlock|40P01/i);
    if (submitted.error) expect(["SEASON_CLOSED", "RUN_NOT_ACTIVE"]).toContain(submitted.error.message);
    const runs = (await admin.from("game_runs").select("id, status").eq("student_id", scored.mem.studentId)).data!;
    expect(runs.find((r) => r.id === replay.runId)?.status).toBe("void_season_reset");
    expect(runs.find((r) => r.id === scored.runId)?.status).toBe("completed");
    // Mùa mới: chưa hoàn thành màn trong mùa mới → không chơi lại được; vào lại theo đường tính điểm cần đủ ngưỡng.
    expect(errorMessage(await startReplay(scored.mem, await replayPlan(scored.mem, "mua-moi")))).toBe(
      "REPLAY_NOT_AVAILABLE",
    );
    expect(errorMessage(await startWith(scored.mem, await realPlan(scored.mem, "mua-moi")))).toBe(
      "INSUFFICIENT_POINTS",
    );
  }, 360_000);
});

describe("R08.6 — ràng buộc CSDL và lượt fixture R07", () => {
  it("scored và is_replay không đi cùng; is_replay bất biến; GAME_REPLAY chỉ cho câu chạm trán; fixture R07 vẫn không có chạm trán", async () => {
    const scored = await newScored();
    await finish(scored);
    const replay = await newReplay(scored, "r86-rang-buoc");
    const bad = await admin.from("game_runs").update({ scored: true }).eq("id", replay.runId);
    expect(bad.error).not.toBeNull();
    const flip = await admin.from("game_runs").update({ is_replay: false }).eq("id", replay.runId);
    expect(flip.error).not.toBeNull();
    expect((await admin.from("game_runs").select("scored, is_replay").eq("id", replay.runId).single()).data).toEqual({
      scored: false,
      is_replay: true,
    });
    const practice = await admin
      .from("question_instances")
      .update({ not_scorable_reason: "GAME_REPLAY" })
      .eq("id", (await threeOf(scored.runId, 1))[0]!);
    expect(practice.error).not.toBeNull();

    // Lượt fixture LOCAL (R07): scored = false, KHÔNG phải chơi lại, không chạm trán; chơi lại không dùng được đường này.
    const t = world.teacherA.client;
    const cls = await newGameClass(t);
    const mem = await gameMember(t, cls.id, { burn: 5 });
    setLocalGameRunFixtures(true);
    try {
      const fixture = await startWith(mem, null);
      expect(errorMessage(fixture)).toBeNull();
      expect(runOf(fixture)).toMatchObject({ scored: false });
      expect((fixture.data as { run: { replay: boolean } }).run.replay).toBe(false);
      expect(await encounters(runOf(fixture).id)).toEqual([]);
    } finally {
      setLocalGameRunFixtures(false);
    }
  }, 360_000);
});

describe("R08.6 — điểm dưới ngưỡng sau khi hoàn thành màn", () => {
  it("đã hoàn thành màn thì vẫn được mời chơi lại dù điểm xuống dưới ngưỡng (RUN_NOT_ACTIVE trước INSUFFICIENT_POINTS); chơi lại không cần ngưỡng", async () => {
    const scored = await newScored();
    await finish(scored);
    expect(await hasLevelProgress(ctx(scored.mem), scored.mem.studentId, LEVEL)).toBe(true);
    // Hạ điểm hiện tại của mùa xuống dưới ngưỡng 50 (service_role, chỉ trong kiểm thử LOCAL của lớp riêng).
    const row = (await scoreRow(scored.mem.studentId))[0]!;
    const lowered = await admin
      .from("season_scores")
      .update({ balance: 10, deducted_total: row.earned_total - 10 })
      .eq("student_id", scored.mem.studentId);
    expect(lowered.error).toBeNull();
    expect(errorMessage(await startWith(scored.mem, await realPlan(scored.mem, "duoi-nguong")))).toBe("RUN_NOT_ACTIVE");
    const before = await snapshot(scored.mem);
    const replay = await newReplay(scored, "r86-duoi-nguong");
    expect(await hasLevelProgress(ctx(scored.mem), scored.mem.studentId, LEVEL)).toBe(true);
    expect(await snapshot(scored.mem)).toEqual(before);
    // Lượt tính điểm CHƯA hoàn thành thì không có quyền chơi lại → trang vẫn chặn theo ngưỡng.
    const t = world.teacherA.client;
    const cls = await newGameClass(t);
    const fresh = await gameMember(t, cls.id, { burn: 11 });
    await startWith(fresh, await realPlan(fresh, "dang-do-duoi"));
    expect(await hasLevelProgress(ctx(fresh), fresh.studentId, LEVEL)).toBe(false);
    expect(await hasLevelProgress(ctx(scored.mem), scored.mem.studentId, "treasure-maze-02")).toBe(false);
    expect(replay.runId).toBeTruthy();
  }, 360_000);

  it("sau reset mùa không còn quyền chơi lại (hasLevelProgress = false) và mùa mới phải qua đường tính điểm", async () => {
    const t = world.teacherA.client;
    const scored = await newScored();
    await finish(scored);
    expect(await hasLevelProgress(ctx(scored.mem), scored.mem.studentId, LEVEL)).toBe(true);
    const season = await seasonOf(scored.classId);
    await rpcOk(
      t.rpc("teacher_reset_season", {
        p_class_id: scored.classId,
        p_request_id: randomUUID(),
        p_expected_season_id: season,
        p_confirmation: scored.className,
      }),
    );
    expect(await hasLevelProgress(ctx(scored.mem), scored.mem.studentId, LEVEL)).toBe(false);
  }, 360_000);
});
