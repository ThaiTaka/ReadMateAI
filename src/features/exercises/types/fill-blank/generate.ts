import type { UnitId } from "../../../../lib/vietnamese/decodability.ts";
import { estimateDifficulty } from "../../../../lib/vietnamese/difficulty.ts";
import type { SyllableAnalysis } from "../../../../lib/vietnamese/syllable.ts";
import type { ToneId } from "../../../../lib/vietnamese/tone.ts";
import { syllableTokens } from "../../../../lib/vietnamese/tokenize.ts";
import {
  composeWithProfile,
  isWellFormed,
  tonedRimeWithProfile,
  toneMarkIndex,
  toneNames,
  unitsOfAnalysis,
} from "../../core/checks.ts";
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
import { rankedAlternatives, type GenerationContext, type PictureEntry } from "../../generation/context.ts";
import { rimeLookalikes, toneAlternatives } from "../build-syllable/generate.ts";
import type { FillBlankItem } from "./schema.ts";

/** Cặp âm đầu mà quy tắc chính tả quyết định cách viết (CLAUDE.md §7.5). */
export const SPELLING_PAIRS: ReadonlyArray<{ pair: readonly [string, string]; ruleId: string; tag: string }> = [
  { pair: ["c", "k"], ruleId: "spelling.c_k", tag: "confusion:c-k" },
  { pair: ["g", "gh"], ruleId: "spelling.g_gh", tag: "confusion:g-gh" },
  { pair: ["ng", "ngh"], ruleId: "spelling.ng_ngh", tag: "confusion:ng-ngh" },
];

/**
 * Tiếng không được dùng làm phương án ghép trong bài cho trẻ (xưng hô thiếu lịch sự). Danh sách tối thiểu
 * của bộ sinh; danh sách chặn đầy đủ do GV quản lý ở GĐ6 (PRD F-ND-02, CHILD_SAFETY).
 */
const AVOID_SYLLABLES = new Set(["tao", "mày"]);

/** Chọn tiếng trong từ có tranh để làm chỗ trống (tiếng có vần nhiều chữ cho bài điền vần). */
function blankTarget(
  entry: PictureEntry,
  wantMultiLetterRime: boolean,
): { index: number; analysis: SyllableAnalysis } | null {
  const analyses = entry.word.analyses;
  for (let index = analyses.length - 1; index >= 0; index -= 1) {
    const analysis = analyses[index];
    if (!analysis || analysis.onset === null || analysis.onset === "qu" || analysis.onset === "gi") continue;
    if (wantMultiLetterRime && Array.from(analysis.rime).length < 2) continue;
    return { index, analysis };
  }
  return null;
}

function templateAround(entry: PictureEntry, index: number) {
  const tokens = syllableTokens(entry.word.item.text).map((token) => token.text);
  const before = tokens.slice(0, index).join(" ");
  const after = tokens.slice(index + 1).join(" ");
  return { wordPrefix: before ? `${before} ` : "", wordSuffix: after ? ` ${after}` : "" };
}

