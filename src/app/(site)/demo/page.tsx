import type { Metadata } from "next";
import { ArrowRight, ChevronRight, ClipboardCheck, Puzzle, Repeat, Sticker, type LucideIcon } from "lucide-react";
import { INSTRUCTION_ICONS, PATH_VISUALS } from "@/components/learning/visuals";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { Notice } from "@/components/ui/notice";
import { SectionHeading } from "@/components/ui/section-heading";
import { Tabs, type TabItem } from "@/components/ui/tabs";
import { DEMO_SESSIONS, DEMO_SUPPORT_LEVELS, type DemoStepKind } from "@/features/demo/demo-data";
import { EXERCISE_TYPES } from "@/features/exercises/catalog";
import { LEARNING_PATHS, type LearningPath } from "@/features/learning-paths/catalog";
import { cn } from "@/lib/cn";
import { vi } from "@/strings/vi";

export const metadata: Metadata = {
  title: vi.demo.meta.title,
  description: vi.demo.meta.description,
};

const STEP_ICONS: Record<DemoStepKind, LucideIcon> = {
  review: Repeat,
  practice: Puzzle,
  classroom_like: ClipboardCheck,
  celebrate: Sticker,
};

const exerciseName = new Map(EXERCISE_TYPES.map((type) => [type.code, type.name]));
const pathName = new Map(LEARNING_PATHS.map((path) => [path.id, path.name]));
const supportName = new Map(DEMO_SUPPORT_LEVELS.map((level) => [level.level, `${level.code} – ${level.name}`]));

function PathPanel({ path }: { path: LearningPath }) {
  const t = vi.demo.paths;
  const visual = PATH_VISUALS[path.id];
  const steps = DEMO_SESSIONS[path.id];
  const totalMinutes = steps.reduce((sum, step) => sum + step.minutes, 0);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
      <div className={cn("rounded-card border p-6", visual.surface)}>
        <div className="flex items-center gap-4">
          <span className={cn("flex size-14 items-center justify-center rounded-2xl", visual.iconBubble)}>
            <visual.Icon aria-hidden="true" className="size-7" />
          </span>
          <div>
            <h3 className="text-2xl font-extrabold text-ink">{path.name}</h3>
            <p className={cn("font-semibold", visual.accentText)}>{path.tagline}</p>
          </div>
        </div>
        <p className="mt-4 leading-relaxed text-ink-soft">{path.description}</p>
        <dl className="mt-5 space-y-3">
          <div>
            <dt className="text-sm font-bold uppercase tracking-wider text-ink-faint">{t.startingSupportLabel}</dt>
            <dd className="mt-1 font-semibold text-ink">{supportName.get(path.startingSupport)}</dd>
          </div>
          <div>
            <dt className="text-sm font-bold uppercase tracking-wider text-ink-faint">{t.exerciseTypesLabel}</dt>
            <dd className="mt-2 flex flex-wrap gap-2">
              {path.exerciseTypes.map((code) => (
                <Badge key={code} tone={visual.badgeTone}>
                  {exerciseName.get(code)}
                </Badge>
              ))}
            </dd>
          </div>
        </dl>
      </div>

      <Card>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-xl font-bold text-ink">{t.sessionTitle}</h3>
          <p className="text-sm text-ink-faint">
            {t.sessionNote} · {totalMinutes} {t.minutesSuffix}
          </p>
        </div>
        <ol className="mt-5 space-y-3">
          {steps.map((step, index) => {
            const Icon = STEP_ICONS[step.kind];
            return (
              <li key={step.title} className="flex gap-4 rounded-2xl bg-canvas p-4">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-surface text-brand-700 shadow-soft">
                  <Icon aria-hidden="true" className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-ink">
                    {index + 1}. {step.title}
                  </p>
                  <p className="text-ink-soft">{step.detail}</p>
                </div>
                <span className="shrink-0 text-sm font-semibold text-ink-faint">
                  {step.minutes} {t.minutesSuffix}
                </span>
              </li>
            );
          })}
        </ol>
      </Card>
    </div>
  );
}

