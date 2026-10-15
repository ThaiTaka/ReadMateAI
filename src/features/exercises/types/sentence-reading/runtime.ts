import { gradeChoice, isChoiceComplete, WRONG_KIND } from "../../core/grading.ts";
import { compactHints, eliminationHint } from "../../core/hints.ts";
import type { ExerciseTypeRuntime } from "../../core/module.ts";
import type { GradeResult, HintView, Response, RevealView } from "../../core/primitives.ts";
import type { SentenceReadingItem } from "./schema.ts";

/**
 * Phần chạy trên trình duyệt của dạng 6 (đọc câu – hiểu câu): chấm, gợi ý, hiện đáp án. Không import zod hay kho tri thức
 * (bundle của học sinh nhẹ); module.ts dùng lại đúng các hàm này cho bộ kiểm tra và server.
 */

export const PUNCTUATION = /^[.,!?…]$/u;

/** Ghép thẻ từ thành câu: dấu câu dính liền từ đứng trước. */
export function joinTokens(texts: readonly string[]): string {
  return texts.reduce((sentence, text, index) => {
    if (index === 0) return text;
    return PUNCTUATION.test(text) ? `${sentence}${text}` : `${sentence} ${text}`;
  }, "");
}

export type ArrangeItem = Extract<SentenceReadingItem, { variant: "arrange_words" }>;

/** Mã thẻ theo thứ tự đúng đầu tiên (thẻ trùng chữ được gán lần lượt). */
export function correctTokenIds(item: ArrangeItem): string[] {
  const remaining = [...item.content.tokens];
  const ids: string[] = [];
  for (const text of item.answer.orders[0] ?? []) {
    const index = remaining.findIndex((token) => token.text === text);
    const [token] = index >= 0 ? remaining.splice(index, 1) : [];
    if (token) ids.push(token.id);
  }
  return ids;
}

/** Đưa các thẻ được gợi ý cố định về đúng chỗ: thẻ đầu ở đầu câu, thẻ cuối (dấu câu) ở cuối. */
export function withFixedTokens(order: readonly string[], fixed: readonly string[]): string[] {
  const [first, last] = fixed;
  const middle = order.filter((id) => !fixed.includes(id));
  return [...(first ? [first] : []), ...middle, ...(last ? [last] : [])];
}

export function gradeOrder(item: ArrangeItem, response: Response): GradeResult {
  if (response.kind !== "order") return WRONG_KIND;
  const byId = new Map(item.content.tokens.map((token) => [token.id, token.text]));
  const texts = response.tokenIds.map((id) => byId.get(id) ?? "");
  const correct = item.answer.orders.some(
    (order) => order.length === texts.length && order.every((text, index) => text === texts[index]),
  );
  return { correct, errorTags: correct ? [] : ["order:wrong"], marks: {} };
}

export function optionText(
  item: Extract<SentenceReadingItem, { variant: "comprehension_question" }>,
  id: string,
): string {
  return item.content.options.find((option) => option.id === id)?.text ?? "";
}

export function sentenceOf(item: SentenceReadingItem): string {
  return item.variant === "arrange_words" ? item.answer.sentence : item.content.sentence;
}

export function hints(item: SentenceReadingItem): HintView[] {
  if (item.variant === "arrange_words") {
    const ids = correctTokenIds(item);
    const first = ids[0];
    const last = ids.at(-1);
    const lastText = item.content.tokens.find((token) => token.id === last)?.text ?? "";
    return compactHints([
      first ? { messageKey: "startWithCapital", fixedTokenIds: [first] } : null,
      first && last && PUNCTUATION.test(lastText)
        ? { messageKey: "endWithPeriod", fixedTokenIds: [first, last] }
        : null,
    ]);
  }
  const first: HintView =
    item.variant === "sentence_picture"
      ? { messageKey: "readSentenceSlowly", splitSyllables: true }
      : { messageKey: "findWordInSentence", splitSyllables: true };
  return compactHints([
    first,
    eliminationHint(
      item.content.options.map((option) => option.id),
      [item.answer.optionId],
    ),
  ]);
}

export function reveal(item: SentenceReadingItem): RevealView {
  if (item.variant === "sentence_picture") {
    const pictureNames: Record<string, string> = {};
    for (const option of item.content.options) {
      pictureNames[option.picture.pictureId] = item.answer.pictureNames[option.id] ?? "";
    }
    return {
      answerText: item.answer.keyword,
      correctIds: [item.answer.optionId],
      pictureNames,
      explanation: `Câu nói về "${item.answer.keyword}".`,
    };
  }
  if (item.variant === "comprehension_question") {
    const answer = optionText(item, item.answer.optionId);
    return { answerText: answer, correctIds: [item.answer.optionId], explanation: `Trong câu có "${answer}".` };
  }
  return { answerText: item.answer.sentence, correctIds: correctTokenIds(item) };
}

export const sentenceReadingRuntime: ExerciseTypeRuntime<SentenceReadingItem> = {
  code: "sentence_reading",
  emptyResponse: (item) => (item.variant === "arrange_words" ? { kind: "order", tokenIds: [] } : null),
  isComplete: (item, response) =>
    item.variant === "arrange_words"
      ? response?.kind === "order" &&
        response.tokenIds.length === item.content.tokens.length &&
        new Set(response.tokenIds).size === response.tokenIds.length
      : isChoiceComplete(response),
  grade: (item, response) =>
    item.variant === "arrange_words"
      ? gradeOrder(item, response)
      : gradeChoice(item.answer.optionId, item.answer.distractorTags, response),
  correctResponse: (item) =>
    item.variant === "arrange_words"
      ? { kind: "order", tokenIds: correctTokenIds(item) }
      : { kind: "choice", optionId: item.answer.optionId },
  hints,
  adjustForHint: (item, response, hint) => {
    if (item.variant !== "arrange_words" || !hint.fixedTokenIds?.length) return response;
    const order = response?.kind === "order" ? response.tokenIds : [];
    return { kind: "order", tokenIds: withFixedTokens(order, hint.fixedTokenIds) };
  },
  reveal,
};
