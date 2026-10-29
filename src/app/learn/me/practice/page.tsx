import type { Metadata } from "next";
import { Suspense } from "react";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { LoadingState } from "@/components/ui/loading-state";
import { ScoredPractice } from "@/features/scored-practice/ui/scored-practice";
import { getDeviceSession } from "@/server/student-gateway/session";
import { vi } from "@/strings/vi";

export const metadata: Metadata = {
  title: vi.scoredPractice.meta.title,
  description: vi.scoredPractice.meta.description,
  robots: { index: false, follow: false },
};

/**
 * Buổi luyện CÓ ĐIỂM (R04) của học sinh đã liên kết thẻ học. Trang chỉ xác định hồ sơ (RLS); buổi luyện được mở bằng
 * POST từ trình duyệt khi trang hiển thị, câu hỏi và điểm đến từ student gateway — đáp án không có trong HTML/props.
 */
export default function ScoredPracticePage({ searchParams }: PageProps<"/learn/me/practice">) {
  return (
    <Suspense fallback={<LoadingState className="py-16" />}>
      <PracticeArea searchParams={searchParams} />
    </Suspense>
  );
}

async function PracticeArea({ searchParams }: Pick<PageProps<"/learn/me/practice">, "searchParams">) {
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
        <h1 className="text-3xl font-extrabold text-ink">{vi.learnMe.chooseProfile}</h1>
        <ButtonLink href="/learn/me" size="kid" className="mt-6">
          {vi.scoredPractice.back}
        </ButtonLink>
      </Card>
    );
  }
  const homeHref = session.students.length > 1 ? `/learn/me?student=${student.id}` : "/learn/me";
  return (
    <div data-motion={student.motionPreference === "reduce" ? "reduce" : undefined}>
      <ScoredPractice key={student.id} studentId={student.id} homeHref={homeHref} />
    </div>
  );
}
