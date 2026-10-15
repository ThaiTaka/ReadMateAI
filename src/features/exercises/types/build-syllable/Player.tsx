"use client";

import { Plus } from "lucide-react";
import { ChoiceTile } from "@/components/kid/choice-tile";
import { ReadingText } from "@/components/kid/reading-text";
import { ToneGlyph } from "@/components/kid/tone-glyph";
import type { BuildResponse } from "@/features/exercises/core/primitives";
import { applyTone } from "@/lib/vietnamese/tone";
import { vi } from "@/strings/vi";
import { StimulusPicture, TextOptionGrid } from "../../ui/option-grid";
import type { ItemView, PlayerProps } from "../../ui/player-types";
import type { BuildSyllableItem, Tile, ToneTile } from "./schema";

type PictureBuildView = Extract<ItemView<BuildSyllableItem>, { variant: "picture_build" }>;

/** Tiếng trẻ đang ghép từ các thẻ đã chọn (hiện dần — PRD §9.2 dạng 2). */
function composedText(view: PictureBuildView, response: BuildResponse): string | null {
  const { onsets, rimes, tones } = view.content.tiles;
  const onset = onsets.find((tile) => tile.id === response.onset);
  const rime = rimes.find((tile) => tile.id === response.rime);
  const tone = tones.find((tile) => tile.id === response.tone);
  if (!onset && !rime) return null;
  const base = `${onset?.text ?? ""}${rime?.text ?? ""}`;
  if (!rime || !tone || tone.tone === "ngang" || rime.markIndex === undefined) return base;
  return applyTone(base, tone.tone, Array.from(onset?.text ?? "").length + rime.markIndex);
}

function TileGroup<T extends Tile | ToneTile>({
  label,
  tiles,
  chosen,
  onChoose,
  locked,
  marks,
  eliminated,
  answerIds,
}: {
  label: string;
  tiles: readonly T[];
  chosen: string | null;
  onChoose: (id: string | null) => void;
  locked: boolean;
  marks: PlayerProps<BuildSyllableItem>["marks"];
  eliminated: readonly string[];
  answerIds: readonly string[];
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-col gap-2">
      <span className="text-sm font-bold uppercase tracking-wider text-ink-faint">{label}</span>
      <div className="flex flex-wrap gap-2">
        {tiles.map((tile) => (
          <ChoiceTile
            key={tile.id}
            kind="compact"
            selected={chosen === tile.id}
            mark={marks[tile.id]}
            isAnswer={answerIds.includes(tile.id)}
            eliminated={eliminated.includes(tile.id)}
            disabled={locked}
            onSelect={() => onChoose(chosen === tile.id ? null : tile.id)}
            className={"tone" in tile ? "flex-col gap-0.5 px-3" : ""}
          >
            {"tone" in tile ? (
              <>
                <ToneGlyph tone={tile.tone} />
                <span className="font-sans text-base font-bold">{tile.text}</span>
              </>
            ) : (
              <span>{tile.text}</span>
            )}
          </ChoiceTile>
        ))}
      </div>
    </div>
  );
}

export function BuildSyllablePlayer({
  view,
  response,
  onChange,
  locked,
  marks,
  hint,
  reveal,
}: PlayerProps<BuildSyllableItem>) {
  const t = vi.practice.build;
  if (view.variant === "parts_to_syllable") {
    const { parts } = view.content;
    return (
      <div className="flex flex-col items-center gap-6">
        <div
          role="group"
          aria-label={vi.practice.groups.parts}
          className="flex flex-wrap items-center justify-center gap-2"
        >
          {parts.onset ? (
            <span className="rounded-tile border-2 border-lagoon-200 bg-lagoon-50 px-4 py-2">
              <ReadingText text={parts.onset} />
            </span>
          ) : null}
          <Plus aria-hidden="true" className="size-6 text-ink-faint" />
          <span className="rounded-tile border-2 border-sun-200 bg-sun-50 px-4 py-2">
            <ReadingText text={parts.rime} />
          </span>
          <Plus aria-hidden="true" className="size-6 text-ink-faint" />
          <span className="flex flex-col items-center rounded-tile border-2 border-coral-200 bg-coral-50 px-3 py-1">
            <ToneGlyph tone={parts.tone} />
            <span className="text-sm font-bold text-ink">{parts.toneLabel}</span>
          </span>
        </div>
        <TextOptionGrid
          options={view.content.options}
          selected={response?.kind === "choice" ? [response.optionId] : []}
          onToggle={(id) => onChange({ kind: "choice", optionId: id })}
          locked={locked}
          marks={marks}
          hint={hint}
          reveal={reveal}
          groupLabel={vi.practice.groups.syllables}
        />
      </div>
    );
  }

  const current: BuildResponse =
    response?.kind === "build" ? response : { kind: "build", onset: null, rime: null, tone: null };
  const set = (group: "onset" | "rime" | "tone") => (id: string | null) => onChange({ ...current, [group]: id });
  const composed = composedText(view, current);
  const eliminated = hint?.eliminate ?? [];
  const answerIds = reveal?.correctIds ?? [];
  return (
    <div className="flex flex-col items-center gap-5">
      <StimulusPicture
        iconKey={view.content.picture.iconKey}
        name={reveal?.pictureNames?.[view.content.picture.pictureId]}
        enlarge={hint?.enlargePicture ?? false}
      />
      <div className="flex min-h-20 min-w-48 flex-col items-center justify-center rounded-card border-2 border-ink bg-surface px-6 py-2">
        <span className="text-xs font-bold uppercase tracking-wider text-ink-faint">{t.result}</span>
        {composed ? <ReadingText text={composed} size="lg" /> : <span className="text-ink-faint">{t.empty}</span>}
      </div>
      <div className="flex w-full flex-col gap-4">
        <TileGroup
          label={t.onsets}
          tiles={view.content.tiles.onsets}
          chosen={current.onset}
          onChoose={set("onset")}
          {...{ locked, marks, eliminated, answerIds }}
        />
        <TileGroup
          label={t.rimes}
          tiles={view.content.tiles.rimes}
          chosen={current.rime}
          onChoose={set("rime")}
          {...{ locked, marks, eliminated, answerIds }}
        />
        <TileGroup
          label={t.tones}
          tiles={view.content.tiles.tones}
          chosen={current.tone}
          onChoose={set("tone")}
          {...{ locked, marks, eliminated, answerIds }}
        />
      </div>
    </div>
  );
}
