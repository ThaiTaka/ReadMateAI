import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { firstLedgerInconsistency, scoreFromLedger } from "../../src/features/gamification/apply";
import {
  BALANCE_FLOOR,
  GAME_MIN_BALANCE,
  MAP_TILE_STEP,
  POINTS_CORRECT,
  POINTS_INCORRECT,
  SCORING_RULES_VERSION,
} from "../../src/features/gamification/rules";
import { FIXTURE_DISTINCT_ELIGIBLE } from "../../scripts/fixtures/scoring-items";
import { admin, buildWorld, rpcOk, type World } from "./helpers";
import {
  candidates,
  confirmFixtureCurriculum,
  errorMessage,
  fixtures,
  ledger,
  linkedStudent,
  planItems,
  scoreRow,
  sessionQuestions,
  setTestFixturesAllowed,
  startSession,
  submit,
  type Candidate,
} from "./scoring-helpers";

/**
 * R04 — kiểm thử tích hợp Scoring Engine trên Supabase LOCAL thật (Auth + PostgREST + hàm CSDL), không mock.
 * Bao phủ GAMIFICATION_SPEC §13 (1–9, 11) ở tầng CSDL: công thức, sổ cái, gửi lại/song song, tải lại, tính điểm
 * một lần mỗi mùa (kể cả nội dung trùng khác mã), chống sửa request, cách ly RLS, mở thẻ, dấu mở khóa game.
 */

let world: World;

type Result = { data: unknown; error: { message?: string } | null };
const outcome = (result: Result) => (result.data as { outcome?: string } | null)?.outcome;
const points = (result: Result) =>
  (result.data as { points?: { nominalDelta: number; appliedDelta: number } | null } | null)?.points ?? null;

async function itemsOf(device: Parameters<typeof candidates>[0], studentId: string): Promise<Candidate[]> {
  const result = await candidates(device, studentId);
  if (result.error) throw new Error(JSON.stringify(result.error));
  return (result.data as { items: Candidate[] }).items;
}

async function fixtureItemIds(keys: string[]): Promise<Record<string, string[]>> {
  const { data } = await admin
    .from("exercises")
    .select("key, exercise_versions(exercise_items(id, position))")
    .in("key", keys);
  return Object.fromEntries(
    (data ?? []).map((row) => [
      row.key,
      row.exercise_versions
        .flatMap((version) => version.exercise_items)
        .sort((a, b) => a.position - b.position)
        .map((item) => item.id),
    ]),
  );
}

beforeAll(async () => {
  await fixtures();
  world = await buildWorld();
  await confirmFixtureCurriculum(world.teacherA.client, world.classA, 2);
  await confirmFixtureCurriculum(world.teacherB.client, world.classB, 2);
});

describe("hằng số điểm trong CSDL khớp rules.ts (một nguồn trong mã, bản sao có kiểm thử)", () => {
  it("private.scoring_rules 'r1' = rules.ts", async () => {
    const rules = await rpcOk(admin.rpc("gateway_scoring_rules", { p_version: SCORING_RULES_VERSION }));
    expect(rules).toEqual({
      version: SCORING_RULES_VERSION,
      points_correct: POINTS_CORRECT,
      points_incorrect: POINTS_INCORRECT,
      balance_floor: BALANCE_FLOOR,
      map_tile_step: MAP_TILE_STEP,
      game_min_balance: GAME_MIN_BALANCE,
    });
  });
});

