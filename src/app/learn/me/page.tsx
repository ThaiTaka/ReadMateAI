import type { Metadata, Route } from "next";
import Link from "next/link";
import { after } from "next/server";
import { Suspense } from "react";
import { LogOut, Map, School, Smartphone } from "lucide-react";
import { AvatarFrame } from "@/components/adventure/avatar-frame";
import { KidAvatar } from "@/components/art/avatars";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { LoadingState } from "@/components/ui/loading-state";
import { Notice } from "@/components/ui/notice";
import { avatarChoices, safeAvatarKey } from "@/components/forms/avatar-choices";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { signOutDevice } from "@/server/student-gateway/actions";
import { getDeviceSession, type LinkedStudent } from "@/server/student-gateway/session";
import { vi } from "@/strings/vi";
import { PreferencesForm } from "./preferences-form";

export const metadata: Metadata = {
  title: vi.learnMe.meta.title,
  description: vi.learnMe.meta.description,
  robots: { index: false, follow: false },
};

/**
 * Khu vực học sinh CÓ XÁC THỰC (R03): chỉ hiện dữ liệu của hồ sơ mà thiết bị đã liên kết (RLS). Không có điểm
 * thật, bài luyện thật hay bảng xếp hạng ở R03 — Game World trên /learn vẫn là bản minh họa hư cấu.
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

  const avatarKey = safeAvatarKey(student.avatarKey);
  return (
    // Cài đặt "Giảm chuyển động" đã lưu ở hồ sơ (AD-50) áp dụng cho vùng này — globals.css dừng mọi hoạt cảnh bên trong.
    <div className="space-y-8" data-motion={student.motionPreference === "reduce" ? "reduce" : undefined}>
      <section className="flex flex-col items-center gap-5 text-center sm:flex-row sm:text-left">
        <AvatarFrame avatar={avatarKey} size="lg" label={vi.learn.avatarLabel.replace("{name}", student.displayName)} />
        <div>
          <h1 className="text-4xl font-extrabold leading-tight text-ink">
            {t.title.replace("{name}", student.displayName)}
          </h1>
          <p className="mt-2 flex items-center justify-center gap-2 text-lg font-semibold text-ink-soft sm:justify-start">
            <School aria-hidden="true" className="size-5" />
            {t.className.replace("{name}", student.className)}
          </p>
        </div>
      </section>

      <Notice tone="progress" title={vi.status.inDevelopment}>
        {t.pendingNote}
        <span className="mt-3 block">
          <Link
            href="/learn#game-world"
            className="inline-flex min-h-12 items-center gap-2 font-bold text-brand-800 underline"
          >
            <Map aria-hidden="true" className="size-5" />
            {t.worldLink}
          </Link>
        </span>
      </Notice>

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
