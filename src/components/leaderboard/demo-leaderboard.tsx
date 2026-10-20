"use client";

import { RotateCcw } from "lucide-react";
import { useMemo, useState } from "react";
import { AvatarFrame } from "@/components/adventure/avatar-frame";
import { Badge } from "@/components/ui/badge";
import { AVATAR_OPTIONS, type AvatarKey } from "@/features/avatars/catalog";
import type { DemoLeaderboardEntry } from "@/features/demo/adventure-data";
import { applyPointEvent } from "@/features/gamification/apply";
import { maxPointsOf, rankScores, type RankableRow } from "@/features/gamification/ranking";
import { cn } from "@/lib/cn";
import { vi } from "@/strings/vi";
import { BoardPanel, LeaderboardBoard } from "./leaderboard-board";

const t = vi.leaderboard.demo;

type DemoState = { entries: DemoLeaderboardEntry[]; ticks: number[]; tick: number; selected: number };

/** Thời điểm mô phỏng tăng dần theo lần thao tác — hàm thuần, không đọc đồng hồ (cùng một thao tác luôn ra cùng kết quả). */
const BASE_TIME = Date.UTC(2026, 9, 20, 8, 0, 0);
const timeOf = (tick: number) => new Date(BASE_TIME + tick * 60_000).toISOString();

const initialState = (entries: readonly DemoLeaderboardEntry[]): DemoState => ({
  entries: entries.map((entry) => ({ ...entry })),
  ticks: entries.map((_, index) => index),
  tick: entries.length,
  selected: Math.max(
    0,
    entries.findIndex((entry) => entry.isMe),
  ),
});

type DemoLeaderboardProps = { entries: readonly DemoLeaderboardEntry[]; className?: string };

/**
 * Bảng xếp hạng MINH HỌA có thể thử (R05): cùng bộ máy xếp hạng và giao diện với bảng thật, nhưng dữ liệu hư cấu nằm trong
 * state của lần mở trang — không gọi API, không ghi CSDL, không lưu. Dùng để người điều phối đánh giá giao diện.
 */
export function DemoLeaderboard({ entries, className }: DemoLeaderboardProps) {
  const [state, setState] = useState<DemoState>(() => initialState(entries));
  const [announcement, setAnnouncement] = useState("");

  const ranked = useMemo(() => {
    const rows: RankableRow[] = state.entries.map((entry, index) => ({
      key: `demo-${entry.alias}`,
      alias: entry.alias,
      avatarKey: entry.avatar,
      points: entry.points,
      reachedAt: timeOf(state.ticks[index] ?? 0),
      isMe: entry.isMe,
    }));
    return rankScores(rows);
  }, [state]);

  const selected = state.entries[state.selected];

  const update = (change: (draft: DemoState) => void, message: (next: DemoState) => string) => {
    const next: DemoState = {
      ...state,
      entries: state.entries.map((entry) => ({ ...entry })),
      ticks: [...state.ticks],
      tick: state.tick + 1,
    };
    change(next);
    setState(next);
    setAnnouncement(message(next));
  };

  const rankOf = (state_: DemoState, index: number) => {
    const entry = state_.entries[index];
    if (!entry) return 0;
    return 1 + state_.entries.filter((other) => other.points > entry.points).length;
  };

  const answer = (outcome: "correct" | "incorrect") =>
    update(
      (draft) => {
        const entry = draft.entries[draft.selected];
        if (!entry) return;
        const before = entry.points;
        const after = applyPointEvent({ balance: before, earnedTotal: 0, deductedTotal: 0 }, outcome).score.balance;
        entry.points = after;
        if (after !== before) draft.ticks[draft.selected] = draft.tick;
      },
      (next) => {
        const entry = next.entries[next.selected];
        return entry
          ? t.announce
              .replace("{name}", entry.alias)
              .replace("{points}", String(entry.points))
              .replace("{rank}", String(rankOf(next, next.selected)))
          : "";
      },
    );

  const matchAbove = () =>
    update(
      (draft) => {
        const entry = draft.entries[draft.selected];
        if (!entry) return;
        const higher = draft.entries
          .filter((other) => other.points > entry.points)
          .sort((a, b) => a.points - b.points)[0];
        if (!higher) return;
        entry.points = higher.points;
        draft.ticks[draft.selected] = draft.tick;
      },
      (next) => {
        const entry = next.entries[next.selected];
        return entry
          ? t.announce
              .replace("{name}", entry.alias)
              .replace("{points}", String(entry.points))
              .replace("{rank}", String(rankOf(next, next.selected)))
          : "";
      },
    );

  const changeAvatar = (avatar: AvatarKey) =>
    update(
      (draft) => {
        const entry = draft.entries[draft.selected];
        if (entry) entry.avatar = avatar;
      },
      () => t.avatarChanged,
    );

  const reset = () => {
    setState(initialState(entries));
    setAnnouncement(t.resetDone);
  };

  const button =
    "inline-flex min-h-12 items-center justify-center gap-2 rounded-full border-2 border-line-strong bg-surface px-4 text-sm font-bold text-ink hover:border-brand-600 hover:bg-brand-50 sm:text-base";

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <Badge tone="sun" className="self-start uppercase">
        {t.ribbon}
      </Badge>
      <BoardPanel>
        <LeaderboardBoard
          rows={ranked.map((row) => ({
            rowKey: row.key,
            rank: row.rank,
            alias: row.alias,
            avatarKey: row.avatarKey,
            points: row.points,
            isMe: row.isMe,
          }))}
          maxPoints={maxPointsOf(ranked)}
        />
      </BoardPanel>

      <fieldset className="flex flex-col gap-3">
        <legend className="text-base font-extrabold text-ink">{t.pickTitle}</legend>
        <div className="flex flex-wrap gap-2">
          {state.entries.map((entry, index) => (
            <button
              key={entry.alias}
              type="button"
              aria-pressed={index === state.selected}
              onClick={() => setState((previous) => ({ ...previous, selected: index }))}
              className={cn(
                "inline-flex min-h-12 items-center gap-2 rounded-full border-2 py-1 pr-4 pl-1.5 text-sm font-bold sm:text-base",
                index === state.selected
                  ? "border-brand-600 bg-brand-50 text-brand-800"
                  : "border-line-strong bg-surface text-ink hover:border-brand-600",
              )}
            >
              <AvatarFrame avatar={entry.avatar} size="sm" ring="jade" className="[&>span]:size-9 [&>span]:p-0.5" />
              {entry.alias}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className={button} onClick={() => answer("correct")}>
            {t.correct}
          </button>
          <button type="button" className={button} onClick={() => answer("incorrect")}>
            {t.incorrect}
          </button>
          <button type="button" className={button} onClick={matchAbove}>
            {t.tie}
          </button>
          <button type="button" className={button} onClick={reset}>
            <RotateCcw aria-hidden="true" className="size-4" />
            {t.reset}
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label htmlFor="demo-avatar" className="font-semibold text-ink">
            {t.avatarLabel.replace("{name}", selected?.alias ?? "")}
          </label>
          <select
            id="demo-avatar"
            value={selected?.avatar ?? "may"}
            onChange={(event) => changeAvatar(event.target.value as AvatarKey)}
            className="min-h-12 rounded-2xl border-2 border-line-strong bg-surface px-4 text-base text-ink focus:border-brand-600 focus:outline-none"
          >
            {AVATAR_OPTIONS.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </fieldset>
      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </div>
  );
}