describe("phát câu: chỉ nội dung đã duyệt, đã học, đúng nhóm", () => {
  it("ứng viên của lớp ở bài 2: 16 nội dung khác nhau (+ 1 bản sao), không có câu chưa duyệt/chưa học", async () => {
    const { studentId, device } = await linkedStudent(world.teacherA.client, world.classA, { band: "developing" });
    const items = await itemsOf(device, studentId);
    expect(new Set(items.map((item) => item.fingerprint)).size).toBe(FIXTURE_DISTINCT_ELIGIBLE);
    expect(items).toHaveLength(FIXTURE_DISTINCT_ELIGIBLE + 1);
    expect(Math.max(...items.map((item) => item.lessonOrdinal))).toBe(2);
    const ids = await fixtureItemIds(["fixture:r04:unreviewed", "fixture:r04:not-yet-taught"]);
    for (const id of Object.values(ids).flat()) expect(items.map((item) => item.exerciseItemId)).not.toContain(id);
  });

  it("Nhóm 3 (foundation) chỉ nhận kiến thức tới bài TRƯỚC (bài 1)", async () => {
    const { studentId, device } = await linkedStudent(world.teacherA.client, world.classA, { band: "foundation" });
    const items = await itemsOf(device, studentId);
    expect(items.every((item) => item.lessonOrdinal <= 1)).toBe(true);
    expect(items).toHaveLength(9);
    const lesson2 = await fixtureItemIds(["fixture:r04:letters-b"]);
    const tried = await startSession(device, studentId, planItems([lesson2["fixture:r04:letters-b"]![0]!]));
    expect(errorMessage(tried)).toBe("CONTENT_NOT_ELIGIBLE");
  });

  it("đưa thẳng mã câu chưa duyệt / chưa học vào yêu cầu → CONTENT_NOT_ELIGIBLE, không tạo buổi nào", async () => {
    const { studentId, device } = await linkedStudent(world.teacherA.client, world.classA);
    const ids = await fixtureItemIds(["fixture:r04:unreviewed", "fixture:r04:not-yet-taught"]);
    for (const id of Object.values(ids).flat()) {
      expect(errorMessage(await startSession(device, studentId, planItems([id])))).toBe("CONTENT_NOT_ELIGIBLE");
    }
    const { count } = await admin
      .from("practice_sessions")
      .select("id", { count: "exact", head: true })
      .eq("student_id", studentId);
    expect(count).toBe(0);
  });

  it("chưa có đồng ý learning_data / chưa xếp nhóm / lớp chưa xác nhận tiến độ → bị chặn", async () => {
    const noConsent = await linkedStudent(world.teacherA.client, world.classA, { consent: false });
    expect(errorMessage(await candidates(noConsent.device, noConsent.studentId))).toBe("CONSENT_REQUIRED");
    const noBand = await linkedStudent(world.teacherA.client, world.classA, { band: null });
    expect(errorMessage(await candidates(noBand.device, noBand.studentId))).toBe("NO_BAND");
    const otherClass = await rpcOk(
      world.teacherA.client.rpc("teacher_create_class", {
        p_name: `Lớp chưa xác nhận ${randomUUID().slice(0, 4)}`,
        p_school_year: "2026-2027",
      }),
    );
    const unconfirmed = await linkedStudent(world.teacherA.client, otherClass);
    expect(errorMessage(await candidates(unconfirmed.device, unconfirmed.studentId))).toBe("CURRICULUM_UNCONFIRMED");
  });

  it("thiết bị không liên kết / đã thu hồi / của học sinh khác → FORBIDDEN", async () => {
    const { studentId } = await linkedStudent(world.teacherA.client, world.classA);
    for (const device of [world.unlinkedDevice, world.revokedDevice, world.deviceB1]) {
      expect(errorMessage(await candidates(device, studentId))).toBe("FORBIDDEN");
      expect(errorMessage(await startSession(device, studentId, planItems([randomUUID()])))).toBe("FORBIDDEN");
    }
  });
});

describe("buổi luyện: tải lại không đổi câu", () => {
  it("gọi lại khi buổi còn dở → đúng buổi cũ, cùng câu, cùng số lượt đã dùng", async () => {
    const { studentId, device } = await linkedStudent(world.teacherA.client, world.classA);
    const items = (await itemsOf(device, studentId)).slice(0, 4).map((item) => item.exerciseItemId);
    const first = await rpcOk(startSession(device, studentId, planItems(items)));
    const questions = await sessionQuestions((first as { sessionId: string }).sessionId);
    await rpcOk(submit(device, questions[0]!.id, "wrong"));
    const again = await rpcOk(startSession(device, studentId, planItems(items.slice(2))));
    expect(again).toEqual({ sessionId: (first as { sessionId: string }).sessionId, resumed: true });
    const reloaded = await sessionQuestions((first as { sessionId: string }).sessionId);
    expect(reloaded.map((question) => question.id)).toEqual(questions.map((question) => question.id));
    expect(reloaded[0]!.attempts_used).toBe(1);
  });
});

