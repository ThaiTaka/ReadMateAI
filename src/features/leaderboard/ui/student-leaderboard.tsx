"use client";

import type { Route } from "next";
import { RefreshCw, Trophy, WifiOff } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { AdventureLink } from "@/components/adventure/adventure-button";
import { BoardPanel, LeaderboardBoard } from "@/components/leaderboard/leaderboard-board";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/loading-state";
import { POINTS_CORRECT } from "@/features/gamification/rules";
import type { LeaderboardDto } from "@/features/leaderboard/types";
import { vi } from "@/strings/vi";

const t = vi.leaderboard.student;

type LoadState =
  | { phase: "loading" }
  | { phase: "ready"; board: LeaderboardDto; myPoints: number | null; refreshing: boolean }
  | { phase: "error"; offline: boolean };

type StudentLeaderboardProps = { studentId: string; homeHref: string; practiceHref: string };

async function loadJson<T>(url: string, signal: AbortSignal): Promise<T | null> {
  const response = await fetch(url, { cache: "no-store", credentials: "same-origin", signal });
  const body = (await response.json()) as { ok?: boolean; data?: T };
  return response.ok && body.ok === true && body.data !== undefined ? body.data : null;
}

function Skeletons() {
  return (
    <BoardPanel>
      <div role="status" aria-live="polite" className="mb-4 text-lg font-bold text-white/90">
        {t.loading}
      </div>
      <div className="flex flex-col gap-3" data-testid="leaderboard-skeleton">
        {[0, 1, 2, 3, 4].map((index) => (
          <Skeleton key={index} className="h-[4.25rem] rounded-3xl bg-white/10" />
        ))}
      </div>
    </BoardPanel>
  );
}

/**
 * Bảng điểm của lớp cho học sinh (R05). Dữ liệu LUÔN lấy từ `/api/student/leaderboard` (không hardcode, không
 * localStorage, không tham số URL cho điểm); làm mới khi mở trang, khi quay lại thẻ trình duyệt và khi bấm nút.
 * Trong lúc làm mới vẫn giữ bảng cũ để không nhảy bố cục.
 */
export function StudentLeaderboard({ studentId, homeHref, practiceHref }: StudentLeaderboardProps) {
  const [state, setState] = useState<LoadState>({ phase: "loading" });
  const controller = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    setState((previous) => (previous.phase === "ready" ? { ...previous, refreshing: true } : { phase: "loading" }));
    try {
      const query = `?studentId=${encodeURIComponent(studentId)}`;
      const [board, home] = await Promise.all([
        loadJson<LeaderboardDto>(`/api/student/leaderboard${query}`, abort.signal),
        loadJson<{ score: { balance: number } }>(`/api/student/home${query}`, abort.signal).catch(() => null),
      ]);
      if (abort.signal.aborted) return;
      if (!board) throw new Error("board");
      setState({ phase: "ready", board, myPoints: home?.score.balance ?? null, refreshing: false });
    } catch {
      if (abort.signal.aborted) return;
      setState({ phase: "error", offline: typeof navigator !== "undefined" && navigator.onLine === false });
    }
  }, [studentId]);

  useEffect(() => {
    // Tải khi mở trang; cập nhật khi quay lại thẻ — không thăm dò liên tục (không thời gian thực, giảm tải).
    // eslint-disable-next-line react-hooks/set-state-in-effect -- đồng bộ với hệ thống ngoài (API)
    void load();
    const onVisible = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      controller.current?.abort();
    };
  }, [load]);

  if (state.phase === "loading") return <Skeletons />;

  if (state.phase === "error") {
    return (
      <Card role="alert" className="mx-auto max-w-xl p-6 text-center sm:p-8" data-testid="leaderboard-error">
        <span className="mx-auto flex size-16 items-center justify-center rounded-full bg-lagoon-100 text-lagoon-700">
          {state.offline ? (
            <WifiOff aria-hidden="true" className="size-8" />
          ) : (
            <Trophy aria-hidden="true" className="size-8" />
          )}
        </span>
        <h2 className="mt-4 text-2xl font-extrabold text-ink">{t.error.title}</h2>
        <p className="mt-2 text-lg text-ink-soft">{state.offline ? t.error.offline : t.error.text}</p>
        <Button size="kid" className="mt-6" onClick={() => void load()}>
          <RefreshCw aria-hidden="true" className="size-5" />
          {t.error.retry}
        </Button>
      </Card>
    );
  }

  const { board, myPoints, refreshing } = state;

  if (board.status !== "ok") {
    const message = board.status === "disabled" ? t.disabled : t.noSeason;
    return (
      <Card className="mx-auto max-w-xl p-6 text-center sm:p-8" data-testid={`leaderboard-${board.status}`}>
        <span className="mx-auto flex size-16 items-center justify-center rounded-full bg-sun-100 text-sun-700">
          <Trophy aria-hidden="true" className="size-8" />
        </span>
        <h2 className="mt-4 text-2xl font-extrabold text-ink">{message.title}</h2>
        <p className="mt-2 text-lg text-ink-soft">{message.text}</p>
        <div className="mt-6 flex flex-col items-center gap-3">
          <AdventureLink href={practiceHref as Route} tone="sun">
            {t.practice}
          </AdventureLink>
        </div>
      </Card>
    );
  }

  const allZero = board.rows.length > 0 && board.maxPoints === 0;
  return (
    <div className="flex flex-col gap-4" data-testid="leaderboard-ready">
      <BoardPanel>
        <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-3xl font-extrabold text-white sm:text-4xl">{t.title}</h2>
            <p className="mt-1 text-base font-semibold text-white/85">
              {t.season.replace("{no}", String(board.seasonNo))} · {t.lead}
            </p>
          </div>
          <Button
            variant="outline"
            size="md"
            className="border-white/50 bg-white/10 text-white hover:border-white hover:bg-white/20"
            onClick={() => void load()}
            disabled={refreshing}
          >
            <RefreshCw aria-hidden="true" className={refreshing ? "size-4 animate-spin" : "size-4"} />
            {refreshing ? t.refreshing : t.refresh}
          </Button>
        </header>

        {board.rows.length === 0 && !board.myRow ? (
          <div className="rounded-3xl bg-white/10 p-6 text-center" data-testid="leaderboard-empty">
            <p className="text-xl font-extrabold text-white">{t.empty.title}</p>
            <p className="mt-2 text-lg text-white/90">{t.empty.text.replace("{plus}", String(POINTS_CORRECT))}</p>
          </div>
        ) : (
          <LeaderboardBoard rows={board.rows} maxPoints={board.maxPoints} myRow={board.myRow} />
        )}

        {allZero ? <p className="mt-4 text-center text-base font-semibold text-white/90">{t.allZero}</p> : null}
        <p className="mt-4 text-sm text-white/75">{board.view === "full" ? t.fullNote : t.topNote}</p>
      </BoardPanel>

      <Card className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          {myPoints !== null ? (
            <p className="text-xl font-extrabold text-ink" data-testid="my-points">
              {t.myScore}: <span className="tabular-nums">{myPoints}</span> {t.myScoreUnit}
            </p>
          ) : null}
          {!board.viewerListed ? <p className="mt-1 text-ink-soft">{t.notListed}</p> : null}
          <p className="mt-1 text-sm text-ink-soft">{t.updatedNote}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <AdventureLink href={practiceHref as Route} tone="sun">
            {t.practice}
          </AdventureLink>
          <AdventureLink href={homeHref as Route} tone="plain">
            {t.back}
          </AdventureLink>
        </div>
      </Card>
    </div>
  );
}
