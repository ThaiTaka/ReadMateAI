import "server-only";
import { createHash } from "node:crypto";
import { feedbackFor } from "@/features/exercises/core/feedback";
import type { GradeResult, Mark, Response } from "@/features/exercises/core/primitives";
import { responseIds, responseKey } from "@/features/exercises/core/response-key";
import { responseSchema } from "@/features/exercises/core/schemas";
import { SUPPORT_POLICIES } from "@/features/exercises/core/support";
import { exerciseItemSchema, type ExerciseItem } from "@/features/exercises/items";
import { runtimeOf, VARIANTS } from "@/features/exercises/runtime-registry";
import { mergeHints } from "@/features/exercises/session/session";
import { mapProgress } from "@/features/game-world/map";
import { GAME_KEYS, type GameKey } from "@/features/gamification/rules";
import { PLANNER_VERSION, planPracticeSession, type PracticeCandidate } from "@/features/scored-practice/planner";
import type {
  AttemptDto,
  PracticeSessionDto,
  PublicQuestion,
  QuestionStatus,
  QuestionView,
  ScoreSummary,
} from "@/features/scored-practice/types";
import type { Json } from "@/lib/supabase/database.types";
import type { AppSupabaseClient } from "@/lib/supabase/server";
import { requiresTeacherRecording, resolveTeacherAudio } from "@/server/audio-playback/resolve";
import { fail, mapDbError, ok, type Result } from "@/server/result";
import { ownsStudent, vietnamDateKey, type StudentContext } from "@/server/student-gateway/context";
import type { SupportLevel } from "@/types/learning";

/**
 * Question Instance Service (R04 — REDESIGN_ARCHITECTURE §3, GAMIFICATION_SPEC §9).
 *
 * - Phát câu: lập buổi luyện một lần (câu cố định, lưu ở CSDL); tải lại trang nhận đúng buổi/câu/lượt đã dùng.
 * - Payload an toàn: trình duyệt chỉ nhận `view` + trạng thái; đáp án (`reveal`) chỉ sau khi câu đóng.
 * - Chấm ở máy chủ bằng đúng `runtime.ts` của GĐ4; ghi lượt + điểm bằng MỘT hàm CSDL (gateway_record_attempt).
 * - Client không gửi điểm/is_correct/student_id: lược đồ request là strictObject (route handler).
 */

export const GRADER_VERSION = "gd4.1-server";

/** Mỗi chạm trán đúng 3 câu (GAME_DESIGN §4.5). */
export const ENCOUNTER_QUESTION_COUNT = 3;

export type QuestionRow = {
  id: string;
  student_id: string;
  season_id: string;
  practice_session_id: string | null;
  game_encounter_id: string | null;
  position: number;
  exercise_item_id: string;
  view: Json;
  status: string;
  attempts_used: number;
  max_attempts: number;
  support_level: number;
  scorable: boolean;
};

type AttemptRow = {
  attempt_no: number;
  is_correct: boolean;
  error_tags: string[];
  marks: Json;
  response: Json;
};

const QUESTION_COLUMNS =
  "id, student_id, season_id, practice_session_id, game_encounter_id, position, exercise_item_id, view, status, attempts_used, max_attempts, support_level, scorable";

function asStatus(value: string): QuestionStatus {
  return value === "correct" || value === "exhausted" || value === "void" ? value : "open";
}

function asLevel(value: number): SupportLevel {
  return value === 0 || value === 1 || value === 2 || value === 3 ? value : 3;
}

function asMarks(value: Json): Record<string, Mark> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, Mark] => entry[1] === "correct" || entry[1] === "incorrect",
    ),
  );
}

/** Đọc câu bài tập (có đáp án) từ CSDL và kiểm lược đồ — chỉ ở máy chủ, không bao giờ trả nguyên về trình duyệt. */
export async function loadItem(admin: AppSupabaseClient, exerciseItemId: string): Promise<ExerciseItem | null> {
  const { data } = await admin
    .from("exercise_items")
    .select(
      "item_key, item_schema_version, type_code, variant, content, answer, objective, required_units, difficulty, audio",
    )
    .eq("id", exerciseItemId)
    .maybeSingle();
  if (!data) return null;
  const parsed = exerciseItemSchema.safeParse({
    id: data.item_key,
    schemaVersion: data.item_schema_version,
    type: data.type_code,
    variant: data.variant,
    objective: data.objective,
    difficulty: data.difficulty,
    requiredUnits: data.required_units,
    source: { corpusIds: [], pictureIds: [], fixtureIds: [] },
    audio: data.audio,
    content: data.content,
    answer: data.answer,
  });
  return parsed.success ? parsed.data : null;
}