describe("ghi điểm: +10 / −5 / sàn 0, sổ cái chỉ ghi thêm", () => {
  it("đúng +10; sai −5; sai ở 0 điểm vẫn 0 (nominal −5, applied 0); số dư khớp sổ cái", async () => {
    const { studentId, device } = await linkedStudent(world.teacherA.client, world.classA);
    const items = (await itemsOf(device, studentId)).slice(0, 4).map((item) => item.exerciseItemId);
    const session = (await rpcOk(startSession(device, studentId, planItems(items)))) as { sessionId: string };
    const [q1, q2, q3] = await sessionQuestions(session.sessionId);

    const wrongAtZero = await submit(device, q1!.id, "wrong");
    expect(points(wrongAtZero)).toEqual({ nominalDelta: -5, appliedDelta: 0, balanceBefore: 0, balanceAfter: 0 });
    const correct = await submit(device, q1!.id, "correct");
    expect(points(correct)).toMatchObject({ nominalDelta: 10, appliedDelta: 10, balanceAfter: 10 });
    expect((correct.data as { question: { status: string; rewarded: boolean } }).question).toMatchObject({
      status: "correct",
      rewarded: true,
    });
    const wrong = await submit(device, q2!.id, "wrong");
    expect(points(wrong)).toMatchObject({ nominalDelta: -5, appliedDelta: -5, balanceAfter: 5 });
    await rpcOk(submit(device, q2!.id, "correct"));
    await rpcOk(submit(device, q3!.id, "correct"));

    const [score] = await scoreRow(studentId);
    expect(score).toMatchObject({ balance: 25, earned_total: 30, deducted_total: 5 });
    const events = await ledger(studentId);
    expect(events).toHaveLength(5);
    const entries = events.map((event) => ({
      outcome: event.outcome as "correct" | "incorrect",
      nominalDelta: event.nominal_delta,
      appliedDelta: event.applied_delta,
      balanceBefore: event.balance_before,
      balanceAfter: event.balance_after,
    }));
    expect(firstLedgerInconsistency(entries)).toBe(-1);
    expect(scoreFromLedger(entries)).toEqual({ balance: 25, earnedTotal: 30, deductedTotal: 5 });
  });

  it("gửi lại đúng câu trả lời cũ → DUPLICATE_RESPONSE: không tốn lượt, không trừ điểm", async () => {
    const { studentId, device } = await linkedStudent(world.teacherA.client, world.classA);
    const items = (await itemsOf(device, studentId)).slice(0, 2).map((item) => item.exerciseItemId);
    const session = (await rpcOk(startSession(device, studentId, planItems(items)))) as { sessionId: string };
    const [q1] = await sessionQuestions(session.sessionId);
    await rpcOk(submit(device, q1!.id, "correct"));
    await rpcOk(submit(device, (await sessionQuestions(session.sessionId))[1]!.id, "wrong"));
    const q2 = (await sessionQuestions(session.sessionId))[1]!;
    expect(errorMessage(await submit(device, q2.id, "wrong"))).toBe("DUPLICATE_RESPONSE");
    expect((await sessionQuestions(session.sessionId))[1]!.attempts_used).toBe(1);
    expect(await ledger(studentId)).toHaveLength(2);
    expect((await scoreRow(studentId))[0]).toMatchObject({ balance: 5 });
  });

  it("câu đã đóng → QUESTION_CLOSED; câu hết lượt → exhausted (H1: 2 lượt), không câu thay thế", async () => {
    const { studentId, device } = await linkedStudent(world.teacherB.client, world.classB, { band: "extending" });
    const items = (await itemsOf(device, studentId)).slice(0, 2).map((item) => item.exerciseItemId);
    const session = (await rpcOk(
      startSession(device, studentId, planItems(items, { supportLevel: 1, maxAttempts: 2 })),
    )) as {
      sessionId: string;
    };
    const [q1, q2] = await sessionQuestions(session.sessionId);
    await rpcOk(submit(device, q1!.id, "correct"));
    expect(errorMessage(await submit(device, q1!.id, "wrong"))).toBe("QUESTION_CLOSED");
    await rpcOk(submit(device, q2!.id, "wrong"));
    const last = await rpcOk(submit(device, q2!.id, "wrong2"));
    expect((last as { question: { status: string } }).question.status).toBe("exhausted");
    expect((last as { sessionStatus: string }).sessionStatus).toBe("completed");
    expect(errorMessage(await submit(device, q2!.id, "correct"))).toBe("QUESTION_CLOSED");
    expect(await sessionQuestions(session.sessionId)).toHaveLength(2);
  });
});

