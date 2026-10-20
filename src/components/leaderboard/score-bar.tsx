"use client";

import { useEffect, useState } from "react";
import { calculateBarWidth } from "@/features/gamification/ranking";
import { cn } from "@/lib/cn";

type ScoreBarProps = {
  points: number;
  maxPoints: number;
  size?: "md" | "xl";
  className?: string;
};

/**
 * Thanh điểm ngang (LEADERBOARD_SPEC §4): chiều dài = điểm / điểm cao nhất của bảng, tuyến tính; 0 điểm → thanh rỗng
 * (chỉ còn đường nền). Lớn dần ≤ 600 ms lúc xuất hiện và khi điểm đổi; giảm chuyển động → đổi tức thì (CSS toàn cục
 * đặt thời gian chuyển tiếp ≈ 0 khi `prefers-reduced-motion` hoặc `[data-motion="reduce"]`). Thuần trang trí:
 * con số bên cạnh mới là nội dung chính nên thanh `aria-hidden`.
 */
export function ScoreBar({ points, maxPoints, size = "md", className }: ScoreBarProps) {
  const target = calculateBarWidth(points, maxPoints);
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setShown(target));
    return () => cancelAnimationFrame(frame);
  }, [target]);
  return (
    <span
      aria-hidden="true"
      data-testid="score-bar"
      className={cn(
        "block w-full overflow-hidden rounded-full bg-white/15 ring-1 ring-white/20 ring-inset",
        size === "xl" ? "h-6 sm:h-8" : "h-3.5 sm:h-4",
        className,
      )}
    >
      <span
        data-width={target}
        className="block h-full rounded-full bg-linear-to-r from-jade-300 via-jade-400 to-sun-300 shadow-[0_0_12px_rgb(95_214_192/0.5)] transition-[width] duration-500 ease-out"
        style={{ width: `${shown}%` }}
      />
    </span>
  );
}
