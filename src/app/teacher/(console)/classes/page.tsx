import type { Metadata, Route } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ChevronRight, School } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { requireTeacher } from "@/server/auth/teacher";
import { listMyClasses } from "@/server/teacher/queries";
import { vi } from "@/strings/vi";
import { CreateClassForm } from "./create-class-form";

export const metadata: Metadata = {
  title: vi.classesPage.meta.title,
  description: vi.classesPage.meta.description,
  robots: { index: false, follow: false },
};

export default function ClassesPage() {
  const t = vi.classesPage;
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
      <h1 className="text-3xl font-extrabold leading-tight text-ink sm:text-4xl">{t.title}</h1>
      <p className="mt-2 text-lg text-ink-soft">{t.intro}</p>
      <Suspense fallback={<LoadingState className="mt-8" />}>
        <ClassList />
      </Suspense>
      <Card className="mt-10 p-5 sm:p-6">
        <h2 className="text-xl font-extrabold text-ink">{t.create.title}</h2>
        <div className="mt-4">
          <CreateClassForm />
        </div>
      </Card>
    </div>
  );
}

async function ClassList() {
  const t = vi.classesPage;
  const teacher = await requireTeacher();
  const classes = await listMyClasses(teacher);
  if (classes.length === 0) {
    return (
      <EmptyState
        className="mt-8"
        icon={<School className="size-8" />}
        title={t.empty.title}
        description={t.empty.text}
      />
    );
  }
  return (
    <ul className="mt-8 grid gap-4 sm:grid-cols-2">
      {classes.map((cls) => (
        <li key={cls.id}>
          <Link
            href={`/teacher/classes/${cls.id}` as Route}
            className="flex min-h-touch items-center gap-4 rounded-3xl border border-line bg-surface p-5 shadow-soft transition-colors hover:border-brand-400"
          >
            <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">
              <School aria-hidden="true" className="size-6" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-xl font-extrabold text-ink">{cls.name}</span>
              <span className="mt-1 flex flex-wrap gap-2 text-sm text-ink-soft">
                <span>{cls.schoolYear}</span>
                <span aria-hidden="true">·</span>
                <span>{t.students.replace("{count}", String(cls.studentCount))}</span>
                {cls.activeSeasonNo ? (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>{t.season.replace("{no}", String(cls.activeSeasonNo))}</span>
                  </>
                ) : null}
              </span>
              <span className="mt-2 flex flex-wrap gap-2">
                <Badge tone={cls.role === "owner" ? "brand" : "neutral"}>
                  {cls.role === "owner" ? t.roleOwner : t.roleCoTeacher}
                </Badge>
                {cls.status === "archived" ? <Badge tone="neutral">{t.archived}</Badge> : null}
              </span>
            </span>
            <ChevronRight aria-hidden="true" className="size-6 shrink-0 text-ink-faint" />
            <span className="sr-only">{t.open}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