async function loadAttempts(admin: AppSupabaseClient, questionId: string): Promise<AttemptRow[]> {
  const { data } = await admin
    .from("item_attempts")
    .select("attempt_no, is_correct, error_tags, marks, response")
    .eq("question_instance_id", questionId)
    .order("attempt_no");
  return data ?? [];
}

/** Câu cho trình duyệt: `view` lấy từ câu phát hành (không đáp án); gợi ý/phản hồi/đáp án tính ở máy chủ. */
export function toPublicQuestion(
  row: QuestionRow,
  item: ExerciseItem,
  attempts: readonly AttemptRow[],
  total: number,
): PublicQuestion {
  const status = asStatus(row.status);
  const level = asLevel(row.support_level);
  const policy = SUPPORT_POLICIES[level];
  const runtime = runtimeOf(item);
  const closed = status === "correct" || status === "exhausted";
  const last = attempts.at(-1) ?? null;
  const wrong = attempts.filter((attempt) => !attempt.is_correct).length;
  const steps = status === "open" && policy.hints !== "none" && wrong > 0 ? runtime.hints(item) : [];
  const grade: GradeResult | null = last
    ? { correct: last.is_correct, errorTags: last.error_tags, marks: asMarks(last.marks) }
    : null;
  const parsedLast = last ? responseSchema.safeParse(last.response) : null;
  return {
    id: row.id,
    sessionId: row.practice_session_id ?? "",
    position: row.position,
    total,
    view: row.view as unknown as QuestionView,
    status,
    attemptsUsed: row.attempts_used,
    maxAttempts: row.max_attempts,
    supportLevel: level,
    scorable: row.scorable,
    lastResponse: parsedLast?.success ? parsedLast.data : null,
    marks: grade?.marks ?? {},
    feedback:
      grade && last && status !== "void"
        ? feedbackFor({
            variant: item.variant,
            grade,
            attemptNo: last.attempt_no,
            maxAttempts: row.max_attempts,
            position: row.position - 1,
            reveal: runtime.reveal(item),
          })
        : null,
    hint: mergeHints(steps.slice(0, Math.min(wrong, steps.length))),
    hintMode: policy.hints,
    reveal: closed ? runtime.reveal(item) : null,
  };
}

async function scoreOf(admin: AppSupabaseClient, seasonId: string, studentId: string): Promise<ScoreSummary> {
  const { data } = await admin
    .from("season_scores")
    .select("balance, earned_total")
    .eq("season_id", seasonId)
    .eq("student_id", studentId)
    .maybeSingle();
  return { balance: data?.balance ?? 0, earnedTotal: data?.earned_total ?? 0 };
}

async function sessionDto(admin: AppSupabaseClient, sessionId: string): Promise<Result<PracticeSessionDto>> {
  const [{ data: session }, { data: questions }] = await Promise.all([
    admin.from("practice_sessions").select("id, status, student_id, season_id").eq("id", sessionId).maybeSingle(),
    admin.from("question_instances").select(QUESTION_COLUMNS).eq("practice_session_id", sessionId).order("position"),
  ]);
  if (!session || !questions) return fail("NOT_FOUND");
  const currentRow = questions.find((question) => question.status === "open") ?? null;
  const ids = questions.map((question) => question.id);
  const [score, events, current] = await Promise.all([
    scoreOf(admin, session.season_id, session.student_id),
    ids.length > 0
      ? admin.from("point_events").select("nominal_delta").in("question_instance_id", ids)
      : Promise.resolve({ data: [] as Array<{ nominal_delta: number }> }),
    currentRow
      ? Promise.all([loadItem(admin, currentRow.exercise_item_id), loadAttempts(admin, currentRow.id)])
      : Promise.resolve(null),
  ]);
  let currentQuestion: PublicQuestion | null = null;
  if (currentRow && current) {
    const [item, attempts] = current;
    if (!item) return fail("UNKNOWN");
    currentQuestion = toPublicQuestion(currentRow, item, attempts, questions.length);
  }
  const status =
    session.status === "completed" || session.status === "abandoned" || session.status === "void"
      ? session.status
      : "in_progress";
  return ok({
    id: session.id,
    status,
    questions: questions.map((question) => ({
      id: question.id,
      position: question.position,
      status: asStatus(question.status),
      scorable: question.scorable,
    })),
    current: currentQuestion,
    summary: {
      total: questions.length,
      correct: questions.filter((question) => question.status === "correct").length,
      closed: questions.filter((question) => question.status !== "open").length,
      earnedInSession: (events.data ?? []).reduce((sum, event) => sum + Math.max(0, event.nominal_delta), 0),
    },
    score,
  });
}

