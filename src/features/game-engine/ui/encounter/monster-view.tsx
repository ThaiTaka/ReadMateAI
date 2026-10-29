import { FriendlyMonster } from "@/components/art/characters";
import { cn } from "@/lib/cn";
import { vi } from "@/strings/vi";
import { monsterHue, monsterName, publicMonsterKey } from "./monster-catalog.ts";

export type MonsterMood = "idle" | "defeated" | "undefeated";

const STAR = "M0-12 3-3.5 12 0 3 3.5 0 12-3 3.5-12 0-3-3.5z";
const STARS: readonly { left: string; top: string; size: number; delay: string; color: string }[] = [
  { left: "6%", top: "18%", size: 30, delay: "0s", color: "#ffd44d" },
  { left: "82%", top: "10%", size: 36, delay: "0.2s", color: "#9f80fa" },
  { left: "88%", top: "58%", size: 26, delay: "0.4s", color: "#ffd44d" },
  { left: "2%", top: "62%", size: 28, delay: "0.3s", color: "#ff8aa8" },
  { left: "44%", top: "-4%", size: 32, delay: "0.1s", color: "#ffd44d" },
];

/**
 * Hình quái vật của màn chạm trán (R08.4). Dùng lại nhân vật SVG có sẵn, đổi màu theo mã. Trạng thái gốc của mỗi phần tử
 * là trạng thái cuối nên khi giảm chuyển động vẫn đọc được; mọi hoạt cảnh chạy một lần, không nhấp nháy.
 *  - idle: hiện ra từ từ (≤ 1 s) khi `entrance`; mỗi lần mất một trái tim nhún nhẹ (key = hp ở nơi gọi).
 *  - defeated: mỉm cười, xoay nhẹ rồi thu nhỏ thành những ngôi sao.
 *  - undefeated: vẫy tay, bay đi ngủ ("Zzz").
 */
export function MonsterView({
  monsterKey,
  mood = "idle",
  entrance = false,
  className,
}: {
  monsterKey: string;
  mood?: MonsterMood;
  entrance?: boolean;
  className?: string;
}) {
  const name = monsterName(monsterKey);
  const motion =
    mood === "defeated"
      ? "animate-monster-spin"
      : mood === "undefeated"
        ? "animate-monster-away"
        : entrance
          ? "animate-monster-in"
          : "";
  return (
    <div
      data-testid="monster-view"
      data-monster={publicMonsterKey(monsterKey)}
      data-mood={mood}
      className={cn("relative mx-auto aspect-square w-40 max-w-full sm:w-48", className)}
    >
      {mood === "idle" && entrance ? (
        <span
          aria-hidden="true"
          data-testid="monster-glow"
          className="animate-monster-in absolute -inset-3 rounded-full bg-[radial-gradient(circle,rgb(255_227_138/0.75),transparent_65%)]"
        />
      ) : null}
      <div
        className={cn("relative origin-center", motion)}
        style={{ filter: `hue-rotate(${monsterHue(monsterKey)}deg)` }}
      >
        <FriendlyMonster title={vi.encounter.monsterLabel.replace("{name}", name)} />
      </div>
      {mood === "defeated"
        ? STARS.map((star, index) => (
            <svg
              key={index}
              viewBox="-14 -14 28 28"
              aria-hidden="true"
              data-testid="monster-star"
              className="animate-star-rise absolute"
              style={{
                left: star.left,
                top: star.top,
                width: star.size,
                height: star.size,
                animationDelay: star.delay,
              }}
            >
              <path d={STAR} fill={star.color} stroke="#ffffff" strokeWidth="1.5" strokeLinejoin="round" />
            </svg>
          ))
        : null}
      {mood === "undefeated" ? (
        <span
          aria-hidden="true"
          data-testid="monster-zzz"
          className="animate-star-rise absolute top-0 right-2 text-3xl font-extrabold tracking-widest text-magic-700"
          style={{ animationDelay: "0.8s" }}
        >
          Zzz
        </span>
      ) : null}
    </div>
  );
}
