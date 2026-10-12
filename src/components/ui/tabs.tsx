"use client";

import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "@/lib/cn";

export type TabItem = {
  id: string;
  label: string;
  /** Phần tử đã dựng sẵn (ví dụ <Icon />) — không truyền component từ Server Component. */
  icon?: ReactNode;
  panel: ReactNode;
};

type TabsProps = {
  items: readonly TabItem[];
  /** Nhãn cho trình đọc màn hình của nhóm tab. */
  label: string;
  className?: string;
};

/**
 * Tab theo mẫu WAI-ARIA: mũi tên trái/phải (hoặc lên/xuống) chuyển tab, Home/End về đầu/cuối,
 * chỉ tab đang chọn nằm trong thứ tự Tab (roving tabindex).
 */
export function Tabs({ items, label, className }: TabsProps) {
  const baseId = useId();
  const [selected, setSelected] = useState(0);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const select = (index: number, moveFocus: boolean) => {
    const next = (index + items.length) % items.length;
    setSelected(next);
    if (moveFocus) tabRefs.current[next]?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const keyToIndex: Record<string, number> = {
      ArrowRight: index + 1,
      ArrowDown: index + 1,
      ArrowLeft: index - 1,
      ArrowUp: index - 1,
      Home: 0,
      End: items.length - 1,
    };
    const target = keyToIndex[event.key];
    if (target === undefined) return;
    event.preventDefault();
    select(target, true);
  };

  return (
    <div className={className}>
      <div role="tablist" aria-label={label} className="flex flex-wrap gap-2">
        {items.map((item, index) => {
          const isSelected = index === selected;
          return (
            <button
              key={item.id}
              ref={(element) => {
                tabRefs.current[index] = element;
              }}
              type="button"
              role="tab"
              id={`${baseId}-tab-${item.id}`}
              aria-selected={isSelected}
              aria-controls={`${baseId}-panel-${item.id}`}
              tabIndex={isSelected ? 0 : -1}
              onClick={() => select(index, false)}
              onKeyDown={(event) => onKeyDown(event, index)}
              className={cn(
                "inline-flex min-h-touch items-center gap-2 rounded-full border-2 px-5 font-semibold transition-colors",
                isSelected
                  ? "border-ink bg-ink text-white"
                  : "border-line bg-surface text-ink-soft hover:border-line-strong hover:text-ink",
              )}
            >
              {item.icon}
              {item.label}
            </button>
          );
        })}
      </div>

      {items.map((item, index) => (
        <div
          key={item.id}
          role="tabpanel"
          id={`${baseId}-panel-${item.id}`}
          aria-labelledby={`${baseId}-tab-${item.id}`}
          hidden={index !== selected}
          tabIndex={0}
          className="mt-6 rounded-card"
        >
          {item.panel}
        </div>
      ))}
    </div>
  );
}
