import { unitsOfAnalysis } from "../../core/checks.ts";
import { containsForm } from "../../core/leaks.ts";
import type { VariantId } from "../../core/module.ts";
import type { PictureOption } from "../../core/primitives.ts";
import {
  clampDifficulty,
  itemId,
  objectiveOf,
  plannedAudio,
  shuffleOptions,
  type Candidate,
  type CandidateBuilder,
} from "../../generation/candidate.ts";
import type { GenerationContext, PictureEntry } from "../../generation/context.ts";
import type { Rng } from "../../generation/rng.ts";
import type { WordPictureItem } from "./schema.ts";

/** Hai tên tranh có lẫn nhau không (ví dụ "cá" và "cá vàng") — tránh đặt cạnh nhau. */
function overlaps(a: string, b: string): boolean {
  return containsForm(a, b) || containsForm(b, a);
}

/** Tranh nhiễu: ưu tiên tranh có tên cùng âm đầu hoặc cùng vần (buộc trẻ đọc kỹ), rồi các tranh khác. */
function distractorPictures(ctx: GenerationContext, rng: Rng, target: PictureEntry, count: number): PictureEntry[] {
  const [first] = target.word.analyses;
  const pool = rng.shuffle(
    ctx.pictures.filter(
      (other) => other.asset.id !== target.asset.id && !overlaps(other.asset.word, target.asset.word),
    ),
  );
  const similar = (other: PictureEntry) => {
    const [otherFirst] = other.word.analyses;
    return (
      otherFirst !== undefined &&
      first !== undefined &&
      (otherFirst.onset === first.onset || otherFirst.rime === first.rime)
    );
  };
  const ordered = [...pool.filter(similar), ...pool.filter((other) => !similar(other))];
  const chosen: PictureEntry[] = [];
  for (const candidate of ordered) {
    if (chosen.length >= count) break;
    if (chosen.some((picked) => overlaps(picked.asset.word, candidate.asset.word))) continue;
    chosen.push(candidate);
  }
  return chosen;
}

const pictureRef = (entry: PictureEntry) => ({ pictureId: entry.asset.id, iconKey: entry.asset.iconKey });

export const wordPictureCandidates: CandidateBuilder = (ctx, variant: VariantId) => {
  const seed = ctx.request.seed;
  const readable = ctx.pictures.filter(
    (entry) => entry.word.readable && entry.word.analyses.length <= ctx.limits.maxWordSyllables,
  );
  if (variant === "choose_picture") {
    return readable.map((target): Candidate => ({
      key: `picture:${target.asset.id}`,
      focusUnits: [],
      difficulty: target.word.difficulty,
      build: (rng): WordPictureItem | null => {
        const size = Math.min(ctx.limits.maxChoices, 3);
        const distractors = distractorPictures(ctx, rng, target, size - 1);
        if (distractors.length < size - 1) return null;
        const built = shuffleOptions<Omit<PictureOption, "id"> & { name: string }>(
          rng,
          { picture: pictureRef(target), name: target.asset.word },
          distractors.map((entry) => ({
            value: { picture: pictureRef(entry), name: entry.asset.word },
            tag: "distractor:picture",
          })),
        );
        const pictureNames = Object.fromEntries(built.options.map((option) => [option.id, option.name]));
        return {
          id: itemId(variant, `picture:${target.asset.id}`, seed),
          schemaVersion: 1,
          type: "word_picture",
          variant: "choose_picture",
          objective: objectiveOf(variant, []),
          difficulty: target.word.difficulty,
          requiredUnits: Array.from(new Set(target.word.analyses.flatMap(unitsOfAnalysis))),
          source: {
            corpusIds: [target.word.item.id],
            pictureIds: built.options.map((option) => option.picture.pictureId),
            fixtureIds: [],
          },
          audio: plannedAudio(ctx.request.media, variant, { model: target.word.item.text }),
          content: {
            word: target.word.item.text,
            options: built.options.map((option) => ({ id: option.id, picture: option.picture })),
          },
          answer: { optionId: built.answerId, pictureNames, distractorTags: built.distractorTags },
        };
      },
    }));
  }

  // match_pairs: mỗi tranh đọc được làm "neo", ghép thêm hai tranh khác (chọn bằng rng của neo) → tập hữu hạn.
  return readable.map((anchor): Candidate => ({
    key: `pairs:${anchor.asset.id}`,
    focusUnits: [],
    difficulty: anchor.word.difficulty,
    build: (rng): WordPictureItem | null => {
      const size = Math.min(ctx.limits.maxChoices, 3);
      const others: PictureEntry[] = [];
      for (const candidate of rng.shuffle(readable)) {
        if (others.length >= size - 1) break;
        if (candidate.asset.id === anchor.asset.id) continue;
        if ([anchor, ...others].some((picked) => overlaps(picked.asset.word, candidate.asset.word))) continue;
        others.push(candidate);
      }
      if (others.length < size - 1) return null;
      const entries = [anchor, ...others];
      const words = entries.map((entry, index) => ({ id: `w${index + 1}`, text: entry.word.item.text, entry }));
      const pictures = rng.shuffle(entries).map((entry, index) => ({ id: `p${index + 1}`, entry }));
      const pairs: Record<string, string> = {};
      for (const word of words) {
        const picture = pictures.find((candidate) => candidate.entry === word.entry);
        if (picture) pairs[word.id] = picture.id;
      }
      return {
        id: itemId(variant, `pairs:${anchor.asset.id}`, seed),
        schemaVersion: 1,
        type: "word_picture",
        variant: "match_pairs",
        objective: objectiveOf(variant, []),
        difficulty: clampDifficulty(Math.max(...entries.map((entry) => entry.word.difficulty))),
        requiredUnits: Array.from(new Set(entries.flatMap((entry) => entry.word.analyses.flatMap(unitsOfAnalysis)))),
        source: {
          corpusIds: entries.map((entry) => entry.word.item.id),
          pictureIds: entries.map((entry) => entry.asset.id),
          fixtureIds: [],
        },
        audio: plannedAudio(ctx.request.media, variant, { model: words.map((word) => word.text).join(", ") }),
        content: {
          words: words.map((word) => ({ id: word.id, text: word.text })),
          pictures: pictures.map((picture) => ({ id: picture.id, picture: pictureRef(picture.entry) })),
        },
        answer: {
          pairs,
          pictureNames: Object.fromEntries(pictures.map((picture) => [picture.id, picture.entry.asset.word])),
        },
      };
    },
  }));
};
