"use client";

import { Ear } from "lucide-react";
import { ReadingText } from "@/components/kid/reading-text";
import { vi } from "@/strings/vi";
import { StimulusPicture, TextOptionGrid } from "../../ui/option-grid";
import type { PlayerProps } from "../../ui/player-types";
import type { LetterSoundItem } from "./schema";

/** Dạng 1 — Nhận diện chữ – âm: chạm chọn một thẻ chữ. */
export function LetterSoundPlayer({
  view,
  response,
  onChange,
  locked,
  marks,
  hint,
  reveal,
  stimulusAudio,
}: PlayerProps<LetterSoundItem>) {
  const selected = response?.kind === "choice" ? [response.optionId] : [];
  return (
    <div className="flex flex-col items-center gap-6">
      {view.variant === "picture_onset" ? (
        <StimulusPicture
          iconKey={view.content.picture.iconKey}
          name={reveal?.pictureNames?.[view.content.picture.pictureId]}
          enlarge={hint?.enlargePicture ?? false}
        />
      ) : null}
      {view.variant === "visual_match" ? (
        <div className="flex flex-col items-center gap-1 rounded-card border-2 border-ink bg-surface px-10 py-4">
          <span className="text-sm font-bold uppercase tracking-wider text-ink-faint">
            {vi.practice.picture.sample}
          </span>
          <ReadingText text={view.content.sample} size="xl" />
        </div>
      ) : null}
      {view.variant === "listen_letter" ? (
        <div className="flex flex-col items-center gap-2 rounded-card border-2 border-dashed border-line-strong bg-surface-muted px-8 py-5 text-ink-soft">
          <Ear aria-hidden="true" className="size-12" />
          <span className="font-semibold">{vi.practice.picture.listen}</span>
          {stimulusAudio}
        </div>
      ) : null}
      <TextOptionGrid
        options={view.content.options}
        selected={selected}
        onToggle={(id) => onChange({ kind: "choice", optionId: id })}
        locked={locked}
        marks={marks}
        hint={hint}
        reveal={reveal}
        groupLabel={vi.practice.groups.letters}
      />
    </div>
  );
}
