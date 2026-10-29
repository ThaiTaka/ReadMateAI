import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import type { GameRunPlan } from "../../src/features/game-runs/planner";
import { setLocalGameRunFixtures } from "../../scripts/lib/test-fixtures";
import { activateEncounter, getEncounterState, openTreasure } from "@/server/game-runs/encounters";
import { getQuestion, submitAttempt } from "@/server/question-instances/service";
import type { StudentContext } from "@/server/student-gateway/context";
import type { Mem } from "./board-helpers";
import { admin, buildWorld, rpcOk, type World } from "./helpers";
import { gameFixtures, gameMember, newGameClass, realPlan, runOf, startWith } from "./game-helpers";
import { errorMessage, itemFor, ledger, scoreRow, setTestFixturesAllowed, submit } from "./scoring-helpers";

/**
 * R08.3 — chơi chạm trán ở máy chủ trên Supabase LOCAL (JWT thật, nội dung fixture hư cấu riêng của game):
 * kích hoạt theo vị trí lưu ở CSDL, chấm điểm + HP trong MỘT giao dịch, kết thúc chạm trán, mở kho báu, chống bỏ qua/lặp/đồng thời.
 */

type Pos = { row: number; col: number };
type Game = { mem: Mem; runId: string; version: number; classId: string; className: string };
type Enc = { id: string; encounter_no: number; trigger_key: string; status: string; hp_remaining: number };
type Question = { id: string; position: number; game_encounter_id: string | null; status: string };

let world: World;

const p = (row: number, col: number): Pos => ({ row, col });
/** Đường đi màn 1 từ ô xuất phát (1,1) tới từng điểm kích hoạt, theo thứ tự t1…t7 (kho báu ở (7,1), nằm trên đường tới t7). */
const ROUTE = {
  t1: [p(1, 2), p(1, 3), p(1, 4)],
  t2: [p(1, 5), p(1, 6), p(1, 7), p(2, 7)],
  t3: [p(3, 7), p(4, 7), p(5, 7), p(5, 6)],
  t4: [p(5, 5), p(4, 5), p(3, 5)],
  t5: [p(3, 4), p(3, 3), p(3, 2)],
  t6: [p(3, 1), p(4, 1), p(5, 1), p(6, 1)],
  treasure: [p(7, 1)],
  t7: [p(7, 2), p(7, 3), p(7, 4), p(7, 5)],
  backToTreasure: [p(7, 4), p(7, 3), p(7, 2), p(7, 1)],
} as const;

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

const activate = (g: Game, mem = g.mem, studentId = g.mem.studentId, runId = g.runId) =>
  admin.rpc("gateway_activate_encounter", { p_auth_user_id: mem.device.id, p_student_id: studentId, p_run_id: runId });
const openChest = (g: Game, mem = g.mem) =>
  admin.rpc("gateway_open_treasure", {
    p_auth_user_id: mem.device.id,
    p_student_id: mem.studentId,
    p_run_id: g.runId,
  });

const encounters = async (runId: string) =>
  (await admin.from("game_encounters").select("*").eq("run_id", runId).order("encounter_no")).data as Enc[];
const questionsOf = async (runId: string) =>
  (await admin.from("question_instances").select("*").eq("run_id", runId).order("position")).data as Question[];

/** Ba câu của chạm trán số `no`, theo vị trí. */
async function threeOf(runId: string, no: number): Promise<string[]> {
  const enc = (await encounters(runId)).find((e) => e.encounter_no === no)!;
  return (await questionsOf(runId)).filter((q) => q.game_encounter_id === enc.id).map((q) => q.id);
}

