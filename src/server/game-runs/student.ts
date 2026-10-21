import "server-only";
import {
  buildGamePosition,
  buildGameRun,
  type GamePositionDto,
  type GameRunDto,
  TREASURE_MAZE_KEY,
} from "@/features/game-runs/dto";
import { fail, mapDbError, ok, type Result } from "@/server/result";
import { ownsStudent, type StudentContext } from "@/server/student-gateway/context";

/**
 * Lượt chơi Mê cung kho báu của học sinh (R07.5b1). Mọi quyết định (ngưỡng 50 điểm, đồng ý học tập, mùa active,
 * quyền sở hữu lượt, kiểm từng bước đi theo bản đồ, xung đột phiên bản) nằm ở hàm CSDL `gateway_*`; lớp này chỉ
 * chuyển tiếp, kiểm lại hình dạng phản hồi bằng zod và không bao giờ nhận class/season/điểm từ trình duyệt.
 */

export async function startGameRun(
  context: StudentContext,
  studentId: string,
  levelKey: string,
): Promise<Result<GameRunDto>> {
  if (!ownsStudent(context, studentId)) return fail("FORBIDDEN");
  const { data, error } = await context.admin.rpc("gateway_start_game_run", {
    p_auth_user_id: context.authUserId,
    p_student_id: studentId,
    p_game_key: TREASURE_MAZE_KEY,
    p_level_key: levelKey,
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
