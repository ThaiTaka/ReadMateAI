import { estimateDifficulty } from "../../../../lib/vietnamese/difficulty.ts";
import type { SyllableAnalysis } from "../../../../lib/vietnamese/syllable.ts";
import type { ToneId } from "../../../../lib/vietnamese/tone.ts";
import { toneMarkIndex, toneNames, unitsOfAnalysis } from "../../core/checks.ts";
import type { VariantId } from "../../core/module.ts";
import { rimeUnitId, toneUnitId, type TextOption } from "../../core/primitives.ts";
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
import { onsetLookalikes } from "../letter-sound/generate.ts";
import type { BuildSyllableItem, Tile, ToneTile } from "./schema.ts";

/** Vần "giống" về chữ viết: cùng âm chính hoặc cùng âm cuối (an ↔ am, at; an ↔ ăn). */
export function rimeLookalikes(rime: string, pool: readonly string[], ctx: GenerationContext): Alternative[] {
  const spec = ctx.kb.inventory.rimes.get(rime);
  if (!spec) return [];
  return pool
    .filter((other) => other !== rime)
    .filter((other) => {
      const otherSpec = ctx.kb.inventory.rimes.get(other);
      return (
        otherSpec !== undefined &&
        (otherSpec.nucleus === spec.nucleus || (spec.coda !== null && otherSpec.coda === spec.coda))
      );
    })
    .map((other) => ({ text: other, tag: "distractor:similar_rime" }));
}

/** Thanh "giống": hỏi ↔ ngã (trong kho tri thức), sắc ↔ huyền ↔ nặng. */
export function toneAlternatives(ctx: GenerationContext, rng: Rng, answer: ToneId, size: number): Alternative[] {
  const similar: Alternative[] = (["sac", "huyen", "nang", "ngang"] as const)
    .filter((tone) => tone !== answer)
    .map((tone) => ({ text: tone, tag: "distractor:tone" }));
  return rankedAlternatives({ kb: ctx.kb, kind: "tone", answer, pool: ctx.taughtTones, rng, similar }).slice(0, size);
}

function buildTiles(
  ctx: GenerationContext,
  rng: Rng,
  analysis: SyllableAnalysis,
): {
  tiles: { onsets: Tile[]; rimes: Tile[]; tones: ToneTile[] };
  answer: { onset: string; rime: string; tone: string };
  tags: Record<string, string>;
} | null {
  const size = Math.min(ctx.limits.maxChoices, 3);
  const onset = analysis.onset;
  if (onset === null) return null;
  const onsetAlternatives = rankedAlternatives({
    kb: ctx.kb,
    kind: "grapheme",
    answer: onset,
    pool: ctx.taughtOnsets,
    rng,
    similar: onsetLookalikes(onset, ctx.taughtOnsets),
  }).slice(0, size - 1);
  const rimeAlternatives = rankedAlternatives({
    kb: ctx.kb,
    kind: "rime",
    answer: analysis.rime,
    pool: ctx.taughtRimes,
    rng,
    similar: rimeLookalikes(analysis.rime, ctx.taughtRimes, ctx),
  }).slice(0, size - 1);
  const toneAlts = toneAlternatives(ctx, rng, analysis.tone, size - 1);
  if (onsetAlternatives.length < size - 1 || rimeAlternatives.length < 1 || toneAlts.length < size - 1) return null;

  const onsets = shuffleOptions<Omit<Tile, "id">>(
    rng,
    { text: onset, unit: `phoneme:${onset}` },
    onsetAlternatives.map((alt) => ({ value: { text: alt.text, unit: `phoneme:${alt.text}` }, tag: alt.tag })),
    "n",
  );
  const rimeTile = (rime: string): Omit<Tile, "id"> => {
    const markIndex = toneMarkIndex(rime, ctx.check);
    return { text: rime, unit: rimeUnitId(rime), ...(markIndex === undefined ? {} : { markIndex }) };
  };
  const rimes = shuffleOptions<Omit<Tile, "id">>(
    rng,
    rimeTile(analysis.rime),
    rimeAlternatives.map((alt) => ({ value: rimeTile(alt.text), tag: alt.tag })),
    "r",
  );
  const toneTile = (tone: ToneId): Omit<ToneTile, "id"> => ({
    tone,
    text: toneNames(ctx.kb, tone).name,
    unit: toneUnitId(tone),
  });
  const tones = shuffleOptions<Omit<ToneTile, "id">>(
    rng,
    toneTile(analysis.tone),
    toneAlts.map((alt) => ({ value: toneTile(alt.text as ToneId), tag: alt.tag })),
    "t",
  );
  return {
    tiles: { onsets: onsets.options, rimes: rimes.options, tones: tones.options },
    answer: { onset: onsets.answerId, rime: rimes.answerId, tone: tones.answerId },
    tags: { ...onsets.distractorTags, ...rimes.distractorTags, ...tones.distractorTags },
  };
}

