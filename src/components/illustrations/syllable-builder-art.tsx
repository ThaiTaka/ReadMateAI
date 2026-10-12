import { ArrowDown, CircleCheck, Plus, Volume2 } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { vi } from "@/strings/vi";

function Tile({ children, className, caption }: { children: ReactNode; className: string; caption?: string }) {
  return (
    <span className="flex flex-col items-center gap-1">
      <span
        className={cn(
          "flex size-16 items-center justify-center rounded-tile font-reading text-read-lg font-bold shadow-soft sm:size-20",
          className,
        )}
      >
        {children}
      </span>
      {caption ? <span className="text-xs font-semibold text-ink-faint">{caption}</span> : null}
    </span>
  );
}

/**
 * Minh họa ghép tiếng b + a + dấu huyền → bà (mô hình đánh vần lớp 1).
 * Dựng bằng HTML/CSS (không dùng ảnh) để nhẹ và sắc nét; toàn khối được mô tả bằng aria-label.
 */
export function SyllableBuilderArt({ className }: { className?: string }) {
  const t = vi.home.hero;
  return (
    <figure role="img" aria-label={t.artLabel} className={cn("relative mx-auto w-full max-w-md", className)}>
      <div aria-hidden="true" className="absolute -left-6 -top-6 size-40 rounded-full bg-sun-200/60 blur-2xl" />
      <div aria-hidden="true" className="absolute -bottom-8 -right-4 size-48 rounded-full bg-brand-200/60 blur-2xl" />

      <div className="relative rounded-[2rem] border border-line bg-surface p-6 shadow-lift sm:p-8">
        <div className="flex items-start justify-center gap-2 sm:gap-3">
          <Tile className="bg-lagoon-100 text-lagoon-800">b</Tile>
          <Plus aria-hidden="true" className="mt-5 size-5 text-ink-faint sm:mt-7" />
          <Tile className="bg-brand-100 text-brand-800">a</Tile>
          <Plus aria-hidden="true" className="mt-5 size-5 text-ink-faint sm:mt-7" />
          <Tile className="bg-sun-100 text-sun-800" caption={t.artToneLabel}>
            `
          </Tile>
        </div>

        <ArrowDown aria-hidden="true" className="mx-auto my-3 size-7 text-brand-600" />

        <div className="flex justify-center">
          <span className="flex h-24 min-w-36 items-center justify-center rounded-tile bg-brand-600 px-8 font-reading text-read-xl font-bold text-white shadow-soft">
            bà
          </span>
        </div>
        <p className="mt-4 text-center font-reading text-lg text-ink-soft">{t.artSpelling}</p>
      </div>

      <div className="absolute -left-2 top-1/3 hidden items-center gap-2 rounded-full border border-line bg-surface px-3 py-2 text-sm font-semibold text-ink shadow-soft sm:flex">
        <Volume2 aria-hidden="true" className="size-4 text-lagoon-600" />
        {vi.home.process.steps[0].title}
      </div>
      <div className="absolute -bottom-4 right-6 hidden items-center gap-2 rounded-full border border-line bg-surface px-3 py-2 text-sm font-semibold text-ink shadow-soft sm:flex">
        <CircleCheck aria-hidden="true" className="size-4 text-brand-600" />
        {vi.home.process.steps[3].title}
      </div>
    </figure>
  );
}
