"use client";

import { Check, CircleDot, X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type TileMark = "correct" | "incorrect";

type ChoiceTileProps = {
  children: ReactNode;
  /** Tên cho trình đọc màn hình khi nội dung là hình (không được chứa đáp án trước khi chấm). */
  label?: string;
  selected: boolean;
  /** Dấu đúng/sai sau khi chấm — chỉ cho phương án trẻ đã chọn. */
  mark?: TileMark | undefined;
  /** Sau khi câu đã xong: đây là đáp án đúng. */
  isAnswer?: boolean;
  /** Đã bị gợi ý loại bớt. */
  eliminated?: boolean;
  disabled?: boolean;
  onSelect: () => void;
  /** `text`: chữ học liệu (font Andika, cỡ lớn); `picture`: tranh; `compact`: thẻ nhỏ hơn (từ, thẻ ghép). */
  kind?: "text" | "picture" | "compact";
  className?: string;
};

const MARK_TEXT: Record<TileMark, string> = { correct: "đúng", incorrect: "chưa đúng" };

/**
 * Thẻ chọn cho trẻ: vùng chạm ≥ 64 px, chạm để chọn (không kéo thả), trạng thái thể hiện bằng viền +
 * biểu tượng + chữ ẩn cho trình đọc màn hình — không chỉ bằng màu (CLAUDE.md §9).
 */
export function ChoiceTile({
  children,
  label,
  selected,
  mark,
  isAnswer = false,
  eliminated = false,
  disabled = false,
  onSelect,
  kind = "text",
  className,
}: ChoiceTileProps) {
  const state = mark ?? (isAnswer ? "answer" : selected ? "selected" : "idle");
  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={label}
      disabled={disabled || eliminated}
      onClick={onSelect}
      className={cn(
        "relative flex min-h-touch-kid min-w-touch-kid select-none items-center justify-center gap-2 rounded-tile border-[3px] bg-surface px-4 py-3 text-ink shadow-soft transition-colors",
        "disabled:cursor-not-allowed",
        kind === "text" && "font-reading text-read-lg font-bold",
        kind === "compact" && "font-reading text-read font-bold",
        kind === "picture" && "p-3",
        state === "idle" && "border-line-strong hover:border-brand-400 hover:bg-brand-50",
        state === "selected" && "border-brand-600 bg-brand-50",
        state === "correct" && "border-brand-700 bg-brand-100",
        state === "incorrect" && "border-coral-600 bg-coral-50",
        state === "answer" && "border-brand-700 border-dashed bg-brand-50",
        eliminated && "border-dashed opacity-35",
        className,
      )}
    >
      {children}
      {state === "selected" ? (
        <CircleDot aria-hidden="true" className="absolute right-1.5 top-1.5 size-5 text-brand-700" />
      ) : null}
      {mark === "correct" || (isAnswer && !mark) ? (
        <Check aria-hidden="true" className="absolute right-1.5 top-1.5 size-6 text-brand-700" />
      ) : null}
      {mark === "incorrect" ? (
        <X aria-hidden="true" className="absolute right-1.5 top-1.5 size-6 text-coral-700" />
      ) : null}
      {mark ? <span className="sr-only">{`, ${MARK_TEXT[mark]}`}</span> : null}
      {isAnswer && !mark ? <span className="sr-only">, đáp án đúng</span> : null}
      {eliminated ? <span className="sr-only">, đã được bớt đi</span> : null}
    </button>
  );
}
