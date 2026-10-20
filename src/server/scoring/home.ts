import "server-only";
import {
  MAP_TILE_COUNT,
  WORLD_MAP_KEY,
  canRevealTile,
  frontierTiles,
  isAdjacentToStart,
  isMapTileKey,
  mapProgress,
  tileNeighbors,
} from "@/features/game-world/map";
import type { MapTileKey } from "@/features/game-world/catalog";
import { gameUnlockStates } from "@/features/gamification/unlocks";
import type { MapStateDto, PracticeBlocker, RevealTileDto, StudentHomeDto } from "@/features/scored-practice/types";
import type { AppSupabaseClient } from "@/lib/supabase/server";
import { openSessionId } from "@/server/question-instances/service";
import { fail, mapDbError, ok, type Result } from "@/server/result";
import { ownsStudent, type StudentContext } from "@/server/student-gateway/context";
import type { LinkedStudent } from "@/server/student-gateway/session";

/**
 * Trang của học sinh (R04): điểm hiện tại, điểm tích lũy, thẻ bản đồ, trạng thái bốn game, buổi luyện đang dở.
 * Chỉ dữ liệu của CHÍNH học sinh đã liên kết; không có nhóm năng lực, tổng điểm bị trừ hay dữ liệu của bạn khác.
 * Quyền vào game xét ĐIỂM HIỆN TẠI (không tiêu điểm); `game_unlocks` chỉ là dấu "đã khám phá" (không cấp quyền).
 */

function mapState(earnedTotal: number, revealedTiles: MapTileKey[]): MapStateDto {
  const progress = mapProgress(earnedTotal, revealedTiles.length);
  return { ...progress, revealedTiles, frontier: frontierTiles(new Set(revealedTiles)) };
}

async function seasonState(admin: AppSupabaseClient, classId: string, studentId: string) {
  const { data: season } = await admin
    .from("seasons")
    .select("id, seq_no")
    .eq("class_id", classId)
    .eq("status", "active")
    .maybeSingle();
  if (!season) return null;
  const [{ data: score }, { data: reveals }, { data: unlocks }] = await Promise.all([
    admin
      .from("season_scores")
      .select("balance, earned_total")
      .eq("season_id", season.id)
      .eq("student_id", studentId)
      .maybeSingle(),
    admin
      .from("map_tile_reveals")
      .select("tile_key, ordinal")
      .eq("season_id", season.id)
      .eq("student_id", studentId)
      .order("ordinal"),
    admin.from("game_unlocks").select("game_key").eq("season_id", season.id).eq("student_id", studentId),
  ]);
  return {
    season,
    score: { balance: score?.balance ?? 0, earnedTotal: score?.earned_total ?? 0 },
    revealed: (reveals ?? []).map((row) => row.tile_key).filter(isMapTileKey),
    discovered: new Set((unlocks ?? []).map((row) => row.game_key)),
  };
}

export async function getStudentHome(context: StudentContext, student: LinkedStudent): Promise<Result<StudentHomeDto>> {
  if (!ownsStudent(context, student.id)) return fail("FORBIDDEN");
  const { admin } = context;
  const { data: row } = await admin
    .from("students")
    .select("class_id, classes(curriculum_status)")
    .eq("id", student.id)
    .maybeSingle();
  if (!row) return fail("FORBIDDEN");
  const [{ data: consent }, { data: band }, state, openId] = await Promise.all([
    admin
      .from("guardian_consents")
      .select("id")
      .eq("student_id", student.id)
      .eq("scope", "learning_data")
      .eq("status", "granted")
      .maybeSingle(),
    admin.from("student_band_assignments").select("id").eq("student_id", student.id).is("valid_to", null).maybeSingle(),
    seasonState(admin, row.class_id, student.id),
    openSessionId(admin, student.id),
  ]);

  // Thứ tự lý do cố định; học sinh chỉ thấy câu chữ trung tính (không thấy nhóm/lộ trình).
  const blocker: PracticeBlocker | null = !consent
    ? "CONSENT_REQUIRED"
    : !state
      ? "SEASON_CLOSED"
      : row.classes?.curriculum_status !== "confirmed"
        ? "CURRICULUM_UNCONFIRMED"
        : !band
          ? "NO_BAND"
          : null;

  let openSession: StudentHomeDto["practice"]["openSession"] = null;
  if (openId && consent) {
    const { data: questions } = await admin
      .from("question_instances")
      .select("status")
      .eq("practice_session_id", openId);
    openSession = {
      id: openId,
      closed: (questions ?? []).filter((question) => question.status !== "open").length,
      total: (questions ?? []).length,
    };
  }

  const score = consent && state ? state.score : { balance: 0, earnedTotal: 0 };
  const revealed = consent && state ? state.revealed : [];
  return ok({
    student: { displayName: student.displayName, avatarKey: student.avatarKey, className: student.className },
    season: state ? { seqNo: state.season.seq_no } : null,
    learningDataConsent: Boolean(consent),
    score,
    map: mapState(score.earnedTotal, revealed),
    games: gameUnlockStates(score.balance).map((game) => ({
      ...game,
      discovered: Boolean(consent && state?.discovered.has(game.game)),
    })),
    practice: { blocker, openSession },
  });
}

/**
 * Khám phá một thẻ bản đồ: kiểm tra trước bằng hàm thuần (số lượt, kề nhau), rồi CSDL kiểm tra lại trong giao dịch.
 * Gửi lại cùng thẻ → `already_revealed` (không tốn lượt). Không tiêu điểm.
 */
export async function revealMapTile(
  context: StudentContext,
  student: LinkedStudent,
  tileKey: string,
): Promise<Result<RevealTileDto>> {
  if (!ownsStudent(context, student.id)) return fail("FORBIDDEN");
  if (!isMapTileKey(tileKey)) return fail("INVALID_INPUT");
  const { admin } = context;
  const { data: row } = await admin.from("students").select("class_id").eq("id", student.id).maybeSingle();
  if (!row) return fail("FORBIDDEN");
  const state = await seasonState(admin, row.class_id, student.id);
  if (!state) return fail("SEASON_CLOSED");
  const revealed = new Set<string>(state.revealed);
  const check = canRevealTile({ tileKey, revealed, earnedTotal: state.score.earnedTotal });
  if (!check.ok) {
    if (check.code === "ALREADY_REVEALED") {
      return ok({ outcome: "already_revealed", map: mapState(state.score.earnedTotal, state.revealed) });
    }
    return fail(check.code === "UNKNOWN_TILE" ? "INVALID_INPUT" : check.code);
  }

  const result = await admin.rpc("gateway_reveal_map_tile", {
    p_auth_user_id: context.authUserId,
    p_student_id: student.id,
    p_map_key: WORLD_MAP_KEY,
    p_tile_key: tileKey,
    p_tile_count: MAP_TILE_COUNT,
    p_neighbors: tileNeighbors(tileKey),
    p_adjacent_to_start: isAdjacentToStart(tileKey),
  });
  if (result.error) return fail(mapDbError(result.error));
  const outcome = (result.data as { outcome?: unknown } | null)?.outcome;
  const after = await seasonState(admin, row.class_id, student.id);
  const tiles = after?.revealed ?? [...state.revealed, tileKey];
  return ok({
    outcome: outcome === "already_revealed" ? "already_revealed" : "revealed",
    map: mapState(after?.score.earnedTotal ?? state.score.earnedTotal, tiles),
  });
}
