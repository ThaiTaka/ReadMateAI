import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type BadgeTone = "brand" | "sun" | "coral" | "lagoon" | "neutral";

const tones: Record<BadgeTone, string> = {
  brand: "bg-brand-100 text-brand-800",
  sun: "bg-sun-100 text-sun-800",
  coral: "bg-coral-100 text-coral-800",
  lagoon: "bg-lagoon-100 text-lagoon-800",
  neutral: "bg-surface-muted text-ink-soft",
};

type BadgeProps = {
  tone?: BadgeTone;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
};

export function Badge({ tone = "neutral", icon, children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold leading-5",
        tones[tone],
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}
