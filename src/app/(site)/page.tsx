import type { Metadata } from "next";
import {
  ArrowRight,
  BookOpenCheck,
  CircleCheck,
  Crown,
  KeyRound,
  LineChart,
  ListChecks,
  RotateCcw,
  ShieldCheck,
  Star,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import { AdventureLink } from "@/components/adventure/adventure-button";
import { GuideOwl, HeroKid } from "@/components/art/characters";
import { HeroLandscape } from "@/components/art/hero-landscape";
import { GAME_SCENES } from "@/components/art/scenes";
import { PATH_VISUALS } from "@/components/learning/visuals";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { SectionHeading } from "@/components/ui/section-heading";
import { GAME_WORLDS } from "@/features/game-world/catalog";
import { LEARNING_PATHS } from "@/features/learning-paths/catalog";
import { cn } from "@/lib/cn";
import { vi } from "@/strings/vi";

export const metadata: Metadata = {
  title: vi.home.meta.title,
  description: vi.home.meta.description,
};

const STEP_ICONS: readonly LucideIcon[] = [BookOpenCheck, Star, KeyRound];
const STEP_TONES = [
  "from-lagoon-100 to-lagoon-50 text-lagoon-700",
  "from-sun-100 to-sun-50 text-sun-700",
  "from-magic-100 to-magic-50 text-magic-700",
] as const;
const TEACHER_ICONS: readonly LucideIcon[] = [ListChecks, LineChart, Trophy, Crown, RotateCcw];

export default function HomePage() {
  const t = vi.home;

  return (
    <>
      {/* Hero */}
      <section
        aria-labelledby="hero-title"
        className="relative overflow-hidden bg-linear-to-b from-magic-50 via-canvas to-canvas"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-32 -left-32 size-96 rounded-full bg-[radial-gradient(circle,var(--color-jade-100),transparent_70%)]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-32 -right-32 size-96 rounded-full bg-[radial-gradient(circle,var(--color-sun-100),transparent_70%)]"
        />
        <Container className="relative grid items-center gap-10 py-10 sm:py-14 lg:grid-cols-[1.05fr_1fr] lg:py-20">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="brand">{vi.brand.name}</Badge>
              <Badge tone="sun">{vi.brand.previewBadge}</Badge>
            </div>
            <p className="mt-5 font-semibold text-ink-faint">{t.hero.eyebrow}</p>
            <h1 id="hero-title" className="mt-2 text-display font-extrabold text-ink">
              <span className="block text-2xl font-extrabold text-jade-700 sm:text-3xl">{vi.brand.name} –</span>{" "}
              {vi.brand.slogan}
            </h1>
            <p className="mt-4 text-xl font-bold leading-snug text-magic-700 sm:text-2xl">{vi.brand.tagline}</p>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-ink-soft">{t.hero.description}</p>
            <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:flex-wrap">
              <AdventureLink href="/learn" tone="jade" className="sm:shrink-0">
                {t.hero.primaryCta}
                <ArrowRight aria-hidden="true" className="size-6" />
              </AdventureLink>
              <AdventureLink href="/demo" tone="sun" className="sm:shrink-0">
                <Star aria-hidden="true" className="size-6" />
                {t.hero.secondaryCta}
              </AdventureLink>
            </div>
            <p className="mt-6 max-w-xl text-sm leading-relaxed text-ink-faint">{t.hero.statusNote}</p>
          </div>

          {/* Khung cảnh thế giới kỳ diệu + nhân vật */}
          <figure className="relative mx-auto w-full max-w-xl">
            <div className="relative aspect-[6/5] overflow-hidden rounded-world shadow-world ring-4 ring-white">
              <HeroLandscape title={t.hero.artLabel} />
              <div className="absolute bottom-[4%] left-[6%] w-[36%]">
                <HeroKid />
              </div>
              <div className="absolute right-[6%] bottom-[8%] w-[28%]">
                <GuideOwl />
              </div>
              <p
                aria-hidden="true"
                className="absolute top-[40%] left-[30%] max-w-[46%] rounded-2xl rounded-bl-sm bg-surface px-3 py-2 text-sm font-extrabold text-ink shadow-lift animate-float sm:text-base"
              >
                {t.hero.bubble}
              </p>
            </div>
            <figcaption className="sr-only">{t.hero.artLabel}</figcaption>
          </figure>
        </Container>
      </section>

      {/* Ba bước */}
      <section aria-labelledby="steps-title" className="bg-surface py-16 sm:py-20">
        <Container>
          <SectionHeading id="steps-title" eyebrow={t.steps.eyebrow} title={t.steps.title} />
          <ol className="mt-10 grid gap-5 md:grid-cols-3">
            {t.steps.items.map((step, index) => {
              const Icon = STEP_ICONS[index] ?? CircleCheck;
              return (
                <li
                  key={step.title}
                  className="relative flex flex-col rounded-world border border-line bg-canvas p-6 shadow-soft"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex size-10 items-center justify-center rounded-full bg-ink text-lg font-extrabold text-white">
                      {index + 1}
                    </span>
                    <span
                      className={cn(
                        "flex size-12 items-center justify-center rounded-2xl bg-linear-to-br",
                        STEP_TONES[index] ?? STEP_TONES[0],
                      )}
                    >
                      <Icon aria-hidden="true" className="size-6" />
                    </span>
                  </div>
                  <h3 className="mt-4 text-xl font-extrabold text-ink">{step.title}</h3>
                  <p className="mt-2 leading-relaxed text-ink-soft">{step.text}</p>
                </li>
              );
            })}
          </ol>
          <p className="mt-6 text-sm text-ink-faint">{t.steps.note}</p>
        </Container>
      </section>

      {/* Ba lộ trình */}
      <section aria-labelledby="paths-title" className="py-16 sm:py-20">
        <Container>
          <SectionHeading
            id="paths-title"
            eyebrow={t.paths.eyebrow}
            title={t.paths.title}
            description={t.paths.description}
          />
          <ul className="mt-10 grid gap-6 md:grid-cols-3">
            {LEARNING_PATHS.map((path) => {
              const visual = PATH_VISUALS[path.id];
              return (
                <li key={path.id} className={cn("flex flex-col rounded-world border p-6", visual.surface)}>
                  <span className={cn("flex size-14 items-center justify-center rounded-2xl", visual.iconBubble)}>
                    <visual.Icon aria-hidden="true" className="size-7" />
                  </span>
                  <h3 className="mt-5 text-2xl font-extrabold text-ink">{path.name}</h3>
                  <p className={cn("mt-1 font-semibold", visual.accentText)}>{path.tagline}</p>
                  <p className="mt-3 leading-relaxed text-ink-soft">{path.description}</p>
                  <p className="mt-5 text-sm font-bold tracking-wider text-ink-faint uppercase">{t.paths.focusLabel}</p>
                  <ul className="mt-2 space-y-2">
                    {path.focus.map((item) => (
                      <li key={item} className="flex items-start gap-2 text-ink">
                        <CircleCheck aria-hidden="true" className={cn("mt-0.5 size-5 shrink-0", visual.accentText)} />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </li>
              );
            })}
          </ul>
        </Container>
      </section>

      {/* Game World */}
      <section aria-labelledby="games-title" className="relative overflow-hidden bg-deep-800 py-16 text-white sm:py-20">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgb(46_190_167/0.35),transparent_45%),radial-gradient(circle_at_85%_80%,rgb(132_88_242/0.35),transparent_45%)]"
        />
        <Container className="relative">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-sm font-extrabold tracking-wider text-sun-200 uppercase">✦ {t.games.eyebrow}</p>
              <h2 id="games-title" className="mt-2 text-3xl font-extrabold leading-tight sm:text-4xl">
                {t.games.title}
              </h2>
              <p className="mt-3 text-lg leading-relaxed text-jade-50">{t.games.description}</p>
            </div>
            <AdventureLink href="/learn" tone="sun" size="md" className="shrink-0 self-start lg:self-auto">
              {t.games.cta}
              <ArrowRight aria-hidden="true" className="size-5" />
            </AdventureLink>
          </div>
          <ul className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {GAME_WORLDS.map((game) => {
              const Scene = GAME_SCENES[game.key];
              return (
                <li
                  key={game.key}
                  className="group flex flex-col overflow-hidden rounded-world bg-surface text-ink shadow-world transition-transform duration-300 hover:-translate-y-1"
                >
                  <div className="aspect-[16/10] overflow-hidden">
                    <div className="size-full transition-transform duration-500 group-hover:scale-105">
                      <Scene />
                    </div>
                  </div>
                  <div className="flex flex-1 flex-col gap-2 p-5">
                    <h3 className="text-xl font-extrabold leading-snug">{game.name}</h3>
                    <p className="text-sm leading-relaxed text-ink-soft">{game.tagline}</p>
                    <div className="mt-auto flex flex-wrap gap-2 pt-2">
                      <span className={cn("rounded-full px-3 py-1 text-xs font-extrabold", game.accent.chip)}>
                        {t.games.threshold.replace("{n}", String(game.minBalance))}
                      </span>
                      <Badge tone="neutral">{t.games.status}</Badge>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </Container>
      </section>

      {/* Dành cho giáo viên */}
      <section aria-labelledby="teachers-title" className="py-16 sm:py-20">
        <Container>
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <SectionHeading
              id="teachers-title"
              eyebrow={t.teachers.eyebrow}
              title={t.teachers.title}
              description={t.teachers.description}
            />
            <ButtonLink href="/teacher" variant="outline" className="shrink-0 self-start lg:self-auto">
              {t.teachers.cta}
              <ArrowRight aria-hidden="true" className="size-5" />
            </ButtonLink>
          </div>
          <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {t.teachers.features.map((feature, index) => {
              const Icon = TEACHER_ICONS[index] ?? CircleCheck;
              return (
                <Card as="li" key={feature.title} className="flex flex-col gap-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="flex size-11 items-center justify-center rounded-2xl bg-jade-50 text-jade-700">
                      <Icon aria-hidden="true" className="size-6" />
                    </span>
                    <Badge tone="neutral">{vi.status.planned}</Badge>
                  </div>
                  <h3 className="text-lg font-bold text-ink">{feature.title}</h3>
                  <p className="leading-relaxed text-ink-soft">{feature.text}</p>
                </Card>
              );
            })}
          </ul>
        </Container>
      </section>

      {/* An toàn dữ liệu */}
      <section aria-labelledby="safety-title" className="pb-16 sm:pb-20">
        <Container>
          <Card variant="tinted" className="grid gap-8 rounded-world p-8 sm:p-10 lg:grid-cols-[1fr_1.4fr]">
            <div>
              <span className="flex size-14 items-center justify-center rounded-2xl bg-brand-600 text-white">
                <ShieldCheck aria-hidden="true" className="size-7" />
              </span>
              <SectionHeading
                id="safety-title"
                eyebrow={t.safety.eyebrow}
                title={t.safety.title}
                description={t.safety.description}
                className="mt-5"
              />
            </div>
            <ul className="space-y-4 self-center">
              {t.safety.items.map((item) => (
                <li key={item} className="flex items-start gap-3 text-lg leading-relaxed text-ink">
                  <CircleCheck aria-hidden="true" className="mt-1 size-6 shrink-0 text-brand-700" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </Card>
        </Container>
      </section>

      {/* Lời mời chơi thử */}
      <section aria-labelledby="cta-title" className="bg-linear-to-r from-jade-700 to-brand-800 py-14 text-white">
        <Container className="flex flex-col items-start gap-6 md:flex-row md:items-center md:justify-between">
          <div className="max-w-2xl">
            <h2 id="cta-title" className="text-3xl font-extrabold leading-tight">
              {t.finalCta.title}
            </h2>
            <p className="mt-3 text-lg leading-relaxed text-brand-50">{t.finalCta.text}</p>
          </div>
          <AdventureLink href="/demo" tone="sun" className="shrink-0">
            {t.finalCta.button}
            <ArrowRight aria-hidden="true" className="size-6" />
          </AdventureLink>
        </Container>
      </section>
    </>
  );
}
