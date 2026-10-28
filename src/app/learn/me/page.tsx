import type { Metadata, Route } from "next";
import Link from "next/link";
import { after } from "next/server";
import { Suspense, type ReactNode } from "react";
import { BookOpenCheck, LogOut, School, Smartphone, Trophy, Volume2 } from "lucide-react";
import { AdventureLink } from "@/components/adventure/adventure-button";
import { AvatarFrame } from "@/components/adventure/avatar-frame";
import { GameWorldHeader } from "@/components/adventure/game-world-header";
import { MapExplorer } from "@/features/scored-practice/ui/map-explorer";
import { ScoreBadge } from "@/components/adventure/score-badge";
import { WorldMapCard, type GameEntry } from "@/components/adventure/world-map-card";
import { ZoneSection, ZoneSwitcher } from "@/components/adventure/zones";
import { GuideOwl } from "@/components/art/characters";
import { FogTileArt, MapTileArt } from "@/components/art/map-tiles";
import { KidAvatar } from "@/components/art/avatars";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { LoadingState } from "@/components/ui/loading-state";
import { Notice } from "@/components/ui/notice";
import { cn } from "@/lib/cn";
import { avatarChoices, safeAvatarKey } from "@/components/forms/avatar-choices";
import { mazeEnterable } from "@/features/game-runs/entry";
import { gameWorld, isPlayable, MAP_TILES, type MapTileKey } from "@/features/game-world/catalog";
import { MAP_TILE_STEP, POINTS_CORRECT } from "@/features/gamification/rules";
import type { GameUnlockState } from "@/features/gamification/unlocks";
import type { StudentHomeDto } from "@/features/scored-practice/types";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getStudentHome } from "@/server/scoring/home";
import { signOutDevice } from "@/server/student-gateway/actions";
import { studentContext } from "@/server/student-gateway/context";
import { getDeviceSession, type LinkedStudent } from "@/server/student-gateway/session";
import { vi } from "@/strings/vi";
import { PreferencesForm } from "./preferences-form";

export const metadata: Metadata = {
  title: vi.learnMe.meta.title,
  description: vi.learnMe.meta.description,
  robots: { index: false, follow: false },
};

/**
 * Khu vực học sinh CÓ XÁC THỰC: chỉ hiện dữ liệu của hồ sơ mà thiết bị đã liên kết (RLS). Hai khu vực: HỌC TẬP (luyện
 * Tiếng Việt, tiến độ học) và THI ĐẤU (điểm thưởng, bản đồ khám phá, Mê cung kho báu thật, bảng điểm lớp) — tất cả là dữ
 * liệu của CHÍNH học sinh. Game World trên /learn vẫn là bản minh họa hư cấu, tách riêng.
 */
export default function LearnMePage({ searchParams }: PageProps<"/learn/me">) {
  return (
    <Suspense fallback={<LoadingState className="py-16" />}>
      <StudentArea searchParams={searchParams} />
    </Suspense>
  );
}

