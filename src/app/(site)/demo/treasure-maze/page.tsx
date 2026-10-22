import type { Metadata } from "next";
import { MotionScope } from "@/components/adventure/motion";
import { Container } from "@/components/ui/container";
import { BUNDLED_LEVEL_FILES, BUNDLED_LEVELS } from "@/features/game-engine/levels/bundled";
import { MazePlayer } from "@/features/game-engine/ui/maze-player";
import { vi } from "@/strings/vi";

export const metadata: Metadata = {
  title: vi.treasureMazeDemo.meta.title,
  robots: { index: false },
};

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
        <MazePlayer levels={BUNDLED_LEVELS} names={BUNDLED_LEVEL_FILES.map((file) => file.name)} />
      </Container>
    </MotionScope>
  );
}
