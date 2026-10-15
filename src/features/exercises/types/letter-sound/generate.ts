import { teachingLabelOf, uniqueUnits } from "../../core/checks.ts";
import type { TextOption } from "../../core/primitives.ts";
import type { VariantId } from "../../core/module.ts";
import {
  itemId,
  objectiveOf,
  plannedAudio,
  shuffleOptions,
  type Candidate,
  type CandidateBuilder,
} from "../../generation/candidate.ts";
import { rankedAlternatives, type Alternative, type GenerationContext } from "../../generation/context.ts";
import type { Rng } from "../../generation/rng.ts";
import type { LetterSoundItem } from "./schema.ts";

/**
 * Nhóm chữ dễ nhầm vì HÌNH DẠNG (ngoài các cặp trong content/kb/confusions.json): dấu phụ của
 * nguyên âm (o/ô/ơ, a/ă/â, e/ê, u/ư) và d/đ. Đây là heuristic của bộ sinh, chờ GV góp ý
 * (docs/EXERCISE_ENGINE.md §10).
 */
const SHAPE_GROUPS: readonly (readonly string[])[] = [
  ["b", "d", "p", "q"],
  ["m", "n", "u"],
  ["o", "ô", "ơ"],
  ["a", "ă", "â"],
  ["e", "ê"],
  ["u", "ư"],
  ["d", "đ"],
  ["h", "k"],
  ["l", "t"],
];

function shapeAlternatives(letter: string): Alternative[] {
  return SHAPE_GROUPS.filter((group) => group.includes(letter)).flatMap((group) =>
    group
      .filter((other) => other !== letter)
      .map((other) => ({ text: other, tag: `shape:${[letter, other].sort().join("-")}` })),
  );
}

/** Chữ cái gốc để so "giống nhau": đ được coi như d. */
const baseLetter = (grapheme: string) => (grapheme[0] === "đ" ? "d" : (grapheme[0] ?? ""));

/** Âm đầu "giống" về chữ viết: cùng chữ đầu (đ ~ d), hoặc chứa nhau (n ↔ nh, ng; t ↔ th, tr). */
export function onsetLookalikes(onset: string, pool: readonly string[]): Alternative[] {
  return pool
    .filter(
      (other) =>
        other !== onset && (baseLetter(other) === baseLetter(onset) || other.includes(onset) || onset.includes(other)),
    )
    .map((other) => ({ text: other, tag: "distractor:lookalike" }));
}

function letterOptions(
  ctx: GenerationContext,
  rng: Rng,
  answer: string,
  pool: readonly string[],
  similar: readonly Alternative[],
): { options: TextOption[]; answerId: string; distractorTags: Record<string, string> } | null {
  const size = Math.min(ctx.limits.maxChoices, 3);
  const alternatives = rankedAlternatives({ kb: ctx.kb, kind: "grapheme", answer, pool, rng, similar }).slice(
    0,
    size - 1,
  );
  if (alternatives.length < size - 1) return null;
  return shuffleOptions<Omit<TextOption, "id">>(
    rng,
    { text: answer, unit: `phoneme:${answer}` },
    alternatives.map((alternative) => ({
      value: { text: alternative.text, unit: `phoneme:${alternative.text}` },
      tag: alternative.tag,
    })),
  );
}

export const letterSoundCandidates: CandidateBuilder = (ctx, variant: VariantId) => {
  const seed = ctx.request.seed;
  if (variant === "picture_onset") {
    return ctx.pictures.flatMap((entry): Candidate[] => {
      const [analysis] = entry.word.analyses;
      if (entry.word.analyses.length !== 1 || !analysis || analysis.onset === null) return [];
      const onset = analysis.onset;
      if (!ctx.isTaught(`phoneme:${onset}`)) return [];
      const key = `picture:${entry.asset.id}`;
      return [
        {
          key,
          focusUnits: [`phoneme:${onset}`],
          difficulty: onset.length > 1 ? 2 : 1,
          build: (rng): LetterSoundItem | null => {
            const built = letterOptions(ctx, rng, onset, ctx.taughtOnsets, onsetLookalikes(onset, ctx.taughtOnsets));
            if (!built) return null;
            return {
              id: itemId(variant, key, seed),
              schemaVersion: 1,
              type: "letter_sound",
              variant: "picture_onset",
              objective: objectiveOf(variant, [`phoneme:${onset}`]),
              difficulty: onset.length > 1 ? 2 : 1,
              requiredUnits: uniqueUnits(built.options.flatMap((option) => (option.unit ? [option.unit] : []))),
              source: { corpusIds: [entry.word.item.id], pictureIds: [entry.asset.id], fixtureIds: [] },
              audio: plannedAudio(ctx.request.media, variant, { stimulus: entry.asset.word, model: entry.asset.word }),
              content: { picture: { pictureId: entry.asset.id, iconKey: entry.asset.iconKey }, options: built.options },
              answer: { optionId: built.answerId, pictureName: entry.asset.word, distractorTags: built.distractorTags },
            };
          },
        },
      ];
    });
  }

  const letters = variant === "visual_match" ? ctx.taughtSingleLetters : ctx.taughtOnsets;
  return letters.flatMap((letter): Candidate[] => {
    const similar = variant === "visual_match" ? shapeAlternatives(letter) : onsetLookalikes(letter, ctx.taughtOnsets);
    if (
      variant === "visual_match" &&
      similar.every((alternative) => !ctx.taughtSingleLetters.includes(alternative.text))
    ) {
      return [];
    }
    const key = `letter:${letter}`;
    const label = teachingLabelOf(ctx.kb, letter) ?? letter;
    // Bài nhìn: trọng tâm là CẢ NHÓM chữ dễ nhầm hình dạng (b/d/p…) — bài ở lớp cùng nhóm, khác chữ mẫu.
    const focus =
      variant === "visual_match"
        ? (SHAPE_GROUPS.find((group) => group.includes(letter)) ?? [letter])
            .filter((member) => ctx.taughtSingleLetters.includes(member))
            .sort()
            .map((member) => `phoneme:${member}`)
        : [`phoneme:${letter}`];
    return [
      {
        key,
        focusUnits: focus,
        difficulty: letter.length > 1 ? 2 : 1,
        build: (rng): LetterSoundItem | null => {
          const pool = variant === "visual_match" ? ctx.taughtSingleLetters : ctx.taughtOnsets;
          const built = letterOptions(ctx, rng, letter, pool, similar);
          if (!built) return null;
          const common = {
            id: itemId(variant, key, seed),
            schemaVersion: 1 as const,
            type: "letter_sound" as const,
            objective: objectiveOf(variant, focus),
            difficulty: letter.length > 1 ? 2 : 1,
            requiredUnits: uniqueUnits(built.options.flatMap((option) => (option.unit ? [option.unit] : []))),
            source: { corpusIds: [], pictureIds: [], fixtureIds: [] },
          };
          if (variant === "visual_match") {
            return {
              ...common,
              variant: "visual_match",
              audio: plannedAudio(ctx.request.media, variant, { model: label }),
              content: { sample: letter, options: built.options },
              answer: { optionId: built.answerId, distractorTags: built.distractorTags },
            };
          }
          return {
            ...common,
            variant: "listen_letter",
            audio: plannedAudio(ctx.request.media, variant, { stimulus: label, model: label }),
            content: { options: built.options },
            answer: { optionId: built.answerId, distractorTags: built.distractorTags },
          };
        },
      },
    ];
  });
};
