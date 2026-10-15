import type { Band } from "../../../types/learning.ts";

/**
 * Ràng buộc nội dung mặc định theo nhóm (docs/PRD.md §10, §9.2 dạng 6). Là tham số — sẽ hiệu chỉnh
 * cùng GV khi thí điểm.
 * - Nhóm 3 (`foundation`): ≤ 3 phương án; tiếng một âm tiết. PRD không đặt giới hạn câu cho Nhóm 3
 *   (dạng 6 không phải dạng chủ đạo) — tạm đặt ≤ 4 tiếng cho thận trọng.
 * - Nhóm 2 (`developing`): ≤ 4 phương án; từ 1–2 tiếng; câu ≤ 5 tiếng.
 * - Nhóm 1 (`extending`): ≤ 4 phương án; từ nhiều tiếng; câu ≤ 8 tiếng.
 */
export type BandConstraints = { maxChoices: number; maxWordSyllables: number; maxSentenceSyllables: number };

export const BAND_CONSTRAINTS: Readonly<Record<Band, BandConstraints>> = {
  foundation: { maxChoices: 3, maxWordSyllables: 1, maxSentenceSyllables: 4 },
  developing: { maxChoices: 4, maxWordSyllables: 2, maxSentenceSyllables: 5 },
  extending: { maxChoices: 4, maxWordSyllables: 3, maxSentenceSyllables: 8 },
};
