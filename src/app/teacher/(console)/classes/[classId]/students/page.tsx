import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft, ChevronRight, Users } from "lucide-react";
import { KidAvatar } from "@/components/art/avatars";
import { avatarChoices, safeAvatarKey } from "@/components/forms/avatar-choices";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { CONSENT_SCOPES } from "@/features/consent/consent";
import { requireTeacher } from "@/server/auth/teacher";
import { getClassDetail, listClassStudents, type StudentRow } from "@/server/teacher/queries";
import { vi } from "@/strings/vi";
import { CreateStudentForm } from "./create-student-form";

export const metadata: Metadata = { title: vi.teacher.sidebar.students, robots: { index: false, follow: false } };

const CONSENT_TONE: Record<StudentRow["consents"]["learning_data"], BadgeTone> = {
  none: "neutral",
  granted: "brand",
  withdrawn: "coral",
};

export default function StudentsPage({ params }: PageProps<"/teacher/classes/[classId]/students">) {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
      <Suspense fallback={<LoadingState className="mt-8" />}>
        <StudentList params={params} />
      </Suspense>
    </div>
  );
}

async function StudentList({ params }: Pick<PageProps<"/teacher/classes/[classId]/students">, "params">) {
  const { classId } = await params;
  const t = vi.studentsPage;
  const teacher = await requireTeacher();
  const cls = await getClassDetail(teacher, classId);
  if (!cls) notFound();
  const students = await listClassStudents(teacher, cls.id);

  return (
    <>
      <ButtonLink href={`/teacher/classes/${cls.id}` as Route} variant="ghost" size="sm">
        <ArrowLeft aria-hidden="true" className="size-4" />
        {cls.name}
      </ButtonLink>
      <h1 className="mt-4 text-3xl font-extrabold leading-tight text-ink sm:text-4xl">
        {t.title.replace("{name}", cls.name)}
      </h1>
      <p className="mt-2 max-w-3xl text-ink-soft">{t.intro}</p>

      {students.length === 0 ? (
        <EmptyState
          className="mt-8"
          icon={<Users className="size-8" />}
          title={t.empty.title}
          description={t.empty.text}
        />
      ) : (
        <ul className="mt-8 grid gap-3" aria-label={t.title.replace("{name}", cls.name)}>
          {students.map((student) => (
            <li key={student.id}>
              <Link
                href={`/teacher/classes/${cls.id}/students/${student.id}` as Route}
                className="grid min-h-touch gap-3 rounded-3xl border border-line bg-surface p-4 shadow-soft transition-colors hover:border-brand-400 md:grid-cols-[auto_1.4fr_1fr_1.4fr_1fr_auto] md:items-center"
              >
                <span className="flex items-center gap-3 md:contents">
                  <span className="size-12 shrink-0 md:order-none">
                    <KidAvatar avatar={safeAvatarKey(student.avatarKey)} className="size-full" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-lg font-extrabold text-ink">
                      {student.studentNumber ? `${student.studentNumber}. ` : ""}
                      {student.displayName}
                    </span>
                    {student.status !== "active" ? (
                      <Badge tone="neutral">{vi.studentPage.status[student.status as "paused" | "archived"]}</Badge>
                    ) : null}
                  </span>
                </span>
                <span className="text-sm text-ink-soft">
                  <span className="sr-only">{t.columns.band}: </span>
                  {student.band ? vi.bands[student.band as keyof typeof vi.bands] : vi.studentPage.band.none}
                </span>
                <span className="flex flex-wrap gap-1.5">
                  {CONSENT_SCOPES.map((scope) => (
                    <Badge key={scope} tone={CONSENT_TONE[student.consents[scope]]}>
                      {vi.consent.scopes[scope].title}: {vi.consent.states[student.consents[scope]]}
                    </Badge>
                  ))}
                </span>
                <span className="text-sm text-ink-soft">
                  <span className="sr-only">{t.columns.access}: </span>
                  {student.activeDevices > 0 ? t.devices.replace("{count}", String(student.activeDevices)) : t.noDevice}
                  {" · "}
                  {student.hasActiveCode ? t.codeActive : t.noCode}
                </span>
                <span className="flex items-center justify-end gap-1 font-semibold text-brand-800">
                  {t.open}
                  <ChevronRight aria-hidden="true" className="size-5" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <Card className="mt-10 p-5 sm:p-6">
        <h2 className="text-xl font-extrabold text-ink">{t.create.title}</h2>
        <div className="mt-4">
          {cls.status === "active" ? (
            <CreateStudentForm classId={cls.id} avatars={avatarChoices()} />
          ) : (
            <p className="text-ink-soft">{vi.errors.CLASS_ARCHIVED}</p>
          )}
        </div>
      </Card>
    </>
  );
}
