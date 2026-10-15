"use client";

import { ArrowLeft, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { INSTRUCTION_ICONS, PATH_VISUALS } from "@/components/learning/visuals";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SUPPORT_LEVELS, SUPPORT_POLICIES } from "@/features/exercises/core/support";
import { VARIANTS } from "@/features/exercises/runtime-registry";
import { SessionRunner, type RunnerBlock } from "@/features/exercises/ui/session-runner";
import { WorksheetPreview } from "@/features/exercises/ui/worksheet-preview";
import type { DemoActivity, DemoPath, DemoPracticeData } from "@/features/demo/practice-data";
import { cn } from "@/lib/cn";
import { vi } from "@/strings/vi";
import type { LearningPathId, SupportLevel } from "@/types/learning";

type Run = { kind: "session" } | { kind: "activity"; variant: string };

function activityBlock(activity: DemoActivity, level: SupportLevel): RunnerBlock {
  return {
    id: `activity-${activity.variant}`,
    title: activity.title,
    variant: activity.variant,
    supportLevel: level,
    items: activity.items,
    example: activity.example,
    previewOnly: activity.status === "preview_only",
  };
}

function sessionBlocks(path: DemoPath, level: SupportLevel): RunnerBlock[] {
  return path.session.map((block) => ({
    id: block.id,
    title: block.title,
    variant: block.variant,
    supportLevel: block.kind === "classroom_like" ? 0 : level,
    items: block.items,
    example: path.activities.find((activity) => activity.variant === block.variant)?.example ?? null,
    previewOnly: block.previewOnly,
    classroomLike: block.kind === "classroom_like",
  }));
}

/**
 * Luồng bản chơi thử: chọn lộ trình → chọn buổi luyện/dạng bài → làm bài → kết quả. Toàn bộ trạng thái
 * nằm trong bộ nhớ của trang (useState/useReducer) — không localStorage, không gửi dữ liệu đi đâu.
 */
