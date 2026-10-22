import type { HintView, Mark, Response, RevealView } from "@/features/exercises/core/primitives";
import type { ExerciseItem } from "@/features/exercises/items";

/** Phần câu bài tập mà giao diện được biết: dạng, biến thể, nội dung hiển thị — KHÔNG có đáp án. */
export type ItemView<I extends ExerciseItem = ExerciseItem> = I extends unknown
  ? Pick<I, "type" | "variant" | "content">
  : never;

export function viewOf<I extends ExerciseItem>(item: I): ItemView<I> {
  return { type: item.type, variant: item.variant, content: item.content } as ItemView<I>;
}

export type PlayerProps<I extends ExerciseItem> = {
  view: ItemView<I>;
  response: Response | null;
  onChange: (response: Response) => void;
  /** Câu đã xong (đúng/hết lượt) hoặc chỉ để xem — không chọn được nữa. */
  locked: boolean;
  /** Dấu đúng/sai cho những gì trẻ ĐÃ chọn ở lần chấm gần nhất. */
  marks: Record<string, Mark>;
  /** Gợi ý đang hiện (đã gộp các bậc). */
  hint: HintView | null;
  /** Chỉ có khi câu đã xong: đáp án đúng để tô và tên tranh. */
  reveal: RevealView | null;
  /** Tiền tố id duy nhất cho phần tử (aria). */
  idPrefix: string;
};