/** Lượt tính điểm mới: lớp riêng, học sinh có đúng 21 nội dung chưa tính điểm, kế hoạch với tham số chọn trước. */
async function newGame(opts: { supportLevel?: 0 | 1 | 2 | 3; maxAttempts?: number } = {}): Promise<Game> {
  const t = world.teacherA.client;
  const cls = await newGameClass(t);
  const mem = await gameMember(t, cls.id, { burn: 11 });
  const plan = (await realPlan(mem, `r83-${randomUUID()}`))!;
  const shaped: GameRunPlan = {
    encounters: plan.encounters.map((e) => ({
      monsterKey: e.monsterKey,
      questions: e.questions.map((q) => ({
        exerciseItemId: q.exerciseItemId,
        supportLevel: opts.supportLevel ?? 2,
        maxAttempts: opts.maxAttempts ?? 3,
      })),
    })),
  };
  const started = await startWith(mem, shaped);
  expect(errorMessage(started)).toBeNull();
  const run = runOf(started);
  return { mem, runId: run.id, version: run.state_version, classId: cls.id, className: cls.name };
}

const balanceOf = async (mem: Mem) => (await scoreRow(mem.studentId))[0]!.balance;
const eventCount = async (mem: Mem) => (await ledger(mem.studentId)).length;
const seasonOf = async (classId: string) =>
  (await admin.from("seasons").select("id").eq("class_id", classId).eq("status", "active").single()).data!.id;

