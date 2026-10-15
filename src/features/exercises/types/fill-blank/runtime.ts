import { gradeChoice, isChoiceComplete } from "../../core/grading.ts";
import { compactHints, eliminationHint } from "../../core/hints.ts";
import type { ExerciseTypeRuntime } from "../../core/module.ts";
import type { HintView, RevealView, TextOption } from "../../core/primitives.ts";
import type { FillBlankItem } from "./schema.ts";

/**
 * Phần chạy trên trình duyệt của dạng 4 (điền âm, vần, dấu thanh): chấm, gợi ý, hiện đáp án. Không import zod hay kho tri thức
 * (bundle của học sinh nhẹ); module.ts dùng lại đúng các hàm này cho bộ kiểm tra và server.
 */

/** Quy tắc chính tả dùng cho gợi ý và giải thích (nêu CẢ HAI chữ, trẻ phải tự áp dụng). */
export const SPELLING_RULE_TEXT: Readonly<Record<string, string>> = {
  "spelling.c_k": "k đứng trước i, e, ê; c đứng trước các âm còn lại",
  "spelling.g_gh": "gh đứng trước i, e, ê; g đứng trước các âm còn lại",
  "spelling.ng_ngh": "ngh đứng trước i, e, ê; ng đứng trước các âm còn lại",
};

export function answerOption(item: FillBlankItem): TextOption | undefined {
  return item.content.options.find((option) => option.id === item.answer.optionId);
}

export function hints(item: FillBlankItem): HintView[] {
  const ids = item.content.options.map((option) => option.id);
  const ruleId = item.objective.ruleIds[0];
  const first: HintView | null =
    item.variant === "missing_onset"
      ? ruleId && SPELLING_RULE_TEXT[ruleId]
        ? { messageKey: "spellingRule", params: { rule: SPELLING_RULE_TEXT[ruleId] ?? "" } }
        : null
      : item.variant === "missing_rime"
        ? { messageKey: "sayPictureName", enlargePicture: true }
        : { messageKey: "tryEachTone" };
  return compactHints([first, eliminationHint(ids, [item.answer.optionId])]);
}

export function reveal(item: FillBlankItem): RevealView {
  const answer = answerOption(item)?.text ?? "";
  const ruleId = item.objective.ruleIds[0];
  const explanation =
    item.variant === "missing_onset" && ruleId && SPELLING_RULE_TEXT[ruleId]
      ? `Viết "${answer}": ${SPELLING_RULE_TEXT[ruleId]}.`
      : item.variant === "missing_rime"
        ? `Vần đúng là "${answer}".`
        : `Dấu thanh đúng: ${answer}.`;
  return {
    answerText: item.answer.result,
    correctIds: [item.answer.optionId],
    ...(item.content.picture && item.answer.pictureName
      ? { pictureNames: { [item.content.picture.pictureId]: item.answer.pictureName } }
      : {}),
    explanation,
  };
}

export const fillBlankRuntime: ExerciseTypeRuntime<FillBlankItem> = {
  code: "fill_blank",
  emptyResponse: () => null,
  isComplete: (_item, response) => isChoiceComplete(response),
  grade: (item, response) => gradeChoice(item.answer.optionId, item.answer.distractorTags, response),
  correctResponse: (item) => ({ kind: "choice", optionId: item.answer.optionId }),
  hints,
  reveal,
};