/** Buổi luyện đang làm của học sinh (đã kiểm tra quyền), hoặc null. */
export async function openSessionId(admin: AppSupabaseClient, studentId: string): Promise<string | null> {
  const { data } = await admin
    .from("practice_sessions")
    .select("id")
    .eq("student_id", studentId)
    .eq("status", "in_progress")
    .maybeSingle();
  return data?.id ?? null;
}

function isCandidate(value: unknown): value is PracticeCandidate {
  if (!value || typeof value !== "object") return false;
  const entry = value as Record<string, unknown>;
  return (
    typeof entry.exerciseItemId === "string" &&
    typeof entry.fingerprint === "string" &&
    typeof entry.typeCode === "string" &&
    typeof entry.variant === "string" &&
    typeof entry.lessonOrdinal === "number" &&
    typeof entry.scoredInSeason === "boolean"
  );
}

/**
 * Mở buổi luyện đang dở, hoặc lập buổi mới từ nội dung ĐÃ DUYỆT đủ điều kiện. Không có nội dung → INSUFFICIENT_CONTENT
 * (chế độ học thật không nới quy tắc, không dùng dữ liệu minh họa).
 */
export async function startOrResumePractice(
  context: StudentContext,
  studentId: string,
  now: Date,
): Promise<Result<PracticeSessionDto>> {
  if (!ownsStudent(context, studentId)) return fail("FORBIDDEN");
  const existing = await openSessionId(context.admin, studentId);
  if (existing) return sessionDto(context.admin, existing);

  const candidates = await context.admin.rpc("gateway_practice_candidates", {
    p_auth_user_id: context.authUserId,
    p_student_id: studentId,
  });
  if (candidates.error) return fail(mapDbError(candidates.error));
  const payload = candidates.data as { band?: unknown; items?: unknown } | null;
  const band = payload?.band;
  if (band !== "foundation" && band !== "developing" && band !== "extending") return fail("NO_BAND");
  const items = Array.isArray(payload?.items) ? payload.items.filter(isCandidate) : [];
  const plan = planPracticeSession(items, { band, seed: `${studentId}:${vietnamDateKey(now)}` });
  if (!plan) return fail("INSUFFICIENT_CONTENT");

  const started = await context.admin.rpc("gateway_start_practice_session", {
    p_auth_user_id: context.authUserId,
    p_student_id: studentId,
    p_items: plan as unknown as Json,
    p_planner_version: PLANNER_VERSION,
  });
  if (started.error) return fail(mapDbError(started.error));
  const sessionId = (started.data as { sessionId?: unknown } | null)?.sessionId;
  if (typeof sessionId !== "string") return fail("UNKNOWN");
  return sessionDto(context.admin, sessionId);
}

/** Buổi luyện theo mã — chỉ khi thuộc một học sinh của thiết bị (không phân biệt "không có" với "không có quyền"). */
export async function getPracticeSession(
  context: StudentContext,
  sessionId: string,
): Promise<Result<PracticeSessionDto>> {
  const { data } = await context.admin.from("practice_sessions").select("student_id").eq("id", sessionId).maybeSingle();
  if (!data || !ownsStudent(context, data.student_id)) return fail("NOT_FOUND");
  return sessionDto(context.admin, sessionId);
}

export async function ownedQuestion(context: StudentContext, questionId: string): Promise<QuestionRow | null> {
  const { data } = await context.admin
    .from("question_instances")
    .select(QUESTION_COLUMNS)
    .eq("id", questionId)
    .maybeSingle();
  return data && ownsStudent(context, data.student_id) ? data : null;
}

