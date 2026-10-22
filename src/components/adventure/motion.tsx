"use client";

import { Sparkles, Waves } from "lucide-react";
import { createContext, useContext, useState, useSyncExternalStore, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { vi } from "@/strings/vi";

/**
 * Giảm chuyển động (AD-50): theo `prefers-reduced-motion` của hệ điều hành VÀ công tắc trong trang.
 * R02 giữ lựa chọn trong React state của lần mở trang (không localStorage ở khu vực học sinh; lưu ở hồ sơ
 * học sinh phía server từ R03). Khi bật, vùng bọc có `data-motion="reduce"` → globals.css dừng mọi hoạt cảnh.
 */

type MotionContextValue = { reduced: boolean; toggle: () => void };

const MotionContext = createContext<MotionContextValue | null>(null);

const QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(onChange: () => void) {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return () => undefined;
  const media = window.matchMedia(QUERY);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

function systemPrefersReduced() {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia(QUERY).matches;
}

export function MotionScope({ children, className }: { children: ReactNode; className?: string }) {
  const system = useSyncExternalStore(subscribe, systemPrefersReduced, () => false);
  // null = theo hệ điều hành; true/false = người dùng đã chọn trong trang.
  const [choice, setChoice] = useState<boolean | null>(null);
  const reduced = choice ?? system;
  return (
    <MotionContext.Provider value={{ reduced, toggle: () => setChoice(!reduced) }}>
      <div data-motion={reduced ? "reduce" : "full"} className={className}>
        {children}
      </div>
    </MotionContext.Provider>
  );
}

/** Công tắc "Giảm chuyển động" (aria-pressed), vùng chạm ≥ 48px; phải nằm trong MotionScope. */
export function MotionToggle({ className, tone = "light" }: { className?: string; tone?: "light" | "dark" }) {
  const context = useContext(MotionContext);
  if (!context) return null;
  const t = vi.adventure.motion;
  const Icon = context.reduced ? Waves : Sparkles;
  return (
    <button
      type="button"
      aria-pressed={context.reduced}
      onClick={context.toggle}
      title={t.hint}
      className={cn(
        "inline-flex min-h-12 items-center gap-2 rounded-full border-2 px-4 text-sm font-bold transition-colors",
        tone === "dark"
          ? "border-white/40 bg-white/10 text-white hover:bg-white/20"
          : "border-line bg-surface text-ink hover:border-line-strong",
        className,
      )}
    >
      <Icon aria-hidden="true" className="size-5" />
      <span>{t.label}</span>
      <span
        aria-hidden="true"
        className={cn(
          "rounded-full px-2 py-0.5 text-xs font-extrabold",
          context.reduced
            ? "bg-jade-600 text-white"
            : tone === "dark"
              ? "bg-white/20"
              : "bg-surface-muted text-ink-soft",
        )}
      >
        {context.reduced ? t.on : t.off}
      </span>
    </button>
  );
}
