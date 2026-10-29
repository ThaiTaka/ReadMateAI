import type { Metadata } from "next";
import { Suspense } from "react";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { LoadingState } from "@/components/ui/loading-state";
import { StudentLeaderboard } from "@/features/leaderboard/ui/student-leaderboard";
import { getDeviceSession } from "@/server/student-gateway/session";
import { vi } from "@/strings/vi";

export const metadata: Metadata = {
  title: vi.leaderboard.student.metaTitle,
  description: vi.leaderboard.student.metaDescription,
  // Dữ liệu lớp học: không lập chỉ mục, không chia sẻ công khai (LEADERBOARD_SPEC §10).
  robots: { index: false, follow: false },
};

/**
 * Bảng điểm của lớp (R05) cho học sinh đã liên kết thẻ học. Trang chỉ xác định hồ sơ (RLS của thiết bị); bảng được tải
 * từ `/api/student/leaderboard` ở trình duyệt nên HTML của trang không chứa tên hay điểm của bạn nào.
 */
export default function LeaderboardPage({ searchParams }: PageProps<"/learn/leaderboard">) {
  return (
    <Suspense fallback={<LoadingState className="py-16" />}>
      <LeaderboardArea searchParams={searchParams} />
    </Suspense>
  );
}

async function LeaderboardArea({ searchParams }: Pick<PageProps<"/learn/leaderboard">, "searchParams">) {
  const session = await getDeviceSession();
  if (session.state !== "linked") {
    return (
      <Card className="mx-auto max-w-xl p-6 text-center sm:p-8">
        <h1 className="text-3xl font-extrabold text-ink">{vi.learnMe.notLinked.title}</h1>
        <p className="mt-3 text-lg text-ink-soft">{vi.learnMe.notLinked.text}</p>
        <ButtonLink href="/join" size="kid" className="mt-6">
          {vi.learnMe.notLinked.action}
        </ButtonLink>
      </Card>
    );
  }
  const requested = (await searchParams).student;
  const selectedId = typeof requested === "string" ? requested : undefined;
  const student =
    session.students.length === 1 ? session.students[0] : session.students.find((entry) => entry.id === selectedId);
  if (!student) {
    return (
      <Card className="mx-auto max-w-xl p-6 text-center sm:p-8">
        <h1 className="text-3xl font-extrabold text-ink">{vi.leaderboard.student.chooseProfile}</h1>
        <ButtonLink href="/learn/me" size="kid" className="mt-6">
          {vi.leaderboard.student.back}
        </ButtonLink>
      </Card>
    );
  }
  const multi = session.students.length > 1;
  const homeHref = multi ? `/learn/me?student=${student.id}` : "/learn/me";
  const practiceHref = multi ? `/learn/me/practice?student=${student.id}` : "/learn/me/practice";
  return (
    <div data-motion={student.motionPreference === "reduce" ? "reduce" : undefined}>
      <h1 className="sr-only">{vi.leaderboard.student.title}</h1>
      <StudentLeaderboard key={student.id} studentId={student.id} homeHref={homeHref} practiceHref={practiceHref} />
    </div>
  );
}