async function questionTotal(admin: AppSupabaseClient, row: QuestionRow): Promise<number> {
  if (row.game_encounter_id) return ENCOUNTER_QUESTION_COUNT;
  if (!row.practice_session_id) return 1;
  const { count } = await admin
    .from("question_instances")
    .select("id", { count: "exact", head: true })
    .eq("practice_session_id", row.practice_session_id);
  return count ?? 1;
}

/**
 * Câu của chạm trán chỉ đọc được khi nó là câu hiện tại của chạm trán ĐANG DIỄN RA (hoặc đã đóng). Câu của chạm trán chưa
 * kích hoạt và câu sau khi câu trước chưa đóng không lộ nội dung (R08.3). Nộp bài thì CSDL tự chặn các trường hợp này.
 */
export async function readableNow(admin: AppSupabaseClient, row: QuestionRow): Promise<boolean> {
  if (!row.game_encounter_id || row.status !== "open") return true;
  const { data: encounter } = await admin
    .from("game_encounters")
    .select("status")
    .eq("id", row.game_encounter_id)
    .maybeSingle();
  if (encounter?.status !== "active") return false;
  const { count } = await admin
    .from("question_instances")
    .select("id", { count: "exact", head: true })
    .eq("game_encounter_id", row.game_encounter_id)
    .eq("status", "open")
    .lt("position", row.position);
  return (count ?? 0) === 0;
}

export async function getQuestion(context: StudentContext, questionId: string): Promise<Result<PublicQuestion>> {
  const row = await ownedQuestion(context, questionId);
  if (!row || !(await readableNow(context.admin, row))) return fail("NOT_FOUND");
  const [item, attempts, total] = await Promise.all([
    loadItem(context.admin, row.exercise_item_id),
    loadAttempts(context.admin, row.id),
    questionTotal(context.admin, row),
  ]);
  if (!item) return fail("UNKNOWN");
  return ok(toPublicQuestion(row, item, attempts, total));
}

/** Câu trả lời phải đúng kiểu của biến thể, chỉ nhắc tới mã có trong câu, và đã đủ để chấm. */
function responseFits(item: ExerciseItem, response: Response): boolean {
  if (VARIANTS[item.variant].responseKind !== response.kind) return false;
  const known = new Set<string>();
  const collect = (value: unknown): void => {
    if (Array.isArray(value)) value.forEach(collect);
    else if (value && typeof value === "object") {
      const record = value as Record<string, unknown>;
      if (typeof record.id === "string") known.add(record.id);
      Object.values(record).forEach(collect);
    }
  };
  collect(item.content);
  if (!responseIds(response).every((id) => known.has(id))) return false;
  return runtimeOf(item).isComplete(item, response);
}

export function requestHash(questionId: string, key: string): string {
  return createHash("sha256").update(`${questionId}|${key}`, "utf8").digest("hex");
}

type RecordedAttempt = {
  outcome?: string;
  points?: { nominalDelta?: number; appliedDelta?: number } | null;
  score?: { balance?: number; earnedTotal?: number };
  sessionStatus?: string | null;
  encounter?: { encounterNo?: unknown; status?: unknown; hpRemaining?: unknown } | null;
  newlyUnlockedGames?: unknown;
};

const ENCOUNTER_STATUSES = ["active", "defeated", "undefeated", "void"] as const;

/** Trạng thái chạm trán sau lượt nộp (chỉ câu của game có); sai hình dạng → null. */
function encounterOf(raw: RecordedAttempt["encounter"]): AttemptDto["encounter"] {
  if (!raw) return null;
  const status = ENCOUNTER_STATUSES.find((value) => value === raw.status);
  const no = Number(raw.encounterNo);
  const hp = Number(raw.hpRemaining);
  if (!status || !Number.isInteger(no) || !Number.isInteger(hp) || hp < 0 || hp > 3) return null;
  return { encounterNo: no, status, hpRemaining: hp };
}

/**
 * Nộp một lượt: kiểm tra quyền → chấm ở máy chủ → ghi nguyên tử. Gửi lại cùng `clientAttemptId` → kết quả cũ.
 */
