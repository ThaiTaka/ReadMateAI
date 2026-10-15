"use client";

import { ReadingText } from "@/components/kid/reading-text";
import { vi } from "@/strings/vi";
import { TextOptionGrid } from "../../ui/option-grid";
import type { PlayerProps } from "../../ui/player-types";
import type { IdentifyUnitItem } from "./schema";

/** Dạng 3 — Tìm âm, vần, thanh trong tiếng (một đáp án) hoặc chọn mọi tiếng có vần cho sẵn (nhiều đáp án). */
export function IdentifyUnitPlayer({
  view,
  response,
  onChange,
  locked,
  marks,
  hint,
  reveal,
}: PlayerProps<IdentifyUnitItem>) {
  if (view.variant === "find_with_unit") {
    const selected = response?.kind === "multi" ? response.optionIds : [];
    const toggle = (id: string) =>
      onChange({
        kind: "multi",
        optionIds: selected.includes(id) ? selected.filter((other) => other !== id) : [...selected, id],
      });
    return (
      <div className="flex flex-col items-center gap-6">
        <div className="flex flex-col items-center gap-1 rounded-card border-2 border-ink bg-surface px-8 py-3">
          <span className="text-sm font-bold uppercase tracking-wider text-ink-faint">
            {vi.practice.findUnit.target}
          </span>
          <ReadingText text={view.content.unitText} size="xl" />
        </div>
        <TextOptionGrid
          options={view.content.options}
          selected={selected}
          onToggle={toggle}
          locked={locked}
          marks={marks}
          hint={hint}
          reveal={reveal}
          groupLabel={vi.practice.groups.syllables}
        />
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center gap-6">
      <div className="rounded-card border-2 border-ink bg-surface px-10 py-4">
        <ReadingText
          text={view.content.syllable}
          size="xl"
          segments={hint?.highlightParts ? hint.segments : undefined}
          className={
            hint?.highlightParts && !hint.segments ? "underline decoration-sun-400 decoration-4 underline-offset-8" : ""
          }
        />
      </div>
      <TextOptionGrid
        options={view.content.options}
        selected={response?.kind === "choice" ? [response.optionId] : []}
        onToggle={(id) => onChange({ kind: "choice", optionId: id })}
        locked={locked}
        marks={marks}
        hint={hint}
        reveal={reveal}
        groupLabel={vi.practice.groups.units}
      />
    </div>
  );
}
