import { toLowerVi } from "../../../../lib/vietnamese/normalize.ts";
import { tokenize } from "../../../../lib/vietnamese/tokenize.ts";
import { unitsOfAnalysis } from "../../core/checks.ts";
import { containsForm } from "../../core/leaks.ts";
import type { VariantId } from "../../core/module.ts";
import type { PictureOption, TextOption } from "../../core/primitives.ts";
import {
  itemId,
  objectiveOf,
  plannedAudio,
  shuffleOptions,
  type Candidate,
  type CandidateBuilder,
} from "../../generation/candidate.ts";
import type { GenerationContext, PictureEntry, SentenceEntry } from "../../generation/context.ts";
import type { SentenceReadingItem } from "./schema.ts";

/**
 * Tách câu thành thẻ từ: gộp các tiếng thành từ nhiều tiếng nếu có trong ngân hàng từ (khớp dài nhất,
 * tối đa 3 tiếng), giữ nguyên chữ hoa; dấu câu cuối là một thẻ riêng.
 */
export function sentenceTokens(ctx: GenerationContext, sentence: string): string[] {
  const bank = new Set(ctx.kb.words.map((word) => toLowerVi(word.text)));
  const parts = tokenize(sentence).filter((token) => token.kind === "syllable" || token.kind === "punctuation");
  const tokens: string[] = [];
  let index = 0;
  while (index < parts.length) {
    const part = parts[index];
    if (!part) break;
    if (part.kind === "punctuation") {
      tokens.push(part.text);
      index += 1;
      continue;
    }
    let size = 1;
    for (let candidate = 3; candidate >= 2; candidate -= 1) {
      const slice = parts.slice(index, index + candidate);
      if (slice.length === candidate && slice.every((token) => token.kind === "syllable")) {
        if (bank.has(toLowerVi(slice.map((token) => token.text).join(" ")))) {
          size = candidate;
          break;
        }
      }
    }
    tokens.push(
      parts
        .slice(index, index + size)
        .map((token) => token.text)
        .join(" "),
    );
    index += size;
  }
  return tokens;
}

function fitsBand(ctx: GenerationContext, entry: SentenceEntry): boolean {
  return entry.analyses.length <= ctx.limits.maxSentenceSyllables;
}

/**
 * Tranh của một TỪ NGUYÊN VẸN trong câu (theo cách tách thẻ từ ở trên): "lá" không khớp với "lá cờ".
 * Câu có hơn một từ có tranh thì bỏ qua — tránh đáp án mơ hồ.
 */
function keywordPicture(ctx: GenerationContext, sentence: string): PictureEntry | null {
  const tokens = new Set(sentenceTokens(ctx, sentence).map(toLowerVi));
  const matches = ctx.pictures.filter((entry) => tokens.has(toLowerVi(entry.asset.word)));
  return matches.length === 1 ? (matches[0] ?? null) : null;
}

const pictureRef = (entry: PictureEntry) => ({ pictureId: entry.asset.id, iconKey: entry.asset.iconKey });

