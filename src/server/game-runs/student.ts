import "server-only";
import {
  buildGamePosition,
  buildGameRun,
  type GamePositionDto,
  type GameRunDto,
  parseGameCandidates,
  TREASURE_MAZE_KEY,
} from "@/features/game-runs/dto";
import { type GameRunPlan, planGameRun } from "@/features/game-runs/planner";
import type { Json } from "@/lib/supabase/database.types";
import { fail, mapDbError, ok, type Result } from "@/server/result";
import { ownsStudent, type StudentContext, vietnamDateKey } from "@/server/student-gateway/context";

/**
 * Lượt chơi Mê cung kho báu của học sinh (R07.5b1). Mọi quyết định (ngưỡng 50 điểm, đồng ý học tập, mùa active,
 * quyền sở hữu lượt, kiểm từng bước đi theo bản đồ, xung đột phiên bản) nằm ở hàm CSDL `gateway_*`; lớp này chỉ
 * chuyển tiếp, kiểm lại hình dạng phản hồi bằng zod và không bao giờ nhận class/season/điểm từ trình duyệt.
 */

/**
 * Bắt đầu hoặc tiếp tục lượt (R08.2). Lượt đang dở → CSDL trả lại đúng lượt đó, không cần nội dung. Chưa có lượt → lập kế
 * hoạch 7 chạm trán × 3 câu từ nội dung ĐÃ DUYỆT; không đủ 21 câu → không kế hoạch, CSDL trả INSUFFICIENT_CONTENT.
 * Kế hoạch chỉ là đề xuất: CSDL kiểm lại từng câu và tạo mọi thứ trong một giao dịch.
 */
export async function startGameRun(
  context: StudentContext,
  studentId: string,
  levelKey: string,
  now: Date = new Date(),
): Promise<Result<GameRunDto>> {
  if (!ownsStudent(context, studentId)) return fail("FORBIDDEN");

  let plan: GameRunPlan | null = null;
  const { data: open } = await context.admin
    .from("game_runs")
    .select("id")
    .eq("student_id", studentId)
    .eq("game_key", TREASURE_MAZE_KEY)
    .eq("level_key", levelKey)
    .eq("status", "in_progress")
    .maybeSingle();
  if (!open) {
    const candidates = await context.admin.rpc("gateway_practice_candidates", {
      p_auth_user_id: context.authUserId,
      p_student_id: studentId,
    });
    if (candidates.error) return fail(mapDbError(candidates.error));
    const parsed = parseGameCandidates(candidates.data);
    if (!parsed) return fail("UNKNOWN");
    plan = planGameRun(parsed.items, { band: parsed.band, seed: `${studentId}:${levelKey}:${vietnamDateKey(now)}` });
  }

  const { data, error } = await context.admin.rpc("gateway_start_game_run", {
    p_auth_user_id: context.authUserId,
    p_student_id: studentId,
    p_game_key: TREASURE_MAZE_KEY,
    p_level_key: levelKey,
    ...(plan ? { p_plan: plan as unknown as Json } : {}),
  });
  if (error) return fail(mapDbError(error));
  const dto = buildGameRun(data);
  return dto ? ok(dto) : fail("UNKNOWN");
}

export async function saveGamePosition(
  context: StudentContext,
  studentId: string,
  runId: string,
  path: Array<{ row: number; col: number }>,
  stateVersion: number,
): Promise<Result<GamePositionDto>> {
  if (!ownsStudent(context, studentId)) return fail("FORBIDDEN");
  const { data, error } = await context.admin.rpc("gateway_save_game_position", {
    p_auth_user_id: context.authUserId,
    p_student_id: studentId,
    p_run_id: runId,
    p_path: path,
    p_state_version: stateVersion,
  });
  if (error) return fail(mapDbError(error));
  const dto = buildGamePosition(data);
  return dto ? ok(dto) : fail("UNKNOWN");
}