function sharesParts(a: SyllableAnalysis, b: SyllableAnalysis): number {
  return Number(a.onset === b.onset) + Number(a.rime === b.rime) + Number(a.tone === b.tone);
}

export const buildSyllableCandidates: CandidateBuilder = (ctx, variant: VariantId) => {
  const seed = ctx.request.seed;
  const excludedOnsets = new Set(["qu", "gi"]);
  if (variant === "picture_build") {
    return ctx.pictures.flatMap((entry): Candidate[] => {
      const [analysis] = entry.word.analyses;
      if (entry.word.analyses.length !== 1 || !analysis || !entry.word.readable) return [];
      if (analysis.onset === null || excludedOnsets.has(analysis.onset)) return [];
      const key = `picture:${entry.asset.id}`;
      // Trọng tâm: vần của tiếng (bài sinh đôi ở lớp ghép tiếng khác có cùng vần).
      const focus = [rimeUnitId(analysis.rime)];
      const difficulty = estimateDifficulty([analysis], "syllable").level;
      return [
        {
          key,
          focusUnits: focus,
          difficulty,
          build: (rng): BuildSyllableItem | null => {
            const built = buildTiles(ctx, rng, analysis);
            if (!built) return null;
            const { onsets, rimes, tones } = built.tiles;
            return {
              id: itemId(variant, key, seed),
              schemaVersion: 1,
              type: "build_syllable",
              variant: "picture_build",
              objective: objectiveOf(variant, focus),
              difficulty,
              requiredUnits: Array.from(new Set([...onsets, ...rimes, ...tones].map((tile) => tile.unit))),
              source: { corpusIds: [entry.word.item.id], pictureIds: [entry.asset.id], fixtureIds: [] },
              audio: plannedAudio(ctx.request.media, variant, { stimulus: entry.asset.word, model: entry.asset.word }),
              content: { picture: { pictureId: entry.asset.id, iconKey: entry.asset.iconKey }, tiles: built.tiles },
              answer: {
                ...built.answer,
                result: entry.asset.word,
                pictureName: entry.asset.word,
                distractorTags: built.tags,
              },
            };
          },
        },
      ];
    });
  }

  // parts_to_syllable: phương án nhiễu CHỈ lấy từ các tiếng có thật trong ngữ liệu (không tự tạo tiếng vô nghĩa).
  return ctx.syllables.flatMap((target): Candidate[] => {
    const analysis = target.analysis;
    if (analysis.onset === null || excludedOnsets.has(analysis.onset)) return [];
    const key = `syllable:${target.text}`;
    const units = unitsOfAnalysis(analysis);
    const focus = [rimeUnitId(analysis.rime)];
    return [
      {
        key,
        focusUnits: focus,
        difficulty: target.difficulty,
        build: (rng): BuildSyllableItem | null => {
          const size = Math.min(ctx.limits.maxChoices, 3);
          const pool = rng
            .shuffle(
              ctx.syllables.filter(
                (other) => other.text !== target.text && sharesParts(other.analysis, analysis) === 2,
              ),
            )
            // Ưu tiên khác thanh (luyện dấu), rồi khác âm đầu, rồi khác vần.
            .sort((a, b) => {
              const rank = (other: typeof a) =>
                other.analysis.tone !== analysis.tone ? 0 : other.analysis.onset !== analysis.onset ? 1 : 2;
              return rank(a) - rank(b);
            })
            .slice(0, size - 1);
          if (pool.length < size - 1) return null;
          const built = shuffleOptions<Omit<TextOption, "id">>(
            rng,
            { text: target.text },
            pool.map((other) => ({
              value: { text: other.text },
              tag:
                other.analysis.tone !== analysis.tone
                  ? "distractor:tone"
                  : other.analysis.onset !== analysis.onset
                    ? "distractor:onset"
                    : "distractor:rime",
            })),
          );
          return {
            id: itemId(variant, key, seed),
            schemaVersion: 1,
            type: "build_syllable",
            variant: "parts_to_syllable",
            objective: objectiveOf(variant, focus),
            difficulty: target.difficulty,
            requiredUnits: Array.from(new Set([...units, ...pool.flatMap((other) => unitsOfAnalysis(other.analysis))])),
            source: {
              corpusIds: Array.from(new Set([target.sourceId, ...pool.map((other) => other.sourceId)])),
              pictureIds: [],
              fixtureIds: [],
            },
            audio: plannedAudio(ctx.request.media, variant, { model: target.text }),
            content: {
              parts: {
                onset: analysis.onset,
                rime: analysis.rime,
                tone: analysis.tone,
                toneLabel: toneNames(ctx.kb, analysis.tone).name,
              },
              options: built.options,
            },
            answer: { optionId: built.answerId, distractorTags: built.distractorTags },
          };
        },
      },
    ];
  });
};
