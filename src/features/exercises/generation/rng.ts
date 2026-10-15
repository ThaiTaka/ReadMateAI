/**
 * Bộ sinh số giả ngẫu nhiên CÓ SEED: cùng seed luôn cho cùng dãy số → bài tập sinh ra tái lập được
 * (kiểm thử, GV xem lại đúng bài học sinh đã làm). Không dùng Math.random() trong bộ máy bài tập.
 *
 * Thuật toán: băm chuỗi seed bằng FNV-1a 32-bit, rồi sinh số bằng mulberry32 — đủ tốt để xáo trộn
 * phương án, không dùng cho mục đích bảo mật.
 */

export type Rng = {
  /** Số thực trong [0, 1). */
  next(): number;
  /** Số nguyên trong [0, maxExclusive). */
  int(maxExclusive: number): number;
  /** Bản xáo trộn (Fisher–Yates) — không sửa mảng gốc. */
  shuffle<T>(items: readonly T[]): T[];
};

/** FNV-1a 32-bit của một chuỗi (theo đơn vị mã UTF-16). */
export function hashString(text: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** Mã ngắn (6 ký tự base36) ổn định cho một chuỗi — dùng làm phần cuối mã câu bài tập. */
export function shortHash(text: string): string {
  return hashString(text).toString(36).padStart(6, "0").slice(-6);
}

export function createRng(seed: string): Rng {
  let state = hashString(seed) || 0x9e3779b9;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (maxExclusive: number) => Math.floor(next() * maxExclusive);
  const shuffle = <T>(items: readonly T[]): T[] => {
    const copy = [...items];
    for (let index = copy.length - 1; index > 0; index -= 1) {
      const swap = int(index + 1);
      const current = copy[index] as T;
      copy[index] = copy[swap] as T;
      copy[swap] = current;
    }
    return copy;
  };
  return { next, int, shuffle };
}
