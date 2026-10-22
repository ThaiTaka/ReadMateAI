import { cn } from "@/lib/cn";
import { MAP_TILE_STEP } from "@/features/gamification/rules";
import { milestoneProgress } from "@/features/gamification/unlocks";
import { vi } from "@/strings/vi";
import { ProgressBar } from "./progress-bar";

/** Ngôi sao vàng của điểm thưởng (SVG gốc, thuần trang trí). */
export function StarMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" className={cn("shrink-0", className)}>
      <path
        d="M24 3.5l6.2 12.6 13.9 2-10 9.8 2.4 13.8L24 35.2l-12.5 6.5 2.4-13.8-10-9.8 13.9-2z"
        fill="#fdc126"
        stroke="#c98a00"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <path d="M17 17.5l4-1 2-5" stroke="#fff9e6" strokeWidth="3" strokeLinecap="round" fill="none" />
    </svg>
  );
}

type ScoreBadgeProps = {
  /** Điểm hiện tại. */
  points: number;
  /** Điểm tích lũy trong mùa (cho thanh mốc khám phá). Mặc định bằng `points`. */
  earnedTotal?: number;
  /** Hiện chip "Minh họa" — bắt buộc khi con số không phải điểm thật (R02). */
  illustrative?: boolean;
  size?: "md" | "lg";
  className?: string;
};

/**
 * Ô điểm: tổng điểm + ngôi sao + tiến độ tới mốc khám phá tiếp theo. Chỉ HIỂN THỊ — không có thao tác nào
 * thay đổi điểm (điểm thật chỉ tính ở server từ R04).
 */
export function ScoreBadge({
  points,
  earnedTotal = points,
  illustrative = false,
  size = "md",
  className,
}: ScoreBadgeProps) {
  const t = vi.adventure.score;
  const progress = milestoneProgress(earnedTotal);
  const nextText = t.nextMilestone.replace("{n}", String(progress.remaining));
  return (
    <div
      className={cn(
        "relative flex flex-col gap-3 rounded-3xl border-2 border-sun-200 bg-linear-to-br from-sun-50 to-surface p-4 shadow-soft",
        className,
      )}
    >
      <div className="flex items-center gap-3">
        <span className="relative">
          <span
            aria-hidden="true"
            className="absolute -inset-2 rounded-full bg-[radial-gradient(circle,rgb(255_227_138/0.9),transparent_70%)]"
          />
          <StarMark className={cn("relative", size === "lg" ? "size-14" : "size-11")} />
        </span>
        <p className="flex flex-col leading-tight">
          <span className="text-sm font-bold text-sun-800">{t.label}</span>
          <span className="flex items-baseline gap-1.5">
            <span
              className={cn("font-extrabold tabular-nums text-ink", size === "lg" ? "text-4xl" : "text-3xl")}
              aria-hidden="true"
            >
              {points}
            </span>
            <span className="font-bold text-ink-soft" aria-hidden="true">
              {t.unit}
            </span>
            <span className="sr-only">{t.total.replace("{n}", String(points))}</span>
          </span>
        </p>
        {illustrative ? (
          <span className="ml-auto self-start rounded-full bg-sun-100 px-2.5 py-0.5 text-xs font-bold text-sun-800">
            {vi.status.illustrative}
          </span>
        ) : null}
      </div>
      <ProgressBar
        value={MAP_TILE_STEP - progress.remaining}
        max={MAP_TILE_STEP}
        label={t.progressLabel}
        valueText={nextText}
        tone="sun"
      />
      <p className="text-sm font-semibold text-ink-soft">{nextText}</p>
    </div>
  );
}