export function DemoPractice({ data }: { data: DemoPracticeData }) {
  const t = vi.demo.practice;
  const [pathId, setPathId] = useState<LearningPathId | null>(null);
  const [level, setLevel] = useState<SupportLevel | null>(null);
  const [run, setRun] = useState<Run | null>(null);
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const step = run ? "run" : pathId ? "activities" : "paths";
  const previousStep = useRef(step);

  // Người dùng đổi bước → cuộn đầu khu vực luyện lên và đưa focus tới tiêu đề bước mới (không chuyển trang).
  // Lần hiển thị đầu tiên không cuộn, không giành focus.
  useEffect(() => {
    if (previousStep.current === step) return;
    previousStep.current = step;
    if (step === "run") return;
    rootRef.current?.scrollIntoView?.({ block: "start" });
    headingRef.current?.focus({ preventScroll: true });
  }, [step]);

  const path = data.paths.find((candidate) => candidate.id === pathId) ?? null;
  const supportLevel = level ?? path?.supportLevel ?? 3;

  if (path && run) {
    const activity =
      run.kind === "activity" ? path.activities.find((entry) => entry.variant === run.variant) : undefined;
    const blocks =
      run.kind === "session"
        ? sessionBlocks(path, supportLevel)
        : activity
          ? [activityBlock(activity, supportLevel)]
          : [];
    return (
      <div ref={rootRef} className="scroll-mt-4">
        <SessionRunner
          key={`${path.id}-${run.kind}-${activity?.variant ?? "session"}-${supportLevel}`}
          heading={t.runnerHeading}
          blocks={blocks}
          onExit={() => setRun(null)}
          resultsExtra={
            activity?.classroom.ok ? (
              <WorksheetPreview contract={activity.classroom.contract} equivalence={activity.classroom.equivalence} />
            ) : activity && !activity.classroom.ok ? (
              <p className="rounded-2xl bg-surface-muted p-4 text-sm text-ink-soft">
                <strong>{vi.practice.worksheet.unavailable}: </strong>
                {activity.classroom.reason}
              </p>
            ) : null
          }
        />
      </div>
    );
  }

  if (!path) {
    return (
      <div ref={rootRef} className="flex scroll-mt-4 flex-col gap-5">
        <div>
          <h3 ref={headingRef} tabIndex={-1} className="text-2xl font-extrabold text-ink">
            {t.pathStep}
          </h3>
          <p className="mt-1 text-ink-soft">{t.pathDescription}</p>
        </div>
        <ul className="grid gap-4 md:grid-cols-3">
          {data.paths.map((candidate) => {
            const visual = PATH_VISUALS[candidate.id];
            return (
              <li key={candidate.id}>
                <button
                  type="button"
                  onClick={() => {
                    setPathId(candidate.id);
                    setLevel(null);
                  }}
                  className={cn(
                    "flex h-full min-h-touch-kid w-full flex-col items-start gap-3 rounded-card border-2 p-5 text-left transition-shadow hover:shadow-lift",
                    visual.surface,
                  )}
                >
                  <span className="flex items-center gap-3">
                    <span className={cn("flex size-12 items-center justify-center rounded-2xl", visual.iconBubble)}>
                      <visual.Icon aria-hidden="true" className="size-6" />
                    </span>
                    <span className="text-xl font-extrabold text-ink">{candidate.name}</span>
                  </span>
                  <span className={cn("font-semibold", visual.accentText)}>{candidate.tagline}</span>
                  <span className="text-ink-soft">{candidate.description}</span>
                  <Badge tone={visual.badgeTone}>
                    {vi.practice.runner.supportLabel}: {SUPPORT_POLICIES[candidate.supportLevel].code}
                  </Badge>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

  const visual = PATH_VISUALS[path.id];
  const lessonNote = (
    path.effectiveLessonOrdinal !== null && path.effectiveLessonOrdinal !== path.lessonOrdinal
      ? t.lessonNoteFoundation
      : t.lessonNote
  ).replace("{lesson}", String(path.effectiveLessonOrdinal ?? path.lessonOrdinal));
  const byType = new Map<string, DemoActivity[]>();
  for (const activity of path.activities)
    byType.set(activity.typeName, [...(byType.get(activity.typeName) ?? []), activity]);

  return (
    <div ref={rootRef} className="flex scroll-mt-4 flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold uppercase tracking-wider text-ink-faint">{t.chooseActivity}</p>
          <h3 ref={headingRef} tabIndex={-1} className="mt-1 flex items-center gap-3 text-2xl font-extrabold text-ink">
            <span className={cn("flex size-10 items-center justify-center rounded-xl", visual.iconBubble)}>
              <visual.Icon aria-hidden="true" className="size-5" />
            </span>
            {path.name}
          </h3>
          <p className="mt-1 text-sm text-ink-soft">{lessonNote}</p>
        </div>
        <Button variant="ghost" onClick={() => setPathId(null)}>
          <ArrowLeft aria-hidden="true" className="size-5" />
          {t.changePath}
        </Button>
      </div>

      <fieldset className="rounded-card border border-line bg-surface p-4">
        <legend className="px-1 font-bold text-ink">{t.supportTitle}</legend>
        <p className="text-sm text-ink-soft">{t.supportHint}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {SUPPORT_LEVELS.map((candidate) => {
            const policy = SUPPORT_POLICIES[candidate];
            const checked = candidate === supportLevel;
            return (
              <label
                key={candidate}
                className={cn(
                  "flex min-h-touch cursor-pointer items-center gap-2 rounded-full border-2 px-4 font-semibold",
                  checked
                    ? "border-ink bg-ink text-white"
                    : "border-line bg-surface text-ink-soft hover:border-line-strong",
                )}
              >
                <input
                  type="radio"
                  name="support-level"
                  value={candidate}
                  checked={checked}
                  onChange={() => setLevel(candidate)}
                  className="size-4 accent-current"
                />
                {policy.code} – {policy.name}
              </label>
            );
          })}
        </div>
      </fieldset>

      <section aria-labelledby="demo-session-title" className="rounded-card border-2 border-brand-200 bg-brand-50 p-5">
        <h4 id="demo-session-title" className="text-xl font-extrabold text-ink">
          {t.sessionTitle}
        </h4>
        <p className="text-ink-soft">{t.sessionDescription}</p>
        <ol className="mt-3 list-decimal space-y-1 pl-6 text-ink marker:font-bold">
          {path.session.map((block) => (
            <li key={block.id}>
              {block.title}{" "}
              <span className="whitespace-nowrap text-sm text-ink-faint">
                · {t.itemCount.replace("{n}", String(block.items.length))} ·{" "}
                {SUPPORT_POLICIES[block.kind === "classroom_like" ? 0 : supportLevel].code}
              </span>
            </li>
          ))}
        </ol>
        <Button
          size="kid"
          className="mt-4"
          onClick={() => setRun({ kind: "session" })}
          disabled={path.session.length === 0}
        >
          <Play aria-hidden="true" className="size-6" />
          {t.startSession}
        </Button>
      </section>

      <section aria-labelledby="demo-types-title">
        <h4 id="demo-types-title" className="text-xl font-extrabold text-ink">
          {t.typesTitle}
        </h4>
        <div className="mt-3 flex flex-col gap-5">
          {Array.from(byType.entries()).map(([typeName, activities]) => (
            <div key={typeName}>
              <p className="font-bold text-ink-soft">{typeName}</p>
              <ul className="mt-2 grid gap-3 md:grid-cols-2">
                {activities.map((activity) => {
                  const Icon = INSTRUCTION_ICONS[VARIANTS[activity.variant].instruction.icon];
                  const playable = activity.status !== "unavailable";
                  return (
                    <li
                      key={activity.variant}
                      className="flex flex-col gap-2 rounded-card border border-line bg-surface p-4"
                    >
                      <div className="flex items-start gap-3">
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-lagoon-50 text-lagoon-700">
                          <Icon aria-hidden="true" className="size-5" />
                        </span>
                        <div className="min-w-0">
                          <p className="font-bold text-ink">{activity.title}</p>
                          <p className="text-sm text-ink-soft">{activity.instruction.text}</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {activity.recommended ? <Badge tone={visual.badgeTone}>{t.recommended}</Badge> : null}
                        <Badge tone={activity.status === "ready" ? "brand" : "neutral"}>
                          {t.status[activity.status]}
                        </Badge>
                        {playable ? (
                          <Badge tone="neutral">{t.itemCount.replace("{n}", String(activity.items.length))}</Badge>
                        ) : null}
                      </div>
                      {activity.unavailableReason ? (
                        <p className="text-sm text-ink-soft">{activity.unavailableReason}</p>
                      ) : null}
                      <div className="mt-auto">
                        <Button
                          variant="outline"
                          disabled={!playable}
                          onClick={() => setRun({ kind: "activity", variant: activity.variant })}
                          aria-label={`${t.tryActivity}: ${activity.title}`}
                        >
                          <Play aria-hidden="true" className="size-5" />
                          {t.tryActivity}
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
