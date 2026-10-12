import type { Metadata } from "next";
import { ChartLine, CircleCheck, School } from "lucide-react";
import { INSTRUCTION_ICONS } from "@/components/learning/visuals";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/loading-state";
import { Notice } from "@/components/ui/notice";
import { SectionHeading } from "@/components/ui/section-heading";
import { EXERCISE_TYPES } from "@/features/exercises/catalog";
import { vi } from "@/strings/vi";

export const metadata: Metadata = {
  title: vi.teacher.meta.title,
  description: vi.teacher.meta.description,
};

/** Khung bảng điều khiển giáo viên — chưa có dữ liệu thật, mọi thao tác đều bị khóa. */
export default function TeacherPage() {
  const t = vi.teacher;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
      <section id="tong-quan" aria-labelledby="teacher-title">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="sun">{vi.status.inDevelopment}</Badge>
        </div>
        <h1 id="teacher-title" className="mt-3 text-3xl font-extrabold leading-tight text-ink sm:text-4xl">
          {t.title}
        </h1>
        <p className="mt-2 text-lg text-ink-soft">{t.subtitle}</p>
        <Notice tone="progress" title={t.notice.title} className="mt-6">
          {t.notice.text}
        </Notice>

        <ul className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {t.stats.map((stat) => (
            <Card as="li" key={stat.label} className="p-5">
              <p className="text-sm font-semibold text-ink-soft">{stat.label}</p>
              <p aria-hidden="true" className="mt-2 text-3xl font-extrabold text-ink-faint">
                —
              </p>
              <p className="mt-1 text-xs text-ink-faint">{vi.status.noData}</p>
            </Card>
          ))}
        </ul>
      </section>

      <section id="lop-hoc" aria-labelledby="classes-title" className="mt-14">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <SectionHeading size="md" id="classes-title" title={t.classes.title} description={t.classes.description} />
          <Badge tone="neutral">{vi.status.planned}</Badge>
        </div>
        <EmptyState
          className="mt-6"
          icon={<School className="size-8" />}
          title={t.classes.emptyTitle}
          description={t.classes.emptyText}
          action={
            <Button disabled variant="outline">
              {t.classes.action} ({vi.status.comingSoon.toLowerCase()})
            </Button>
          }
        />
      </section>

      <section id="ngan-hang-bai-tap" aria-labelledby="bank-title" className="mt-14">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <SectionHeading size="md" id="bank-title" title={t.bank.title} description={t.bank.description} />
          <Badge tone="neutral">{vi.status.planned}</Badge>
        </div>
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {EXERCISE_TYPES.map((type) => {
            const Icon = INSTRUCTION_ICONS[type.icon];
            return (
              <Card as="li" key={type.code} variant="placeholder" className="flex items-start gap-4 p-5">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-surface-muted text-ink-soft">
                  <Icon aria-hidden="true" className="size-5" />
                </span>
                <div className="min-w-0">
                  <h3 className="font-bold leading-snug text-ink">{type.name}</h3>
                  <p className="mt-1 text-sm text-ink-faint">{vi.status.comingSoon}</p>
                </div>
              </Card>
            );
          })}
        </ul>
      </section>

      <section id="tien-bo" aria-labelledby="progress-title" className="mt-14 pb-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <SectionHeading size="md" id="progress-title" title={t.progress.title} description={t.progress.description} />
          <Badge tone="neutral">{vi.status.planned}</Badge>
        </div>
        <div className="mt-6 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
          <Card variant="placeholder" className="flex flex-col">
            <div className="flex items-center gap-2 font-semibold text-ink-soft">
              <ChartLine aria-hidden="true" className="size-5" />
              {t.progress.chartLabel}
            </div>
            <div className="mt-6 flex h-40 items-end gap-3" aria-hidden="true">
              {["h-1/3", "h-2/3", "h-1/2", "h-4/5", "h-2/5", "h-3/5"].map((height) => (
                <Skeleton key={height} className={`w-full ${height}`} />
              ))}
            </div>
          </Card>
          <Card>
            <ul className="space-y-3">
              {t.progress.metrics.map((metric) => (
                <li key={metric} className="flex items-start gap-3 text-ink-soft">
                  <CircleCheck aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-ink-faint" />
                  <span>{metric}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </section>
    </div>
  );
}
