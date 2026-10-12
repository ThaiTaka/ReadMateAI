import type { Metadata } from "next";
import { BookOpen, Eye, Heart, Lock, Puzzle, Star, Sticker } from "lucide-react";
import { MascotOwl } from "@/components/illustrations/mascot-owl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { vi } from "@/strings/vi";

export const metadata: Metadata = {
  title: vi.learn.meta.title,
  description: vi.learn.meta.description,
};

/** Cùng biểu tượng với dạng bài tương ứng: Nhìn (nhận diện chữ – âm), Ghép, Đọc. */
const TASK_ICONS = [Eye, Puzzle, BookOpen] as const;
const STICKER_SLOTS = 4;
const STAR_COUNT = 5;

/** Góc học tập (khung giao diện). Không đọc, không lưu thông tin học sinh. */
export default function LearnPage() {
  const t = vi.learn;

  return (
    <div className="space-y-8">
      <section aria-labelledby="learn-greeting" className="flex items-center gap-4">
        <MascotOwl className="size-24 shrink-0" />
        <div>
          <h1 id="learn-greeting" className="text-3xl font-extrabold leading-tight text-ink">
            {t.greeting}
          </h1>
          <p className="mt-1 text-lg font-semibold text-ink-soft">{t.greetingSub}</p>
        </div>
      </section>

      <p className="rounded-2xl bg-sun-50 px-4 py-3 text-sm font-semibold text-sun-800">{t.previewNote}</p>

      <section id="nhiem-vu" aria-labelledby="learn-tasks-title">
        <h2 id="learn-tasks-title" className="text-2xl font-extrabold text-ink">
          {t.tasks.title}
        </h2>
        <ul className="mt-4 space-y-3">
          {t.tasks.items.map((task, index) => {
            const Icon = TASK_ICONS[index] ?? BookOpen;
            return (
              <li
                key={task.title}
                className="flex min-h-touch-kid items-center gap-4 rounded-tile border-2 border-line bg-surface p-4"
              >
                <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">
                  <Icon aria-hidden="true" className="size-7" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-lg font-bold text-ink">{task.title}</p>
                  <p className="text-ink-soft">{task.hint}</p>
                </div>
                <Badge tone="neutral">{vi.status.comingSoon}</Badge>
              </li>
            );
          })}
        </ul>
        <div className="mt-5">
          <Button size="kid" disabled className="w-full" aria-describedby="learn-start-note">
            <Lock aria-hidden="true" className="size-6" />
            {t.tasks.start}
          </Button>
          <p id="learn-start-note" className="mt-2 text-center text-sm font-semibold text-ink-soft">
            {t.tasks.startNote}
          </p>
        </div>
      </section>

      <section id="bai-tap" aria-labelledby="learn-exercise-title">
        <h2 id="learn-exercise-title" className="text-2xl font-extrabold text-ink">
          {t.exercise.title}
        </h2>
        <EmptyState
          className="mt-4"
          icon={<BookOpen className="size-8" />}
          title={t.exercise.emptyTitle}
          description={t.exercise.emptyText}
        />
      </section>

      <section id="thanh-tich" aria-labelledby="learn-achievements-title">
        <h2 id="learn-achievements-title" className="text-2xl font-extrabold text-ink">
          {t.achievements.title}
        </h2>
        <Card className="mt-4">
          <p className="text-ink-soft">{t.achievements.text}</p>
          <ul className="mt-4 grid grid-cols-4 gap-3">
            {Array.from({ length: STICKER_SLOTS }, (_, index) => (
              <li
                key={index}
                className="flex aspect-square items-center justify-center rounded-2xl border-2 border-dashed border-line-strong text-line-strong"
              >
                <Sticker aria-hidden="true" className="size-7" />
                <span className="sr-only">{t.achievements.stickerSlot}</span>
              </li>
            ))}
          </ul>
          <div className="mt-5 flex items-center gap-3">
            <span className="text-sm font-semibold text-ink-soft">{t.achievements.starsLabel}:</span>
            <span className="flex gap-1" aria-hidden="true">
              {Array.from({ length: STAR_COUNT }, (_, index) => (
                <Star key={index} className="size-6 text-line-strong" />
              ))}
            </span>
            <span className="font-bold text-ink">0/{STAR_COUNT}</span>
          </div>
        </Card>
      </section>

      <section aria-labelledby="learn-parents-title">
        <Card variant="tinted" className="flex gap-4">
          <Heart aria-hidden="true" className="mt-1 size-6 shrink-0 text-brand-700" />
          <div>
            <h2 id="learn-parents-title" className="text-lg font-bold text-ink">
              {t.parents.title}
            </h2>
            <p className="mt-1 leading-relaxed text-ink-soft">{t.parents.text}</p>
          </div>
        </Card>
      </section>
    </div>
  );
}