async function StudentArea({ searchParams }: Pick<PageProps<"/learn/me">, "searchParams">) {
  const t = vi.learnMe;
  const session = await getDeviceSession();

  if (session.state === "not_configured") {
    return <Notice title={t.notConfigured}>{t.notLinked.text}</Notice>;
  }
  if (session.state === "teacher") {
    return (
      <Card className="mx-auto max-w-xl p-6 sm:p-8">
        <h1 className="text-2xl font-extrabold text-ink">{t.teacherSession.title}</h1>
        <p className="mt-3 text-lg text-ink-soft">{t.teacherSession.text}</p>
        <ButtonLink href="/teacher" className="mt-6">
          {t.teacherSession.action}
        </ButtonLink>
      </Card>
    );
  }
  if (session.state !== "linked") {
    return (
      <Card className="mx-auto max-w-xl p-6 text-center sm:p-8">
        <span className="mx-auto flex size-16 items-center justify-center rounded-3xl bg-lagoon-50 text-lagoon-700">
          <Smartphone aria-hidden="true" className="size-8" />
        </span>
        <h1 className="mt-4 text-3xl font-extrabold text-ink">{t.notLinked.title}</h1>
        <p className="mt-3 text-lg text-ink-soft">{t.notLinked.text}</p>
        <div className="mt-6 flex flex-col items-center gap-3">
          <ButtonLink href="/join" size="kid">
            {t.notLinked.action}
          </ButtonLink>
          <ButtonLink href="/learn" variant="ghost">
            {t.notLinked.demo}
          </ButtonLink>
        </div>
      </Card>
    );
  }

  const requested = (await searchParams).student;
  const selectedId = typeof requested === "string" ? requested : undefined;
  const student =
    session.students.length === 1 ? session.students[0] : session.students.find((entry) => entry.id === selectedId);

  if (!student) return <ProfilePicker students={session.students} />;

  // Ghi "dùng gần nhất" sau khi phản hồi đã gửi (không làm chậm trang); hàm CSDL tự bỏ qua nếu liên kết đã thu hồi.
  const authUserId = session.authUserId;
  after(async () => {
    await createSupabaseAdminClient()?.rpc("gateway_touch_device", {
      p_auth_user_id: authUserId,
      p_student_id: student.id,
    });
  });

  const context = await studentContext();
  const home = context.ok ? await getStudentHome(context.data, student) : context;
  const avatarKey = safeAvatarKey(student.avatarKey);
  const query = session.students.length > 1 ? `?student=${student.id}` : "";
  return (
    // Cài đặt "Giảm chuyển động" đã lưu ở hồ sơ (AD-50) áp dụng cho vùng này — globals.css dừng mọi hoạt cảnh bên trong.
    <div className="space-y-10" data-motion={student.motionPreference === "reduce" ? "reduce" : undefined}>
      <section className="flex flex-col items-center gap-5 text-center sm:flex-row sm:text-left">
        <AvatarFrame avatar={avatarKey} size="lg" label={vi.learn.avatarLabel.replace("{name}", student.displayName)} />
        <div>
          <h1 className="text-4xl font-extrabold leading-tight text-ink">
            {t.title.replace("{name}", student.displayName)}
          </h1>
          <p className="mt-2 flex flex-wrap items-center justify-center gap-2 text-lg font-semibold text-ink-soft sm:justify-start">
            <School aria-hidden="true" className="size-5" />
            {t.className.replace("{name}", student.className)}
            {home.ok && home.data.season ? (
              <span className="rounded-full bg-magic-100 px-3 py-0.5 text-sm font-bold text-magic-800">
                {t.score.season.replace("{n}", String(home.data.season.seqNo))}
              </span>
            ) : null}
          </p>
        </div>
      </section>

      {home.ok ? (
        <StudentDashboard home={home.data} studentId={student.id} query={query} />
      ) : (
        <Notice tone="progress" title={vi.status.inDevelopment}>
          {vi.errors[home.code]}
        </Notice>
      )}

      <Card className="p-5 sm:p-8">
        <h2 className="text-2xl font-extrabold text-ink">{t.preferences.title}</h2>
        <div className="mt-6">
          <PreferencesForm key={student.id} student={student} avatars={avatarChoices()} />
        </div>
      </Card>

      <form action={signOutDevice}>
        <Button type="submit" variant="ghost">
          <LogOut aria-hidden="true" className="size-5" />
          {t.signOut}
        </Button>
      </form>
    </div>
  );
}

/**
 * Trang của CHÍNH học sinh (dữ liệu máy chủ), chia hai khu vực rõ ràng để trẻ không nhầm:
 * - HỌC TẬP: luyện chữ, âm, vần, đọc từ — có hướng dẫn, nghe cách đọc, gợi ý; tiến độ học của em.
 * - THI ĐẤU: điểm thưởng, bản đồ khám phá, Mê cung kho báu (thật), bảng điểm lớp.
 * Hình SVG dựng ở đây (Server Component) và truyền xuống bản đồ dạng phần tử — không vào bundle JS.
 * Chỉ vẽ trò chơi ĐÃ PHÁT HÀNH; game chưa làm không có thẻ, không nút giả.
 */
