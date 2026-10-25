import { hashString } from "../exercises/generation/rng.ts";
import { ENCOUNTERS_PER_LEVEL, QUESTIONS_PER_ENCOUNTER } from "../gamification/rules.ts";
import { SUPPORT_POLICIES } from "../exercises/core/support.ts";
import { supportLevelForBand, type PracticeCandidate } from "../scored-practice/planner.ts";
import type { Band, SupportLevel } from "../../types/learning.ts";
import { MONSTER_KEYS } from "./monsters.ts";

/**
 * Bộ lập kế hoạch lượt Mê cung kho báu (R08.2) — HÀM THUẦN, không đọc CSDL/đồng hồ/Math.random (seed do máy chủ truyền).
 *
 * Ứng viên là các câu ĐÃ ĐỦ ĐIỀU KIỆN do CSDL trả (`gateway_practice_candidates`: approved, đúng chuỗi bài đã xác nhận,
 * đã học, hợp nhóm). Bộ lập chỉ chọn và sắp xếp:
 *   1. bỏ trùng theo vân tay nội dung (hai bản sao chỉ lấy một; có bản nào đã tính điểm trong mùa thì loại cả nội dung);
 *   2. chỉ lấy câu CHƯA tính điểm trong mùa — mọi câu của lượt tính điểm đều tính điểm, không lặp lại nội dung;
 *   3. ưu tiên bài gần nhất, chia đúng 7 nhóm × 3 câu, gán 7 mã quái vật khác nhau;
 *   4. không đủ 21 câu khác nhau → `null` (máy chủ trả INSUFFICIENT_CONTENT). KHÔNG nhân bản câu, KHÔNG nới quy tắc.
 * CSDL kiểm lại toàn bộ (gateway_start_game_run) và là bảo đảm cuối cùng.
 *
 * Chơi lại không tính điểm (R08.6, `replay: true`): bước 2 bỏ qua — câu từng tính điểm trong mùa được dùng lại (không tính
 * điểm nữa); mọi quy tắc còn lại (bỏ trùng vân tay, đúng 21 câu khác nhau, không nhân bản) giữ nguyên.
 */

export const GAME_PLANNER_VERSION = "r08.2";
export const GAME_QUESTION_COUNT = ENCOUNTERS_PER_LEVEL * QUESTIONS_PER_ENCOUNTER;

export type PlannedGameQuestion = { exerciseItemId: string; supportLevel: SupportLevel; maxAttempts: number };
export type PlannedEncounter = { monsterKey: string; questions: PlannedGameQuestion[] };
export type GameRunPlan = { encounters: PlannedEncounter[] };

function order(seed: string, salt: string, key: string): number {
  return hashString(`${seed}|${salt}|${key}`);
}

export function planGameRun(
  candidates: readonly PracticeCandidate[],
  options: { band: Band; seed: string; replay?: boolean },
): GameRunPlan | null {
  const unique = new Map<string, PracticeCandidate>();
  for (const candidate of [...candidates].sort((a, b) => a.exerciseItemId.localeCompare(b.exerciseItemId))) {
    const existing = unique.get(candidate.fingerprint);
    if (!existing) unique.set(candidate.fingerprint, candidate);
    else if (candidate.scoredInSeason && !existing.scoredInSeason) {
      unique.set(candidate.fingerprint, { ...existing, scoredInSeason: true });
    }
  }
  const fresh = [...unique.values()]
    .filter((candidate) => options.replay === true || !candidate.scoredInSeason)
    .sort(
      (a, b) =>
        b.lessonOrdinal - a.lessonOrdinal ||
        order(options.seed, "pick", a.fingerprint) - order(options.seed, "pick", b.fingerprint),
    );
  if (fresh.length < GAME_QUESTION_COUNT) return null;

  const level = supportLevelForBand(options.band);
  const maxAttempts = SUPPORT_POLICIES[level].maxAttempts;
  const chosen = fresh
    .slice(0, GAME_QUESTION_COUNT)
    .sort((a, b) => order(options.seed, "deal", a.fingerprint) - order(options.seed, "deal", b.fingerprint));
  const monsters = [...MONSTER_KEYS]
    .sort((a, b) => order(options.seed, "monster", a) - order(options.seed, "monster", b))
    .slice(0, ENCOUNTERS_PER_LEVEL);

  return {
    encounters: monsters.map((monsterKey, index) => ({
      monsterKey,
      questions: chosen
        .slice(index * QUESTIONS_PER_ENCOUNTER, (index + 1) * QUESTIONS_PER_ENCOUNTER)
        .map((candidate) => ({ exerciseItemId: candidate.exerciseItemId, supportLevel: level, maxAttempts })),
    })),
  };
}
