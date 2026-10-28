import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type GameWorldHeaderProps = {
  id: string;
  eyebrow: string;
  title: string;
  description?: ReactNode;
  /** Nút/công tắc bên phải (vd. MotionToggle). */
  actions?: ReactNode;
  /** `light` cho nền sáng, `dark` cho nền khung cảnh sâu. */
  tone?: "light" | "dark";
  level?: 1 | 2 | 3;
  className?: string;
};

/** Tiêu đề khu vực Game World: dòng nhỏ có ngôi sao + tiêu đề lớn + mô tả + vùng thao tác. */
export function GameWorldHeader({
  id,
  eyebrow,
  title,
  description,
  actions,
  tone = "light",
  level = 2,
  className,
}: GameWorldHeaderProps) {
  const Heading = level === 1 ? "h1" : level === 3 ? "h3" : "h2";
  const dark = tone === "dark";
  return (
    <div className={cn("flex flex-col gap-4 md:flex-row md:items-end md:justify-between", className)}>
      <div className="max-w-2xl">
        <p
          className={cn(
            "inline-flex items-center gap-2 text-sm font-extrabold tracking-wider uppercase",
            dark ? "text-sun-200" : "text-jade-700",
          )}
        >
          <span aria-hidden="true" className="text-base">
            ✦
          </span>
          {eyebrow}
        </p>
        <Heading
          id={id}
          className={cn("mt-1 text-3xl font-extrabold leading-tight sm:text-4xl", dark ? "text-white" : "text-ink")}
        >
          {title}
        </Heading>
        {description ? (
          <p className={cn("mt-2 text-base leading-relaxed sm:text-lg", dark ? "text-jade-50" : "text-ink-soft")}>
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}