function StudentDashboard({ home, studentId, query }: { home: StudentHomeDto; studentId: string; query: string }) {
  const t = vi.learnMe;
  const z = vi.zones;
  const { blocker, openSession } = home.practice;
  const names = Object.fromEntries(MAP_TILES.map((tile) => [tile.key, tile.name])) as Record<MapTileKey, string>;
  const art = Object.fromEntries(
    MAP_TILES.map((tile) => [tile.key, <MapTileArt key={tile.key} tile={tile.key} />]),
  ) as Record<MapTileKey, ReactNode>;
  const learning = home.learning;
  const playableGames = home.games.filter((state) => isPlayable(state.game));
  const progressText = openSession
    ? z.learn.progressOpen.replace("{closed}", String(openSession.closed)).replace("{total}", String(openSession.total))
    : learning.sessionsDone > 0
      ? z.learn.progressDone
          .replace("{sessions}", String(learning.sessionsDone))
          .replace("{correct}", String(learning.correctAnswers))
      : z.learn.progressNone;
  const hubHref = `/learn/me${query}`;
  return (
    <>
      <ZoneSwitcher />
      <p className="-mt-4 text-center text-sm font-semibold text-ink-soft">{z.note}</p>

      <ZoneSection zone="learn" titleId="hoc-tap-title">
        <div className="grid gap-6 lg:grid-cols-2">
          <Card
            id="nghe-chu"
            data-testid="study-entry"
            className="flex scroll-mt-6 flex-col justify-center gap-4 p-5 sm:p-8"
          >
            <div className="flex items-center gap-4">
              <span className="flex size-16 shrink-0 items-center justify-center rounded-3xl bg-jade-100 text-jade-800">
                <Volume2 aria-hidden="true" className="size-9" />
              </span>
              <h3 className="text-2xl font-extrabold text-ink">{vi.studyAudio.entry.title}</h3>
            </div>
            <p className="text-lg font-semibold text-ink-soft">{vi.studyAudio.entry.text}</p>
            <AdventureLink href={`/learn/me/study${query}` as Route} tone="jade" className="self-start">
              <Volume2 aria-hidden="true" className="size-6" />
              {vi.studyAudio.entry.cta}
            </AdventureLink>
          </Card>
          <div
            id="luyen-tap"
            className="relative flex scroll-mt-6 flex-col justify-center gap-4 overflow-hidden rounded-world bg-linear-to-br from-jade-600 via-jade-700 to-deep-800 p-5 text-white shadow-world sm:p-8"
          >
            <div className="flex items-center gap-4">
              <div className="w-20 shrink-0">
                <GuideOwl />
              </div>
              <h3 className="text-2xl font-extrabold">{t.practice.title}</h3>
            </div>
            {blocker === null ? (
              <>
                <p className="text-lg font-semibold text-jade-50">
                  {t.practice.text.replace("{plus}", String(POINTS_CORRECT))}
                </p>
                <AdventureLink href={`/learn/me/practice${query}` as Route} tone="sun" className="self-start">
                  <BookOpenCheck aria-hidden="true" className="size-6" />
                  {openSession
                    ? t.practice.resume
                        .replace("{closed}", String(openSession.closed))
                        .replace("{total}", String(openSession.total))
                    : t.practice.cta}
                </AdventureLink>
              </>
            ) : (
              <>
                <p role="note" className="rounded-2xl bg-white/15 p-4 text-lg font-semibold">
                  {t.practice.blocked[blocker]}
                </p>
                {blocker === "CONSENT_REQUIRED" ? (
                  <AdventureLink href="/demo#luyen-tap" tone="plain" className="self-start">
                    {t.practice.demo}
                  </AdventureLink>
                ) : null}
              </>
            )}
          </div>
          <Card className="flex flex-col justify-center gap-3 p-5 sm:p-8 lg:col-span-2" data-testid="learning-progress">
            <h3 className="text-2xl font-extrabold text-ink">{z.learn.progressTitle}</h3>
            <p className="text-lg font-semibold text-ink-soft">{progressText}</p>
            <dl className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-line bg-surface p-3">
                <dt className="text-sm font-bold text-ink-soft">{z.learn.sessionsLabel}</dt>
                <dd className="text-2xl font-extrabold tabular-nums text-ink" data-testid="learning-sessions">
                  {learning.sessionsDone}
                </dd>
              </div>
              <div className="rounded-2xl border border-line bg-surface p-3">
                <dt className="text-sm font-bold text-ink-soft">{z.learn.correctLabel}</dt>
                <dd className="text-2xl font-extrabold tabular-nums text-ink" data-testid="learning-correct">
                  {learning.correctAnswers}
                </dd>
              </div>
            </dl>
          </Card>
        </div>
      </ZoneSection>

      <ZoneSection zone="compete" titleId="thi-dau-title">
        <section aria-labelledby="diem-thuong-title" className="grid gap-6 lg:grid-cols-2">
          <div className="flex flex-col gap-4">
            <h3 id="diem-thuong-title" className="text-2xl font-extrabold text-ink">
              {t.score.title}
            </h3>
            <ScoreBadge points={home.score.balance} earnedTotal={home.score.earnedTotal} size="lg" />
            <dl className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-line bg-surface p-3">
                <dt className="text-sm font-bold text-ink-soft">{t.score.current}</dt>
                <dd className="text-2xl font-extrabold tabular-nums text-ink" data-testid="score-balance">
                  {home.score.balance}
                </dd>
              </div>
              <div className="rounded-2xl border border-line bg-surface p-3">
                <dt className="text-sm font-bold text-ink-soft">{t.score.earned}</dt>
                <dd className="text-2xl font-extrabold tabular-nums text-ink" data-testid="score-earned">
                  {home.score.earnedTotal}
                </dd>
              </div>
            </dl>
            <p className="text-sm text-ink-soft">{t.score.note}</p>
          </div>
          <div className="flex flex-col justify-center gap-3 rounded-world border-2 border-magic-200 bg-magic-50 p-5">
            <h3 className="text-xl font-extrabold text-ink">{z.compete.earnTitle}</h3>
            <p className="text-ink-soft">{z.compete.earnHint}</p>
            <AdventureLink href={`${hubHref}#luyen-tap` as Route} tone="plain" size="md" className="self-start">
              {z.compete.earnCta}
            </AdventureLink>
          </div>
        </section>

        <section id="ban-do" aria-labelledby="ban-do-title" className="flex scroll-mt-6 flex-col gap-4">
          <GameWorldHeader
            id="ban-do-title"
            level={3}
            eyebrow={vi.gameWorld.eyebrow}
            title={t.map.title}
            description={t.map.text.replace("{step}", String(MAP_TILE_STEP))}
          />
          {home.learningDataConsent ? (
            <MapExplorer
              studentId={studentId}
              initial={home.map}
              names={names}
              art={art}
              fog={<FogTileArt />}
              station={<GuideOwl />}
            />
          ) : (
            <p className="rounded-2xl border border-line bg-surface p-4 text-ink-soft">
              {t.practice.blocked.CONSENT_REQUIRED}
            </p>
          )}
        </section>

        <section id="tro-choi" aria-labelledby="tro-choi-title" className="flex scroll-mt-6 flex-col gap-4">
          <GameWorldHeader
            id="tro-choi-title"
            level={3}
            eyebrow={vi.gameWorld.eyebrow}
            title={t.games.title}
            description={t.games.text}
          />
          {/* Chỉ vẽ game đã phát hành; một thẻ thì rộng vừa phải, nhiều thẻ thì chia hai cột. */}
          <ul className={cn("grid gap-6", playableGames.length > 1 ? "sm:grid-cols-2" : "max-w-xl")}>
            {playableGames.map((state) => (
              <WorldMapCard
                key={state.game}
                as="li"
                game={gameWorld(state.game)}
                state={state}
                idPrefix="me-game"
                compact
                live
                discovered={state.discovered}
                entry={gameEntry(home, state, query)}
              />
            ))}
          </ul>
        </section>

        <section id="bang-diem" aria-labelledby="bang-diem-title" className="scroll-mt-6">
          <Card className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <div className="flex items-start gap-4">
              <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-sun-100 text-sun-700">
                <Trophy aria-hidden="true" className="size-7" />
              </span>
              <div>
                <h3 id="bang-diem-title" className="text-2xl font-extrabold text-ink">
                  {vi.leaderboard.student.link.title}
                </h3>
                <p className="mt-1 text-ink-soft">{vi.leaderboard.student.link.text}</p>
              </div>
            </div>
            <AdventureLink href={`/learn/leaderboard${query}` as Route} tone="plain" className="self-start">
              {vi.leaderboard.student.link.cta}
            </AdventureLink>
          </Card>
        </section>
      </ZoneSection>
    </>
  );
}

