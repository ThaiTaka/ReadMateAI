import { gradeChoice, isChoiceComplete, WRONG_KIND } from "../../core/grading.ts";
import { compactHints, eliminationHint } from "../../core/hints.ts";
import type { ExerciseTypeRuntime } from "../../core/module.ts";
import type { GradeResult, HintView, Response, RevealView } from "../../core/primitives.ts";
import type { BuildSyllableItem, PictureBuildItem } from "./schema.ts";

/**
 * Phần chạy trên trình duyệt của dạng 2 (ghép tiếng): chấm, gợi ý, hiện đáp án. Không import zod hay kho tri thức
 * (bundle của học sinh nhẹ); module.ts dùng lại đúng các hàm này cho bộ kiểm tra và server.
 */

export function tileText(item: PictureBuildItem, id: string | null): string {
  const { onsets, rimes, tones } = item.content.tiles;
  return [...onsets, ...rimes, ...tones].find((tile) => tile.id === id)?.text ?? "";
}

export function gradeBuild(item: PictureBuildItem, response: Response): GradeResult {
  if (response.kind !== "build") return WRONG_KIND;
  const marks: GradeResult["marks"] = {};
  const errorTags: string[] = [];
  const groups = [
    ["onset", response.onset, item.answer.onset],
    ["rime", response.rime, item.answer.rime],
    ["tone", response.tone, item.answer.tone],
  ] as const;
  for (const [group, chosen, expected] of groups) {
    if (chosen === null) {
      errorTags.push(`build:${group}_missing`);
      continue;
    }
    const ok = chosen === expected;
    marks[chosen] = ok ? "correct" : "incorrect";
    if (!ok) errorTags.push(item.answer.distractorTags[chosen] ?? `build:${group}`);
  }
  return { correct: errorTags.length === 0, errorTags, marks };
}

export function partsText(item: Extract<BuildSyllableItem, { variant: "parts_to_syllable" }>): string {
  const { onset, rime, toneLabel } = item.content.parts;
  return [onset, rime, toneLabel].filter((part): part is string => part !== null).join(" + ");
}

export function answerOf(item: BuildSyllableItem): string {
  if (item.variant === "picture_build") return item.answer.result;
  return item.content.options.find((option) => option.id === item.answer.optionId)?.text ?? "";
}

export function hints(item: BuildSyllableItem): HintView[] {
  if (item.variant === "picture_build") {
    const { onsets, rimes, tones } = item.content.tiles;
    const eliminate = [
      eliminationHint(
        onsets.map((tile) => tile.id),
        [item.answer.onset],
      ),
      eliminationHint(
        rimes.map((tile) => tile.id),
        [item.answer.rime],
      ),
      eliminationHint(
        tones.map((tile) => tile.id),
        [item.answer.tone],
      ),
    ].flatMap((hint) => hint?.eliminate ?? []);
    return compactHints([
      { messageKey: "sayPictureName", enlargePicture: true },
      eliminate.length > 0 ? { messageKey: "removedOne", eliminate } : null,
    ]);
  }
  const { onset, rime, tone } = item.content.parts;
  // Bước đánh vần chưa có dấu thanh; với thanh ngang thì bước này chính là đáp án nên bỏ qua.
  const steps = onset === null || tone === "ngang" ? null : `${onset} – ${rime} – ${onset}${rime}`;
  return compactHints([
    steps === null ? null : { messageKey: "spellStepByStep", params: { steps } },
    eliminationHint(
      item.content.options.map((option) => option.id),
      [item.answer.optionId],
    ),
  ]);
}

export function reveal(item: BuildSyllableItem): RevealView {
  if (item.variant === "picture_build") {
    const onset = tileText(item, item.answer.onset);
    const rime = tileText(item, item.answer.rime);
    const toneLabel = tileText(item, item.answer.tone);
    return {
      answerText: item.answer.result,
      correctIds: [item.answer.onset, item.answer.rime, item.answer.tone],
      pictureNames: { [item.content.picture.pictureId]: item.answer.pictureName },
      explanation: `${onset} – ${rime} – ${onset}${rime} – ${toneLabel} – ${item.answer.result}`,
    };
  }
  const { onset, rime, toneLabel } = item.content.parts;
  return {
    answerText: answerOf(item),
    correctIds: [item.answer.optionId],
    explanation: `${onset ?? ""} – ${rime} – ${onset ?? ""}${rime} – ${toneLabel} – ${answerOf(item)}`,
  };
}

export const buildSyllableRuntime: ExerciseTypeRuntime<BuildSyllableItem> = {
  code: "build_syllable",
  emptyResponse: (item) =>
    item.variant === "picture_build" ? { kind: "build", onset: null, rime: null, tone: null } : null,
  isComplete: (item, response) =>
    item.variant === "picture_build"
      ? response?.kind === "build" && response.onset !== null && response.rime !== null && response.tone !== null
      : isChoiceComplete(response),
  grade: (item, response) =>
    item.variant === "picture_build"
      ? gradeBuild(item, response)
      : gradeChoice(item.answer.optionId, item.answer.distractorTags, response),
  correctResponse: (item) =>
    item.variant === "picture_build"
      ? { kind: "build", onset: item.answer.onset, rime: item.answer.rime, tone: item.answer.tone }
      : { kind: "choice", optionId: item.answer.optionId },
  hints,
  reveal,
};
