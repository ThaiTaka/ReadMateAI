import { LEGACY_MONSTER_KEYS } from "../../../game-runs/monsters.ts";
import { vi } from "@/strings/vi";

/**
 * Danh mục an toàn mã quái vật → tên hiển thị + màu (R08.4). Tên là chuỗi bịa trung tính (R08.5): không phải từ, tiếng
 * hay con vật của bài học, nên không thể gợi đáp án. Mã lạ (không có trong danh mục) dùng tên chung — không bao giờ lấy
 * lời thoại hay tên tùy ý từ CSDL/AI. Bản phác thảo vẫn chờ GV duyệt (docs/reviews/R08_MONSTER_REVIEW.md).
 */
const HUES: Readonly<Record<string, number>> = {
  "mon-01": 0,
  "mon-02": 150,
  "mon-03": 40,
  "mon-04": 95,
  "mon-05": 120,
  "mon-06": 190,
  "mon-07": 300,
  "mon-08": 330,
  "mon-09": 230,
  "mon-10": 260,
};

/** Mã chuẩn (mã mới); mã cũ của lượt chơi trước R08.5 được đổi qua `LEGACY_MONSTER_KEYS`. */
export function canonicalMonsterKey(monsterKey: string): string {
  return LEGACY_MONSTER_KEYS[monsterKey] ?? monsterKey;
}

export function monsterName(monsterKey: string): string {
  return vi.monsters[canonicalMonsterKey(monsterKey)] ?? vi.monsterFallback;
}

/** Góc xoay màu (độ) của hình dùng chung — tránh vẽ mười bộ asset riêng. */
export function monsterHue(monsterKey: string): number {
  return HUES[canonicalMonsterKey(monsterKey)] ?? 0;
}

/** Mã đưa ra thuộc tính HTML: luôn là mã mới trong danh mục; mã cũ/mã lạ không bao giờ lọt ra DOM (có thể chứa tiếng Việt). */
export function publicMonsterKey(monsterKey: string): string {
  const key = canonicalMonsterKey(monsterKey);
  return key in HUES ? key : "mon-00";
}
