import type { HintView } from "./primitives.ts";

/**
 * Gợi ý "loại bớt một phương án sai". Chỉ dùng khi sau khi loại vẫn còn ít nhất hai phương án
 * (một đúng, một sai) — nếu chỉ còn một phương án, gợi ý đã thành đáp án.
 */
export function eliminationHint(optionIds: readonly string[], correctIds: readonly string[]): HintView | null {
  const wrong = optionIds.filter((id) => !correctIds.includes(id));
  const first = wrong[0];
  if (first === undefined || wrong.length < 2) return null;
  return { messageKey: "removedOne", eliminate: [first] };
}

/** Bỏ các bậc gợi ý rỗng. */
export function compactHints(steps: ReadonlyArray<HintView | null>): HintView[] {
  return steps.filter((step): step is HintView => step !== null);
}