describe("chống trùng: khóa ý định, double click, song song, nhiều tab", () => {
  it("cùng clientAttemptId gửi 5 lần tuần tự + 5 lần song song → 1 lượt, 1 sự kiện điểm", async () => {
    const { studentId, device } = await linkedStudent(world.teacherA.client, world.classA);
    const items = (await itemsOf(device, studentId)).slice(0, 2).map((item) => item.exerciseItemId);
    const session = (await rpcOk(startSession(device, studentId, planItems(items)))) as { sessionId: string };
    const [q1] = await sessionQuestions(session.sessionId);
    const clientAttemptId = randomUUID();
    const sequential = [];
    for (let index = 0; index < 5; index += 1)
      sequential.push(await submit(device, q1!.id, "correct", clientAttemptId));
    const parallel = await Promise.all(
      Array.from({ length: 5 }, () => submit(device, q1!.id, "correct", clientAttemptId)),
    );
    const all = [...sequential, ...parallel];
    expect(all.every((result) => result.error === null)).toBe(true);
    expect(all.filter((result) => outcome(result) === "recorded")).toHaveLength(1);
    expect(all.filter((result) => outcome(result) === "replayed")).toHaveLength(9);
    const { count } = await admin
      .from("item_attempts")
      .select("id", { count: "exact", head: true })
      .eq("question_instance_id", q1!.id);
    expect(count).toBe(1);
    expect(await ledger(studentId)).toHaveLength(1);
    expect((await scoreRow(studentId))[0]).toMatchObject({ balance: 10, earned_total: 10 });
  });

  it("cùng clientAttemptId nhưng câu trả lời khác → IDEMPOTENCY_CONFLICT (không coi là lượt mới)", async () => {
    const { studentId, device } = await linkedStudent(world.teacherA.client, world.classA);
    const items = (await itemsOf(device, studentId)).slice(0, 1).map((item) => item.exerciseItemId);
    const session = (await rpcOk(startSession(device, studentId, planItems(items)))) as { sessionId: string };
    const [q1] = await sessionQuestions(session.sessionId);
    const id = randomUUID();
    await rpcOk(submit(device, q1!.id, "wrong", id));
    expect(errorMessage(await submit(device, q1!.id, "correct", id))).toBe("IDEMPOTENCY_CONFLICT");
    expect(await ledger(studentId)).toHaveLength(1);
  });

  it("câu còn 1 lượt, hai câu trả lời KHÁC nhau gửi song song (hai tab) → đúng một lượt được ghi", async () => {
    const { studentId, device } = await linkedStudent(world.teacherB.client, world.classB, { band: "extending" });
    const items = (await itemsOf(device, studentId)).slice(0, 1).map((item) => item.exerciseItemId);
    const session = (await rpcOk(
      startSession(device, studentId, planItems(items, { supportLevel: 1, maxAttempts: 2 })),
    )) as {
      sessionId: string;
    };
    const [q1] = await sessionQuestions(session.sessionId);
    await rpcOk(submit(device, q1!.id, "wrong"));
    const [a, b] = await Promise.all([submit(device, q1!.id, "correct"), submit(device, q1!.id, "wrong2")]);
    expect([a, b].filter((result) => result.error === null)).toHaveLength(1);
    expect(["QUESTION_CLOSED", "NO_ATTEMPTS_LEFT"]).toContain(errorMessage(a.error ? a : b));
    const { count } = await admin
      .from("item_attempts")
      .select("id", { count: "exact", head: true })
      .eq("question_instance_id", q1!.id);
    expect(count).toBe(2);
    expect(await ledger(studentId)).toHaveLength(2);
  });

  it("nhiều câu đúng song song của cùng học sinh → số dư = tổng sổ cái (khóa dòng điểm)", async () => {
    const { studentId, device } = await linkedStudent(world.teacherA.client, world.classA);
    const items = (await itemsOf(device, studentId)).slice(0, 6).map((item) => item.exerciseItemId);
    const session = (await rpcOk(startSession(device, studentId, planItems(items)))) as { sessionId: string };
    const questions = await sessionQuestions(session.sessionId);
    const results = await Promise.all(questions.map((question) => submit(device, question.id, "correct")));
    expect(results.every((result) => result.error === null)).toBe(true);
    expect((await scoreRow(studentId))[0]).toMatchObject({ balance: 60, earned_total: 60, deducted_total: 0 });
    const events = await ledger(studentId);
    expect(new Set(events.map((event) => event.balance_after))).toEqual(new Set([10, 20, 30, 40, 50, 60]));
  });

  it("hai tab bấm 'Luyện' cùng lúc → một buổi luyện duy nhất", async () => {
    const { studentId, device } = await linkedStudent(world.teacherA.client, world.classA);
    const items = (await itemsOf(device, studentId)).slice(0, 3).map((item) => item.exerciseItemId);
    const [a, b] = await Promise.all([
      startSession(device, studentId, planItems(items)),
      startSession(device, studentId, planItems(items)),
    ]);
    expect(a.error).toBeNull();
    expect(b.error).toBeNull();
    expect((a.data as { sessionId: string }).sessionId).toBe((b.data as { sessionId: string }).sessionId);
  });
});

