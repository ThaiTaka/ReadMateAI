import type { Metadata, Route } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft, Crown, History, Lock, MonitorPlay, RotateCcw, Trophy } from "lucide-react";
import { BoardPanel, LeaderboardBoard } from "@/components/leaderboard/leaderboard-board";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { LoadingState } from "@/components/ui/loading-state";
import { Notice } from "@/components/ui/notice";
import { eligibilityBlockers, maxPointsOf } from "@/features/gamification/ranking";
import { requireTeacher } from "@/server/auth/teacher";
import { getTeacherBoardOverview } from "@/server/leaderboard/teacher";
import { listHonorSnapshots } from "@/server/teacher/honor-queries";
import { getClassDetail } from "@/server/teacher/queries";
import { vi } from "@/strings/vi";
import { HonorLauncher } from "./honor-launcher";
import { LeaderboardSettingsForm } from "./leaderboard-forms";
import { SeasonReset } from "./season-reset";

const t = vi.leaderboard.teacher;
const h = vi.honors.teacher;
const r = vi.leaderboard.teacher.reset;

const timeFormat = new Intl.DateTimeFormat("vi-VN", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Ho_Chi_Minh",
});

export const metadata: Metadata = { title: t.metaTitle, robots: { index: false, follow: false } };

export default function TeacherLeaderboardPage({ params }: PageProps<"/teacher/classes/[classId]/leaderboard">) {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
      <Suspense fallback={<LoadingState className="mt-8" />}>
        <Content params={params} />
      </Suspense>
    </div>
  );
}

