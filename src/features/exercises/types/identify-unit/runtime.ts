import { gradeChoice, gradeMulti, isChoiceComplete } from "../../core/grading.ts";
import { compactHints, eliminationHint } from "../../core/hints.ts";
import type { ExerciseTypeRuntime } from "../../core/module.ts";
import type { HintView, RevealView } from "../../core/primitives.ts";
import type { IdentifyUnitItem } from "./schema.ts";

/**
 * Phần chạy trên trình duyệt của dạng 3 (tìm âm, vần, thanh): chấm, gợi ý, hiện đáp án. Không import zod hay kho tri thức
 * (bundle của học sinh nhẹ); module.ts dùng lại đúng các hàm này cho bộ kiểm tra và server.
 */

export type WhichItem = Exclude<IdentifyUnitItem, { variant: "find_with_unit" }>;

export function answerText(item: WhichItem): string {
  return item.content.options.find((option) => option.id === item.answer.optionId)?.text ?? "";
}

export function answerIds(item: IdentifyUnitItem): string[] {
  return item.variant === "find_with_unit" ? item.answer.optionIds : [item.answer.optionId];
}

/**
 * Tách tiếng đang hiển thị thành âm đầu + phần còn lại để tô màu (gợi ý bậc 1, PRD §9.2 dạng 3).
 * Chỉ dùng cho tiếng không có qu/gi (bộ sinh đã loại), nên phần âm đầu là tiền tố chữ thuần.
 */
export function segmentsOf(item: WhichItem): HintView["segments"] {
  const syllable = Array.from(item.content.syllable);
  let onsetLength: number;
  if (item.variant === "which_onset") onsetLength = Array.from(answerText(item)).length;
  else if (item.variant === "which_rime") onsetLength = syllable.length - Array.from(answerText(item)).length;
  else return undefined;
  if (onsetLength <= 0 || onsetLength >= syllable.length) return undefined;
  return [
    { text: syllable.slice(0, onsetLength).join(""), part: "onset" },
    { text: syllable.slice(onsetLength).join(""), part: "rest" },
  ];
}

export function hints(item: IdentifyUnitItem): HintView[] {
  const ids = item.content.options.map((option) => option.id);
  const segments = item.variant === "find_with_unit" ? undefined : segmentsOf(item);
  const first: HintView =
    item.variant === "which_tone"
      ? { messageKey: "lookAtToneMark", highlightParts: true }
      : item.variant === "find_with_unit"
        ? { messageKey: "readSyllableBySyllable" }
        : { messageKey: "lookAtColors", highlightParts: true, ...(segments ? { segments } : {}) };
  return compactHints([first, eliminationHint(ids, answerIds(item))]);
}

export function reveal(item: IdentifyUnitItem): RevealView {
  if (item.variant === "find_with_unit") {
    const answers = item.content.options.filter((option) => item.answer.optionIds.includes(option.id));
    return {
      answerText: answers.map((option) => option.text).join(", "),
      correctIds: item.answer.optionIds,
      explanation: `Các tiếng có vần "${item.content.unitText}": ${answers.map((option) => option.text).join(", ")}.`,
    };
  }
  const answer = answerText(item);
  const what = item.variant === "which_onset" ? "âm đầu" : item.variant === "which_rime" ? "vần" : "thanh";
  return {
    answerText: answer,
    correctIds: [item.answer.optionId],
    explanation: `Tiếng "${item.content.syllable}" có ${what} "${answer}".`,
  };
}

export const identifyUnitRuntime: ExerciseTypeRuntime<IdentifyUnitItem> = {
  code: "identify_unit",
  emptyResponse: (item) => (item.variant === "find_with_unit" ? { kind: "multi", optionIds: [] } : null),
  isComplete: (item, response) =>
    item.variant === "find_with_unit"
      ? response?.kind === "multi" && response.optionIds.length > 0
      : isChoiceComplete(response),
  grade: (item, response) =>
    item.variant === "find_with_unit"
      ? gradeMulti(item.answer.optionIds, item.answer.distractorTags, response)
      : gradeChoice(item.answer.optionId, item.answer.distractorTags, response),
  correctResponse: (item) =>
    item.variant === "find_with_unit"
      ? { kind: "multi", optionIds: [...item.answer.optionIds] }
      : { kind: "choice", optionId: item.answer.optionId },
  hints,
  reveal,
};
