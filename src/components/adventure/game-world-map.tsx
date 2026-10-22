import { Home, Lock, Star } from "lucide-react";
import { WORLD_MAP_SPOTS, WorldMapScene } from "@/components/art/world-map";
import { gameWorld } from "@/features/game-world/catalog";
import type { GameUnlockState } from "@/features/gamification/unlocks";
import { cn } from "@/lib/cn";
import { vi } from "@/strings/vi";

type GameWorldMapProps = {
  states: readonly GameUnlockState[];
  className?: string;
};

/**
 * Bản đồ thế giới: hình SVG có sương mù trên vùng chưa đủ điểm + lớp ghim tên khu vực bằng HTML (khớp tọa độ
 * WORLD_MAP_SPOTS). Ghim chỉ để nhìn (aria-hidden) — thao tác thật nằm ở các thẻ khu vực bên dưới (nút ≥ 64px).
 */
export function GameWorldMap({ states, className }: GameWorldMapProps) {
  const fogged = states.filter((state) => !state.eligible).map((state) => state.game);
  const station = WORLD_MAP_SPOTS.practice_station;
  return (
    <div
      className={cn(
        "relative aspect-[5/4] overflow-hidden rounded-world shadow-world ring-4 ring-white sm:aspect-[5/3]",
        className,
      )}
    >
      <WorldMapScene fogged={fogged} title={vi.gameWorld.mapLabel} />
      <div aria-hidden="true">
        <span
          className="absolute flex -translate-x-1/2 translate-y-3 items-center gap-1 rounded-full bg-surface/95 px-2.5 py-1 text-xs font-extrabold whitespace-nowrap text-coral-800 shadow-soft sm:text-sm"
          style={{ left: `${station.x}%`, top: `${station.y}%` }}
        >
          <Home className="size-3.5" />
          {vi.gameWorld.station}
        </span>
        {states.map((state) => {
          const spot = WORLD_MAP_SPOTS[state.game];
          return (
            <span
              key={state.game}
              className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1"
              style={{ left: `${spot.x}%`, top: `${spot.y}%` }}
            >
              <span
                className={cn(
                  "flex size-9 items-center justify-center rounded-full text-sm font-extrabold shadow-lift ring-4 sm:size-11",
                  state.eligible ? "bg-jade-600 text-white ring-white" : "bg-surface text-magic-700 ring-magic-200",
                )}
              >
                {state.eligible ? <Star className="size-4 sm:size-5" /> : <Lock className="size-4 sm:size-5" />}
              </span>
              <span className="hidden rounded-full bg-surface/95 px-2.5 py-0.5 text-xs font-extrabold whitespace-nowrap text-ink shadow-soft sm:block sm:text-sm">
                {gameWorld(state.game).name}
              </span>
            </span>
          );
        })}
      </div>
    </div>
  );
}
