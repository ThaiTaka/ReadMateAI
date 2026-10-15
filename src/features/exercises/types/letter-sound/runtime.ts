import { gradeChoice, isChoiceComplete } from "../../core/grading.ts";
import { compactHints, eliminationHint } from "../../core/hints.ts";
import type { ExerciseTypeRuntime } from "../../core/module.ts";
import type { HintView, RevealView } from "../../core/primitives.ts";
import type { LetterSoundItem } from "./schema.ts";

/**
 * Phần chạy trên trình duyệt của dạng 1 (nhận diện chữ – âm): chấm, gợi ý, hiện đáp án. Không import zod hay kho tri thức
 * (bundle của học sinh nhẹ); module.ts dùng lại đúng các hàm này cho bộ kiểm tra và server.
 */

export function answerText(item: LetterSoundItem): string {
  return item.content.options.find((option) => option.id === item.answer.optionId)?.text ?? "";
}

export function hints(item: LetterSoundItem): HintView[] {
  const ids = item.content.options.map((option) => option.id);
  const first: HintView =
    item.variant === "picture_onset"
      ? { messageKey: "sayPictureSlowly", enlargePicture: true }
      : item.variant === "visual_match"
        ? { messageKey: "lookAtShape" }
        : { messageKey: "listenAgain" };
  return compactHints([first, eliminationHint(ids, [item.answer.optionId])]);
}

export function reveal(item: LetterSoundItem): RevealView {
  const answer = answerText(item);
  if (item.variant === "picture_onset") {
    return {
      answerText: answer,
      correctIds: [item.answer.optionId],
      pictureNames: { [item.content.picture.pictureId]: item.answer.pictureName },
      explanation: `Tiếng "${item.answer.pictureName}" có âm đầu "${answer}".`,
    };
  }
  return { answerText: answer, correctIds: [item.answer.optionId] };
}

export const letterSoundRuntime: ExerciseTypeRuntime<LetterSoundItem> = {
  code: "letter_sound",
  emptyResponse: () => null,
  isComplete: (_item, response) => isChoiceComplete(response),
  grade: (item, response) => gradeChoice(item.answer.optionId, item.answer.distractorTags, response),
  correctResponse: (item) => ({ kind: "choice", optionId: item.answer.optionId }),
  hints,
  reveal,
};
