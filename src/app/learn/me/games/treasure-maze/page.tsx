import type { Metadata, Route } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { KidAvatar } from "@/components/art/avatars";
import { safeAvatarKey } from "@/components/forms/avatar-choices";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { LoadingState } from "@/components/ui/loading-state";
import { Notice } from "@/components/ui/notice";
import { BUNDLED_LEVEL_FILES, BUNDLED_LEVELS } from "@/features/game-engine/levels/bundled";
import { SavedMaze } from "@/features/game-engine/ui/saved-maze";
import { GAME_MIN_BALANCE } from "@/features/gamification/rules";
import { getStudentHome } from "@/server/scoring/home";
import { studentContext } from "@/server/student-gateway/context";
import { getDeviceSession } from "@/server/student-gateway/session";
import { vi } from "@/strings/vi";

export const metadata: Metadata = {
  title: vi.treasureMazePlay.meta.title,
  robots: { index: false, follow: false },
};

const t = vi.treasureMazePlay;

/**
 * Mê cung kho báu CÓ XÁC THỰC (R07.5b2). Máy chủ chỉ chọn hồ sơ trong danh sách thiết bị (RLS) và chặn sớm khi chưa đủ
 * điểm; việc bắt đầu/tiếp tục lượt, ngưỡng điểm thật và mùa do API + CSDL quyết (client gọi khi mở trang).
 */
export default function TreasureMazePlayPage({ searchParams }: PageProps<"/learn/me/games/treasure-maze">) {
  return (
    <Suspense fallback={<LoadingState className="py-16" />}>
      <Content searchParams={searchParams} />
    </Suspense>
  );
}

async function Content({ searchParams }: Pick<PageProps<"/learn/me/games/treasure-maze">, "searchParams">) {
  const session = await getDeviceSession();
  if (session.state !== "linked") {
    return (
      <Card className="mx-auto max-w-xl p-6 text-center sm:p-8">
        <h1 className="text-2xl font-extrabold text-ink">{vi.learnMe.notLinked.title}</h1>
        <p className="mt-3 text-lg text-ink-soft">{vi.learnMe.notLinked.text}</p>
        <div className="mt-6 flex flex-col items-center gap-3">
          <ButtonLink href="/join" size="kid">
            {vi.learnMe.notLinked.action}
          </ButtonLink>
          <ButtonLink href={"/demo/treasure-maze" as Route} variant="ghost">
            {t.demoCta}
          </ButtonLink>
        </div>
      </Card>
    );
  }

  const params = await searchParams;
  const requested = typeof params.student === "string" ? params.student : undefined;
  const student =
    session.students.length === 1 ? session.students[0] : session.students.find((entry) => entry.id === requested);
  if (!student) {
    return (
      <section className="mx-auto max-w-2xl">
        <h1 className="text-3xl font-extrabold text-ink">{vi.learnMe.chooseProfile}</h1>
        <ul className="mt-6 grid gap-4 sm:grid-cols-2">
          {session.students.map((entry) => (
            <li key={entry.id}>
              <Link
                href={`/learn/me/games/treasure-maze?student=${entry.id}` as Route}
                className="flex min-h-touch-kid items-center gap-4 rounded-tile border-4 border-line bg-surface p-4 text-2xl font-extrabold text-ink hover:border-brand-600"
              >
                <span className="size-16 shrink-0">
                  <KidAvatar avatar={safeAvatarKey(entry.avatarKey)} className="size-full" />
                </span>
                {entry.displayName}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    );
  }

  const multiple = session.students.length > 1;
  const query = multiple ? `?student=${student.id}` : "";
  const homeHref = `/learn/me${query}` as Route;
  const levelParam = typeof params.level === "string" ? Number(params.level) : 1;
  const levelIndex =
    Number.isInteger(levelParam) && levelParam >= 1 && levelParam <= BUNDLED_LEVELS.length ? levelParam - 1 : 0;
  const levelFile = BUNDLED_LEVEL_FILES[levelIndex]!;

  const context = await studentContext();
  const home = context.ok ? await getStudentHome(context.data, student) : context;
  const min = GAME_MIN_BALANCE.treasure_maze;

  let body;
  if (!home.ok) {
    body = <Notice title={vi.status.inDevelopment}>{vi.errors[home.code]}</Notice>;
  } else if (!home.data.learningDataConsent) {
    body = <Notice title={vi.learnMe.practice.title}>{vi.learnMe.practice.blocked.CONSENT_REQUIRED}</Notice>;
  } else if (home.data.score.balance < min) {
    body = (
      <Card className="mx-auto max-w-xl p-6 text-center sm:p-8" data-testid="maze-needs-points">
        <p className="text-lg font-semibold text-ink">
          {t.needPoints.replace("{min}", String(min)).replace("{n}", String(home.data.score.balance))}
        </p>
        <ButtonLink href={`${homeHref}#luyen-tap` as Route} size="kid" className="mt-5">
          {t.practiceCta}
        </ButtonLink>
      </Card>
    );
  } else {
    body = (
      <>
        <div role="group" aria-label={t.levelsLabel} className="mb-4 flex flex-wrap gap-3">
          {BUNDLED_LEVELS.map((level, index) => (
            <Link
              key={level.id}
              href={
                `/learn/me/games/treasure-maze?level=${index + 1}${multiple ? `&student=${student.id}` : ""}` as Route
              }
              aria-current={index === levelIndex ? "page" : undefined}
              className={
                index === levelIndex
                  ? "inline-flex min-h-12 items-center rounded-full border-2 border-jade-600 bg-jade-600 px-5 text-base font-bold text-white"
                  : "inline-flex min-h-12 items-center rounded-full border-2 border-line bg-surface px-5 text-base font-bold text-ink"
              }
            >
              {t.level.replace("{n}", String(index + 1))}
              <span className="sr-only">{`: ${BUNDLED_LEVEL_FILES[index]!.name}`}</span>
            </Link>
          ))}
        </div>
        <SavedMaze
          key={levelFile.id}
          studentId={student.id}
          multipleProfiles={multiple}
          levelKey={levelFile.id}
          level={BUNDLED_LEVELS[levelIndex]!}
        />
        <p className="mx-auto mt-4 max-w-[34rem] text-sm text-ink-soft">{vi.treasureMazeDemo.help}</p>
      </>
    );
  }

  return (
    <div data-motion={student.motionPreference === "reduce" ? "reduce" : undefined} className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-extrabold text-ink">{t.title}</h1>
        <ButtonLink href={homeHref} variant="ghost">
          {t.back}
        </ButtonLink>
      </div>
      {body}
    </div>
  );
}
