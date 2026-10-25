"use client";

import type { Route } from "next";
import Link from "next/link";
import { RotateCw } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Button, buttonClasses } from "@/components/ui/button";
import type { EncounterDto, EncounterStateDto } from "@/features/game-runs/encounter-dto";
import { cn } from "@/lib/cn";
import { vi } from "@/strings/vi";
import type { PositionSaver } from "../position-saver.ts";
import { activateEncounter } from "./encounter-client.ts";
import { EncounterPlay, type StopKind } from "./encounter-play.tsx";
import { monsterName } from "./monster-catalog.ts";

/*
 * Cổng chạm trán (R08.4): khi nhân vật dừng ở điểm kích hoạt, (1) BUỘC lưu vị trí lên máy chủ và đợi xác nhận, (2) chỉ khi đó
 * mới gọi API kích hoạt, (3) mở màn quái vật. Lưu hỏng → không kích hoạt, hiện nút "Thử lại" (nhân vật vẫn bị chặn đi tiếp
 * vì lõi còn `pendingEncounter`). Cổng không bao giờ tự quyết định chạm trán nào đã xong: máy chủ trả ENCOUNTER_FINISHED /
 * NOT_AT_TRIGGER thì chỉ gỡ chặn (điểm đã dùng — không kích hoạt lại).
 */

const t = vi.encounter;
const SAVE_WAIT_MS = 5000;
const FOCUSABLE = "button:not(:disabled),a[href],[tabindex]:not([tabindex='-1'])";

type Phase =
  | { kind: "saving" }
  | { kind: "saveFailed" }
  | { kind: "activateFailed" }
  | { kind: "stopped"; stop: StopKind }
  | { kind: "play"; encounter: EncounterDto };

