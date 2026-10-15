"use client";

import type { ReactNode } from "react";
import { ToneGlyph } from "@/components/kid/tone-glyph";
import { applyTone } from "@/lib/vietnamese/tone";
import { cn } from "@/lib/cn";
import { vi } from "@/strings/vi";
import { StimulusPicture, TextOptionGrid } from "../../ui/option-grid";
import type { PlayerProps } from "../../ui/player-types";
import type { FillBlankItem } from "./schema";

/** Dạng 4 — Điền âm, vần, dấu thanh: chọn phương án, chữ hiện vào chỗ trống. */
export function FillBlankPlayer({ view, response, onChange, locked, marks, hint, reveal }: PlayerProps<FillBlankItem>) {
  const { template, options, picture } = view.content;
  const chosen = response?.kind === "choice" ? options.find((option) => option.id === response.optionId) : undefined;

  let middle: ReactNode;
  if (view.variant === "missing_tone") {
    const filled =
      chosen?.tone && template.markIndex !== undefined
        ? applyTone(template.before, chosen.tone, template.markIndex)
        : template.before;
    middle = (
      <>
        <span>{filled}</span>
        <span
          aria-hidden="true"
          className={cn(
            "ml-2 inline-flex size-14 items-center justify-center rounded-xl border-[3px] align-middle",
            chosen ? "border-brand-600 bg-brand-50" : "border-dashed border-ink-faint",
          )}
        >
          {chosen?.tone ? <ToneGlyph tone={chosen.tone} className="size-9" /> : null}
        </span>
      </>
    );
  } else {
    middle = (
      <>
        {template.before}
        <span
          className={cn(
            "mx-0.5 inline-block min-w-12 rounded-lg border-b-4 px-1 text-center",
            chosen ? "border-brand-600 bg-brand-50" : "border-ink-faint bg-surface-muted",
          )}
        >
          {chosen ? chosen.text : "\u00a0\u00a0"}
        </span>
        {template.after}
      </>
    );
  }

  return (
    <div className="flex flex-col items-center gap-6">
      {picture ? (
        <StimulusPicture
          iconKey={picture.iconKey}
          name={reveal?.pictureNames?.[picture.pictureId]}
          enlarge={hint?.enlargePicture ?? false}
        />
      ) : null}
      <p
        lang="vi"
        className="rounded-card border-2 border-ink bg-surface px-6 py-3 font-reading text-read-xl font-bold text-ink"
      >
        {template.wordPrefix}
        {middle}
        {template.wordSuffix}
      </p>
      <TextOptionGrid
        options={options}
        selected={chosen ? [chosen.id] : []}
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
