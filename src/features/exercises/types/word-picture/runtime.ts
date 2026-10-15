import { gradeChoice, isChoiceComplete, WRONG_KIND } from "../../core/grading.ts";
import { compactHints, eliminationHint } from "../../core/hints.ts";
import type { ExerciseTypeRuntime } from "../../core/module.ts";
import type { GradeResult, HintView, Response, RevealView } from "../../core/primitives.ts";
import type { WordPictureItem } from "./schema.ts";

/**
 * Phần chạy trên trình duyệt của dạng 5 (đọc từ – chọn/nối hình): chấm, gợi ý, hiện đáp án. Không import zod hay kho tri thức
 * (bundle của học sinh nhẹ); module.ts dùng lại đúng các hàm này cho bộ kiểm tra và server.
 */

/** Nhãn trung tính của tranh cho trình đọc màn hình — KHÔNG chứa tên tranh trước khi chấm. */
export function neutralPictureLabel(index: number): string {
  return `Hình ${index + 1}`;
}

export function gradeMatch(
  item: Extract<WordPictureItem, { variant: "match_pairs" }>,
  response: Response,
): GradeResult {
  if (response.kind !== "match") return WRONG_KIND;
  const marks: GradeResult["marks"] = {};
  let wrong = 0;
  for (const word of item.content.words) {
    const chosen = response.pairs[word.id];
    if (chosen === undefined) {
      wrong += 1;
      continue;
    }
    const ok = chosen === item.answer.pairs[word.id];
    marks[word.id] = ok ? "correct" : "incorrect";
    if (!ok) wrong += 1;
  }
  return { correct: wrong === 0, errorTags: wrong === 0 ? [] : ["match:wrong_pair"], marks };
}

export function pictureEntries(item: WordPictureItem) {
  return item.variant === "choose_picture" ? item.content.options : item.content.pictures;
}

export function hints(item: WordPictureItem): HintView[] {
  const steps: Array<HintView | null> = [{ messageKey: "readSyllableBySyllable", splitSyllables: true }];
  if (item.variant === "choose_picture") {
    steps.push(
      eliminationHint(
        item.content.options.map((option) => option.id),
        [item.answer.optionId],
      ),
    );
  }
  return compactHints(steps);
}

export function reveal(item: WordPictureItem): RevealView {
  const pictureNames: Record<string, string> = {};
  for (const option of pictureEntries(item)) {
    pictureNames[option.picture.pictureId] = item.answer.pictureNames[option.id] ?? "";
  }
  if (item.variant === "choose_picture") {
    return { answerText: item.content.word, correctIds: [item.answer.optionId], pictureNames };
  }
  return {
    answerText: item.content.words.map((word) => word.text).join(", "),
    correctIds: Object.entries(item.answer.pairs).flat(),
    pictureNames,
  };
}

export const wordPictureRuntime: ExerciseTypeRuntime<WordPictureItem> = {
  code: "word_picture",
  emptyResponse: (item) => (item.variant === "match_pairs" ? { kind: "match", pairs: {} } : null),
  isComplete: (item, response) => {
    if (item.variant === "choose_picture") return isChoiceComplete(response);
    if (response?.kind !== "match") return false;
    const targets = Object.values(response.pairs);
    return item.content.words.every((word) => response.pairs[word.id]) && new Set(targets).size === targets.length;
  },
  grade: (item, response) =>
    item.variant === "choose_picture"
      ? gradeChoice(item.answer.optionId, item.answer.distractorTags, response)
      : gradeMatch(item, response),
  correctResponse: (item) =>
    item.variant === "choose_picture"
      ? { kind: "choice", optionId: item.answer.optionId }
      : { kind: "match", pairs: { ...item.answer.pairs } },
  hints,
  reveal,
};
