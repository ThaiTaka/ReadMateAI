import type { Metadata, Route } from "next";
import Link from "next/link";
import { after } from "next/server";
import { Suspense, type ReactNode } from "react";
import { BookOpenCheck, LogOut, Map as MapIcon, School, Smartphone, Sparkles } from "lucide-react";
import { AdventureLink } from "@/components/adventure/adventure-button";
import { AvatarFrame } from "@/components/adventure/avatar-frame";
import { GameWorldHeader } from "@/components/adventure/game-world-header";
import { MapExplorer } from "@/features/scored-practice/ui/map-explorer";
import { ScoreBadge } from "@/components/adventure/score-badge";
import { WorldMapCard } from "@/components/adventure/world-map-card";
import { GuideOwl } from "@/components/art/characters";
import { FogTileArt, MapTileArt } from "@/components/art/map-tiles";
import { KidAvatar } from "@/components/art/avatars";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { LoadingState } from "@/components/ui/loading-state";
import { Notice } from "@/components/ui/notice";
import { avatarChoices, safeAvatarKey } from "@/components/forms/avatar-choices";
import { gameWorld, MAP_TILES, type MapTileKey } from "@/features/game-world/catalog";
import { MAP_TILE_STEP, POINTS_CORRECT } from "@/features/gamification/rules";
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
 * Khu vực học sinh CÓ XÁC THỰC: chỉ hiện dữ liệu của hồ sơ mà thiết bị đã liên kết (RLS). R04: điểm thật (máy chủ
 * tính), buổi luyện có điểm, bản đồ khám phá và trạng thái bốn khu vực trò chơi — tất cả của CHÍNH học sinh.
 * Không có bảng xếp hạng (R05). Game World trên /learn vẫn là bản minh họa hư cấu.
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
 * Điểm, buổi luyện, bản đồ khám phá và khu vực trò chơi của CHÍNH học sinh (dữ liệu máy chủ). Hình SVG dựng ở đây
 * (Server Component) và truyền xuống bản đồ dạng phần tử — không vào bundle JS.
 */
function StudentDashboard({ home, studentId, query }: { home: StudentHomeDto; studentId: string; query: string }) {
  const t = vi.learnMe;
  const { blocker, openSession } = home.practice;
  const names = Object.fromEntries(MAP_TILES.map((tile) => [tile.key, tile.name])) as Record<MapTileKey, string>;
  const art = Object.fromEntries(
    MAP_TILES.map((tile) => [tile.key, <MapTileArt key={tile.key} tile={tile.key} />]),
  ) as Record<MapTileKey, ReactNode>;
  return (
    <>
      <section aria-labelledby="diem-thuong-title" className="grid gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-4">
          <h2 id="diem-thuong-title" className="text-2xl font-extrabold text-ink">
            {t.score.title}
          </h2>
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
        <div
          id="luyen-tap"
          className="relative flex scroll-mt-6 flex-col justify-center gap-4 overflow-hidden rounded-world bg-linear-to-br from-jade-600 via-jade-700 to-deep-800 p-5 text-white shadow-world sm:p-8"
        >
          <div className="flex items-center gap-4">
            <div className="w-20 shrink-0">
              <GuideOwl />
            </div>
            <h2 className="text-2xl font-extrabold">{t.practice.title}</h2>
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
      </section>

      <section id="ban-do" aria-labelledby="ban-do-title" className="flex scroll-mt-6 flex-col gap-4">
        <GameWorldHeader
          id="ban-do-title"
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
          eyebrow={vi.gameWorld.eyebrow}
          title={t.games.title}
          description={
            <span className="inline-flex items-start gap-2">
              <Sparkles aria-hidden="true" className="mt-1 size-4 shrink-0" />
              {t.games.text}
            </span>
          }
        />
        <ul className="grid gap-6 sm:grid-cols-2">
          {home.games.map((state) => (
            <WorldMapCard
              key={state.game}
              as="li"
              game={gameWorld(state.game)}
              state={state}
              idPrefix="me-game"
              compact
              live
              discovered={state.discovered}
            />
          ))}
        </ul>
        <Link
          href="/learn#game-world"
          className="inline-flex min-h-12 items-center gap-2 self-start font-bold text-brand-800 underline"
        >
          <MapIcon aria-hidden="true" className="size-5" />
          {t.worldLink}
        </Link>
      </section>
    </>
  );
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
