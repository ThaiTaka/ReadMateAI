"use client";

import { useState, useTransition } from "react";
import { cn } from "@/lib/cn";
import type { Result } from "@/server/result";
import { vi } from "@/strings/vi";

export type ActionNote = { kind: "ok" | "error"; text: string };

/**
 * Gọi Server Action và giữ thông báo kết quả bằng tiếng Việt (mã lỗi → câu chữ dễ hiểu, không hiện lỗi kỹ thuật).
 * Server Action tự `refresh()` lại dữ liệu trang khi thành công.
 */
export function useAction() {
  const [pending, startTransition] = useTransition();
  const [note, setNote] = useState<ActionNote | null>(null);

  const run = (action: () => Promise<Result<unknown>>, successText: string) => {
    setNote(null);
    startTransition(async () => {
      try {
        const result = await action();
        setNote(result.ok ? { kind: "ok", text: successText } : { kind: "error", text: vi.errors[result.code] });
      } catch {
        setNote({ kind: "error", text: vi.errors.UNKNOWN });
      }
    });
  };

  return { pending, note, run, clear: () => setNote(null), setNote };
}

export function ActionNoteView({ note, className }: { note: ActionNote | null; className?: string }) {
  if (!note) return null;
  return note.kind === "error" ? (
    <p role="alert" className={cn("rounded-xl bg-coral-50 px-4 py-3 text-sm font-semibold text-coral-800", className)}>
      {note.text}
    </p>
  ) : (
    <p role="status" className={cn("text-sm font-semibold text-brand-700", className)}>
      {note.text}
    </p>
  );
}

export const formatSeconds = (ms: number) => (ms / 1000).toFixed(1).replace(".", ",");
