import type { Metadata } from "next";
import { ArrowRight, CircleCheck, ClipboardCheck, Gauge, House, School, ShieldCheck, Volume2 } from "lucide-react";
import { SyllableBuilderArt } from "@/components/illustrations/syllable-builder-art";
import { PATH_VISUALS } from "@/components/learning/visuals";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { SectionHeading } from "@/components/ui/section-heading";
import { LEARNING_PATHS } from "@/features/learning-paths/catalog";
import { cn } from "@/lib/cn";
import { vi } from "@/strings/vi";

export const metadata: Metadata = {
  title: vi.home.meta.title,
  description: vi.home.meta.description,
};

const MISSION_ICONS = [Gauge, Volume2, ClipboardCheck, ShieldCheck] as const;

export default function HomePage() {
  const t = vi.home;

  return (
    <>
      {/* Hero */}
      <section aria-labelledby="hero-title" className="overflow-hidden">
        <Container className="grid items-center gap-12 py-12 sm:py-16 lg:grid-cols-2 lg:py-20">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="brand">{vi.brand.name}</Badge>
              <Badge tone="sun">{vi.brand.previewBadge}</Badge>
            </div>
            <p className="mt-5 font-semibold text-ink-faint">{t.hero.eyebrow}</p>
            <h1 id="hero-title" className="mt-2 text-display font-extrabold text-ink">
              {vi.brand.slogan}
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-ink-soft">{t.hero.description}</p>
            {/* Nút không co lại; thiếu chỗ thì xuống hàng thay vì bẻ chữ trong nút. */}
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <ButtonLink href="/demo" size="lg" className="sm:shrink-0">
                {t.hero.primaryCta}
                <ArrowRight aria-hidden="true" className="size-5" />
              </ButtonLink>
              <ButtonLink href="/teacher" size="lg" variant="outline" className="sm:shrink-0">
                {t.hero.secondaryCta}
              </ButtonLink>
            </div>
            <p className="mt-6 max-w-xl text-sm leading-relaxed text-ink-faint">{t.hero.statusNote}</p>
          </div>
          <SyllableBuilderArt />
        </Container>
      </section>

      {/* Mục tiêu */}
      <section aria-labelledby="mission-title" className="bg-surface py-16 sm:py-20">
        <Container>
          <SectionHeading
            id="mission-title"
            eyebrow={t.mission.eyebrow}
            title={t.mission.title}
            description={t.mission.description}
          />
          <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {t.mission.points.map((point, index) => {
              const Icon = MISSION_ICONS[index] ?? CircleCheck;
              return (
                <Card as="li" key={point.title} className="flex flex-col gap-3">
                  <span className="flex size-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">
                    <Icon aria-hidden="true" className="size-6" />
                  </span>
                  <h3 className="text-lg font-bold leading-snug text-ink">{point.title}</h3>
                  <p className="leading-relaxed text-ink-soft">{point.text}</p>
                </Card>
              );
            })}
          </ul>
        </Container>
      </section>

      {/* Ba hướng hỗ trợ */}
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
                <li key={path.id} className={cn("flex flex-col rounded-card border p-6", visual.surface)}>
                  <span className={cn("flex size-14 items-center justify-center rounded-2xl", visual.iconBubble)}>
                    <visual.Icon aria-hidden="true" className="size-7" />
                  </span>
                  <h3 className="mt-5 text-2xl font-extrabold text-ink">{path.name}</h3>
                  <p className={cn("mt-1 font-semibold", visual.accentText)}>{path.tagline}</p>
                  <p className="mt-3 leading-relaxed text-ink-soft">{path.description}</p>
                  <p className="mt-5 text-sm font-bold uppercase tracking-wider text-ink-faint">{t.paths.focusLabel}</p>
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

      {/* Quy trình */}
      <section aria-labelledby="process-title" className="bg-surface py-16 sm:py-20">
        <Container>
          <SectionHeading id="process-title" eyebrow={t.process.eyebrow} title={t.process.title} />
          <ol className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {t.process.steps.map((step, index) => {
              const atSchool = index === t.process.steps.length - 1;
              return (
                <li
                  key={step.title}
                  className={cn(
                    "relative flex flex-col rounded-card border p-6",
                    atSchool ? "border-sun-200 bg-sun-50" : "border-line bg-canvas",
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex size-10 items-center justify-center rounded-full bg-ink text-lg font-extrabold text-white">
                      {index + 1}
                    </span>
                    <Badge
                      tone={atSchool ? "sun" : "lagoon"}
                      icon={
                        atSchool ? (
                          <School aria-hidden="true" className="size-3.5" />
                        ) : (
                          <House aria-hidden="true" className="size-3.5" />
                        )
                      }
                    >
                      {atSchool ? t.process.atSchool : t.process.atHome}
                    </Badge>
                  </div>
                  <h3 className="mt-4 text-lg font-bold text-ink">{step.title}</h3>
                  <p className="mt-2 leading-relaxed text-ink-soft">{step.text}</p>
                </li>
              );
            })}
          </ol>
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
          <ul className="mt-10 grid gap-5 sm:grid-cols-2">
            {t.teachers.features.map((feature) => (
              <Card as="li" key={feature.title} className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-lg font-bold text-ink">{feature.title}</h3>
                  <Badge tone="neutral">{vi.status.planned}</Badge>
                </div>
                <p className="leading-relaxed text-ink-soft">{feature.text}</p>
              </Card>
            ))}
          </ul>
        </Container>
      </section>

      {/* An toàn dữ liệu */}
      <section aria-labelledby="safety-title" className="pb-16 sm:pb-20">
        <Container>
          <Card variant="tinted" className="grid gap-8 p-8 sm:p-10 lg:grid-cols-[1fr_1.4fr]">
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

      {/* Lời mời xem demo */}
      <section aria-labelledby="cta-title" className="bg-brand-700 py-14 text-white">
        <Container className="flex flex-col items-start gap-6 md:flex-row md:items-center md:justify-between">
          <div className="max-w-2xl">
            <h2 id="cta-title" className="text-3xl font-extrabold leading-tight">
              {t.finalCta.title}
            </h2>
            <p className="mt-3 text-lg leading-relaxed text-brand-50">{t.finalCta.text}</p>
          </div>
          <ButtonLink href="/demo" variant="secondary" size="lg" className="shrink-0">
            {t.finalCta.button}
            <ArrowRight aria-hidden="true" className="size-5" />
          </ButtonLink>
        </Container>
      </section>
    </>
  );
}
