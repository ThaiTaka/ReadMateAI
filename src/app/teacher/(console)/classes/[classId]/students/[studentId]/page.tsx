import type { Metadata, Route } from "next";
import { notFound } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { ArrowLeft, KeyRound, ShieldCheck, Smartphone, Trophy, UserRound } from "lucide-react";
import { AvatarFrame } from "@/components/adventure/avatar-frame";
import { avatarChoices, safeAvatarKey } from "@/components/forms/avatar-choices";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { LoadingState } from "@/components/ui/loading-state";
import { Notice } from "@/components/ui/notice";
import { CONSENT_SCOPES, consentStateFor } from "@/features/consent/consent";
import { requireTeacher } from "@/server/auth/teacher";
import { getStudentDetail, type StudentDetail } from "@/server/teacher/queries";
import { vi } from "@/strings/vi";
import {
  AliasForms,
  BandForm,
  IssueCodeForm,
  ProfileForm,
  RecordConsentForm,
  RevokeButton,
  StatusForm,
  WithdrawConsentForm,
} from "./student-forms";

export const metadata: Metadata = { title: vi.teacher.sidebar.students, robots: { index: false, follow: false } };

const formatDate = (value: string, withTime = false) =>
  new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    ...(withTime ? { timeStyle: "short" } : {}),
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date(value));

type PageParams = PageProps<"/teacher/classes/[classId]/students/[studentId]">;

export default function StudentPage({ params }: PageParams) {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
      <Suspense fallback={<LoadingState className="mt-8" />}>
        <StudentManagement params={params} />
      </Suspense>
    </div>
  );
}

function Section({ id, title, icon, children }: { id: string; title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="mt-10">
      <h2 id={id} className="flex items-center gap-2 text-2xl font-extrabold text-ink">
        {icon}
        {title}
      </h2>
      {children}
    </section>
  );
}

