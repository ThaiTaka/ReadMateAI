import type { Metadata, Route } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { MotionScope } from "@/components/adventure/motion";
import { BoardPanel, LeaderboardBoard } from "@/components/leaderboard/leaderboard-board";
import { ButtonLink } from "@/components/ui/button";
import { LoadingState } from "@/components/ui/loading-state";
import { requireTeacher } from "@/server/auth/teacher";
import { getPresentation } from "@/server/leaderboard/teacher";
import { vi } from "@/strings/vi";
import { PresentControls } from "./present-controls";

const t = vi.leaderboard.presentation;

export const metadata: Metadata = { title: t.metaTitle, robots: { index: false, follow: false } };

export default function PresentationPage({ params }: PageProps<"/teacher/classes/[classId]/leaderboard/present">) {
  return (
    <Suspense fallback={<LoadingState className="p-8 text-white" />}>
      <Content params={params} />
    </Suspense>
  );
}

async function Content({ params }: Pick<PageProps<"/teacher/classes/[classId]/leaderboard/present">, "params">) {
  const { classId } = await params;
  const teacher = await requireTeacher();
  const exitHref = `/teacher/classes/${classId}/leaderboard`;
  // Dữ liệu trình chiếu đến từ hàm CSDL riêng: chỉ học sinh đủ điều kiện, không mã định danh, và chỉ khi bảng đang bật.
  const result = await getPresentation(teacher, classId);
  if (!result.ok && result.code !== "LEADERBOARD_DISABLED") notFound();

  if (!result.ok) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center gap-6 p-8 text-center text-white">
        <h1 className="text-3xl font-extrabold">{vi.leaderboard.teacher.settingsTitle}</h1>
        <p className="text-xl">{t.disabled}</p>
        <ButtonLink href={exitHref as Route} size="lg">
          {t.exit}
        </ButtonLink>
      </div>
    );
  }

  const board = result.data;
  return (
    <MotionScope className="flex flex-1 flex-col">
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 sm:px-8 sm:py-10">
        <header className="flex flex-wrap items-end justify-between gap-4 text-white">
          <div>
            <p className="text-lg font-bold text-white/85 sm:text-2xl">
              {t.season.replace("{no}", String(board.seasonNo))}
            </p>
            <h1 className="text-4xl leading-tight font-extrabold sm:text-6xl">
              {t.title.replace("{name}", board.className)}
            </h1>
          </div>
          <PresentControls exitHref={exitHref} />
        </header>
        <BoardPanel className="flex-1">
          {board.rows.length === 0 ? (
            <p className="py-16 text-center text-3xl font-extrabold text-white" data-testid="present-empty">
              {t.empty}
            </p>
          ) : (
            <LeaderboardBoard rows={board.rows} maxPoints={board.maxPoints} size="xl" />
          )}
        </BoardPanel>
        <p className="text-center text-base text-white/75">{t.note}</p>
      </div>
    </MotionScope>
  );
}
