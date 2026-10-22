"use client";

import { useEffect, useRef, useState } from "react";
import type { Direction } from "../core/types.ts";

/** Một bước mỗi 200 ms khi giữ (khớp thời lượng nội suy), chờ 350 ms để phân biệt chạm một lần với giữ. */
export const STEP_MS = 200;
export const HOLD_DELAY_MS = 350;

type Held = { readonly source: string; readonly direction: Direction };

export type HoldMove = {
  /** Bấm: đi ngay một bước, giữ đủ lâu thì lặp. Cùng `source` bấm lại (key repeat) bị bỏ qua. */
  press(source: string, direction: Direction): void;
  release(source: string): void;
  releaseAll(): void;
};

/**
 * Điều khiển giữ-để-đi dùng đúng MỘT bộ hẹn giờ (setTimeout nối tiếp) cho mọi nguồn phím/nút, nên chạm liên tiếp
 * không sinh nhiều vòng lặp. Mất focus cửa sổ, ẩn tab và gỡ component đều thả hết.
 */
export function useHoldMove(onStep: (direction: Direction) => void): HoldMove {
  const stepRef = useRef(onStep);
  const heldRef = useRef<Held[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    stepRef.current = onStep;
  });

  const [api] = useState<HoldMove>(() => {
    const clearTimer = () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
      timerRef.current = null;
    };
    const schedule = (delay: number) => {
      clearTimer();
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        const top = heldRef.current.at(-1);
        if (!top) return;
        stepRef.current(top.direction);
        schedule(STEP_MS);
      }, delay);
    };
    return {
      press(source, direction) {
        if (heldRef.current.some((held) => held.source === source)) return;
        heldRef.current.push({ source, direction });
        stepRef.current(direction);
        schedule(HOLD_DELAY_MS);
      },
      release(source) {
        heldRef.current = heldRef.current.filter((held) => held.source !== source);
        if (heldRef.current.length === 0) clearTimer();
      },
      releaseAll() {
        heldRef.current = [];
        clearTimer();
      },
    };
  });

  useEffect(() => {
    const stop = () => api.releaseAll();
    const onVisibility = () => {
      if (document.visibilityState !== "visible") stop();
    };
    window.addEventListener("blur", stop);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("blur", stop);
      document.removeEventListener("visibilitychange", onVisibility);
      stop();
    };
  }, [api]);

  return api;
}
