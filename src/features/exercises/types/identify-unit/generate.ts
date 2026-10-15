import type { ToneId } from "../../../../lib/vietnamese/tone.ts";
import { toneNames, unitsOfAnalysis } from "../../core/checks.ts";
import type { VariantId } from "../../core/module.ts";
import { rimeUnitId, toneUnitId, type TextOption } from "../../core/primitives.ts";
import {
  clampDifficulty,
  itemId,
  objectiveOf,
  plannedAudio,
  shuffleOptions,
  type Candidate,
  type CandidateBuilder,
} from "../../generation/candidate.ts";
import { confusionPartners, rankedAlternatives, type SyllableEntry } from "../../generation/context.ts";
import { rimeLookalikes, toneAlternatives } from "../build-syllable/generate.ts";
import { onsetLookalikes } from "../letter-sound/generate.ts";
import type { IdentifyUnitItem } from "./schema.ts";

export const identifyUnitCandidates: CandidateBuilder = (ctx, variant: VariantId) => {
  const seed = ctx.request.seed;
  /**
   * Nhóm vần trọng tâm của bài "chọn các tiếng có vần…": vần + bạn dễ nhầm trong kho tri thức (an/ang…);
   * không có cặp dễ nhầm thì là các vần đã học cùng âm chính. Bài ở lớp cùng nhóm, khác vần cần tìm.
   */
  const rimeFamily = (rime: string): string[] => {
    const partners = confusionPartners(ctx.kb, "rime", rime).map((partner) => partner.text);
    const nucleus = ctx.kb.inventory.rimes.get(rime)?.nucleus;
    const members =
      partners.length > 0
        ? [rime, ...partners]
        : ctx.taughtRimes.filter(
            (other) => Array.from(other).length > 1 && ctx.kb.inventory.rimes.get(other)?.nucleus === nucleus,
          );
    return Array.from(new Set(members))
      .sort()
      .map((member) => `rime:${member}`);
  };
  const size = Math.min(ctx.limits.maxChoices, variant === "find_with_unit" ? 4 : 3);

  if (variant === "find_with_unit") {
    return ctx.taughtRimes
      .filter((rime) => Array.from(rime).length > 1)
      .flatMap((rime): Candidate[] => {
        // Tiếng không có âm đầu trùng chữ với vần ("ăn" khi tìm vần ăn) chỉ là so chữ — không dùng làm đáp án.
        const withRime = ctx.syllables.filter((entry) => entry.analysis.rime === rime && entry.text !== rime);
        if (withRime.length === 0) return [];
        const key = `rime:${rime}`;
        const family = rimeFamily(rime);
        return [
          {
            key,
            focusUnits: family,
            difficulty: clampDifficulty(withRime.reduce((sum, entry) => sum + entry.difficulty, 0) / withRime.length),
            build: (rng): IdentifyUnitItem | null => {
              const partners = new Set([
                ...confusionPartners(ctx.kb, "rime", rime).map((partner) => partner.text),
                ...rimeLookalikes(rime, ctx.taughtRimes, ctx).map((alt) => alt.text),
              ]);
              const correctCount = Math.min(withRime.length, size >= 4 ? 2 : 1);
              const correct = rng.shuffle(withRime).slice(0, correctCount);
              const others = rng
                .shuffle(ctx.syllables.filter((entry) => entry.analysis.rime !== rime))
                .sort((a, b) => Number(!partners.has(a.analysis.rime)) - Number(!partners.has(b.analysis.rime)))
                .slice(0, size - correctCount);
              if (others.length < size - correctCount || correct.length === 0) return null;
              const entries: Array<{ entry: SyllableEntry; correct: boolean }> = rng.shuffle([
                ...correct.map((entry) => ({ entry, correct: true })),
                ...others.map((entry) => ({ entry, correct: false })),
              ]);
              const options: TextOption[] = entries.map(({ entry }, index) => ({
                id: `o${index + 1}`,
                text: entry.text,
              }));
              const distractorTags: Record<string, string> = {};
              entries.forEach(({ entry, correct: ok }, index) => {
                if (!ok) {
                  const partner = confusionPartners(ctx.kb, "rime", rime).find((p) => p.text === entry.analysis.rime);
                  distractorTags[`o${index + 1}`] = partner?.tag ?? "distractor:other_rime";
                }
              });
              return {
                id: itemId(variant, key, seed),
                schemaVersion: 1,
                type: "identify_unit",
                variant: "find_with_unit",
                objective: objectiveOf(variant, family),
                difficulty: clampDifficulty(
                  entries.reduce((sum, { entry }) => sum + entry.difficulty, 0) / entries.length,
                ),
                requiredUnits: Array.from(new Set(entries.flatMap(({ entry }) => unitsOfAnalysis(entry.analysis)))),
                source: {
                  corpusIds: Array.from(new Set(entries.map(({ entry }) => entry.sourceId))),
                  pictureIds: [],
                  fixtureIds: [],
                },
                audio: plannedAudio(ctx.request.media, variant, {}),
                content: { unitText: rime, unit: `rime:${rime}`, options },
                answer: {
                  optionIds: entries.flatMap(({ correct: ok }, index) => (ok ? [`o${index + 1}`] : [])),
                  distractorTags,
                },
              };
            },
          },
        ];
      });
  }

  return ctx.syllables.flatMap((target): Candidate[] => {
    const { analysis } = target;
    if (variant === "which_onset" && analysis.onset === null) return [];
    if (variant === "which_rime" && Array.from(analysis.rime).length < 2) return [];
    const focus =
      variant === "which_onset"
        ? `phoneme:${analysis.onset ?? ""}`
        : variant === "which_rime"
          ? rimeUnitId(analysis.rime)
          : toneUnitId(analysis.tone);
    const key = `syllable:${target.text}`;
    return [
      {
        key,
        focusUnits: [focus],
        difficulty: target.difficulty,
        build: (rng): IdentifyUnitItem | null => {
          let built: { options: TextOption[]; answerId: string; distractorTags: Record<string, string> };
          if (variant === "which_tone") {
            const alternatives = toneAlternatives(ctx, rng, analysis.tone, size - 1);
            if (alternatives.length < size - 1) return null;
            const option = (tone: ToneId): Omit<TextOption, "id"> => ({
              text: toneNames(ctx.kb, tone).name,
              tone,
              unit: toneUnitId(tone),
            });
            built = shuffleOptions<Omit<TextOption, "id">>(
              rng,
              option(analysis.tone),
              alternatives.map((alt) => ({ value: option(alt.text as ToneId), tag: alt.tag })),
            );
          } else {
            const answer = variant === "which_onset" ? (analysis.onset ?? "") : analysis.rime;
            const pool =
              variant === "which_onset"
                ? ctx.taughtOnsets
                : ctx.taughtRimes.filter((rime) => Array.from(rime).length > 1);
            const alternatives = rankedAlternatives({
              kb: ctx.kb,
              kind: variant === "which_onset" ? "grapheme" : "rime",
              answer,
              pool,
              rng,
              similar: variant === "which_onset" ? onsetLookalikes(answer, pool) : rimeLookalikes(answer, pool, ctx),
            }).slice(0, size - 1);
            if (alternatives.length < size - 1) return null;
            const unit = (text: string) => (variant === "which_onset" ? `phoneme:${text}` : rimeUnitId(text));
            built = shuffleOptions<Omit<TextOption, "id">>(
              rng,
              { text: answer, unit: unit(answer) },
              alternatives.map((alt) => ({ value: { text: alt.text, unit: unit(alt.text) }, tag: alt.tag })),
            );
          }
          const common = {
            id: itemId(variant, key, seed),
            schemaVersion: 1 as const,
            type: "identify_unit" as const,
            objective: objectiveOf(variant, [focus]),
            difficulty: target.difficulty,
            requiredUnits: Array.from(
              new Set([
                ...unitsOfAnalysis(analysis),
                ...built.options.flatMap((option) => (option.unit ? [option.unit] : [])),
              ]),
            ),
            source: { corpusIds: [target.sourceId], pictureIds: [], fixtureIds: [] },
            audio: plannedAudio(ctx.request.media, variant, { stimulus: target.text, model: target.text }),
            content: { syllable: target.text, options: built.options },
            answer: { optionId: built.answerId, distractorTags: built.distractorTags },
          };
          if (variant === "which_onset") return { ...common, variant: "which_onset" };
          if (variant === "which_rime") return { ...common, variant: "which_rime" };
          return { ...common, variant: "which_tone" };
        },
      },
    ];
  });
};
