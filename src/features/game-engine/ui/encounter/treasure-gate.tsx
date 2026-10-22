"use client";

import type { Route } from "next";
import Link from "next/link";
import { RotateCw } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { TreasureChest } from "@/components/art/treasure";
import { Button, buttonClasses } from "@/components/ui/button";
import type { TreasureDto } from "@/features/game-runs/encounter-dto";
import { vi } from "@/strings/vi";
import type { PositionSaver } from "../position-saver.ts";
import { openTreasure } from "./encounter-client.ts";

/*
 * Kho báu (R08.4): khi nhân vật đứng ở ô rương, lưu vị trí rồi hỏi MÁY CHỦ có mở được không (đủ 7/7 và đúng ô). Trình duyệt
 * không đếm chạm trán để tự mở rương; không cộng điểm; gọi lại nhiều lần máy chủ trả cùng một kết quả (`replayed`).
 */

const t = vi.treasureGate;
const SAVE_WAIT_MS = 5000;

type Phase =
  /** Chưa có kết quả: đang đứng ở ô rương thì hiện "Đang mở rương…". */
  | { kind: "idle" }
  | { kind: "none" }
  | { kind: "locked" }
  | { kind: "failed"; message: string }
  | { kind: "opened"; treasure: TreasureDto };

export function TreasureGate({
  studentId,
  runId,
  saver,
  active,
  progress,
  home,
  onOpened,
}: {
  studentId: string;
  runId: string;
  saver: PositionSaver;
  /** Nhân vật đang đứng ở ô rương. */
  active: boolean;
  progress: { resolved: number; total: number } | null;
  home: Route;
  onOpened: () => void;
}) {
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const token = useRef(0);
  const openedRef = useRef(onOpened);
  useEffect(() => {
    openedRef.current = onOpened;
  });

  /** Lưu vị trí → hỏi máy chủ; trả về trạng thái hiển thị. Không đổi state trực tiếp. */
  const execute = useCallback(async (): Promise<Phase> => {
    const saved = await saver.flushAndWait(SAVE_WAIT_MS);
    if (!saved) return { kind: "failed", message: vi.encounter.saveFailedText };
    const result = await openTreasure(studentId, runId);
    if (result.ok) return { kind: "opened", treasure: result.data };
    if (result.code === "ENCOUNTERS_INCOMPLETE") return { kind: "locked" };
    if (result.code === "NOT_AT_TREASURE") return { kind: "none" };
    return { kind: "failed", message: result.code === "NETWORK" ? t.failed : (vi.errors[result.code] ?? t.failed) };
  }, [saver, studentId, runId]);

  const attempt = useCallback(() => {
    const mine = ++token.current;
    void execute().then((next) => {
      if (token.current !== mine) return;
      setPhase(next);
      if (next.kind === "opened") openedRef.current();
    });
  }, [execute]);

  useEffect(() => {
    if (!active) return;
    attempt();
    return () => {
      token.current += 1;
      setPhase((current) => (current.kind === "opened" ? current : { kind: "idle" }));
    };
  }, [active, attempt]);

  const retry = () => {
    setPhase({ kind: "idle" });
    attempt();
  };

  // Rời ô rương thì ẩn thông báo (trừ khi rương đã mở); quay lại ô rương → `attempt` chạy lại và đặt phase mới.
  if (phase.kind === "none" || (!active && phase.kind !== "opened")) return null;
  if (phase.kind === "idle") {
    return (
      <p
        role="status"
        data-testid="treasure-working"
        className="mx-auto mt-3 max-w-[34rem] text-center text-lg font-bold text-ink"
      >
        {t.working}
      </p>
    );
  }
  if (phase.kind === "locked") {
    return (
      <div
        role="status"
        data-testid="treasure-locked"
        className="mx-auto mt-3 max-w-[34rem] rounded-3xl border-2 border-line bg-surface p-4 text-center"
      >
        <p className="text-xl font-extrabold text-ink">{t.lockedTitle}</p>
        <p className="mt-1 text-lg font-semibold text-ink-soft">
          {progress
            ? t.locked
                .replaceAll("{n}", String(progress.resolved))
                .replaceAll("{total}", String(progress.total))
                .replace("{left}", String(Math.max(0, progress.total - progress.resolved)))
            : t.lockedUnknown}
        </p>
      </div>
    );
  }
  if (phase.kind === "failed") {
    return (
      <div
        role="alert"
        data-testid="treasure-failed"
        className="mx-auto mt-3 flex max-w-[34rem] flex-col items-center gap-3 rounded-3xl border-2 border-sun-300 bg-sun-50 p-4 text-center"
      >
        <p className="text-lg font-semibold text-ink">{phase.message}</p>
        <Button size="kid" onClick={retry}>
          <RotateCw aria-hidden="true" className="size-6" />
          {t.retry}
        </Button>
      </div>
    );
  }
  const { defeated, undefeated } = phase.treasure;
  return (
    <section
      aria-labelledby="treasure-opened-title"
      data-testid="treasure-opened"
      className="mx-auto mt-3 flex max-w-[34rem] flex-col items-center gap-3 rounded-3xl border-2 border-sun-300 bg-sun-50 p-5 text-center"
    >
      <div className="animate-pop-in w-40">
        <TreasureChest title={t.chest} />
      </div>
      <h2
        id="treasure-opened-title"
        tabIndex={-1}
        ref={(element) => element?.focus({ preventScroll: true })}
        className="text-2xl font-extrabold text-ink outline-none"
      >
        {t.openedTitle}
      </h2>
      <p className="text-lg font-semibold text-ink-soft">
        {t.openedText
          .replace("{total}", String(defeated + undefeated))
          .replace("{defeated}", String(defeated))
          .replace("{undefeated}", String(undefeated))}
      </p>
      <p className="text-base text-ink-soft">{t.openedNote}</p>
      <Link href={home} className={buttonClasses("secondary", "kid")}>
        {vi.encounter.toHome}
      </Link>
    </section>
  );
}