async function StudentManagement({ params }: Pick<PageParams, "params">) {
  const { classId, studentId } = await params;
  const t = vi.studentPage;
  const teacher = await requireTeacher();
  const student = await getStudentDetail(teacher, classId, studentId);
  if (!student) notFound();
  const active = student.status === "active";

  return (
    <>
      <ButtonLink href={`/teacher/classes/${student.classId}/students` as Route} variant="ghost" size="sm">
        <ArrowLeft aria-hidden="true" className="size-4" />
        {t.back}
      </ButtonLink>
      <header className="mt-4 flex flex-wrap items-center gap-4">
        <AvatarFrame avatar={safeAvatarKey(student.avatarKey)} size="lg" />
        <div>
          <p className="text-sm font-semibold text-ink-soft">
            {vi.learnMe.className.replace("{name}", student.className)}
          </p>
          <h1 className="text-3xl font-extrabold leading-tight text-ink sm:text-4xl">
            {student.studentNumber ? `${student.studentNumber}. ` : ""}
            {student.displayName}
          </h1>
          {!active ? <Badge tone="neutral">{t.status[student.status as "paused" | "archived"]}</Badge> : null}
        </div>
      </header>

      <Section
        id="profile-title"
        title={t.profile.title}
        icon={<UserRound aria-hidden="true" className="size-6 text-brand-700" />}
      >
        <Card className="mt-4 p-5 sm:p-6">
          <ProfileForm
            studentId={student.id}
            displayName={student.displayName}
            studentNumber={student.studentNumber}
            avatarKey={student.avatarKey}
            avatars={avatarChoices()}
          />
        </Card>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Card className="p-5 sm:p-6">
            <StatusForm studentId={student.id} status={student.status} />
          </Card>
          <Card className="p-5 sm:p-6">
            <BandForm studentId={student.id} band={student.band} />
          </Card>
        </div>
      </Section>

      <ConsentSection student={student} />

      <Section
        id="alias-title"
        title={t.alias.title}
        icon={<Trophy aria-hidden="true" className="size-6 text-sun-700" />}
      >
        <p className="mt-2 text-ink-soft">{t.alias.intro}</p>
        <Card className="mt-4 space-y-4 p-5 sm:p-6">
          <p className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-ink">{student.leaderboardAlias ?? t.alias.none}</span>
            {student.leaderboardAlias ? (
              <Badge tone={student.aliasApprovedAt ? "brand" : "sun"}>
                {student.aliasApprovedAt ? t.alias.approved : t.alias.pending}
              </Badge>
            ) : null}
          </p>
          <AliasForms
            studentId={student.id}
            alias={student.leaderboardAlias}
            approved={Boolean(student.aliasApprovedAt)}
          />
        </Card>
      </Section>

      <Section
        id="code-title"
        title={t.loginCode.title}
        icon={<KeyRound aria-hidden="true" className="size-6 text-lagoon-700" />}
      >
        <p className="mt-2 text-ink-soft">{t.loginCode.intro}</p>
        <Card className="mt-4 p-5 sm:p-6">
          {!active ? <p className="mb-4 font-semibold text-ink-soft">{vi.errors.STUDENT_INACTIVE}</p> : null}
          <IssueCodeForm studentId={student.id} studentName={student.displayName} disabled={!active} />
        </Card>
        <h3 className="mt-6 text-lg font-extrabold text-ink">{t.loginCode.history}</h3>
        {student.codes.length === 0 ? (
          <p className="mt-2 text-ink-soft">{t.loginCode.none}</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {student.codes.map((code) => (
              <CodeRow key={code.id} code={code} />
            ))}
          </ul>
        )}
      </Section>

      <Section
        id="devices-title"
        title={t.devices.title}
        icon={<Smartphone aria-hidden="true" className="size-6 text-magic-700" />}
      >
        <p className="mt-2 text-ink-soft">{t.devices.intro}</p>
        {student.devices.length === 0 ? (
          <p className="mt-4 text-ink-soft">{t.devices.none}</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {student.devices.map((device, index) => (
              <li key={device.id}>
                <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div>
                    <p className="flex flex-wrap items-center gap-2 font-bold text-ink">
                      {t.devices.label.replace("{n}", String(student.devices.length - index))}
                      <Badge tone={device.revokedAt ? "neutral" : "brand"}>
                        {device.revokedAt ? t.devices.revoked : t.devices.active}
                      </Badge>
                    </p>
                    <p className="mt-1 text-sm text-ink-soft">
                      {t.devices.linked}: {formatDate(device.linkedAt, true)} · {t.devices.lastSeen}:{" "}
                      {device.lastSeenAt ? formatDate(device.lastSeenAt, true) : t.devices.never}
                    </p>
                  </div>
                  {!device.revokedAt ? <RevokeButton kind="device" id={device.id} label={t.devices.revoke} /> : null}
                </Card>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </>
  );
}

function CodeRow({ code }: { code: StudentDetail["codes"][number] }) {
  const c = vi.studentPage.loginCode;
  const { expired } = code;
  const tone: BadgeTone = code.revokedAt || expired ? "neutral" : "brand";
  const label = code.revokedAt
    ? `${c.revoked} (${c.reasons[code.revokeReason as keyof typeof c.reasons] ?? ""})`
    : expired
      ? c.expired
      : c.active;
  return (
    <li>
      <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <p className="flex flex-wrap items-center gap-2 font-bold text-ink">
            {formatDate(code.createdAt, true)}
            <Badge tone={tone}>{label}</Badge>
          </p>
          <p className="mt-1 text-sm text-ink-soft">
            {c.expires}: {formatDate(code.expiresAt)} ·{" "}
            {c.usage.replace("{used}", String(code.devicesLinked)).replace("{max}", String(code.maxDevices))}
          </p>
        </div>
        {!code.revokedAt && !expired ? <RevokeButton kind="code" id={code.id} label={c.revoke} /> : null}
      </Card>
    </li>
  );
}

function ConsentSection({ student }: { student: StudentDetail }) {
  const c = vi.consent;
  const toneOf: Record<string, BadgeTone> = { none: "neutral", granted: "brand", withdrawn: "coral" };
  return (
    <Section
      id="consent-title"
      title={c.title}
      icon={<ShieldCheck aria-hidden="true" className="size-6 text-brand-700" />}
    >
      <p className="mt-2 text-ink-soft">{c.intro}</p>
      <Notice tone="progress" title={vi.status.inDevelopment} className="mt-4">
        {c.draftNotice}
      </Notice>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {CONSENT_SCOPES.map((scope) => {
          const state = consentStateFor(student.consents, scope);
          return (
            <Card as="section" key={scope} aria-labelledby={`consent-${scope}-title`} className="space-y-4 p-5 sm:p-6">
              <div>
                <h3
                  id={`consent-${scope}-title`}
                  className="flex flex-wrap items-center gap-2 text-lg font-extrabold text-ink"
                >
                  {c.scopes[scope].title}
                  <Badge tone={toneOf[state.state]}>{c.states[state.state]}</Badge>
                </h3>
                <p className="mt-2 text-sm text-ink-soft">{c.scopes[scope].text}</p>
                {state.state !== "none" ? (
                  <p className="mt-2 text-sm text-ink-soft">
                    {c.recordedAt
                      .replace("{date}", formatDate(state.record.recordedAt))
                      .replace("{version}", state.record.noticeVersion)}
                    {state.state === "withdrawn" && state.record.withdrawnAt
                      ? ` · ${c.withdrawnAt.replace("{date}", formatDate(state.record.withdrawnAt))}`
                      : ""}
                  </p>
                ) : null}
              </div>
              {state.state === "granted" ? (
                <WithdrawConsentForm studentId={student.id} scope={scope} />
              ) : (
                <RecordConsentForm studentId={student.id} scope={scope} />
              )}
            </Card>
          );
        })}
      </div>
    </Section>
  );
}
