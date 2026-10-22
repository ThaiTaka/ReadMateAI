import { randomUUID } from "node:crypto";
import { execSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { GAME_FIXTURE_EXERCISES } from "../../scripts/fixtures/game-items";
import { installGameFixtures } from "../../scripts/lib/game-fixtures";
import type { InstalledFixtures } from "../../scripts/lib/scoring-fixtures";
import { enableLocalTestFixtures } from "../../scripts/lib/test-fixtures";
import { planGameRun, type GameRunPlan } from "../../src/features/game-runs/planner";
import type { PracticeCandidate } from "../../src/features/scored-practice/planner";
import type { Json } from "../../src/lib/supabase/database.types";
import type { Band } from "../../src/types/learning";
import { admin, newSchool, newTeacher, rpcOk, type Db } from "./helpers";
import type { Mem } from "./board-helpers";
import { candidates, linkedStudent, planItems, sessionQuestions, startSession, submit } from "./scoring-helpers";

/**
 * Trợ giúp kiểm thử R08.2 trên Supabase LOCAL: chuỗi bài fixture RIÊNG của game (> 21 câu khác nhau), lớp dùng chuỗi đó,
 * học sinh có điểm thật (làm bài qua gateway ghi điểm) và lệnh bắt đầu lượt có kế hoạch như student gateway.
 */

export const LEVEL = "treasure-maze-01";
export type Pos = { row: number; col: number };

let installed: InstalledFixtures | null = null;

export async function gameFixtures(): Promise<InstalledFixtures> {
  if (installed) return installed;
  enableLocalTestFixtures();
  const school = await newSchool();
  const reviewer = await newTeacher(school, "gv-duyet-game");
  installed = await installGameFixtures(admin, reviewer.id);
  return installed;
}

export async function newGameClass(teacher: Db, lesson: 1 | 2 | 3 = 2): Promise<{ id: string; name: string }> {
  const fx = await gameFixtures();
  const name = `Lớp R82 ${randomUUID().slice(0, 6)}`;
  const id = await rpcOk(teacher.rpc("teacher_create_class", { p_name: name, p_school_year: "2026-2027" }));
  await rpcOk(
    teacher.rpc("teacher_set_class_curriculum", {
      p_class_id: id,
      p_series_id: fx.seriesId,
      p_lesson_id: fx.lessonIds[lesson],
    }),
  );
  await rpcOk(teacher.rpc("teacher_confirm_class_curriculum", { p_class_id: id }));
  return { id, name };
}

export async function gameMember(
  teacher: Db,
  classId: string,
  options: { band?: Band | null; consent?: boolean; burn?: number } = {},
): Promise<Mem> {
  const { studentId, device } = await linkedStudent(teacher, classId, { band: options.band, consent: options.consent });
  const mem: Mem = { studentId, device, alias: "" };
  if (options.burn) await burn(mem, options.burn);
  return mem;
}

/** Làm đúng `count` câu KHÁC NHAU (một buổi luyện) → +10 điểm mỗi câu và `count` nội dung đã tính điểm trong mùa. */
export async function burn(mem: Mem, count: number): Promise<void> {
  const result = await candidates(mem.device, mem.studentId);
  const list = (
    result.data as { items: Array<{ exerciseItemId: string; fingerprint: string; scoredInSeason: boolean }> }
  ).items;
  const seen = new Set<string>();
  const ids = list
    .filter((item) => !item.scoredInSeason && !seen.has(item.fingerprint) && seen.add(item.fingerprint))
    .slice(0, count)
    .map((item) => item.exerciseItemId);
  if (ids.length < count) throw new Error("không đủ nội dung fixture để làm bài");
  const session = (await rpcOk(startSession(mem.device, mem.studentId, planItems(ids)))) as { sessionId: string };
  for (const question of await sessionQuestions(session.sessionId))
    await rpcOk(submit(mem.device, question.id, "correct"));
}

type CandidatePayload = { band: Band; items: PracticeCandidate[] };

/** Kế hoạch như student gateway lập (cùng hàm thuần, ứng viên thật từ CSDL). */
export async function realPlan(mem: Mem, seed = "r82-test"): Promise<GameRunPlan | null> {
  const result = await candidates(mem.device, mem.studentId);
  const payload = result.data as CandidatePayload;
  return planGameRun(payload.items, { band: payload.band, seed });
}

/** Kế hoạch đúng hình dạng nhưng mã câu ngẫu nhiên — chỉ dùng khi lỗi phải xảy ra TRƯỚC khi đọc câu. */
export function fakePlan(): GameRunPlan {
  return {
    encounters: Array.from({ length: 7 }, (_, e) => ({
      monsterKey: `mon-fake-${e + 1}`,
      questions: Array.from({ length: 3 }, () => ({ exerciseItemId: randomUUID(), supportLevel: 2, maxAttempts: 3 })),
    })),
  };
}

export const startWith = (mem: Mem, plan: GameRunPlan | null, level = LEVEL, studentId = mem.studentId) =>
  admin.rpc("gateway_start_game_run", {
    p_auth_user_id: mem.device.id,
    p_student_id: studentId,
    p_game_key: "treasure_maze",
    p_level_key: level,
    ...(plan ? { p_plan: plan as unknown as Json } : {}),
  });

export const runOf = (result: { data: unknown }) =>
  (result.data as { outcome: string; run: { id: string; position: Pos; state_version: number; scored: boolean } }).run;

/** Mã câu của một bài tập fixture, theo thứ tự vị trí. */
export async function itemIdsOf(exerciseKey: string): Promise<string[]> {
  const exercise = await admin.from("exercises").select("id").eq("key", exerciseKey).single();
  const version = await admin.from("exercise_versions").select("id").eq("exercise_id", exercise.data!.id).single();
  const items = await admin
    .from("exercise_items")
    .select("id")
    .eq("exercise_version_id", version.data!.id)
    .order("position");
  return items.data!.map((row) => row.id);
}

/** Thay phần tử `index` của kế hoạch bằng câu khác (giữ nguyên mọi thứ còn lại). */
export function withItem(plan: GameRunPlan, flat: number, exerciseItemId: string): GameRunPlan {
  const copy = structuredClone(plan);
  copy.encounters[Math.floor(flat / 3)]!.questions[flat % 3]!.exerciseItemId = exerciseItemId;
  return copy;
}

export async function counts(studentId: string) {
  const [runs, encounters, questions] = await Promise.all([
    admin.from("game_runs").select("id").eq("student_id", studentId),
    admin.from("game_encounters").select("id").eq("student_id", studentId),
    admin.from("question_instances").select("id").eq("student_id", studentId).eq("context_kind", "game_encounter"),
  ]);
  return { runs: runs.data!.length, encounters: encounters.data!.length, questions: questions.data!.length };
}

/** Chạy từng lệnh SQL trên CSDL LOCAL (CLI không nhận nhiều lệnh một lần) — chỉ để chèn lỗi giả lập kiểm thử rollback. */
export function localSql(...statements: string[]): void {
  for (const sql of statements) {
    const dir = mkdtempSync(join(tmpdir(), "rm-sql-"));
    const file = join(dir, "q.sql");
    writeFileSync(file, sql, "utf8");
    execSync(`npx supabase db query --local -f "${file}"`, { stdio: ["ignore", "ignore", "pipe"] });
  }
}

export const FIXTURE_APPROVED_KEYS = GAME_FIXTURE_EXERCISES.filter((e) => e.status === "approved").map((e) => e.key);
