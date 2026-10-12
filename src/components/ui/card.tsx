import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export type CardVariant = "plain" | "tinted" | "placeholder";

const variants: Record<CardVariant, string> = {
  plain: "border border-line bg-surface shadow-soft",
  tinted: "border border-brand-100 bg-brand-50",
  /** Khung chờ cho chức năng chưa có: viền đứt, không đổ bóng. */
  placeholder: "border-2 border-dashed border-line-strong bg-surface/70",
};

type CardProps = HTMLAttributes<HTMLElement> & {
  variant?: CardVariant;
  as?: "div" | "article" | "section" | "li";
};

export function Card({ variant = "plain", as: Tag = "div", className, ...props }: CardProps) {
  return <Tag className={cn("rounded-card p-6", variants[variant], className)} {...props} />;
}
