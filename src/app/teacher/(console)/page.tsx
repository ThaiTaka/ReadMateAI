import type { Metadata } from "next";
import { ChartLine, CircleCheck, School, ShieldCheck } from "lucide-react";
import { CharacterPreview } from "@/components/adventure/character-preview";
import { KidAvatar } from "@/components/art/avatars";
import { FriendlyMonster, GuideOwl, HeroKid } from "@/components/art/characters";
import { HonorPodium, TreasureChest } from "@/components/art/treasure";
import { INSTRUCTION_ICONS } from "@/components/learning/visuals";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ComingSoonState } from "@/components/ui/coming-soon-state";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/loading-state";
import { Notice } from "@/components/ui/notice";
import { SectionHeading } from "@/components/ui/section-heading";
import { AVATAR_OPTIONS } from "@/features/avatars/catalog";
import { EXERCISE_TYPES } from "@/features/exercises/catalog";
import { vi } from "@/strings/vi";

export const metadata: Metadata = {
  title: vi.teacher.meta.title,
  description: vi.teacher.meta.description,
};

function SectionStatus() {
  return <Badge tone="neutral">{vi.status.comingSoonDev}</Badge>;
}

/**
 * Bảng điều khiển giáo viên (đã đăng nhập — layout và proxy kiểm tra phiên). Lớp học/học sinh đã hoạt động ở
 * /teacher/classes; các phần còn lại là giới thiệu chức năng sắp có. KHÔNG có nút đặt lại điểm hay bật bảng xếp
 * hạng (R05–R06; cờ bảng xếp hạng còn bị CSDL chặn cho tới khi có chấp thuận).
 */
export default function TeacherPage() {
  const t = vi.teacher;
  const r = t.review;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
      <section id="tong-quan" aria-labelledby="teacher-title" className="scroll-mt-6">
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

      <section id="lop-hoc" aria-labelledby="classes-title" className="mt-14 scroll-mt-6">
        <SectionHeading size="md" id="classes-title" title={t.classes.title} description={t.classes.description} />
        <EmptyState
          className="mt-6"
          icon={<School className="size-8" />}
          title={t.classes.emptyTitle}
          description={t.classes.emptyText}
          action={<ButtonLink href="/teacher/classes">{t.classes.action}</ButtonLink>}
        />
      </section>

      <section id="hoc-sinh" aria-labelledby="students-title" className="mt-14 scroll-mt-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <SectionHeading size="md" id="students-title" title={t.students.title} description={t.students.description} />
          <SectionStatus />
        </div>
        <div className="mt-6 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
          <Card variant="placeholder" className="flex flex-col">
            <div className="flex items-center gap-2 font-semibold text-ink-soft">
              <ChartLine aria-hidden="true" className="size-5" />
              {t.students.chartLabel}
            </div>
            <div className="mt-6 flex h-40 items-end gap-3" aria-hidden="true">
              {["h-1/3", "h-2/3", "h-1/2", "h-4/5", "h-2/5", "h-3/5"].map((height) => (
                <Skeleton key={height} className={`w-full ${height}`} />
              ))}
            </div>
          </Card>
          <Card>
            <ul className="space-y-3">
              {t.students.metrics.map((metric) => (
                <li key={metric} className="flex items-start gap-3 text-ink-soft">
                  <CircleCheck aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-ink-faint" />
                  <span>{metric}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </section>

      <section id="ngan-hang-bai-tap" aria-labelledby="bank-title" className="mt-14 scroll-mt-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <SectionHeading size="md" id="bank-title" title={t.bank.title} description={t.bank.description} />
          <SectionStatus />
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

      <section id="duyet-hoc-lieu" aria-labelledby="review-title" className="mt-14 scroll-mt-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <SectionHeading size="md" id="review-title" title={r.title} description={r.description} />
          <SectionStatus />
        </div>
        <div className="mt-6 rounded-world border border-line bg-surface p-5 shadow-soft sm:p-6">
          <h3 className="text-xl font-extrabold text-ink">{r.galleryTitle}</h3>
          <p className="mt-1 leading-relaxed text-ink-soft">{r.galleryText}</p>
          <ul className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <li>
              <CharacterPreview art={<HeroKid />} name={r.names.hero} role={r.roles.hero} tone="sun" />
            </li>
            <li>
              <CharacterPreview art={<GuideOwl />} name={r.names.guide} role={r.roles.guide} tone="jade" />
            </li>
            <li>
              <CharacterPreview art={<FriendlyMonster />} name={r.names.monster} role={r.roles.monster} tone="magic" />
            </li>
            <li>
              <CharacterPreview art={<TreasureChest />} name={r.names.treasure} role={r.roles.treasure} tone="lagoon" />
            </li>
          </ul>
          <ul className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {AVATAR_OPTIONS.map((option) => (
              <li key={option.key}>
                <CharacterPreview
                  art={<KidAvatar avatar={option.key} />}
                  name={option.label}
                  role={r.roles.avatar}
                  note={option.description}
                  tone="sun"
                />
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section id="bang-diem" aria-labelledby="scoreboard-title" className="mt-14 scroll-mt-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <SectionHeading
            size="md"
            id="scoreboard-title"
            title={t.scoreboard.title}
            description={t.scoreboard.description}
          />
          <SectionStatus />
        </div>
        <ComingSoonState
          className="mt-6"
          title={t.scoreboard.title}
          description={
            <ul className="space-y-2">
              {t.scoreboard.points.map((point) => (
                <li key={point} className="flex items-start gap-2">
                  <ShieldCheck aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-jade-700" />
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          }
        />
      </section>

      <section id="vinh-danh" aria-labelledby="honors-title" className="mt-14 scroll-mt-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <SectionHeading size="md" id="honors-title" title={t.honors.title} description={t.honors.description} />
          <SectionStatus />
        </div>
        <ComingSoonState
          className="mt-6"
          title={t.honors.title}
          description={t.honors.description}
          art={
            <div className="w-40">
              <HonorPodium title={t.honors.art} />
            </div>
          }
        />
      </section>

      <section id="mua-thi-dua" aria-labelledby="seasons-title" className="mt-14 scroll-mt-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <SectionHeading size="md" id="seasons-title" title={t.seasons.title} description={t.seasons.description} />
          <SectionStatus />
        </div>
        <ComingSoonState className="mt-6" title={t.seasons.title} description={t.seasons.resetNote} />
      </section>

      <section id="cai-dat" aria-labelledby="settings-title" className="mt-14 scroll-mt-6 pb-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <SectionHeading size="md" id="settings-title" title={t.settings.title} description={t.settings.description} />
          <SectionStatus />
        </div>
      </section>
    </div>
  );
}
