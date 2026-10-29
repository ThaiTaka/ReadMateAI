/**
 * Hằng số điểm thưởng và mở khóa — NGUỒN DUY NHẤT trong mã (CLAUDE.md §9.4.1), khớp
 * docs/GAMIFICATION_SPEC.md §1. Đổi bất kỳ hằng số nào cần quyết định của người điều phối và tăng
 * `SCORING_RULES_VERSION`.
 *
 * R02 chỉ dùng các hằng số này để HIỂN THỊ dữ liệu minh họa (Game World, mốc khám phá). Việc tính, cộng/trừ
 * và lưu điểm thật thuộc R04 và luôn chạy ở server.
 */

export const SCORING_RULES_VERSION = "r1";

/** Trả lời đúng một câu tính điểm. */
export const POINTS_CORRECT = 10;
/** Trả lời sai một lượt hợp lệ (số dư không xuống dưới `BALANCE_FLOOR`). */
export const POINTS_INCORRECT = -5;
export const BALANCE_FLOOR = 0;

/** Mỗi 30 điểm tích lũy trong mùa được khám phá thêm một mốc (thẻ) bản đồ. */
export const MAP_TILE_STEP = 30;

export type GameKey = "treasure_maze" | "wonder_forest" | "tone_island" | "rhyme_castle";

/** Thứ tự xuất hiện trên bản đồ thế giới. */
export const GAME_KEYS: readonly GameKey[] = ["treasure_maze", "wonder_forest", "tone_island", "rhyme_castle"];

/** Điểm hiện tại tối thiểu để vào từng mini-game. Vào chơi không tốn điểm. */
export const GAME_MIN_BALANCE: Readonly<Record<GameKey, number>> = {
  treasure_maze: 50,
  wonder_forest: 120,
  tone_island: 200,
  rhyme_castle: 300,
};

export const MONSTER_HP = 3;
export const QUESTIONS_PER_ENCOUNTER = 3;
export const ENCOUNTERS_PER_LEVEL = 7;