export async function submitAttempt(
  context: StudentContext,
  questionId: string,
  input: { clientAttemptId: string; response: Response },
): Promise<Result<AttemptDto>> {
  const row = await ownedQuestion(context, questionId);
  if (!row) return fail("NOT_FOUND");
  const item = await loadItem(context.admin, row.exercise_item_id);
  if (!item) return fail("UNKNOWN");
  if (!responseFits(item, input.response)) return fail("INVALID_INPUT");

  // Câu bắt buộc NGHE bản ghi giáo viên mà chưa có bản đã duyệt phát được thì không tính điểm (không điểm giả). Lượt đã
  // ghi (gửi lại cùng clientAttemptId) không bị chặn ở đây — CSDL trả đúng kết quả cũ.
  if (row.scorable && requiresTeacherRecording(item)) {
    const { data: prior } = await context.admin
      .from("item_attempts")
      .select("id")
      .eq("client_attempt_id", input.clientAttemptId)
      .maybeSingle();
    if (!prior) {
      const playable = await resolveTeacherAudio(context, row, item, "stimulus", { ignoreSoundPreference: true });
      if (!playable.ok) return fail("AUDIO_NOT_AVAILABLE");
    }
  }

  const grade = runtimeOf(item).grade(item, input.response);
  const key = responseKey(input.response);
  const recorded = await context.admin.rpc("gateway_record_attempt", {
    p_auth_user_id: context.authUserId,
    p_question_instance_id: row.id,
    p_client_attempt_id: input.clientAttemptId,
    p_response: input.response as unknown as Json,
    p_response_key: key,
    p_request_hash: requestHash(row.id, key),
    p_is_correct: grade.correct,
    p_error_tags: grade.errorTags,
    p_marks: grade.marks as unknown as Json,
    p_grader_version: GRADER_VERSION,
  });
  if (recorded.error) return fail(mapDbError(recorded.error));
  const result = recorded.data as RecordedAttempt | null;

  const [fresh, attempts, total, reveals] = await Promise.all([
    ownedQuestion(context, questionId),
    loadAttempts(context.admin, row.id),
    questionTotal(context.admin, row),
    context.admin
      .from("map_tile_reveals")
      .select("tile_key", { count: "exact", head: true })
      .eq("season_id", row.season_id)
      .eq("student_id", row.student_id),
  ]);
  if (!fresh) return fail("NOT_FOUND");
  const score: ScoreSummary = {
    balance: Number(result?.score?.balance ?? 0),
    earnedTotal: Number(result?.score?.earnedTotal ?? 0),
  };
  const unlocked = Array.isArray(result?.newlyUnlockedGames)
    ? result.newlyUnlockedGames.filter((key): key is GameKey => (GAME_KEYS as readonly unknown[]).includes(key))
    : [];
  const sessionStatus = result?.sessionStatus;
  return ok({
    question: toPublicQuestion(fresh, item, attempts, total),
    points:
      result?.points && typeof result.points.nominalDelta === "number" && typeof result.points.appliedDelta === "number"
        ? { nominalDelta: result.points.nominalDelta, appliedDelta: result.points.appliedDelta }
        : null,
    score,
    tilesAvailable: mapProgress(score.earnedTotal, reveals.count ?? 0).available,
    newlyUnlockedGames: unlocked,
    sessionStatus:
      sessionStatus === "completed" || sessionStatus === "abandoned" || sessionStatus === "void"
        ? sessionStatus
        : "in_progress",
    encounter: encounterOf(result?.encounter),
    replayed: result?.outcome === "replayed",
  });
}

/** Câu công khai (không đáp án trước khi đóng) theo mã — dùng cho chạm trán; người gọi đã kiểm quyền sở hữu. */
export async function publicQuestionOf(admin: AppSupabaseClient, questionId: string): Promise<PublicQuestion | null> {
  const { data: row } = await admin
    .from("question_instances")
    .select(QUESTION_COLUMNS)
    .eq("id", questionId)
    .maybeSingle();
  if (!row) return null;
  const [item, attempts, total] = await Promise.all([
    loadItem(admin, row.exercise_item_id),
    loadAttempts(admin, row.id),
    questionTotal(admin, row),
  ]);
  return item ? toPublicQuestion(row, item, attempts, total) : null;
}