/**
 * Nút vào chơi trên thẻ trò chơi, theo tình trạng THẬT của học sinh: vào mới / tiếp tục lượt dở / chơi lại. Chỉ chọn nhãn và
 * màn dẫn tới; ngưỡng điểm, mùa, đồng ý và nội dung vẫn do máy chủ + CSDL kiểm khi mở bàn chơi.
 */
function gameEntry(home: StudentHomeDto, state: GameUnlockState, query: string): GameEntry | null {
  const game = gameWorld(state.game);
  if (!game.playPath) return null;
  const t = vi.treasureMazePlay;
  if (!home.learningDataConsent || !home.season) {
    return { kind: "blocked", note: vi.learnMe.practice.blocked[home.season ? "CONSENT_REQUIRED" : "SEASON_CLOSED"] };
  }
  if (!mazeEnterable(home.maze, state.eligible)) {
    return {
      kind: "blocked",
      note: t.entryNeedMore.replace("{n}", String(state.missing)),
      href: `/learn/me${query}#luyen-tap` as Route,
      hrefLabel: t.practiceCta,
    };
  }
  // Giữ hồ sơ đang chọn (thiết bị nhiều hồ sơ) và thêm màn cần mở.
  const params = new URLSearchParams(query.startsWith("?") ? query.slice(1) : query);
  if (home.maze.level > 1) params.set("level", String(home.maze.level));
  const search = params.size > 0 ? `?${params.toString()}` : "";
  const href = `${game.playPath}${search}` as Route;
  if (home.maze.mode === "resume") {
    return { kind: "play", href, label: t.entryResume, note: t.entryResumeText };
  }
  if (home.maze.mode === "replay") {
    return { kind: "play", href, label: t.entryReplay, note: t.entryReplayText };
  }
  return { kind: "play", href, label: t.entry, note: t.entryText.replace("{min}", String(game.minBalance)) };
}

function ProfilePicker({ students }: { students: LinkedStudent[] }) {
  return (
    <section className="mx-auto max-w-2xl">
      <h1 className="text-3xl font-extrabold text-ink">{vi.learnMe.chooseProfile}</h1>
      <ul className="mt-6 grid gap-4 sm:grid-cols-2">
        {students.map((student) => (
          <li key={student.id}>
            <Link
              href={`/learn/me?student=${student.id}` as Route}
              className="flex min-h-touch-kid items-center gap-4 rounded-tile border-4 border-line bg-surface p-4 text-2xl font-extrabold text-ink hover:border-brand-600"
            >
              <span className="size-16 shrink-0">
                <KidAvatar avatar={safeAvatarKey(student.avatarKey)} className="size-full" />
              </span>
              {student.displayName}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
