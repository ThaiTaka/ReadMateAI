"use client";

import { Eraser, Lock, Undo2 } from "lucide-react";
import { ReadingText } from "@/components/kid/reading-text";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { vi } from "@/strings/vi";
import { PictureOptionGrid, TextOptionGrid } from "../../ui/option-grid";
import type { ItemView, PlayerProps } from "../../ui/player-types";
import { withFixedTokens } from "./runtime";
import type { SentenceReadingItem } from "./schema";

type ArrangeView = Extract<ItemView<SentenceReadingItem>, { variant: "arrange_words" }>;

function ArrangeWords({
  view,
  response,
  onChange,
  locked,
  hint,
  reveal,
}: PlayerProps<SentenceReadingItem> & { view: ArrangeView }) {
  const t = vi.practice.arrange;
  const tokens = view.content.tokens;
  // Thẻ được gợi ý đặt sẵn (bộ chạy phiên đã đưa chúng vào câu trả lời khi bật gợi ý).
  const fixed = hint?.fixedTokenIds ?? [];
  const order = reveal ? reveal.correctIds : response?.kind === "order" ? response.tokenIds : [];

  const placed = order.map((id) => tokens.find((token) => token.id === id)).filter((token) => token !== undefined);
  const bank = tokens.filter((token) => !order.includes(token.id));
  const middleOf = (ids: readonly string[]) => ids.filter((id) => !fixed.includes(id));
  const commit = (middle: string[]) => onChange({ kind: "order", tokenIds: withFixedTokens(middle, fixed) });

  return (
    <div className="flex flex-col gap-5">
      <div
        role="group"
        aria-label={t.answer}
        className="flex min-h-24 flex-wrap items-center gap-2 rounded-card border-2 border-ink bg-surface p-3"
      >
        {placed.length === 0 ? <span className="px-2 text-ink-faint">{t.empty}</span> : null}
        {placed.map((token) => {
          const isFixed = fixed.includes(token.id);
          return (
            <button
              key={token.id}
              type="button"
              disabled={locked || isFixed}
              onClick={() => commit(middleOf(order).filter((id) => id !== token.id))}
              className={cn(
                "inline-flex min-h-touch-kid items-center gap-1 rounded-tile border-[3px] px-4 font-reading text-read font-bold",
                isFixed ? "border-dashed border-sun-500 bg-sun-50" : "border-brand-600 bg-brand-50",
                reveal && "border-brand-700 bg-brand-100",
              )}
            >
              {isFixed ? <Lock aria-hidden="true" className="size-4" /> : null}
              {token.text}
            </button>
          );
        })}
      </div>
      <div role="group" aria-label={t.bank} className="flex flex-wrap justify-center gap-2">
        {bank.map((token) => (
          <button
            key={token.id}
            type="button"
            disabled={locked}
            onClick={() => commit([...middleOf(order), token.id])}
            className="inline-flex min-h-touch-kid min-w-touch-kid items-center justify-center rounded-tile border-[3px] border-line-strong bg-surface px-4 font-reading text-read font-bold shadow-soft hover:border-brand-400"
          >
            {token.text}
          </button>
        ))}
      </div>
      {!locked ? (
        <div className="flex flex-wrap justify-center gap-2">
          <Button
            variant="ghost"
            size="md"
            disabled={middleOf(order).length === 0}
            onClick={() => commit(middleOf(order).slice(0, -1))}
          >
            <Undo2 aria-hidden="true" className="size-5" />
            {vi.practice.controls.removeLast}
          </Button>
          <Button variant="ghost" size="md" disabled={middleOf(order).length === 0} onClick={() => commit([])}>
            <Eraser aria-hidden="true" className="size-5" />
            {vi.practice.controls.clear}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

/** Dạng 6 — Đọc câu – hiểu câu. Không đọc câu trước khi chấm; gợi ý chỉ bằng hình thức (tách tiếng…). */
export function SentenceReadingPlayer(props: PlayerProps<SentenceReadingItem>) {
  const { view, response, onChange, locked, marks, hint, reveal } = props;
  if (view.variant === "arrange_words") return <ArrangeWords {...props} view={view} />;
  const sentenceBox = (
    <div className="rounded-card border-2 border-ink bg-surface px-6 py-3 text-center">
      <ReadingText text={view.content.sentence} size="lg" split={hint?.splitSyllables ?? false} />
    </div>
  );
  if (view.variant === "comprehension_question") {
    return (
      <div className="flex flex-col items-center gap-5">
        {sentenceBox}
        <p className="flex items-center gap-2">
          <span aria-hidden="true" className="text-2xl font-extrabold text-coral-600">
            ?
          </span>
          <ReadingText text={view.content.question} size="md" />
        </p>
        <TextOptionGrid
          options={view.content.options}
          selected={response?.kind === "choice" ? [response.optionId] : []}
          onToggle={(id) => onChange({ kind: "choice", optionId: id })}
          locked={locked}
          marks={marks}
          hint={hint}
          reveal={reveal}
          kind="compact"
          groupLabel={vi.practice.groups.answers}
        />
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center gap-6">
      {sentenceBox}
      <PictureOptionGrid
        options={view.content.options}
        selected={response?.kind === "choice" ? response.optionId : null}
        onSelect={(id) => onChange({ kind: "choice", optionId: id })}
        locked={locked}
        marks={marks}
        hint={hint}
        reveal={reveal}
        groupLabel={vi.practice.groups.pictures}
      />
    </div>
  );
}