export default function DemoPage() {
  const t = vi.demo;

  const tabs: TabItem[] = LEARNING_PATHS.map((path) => {
    const visual = PATH_VISUALS[path.id];
    return {
      id: path.id,
      label: path.name,
      icon: <visual.Icon aria-hidden="true" className="size-5" />,
      panel: <PathPanel path={path} />,
    };
  });

  return (
    <>
      <section aria-labelledby="demo-title" className="border-b border-line bg-surface">
        <Container className="py-12 sm:py-16">
          <div className="flex flex-wrap gap-2">
            <Badge tone="sun">{t.eyebrow}</Badge>
            <Badge tone="neutral">{vi.status.demoData}</Badge>
          </div>
          <h1 id="demo-title" className="mt-4 max-w-3xl text-4xl font-extrabold leading-tight text-ink sm:text-5xl">
            {t.title}
          </h1>
          <p className="mt-4 max-w-3xl text-lg leading-relaxed text-ink-soft">{t.intro}</p>
          <Notice tone="progress" title={t.notice.title} className="mt-8 max-w-3xl">
            {t.notice.text}
          </Notice>
        </Container>
      </section>

      <section aria-labelledby="demo-paths-title" className="py-14 sm:py-16">
        <Container>
          <SectionHeading id="demo-paths-title" title={t.paths.title} description={t.paths.description} />
          <Tabs items={tabs} label={t.paths.tabsLabel} className="mt-8" />
        </Container>
      </section>

      <section aria-labelledby="demo-support-title" className="bg-surface py-14 sm:py-16">
        <Container>
          <SectionHeading id="demo-support-title" title={t.support.title} description={t.support.description} />
          <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {DEMO_SUPPORT_LEVELS.map((level, index) => (
              <li key={level.code} className="relative flex flex-col rounded-card border border-line bg-canvas p-5">
                <div className="flex items-center gap-3">
                  <span className="rounded-full bg-ink px-3 py-1 text-sm font-extrabold text-white">{level.code}</span>
                  <h3 className="font-bold text-ink">{level.name}</h3>
                </div>
                <p className="mt-3 leading-relaxed text-ink-soft">{level.description}</p>
                {/* Thanh minh họa mức hỗ trợ: ngắn dần từ H3 đến H0 */}
                <div aria-hidden="true" className="mt-auto pt-4">
                  <div className="h-2 rounded-full bg-surface-muted">
                    <div
                      className={cn("h-2 rounded-full bg-brand-500", ["w-full", "w-2/3", "w-1/3", "w-1/12"][index])}
                    />
                  </div>
                </div>
                {index < DEMO_SUPPORT_LEVELS.length - 1 ? (
                  <ChevronRight
                    aria-hidden="true"
                    className="absolute -right-4 top-1/2 hidden size-6 -translate-y-1/2 text-ink-faint lg:block"
                  />
                ) : null}
              </li>
            ))}
          </ol>
        </Container>
      </section>

      <section aria-labelledby="demo-exercises-title" className="py-14 sm:py-16">
        <Container>
          <SectionHeading id="demo-exercises-title" title={t.exercises.title} description={t.exercises.description} />
          <ul className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {EXERCISE_TYPES.map((type) => {
              const Icon = INSTRUCTION_ICONS[type.icon];
              return (
                <Card as="li" key={type.code} className="flex flex-col">
                  <div className="flex items-start justify-between gap-3">
                    <span className="flex size-12 items-center justify-center rounded-2xl bg-lagoon-50 text-lagoon-700">
                      <Icon aria-hidden="true" className="size-6" />
                    </span>
                    <span className="text-sm font-bold text-ink-faint">#{type.order}</span>
                  </div>
                  <h3 className="mt-4 text-lg font-bold leading-snug text-ink">{type.name}</h3>
                  <p className="mt-2 leading-relaxed text-ink-soft">{type.skill}</p>
                  <p className="mt-3 text-sm text-ink-soft">
                    <span className="font-semibold text-ink">{t.exercises.paperLabel}:</span> {type.paperEquivalent}
                  </p>
                  <div className="mt-auto flex flex-wrap gap-2 pt-4">
                    {type.primaryPaths.map((id) => (
                      <Badge key={id} tone={PATH_VISUALS[id].badgeTone}>
                        {pathName.get(id)}
                      </Badge>
                    ))}
                    <Badge tone="neutral">{t.exercises.plannedPhase}</Badge>
                  </div>
                </Card>
              );
            })}
          </ul>
          <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <ButtonLink href="/learn" variant="outline" className="sm:shrink-0">
              {t.links.learn}
              <ArrowRight aria-hidden="true" className="size-5" />
            </ButtonLink>
            <ButtonLink href="/" variant="ghost" className="sm:shrink-0">
              {t.links.home}
            </ButtonLink>
          </div>
        </Container>
      </section>
    </>
  );
}
