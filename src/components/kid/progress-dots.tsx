"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/cn";
import { vi } from "@/strings/vi";

export type DotState = "done" | "current" | "visited" | "upcoming";

/**
 * Tiến độ buổi luyện: mỗi câu một chấm (đã xong có dấu tích, đang làm có viền đậm). Chấm của câu đã
 * mở là nút để quay lại xem; câu chưa tới không bấm được. Không có điểm số hay so sánh.
 */
export function ProgressDots({ states, onSelect }: { states: readonly DotState[]; onSelect: (index: number) => void }) {
  const t = vi.practice.controls;
  return (
    <nav aria-label={t.progressLabel}>
      <ol className="flex flex-wrap items-center gap-1.5">
        {states.map((state, index) => {
          const label = `${t.goToItem.replace("{n}", String(index + 1))}${
            state === "done" ? `, ${t.itemDone}` : state === "current" ? `, ${t.itemCurrent}` : ""
          }`;
          return (
            <li key={index}>
              <button
                type="button"
                aria-label={label}
                aria-current={state === "current" ? "step" : undefined}
                disabled={state === "upcoming"}
                onClick={() => onSelect(index)}
                className={cn(
                  "flex size-8 items-center justify-center rounded-full border-2 text-xs font-bold transition-colors",
                  state === "done" && "border-brand-600 bg-brand-600 text-white",
                  state === "current" && "border-ink bg-surface text-ink ring-2 ring-ink ring-offset-1",
                  state === "visited" && "border-brand-300 bg-brand-50 text-brand-800",
                  state === "upcoming" && "cursor-default border-line bg-surface text-ink-faint",
                )}
              >
                {state === "done" ? <Check aria-hidden="true" className="size-4" /> : index + 1}
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
