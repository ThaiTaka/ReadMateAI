import type { Metadata } from "next";
import { ArrowRight, ChevronRight } from "lucide-react";
import { INSTRUCTION_ICONS, PATH_VISUALS } from "@/components/learning/visuals";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { Notice } from "@/components/ui/notice";
import { SectionHeading } from "@/components/ui/section-heading";
import { DEMO_SUPPORT_LEVELS } from "@/features/demo/demo-data";
import { buildDemoPracticeData } from "@/features/demo/practice-data";
import { EXERCISE_TYPES } from "@/features/exercises/catalog";
import { LEARNING_PATHS } from "@/features/learning-paths/catalog";
import { cn } from "@/lib/cn";
import { vi } from "@/strings/vi";
import { DemoPractice } from "./demo-practice";

export const metadata: Metadata = {
  title: vi.demo.meta.title,
  description: vi.demo.meta.description,
};

const pathName = new Map(LEARNING_PATHS.map((path) => [path.id, path.name]));

/**
 * /demo — Bản chơi thử (GĐ4). Bài tập được sinh và kiểm tra Ở PHÍA MÁY CHỦ lúc build (trang tĩnh):
 * trình duyệt chỉ nhận các câu đã qua kiểm tra, không nhận kho tri thức; không lưu, không gửi dữ liệu.
 */
export default function DemoPage() {
  const t = vi.demo;
  const data = buildDemoPracticeData();

  return (
    <>
      <section aria-labelledby="demo-title" className="border-b border-line bg-surface">
        <Container className="py-10 sm:py-14">
          <div className="flex flex-wrap gap-2">
            <Badge tone="sun">{t.eyebrow}</Badge>
            <Badge tone="neutral">{vi.status.demoData}</Badge>
          </div>
          <h1 id="demo-title" className="mt-4 max-w-3xl text-4xl font-extrabold leading-tight text-ink sm:text-5xl">
            {t.title}
          </h1>
          <p className="mt-4 max-w-3xl text-lg leading-relaxed text-ink-soft">{t.intro}</p>
          <Notice tone="progress" title={t.notice.title} className="mt-6 max-w-3xl">
            <ul className="list-disc space-y-1 pl-5">
              {t.notice.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </Notice>
        </Container>
      </section>

      <section aria-labelledby="demo-practice-title" className="py-10 sm:py-14">
        <Container>
          <h2 id="demo-practice-title" className="sr-only">
            {t.practice.sectionTitle}
          </h2>
          <DemoPractice data={data} />
        </Container>
      </section>

      <section aria-labelledby="demo-support-title" className="bg-surface py-12 sm:py-14">
        <Container>
          <SectionHeading
            id="demo-support-title"
            title={t.about.supportTitle}
            description={t.about.supportDescription}
          />
          <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {DEMO_SUPPORT_LEVELS.map((level, index) => (
              <li key={level.code} className="relative flex flex-col rounded-card border border-line bg-canvas p-5">
                <div className="flex items-center gap-3">
                  <span className="rounded-full bg-ink px-3 py-1 text-sm font-extrabold text-white">{level.code}</span>
                  <h3 className="font-bold text-ink">{level.name}</h3>
                </div>
                <p className="mt-3 leading-relaxed text-ink-soft">{level.description}</p>
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

      <section aria-labelledby="demo-exercises-title" className="py-12 sm:py-14">
        <Container>
          <SectionHeading
            id="demo-exercises-title"
            title={t.about.exercisesTitle}
            description={t.about.exercisesDescription}
          />
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
                    <span className="font-semibold text-ink">{t.about.paperLabel}:</span> {type.paperEquivalent}
                  </p>
                  <div className="mt-auto flex flex-wrap gap-2 pt-4">
                    {type.primaryPaths.map((id) => (
                      <Badge key={id} tone={PATH_VISUALS[id].badgeTone}>
                        {pathName.get(id)}
                      </Badge>
                    ))}
                    <Badge tone="brand">{t.about.playable}</Badge>
                  </div>
                </Card>
              );
            })}
          </ul>
          <div className={cn("mt-10 flex flex-col gap-3 sm:flex-row sm:flex-wrap")}>
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
