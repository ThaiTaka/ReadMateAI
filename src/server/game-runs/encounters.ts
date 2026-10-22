import "server-only";
import {
  type ActivateEncounterDto,
  buildActivation,
  buildTreasure,
  type EncounterDto,
  type EncounterStateDto,
  type TreasureDto,
} from "@/features/game-runs/encounter-dto";
import type { PublicQuestion, QuestionStatus } from "@/features/scored-practice/types";
import type { AppSupabaseClient } from "@/lib/supabase/server";
import { ENCOUNTER_QUESTION_COUNT, publicQuestionOf } from "@/server/question-instances/service";
import { fail, mapDbError, ok, type Result } from "@/server/result";
import { ownsStudent, type StudentContext } from "@/server/student-gateway/context";

/**
 * Chạm trán và kho báu của Mê cung (R08.3). Mọi quyết định (vị trí đứng, trạng thái chạm trán, thứ tự câu, điểm, HP, đủ 7/7)
 * nằm ở hàm CSDL; lớp này chỉ chuyển tiếp, dựng DTO (zod) và không bao giờ nhận vị trí/HP/điểm từ trình duyệt.
 */

function asQuestionStatus(value: string): QuestionStatus {
  return value === "correct" || value === "exhausted" || value === "void" ? value : "open";
}

/** Chạm trán đang diễn ra của lượt (nếu có) cùng ba câu — chỉ câu hiện tại mang nội dung. */
async function activeEncounterDto(admin: AppSupabaseClient, encounterId: string): Promise<EncounterDto | null> {
  const [{ data: encounter }, { data: questions }] = await Promise.all([
    admin
      .from("game_encounters")
      .select("id, encounter_no, monster_key, hp_remaining, status")
      .eq("id", encounterId)
      .maybeSingle(),
    admin
      .from("question_instances")
      .select("id, position, status")
      .eq("game_encounter_id", encounterId)
      .order("position"),
  ]);
  if (!encounter || encounter.status !== "active" || !questions || questions.length !== ENCOUNTER_QUESTION_COUNT) {
    return null;
  }
  const summary = questions.map((question) => ({
    id: question.id,
    position: question.position,
    status: asQuestionStatus(question.status),
  }));
  const currentId = summary.find((question) => question.status === "open")?.id ?? null;
  const current: PublicQuestion | null = currentId ? await publicQuestionOf(admin, currentId) : null;
  if (currentId && !current) return null;
  return {
    id: encounter.id,
    encounterNo: encounter.encounter_no,
    monsterKey: encounter.monster_key,
    hpRemaining: encounter.hp_remaining,
    questions: summary,
    current,
    progress: {
      total: summary.length,
      closed: summary.filter((question) => question.status !== "open").length,
      correct: summary.filter((question) => question.status === "correct").length,
    },
  };
}

async function stateOf(admin: AppSupabaseClient, runId: string): Promise<Result<EncounterStateDto>> {
  const [{ data: run }, { data: encounters }] = await Promise.all([
    admin.from("game_runs").select("id, encounter_count").eq("id", runId).maybeSingle(),
    admin.from("game_encounters").select("id, status").eq("run_id", runId),
  ]);
  if (!run || !encounters) return fail("NOT_FOUND");
  const active = encounters.find((encounter) => encounter.status === "active") ?? null;
  const dto = active ? await activeEncounterDto(admin, active.id) : null;
  if (active && !dto) return fail("UNKNOWN");
  return ok({
    runId: run.id,
    encounter: dto,
    progress: {
      resolved: encounters.filter((encounter) => encounter.status === "defeated" || encounter.status === "undefeated")
        .length,
      total: run.encounter_count,
    },
  });
}

/** Trạng thái chạm trán của lượt (tải lại trang): chỉ chạm trán đang diễn ra, không đáp án, không phần chưa xuất hiện. */
export async function getEncounterState(context: StudentContext, runId: string): Promise<Result<EncounterStateDto>> {
  const { data } = await context.admin.from("game_runs").select("student_id").eq("id", runId).maybeSingle();
  if (!data || !ownsStudent(context, data.student_id)) return fail("NOT_FOUND");
  return stateOf(context.admin, runId);
}

/** Kích hoạt chạm trán tại ô nhân vật đang đứng (vị trí lưu ở CSDL). Gọi lại → trả chạm trán đang diễn ra. */
export async function activateEncounter(
  context: StudentContext,
  studentId: string,
  runId: string,
): Promise<Result<ActivateEncounterDto>> {
  if (!ownsStudent(context, studentId)) return fail("FORBIDDEN");
  const { data, error } = await context.admin.rpc("gateway_activate_encounter", {
    p_auth_user_id: context.authUserId,
    p_student_id: studentId,
    p_run_id: runId,
  });
  if (error) return fail(mapDbError(error));
  const activation = buildActivation(data);
  if (!activation) return fail("UNKNOWN");
  const state = await stateOf(context.admin, runId);
  if (!state.ok) return state;
  if (state.data.encounter?.id !== activation.encounterId) return fail("UNKNOWN");
  return ok({ outcome: activation.outcome, state: state.data });
}

/** Mở kho báu: chỉ khi đứng đúng ô rương và cả 7 chạm trán đã kết thúc. Không cộng điểm; gửi lại → kết quả cũ. */
export async function openTreasure(
  context: StudentContext,
  studentId: string,
  runId: string,
): Promise<Result<TreasureDto>> {
  if (!ownsStudent(context, studentId)) return fail("FORBIDDEN");
  const { data, error } = await context.admin.rpc("gateway_open_treasure", {
    p_auth_user_id: context.authUserId,
    p_student_id: studentId,
    p_run_id: runId,
  });
  if (error) return fail(mapDbError(error));
  const dto = buildTreasure(data);
  return dto ? ok(dto) : fail("UNKNOWN");
}
