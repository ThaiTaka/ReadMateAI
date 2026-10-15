"use client";

import type { ReactNode } from "react";
import { ChoiceTile } from "@/components/kid/choice-tile";
import { PictureIcon } from "@/components/kid/picture-icon";
import { ToneGlyph } from "@/components/kid/tone-glyph";
import type { HintView, Mark, PictureOption, RevealView, TextOption } from "@/features/exercises/core/primitives";
import { neutralPictureLabel } from "@/features/exercises/types/word-picture/runtime";
import { cn } from "@/lib/cn";
import { vi } from "@/strings/vi";

/** Lưới phương án chữ (chữ cái, vần, tiếng, từ, dấu thanh) — chọn một hoặc chọn nhiều. */
export function TextOptionGrid({
  options,
  selected,
  onToggle,
  locked,
  marks,
  hint,
  reveal,
  kind = "text",
  groupLabel,
}: {
  options: readonly TextOption[];
  selected: readonly string[];
  onToggle: (id: string) => void;
  locked: boolean;
  marks: Record<string, Mark>;
  hint: HintView | null;
  reveal: RevealView | null;
  kind?: "text" | "compact";
  groupLabel: string;
}) {
  return (
    <div role="group" aria-label={groupLabel} className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {options.map((option) => (
        <ChoiceTile
          key={option.id}
          kind={option.tone ? "compact" : kind}
          selected={selected.includes(option.id)}
          mark={marks[option.id]}
          isAnswer={reveal?.correctIds.includes(option.id) ?? false}
          eliminated={hint?.eliminate?.includes(option.id) ?? false}
          disabled={locked}
          onSelect={() => onToggle(option.id)}
          className={cn(option.tone && "flex-col gap-1")}
        >
          {option.tone ? (
            <>
              <ToneGlyph tone={option.tone} className="size-10" />
              <span className="font-sans text-lg font-bold">{option.text}</span>
            </>
          ) : (
            <span>{option.text}</span>
          )}
        </ChoiceTile>
      ))}
    </div>
  );
}

/** Tranh minh họa lớn của câu (không có chú thích chữ trước khi chấm). */
export function StimulusPicture({
  iconKey,
  name,
  enlarge,
}: {
  iconKey: string;
  /** Tên tranh — chỉ truyền sau khi câu đã chấm xong. */
  name?: string | undefined;
  enlarge?: boolean;
}) {
  return (
    <figure className="flex flex-col items-center gap-2">
      <div
        role="img"
        aria-label={name ? vi.practice.picture.named.replace("{name}", name) : vi.practice.picture.stimulus}
        className={cn(
          "flex items-center justify-center rounded-card border-2 border-line bg-surface text-ink shadow-soft transition-all",
          enlarge ? "size-48 sm:size-56" : "size-36 sm:size-44",
        )}
      >
        <PictureIcon iconKey={iconKey} className={enlarge ? "size-36 sm:size-44" : "size-24 sm:size-32"} />
      </div>
      {name ? <figcaption className="font-reading text-read font-bold text-ink">{name}</figcaption> : null}
    </figure>
  );
}

/** Lưới tranh để chọn — nhãn cho trình đọc màn hình là "Hình 1, 2, 3", không phải tên tranh. */
export function PictureOptionGrid({
  options,
  selected,
  onSelect,
  locked,
  marks,
  hint,
  reveal,
  groupLabel,
  extra,
}: {
  options: readonly PictureOption[];
  selected: string | null;
  onSelect: (id: string) => void;
  locked: boolean;
  marks: Record<string, Mark>;
  hint: HintView | null;
  reveal: RevealView | null;
  groupLabel: string;
  extra?: (option: PictureOption) => ReactNode;
}) {
  return (
    <div role="group" aria-label={groupLabel} className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {options.map((option, index) => {
        const name = reveal?.pictureNames?.[option.picture.pictureId];
        return (
          <ChoiceTile
            key={option.id}
            kind="picture"
            label={name ? vi.practice.picture.named.replace("{name}", name) : neutralPictureLabel(index)}
            selected={selected === option.id}
            mark={marks[option.id]}
            isAnswer={reveal?.correctIds.includes(option.id) ?? false}
            eliminated={hint?.eliminate?.includes(option.id) ?? false}
            disabled={locked}
            onSelect={() => onSelect(option.id)}
            className="flex-col"
          >
            <PictureIcon iconKey={option.picture.iconKey} className="size-20 sm:size-24" />
            {name ? <span className="font-reading text-xl font-bold">{name}</span> : null}
            {extra?.(option)}
          </ChoiceTile>
        );
      })}
    </div>
  );
}
