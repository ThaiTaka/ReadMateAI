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
  replay = false,
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
    // Chơi lại: thêm số lượt đã hoàn thành vào seed để mỗi lần chơi lại có thứ tự câu/quái vật khác nhau.
    const finished = replay
      ? ((
          await context.admin
            .from("game_runs")
            .select("id", { count: "exact", head: true })
            .eq("student_id", studentId)
            .eq("game_key", TREASURE_MAZE_KEY)
            .eq("level_key", levelKey)
            .eq("status", "completed")
        ).count ?? 0)
      : 0;
    plan = planGameRun(parsed.items, {
      band: parsed.band,
      seed: `${studentId}:${levelKey}:${vietnamDateKey(now)}${replay ? `:replay${finished}` : ""}`,
      replay,
    });
  }

  const { data, error } = await context.admin.rpc("gateway_start_game_run", {
    p_auth_user_id: context.authUserId,
    p_student_id: studentId,
    p_game_key: TREASURE_MAZE_KEY,
    p_level_key: levelKey,
    ...(plan ? { p_plan: plan as unknown as Json } : {}),
    ...(replay ? { p_replay: true } : {}),
  });
  if (error) return fail(mapDbError(error));
  const dto = buildGameRun(data);
  return dto ? ok(dto) : fail("UNKNOWN");
}

/**
 * Lượt nào cho phép vào trang khi điểm dưới ngưỡng. Quyết định của chủ dự án (R08.7): ngưỡng chỉ áp dụng khi BẮT ĐẦU lượt tính
 * điểm mới → lượt đang dở (tính điểm hoặc chơi lại) luôn được tiếp tục; lượt tính điểm đã xong cho vào để chọn chơi lại.
 */
export function runKeepsAccess(run: { status: string; scored: boolean }): boolean {
  return run.status === "in_progress" || (run.status === "completed" && run.scored);
}

/**
 * Học sinh có quyền tiếp tục / chơi LẠI ở màn này trong mùa đang diễn ra → trang vẫn mở bàn chơi khi điểm hiện tại dưới
 * ngưỡng (xem `runKeepsAccess`). Chỉ để chọn giao diện; CSDL vẫn là nơi quyết định (gateway_start_game_run trả lượt dở trước
 * khi xét ngưỡng; ngưỡng vẫn chặn lượt tính điểm mới).
 */
export async function hasLevelProgress(context: StudentContext, studentId: string, levelKey: string): Promise<boolean> {
  if (!ownsStudent(context, studentId)) return false;
  const { data: runs } = await context.admin
    .from("game_runs")
    .select("season_id, status, scored")
    .eq("student_id", studentId)
    .eq("game_key", TREASURE_MAZE_KEY)
    .eq("level_key", levelKey)
    .in("status", ["in_progress", "completed"]);
  const seasonIds = [...new Set((runs ?? []).filter(runKeepsAccess).map((run) => run.season_id))];
  if (seasonIds.length === 0) return false;
  const { data: seasons } = await context.admin.from("seasons").select("id").in("id", seasonIds).eq("status", "active");
  return (seasons ?? []).length > 0;
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