export function EncounterGate({
  studentId,
  runId,
  saver,
  resume,
  balance,
  onScore,
  home,
  onDismiss,
  onFinished,
  replay = false,
}: {
  studentId: string;
  runId: string;
  saver: PositionSaver;
  /** Chạm trán đang diễn ra khi tải lại trang: mở thẳng màn câu hỏi, không lưu/kích hoạt lại. */
  resume: EncounterStateDto | null;
  balance: number | null;
  onScore: (balance: number) => void;
  home: Route;
  onDismiss: () => void;
  onFinished: (progress: { resolved: number; total: number } | null) => void;
  replay?: boolean;
}) {
  const [phase, setPhase] = useState<Phase>(() =>
    resume?.encounter ? { kind: "play", encounter: resume.encounter } : { kind: "saving" },
  );
  const token = useRef(0);
  const layerRef = useRef<HTMLDivElement | null>(null);
  // Gọi hàm mới nhất mà không buộc `start` đổi theo mỗi lần dựng lại của nơi gọi (tránh kích hoạt lặp).
  const dismissRef = useRef(onDismiss);
  useEffect(() => {
    dismissRef.current = onDismiss;
  });

  /** Lưu vị trí → kích hoạt; trả về màn kế tiếp (null = đã gỡ chặn vì điểm này đã dùng). Không đổi state trực tiếp. */
  const execute = useCallback(async (): Promise<Phase | null> => {
    const saved = await saver.flushAndWait(SAVE_WAIT_MS);
    if (!saved) return { kind: "saveFailed" };
    const result = await activateEncounter(studentId, runId);
    if (result.ok) {
      const encounter = result.data.state.encounter;
      return encounter ? { kind: "play", encounter } : { kind: "activateFailed" };
    }
    switch (result.code) {
      case "ENCOUNTER_FINISHED":
      case "NOT_AT_TRIGGER":
        return null;
      case "SEASON_CLOSED":
      case "RUN_NOT_ACTIVE":
        return { kind: "stopped", stop: "closed" };
      case "UNAUTHENTICATED":
      case "FORBIDDEN":
        return { kind: "stopped", stop: "signed_out" };
      default:
        return { kind: "activateFailed" };
    }
  }, [saver, studentId, runId]);

  const start = useCallback(() => {
    const mine = ++token.current;
    void execute().then((next) => {
      if (token.current !== mine) return;
      if (next) setPhase(next);
      else dismissRef.current();
    });
  }, [execute]);

  const retry = useCallback(() => {
    setPhase({ kind: "saving" });
    start();
  }, [start]);

  const resuming = resume?.encounter != null;
  useEffect(() => {
    // Mỗi lần nhân vật dừng ở điểm kích hoạt dựng một cổng mới; tải lại giữa chạm trán thì mở thẳng màn câu hỏi.
    if (!resuming) {
      layerRef.current?.focus({ preventScroll: true });
      start();
    }
    return () => {
      token.current += 1;
    };
  }, [resuming, start]);

  // Màn quái vật phủ toàn màn hình: khóa cuộn trang nền và làm bàn chơi phía sau "inert" (không focus/đọc được).
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const layer = layerRef.current;
    const behind = layer?.parentElement
      ? Array.from(layer.parentElement.children).filter((child) => child !== layer && !child.hasAttribute("inert"))
      : [];
    for (const element of behind) element.setAttribute("inert", "");
    return () => {
      document.body.style.overflow = previous;
      for (const element of behind) element.removeAttribute("inert");
    };
  }, []);

  const play = phase.kind === "play";
  const monsterKey = play ? phase.encounter.monsterKey : null;
  const label = monsterKey ? t.dialogLabel.replace("{name}", monsterName(monsterKey)) : t.preparing;

  let body: ReactNode;
  switch (phase.kind) {
    case "play":
      body = (
        <div className="mx-auto w-full max-w-xl p-4 pb-12">
          <EncounterPlay
            initial={phase.encounter}
            runId={runId}
            balance={balance}
            onScore={onScore}
            home={home}
            onFinished={onFinished}
            onDismiss={() => dismissRef.current()}
            onStopped={(stop) => setPhase({ kind: "stopped", stop })}
            replay={replay}
          />
        </div>
      );
      break;
    case "saving":
      body = (
        <Card testId="encounter-preparing">
          <p role="status" className="text-xl font-extrabold text-ink">
            {t.saving}
          </p>
        </Card>
      );
      break;
    case "saveFailed":
    case "activateFailed":
      body = (
        <Card testId="encounter-retry">
          <h2 className="text-2xl font-extrabold text-ink">{t.saveFailedTitle}</h2>
          <p role="alert" className="text-lg font-semibold text-ink-soft">
            {phase.kind === "saveFailed" ? t.saveFailedText : t.activateFailedText}
          </p>
          <Button size="kid" autoFocus onClick={retry}>
            <RotateCw aria-hidden="true" className="size-6" />
            {t.retry}
          </Button>
        </Card>
      );
      break;
    case "stopped":
      body = (
        <Card testId="encounter-stopped">
          <h2 className="text-2xl font-extrabold text-ink">
            {phase.stop === "closed" ? t.closedTitle : t.signedOutTitle}
          </h2>
          <p className="text-lg font-semibold text-ink-soft">
            {phase.stop === "closed" ? vi.treasureMazePlay.closed.text : vi.treasureMazePlay.signedOut.text}
          </p>
          <Link href={home} className={buttonClasses("secondary", "kid")}>
            {t.toHome}
          </Link>
        </Card>
      );
      break;
  }

  return (
    <div
      ref={layerRef}
      role="dialog"
      aria-modal="true"
      aria-label={label}
      tabIndex={-1}
      data-encounter-layer=""
      data-testid="encounter-screen"
      data-phase={phase.kind}
      onKeyDown={(event) => {
        if (event.key !== "Tab") return;
        const items = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(FOCUSABLE));
        const first = items[0];
        const last = items.at(-1);
        if (!first || !last) return;
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }}
      className={cn(
        "fixed inset-0 z-[60] overflow-y-auto overscroll-contain outline-none",
        play ? "bg-canvas" : "flex items-center justify-center bg-ink/50 p-4",
      )}
    >
      {body}
    </div>
  );
}

function Card({ testId, children }: { testId: string; children: ReactNode }) {
  return (
    <div
      data-testid={testId}
      className="flex w-full max-w-sm flex-col items-center gap-4 rounded-3xl border-2 border-line bg-surface p-6 text-center"
    >
      {children}
    </div>
  );
}
