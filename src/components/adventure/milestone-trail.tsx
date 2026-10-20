import { Check, Lock } from "lucide-react";
import { FogTileArt, MapTileArt } from "@/components/art/map-tiles";
import { MAP_TILES } from "@/features/game-world/catalog";
import { MAP_TILE_STEP } from "@/features/gamification/rules";
import { milestonePoints, tilesAllowed } from "@/features/gamification/unlocks";
import { cn } from "@/lib/cn";
import { vi } from "@/strings/vi";

type MilestoneTrailProps = {
  /** Điểm tích lũy trong mùa (dữ liệu minh họa ở R02). */
  earnedTotal: number;
  className?: string;
};

/**
 * Dải mốc khám phá: mỗi MAP_TILE_STEP điểm tích lũy hé mở một ô bản đồ. Ô đã mở hiện cảnh nhỏ + tên; ô kế tiếp
 * được làm nổi; ô còn lại phủ mây. Chỉ hiển thị — không có thao tác "mở" nào ở R02 (dự kiến R04).
 */
export function MilestoneTrail({ earnedTotal, className }: MilestoneTrailProps) {
  const t = vi.gameWorld.milestones;
  const reached = tilesAllowed(earnedTotal);
  const points = milestonePoints(MAP_TILES.length);
  return (
    <ol className={cn("grid grid-cols-2 gap-3 min-[420px]:grid-cols-4 lg:grid-cols-8", className)}>
      {MAP_TILES.map((tile, index) => {
        const at = points[index] ?? (index + 1) * MAP_TILE_STEP;
        const done = index < reached;
        const next = index === reached;
        return (
          <li
            key={tile.key}
            aria-label={
              done
                ? t.itemReached.replace("{name}", tile.name).replace("{n}", String(at))
                : t.itemLocked.replace("{n}", String(at))
            }
            className={cn(
              "flex flex-col overflow-hidden rounded-2xl border-2 bg-surface",
              done ? "border-jade-300 shadow-soft" : next ? "border-sun-400 shadow-glow-sun" : "border-line",
            )}
          >
            <div
              className={cn("relative aspect-square", done ? "animate-pop-in" : "")}
              style={{ animationDelay: `${index * 80}ms` }}
            >
              {done ? <MapTileArt tile={tile.key} /> : <FogTileArt />}
              <span
                aria-hidden="true"
                className={cn(
                  "absolute top-1.5 right-1.5 flex size-7 items-center justify-center rounded-full shadow-soft",
                  done ? "bg-jade-600 text-white" : "bg-surface text-ink-faint",
                )}
              >
                {done ? <Check className="size-4" strokeWidth={3} /> : <Lock className="size-3.5" strokeWidth={2.6} />}
              </span>
            </div>
            <div aria-hidden="true" className="flex flex-col px-2 py-1.5 text-center">
              <span className="truncate text-xs font-extrabold text-ink">
                {done ? tile.name : next ? t.next : t.locked}
              </span>
              <span className="text-xs font-semibold text-ink-soft">{t.at.replace("{n}", String(at))}</span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
