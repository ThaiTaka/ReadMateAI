import type { Metadata, Route } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { KidAvatar } from "@/components/art/avatars";
import { safeAvatarKey } from "@/components/forms/avatar-choices";
import { LearningAudioProvider, LearningAudioStatus, ListenableLetter } from "@/components/kid/learning-audio";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { LoadingState } from "@/components/ui/loading-state";
import { STUDY_DIGRAPHS, STUDY_LETTERS, type StudyTile } from "@/features/audio-playback/study-catalog";
import { getDeviceSession } from "@/server/student-gateway/session";
import { vi } from "@/strings/vi";

export const metadata: Metadata = {
  title: vi.studyAudio.meta.title,
  description: vi.studyAudio.meta.description,
  robots: { index: false, follow: false },
};

const t = vi.studyAudio;

/**
 * HỌC TẬP → Nghe cách đọc chữ (R10.4). Khu vực có xác thực: chỉ hồ sơ của thiết bị đã liên kết. Không có câu hỏi, không điểm,
 * không ghi dữ liệu học tập; âm thanh chỉ là bản ghi giáo viên ĐÃ DUYỆT, do máy chủ cấp từng lần chạm.
 */
export default function StudyPage({ searchParams }: PageProps<"/learn/me/study">) {
  return (
    <Suspense fallback={<LoadingState className="py-16" />}>
      <Content searchParams={searchParams} />
    </Suspense>
  );
}

function TileList({ tiles, title, id }: { tiles: readonly StudyTile[]; title: string; id: string }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-4">
      <h2 id={id} className="text-2xl font-extrabold text-ink">
        {title}
      </h2>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {tiles.map((tile) => (
          <li key={tile.id}>
            <ListenableLetter display={tile.display} upper={tile.upper} name={tile.name} sound={tile.sound} />
          </li>
        ))}
      </ul>
    </section>
  );
}

async function Content({ searchParams }: Pick<PageProps<"/learn/me/study">, "searchParams">) {
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
                href={`/learn/me/study?student=${entry.id}` as Route}
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

  const homeHref = (session.students.length > 1 ? `/learn/me?student=${student.id}` : "/learn/me") as Route;
  return (
    <div data-motion={student.motionPreference === "reduce" ? "reduce" : undefined} className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-extrabold text-ink">{t.title}</h1>
        <ButtonLink href={homeHref} variant="ghost">
          {t.back}
        </ButtonLink>
      </div>
      <LearningAudioProvider studentId={student.id}>
        <div className="flex flex-col gap-2 rounded-2xl border-2 border-jade-200 bg-jade-50 p-4">
          <p className="text-lg font-semibold text-ink">{t.intro}</p>
          <p className="text-ink-soft">{t.legend}</p>
          <LearningAudioStatus />
        </div>
        <TileList tiles={STUDY_LETTERS} title={t.lettersTitle} id="study-letters" />
        <TileList tiles={STUDY_DIGRAPHS} title={t.digraphsTitle} id="study-digraphs" />
      </LearningAudioProvider>
    </div>
  );
}
