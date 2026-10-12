import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type EmptyStateProps = {
  icon: ReactNode;
  title: string;
  description: ReactNode;
  action?: ReactNode;
  className?: string;
};

/** Trạng thái trống: cho biết vì sao chưa có gì và điều gì sẽ xuất hiện ở đây. */
export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center rounded-card border-2 border-dashed border-line-strong bg-surface/70 px-6 py-10 text-center",
        className,
      )}
    >
      <div
        className="flex size-16 items-center justify-center rounded-full bg-brand-50 text-brand-700"
        aria-hidden="true"
      >
        {icon}
      </div>
      <p className="mt-4 text-lg font-bold text-ink">{title}</p>
      <p className="mt-2 max-w-md leading-relaxed text-ink-soft">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
