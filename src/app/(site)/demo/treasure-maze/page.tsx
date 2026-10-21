import type { Metadata } from "next";
import { MotionScope } from "@/components/adventure/motion";
import { Container } from "@/components/ui/container";
import { levelFileSchema, toLevel } from "@/features/game-engine/levels/schema";
import { MazePlayer } from "@/features/game-engine/ui/maze-player";
import { vi } from "@/strings/vi";
import level1 from "../../../../../content/games/treasure-maze/levels/level-01.json";
import level2 from "../../../../../content/games/treasure-maze/levels/level-02.json";
import level3 from "../../../../../content/games/treasure-maze/levels/level-03.json";

export const metadata: Metadata = {
  title: vi.treasureMazeDemo.meta.title,
  robots: { index: false },
};

const FILES = [level1, level2, level3].map((raw) => levelFileSchema.parse(raw));

/** /demo/treasure-maze — R07.4: đi lại được bằng lõi Game Engine; dữ liệu minh họa, không điểm, không lưu gì. */
export default function TreasureMazeDemoPage() {
  const t = vi.treasureMazeDemo;
  return (
    <MotionScope>
      <Container className="py-6 sm:py-10">
        <p
          role="note"
          className="inline-flex rounded-full border-2 border-dashed border-sun-400 bg-sun-50 px-4 py-2 text-sm font-extrabold tracking-wide text-sun-800 uppercase"
        >
          {t.ribbon}
        </p>
        <h1 className="mt-4 text-3xl font-extrabold text-ink">{t.title}</h1>
        <p className="mt-2 mb-6 max-w-prose text-ink-soft">{t.note}</p>
        <MazePlayer levels={FILES.map(toLevel)} names={FILES.map((file) => file.name)} />
      </Container>
    </MotionScope>
  );
}
