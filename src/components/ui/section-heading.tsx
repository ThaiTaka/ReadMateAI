import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type SectionHeadingProps = {
  id?: string;
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  align?: "left" | "center";
  /** Cấp tiêu đề: h2 cho mục của trang, h3 cho mục con. */
  level?: 2 | 3;
  /** "lg" cho trang giới thiệu; "md" cho trang làm việc (dashboard) để không lấn át tiêu đề trang. */
  size?: "lg" | "md";
  className?: string;
};

const titleSizes = {
  lg: "text-3xl sm:text-4xl",
  md: "text-2xl",
} as const;

export function SectionHeading({
  id,
  eyebrow,
  title,
  description,
  align = "left",
  level = 2,
  size = level === 2 ? "lg" : "md",
  className,
}: SectionHeadingProps) {
  const Heading = level === 2 ? "h2" : "h3";
  return (
    <div className={cn("max-w-3xl", align === "center" && "mx-auto text-center", className)}>
      {eyebrow ? <p className="mb-2 text-sm font-bold uppercase tracking-wider text-brand-700">{eyebrow}</p> : null}
      <Heading id={id} className={cn("font-extrabold leading-tight text-ink", titleSizes[size])}>
        {title}
      </Heading>
      {description ? (
        <p className={cn("mt-3 leading-relaxed text-ink-soft", size === "lg" ? "text-lg" : "text-base")}>
          {description}
        </p>
      ) : null}
    </div>
  );
}
