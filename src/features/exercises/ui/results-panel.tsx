"use client";

import { ArrowLeft, RotateCcw, Star } from "lucide-react";
import type { ReactNode, RefObject } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SUPPORT_POLICIES } from "@/features/exercises/core/support";
import { summarizeSession } from "@/features/exercises/session/results";
import type { SessionState } from "@/features/exercises/session/session";
import { vi } from "@/strings/vi";

function formatDuration(ms: number | null): string {
  const t = vi.practice.results;
  if (ms === null) return t.unknownDuration;
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes > 0
    ? t.minutes.replace("{m}", String(minutes)).replace("{s}", String(seconds))
    : t.seconds.replace("{s}", String(seconds));
}

/**
 * Màn kết quả: phần cho trẻ là lời khen + ngôi sao (không điểm số so sánh, không xếp hạng); phần cho người
 * lớn là số liệu của buổi luyện — chỉ trong bộ nhớ trang — và các chỉ số nghiên cứu đo được trong ứng dụng.
 * Chỉ số cần quan sát ở lớp (`classroom_observation`) không còn hiển thị từ R02 (AD-51; mã giữ tới R11).
 */
export function ResultsPanel({
  state,
  headingRef,
  onRestart,
  onExit,
  extra,
}: {
  state: SessionState;
  headingRef: RefObject<HTMLHeadingElement | null>;
  onRestart: () => void;
  onExit: () => void;
  extra?: ReactNode;
}) {
  const t = vi.practice.results;
  const result = summarizeSession(state);
  const research = result.research.filter((indicator) => indicator.source === "app");
  const rows: Array<[string, string]> = [
    [t.rows.completed, `${result.completedItems} / ${result.gradableItems}`],
    [t.rows.correct, String(result.correctItems)],
    [t.rows.independent, String(result.independentItems)],
    [t.rows.revealed, String(result.revealedItems)],
    [t.rows.retries, String(result.retries)],
    [t.rows.hints, String(result.hintsUsed)],
    [t.rows.help, String(result.helpRequests)],
    [t.rows.support, result.supportLevels.map((level) => SUPPORT_POLICIES[level].code).join(", ")],
    [t.rows.completion, `${Math.round(result.completionRate * 100)}%`],
    [t.rows.duration, formatDuration(result.activeDurationMs)],
  ];
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-center gap-3 rounded-card border-2 border-sun-200 bg-sun-50 p-6 text-center">
        <h3 ref={headingRef} tabIndex={-1} className="text-2xl font-extrabold text-ink sm:text-3xl">
          {t.title}
        </h3>
        <p className="text-ink-soft">{t.subtitle}</p>
        <p
          role="img"
          className="flex flex-wrap justify-center gap-1"
          aria-label={t.starsLabel.replace("{n}", String(result.completedItems))}
        >
          {Array.from({ length: result.completedItems }, (_unused, index) => (
            <Star key={index} aria-hidden="true" className="size-9 fill-sun-400 text-sun-500" />
          ))}
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Button size="kid" onClick={onRestart}>
            <RotateCcw aria-hidden="true" className="size-6" />
            {t.restart}
          </Button>
          <Button size="kid" variant="outline" onClick={onExit}>
            <ArrowLeft aria-hidden="true" className="size-6" />
            {t.back}
          </Button>
        </div>
      </div>

      <details className="rounded-card border border-line bg-surface p-5" open>
        <summary className="cursor-pointer text-lg font-bold text-ink">{t.adultTitle}</summary>
        <p className="mt-2 text-sm text-ink-soft">{t.privacy}</p>
        <dl className="mt-4 grid gap-x-6 gap-y-2 sm:grid-cols-2">
          {rows.map(([label, value]) => (
            <div key={label} className="flex justify-between gap-3 border-b border-line py-1.5">
              <dt className="text-ink-soft">{label}</dt>
              <dd className="font-bold text-ink">{value}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-2 text-xs text-ink-faint">{result.durationNote}</p>
        <h4 className="mt-6 font-bold text-ink">{t.researchTitle}</h4>
        <ul className="mt-2 space-y-3">
          {research.map((indicator) => (
            <li key={indicator.id} className="rounded-2xl bg-canvas p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-ink">{indicator.question}</span>
                <Badge tone="brand">{t.sourceApp}</Badge>
              </div>
              <p className="mt-1 font-bold text-ink">
                {indicator.value ? `${indicator.value.numerator} / ${indicator.value.denominator}` : t.notMeasured}
              </p>
              <p className="text-sm text-ink-soft">{indicator.caveat}</p>
            </li>
          ))}
        </ul>
      </details>
      {extra}
    </div>
  );
}