type Attempt = {
  outcome: string;
  isCorrect: boolean;
  points: { nominalDelta: number; appliedDelta: number; balanceAfter: number } | null;
  question: { status: string };
  encounter: { status: string; hpRemaining: number } | null;
  score: { balance: number };
};
async function answer(g: Game, questionId: string, pick: string, attemptId?: string): Promise<Attempt> {
  return (await rpcOk(submit(g.mem.device, questionId, pick, attemptId))) as unknown as Attempt;
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

describe("R08.3 — kích hoạt, thứ tự câu, điểm và HP", () => {
  let g: Game;

  beforeAll(async () => {
    g = await newGame();
  }, 180_000);

  it("không đứng ở điểm kích hoạt → NOT_AT_TRIGGER, không đổi gì", async () => {
    expect(errorMessage(await activate(g))).toBe("NOT_AT_TRIGGER");
    await go(g, ROUTE.t1.slice(0, 2));
    expect(errorMessage(await activate(g))).toBe("NOT_AT_TRIGGER");
    expect((await encounters(g.runId)).every((e) => e.status === "pending")).toBe(true);
  });

  it("câu của chạm trán chưa kích hoạt không nộp được và không đọc được", async () => {
    const [q1] = await threeOf(g.runId, 1);
    expect(errorMessage(await submit(g.mem.device, q1!, "correct"))).toBe("ENCOUNTER_PENDING");
    const [other] = await threeOf(g.runId, 4);
    expect(errorMessage(await submit(g.mem.device, other!, "correct"))).toBe("ENCOUNTER_PENDING");
    expect((await getQuestion(ctx(g.mem), q1!)).ok).toBe(false);
    expect((await ledger(g.mem.studentId)).length).toBe(11);
  });

  it("đứng đúng điểm kích hoạt: pending → active, lưu vị trí quay lại, HP 3; học sinh chỉ thấy chạm trán đã kích hoạt", async () => {
    await go(g, ROUTE.t1.slice(2));
    const result = await activate(g);
    expect(errorMessage(result)).toBeNull();
    const data = result.data as { outcome: string; encounter: { encounterNo: number; hpRemaining: number } };
    expect(data.outcome).toBe("activated");
    expect(data.encounter).toMatchObject({ encounterNo: 1, hpRemaining: 3 });
    const rows = await encounters(g.runId);
    expect(rows[0]).toMatchObject({ status: "active", hp_remaining: 3, trigger_key: "tm01-t1" });
    const detail = (await admin.from("game_encounters").select("*").eq("id", rows[0]!.id).single()).data!;
    expect(detail.return_position).toEqual(p(1, 4));
    expect(detail.activated_at).not.toBeNull();
    expect(rows.slice(1).every((e) => e.status === "pending")).toBe(true);
    // Qua JWT thiết bị thật (RLS): chỉ thấy chạm trán đang diễn ra, không thấy 6 dòng pending.
    const seen = await g.mem.device.client.from("game_encounters").select("encounter_no, status");
    expect(seen.data).toEqual([{ encounter_no: 1, status: "active" }]);
  });

  it("gọi lại → resumed: không kích hoạt hai lần, không đặt lại thời điểm; đang diễn ra thì không đi tiếp được", async () => {
    const before = (
      await admin.from("game_encounters").select("activated_at").eq("run_id", g.runId).eq("encounter_no", 1).single()
    ).data!;
    const again = await activate(g);
    expect((again.data as { outcome: string }).outcome).toBe("resumed");
    const after = (
      await admin.from("game_encounters").select("activated_at").eq("run_id", g.runId).eq("encounter_no", 1).single()
    ).data!;
    expect(after.activated_at).toBe(before.activated_at);
    expect(errorMessage(await savePath(g, [p(1, 5)]))).toBe("ENCOUNTER_ACTIVE");
  });

  it("DTO chạm trán: chỉ chạm trán đang diễn ra + câu hiện tại không đáp án; không rò ID, quái vật hay câu khác", async () => {
    const [q1, q2] = await threeOf(g.runId, 1);
    const result = await activateEncounter(ctx(g.mem), g.mem.studentId, g.runId);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const state = result.data.state;
    expect(result.data.outcome).toBe("resumed");
    expect(state.progress).toEqual({ resolved: 0, total: 7 });
    expect(state.encounter?.current?.id).toBe(q1);
    expect(state.encounter?.current?.reveal).toBeNull();
    expect(state.encounter?.questions.map((q) => q.status)).toEqual(["open", "open", "open"]);
    expect(state.encounter?.hpRemaining).toBe(3);
    const text = JSON.stringify(result.data);
    const others = (await encounters(g.runId)).slice(1);
    const monsterKeys = (await admin.from("game_encounters").select("monster_key, encounter_no").eq("run_id", g.runId))
      .data!;
    expect(text).not.toMatch(/student_id|class_id|season_id|"answer"|return_position|trigger/);
    for (const row of monsterKeys.filter((m) => m.encounter_no !== 1)) expect(text).not.toContain(row.monster_key);
    for (const other of others) expect(text).not.toContain(other.id);
    for (const other of await threeOf(g.runId, 2)) expect(text).not.toContain(other);
    // Câu 2, 3 chỉ có mã/thứ tự/trạng thái — nội dung chỉ tới trình duyệt khi trở thành câu hiện tại.
    expect(state.encounter?.questions.map((q) => Object.keys(q).sort())).toEqual(
      Array(3).fill(["id", "position", "status"]),
    );

    const loaded = await getEncounterState(ctx(g.mem), g.runId);
    expect(loaded).toEqual({ ok: true, data: state });
    expect((await getQuestion(ctx(g.mem), q1!)).ok).toBe(true);
    expect((await getQuestion(ctx(g.mem), q2!)).ok).toBe(false);
    // Học sinh khác không đọc được trạng thái chạm trán của lượt này.
    const stranger = await gameMember(world.teacherA.client, g.classId);
    expect(await getEncounterState(ctx(stranger), g.runId)).toEqual({ ok: false, code: "NOT_FOUND" });
  });

  it("không bỏ qua câu 1 để làm câu 2", async () => {
    const [, q2, q3] = await threeOf(g.runId, 1);
    expect(errorMessage(await submit(g.mem.device, q2!, "correct"))).toBe("QUESTION_NOT_CURRENT");
    expect(errorMessage(await submit(g.mem.device, q3!, "correct"))).toBe("QUESTION_NOT_CURRENT");
    expect((await ledger(g.mem.studentId)).length).toBe(11);
    expect((await encounters(g.runId))[0]!.hp_remaining).toBe(3);
  });

  it("đúng +10 và HP −1 một lần; gửi lại cùng clientAttemptId không nhân đôi điểm hay HP", async () => {
    const [q1] = await threeOf(g.runId, 1);
    const balance = await balanceOf(g.mem);
    const attemptId = randomUUID();
    const first = await answer(g, q1!, "correct", attemptId);
    expect(first.outcome).toBe("recorded");
    expect(first.points).toMatchObject({ nominalDelta: 10, appliedDelta: 10 });
    expect(first.encounter).toEqual(expect.objectContaining({ status: "active", hpRemaining: 2 }));
    const replay = await answer(g, q1!, "correct", attemptId);
    expect(replay.outcome).toBe("replayed");
    expect(replay.encounter).toEqual(expect.objectContaining({ hpRemaining: 2 }));
    expect(await balanceOf(g.mem)).toBe(balance + 10);
    expect((await encounters(g.runId))[0]!.hp_remaining).toBe(2);
    expect(await eventCount(g.mem)).toBe(12);
    // Tải lại / kích hoạt lại không đặt lại HP.
    const resumed = await activate(g);
    expect((resumed.data as { encounter: { hpRemaining: number } }).encounter.hpRemaining).toBe(2);
  });

  it("sai −5, HP giữ nguyên; sai rồi đúng trên cùng câu chỉ giảm HP một lần", async () => {
    const [, q2] = await threeOf(g.runId, 1);
    const balance = await balanceOf(g.mem);
    const wrong = await answer(g, q2!, "wrong");
    expect(wrong.points).toMatchObject({ nominalDelta: -5, appliedDelta: -5 });
    expect(wrong.question.status).toBe("open");
    expect(wrong.encounter).toEqual(expect.objectContaining({ hpRemaining: 2 }));
    expect(await balanceOf(g.mem)).toBe(balance - 5);
    const right = await answer(g, q2!, "correct");
    expect(right.points).toMatchObject({ nominalDelta: 10 });
    expect(right.encounter).toEqual(expect.objectContaining({ status: "active", hpRemaining: 1 }));
    expect(await balanceOf(g.mem)).toBe(balance + 5);
  });

  it("đóng cả 3 câu với HP về 0 → defeated; không câu thứ tư, không mở lại, không kích hoạt lại; đi tiếp được", async () => {
    const [, , q3] = await threeOf(g.runId, 1);
    const last = await answer(g, q3!, "correct");
    expect(last.encounter).toEqual(expect.objectContaining({ status: "defeated", hpRemaining: 0 }));
    const row = (await admin.from("game_encounters").select("*").eq("run_id", g.runId).eq("encounter_no", 1).single())
      .data!;
    expect(row).toMatchObject({ status: "defeated", hp_remaining: 0 });
    expect(row.resolved_at).not.toBeNull();
    expect((await questionsOf(g.runId)).filter((q) => q.game_encounter_id === row.id)).toHaveLength(3);
    expect(await questionsOf(g.runId)).toHaveLength(21);
    expect(await encounters(g.runId)).toHaveLength(7);
    expect(errorMessage(await submit(g.mem.device, q3!, "correct"))).toBe("QUESTION_CLOSED");
    expect(errorMessage(await activate(g))).toBe("ENCOUNTER_FINISHED");
    expect((await getEncounterState(ctx(g.mem), g.runId)).ok).toBe(true);
    const state = await getEncounterState(ctx(g.mem), g.runId);
    expect(state.ok && state.data.encounter).toBeNull();
    expect(state.ok && state.data.progress).toEqual({ resolved: 1, total: 7 });
    await go(g, ROUTE.t2);
  });
});

describe("R08.3 — toàn trình: 7 chạm trán, điểm sàn 0, mở kho báu", () => {
  let g: Game;

  beforeAll(async () => {
    // Mức hỗ trợ H1: tối đa 2 lượt mỗi câu → hai lần sai thì câu hết lượt (exhausted).
    g = await newGame({ supportLevel: 1, maxAttempts: 2 });
  }, 180_000);

  it("kho báu chưa mở được khi đứng sai chỗ (ô xuất phát)", async () => {
    expect(errorMessage(await openChest(g))).toBe("NOT_AT_TREASURE");
    expect((await admin.from("game_runs").select("status").eq("id", g.runId).single()).data?.status).toBe(
      "in_progress",
    );
  });

  async function fight(no: number, script: Array<Array<"correct" | "wrong">>) {
    const qs = await threeOf(g.runId, no);
    for (const [i, steps] of script.entries()) {
      let wrongs = 0;
      for (const step of steps) {
        await answer(g, qs[i]!, step === "wrong" ? (wrongs++ === 0 ? "wrong" : "wrong2") : "correct");
      }
    }
    return (await encounters(g.runId)).find((e) => e.encounter_no === no)!;
  }

  it("chơi 7 chạm trán theo đường đi thật; điểm không âm; kết quả defeated/undefeated đúng", async () => {
    let expected = await balanceOf(g.mem);
    const apply = (delta: number) => (expected = Math.max(0, expected + delta));

    await go(g, ROUTE.t1);
    expect((await activate(g)).error).toBeNull();
    apply(10);
    apply(-5);
    apply(10);
    apply(10);
    // Câu 2: sai rồi đúng.
    const one = await fight(1, [["correct"], ["wrong", "correct"], ["correct"]]);
    expect(one).toMatchObject({ status: "defeated", hp_remaining: 0 });
    expect(await balanceOf(g.mem)).toBe(expected);

    // Chạm trán 2: sai-sai (hết lượt), đúng, sai-sai → undefeated, HP 2.
    await go(g, ROUTE.t2);
    expect((await activate(g)).error).toBeNull();
    const two = await fight(2, [["wrong", "wrong"], ["correct"], ["wrong", "wrong"]]);
    for (const d of [-5, -5, 10, -5, -5]) apply(d);
    expect(two).toMatchObject({ status: "undefeated", hp_remaining: 2 });
    expect(await balanceOf(g.mem)).toBe(expected);

    // Chạm trán 3–6: hết lượt cả 3 câu → undefeated, HP 3; tới đây điểm chạm sàn 0.
    const routes = [ROUTE.t3, ROUTE.t4, ROUTE.t5, ROUTE.t6];
    for (const [i, route] of routes.entries()) {
      await go(g, route);
      expect((await activate(g)).error).toBeNull();
      const row = await fight(3 + i, [
        ["wrong", "wrong"],
        ["wrong", "wrong"],
        ["wrong", "wrong"],
      ]);
      for (let k = 0; k < 6; k += 1) apply(-5);
      expect(row).toMatchObject({ status: "undefeated", hp_remaining: 3 });
      expect(await balanceOf(g.mem)).toBe(expected);
    }
    expect(expected).toBe(5);
  }, 240_000);

  it("kho báu: đứng đúng ô rương nhưng mới 6/7 → ENCOUNTERS_INCOMPLETE", async () => {
    await go(g, ROUTE.treasure);
    expect(errorMessage(await openChest(g))).toBe("ENCOUNTERS_INCOMPLETE");
    const service = await openTreasure(ctx(g.mem), g.mem.studentId, g.runId);
    expect(service).toEqual({ ok: false, code: "ENCOUNTERS_INCOMPLETE" });
  });

  it("chạm trán 7 đưa điểm chạm sàn 0: trừ không vượt quá số dư, số dư không âm", async () => {
    await go(g, ROUTE.t7);
    expect(errorMessage(await openChest(g))).toBe("NOT_AT_TREASURE");
    expect((await activate(g)).error).toBeNull();
    const qs = await threeOf(g.runId, 7);
    const first = await answer(g, qs[0]!, "wrong");
    expect(first.points).toMatchObject({ nominalDelta: -5, appliedDelta: -5, balanceAfter: 0 });
    const second = await answer(g, qs[0]!, "wrong2");
    expect(second.points).toMatchObject({ nominalDelta: -5, appliedDelta: 0, balanceAfter: 0 });
    expect(second.question.status).toBe("exhausted");
    expect(second.score.balance).toBe(0);
    const two = await answer(g, qs[1]!, "correct");
    expect(two.encounter).toEqual(expect.objectContaining({ status: "active", hpRemaining: 2 }));
    const three = await answer(g, qs[2]!, "correct");
    expect(three.encounter).toEqual(expect.objectContaining({ status: "undefeated", hpRemaining: 1 }));
    expect(await balanceOf(g.mem)).toBe(20);
    expect((await ledger(g.mem.studentId)).every((e) => e.balance_after >= 0 && e.balance_before >= 0)).toBe(true);
  }, 240_000);

  it("đủ 7/7, quay lại ô rương, mở kho báu: hoàn thành, không cộng điểm, gửi lại không ghi hai lần", async () => {
    await go(g, ROUTE.backToTreasure);
    const eventsBefore = await eventCount(g.mem);
    const balanceBefore = await balanceOf(g.mem);
    const opened = await openChest(g);
    expect(errorMessage(opened)).toBeNull();
    const treasure = opened.data as {
      outcome: string;
      treasure: { defeated: number; undefeated: number; status: string };
    };
    expect(treasure.outcome).toBe("opened");
    expect(treasure.treasure).toMatchObject({ status: "completed", defeated: 1, undefeated: 6 });
    const run = (await admin.from("game_runs").select("*").eq("id", g.runId).single()).data!;
    expect(run.status).toBe("completed");
    expect(run.treasure_opened_at).not.toBeNull();
    expect(run.completed_at).not.toBeNull();
    expect(run.ended_at).not.toBeNull();
    expect(await eventCount(g.mem)).toBe(eventsBefore);
    expect(await balanceOf(g.mem)).toBe(balanceBefore);
    const rows = await encounters(g.runId);
    expect(rows.map((e) => e.status)).toEqual([
      "defeated",
      "undefeated",
      "undefeated",
      "undefeated",
      "undefeated",
      "undefeated",
      "undefeated",
    ]);

    const again = await openChest(g);
    expect((again.data as { outcome: string }).outcome).toBe("replayed");
    const runAfter = (
      await admin.from("game_runs").select("completed_at, treasure_opened_at").eq("id", g.runId).single()
    ).data!;
    expect(runAfter).toEqual({ completed_at: run.completed_at, treasure_opened_at: run.treasure_opened_at });
    const viaService = await openTreasure(ctx(g.mem), g.mem.studentId, g.runId);
    expect(viaService.ok && viaService.data.outcome).toBe("replayed");
    // Lượt đã hoàn thành: không lưu vị trí, không kích hoạt thêm.
    expect(errorMessage(await savePath(g, [p(7, 2)]))).toBe("RUN_NOT_ACTIVE");
    expect(errorMessage(await activate(g))).toBe("RUN_NOT_ACTIVE");
  }, 240_000);
});

describe("R08.3 — qua lớp dịch vụ API", () => {
  it("nộp bài qua dịch vụ: DTO có trạng thái chạm trán; kích hoạt qua dịch vụ trả đúng khuôn", async () => {
    const g = await newGame();
    await go(g, ROUTE.t1);
    const activated = await activateEncounter(ctx(g.mem), g.mem.studentId, g.runId);
    expect(activated.ok && activated.data.outcome).toBe("activated");
    const q1 = activated.ok ? activated.data.state.encounter!.current! : null;
    expect(q1?.total).toBe(3);
    expect(q1?.position).toBe(1);
    const item = await itemFor(q1!.id);
    const sent = await submitAttempt(ctx(g.mem), q1!.id, {
      clientAttemptId: randomUUID(),
      response: { kind: "choice", optionId: item.answer.optionId },
    });
    expect(sent.ok).toBe(true);
    if (!sent.ok) return;
    expect(sent.data.encounter).toEqual({ encounterNo: 1, status: "active", hpRemaining: 2 });
    expect(sent.data.question.status).toBe("correct");
    const state = await getEncounterState(ctx(g.mem), g.runId);
    expect(state.ok && state.data.encounter?.current?.position).toBe(2);
    expect(state.ok && state.data.encounter?.hpRemaining).toBe(2);
    // Hồ sơ giả ở tầng ứng dụng bị chặn.
    const other = await gameMember(world.teacherA.client, g.classId);
    expect(await activateEncounter(ctx(g.mem), other.studentId, g.runId)).toEqual({ ok: false, code: "FORBIDDEN" });
    expect((await activateEncounter(ctx(other), other.studentId, g.runId)).ok).toBe(false);
  }, 180_000);
});

describe("R08.3 — quyền truy cập, đồng thời, reset mùa", () => {
  it("thiết bị/học sinh khác, thiếu đồng ý, thiết bị bị thu hồi → bị chặn", async () => {
    const t = world.teacherA.client;
    const g = await newGame();
    await go(g, ROUTE.t1);
    const [q1] = await threeOf(g.runId, 1);
    const stranger = await gameMember(t, g.classId);
    expect(errorMessage(await activate(g, stranger, g.mem.studentId))).toBe("FORBIDDEN");
    expect(errorMessage(await activate(g, stranger, stranger.studentId))).toBe("NOT_FOUND");
    expect(errorMessage(await openChest(g, stranger))).toBe("NOT_FOUND");
    expect(errorMessage(await submit(stranger.device, q1!, "correct"))).toBe("FORBIDDEN");
    expect((await encounters(g.runId)).every((e) => e.status === "pending")).toBe(true);

    expect((await activate(g)).error).toBeNull();
    const deviceRow = await admin.from("student_devices").select("id").eq("student_id", g.mem.studentId).single();
    await rpcOk(t.rpc("teacher_revoke_device", { p_device_id: deviceRow.data!.id }));
    expect(errorMessage(await activate(g))).toBe("FORBIDDEN");
    expect(errorMessage(await openChest(g))).toBe("FORBIDDEN");
    expect(errorMessage(await submit(g.mem.device, q1!, "correct"))).toBe("FORBIDDEN");
    expect(errorMessage(await savePath(g, []))).toBe("FORBIDDEN");

    const noConsent = await newGame();
    await go(noConsent, ROUTE.t1);
    await rpcOk(t.rpc("teacher_withdraw_consent", { p_student_id: noConsent.mem.studentId, p_scope: "learning_data" }));
    // Rút đồng ý còn thu hồi thiết bị của học sinh nên có thể gặp FORBIDDEN trước CONSENT_REQUIRED; cả hai đều chặn.
    expect(errorMessage(await activate(noConsent))).toMatch(/^(CONSENT_REQUIRED|FORBIDDEN)$/);
    expect(errorMessage(await openChest(noConsent))).toMatch(/^(CONSENT_REQUIRED|FORBIDDEN)$/);
    const [nq1] = await threeOf(noConsent.runId, 1);
    expect(errorMessage(await submit(noConsent.mem.device, nq1!, "correct"))).toMatch(/^(CONSENT_REQUIRED|FORBIDDEN)$/);
  }, 240_000);

  it("lượt không tính điểm (fixture, chưa phân bổ) không có chạm trán: ENCOUNTERS_INCOMPLETE", async () => {
    const t = world.teacherA.client;
    const cls = await newGameClass(t);
    const mem = await gameMember(t, cls.id, { burn: 5 });
    setLocalGameRunFixtures(true);
    try {
      const started = await startWith(mem, null);
      expect(errorMessage(started)).toBeNull();
      const g: Game = { mem, runId: runOf(started).id, version: 1, classId: cls.id, className: cls.name };
      await go(g, ROUTE.t1);
      expect(errorMessage(await activate(g))).toBe("ENCOUNTERS_INCOMPLETE");
      await go(g, [...ROUTE.t2, ...ROUTE.t3, ...ROUTE.t4, ...ROUTE.t5, ...ROUTE.t6, ...ROUTE.treasure]);
      expect(errorMessage(await openChest(g))).toBe("ENCOUNTERS_INCOMPLETE");
    } finally {
      setLocalGameRunFixtures(false);
    }
  }, 240_000);

  it("hai tab đồng thời: kích hoạt một lần; nộp trùng, kích hoạt lại, lưu vị trí cùng lúc → không deadlock, điểm/HP đúng một lần", async () => {
    const g = await newGame();
    await go(g, ROUTE.t1);
    const both = await Promise.all([activate(g), activate(g)]);
    expect(both.map((r) => errorMessage(r))).toEqual([null, null]);
    expect(both.map((r) => (r.data as { outcome: string }).outcome).sort()).toEqual(["activated", "resumed"]);
    const rows = await encounters(g.runId);
    expect(rows.filter((e) => e.status === "active")).toHaveLength(1);

    const [q1] = await threeOf(g.runId, 1);
    const balance = await balanceOf(g.mem);
    const sameAttempt = randomUUID();
    const results = await Promise.all([
      submit(g.mem.device, q1!, "correct", sameAttempt),
      submit(g.mem.device, q1!, "correct", sameAttempt),
      submit(g.mem.device, q1!, "correct"),
      activate(g),
      savePath(g, [p(1, 5)]),
    ]);
    for (const result of results) expect(String(result.error?.message ?? "")).not.toMatch(/deadlock|40P01/i);
    const recorded = results
      .slice(0, 3)
      .filter((r) => !r.error && (r.data as { outcome: string }).outcome === "recorded");
    expect(recorded).toHaveLength(1);
    expect(await balanceOf(g.mem)).toBe(balance + 10);
    expect((await encounters(g.runId))[0]!.hp_remaining).toBe(2);
    expect(errorMessage(results[4]!)).toBe("ENCOUNTER_ACTIVE");
  }, 240_000);

  it("reset mùa chặn chơi tiếp; chạy đồng thời với nộp bài không deadlock", async () => {
    const t = world.teacherA.client;
    const g = await newGame();
    await go(g, ROUTE.t1);
    expect((await activate(g)).error).toBeNull();
    const [q1, q2] = await threeOf(g.runId, 1);
    const season = await seasonOf(g.classId);
    const [reset, submitted] = await Promise.all([
      t.rpc("teacher_reset_season", {
        p_class_id: g.classId,
        p_request_id: randomUUID(),
        p_expected_season_id: season,
        p_confirmation: g.className,
      }),
      submit(g.mem.device, q1!, "correct"),
    ]);
    expect(reset.error).toBeNull();
    expect(String(submitted.error?.message ?? "")).not.toMatch(/deadlock|40P01/i);
    if (submitted.error) expect(["SEASON_CLOSED", "RUN_NOT_ACTIVE"]).toContain(submitted.error.message);

    const run = (await admin.from("game_runs").select("status").eq("id", g.runId).single()).data!;
    expect(run.status).toBe("void_season_reset");
    expect(
      (await encounters(g.runId)).every(
        (e) => e.status === "void" || e.status === "defeated" || e.status === "undefeated",
      ),
    ).toBe(true);
    expect(errorMessage(await submit(g.mem.device, q2!, "correct"))).toMatch(/SEASON_CLOSED|RUN_NOT_ACTIVE/);
    expect(errorMessage(await activate(g))).toMatch(/SEASON_CLOSED|NOT_FOUND|RUN_NOT_ACTIVE/);
    expect(errorMessage(await openChest(g))).toMatch(/SEASON_CLOSED|NOT_FOUND|RUN_NOT_ACTIVE/);
  }, 240_000);

  it("luyện tập R04 vẫn đúng: buổi luyện không đổi HP/chạm trán và vẫn tính điểm như cũ", async () => {
    const t = world.teacherA.client;
    const cls = await newGameClass(t);
    const mem = await gameMember(t, cls.id, { burn: 3 });
    const events = await ledger(mem.studentId);
    expect(events).toHaveLength(3);
    expect(events.every((e) => e.nominal_delta === 10 && e.balance_after === e.balance_before + 10)).toBe(true);
    expect(await balanceOf(mem)).toBe(30);
    expect((await admin.from("game_encounters").select("id").eq("student_id", mem.studentId)).data).toHaveLength(0);
  }, 120_000);
});
