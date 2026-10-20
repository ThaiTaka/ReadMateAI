import { cn } from "@/lib/cn";

export type ProgressTone = "sun" | "jade" | "magic" | "lagoon";

const fills: Record<ProgressTone, string> = {
  sun: "from-sun-300 to-sun-500",
  jade: "from-jade-400 to-jade-600",
  magic: "from-magic-400 to-magic-600",
  lagoon: "from-lagoon-400 to-lagoon-600",
};

type ProgressBarProps = {
  value: number;
  max: number;
  /** Tên của thanh cho trình đọc màn hình (bắt buộc — thanh không tự giải thích được). */
  label: string;
  /** Mô tả giá trị bằng lời (vd. "Còn 15 điểm…"); mặc định "value / max". */
  valueText?: string;
  tone?: ProgressTone;
  size?: "sm" | "md";
  className?: string;
};

/** Thanh tiến độ có role="progressbar" và nhãn; chiều rộng phần đã đi luôn trong [0, 100%]. */
export function ProgressBar({ value, max, label, valueText, tone = "sun", size = "md", className }: ProgressBarProps) {
  const safeMax = max > 0 ? max : 1;
  const clamped = Math.min(Math.max(value, 0), safeMax);
  const percent = Math.round((clamped / safeMax) * 100);
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={safeMax}
      aria-valuenow={clamped}
      aria-valuetext={valueText ?? `${clamped} / ${safeMax}`}
      className={cn(
        "relative w-full overflow-hidden rounded-full bg-surface-muted ring-1 ring-line ring-inset",
        size === "sm" ? "h-2.5" : "h-4",
        className,
      )}
    >
      <div
        className={cn("h-full rounded-full bg-linear-to-r transition-[width] duration-700", fills[tone])}
        style={{ width: `${percent}%` }}
      >
        <div className="h-1/2 rounded-full bg-white/35" />
      </div>
    </div>
  );
}
