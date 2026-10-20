import Link from "next/link";
import type { Route } from "next";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

export type AdventureTone = "jade" | "sun" | "magic" | "plain";
export type AdventureSize = "md" | "kid";

/**
 * Nút "phiêu lưu": khối nổi có viền đáy đậm (bấm thì lún xuống), bo tròn lớn, chữ đậm.
 * - `kid` cao ≥ 64px (vùng chạm cho học sinh); `md` ≥ 48px cho người lớn.
 * - Màu chỉ để trang trí — nội dung nút luôn có chữ (không truyền tin chỉ bằng màu).
 * - Nút bị khóa: không nổi, không lún, chữ vẫn đọc được (dùng cho chức năng "Sắp có").
 * Lưu ý cn() không gộp lớp xung đột (xem ui/button.tsx): muốn ẩn theo màn hình thì bọc phần tử ngoài.
 */
const base =
  "inline-flex select-none items-center justify-center gap-2 rounded-2xl text-center font-extrabold transition-[transform,box-shadow,background-color] duration-150 hover:-translate-y-0.5 active:translate-y-[3px] active:shadow-none disabled:translate-y-0 disabled:cursor-not-allowed disabled:shadow-none disabled:opacity-70 aria-disabled:cursor-not-allowed aria-disabled:opacity-70";

const tones: Record<AdventureTone, string> = {
  jade: "bg-linear-to-b from-jade-600 to-jade-700 text-white shadow-press-jade disabled:from-line-strong disabled:to-line-strong disabled:text-ink",
  sun: "bg-linear-to-b from-sun-200 to-sun-400 text-ink shadow-press-sun disabled:from-surface-muted disabled:to-surface-muted",
  magic:
    "bg-linear-to-b from-magic-600 to-magic-700 text-white shadow-press-magic disabled:from-line-strong disabled:to-line-strong disabled:text-ink",
  plain: "border-2 border-line bg-surface text-ink shadow-press-plain hover:border-line-strong",
};

const sizes: Record<AdventureSize, string> = {
  md: "min-h-12 px-5 text-base",
  kid: "min-h-touch-kid px-7 text-lg sm:text-xl",
};

export function adventureClasses(tone: AdventureTone = "jade", size: AdventureSize = "kid", className?: string) {
  return cn(base, tones[tone], sizes[size], className);
}

type AdventureButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: AdventureTone;
  size?: AdventureSize;
};

export function AdventureButton({ tone, size, className, type = "button", ...props }: AdventureButtonProps) {
  return <button type={type} className={adventureClasses(tone, size, className)} {...props} />;
}

type AdventureLinkProps = {
  href: Route;
  children: ReactNode;
  tone?: AdventureTone;
  size?: AdventureSize;
  className?: string;
};

/** Liên kết điều hướng có hình thức nút phiêu lưu — chỉ dùng khi đích đến thực sự tồn tại. */
export function AdventureLink({ href, children, tone, size, className }: AdventureLinkProps) {
  return (
    <Link href={href} className={adventureClasses(tone, size, className)}>
      {children}
    </Link>
  );
}