function pictureCandidates(ctx: GenerationContext, variant: "missing_rime" | "missing_tone"): Candidate[] {
  const seed = ctx.request.seed;
  return ctx.pictures.flatMap((entry): Candidate[] => {
    if (!entry.word.readable || entry.word.analyses.length > ctx.limits.maxWordSyllables) return [];
    const target = blankTarget(entry, variant === "missing_rime");
    if (!target) return [];
    const { analysis, index } = target;
    // Thanh ngang: khuôn không dấu chính là đáp án (bộ kiểm tra TEXT_LEAKS_ANSWER sẽ chặn) — không tạo ứng viên.
    if (variant === "missing_tone" && analysis.tone === "ngang") return [];
    // Điền vần: mục tiêu kỹ năng chung (phân biệt vần theo nghĩa của tranh) — mỗi tranh một vần nên không ghép theo vần.
    const focus: UnitId[] = variant === "missing_rime" ? [] : [toneUnitId(analysis.tone)];
    const key = `picture:${entry.asset.id}`;
    const difficulty = estimateDifficulty(entry.word.analyses, "word").level;
    return [
      {
        key,
        focusUnits: focus,
        difficulty,
        build: (rng): FillBlankItem | null => {
          const size = Math.min(ctx.limits.maxChoices, 3);
          const onset = analysis.onset;
          const composes = (rime: string, tone: ToneId) => {
            const text = composeWithProfile({ onset, rime, tone }, ctx.check);
            return text !== null && isWellFormed(text, ctx.kb) && !AVOID_SYLLABLES.has(text);
          };
          const templateBase = templateAround(entry, index);
          let built: { options: TextOption[]; answerId: string; distractorTags: Record<string, string> };
          let template: FillBlankItem["content"]["template"];
          if (variant === "missing_rime") {
            const answerText = tonedRimeWithProfile(analysis.rime, analysis.tone, ctx.check);
            if (answerText === null) return null;
            const alternatives = rankedAlternatives({
              kb: ctx.kb,
              kind: "rime",
              answer: analysis.rime,
              pool: ctx.taughtRimes.filter((rime) => Array.from(rime).length > 1),
              rng,
              similar: rimeLookalikes(analysis.rime, ctx.taughtRimes, ctx),
              accept: (rime) =>
                composes(rime, analysis.tone) && tonedRimeWithProfile(rime, analysis.tone, ctx.check) !== null,
            }).slice(0, size - 1);
            if (alternatives.length < 1) return null;
            built = shuffleOptions<Omit<TextOption, "id">>(
              rng,
              { text: answerText, unit: rimeUnitId(analysis.rime) },
              alternatives.map((alt) => ({
                value: {
                  text: tonedRimeWithProfile(alt.text, analysis.tone, ctx.check) ?? alt.text,
                  unit: rimeUnitId(alt.text),
                },
                tag: alt.tag,
              })),
            );
            template = { ...templateBase, before: onset ?? "", after: "" };
          } else {
            const alternatives = toneAlternatives(ctx, rng, analysis.tone, 4).filter((alt) =>
              composes(analysis.rime, alt.text as ToneId),
            );
            const chosen = alternatives.slice(0, size - 1);
            if (chosen.length < 1) return null;
            const option = (tone: ToneId): Omit<TextOption, "id"> => ({
              text: toneNames(ctx.kb, tone).name,
              tone,
              unit: toneUnitId(tone),
            });
            built = shuffleOptions<Omit<TextOption, "id">>(
              rng,
              option(analysis.tone),
              chosen.map((alt) => ({ value: option(alt.text as ToneId), tag: alt.tag })),
            );
            const toneless = composeWithProfile({ onset, rime: analysis.rime, tone: "ngang" }, ctx.check);
            if (toneless === null) return null;
            const markIndex = toneMarkIndex(toneless, ctx.check);
            if (markIndex === undefined) return null;
            template = { ...templateBase, before: toneless, after: "", markIndex };
          }
          const common = {
            id: itemId(variant, key, seed),
            schemaVersion: 1 as const,
            type: "fill_blank" as const,
            objective: objectiveOf(variant, focus),
            difficulty,
            requiredUnits: Array.from(
              new Set([
                ...entry.word.analyses.flatMap(unitsOfAnalysis),
                ...built.options.flatMap((option) => (option.unit ? [option.unit] : [])),
              ]),
            ),
            source: { corpusIds: [entry.word.item.id], pictureIds: [entry.asset.id], fixtureIds: [] },
            audio: plannedAudio(ctx.request.media, variant, {
              stimulus: entry.word.item.text,
              model: entry.word.item.text,
            }),
            content: {
              picture: { pictureId: entry.asset.id, iconKey: entry.asset.iconKey },
              template,
              options: built.options,
            },
            answer: {
              optionId: built.answerId,
              result: entry.word.item.text,
              pictureName: entry.asset.word,
              distractorTags: built.distractorTags,
            },
          };
          return variant === "missing_rime"
            ? { ...common, variant: "missing_rime" }
            : { ...common, variant: "missing_tone" };
        },
      },
    ];
  });
}

export const fillBlankCandidates: CandidateBuilder = (ctx, variant: VariantId) => {
  if (variant === "missing_rime" || variant === "missing_tone") return pictureCandidates(ctx, variant);
  const seed = ctx.request.seed;
  // missing_onset: đáp án duy nhất nhờ quy tắc chính tả → không cần tranh; chỉ dùng tiếng có thật trong ngữ liệu.
  return ctx.syllables.flatMap((target): Candidate[] => {
    const onset = target.analysis.onset;
    const rule = SPELLING_PAIRS.find((entry) => onset !== null && entry.pair.includes(onset));
    if (!rule || onset === null) return [];
    const partner = rule.pair[0] === onset ? rule.pair[1] : rule.pair[0];
    if (!ctx.isTaught(`phoneme:${onset}`) || !ctx.isTaught(`phoneme:${partner}`)) return [];
    const key = `syllable:${target.text}`;
    const focus = rule.pair.map((grapheme) => `phoneme:${grapheme}`);
    return [
      {
        key,
        focusUnits: focus,
        difficulty: target.difficulty,
        build: (rng): FillBlankItem | null => {
          const built = shuffleOptions<Omit<TextOption, "id">>(rng, { text: onset, unit: `phoneme:${onset}` }, [
            { value: { text: partner, unit: `phoneme:${partner}` }, tag: rule.tag },
          ]);
          return {
            id: itemId(variant, key, seed),
            schemaVersion: 1,
            type: "fill_blank",
            variant: "missing_onset",
            objective: objectiveOf(variant, focus, [rule.ruleId]),
            difficulty: target.difficulty,
            requiredUnits: Array.from(new Set([...unitsOfAnalysis(target.analysis), `phoneme:${partner}`])),
            source: { corpusIds: [target.sourceId], pictureIds: [], fixtureIds: [] },
            audio: plannedAudio(ctx.request.media, variant, { stimulus: target.text, model: target.text }),
            content: {
              picture: null,
              template: { wordPrefix: "", before: "", after: target.text.slice(onset.length), wordSuffix: "" },
              options: built.options,
            },
            answer: {
              optionId: built.answerId,
              result: target.text,
              pictureName: null,
              distractorTags: built.distractorTags,
            },
          };
        },
      },
    ];
  });
};
