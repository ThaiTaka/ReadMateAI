import { SUPPORT_POLICIES } from "../exercises/core/support.ts";
import { hashString } from "../exercises/generation/rng.ts";
import type { Band, SupportLevel } from "../../types/learning.ts";

/**
 * Bộ lập buổi luyện có điểm (R04) — HÀM THUẦN, không đọc CSDL/đồng hồ (seed và ứng viên do máy chủ truyền vào).
 *
 * Ứng viên là các câu ĐÃ ĐỦ ĐIỀU KIỆN do CSDL trả (`gateway_practice_candidates`: approved, đúng chuỗi bài đã xác
 * nhận, đã học, hợp nhóm). Bộ lập chỉ chọn và sắp thứ tự:
 *   1. bỏ trùng theo vân tay nội dung (hai bản sao chỉ lấy một);
 *   2. câu CHƯA từng tính điểm trong mùa trước (tính điểm), ưu tiên bài gần nhất rồi xáo bằng seed;
 *   3. thiếu thì thêm câu đã tính điểm làm "Câu luyện thêm – Không tính điểm";
 *   4. không có ứng viên nào → `null` (máy chủ trả INSUFFICIENT_CONTENT, không nới quy tắc).
 * CSDL vẫn là bảo đảm cuối cùng: chỉ mục duy nhất từng phần `(season_id, student_id, content_fingerprint) where scorable`.
 */

export const PRACTICE_SESSION_SIZE = 8;
export const PLANNER_VERSION = "r04.1";

export type PracticeCandidate = {
  exerciseItemId: string;
  fingerprint: string;
  typeCode: string;
  variant: string;
  lessonOrdinal: number;
  scoredInSeason: boolean;
};

export type PlannedQuestion = {
  exerciseItemId: string;
  supportLevel: SupportLevel;
  maxAttempts: number;
  /** Máy chủ ĐỀ NGHỊ tính điểm; CSDL quyết định cuối cùng theo vân tay trong mùa. */
  scorable: boolean;
};

/**
 * Mức hỗ trợ mặc định theo nhóm khi chưa có dữ liệu mức hỗ trợ theo dạng bài (`student_type_support` — R10):
 * Nhóm 3 → H3, Nhóm 2 → H2, Nhóm 1 → H1. Đề xuất R04, chờ GV góp ý. Số lượt mỗi câu lấy từ SUPPORT_POLICIES (GĐ4).
 */
export function supportLevelForBand(band: Band): SupportLevel {
  return band === "foundation" ? 3 : band === "developing" ? 2 : 1;
}

function order(seed: string, candidate: PracticeCandidate): number {
  return hashString(`${seed}|${candidate.fingerprint}`);
}

export function planPracticeSession(
  candidates: readonly PracticeCandidate[],
  options: { band: Band; seed: string; size?: number },
): PlannedQuestion[] | null {
  const size = Math.max(1, Math.min(50, Math.trunc(options.size ?? PRACTICE_SESSION_SIZE)));
  const unique = new Map<string, PracticeCandidate>();
  for (const candidate of [...candidates].sort((a, b) => a.exerciseItemId.localeCompare(b.exerciseItemId))) {
    const existing = unique.get(candidate.fingerprint);
    // Một nội dung đã tính điểm ở bất kỳ bản sao nào thì mọi bản sao đều coi là đã tính điểm.
    if (!existing) unique.set(candidate.fingerprint, candidate);
    else if (candidate.scoredInSeason && !existing.scoredInSeason) {
      unique.set(candidate.fingerprint, { ...existing, scoredInSeason: true });
    }
  }
  const all = [...unique.values()];
  if (all.length === 0) return null;

  const fresh = all
    .filter((candidate) => !candidate.scoredInSeason)
    .sort((a, b) => b.lessonOrdinal - a.lessonOrdinal || order(options.seed, a) - order(options.seed, b));
  const review = all
    .filter((candidate) => candidate.scoredInSeason)
    .sort((a, b) => order(options.seed, a) - order(options.seed, b));

  const level = supportLevelForBand(options.band);
  const maxAttempts = SUPPORT_POLICIES[level].maxAttempts;
  const chosen = fresh.slice(0, size).map((candidate) => ({ candidate, scorable: true }));
  for (const candidate of review) {
    if (chosen.length >= size) break;
    chosen.push({ candidate, scorable: false });
  }
  return chosen.map(({ candidate, scorable }) => ({
    exerciseItemId: candidate.exerciseItemId,
    supportLevel: level,
    maxAttempts,
    scorable,
  }));
}
