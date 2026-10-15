import type { GradeResult, Response } from "./primitives.ts";

/**
 * Hàm chấm dùng chung (thuần, dùng được cả ở client lẫn server — server sẽ chấm lại ở GĐ7).
 * Kết quả chỉ đánh dấu những gì học sinh ĐÃ CHỌN; không đánh dấu phương án chưa chọn.
 */

export const WRONG_KIND: GradeResult = { correct: false, errorTags: ["response:wrong_kind"], marks: {} };

export function gradeChoice(answerId: string, distractorTags: Record<string, string>, response: Response): GradeResult {
  if (response.kind !== "choice") return WRONG_KIND;
  const correct = response.optionId === answerId;
  return {
    correct,
    errorTags: correct ? [] : [distractorTags[response.optionId] ?? "distractor:other"],
    marks: { [response.optionId]: correct ? "correct" : "incorrect" },
  };
}

/** Chọn nhiều: đúng khi chọn ĐỦ và KHÔNG THỪA. Thiếu đáp án ghi thẻ `selection:missed` (không đánh dấu ô bị bỏ sót). */
export function gradeMulti(
  answerIds: readonly string[],
  distractorTags: Record<string, string>,
  response: Response,
): GradeResult {
  if (response.kind !== "multi") return WRONG_KIND;
  const expected = new Set(answerIds);
  const chosen = new Set(response.optionIds);
  const marks: GradeResult["marks"] = {};
  const errorTags: string[] = [];
  for (const id of chosen) {
    const ok = expected.has(id);
    marks[id] = ok ? "correct" : "incorrect";
    if (!ok) errorTags.push(distractorTags[id] ?? "distractor:other");
  }
  const missed = answerIds.filter((id) => !chosen.has(id));
  if (missed.length > 0) errorTags.push("selection:missed");
  return { correct: errorTags.length === 0, errorTags: Array.from(new Set(errorTags)), marks };
}

export function isChoiceComplete(response: Response | null): boolean {
  return response?.kind === "choice" && response.optionId.length > 0;
}
