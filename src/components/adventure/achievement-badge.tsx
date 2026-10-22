import { BookOpen, Footprints, Map as MapIcon, Puzzle, Star, Trophy, type LucideIcon } from "lucide-react";
import type { DemoAchievementIcon } from "@/features/demo/adventure-data";
import { cn } from "@/lib/cn";
import { vi } from "@/strings/vi";

const ICONS: Readonly<Record<DemoAchievementIcon, LucideIcon>> = {
  footprints: Footprints,
  map: MapIcon,
  puzzle: Puzzle,
  book: BookOpen,
  treasure: Trophy,
  star: Star,
};

type AchievementBadgeProps = {
  title: string;
  description: string;
  icon: DemoAchievementIcon;
  earned: boolean;
  className?: string;
};

/**
 * Huy hiệu thành tích dạng huân chương có dải ruy băng. Đã đạt: vàng ấm + chữ "Đã đạt"; chưa đạt: viền đứt,
 * nhạt màu + chữ "Chưa đạt" — không chỉ phân biệt bằng màu, không dùng từ ngữ chê bai.
 */
export function AchievementBadge({ title, description, icon, earned, className }: AchievementBadgeProps) {
  const Icon = ICONS[icon];
  return (
    <div className={cn("flex flex-col items-center gap-2 text-center", className)}>
      <span className="relative flex flex-col items-center" aria-hidden="true">
        <span
          className={cn(
            "relative z-10 flex size-18 items-center justify-center rounded-full",
            earned
              ? "bg-linear-to-br from-sun-200 via-sun-300 to-sun-500 shadow-glow-sun"
              : "border-[3px] border-dashed border-line-strong bg-surface-muted",
          )}
        >
          <span
            className={cn(
              "flex size-13 items-center justify-center rounded-full",
              earned ? "bg-sun-50 text-sun-700" : "text-ink-faint",
            )}
          >
            <Icon className="size-7" strokeWidth={2.4} />
          </span>
        </span>
        <span className="-mt-3 flex gap-3">
          <span className={cn("h-6 w-3 skew-x-12 rounded-b-sm", earned ? "bg-coral-500" : "bg-line")} />
          <span className={cn("h-6 w-3 -skew-x-12 rounded-b-sm", earned ? "bg-lagoon-500" : "bg-line")} />
        </span>
      </span>
      <p className="text-sm font-extrabold leading-snug text-ink">{title}</p>
      <p className="text-xs leading-snug text-ink-soft">{description}</p>
      <span
        className={cn(
          "rounded-full px-2.5 py-0.5 text-xs font-bold",
          earned ? "bg-jade-100 text-jade-800" : "bg-surface-muted text-ink-soft",
        )}
      >
        {earned ? vi.adventure.achievement.earned : vi.adventure.achievement.notYet}
      </span>
    </div>
  );
}