describe("không tích điểm vô hạn: mỗi nội dung tính điểm một lần mỗi mùa", () => {
  it("cùng nội dung, KHÁC mã câu/thứ tự phương án (bản sao) → bản thứ hai là 'luyện thêm', không tạo điểm", async () => {
    const { studentId, device } = await linkedStudent(world.teacherA.client, world.classA);
    const ids = await fixtureItemIds(["fixture:r04:letters-a", "fixture:r04:duplicate"]);
    const original = ids["fixture:r04:letters-a"]![0]!;
    const duplicate = ids["fixture:r04:duplicate"]![0]!;
    const session = (await rpcOk(startSession(device, studentId, planItems([original, duplicate])))) as {
      sessionId: string;
    };
    const [q1, q2] = await sessionQuestions(session.sessionId);
    expect(q1!.content_fingerprint).toBe(q2!.content_fingerprint);
    expect(q1).toMatchObject({ scorable: true, not_scorable_reason: null });
    expect(q2).toMatchObject({ scorable: false, not_scorable_reason: "ALREADY_SCORED_IN_SEASON" });
    await rpcOk(submit(device, q1!.id, "correct"));
    const wrong = await rpcOk(submit(device, q2!.id, "wrong"));
    expect((wrong as { points: unknown }).points).toBeNull();
    const correct = await rpcOk(submit(device, q2!.id, "correct"));
    expect((correct as { points: unknown }).points).toBeNull();
    expect((correct as { question: { rewarded: boolean } }).question.rewarded).toBe(false);
    expect(await ledger(studentId)).toHaveLength(1);
    // Lần lập buổi sau: ứng viên đã tính điểm được đánh dấu, không thể tính điểm lại.
    const next = await itemsOf(device, studentId);
    expect(
      next
        .filter((item) => item.scoredInSeason)
        .map((item) => item.exerciseItemId)
        .sort(),
    ).toEqual([original, duplicate].sort());
  });

  it("câu chỉ luyện thêm (máy chủ đề nghị không tính điểm) → chấm nhưng 0 dòng sổ cái", async () => {
    const { studentId, device } = await linkedStudent(world.teacherA.client, world.classA);
    const items = (await itemsOf(device, studentId)).slice(0, 1).map((item) => item.exerciseItemId);
    const session = (await rpcOk(startSession(device, studentId, planItems(items, { scorable: false })))) as {
      sessionId: string;
    };
    const [q1] = await sessionQuestions(session.sessionId);
    expect(q1).toMatchObject({ scorable: false, not_scorable_reason: "PRACTICE_ONLY" });
    await rpcOk(submit(device, q1!.id, "wrong"));
    await rpcOk(submit(device, q1!.id, "correct"));
    expect(await ledger(studentId)).toHaveLength(0);
    // Dòng điểm mùa được tạo (0 điểm) khi lập buổi để khóa tuần tự theo học sinh — không có điểm nào được ghi.
    expect(await scoreRow(studentId)).toEqual([
      expect.objectContaining({ balance: 0, earned_total: 0, deducted_total: 0 }),
    ]);
  });

  it("mùa mới (giả lập reset R06) → câu cũ SEASON_CLOSED; buổi dở bị hủy; nội dung tính điểm lại được", async () => {
    const teacher = world.teacherB.client;
    const classId = await rpcOk(
      teacher.rpc("teacher_create_class", {
        p_name: `Lớp mùa ${randomUUID().slice(0, 4)}`,
        p_school_year: "2026-2027",
      }),
    );
    await confirmFixtureCurriculum(teacher, classId, 2);
    const { studentId, device } = await linkedStudent(teacher, classId);
    const items = (await itemsOf(device, studentId)).slice(0, 2).map((item) => item.exerciseItemId);
    const session = (await rpcOk(startSession(device, studentId, planItems(items)))) as { sessionId: string };
    const [q1, q2] = await sessionQuestions(session.sessionId);
    await rpcOk(submit(device, q1!.id, "correct"));

    // R06 sẽ làm việc này trong private.reset_class_season; ở đây chỉ mô phỏng trạng thái CSDL sau reset.
    const { data: old } = await admin
      .from("seasons")
      .select("id")
      .eq("class_id", classId)
      .eq("status", "active")
      .single();
    await rpcOk(
      admin.from("seasons").update({ status: "closed", ended_at: new Date().toISOString() }).eq("id", old!.id),
    );
    await rpcOk(admin.from("seasons").insert({ class_id: classId, seq_no: 2, rules_version: "r1" }));

    expect(errorMessage(await submit(device, q2!.id, "correct"))).toBe("SEASON_CLOSED");
    const fresh = (await rpcOk(startSession(device, studentId, planItems(items)))) as {
      sessionId: string;
      resumed: boolean;
    };
    expect(fresh.resumed).toBe(false);
    const { data: oldSession } = await admin
      .from("practice_sessions")
      .select("status")
      .eq("id", session.sessionId)
      .single();
    expect(oldSession!.status).toBe("void");
    const newQuestions = await sessionQuestions(fresh.sessionId);
    expect(newQuestions.every((question) => question.scorable)).toBe(true);
    await rpcOk(submit(device, newQuestions[0]!.id, "correct"));
    const scores = await scoreRow(studentId);
    expect(scores.map((row) => row.balance).sort()).toEqual([10, 10]);
  });
});

