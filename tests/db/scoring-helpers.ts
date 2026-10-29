import { createHash, randomUUID } from "node:crypto";
import { execSync } from "node:child_process";
import { responseKey } from "../../src/features/exercises/core/response-key";
import type { Json } from "../../src/lib/supabase/database.types";
import { installScoringFixtures, type InstalledFixtures } from "../../scripts/lib/scoring-fixtures";
import { enableLocalTestFixtures } from "../../scripts/lib/test-fixtures";
import { admin, issueCode, newDevice, newSchool, newTeacher, redeem, rpcOk, type Actor, type Db } from "./helpers";

/**
 * Trợ giúp kiểm thử tích hợp R04 (Supabase LOCAL thật): cài nội dung fixture hư cấu, dựng học sinh có thiết bị liên
 * kết thật, và nộp lượt trả lời ĐÚNG như student gateway (máy chủ chấm rồi gọi gateway_record_attempt bằng
 * service_role). Đáp án lấy từ CSDL bằng client đặc quyền — chỉ để kiểm thử.
 */

export type Band = "foundation" | "developing" | "extending";

let installed: InstalledFixtures | null = null;

export async function fixtures(): Promise<InstalledFixtures> {
  if (installed) return installed;
  enableLocalTestFixtures();
  const school = await newSchool();
  const reviewer = await newTeacher(school, "gv-duyet");
  installed = await installScoringFixtures(admin, reviewer.id);
  return installed;
}

export function setTestFixturesAllowed(allowed: boolean): void {
  execSync(
    `npx supabase db query --local "update private.test_environment set fixtures_allowed = ${allowed} where singleton"`,
    { stdio: ["ignore", "ignore", "pipe"] },
  );
}

/** Lớp của GV dùng chuỗi bài kiểm thử, tiến độ ĐÃ XÁC NHẬN ở bài `lesson` (qua đúng hàm teacher_* bằng JWT GV). */
export async function confirmFixtureCurriculum(teacher: Db, classId: string, lesson: 1 | 2 | 3 = 2): Promise<void> {
  const fx = await fixtures();
  await rpcOk(
    teacher.rpc("teacher_set_class_curriculum", {
      p_class_id: classId,
      p_series_id: fx.seriesId,
      p_lesson_id: fx.lessonIds[lesson],
    }),
  );
  await rpcOk(teacher.rpc("teacher_confirm_class_curriculum", { p_class_id: classId }));
}

let counter = 0;

/** Học sinh mới (biệt danh hư cấu) + thiết bị liên kết thật; tùy chọn nhóm và đồng ý learning_data. */
export async function linkedStudent(
  teacher: Db,
  classId: string,
  options: { band?: Band | null; consent?: boolean } = {},
): Promise<{ studentId: string; device: Actor; token: string }> {
  counter += 1;
  const studentId = await rpcOk(
    teacher.rpc("teacher_create_student", {
      p_class_id: classId,
      p_display_name: `Bé thử ${String.fromCharCode(65 + (counter % 26))}${counter}`,
      p_student_number: null as unknown as number,
      p_avatar_key: "may",
    }),
  );
  if (options.band !== null) {
    await rpcOk(
      teacher.rpc("teacher_assign_band", {
        p_student_id: studentId,
        p_band: options.band ?? "developing",
        p_reason: "",
      }),
    );
  }
  if (options.consent !== false) {
    await rpcOk(
      teacher.rpc("teacher_record_consent", {
        p_student_id: studentId,
        p_scope: "learning_data",
        p_notice_version: "kiem-thu",
        p_method: "paper_form",
        p_note: "",
        p_attested: true,
      }),
    );
  }
  const code = await issueCode(teacher, studentId);
  const device = await newDevice();
  await redeem("backup", code.backup, device.id);
  return { studentId, device, token: code.token };
}

export type Candidate = {
  exerciseItemId: string;
  fingerprint: string;
  lessonOrdinal: number;
  scoredInSeason: boolean;
};

export async function candidates(device: Actor, studentId: string) {
  return admin.rpc("gateway_practice_candidates", { p_auth_user_id: device.id, p_student_id: studentId });
}

export function planItems(
  ids: string[],
  options: { supportLevel?: number; maxAttempts?: number; scorable?: boolean } = {},
) {
  return ids.map((id) => ({
    exerciseItemId: id,
    supportLevel: options.supportLevel ?? 2,
    maxAttempts: options.maxAttempts ?? 3,
    scorable: options.scorable ?? true,
  }));
}

export async function startSession(device: Actor, studentId: string, items: ReturnType<typeof planItems>) {
  return admin.rpc("gateway_start_practice_session", {
    p_auth_user_id: device.id,
    p_student_id: studentId,
    p_items: items as unknown as Json,
    p_planner_version: "test",
  });
}

export async function sessionQuestions(sessionId: string) {
  const { data, error } = await admin
    .from("question_instances")
    .select(
      "id, position, status, scorable, not_scorable_reason, attempts_used, max_attempts, exercise_item_id, content_fingerprint, rewarded",
    )
    .eq("practice_session_id", sessionId)
    .order("position");
  if (error) throw error;
  return data;
}

type Option = { id: string; text: string };
type ItemRow = { content: { sample: string; options: Option[] }; answer: { optionId: string } };

export async function itemFor(questionId: string): Promise<ItemRow> {
  const { data: q } = await admin.from("question_instances").select("exercise_item_id").eq("id", questionId).single();
  const { data } = await admin.from("exercise_items").select("content, answer").eq("id", q!.exercise_item_id).single();
  return data as unknown as ItemRow;
}

export function requestHash(questionId: string, key: string): string {
  return createHash("sha256").update(`${questionId}|${key}`, "utf8").digest("hex");
}

/** Nộp như máy chủ: chấm (đáp án ở CSDL) rồi gọi hàm ghi điểm. `pick` = "correct" | "wrong" | mã phương án. */
export async function submit(
  device: Actor,
  questionId: string,
  pick: "correct" | "wrong" | "wrong2" | string,
  clientAttemptId: string = randomUUID(),
) {
  const item = await itemFor(questionId);
  const wrongs = item.content.options.filter((option) => option.id !== item.answer.optionId).map((option) => option.id);
  const optionId =
    pick === "correct" ? item.answer.optionId : pick === "wrong" ? wrongs[0]! : pick === "wrong2" ? wrongs[1]! : pick;
  const correct = optionId === item.answer.optionId;
  const response = { kind: "choice" as const, optionId };
  const key = responseKey(response);
  return admin.rpc("gateway_record_attempt", {
    p_auth_user_id: device.id,
    p_question_instance_id: questionId,
    p_client_attempt_id: clientAttemptId,
    p_response: response as unknown as Json,
    p_response_key: key,
    p_request_hash: requestHash(questionId, key),
    p_is_correct: correct,
    p_error_tags: correct ? [] : ["distractor:other"],
    p_marks: { [optionId]: correct ? "correct" : "incorrect" },
    p_grader_version: "test",
  });
}

export async function scoreRow(studentId: string) {
  const { data } = await admin
    .from("season_scores")
    .select("season_id, balance, earned_total, deducted_total")
    .eq("student_id", studentId);
  return data ?? [];
}

export async function ledger(studentId: string) {
  const { data } = await admin
    .from("point_events")
    .select("outcome, nominal_delta, applied_delta, balance_before, balance_after, idempotency_key, created_at")
    .eq("student_id", studentId)
    .order("created_at");
  return data ?? [];
}

export function errorMessage(result: { error: { message?: string } | null }): string | null {
  return result.error?.message ?? null;
}
