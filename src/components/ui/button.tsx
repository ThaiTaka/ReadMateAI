import Link from "next/link";
import type { Route } from "next";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost";
export type ButtonSize = "sm" | "md" | "lg" | "kid";

/**
 * Lưu ý: cn() không gộp xung đột lớp Tailwind. Muốn ẩn/hiện nút theo màn hình, bọc nút trong
 * phần tử khác (vd. <span className="hidden sm:inline-flex">) thay vì truyền "hidden" vào className.
 */
const base =
  "inline-flex select-none items-center justify-center gap-2 rounded-full text-center font-semibold transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-60 aria-disabled:cursor-not-allowed aria-disabled:opacity-60";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-primary text-white shadow-soft hover:bg-primary-hover",
  secondary: "bg-sun-300 text-ink shadow-soft hover:bg-sun-200",
  outline: "border-2 border-brand-200 bg-surface text-brand-800 hover:border-brand-600 hover:bg-brand-50",
  ghost: "text-ink-soft hover:bg-surface-muted hover:text-ink",
};

/** md/lg ≥ 48px cho người lớn; kid ≥ 64px cho học sinh (PRD §5, P8). */
const sizes: Record<ButtonSize, string> = {
  sm: "min-h-10 px-4 text-sm",
  md: "min-h-touch px-6 text-base",
  lg: "min-h-14 px-7 text-lg",
  kid: "min-h-touch-kid rounded-tile px-8 text-xl",
};

export function buttonClasses(variant: ButtonVariant = "primary", size: ButtonSize = "md", className?: string) {
  return cn(base, variants[variant], sizes[size], className);
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

export function Button({ variant, size, className, type = "button", ...props }: ButtonProps) {
  return <button type={type} className={buttonClasses(variant, size, className)} {...props} />;
}

type ButtonLinkProps = {
  href: Route;
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
};

/** Liên kết điều hướng có hình thức nút — dùng cho chuyển trang, không dùng cho hành động. */
export function ButtonLink({ href, children, variant, size, className }: ButtonLinkProps) {
  return (
    <Link href={href} className={buttonClasses(variant, size, className)}>
      {children}
    </Link>
  );
}