describe("thẻ bản đồ (30 điểm tích lũy / thẻ, kề nhau, không tiêu điểm)", () => {
  const reveal = (device: { id: string }, studentId: string, tile: string, neighbors: string[], start: boolean) =>
    admin.rpc("gateway_reveal_map_tile", {
      p_auth_user_id: device.id,
      p_student_id: studentId,
      p_map_key: "season-map-1",
      p_tile_key: tile,
      p_tile_count: 8,
      p_neighbors: neighbors,
      p_adjacent_to_start: start,
    });

  it("29 → không mở được; 30 → mở 1 thẻ kề; thẻ không kề bị từ chối; gửi lại không tốn lượt; điểm giữ nguyên", async () => {
    const { studentId, device } = await linkedStudent(world.teacherA.client, world.classA);
    expect(errorMessage(await reveal(device, studentId, "lotus_pond", [], true))).toBe("NO_TILE_AVAILABLE");
    const items = (await itemsOf(device, studentId)).slice(0, 4).map((item) => item.exerciseItemId);
    const session = (await rpcOk(startSession(device, studentId, planItems(items)))) as { sessionId: string };
    const questions = await sessionQuestions(session.sessionId);
    for (const question of questions.slice(0, 3)) await rpcOk(submit(device, question.id, "correct"));
    await rpcOk(submit(device, questions[3]!.id, "wrong"));
    expect((await scoreRow(studentId))[0]).toMatchObject({ balance: 25, earned_total: 30 });

    expect(errorMessage(await reveal(device, studentId, "flower_meadow", ["lotus_pond", "rice_field"], false))).toBe(
      "NOT_ADJACENT",
    );
    const [a, b] = await Promise.all([
      reveal(device, studentId, "lotus_pond", ["flower_meadow", "bamboo_grove"], true),
      reveal(device, studentId, "rice_field", ["flower_meadow", "kite_hill"], true),
    ]);
    expect([a, b].filter((result) => outcome(result) === "revealed")).toHaveLength(1);
    expect(errorMessage(a.error ? a : b)).toBe("NO_TILE_AVAILABLE");
    const winner = outcome(a) === "revealed" ? "lotus_pond" : "rice_field";
    expect(outcome(await reveal(device, studentId, winner, [], true))).toBe("already_revealed");
    const { count } = await admin
      .from("map_tile_reveals")
      .select("tile_key", { count: "exact", head: true })
      .eq("student_id", studentId);
    expect(count).toBe(1);
    expect((await scoreRow(studentId))[0]).toMatchObject({ balance: 25, earned_total: 30 });
  });
});

describe("dấu mở khóa game: lần đầu đạt ngưỡng, không cấp quyền vĩnh viễn", () => {
  it("đạt 50 → treasure_maze ghi một lần; tụt dưới 50 vẫn giữ dấu (quyền vào chơi xét điểm hiện tại)", async () => {
    const { studentId, device } = await linkedStudent(world.teacherA.client, world.classA);
    const items = (await itemsOf(device, studentId)).slice(0, 7).map((item) => item.exerciseItemId);
    const session = (await rpcOk(startSession(device, studentId, planItems(items)))) as { sessionId: string };
    const questions = await sessionQuestions(session.sessionId);
    const unlockedAt: string[][] = [];
    for (const question of questions.slice(0, 5)) {
      const result = await rpcOk(submit(device, question.id, "correct"));
      unlockedAt.push((result as { newlyUnlockedGames: string[] }).newlyUnlockedGames);
    }
    expect(unlockedAt).toEqual([[], [], [], [], ["treasure_maze"]]);
    await rpcOk(submit(device, questions[5]!.id, "wrong"));
    expect((await scoreRow(studentId))[0]).toMatchObject({ balance: 45 });
    const { data } = await admin.from("game_unlocks").select("game_key, balance_at_unlock").eq("student_id", studentId);
    expect(data).toEqual([{ game_key: "treasure_maze", balance_at_unlock: 50 }]);
    const again = await rpcOk(submit(device, questions[5]!.id, "correct"));
    expect((again as { newlyUnlockedGames: string[] }).newlyUnlockedGames).toEqual([]);
  });
});

