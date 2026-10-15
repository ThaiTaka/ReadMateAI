"use client";

import { useState } from "react";
import { ChoiceTile } from "@/components/kid/choice-tile";
import { PictureIcon } from "@/components/kid/picture-icon";
import { ReadingText } from "@/components/kid/reading-text";
import { vi } from "@/strings/vi";
import { PictureOptionGrid } from "../../ui/option-grid";
import type { ItemView, PlayerProps } from "../../ui/player-types";
import { neutralPictureLabel } from "./runtime";
import type { WordPictureItem } from "./schema";

type MatchView = Extract<ItemView<WordPictureItem>, { variant: "match_pairs" }>;

function PairBadge({ n }: { n: number }) {
  return (
    <span className="absolute left-1.5 top-1.5 flex size-7 items-center justify-center rounded-full bg-ink text-sm font-extrabold text-white">
      {n}
    </span>
  );
}

/** Nối từ – tranh bằng chạm: chạm một từ, rồi chạm tranh. Cặp được đánh SỐ (không chỉ bằng màu). */
function MatchPairs({
  view,
  response,
  onChange,
  locked,
  marks,
  reveal,
}: PlayerProps<WordPictureItem> & { view: MatchView }) {
  const t = vi.practice.match;
  const [activeWord, setActiveWord] = useState<string | null>(null);
  const pairs = response?.kind === "match" ? response.pairs : {};
  const words = view.content.words;
  const numberOf = (wordId: string) => words.findIndex((word) => word.id === wordId) + 1;
  // Đáp án (sau khi xong): reveal.correctIds là danh sách phẳng [từ, tranh, từ, tranh…].
  const revealPairs: Record<string, string> = {};
  if (reveal) {
    for (let index = 0; index + 1 < reveal.correctIds.length; index += 2) {
      const word = reveal.correctIds[index];
      const picture = reveal.correctIds[index + 1];
      if (word && picture) revealPairs[word] = picture;
    }
  }
  const shownPairs = reveal ? revealPairs : pairs;

  const choosePicture = (pictureId: string) => {
    if (locked || activeWord === null) return;
    const next: Record<string, string> = {};
    for (const [word, picture] of Object.entries(pairs)) {
      if (picture !== pictureId && word !== activeWord) next[word] = picture;
    }
    if (pairs[activeWord] !== pictureId) next[activeWord] = pictureId;
    onChange({ kind: "match", pairs: next });
    setActiveWord(null);
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-center font-semibold text-ink-soft">{t.pickWord}</p>
      <div className="grid grid-cols-2 gap-3 sm:gap-6">
        <div role="group" aria-label={t.words} className="flex flex-col gap-3">
          {words.map((word, index) => (
            <ChoiceTile
              key={word.id}
              kind="compact"
              selected={activeWord === word.id}
              mark={marks[word.id]}
              disabled={locked}
              onSelect={() => setActiveWord(activeWord === word.id ? null : word.id)}
              className="justify-start pl-11"
            >
              <PairBadge n={index + 1} />
              <span>{word.text}</span>
              {shownPairs[word.id] ? (
                <span className="sr-only">{`, ${t.pair.replace("{n}", String(index + 1))}`}</span>
              ) : null}
            </ChoiceTile>
          ))}
        </div>
        <div role="group" aria-label={t.pictures} className="flex flex-col gap-3">
          {view.content.pictures.map((option, index) => {
            const pairedWord = Object.entries(shownPairs).find(([, picture]) => picture === option.id)?.[0];
            const name = reveal?.pictureNames?.[option.picture.pictureId];
            return (
              <ChoiceTile
                key={option.id}
                kind="picture"
                label={`${name ? vi.practice.picture.named.replace("{name}", name) : neutralPictureLabel(index)}${
                  pairedWord ? `, ${t.pair.replace("{n}", String(numberOf(pairedWord)))}` : ""
                }`}
                selected={pairedWord !== undefined}
                disabled={locked || activeWord === null}
                onSelect={() => choosePicture(option.id)}
                className="min-h-24 flex-col"
              >
                {pairedWord ? <PairBadge n={numberOf(pairedWord)} /> : null}
                <PictureIcon iconKey={option.picture.iconKey} className="size-14" />
                {name ? <span className="font-reading text-lg font-bold">{name}</span> : null}
              </ChoiceTile>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** Dạng 5 — Đọc từ – chọn/nối hình. Không có âm thanh đọc từ hay tên tranh trước khi chấm. */
export function WordPicturePlayer(props: PlayerProps<WordPictureItem>) {
  const { view, response, onChange, locked, marks, hint, reveal } = props;
  if (view.variant === "match_pairs") return <MatchPairs {...props} view={view} />;
  return (
    <div className="flex flex-col items-center gap-6">
      <div className="rounded-card border-2 border-ink bg-surface px-8 py-3 text-center">
        <ReadingText text={view.content.word} size="xl" split={hint?.splitSyllables ?? false} />
      </div>
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