export const sentenceReadingCandidates: CandidateBuilder = (ctx, variant: VariantId) => {
  const seed = ctx.request.seed;
  const sentences = ctx.sentences.filter((entry) => fitsBand(ctx, entry));

  if (variant === "comprehension_question") {
    return (ctx.request.comprehension ?? []).flatMap((spec): Candidate[] => {
      const entry = sentences.find((candidate) => candidate.item.id === spec.sentenceId);
      if (!entry) return [];
      const key = `question:${spec.id}`;
      return [
        {
          key,
          focusUnits: [],
          difficulty: entry.difficulty,
          build: (rng): SentenceReadingItem | null => {
            const size = Math.min(ctx.limits.maxChoices, 3);
            const distractors = spec.distractors.slice(0, size - 1);
            if (distractors.length < 1) return null;
            const built = shuffleOptions<Omit<TextOption, "id">>(
              rng,
              { text: spec.answer },
              distractors.map((text) => ({ value: { text }, tag: "distractor:not_in_text" })),
            );
            return {
              id: itemId(variant, key, seed),
              schemaVersion: 1,
              type: "sentence_reading",
              variant: "comprehension_question",
              objective: objectiveOf(variant, []),
              difficulty: entry.difficulty,
              requiredUnits: Array.from(new Set(entry.analyses.flatMap(unitsOfAnalysis))),
              source: { corpusIds: [entry.item.id], pictureIds: [], fixtureIds: [spec.id] },
              audio: plannedAudio(ctx.request.media, variant, { model: entry.item.text }),
              content: { sentence: entry.item.text, question: spec.question, options: built.options },
              answer: { optionId: built.answerId, distractorTags: built.distractorTags },
            };
          },
        },
      ];
    });
  }

  if (variant === "sentence_picture") {
    return sentences.flatMap((entry): Candidate[] => {
      const keyword = keywordPicture(ctx, entry.item.text);
      if (!keyword) return [];
      const key = `sentence:${entry.item.id}`;
      return [
        {
          key,
          focusUnits: [],
          difficulty: entry.difficulty,
          build: (rng): SentenceReadingItem | null => {
            const size = Math.min(ctx.limits.maxChoices, 3);
            const others = rng
              .shuffle(ctx.pictures.filter((picture) => picture.asset.id !== keyword.asset.id))
              .filter((picture) => !containsForm(entry.item.text, picture.asset.word))
              .filter((picture) => !containsForm(picture.asset.word, keyword.asset.word))
              .slice(0, size - 1);
            if (others.length < size - 1) return null;
            const built = shuffleOptions<Omit<PictureOption, "id"> & { name: string }>(
              rng,
              { picture: pictureRef(keyword), name: keyword.asset.word },
              others.map((picture) => ({
                value: { picture: pictureRef(picture), name: picture.asset.word },
                tag: "distractor:not_in_text",
              })),
            );
            return {
              id: itemId(variant, key, seed),
              schemaVersion: 1,
              type: "sentence_reading",
              variant: "sentence_picture",
              objective: objectiveOf(variant, []),
              difficulty: entry.difficulty,
              requiredUnits: Array.from(new Set(entry.analyses.flatMap(unitsOfAnalysis))),
              source: {
                corpusIds: [entry.item.id],
                pictureIds: built.options.map((option) => option.picture.pictureId),
                fixtureIds: [],
              },
              audio: plannedAudio(ctx.request.media, variant, { model: entry.item.text }),
              content: {
                sentence: entry.item.text,
                options: built.options.map((option) => ({ id: option.id, picture: option.picture })),
              },
              answer: {
                optionId: built.answerId,
                keyword: keyword.asset.word,
                pictureNames: Object.fromEntries(built.options.map((option) => [option.id, option.name])),
                distractorTags: built.distractorTags,
              },
            };
          },
        },
      ];
    });
  }

  // arrange_words
  return sentences.flatMap((entry): Candidate[] => {
    const tokens = sentenceTokens(ctx, entry.item.text);
    const words = tokens.filter((token) => !/^[.,!?…]$/u.test(token));
    if (words.length < 3 || words.length > 6 || /[,;]/u.test(entry.item.text)) return [];
    if (new Set(words.map(toLowerVi)).size !== words.length) return [];
    const key = `sentence:${entry.item.id}`;
    return [
      {
        key,
        focusUnits: [],
        difficulty: entry.difficulty,
        build: (rng): SentenceReadingItem | null => {
          // Xáo tối đa 6 lần cho tới khi thứ tự khác câu gốc; vẫn trùng thì xoay vòng một vị trí.
          let shuffled = rng.shuffle(tokens);
          for (let attempt = 0; attempt < 6 && shuffled.join("\u0000") === tokens.join("\u0000"); attempt += 1) {
            shuffled = rng.shuffle(tokens);
          }
          if (shuffled.join("\u0000") === tokens.join("\u0000")) shuffled = [...tokens.slice(1), ...tokens.slice(0, 1)];
          return {
            id: itemId(variant, key, seed),
            schemaVersion: 1,
            type: "sentence_reading",
            variant: "arrange_words",
            objective: objectiveOf(variant, []),
            difficulty: entry.difficulty,
            requiredUnits: Array.from(new Set(entry.analyses.flatMap(unitsOfAnalysis))),
            source: { corpusIds: [entry.item.id], pictureIds: [], fixtureIds: [] },
            audio: plannedAudio(ctx.request.media, variant, { model: entry.item.text }),
            content: { tokens: shuffled.map((text, index) => ({ id: `k${index + 1}`, text })) },
            answer: { sentence: entry.item.text, orders: [tokens] },
          };
        },
      },
    ];
  });
};
