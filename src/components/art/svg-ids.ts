import { useId } from "react";

/**
 * Mã id duy nhất cho gradient/clipPath trong một hình SVG: cùng một hình xuất hiện nhiều lần trên trang
 * không được dùng chung id (trình duyệt sẽ lấy nhầm gradient của hình khác). Bỏ ký tự đặc biệt của useId
 * để dùng an toàn trong `url(#…)`.
 */
export function useSvgIds<const Name extends string>(names: readonly Name[]): Record<Name, string> {
  const base = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  return Object.fromEntries(names.map((name) => [name, `rm${base}${name}`])) as Record<Name, string>;
}

export type ArtProps = {
  className?: string;
  /** Tên mô tả cho trình đọc màn hình. Bỏ trống = hình thuần trang trí (aria-hidden). */
  title?: string;
};

/** Thuộc tính trợ năng chung: có tiêu đề → role="img" + aria-label; không có → ẩn khỏi trình đọc màn hình. */
export function artA11y(title: string | undefined) {
  return title ? ({ role: "img", "aria-label": title } as const) : ({ "aria-hidden": true } as const);
}
