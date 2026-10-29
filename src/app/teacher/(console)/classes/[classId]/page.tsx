import type { Metadata, Route } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft, BookOpenCheck, History, Lock, Trophy, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { LoadingState } from "@/components/ui/loading-state";
import { Notice } from "@/components/ui/notice";
import { requireTeacher } from "@/server/auth/teacher";
import { getClassDetail, listClassAudit, listCurriculumSeries } from "@/server/teacher/queries";
import { vi } from "@/strings/vi";
import { ConfirmCurriculumForm, CurriculumForm, RenameClassForm } from "./class-forms";

export const metadata: Metadata = { title: vi.classPage.overview, robots: { index: false, follow: false } };

const dateTime = new Intl.DateTimeFormat("vi-VN", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "Asia/Ho_Chi_Minh",
});

export default function ClassPage({ params }: PageProps<"/teacher/classes/[classId]">) {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
      <ButtonLink href="/teacher/classes" variant="ghost" size="sm">
        <ArrowLeft aria-hidden="true" className="size-4" />
        {vi.classPage.back}
      </ButtonLink>
      <Suspense fallback={<LoadingState className="mt-8" />}>
        <ClassOverview params={params} />
      </Suspense>
    </div>
  );
}

async function ClassOverview({ params }: Pick<PageProps<"/teacher/classes/[classId]">, "params">) {
  const { classId } = await params;
  const t = vi.classPage;
  const teacher = await requireTeacher();
  // RLS: lớp không thuộc GV → không có dòng → 404 (không phân biệt "không tồn tại" với "không có quyền").
  const cls = await getClassDetail(teacher, classId);
  if (!cls) notFound();
  const isOwner = cls.role === "owner";
  const [series, audit] = await Promise.all([
    listCurriculumSeries(teacher),
    isOwner ? listClassAudit(teacher, cls.id) : Promise.resolve([]),
  ]);
  const currentSeries = series.find((entry) => entry.id === cls.curriculumSeriesId) ?? null;
  const currentLesson = currentSeries?.lessons.find((lesson) => lesson.id === cls.currentLessonId) ?? null;
  const canConfirm =
    currentSeries?.seriesKind === "textbook" && currentSeries.reviewStatus === "approved" && currentLesson;

  return (
    <>
      <header className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-ink-soft">{t.overview}</p>
          <h1 className="text-3xl font-extrabold leading-tight text-ink sm:text-4xl">{cls.name}</h1>
        </div>
        <ButtonLink href={`/teacher/classes/${cls.id}/students` as Route}>
          <Users aria-hidden="true" className="size-5" />
          {t.studentsLink}
        </ButtonLink>
      </header>

      <dl className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          [t.facts.schoolYear, cls.schoolYear],
          [t.facts.status, cls.status === "archived" ? vi.classesPage.archived : t.facts.active],
          [t.facts.students, String(cls.studentCount)],
          [
            t.facts.season,
            cls.season
              ? t.facts.seasonValue
                  .replace("{no}", String(cls.season.seqNo))
                  .replace("{rules}", cls.season.rulesVersion)
              : t.facts.noSeason,
          ],
        ].map(([label, value]) => (
          <Card key={label} className="p-4">
            <dt className="text-sm font-semibold text-ink-soft">{label}</dt>
            <dd className="mt-1 font-extrabold text-ink">{value}</dd>
          </Card>
        ))}
      </dl>

      <Card className="mt-8 p-5 sm:p-6">
        {isOwner ? (
          <RenameClassForm classId={cls.id} name={cls.name} />
        ) : (
          <p className="text-ink-soft">{t.rename.ownerOnly}</p>
        )}
      </Card>

      <section aria-labelledby="curriculum-title" className="mt-10">
        <h2 id="curriculum-title" className="flex items-center gap-2 text-2xl font-extrabold text-ink">
          <BookOpenCheck aria-hidden="true" className="size-6 text-brand-700" />
          {t.curriculum.title}
        </h2>
        <p className="mt-2 text-ink-soft">{t.curriculum.intro}</p>
        <Card className="mt-4 space-y-5 p-5 sm:p-6">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={cls.curriculumStatus === "confirmed" ? "brand" : "sun"}>
              {cls.curriculumStatus === "confirmed" ? t.curriculum.confirmed : t.curriculum.unconfirmed}
            </Badge>
            {currentSeries ? <span className="font-semibold text-ink">{currentSeries.title}</span> : null}
            {currentLesson ? (
              <span className="text-ink-soft">
                · {currentLesson.code} — {currentLesson.title}
              </span>
            ) : null}
          </div>
          {cls.curriculumStatus !== "confirmed" ? (
            <Notice tone="progress" title={t.curriculum.unconfirmed}>
              {t.curriculum.pendingNote}
            </Notice>
          ) : null}
          {currentSeries?.seriesKind === "illustrative" ? (
            <p className="text-sm font-semibold text-sun-800">{t.curriculum.illustrativeNote}</p>
          ) : null}
          {currentLesson && currentLesson.introduces.length > 0 ? (
            <p className="text-sm text-ink-soft">
              {t.curriculum.units}: <span className="font-reading text-ink">{currentLesson.introduces.join(", ")}</span>
            </p>
          ) : null}
          {series.length === 0 ? (
            <p className="text-ink-soft">{t.curriculum.noSeriesSynced}</p>
          ) : isOwner ? (
            <CurriculumForm
              classId={cls.id}
              series={series}
              seriesId={cls.curriculumSeriesId}
              lessonId={cls.currentLessonId}
            />
          ) : null}
          {cls.curriculumStatus !== "confirmed" ? (
            <div className="border-t border-line pt-4">
              {isOwner && canConfirm ? (
                <ConfirmCurriculumForm classId={cls.id} />
              ) : (
                <>
                  <Button type="button" variant="outline" disabled aria-describedby="confirm-blocked">
                    <Lock aria-hidden="true" className="size-4" />
                    {t.curriculum.confirm}
                  </Button>
                  <p id="confirm-blocked" className="mt-2 text-sm text-ink-soft">
                    {t.curriculum.confirmBlocked}
                  </p>
                </>
              )}
            </div>
          ) : null}
        </Card>
      </section>

      <section aria-labelledby="settings-title" className="mt-10">
        <h2 id="settings-title" className="flex items-center gap-2 text-2xl font-extrabold text-ink">
          <Trophy aria-hidden="true" className="size-6 text-sun-700" />
          {t.settings.title}
        </h2>
        <Card className="mt-4 space-y-3 p-5 sm:p-6">
          <p className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-semibold text-ink">{t.settings.leaderboard}</span>
            <Badge
              tone={cls.leaderboardEnabled ? "brand" : "neutral"}
              icon={cls.leaderboardEnabled ? undefined : <Lock className="size-3.5" />}
            >
              {cls.leaderboardEnabled ? vi.leaderboard.teacher.status.on : t.settings.off}
            </Badge>
          </p>
          <p className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-semibold text-ink">{t.settings.honors}</span>
            <Badge tone="neutral" icon={<Lock className="size-3.5" />}>
              {cls.honorsEnabled ? vi.status.inDevelopment : t.settings.off}
            </Badge>
          </p>
          <p className="text-sm text-ink-soft">{t.settings.lockedNote}</p>
          <ButtonLink href={`/teacher/classes/${cls.id}/leaderboard` as Route} variant="outline">
            <Trophy aria-hidden="true" className="size-5" />
            {t.settings.open}
          </ButtonLink>
        </Card>
      </section>

      {isOwner ? (
        <section aria-labelledby="audit-title" className="mt-10">
          <h2 id="audit-title" className="flex items-center gap-2 text-2xl font-extrabold text-ink">
            <History aria-hidden="true" className="size-6 text-lagoon-700" />
            {t.audit.title}
          </h2>
          <p className="mt-2 text-sm text-ink-soft">{t.audit.intro}</p>
          {audit.length === 0 ? (
            <p className="mt-4 text-ink-soft">{t.audit.empty}</p>
          ) : (
            <ol className="mt-4 divide-y divide-line rounded-3xl border border-line bg-surface">
              {audit.map((entry) => (
                <li key={entry.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                  <code className="font-semibold text-ink">{entry.action}</code>
                  <span className="text-ink-soft">
                    {t.audit.actors[entry.actorKind as keyof typeof t.audit.actors] ?? entry.actorKind} ·{" "}
                    {dateTime.format(new Date(entry.occurredAt))}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>
      ) : null}
    </>
  );
}