describe("chống truy cập trái phép và sửa điểm", () => {
  it("thiết bị khác / đã thu hồi / chưa liên kết không nộp được câu của học sinh A", async () => {
    const { studentId, device } = await linkedStudent(world.teacherA.client, world.classA);
    const items = (await itemsOf(device, studentId)).slice(0, 1).map((item) => item.exerciseItemId);
    const session = (await rpcOk(startSession(device, studentId, planItems(items)))) as { sessionId: string };
    const [q1] = await sessionQuestions(session.sessionId);
    for (const other of [world.deviceB1, world.revokedDevice, world.unlinkedDevice]) {
      expect(errorMessage(await submit(other, q1!.id, "correct"))).toBe("FORBIDDEN");
    }
    expect(await ledger(studentId)).toHaveLength(0);
  });

  it("thiết bị/GV không gọi được hàm gateway (chỉ service_role)", async () => {
    const asDevice = await world.deviceA1.client.rpc("gateway_record_attempt", {
      p_auth_user_id: world.deviceA1.id,
      p_question_instance_id: randomUUID(),
      p_client_attempt_id: randomUUID(),
      p_response: {},
      p_response_key: "x",
      p_request_hash: "0".repeat(64),
      p_is_correct: true,
      p_error_tags: [],
      p_marks: {},
      p_grader_version: "x",
    });
    expect(asDevice.error?.code).toBe("42501");
    const asTeacher = await world.teacherA.client.rpc("gateway_reveal_map_tile", {
      p_auth_user_id: world.deviceA1.id,
      p_student_id: world.studentsA[0]!,
      p_map_key: "season-map-1",
      p_tile_key: "lotus_pond",
      p_tile_count: 8,
      p_neighbors: [],
      p_adjacent_to_start: true,
    });
    expect(asTeacher.error?.code).toBe("42501");
  });

  it("thiết bị/GV không ghi được season_scores, point_events, question_instances (không policy ghi, không GRANT)", async () => {
    for (const client of [world.deviceA1.client, world.teacherA.client]) {
      const scores = await client.from("season_scores").insert({
        season_id: randomUUID(),
        student_id: world.studentsA[0]!,
        class_id: world.classA,
        balance: 999999,
        earned_total: 999999,
      });
      expect(scores.error?.code).toBe("42501");
      const update = await client
        .from("season_scores")
        .update({ balance: 999999 })
        .eq("student_id", world.studentsA[0]!);
      expect(update.error?.code).toBe("42501");
      const event = await client.from("point_events").delete().eq("student_id", world.studentsA[0]!);
      expect(event.error?.code).toBe("42501");
    }
  });

  it("sổ cái chỉ ghi thêm: kể cả service_role không sửa/xóa trực tiếp được; số dư lệch sổ cái bị CSDL chặn", async () => {
    const { studentId, device } = await linkedStudent(world.teacherA.client, world.classA);
    const items = (await itemsOf(device, studentId)).slice(0, 1).map((item) => item.exerciseItemId);
    const session = (await rpcOk(startSession(device, studentId, planItems(items)))) as { sessionId: string };
    await rpcOk(submit(device, (await sessionQuestions(session.sessionId))[0]!.id, "correct"));
    expect(
      errorMessage(await admin.from("point_events").update({ applied_delta: 10 }).eq("student_id", studentId)),
    ).toBe("APPEND_ONLY");
    expect(errorMessage(await admin.from("point_events").delete().eq("student_id", studentId))).toBe("APPEND_ONLY");
    expect(
      errorMessage(await admin.from("item_attempts").update({ is_correct: false }).eq("student_id", studentId)),
    ).toBe("APPEND_ONLY");
    const tampered = await admin.from("season_scores").update({ balance: 999999 }).eq("student_id", studentId);
    expect(tampered.error?.code).toBe("23514");
  });

  it("RLS: thiết bị chỉ đọc điểm/sổ cái của mình; không đọc câu phát hành hay nội dung có đáp án", async () => {
    const mine = await linkedStudent(world.teacherA.client, world.classA);
    const other = await linkedStudent(world.teacherA.client, world.classA);
    for (const entry of [mine, other]) {
      const items = (await itemsOf(entry.device, entry.studentId)).slice(0, 1).map((item) => item.exerciseItemId);
      const session = (await rpcOk(startSession(entry.device, entry.studentId, planItems(items)))) as {
        sessionId: string;
      };
      await rpcOk(submit(entry.device, (await sessionQuestions(session.sessionId))[0]!.id, "correct"));
    }
    const client = mine.device.client;
    const scores = await client.from("season_scores").select("student_id, balance");
    expect(scores.data?.map((row) => row.student_id)).toEqual([mine.studentId]);
    const events = await client.from("point_events").select("student_id");
    expect(new Set(events.data?.map((row) => row.student_id))).toEqual(new Set([mine.studentId]));
    const attempts = await client.from("item_attempts").select("student_id");
    expect(new Set(attempts.data?.map((row) => row.student_id))).toEqual(new Set([mine.studentId]));
    expect((await client.from("question_instances").select("id")).data).toEqual([]);
    expect((await client.from("exercise_items").select("id, answer")).data).toEqual([]);
    expect((await client.from("exercises").select("id")).data).toEqual([]);
    const otherScore = await client.from("season_scores").select("balance").eq("student_id", other.studentId);
    expect(otherScore.data).toEqual([]);
  });

  it("RLS: GV chỉ thấy điểm lớp mình; GV lớp B không thấy lớp A", async () => {
    const entry = await linkedStudent(world.teacherA.client, world.classA);
    const items = (await itemsOf(entry.device, entry.studentId)).slice(0, 1).map((item) => item.exerciseItemId);
    const session = (await rpcOk(startSession(entry.device, entry.studentId, planItems(items)))) as {
      sessionId: string;
    };
    await rpcOk(submit(entry.device, (await sessionQuestions(session.sessionId))[0]!.id, "correct"));
    const a = await world.teacherA.client.from("season_scores").select("student_id").eq("student_id", entry.studentId);
    expect(a.data).toHaveLength(1);
    const b = await world.teacherB.client.from("season_scores").select("student_id").eq("class_id", world.classA);
    expect(b.data).toEqual([]);
    const bEvents = await world.teacherB.client.from("point_events").select("id").eq("class_id", world.classA);
    expect(bEvents.data).toEqual([]);
  });
});