async function Content({ params }: Pick<PageProps<"/teacher/classes/[classId]/leaderboard">, "params">) {
  const { classId } = await params;
  const teacher = await requireTeacher();
  // RLS: lớp không thuộc GV → không có dòng → 404 (không phân biệt "không tồn tại" với "không có quyền").
  const cls = await getClassDetail(teacher, classId);
  if (!cls) notFound();
  const overview = await getTeacherBoardOverview(teacher, classId);
  if (!overview.ok) notFound();
  const board = overview.data;
  // Lịch sử chỉ đọc được khi cờ hệ thống vinh danh đã bật; ngược lại hàm CSDL trả HONORS_DISABLED → khóa khu vực.
  const honors = await listHonorSnapshots(teacher, classId);
  const honorsApproved = honors.ok;
  const history = honors.ok ? honors.data : [];
  const isOwner = cls.role === "owner";
  const canPresent = board.enabled && board.featureApproved;
  const rows = board.ranked.map((student) => ({
    rowKey: student.studentId,
    rank: student.rank,
    alias: student.displayName,
    avatarKey: student.avatarKey,
    points: student.balance,
  }));
  const eligibleCount = board.ranked.filter((student) => student.eligible).length;

  return (
    <>
      <ButtonLink href={`/teacher/classes/${classId}` as Route} variant="ghost" size="sm">
        <ArrowLeft aria-hidden="true" className="size-4" />
        {t.back}
      </ButtonLink>
      <header className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-ink-soft">
            {board.seasonNo ? t.season.replace("{no}", String(board.seasonNo)) : t.noSeason}
          </p>
          <h1 className="text-3xl leading-tight font-extrabold text-ink sm:text-4xl">
            {t.title.replace("{name}", cls.name)}
          </h1>
        </div>
        <Badge
          tone={board.enabled ? "brand" : "neutral"}
          icon={board.enabled ? undefined : <Lock className="size-3.5" />}
        >
          {board.enabled ? t.status.on : t.status.off}
        </Badge>
      </header>

      <section aria-labelledby="settings-title" className="mt-8">
        <h2 id="settings-title" className="flex items-center gap-2 text-2xl font-extrabold text-ink">
          <Trophy aria-hidden="true" className="size-6 text-sun-700" />
          {t.settingsTitle}
        </h2>
        <Card className="mt-4 space-y-4 p-5 sm:p-6">
          {!board.featureApproved ? (
            <Notice title={t.status.off} tone="progress">
              {t.featureLocked}
            </Notice>
          ) : null}
          <LeaderboardSettingsForm
            classId={classId}
            enabled={board.enabled}
            view={board.studentView}
            featureApproved={board.featureApproved}
            isOwner={isOwner}
          />
          <p className="text-sm text-ink-soft">{t.conditions}</p>
          <div>
            {canPresent ? (
              <ButtonLink href={`/teacher/classes/${classId}/leaderboard/present` as Route} variant="primary">
                <MonitorPlay aria-hidden="true" className="size-5" />
                {t.present}
              </ButtonLink>
            ) : (
              <>
                <Button type="button" variant="outline" disabled aria-describedby="present-blocked">
                  <MonitorPlay aria-hidden="true" className="size-5" />
                  {t.present}
                </Button>
                <p id="present-blocked" className="mt-2 text-sm text-ink-soft">
                  {t.presentLocked}
                </p>
              </>
            )}
          </div>
        </Card>
      </section>

      <section aria-labelledby="internal-title" className="mt-10">
        <h2 id="internal-title" className="text-2xl font-extrabold text-ink">
          {t.internalTitle}
        </h2>
        <p className="mt-2 text-ink-soft">{t.internalNote}</p>
        <p className="mt-1 text-sm font-semibold text-ink-soft">
          {t.studentsCount.replace("{count}", String(rows.length))}
        </p>
        {rows.length === 0 ? (
          <p className="mt-4 text-ink-soft">{t.empty}</p>
        ) : (
          <>
            <BoardPanel className="mt-4">
              <LeaderboardBoard rows={rows} maxPoints={maxPointsOf(rows)} />
            </BoardPanel>
            {/* Vùng cuộn ngang trên điện thoại phải focus được bằng bàn phím (axe: scrollable-region-focusable). */}
            <div
              role="group"
              aria-label={t.tableScroll}
              tabIndex={0}
              className="mt-6 overflow-x-auto rounded-3xl border border-line bg-surface"
            >
              <table className="w-full min-w-[34rem] text-left text-sm">
                <caption className="sr-only">{t.internalTitle}</caption>
                <thead className="bg-surface-muted text-ink-soft">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-bold">
                      {t.columns.rank}
                    </th>
                    <th scope="col" className="px-4 py-3 font-bold">
                      {t.columns.student}
                    </th>
                    <th scope="col" className="px-4 py-3 text-right font-bold">
                      {t.columns.points}
                    </th>
                    <th scope="col" className="px-4 py-3 text-right font-bold">
                      {t.columns.earned}
                    </th>
                    <th scope="col" className="px-4 py-3 font-bold">
                      {t.columns.visibility}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {board.ranked.map((student) => {
                    const blockers = eligibilityBlockers({
                      key: student.studentId,
                      status: student.status,
                      alias: student.alias,
                      aliasApproved: student.aliasApproved,
                      learningDataConsent: student.learningConsent,
                      leaderboardConsent: student.leaderboardConsent,
                      points: student.balance,
                      reachedAt: null,
                      avatarKey: student.avatarKey,
                    });
                    return (
                      <tr key={student.studentId}>
                        <td className="px-4 py-3 font-extrabold tabular-nums">{student.rank}</td>
                        <td className="px-4 py-3 font-semibold text-ink">{student.displayName}</td>
                        <td className="px-4 py-3 text-right font-extrabold tabular-nums">{student.balance}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-ink-soft">{student.earnedTotal}</td>
                        <td className="px-4 py-3">
                          {student.eligible ? (
                            <Badge tone="brand">{t.visible}</Badge>
                          ) : (
                            <span>
                              <Badge tone="neutral">{t.hidden}</Badge>
                              <span className="mt-1 block text-ink-soft">
                                {blockers.map((blocker) => t.blockers[blocker]).join("; ")}
                              </span>
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-sm text-ink-soft">
              {t.studentsCount.replace("{count}", String(eligibleCount))} · {t.visible}
            </p>
          </>
        )}
      </section>

      <section aria-labelledby="honors-title" className="mt-10">
        <h2 id="honors-title" className="flex items-center gap-2 text-2xl font-extrabold text-ink">
          <Crown aria-hidden="true" className="size-6 text-sun-700" />
          {h.title}
        </h2>
        <Card className="mt-4 p-5 sm:p-6">
          <HonorLauncher
            classId={classId}
            honorsEnabled={cls.honorsEnabled}
            featureApproved={honorsApproved}
            isOwner={isOwner}
          />
        </Card>
        <h3 className="mt-6 flex items-center gap-2 text-xl font-extrabold text-ink">
          <History aria-hidden="true" className="size-5 text-ink-soft" />
          {h.historyTitle}
        </h3>
        {history.length === 0 ? (
          <p className="mt-2 text-ink-soft">{h.historyEmpty}</p>
        ) : (
          <>
            <p className="mt-1 text-sm text-ink-soft">{h.historyNote}</p>
            <ul className="mt-3 space-y-2" data-testid="honor-history">
              {history.map((item) => {
                const time = timeFormat.format(new Date(item.createdAt));
                return (
                  <li
                    key={item.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface px-4 py-3"
                  >
                    <span className="font-semibold text-ink">
                      {h.historyItem.replace("{season}", String(item.seasonNo)).replace("{time}", time)}
                    </span>
                    <ButtonLink
                      href={`/teacher/classes/${classId}/honors/${item.id}` as Route}
                      variant="outline"
                      size="sm"
                    >
                      {h.replay}
                      <span className="sr-only">
                        {" "}
                        {h.replayContext.replace("{season}", String(item.seasonNo)).replace("{time}", time)}
                      </span>
                    </ButtonLink>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </section>

      <section aria-labelledby="reset-title" className="mt-10">
        <h2 id="reset-title" className="flex items-center gap-2 text-2xl font-extrabold text-ink">
          <RotateCcw aria-hidden="true" className="size-6 text-sun-700" />
          {r.title}
        </h2>
        <Card className="mt-4 p-5 sm:p-6">
          <SeasonReset classId={classId} className={cls.name} seasonId={cls.season?.id ?? null} isOwner={isOwner} />
        </Card>
      </section>
    </>
  );
}
