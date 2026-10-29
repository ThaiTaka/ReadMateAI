"use client";

import { Check } from "lucide-react";
import { useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

export type AvatarChoice = { key: string; label: string; art: ReactNode };

type AvatarPickerProps = {
  legend: string;
  name: string;
  choices: AvatarChoice[];
  defaultValue: string;
  /** "kid": ô ≥ 64 px cho học sinh; "compact": khu vực giáo viên. */
  size?: "kid" | "compact";
};

/**
 * Chọn avatar có sẵn bằng cách chạm (radio ẩn + nhãn lớn), không kéo–thả, không truyền tin chỉ bằng màu
 * (ô được chọn có dấu ✓). Hình SVG dựng ở Server Component và truyền qua `art` để không vào bundle JS.
 */
export function AvatarPicker({ legend, name, choices, defaultValue, size = "compact" }: AvatarPickerProps) {
  const [selected, setSelected] = useState(defaultValue);
  return (
    <fieldset>
      <legend className={cn("font-extrabold text-ink", size === "kid" ? "text-xl" : "font-semibold")}>{legend}</legend>
      <div className={cn("mt-3 grid gap-3", size === "kid" ? "grid-cols-3 sm:grid-cols-5" : "grid-cols-5")}>
        {choices.map((choice) => (
          <label
            key={choice.key}
            className={cn(
              "relative flex cursor-pointer flex-col items-center gap-1 rounded-2xl border-4 bg-surface p-1.5 text-center text-xs font-semibold text-ink transition-colors has-focus-visible:outline-3 has-focus-visible:outline-focus",
              size === "kid" ? "min-h-touch-kid rounded-tile p-2 text-sm" : "min-h-touch",
              selected === choice.key ? "border-brand-600 bg-brand-50" : "border-line",
            )}
          >
            <input
              type="radio"
              name={name}
              value={choice.key}
              checked={selected === choice.key}
              onChange={() => setSelected(choice.key)}
              className="sr-only"
            />
            <span className={cn("block", size === "kid" ? "size-16 sm:size-20" : "size-10 sm:size-12")}>
              {choice.art}
            </span>
            <span className={size === "kid" ? undefined : "sr-only sm:not-sr-only"}>{choice.label}</span>
            {selected === choice.key ? (
              <span className="absolute top-1 right-1 flex size-6 items-center justify-center rounded-full bg-brand-600 text-white">
                <Check aria-hidden="true" className="size-3.5" />
              </span>
            ) : null}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