describe("đồng ý và dữ liệu kiểm thử", () => {
  it("rút learning_data → buổi dở bị hủy, thiết bị mất quyền, không ghi thêm điểm", async () => {
    const { studentId, device } = await linkedStudent(world.teacherA.client, world.classA);
    const items = (await itemsOf(device, studentId)).slice(0, 2).map((item) => item.exerciseItemId);
    const session = (await rpcOk(startSession(device, studentId, planItems(items)))) as { sessionId: string };
    const [q1, q2] = await sessionQuestions(session.sessionId);
    await rpcOk(submit(device, q1!.id, "correct"));
    await rpcOk(
      world.teacherA.client.rpc("teacher_withdraw_consent", { p_student_id: studentId, p_scope: "learning_data" }),
    );
    expect(errorMessage(await submit(device, q2!.id, "correct"))).toBe("FORBIDDEN");
    const { data } = await admin.from("practice_sessions").select("status").eq("id", session.sessionId).single();
    expect(data!.status).toBe("void");
    expect(await ledger(studentId)).toHaveLength(1);
    expect((await device.client.from("season_scores").select("balance")).data).toEqual([]);
  });

  it("môi trường không cho phép fixture (như production) → không phát, không tạo được nội dung kiểm thử", async () => {
    const { studentId, device } = await linkedStudent(world.teacherA.client, world.classA);
    const ids = (await itemsOf(device, studentId)).slice(0, 1).map((item) => item.exerciseItemId);
    setTestFixturesAllowed(false);
    try {
      expect(((await candidates(device, studentId)).data as { items: unknown[] }).items).toEqual([]);
      expect(errorMessage(await startSession(device, studentId, planItems(ids)))).toBe("CONTENT_NOT_ELIGIBLE");
      const inserted = await admin.from("exercises").insert({
        key: `fixture:r04:cam-${randomUUID().slice(0, 6)}`,
        type_code: "letter_sound",
        title: "x",
        origin: "test_fixture",
      });
      expect(errorMessage(inserted)).toBe("TEST_FIXTURES_NOT_ALLOWED");
    } finally {
      setTestFixturesAllowed(true);
    }
  });
});
