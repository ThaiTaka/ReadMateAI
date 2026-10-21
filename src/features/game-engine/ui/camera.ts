/*
 * Camera của bản đồ (R07.4): hàm thuần, chỉ tính vị trí khung nhìn theo đơn vị ô. Dùng CSS transform ở lớp giao diện.
 */

/** Số ô nhìn thấy mỗi chiều khi camera bám theo nhân vật (điện thoại 360 px → mỗi ô ≥ 45 px). */
export const FOLLOW_VIEW_CELLS = 7;

export type Cell = { readonly row: number; readonly col: number };

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

/** Số ô khung nhìn thực tế: không vượt kích thước bản đồ. */
export function viewCells(size: number, overview: boolean): number {
  return overview ? size : Math.min(size, FOLLOW_VIEW_CELLS);
}

/** Góc trên-trái của khung nhìn (theo ô): nhân vật ở giữa nhưng khung không vượt ra ngoài bản đồ. */
export function cameraOrigin(size: number, view: number, hero: Cell): { x: number; y: number } {
  const max = Math.max(0, size - view);
  return { x: clamp(hero.col + 0.5 - view / 2, 0, max), y: clamp(hero.row + 0.5 - view / 2, 0, max) };
}
