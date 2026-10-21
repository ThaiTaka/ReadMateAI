import type { Metadata } from "next";
import { MotionScope, MotionToggle } from "@/components/adventure/motion";
import { MazeBoard } from "@/components/art/maze-board";
import { Container } from "@/components/ui/container";
import { vi } from "@/strings/vi";

export const metadata: Metadata = {
  title: vi.treasureMazeDemo.meta.title,
  robots: { index: false },
};

/** /demo/treasure-maze — nguyên mẫu đồ họa R07.1: chỉ vẽ, không điểm, không điều khiển, không lưu gì. */
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
        <p className="mt-2 max-w-prose text-ink-soft">{t.note}</p>
        <div className="mx-auto mt-6 w-full max-w-[34rem]" data-testid="maze-board">
          <MazeBoard title={t.boardLabel} />
        </div>
        <div className="mt-6">
          <MotionToggle />
        </div>
      </Container>
    </MotionScope>
  );
}
