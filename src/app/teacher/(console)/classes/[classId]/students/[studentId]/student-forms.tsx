"use client";

import { Ban, CheckCheck, KeyRound, Printer, ShieldCheck, Undo2 } from "lucide-react";
import { useActionState } from "react";
import { AvatarPicker, type AvatarChoice } from "@/components/forms/avatar-picker";
import { Field, FormMessage, SelectInput, SubmitButton, TextInput } from "@/components/forms/form-controls";
import { Button } from "@/components/ui/button";
import { CONSENT_METHODS, CONSENT_NOTICES, type ConsentScope } from "@/features/consent/consent";
import {
  approveLeaderboardAlias,
  assignBand,
  issueLoginCode,
  recordConsent,
  revokeDevice,
  revokeLoginCode,
  setLeaderboardAlias,
  setStudentStatus,
  updateStudent,
  withdrawConsent,
  type ActionState,
  type IssueCodeState,
} from "@/server/teacher/actions";
import { vi } from "@/strings/vi";

const INITIAL: ActionState = { status: "idle" };
const t = vi.studentPage;

type ProfileProps = {
  studentId: string;
  displayName: string;
  studentNumber: number | null;
  avatarKey: string;
  avatars: AvatarChoice[];
};

export function ProfileForm({ studentId, displayName, studentNumber, avatarKey, avatars }: ProfileProps) {
  const [state, formAction] = useActionState(updateStudent.bind(null, studentId), INITIAL);
  return (
    <form action={formAction} className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-[2fr_1fr]">
        <Field id="profile-name" label={t.profile.displayName} hint={vi.studentsPage.create.displayNameHint}>
          <TextInput
            id="profile-name"
            name="displayName"
            defaultValue={displayName}
            required
            maxLength={30}
            autoComplete="off"
          />
        </Field>
        <Field id="profile-number" label={t.profile.studentNumber}>
          <TextInput
            id="profile-number"
            name="studentNumber"
            type="number"
            min={1}
            max={99}
            inputMode="numeric"
            defaultValue={studentNumber ?? ""}
          />
        </Field>
      </div>
      <AvatarPicker legend={t.profile.avatar} name="avatarKey" choices={avatars} defaultValue={avatarKey} />
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton>{t.profile.save}</SubmitButton>
        <FormMessage state={state} successText={vi.common.saved} />
      </div>
    </form>
  );
}

export function StatusForm({ studentId, status }: { studentId: string; status: string }) {
  const [state, formAction] = useActionState(setStudentStatus.bind(null, studentId), INITIAL);
  return (
    <form action={formAction} className="space-y-3">
      <Field id="student-status" label={t.status.title} hint={t.status.help}>
        <SelectInput id="student-status" name="status" defaultValue={status} aria-describedby="student-status-hint">
          <option value="active">{t.status.active}</option>
          <option value="paused">{t.status.paused}</option>
          <option value="archived">{t.status.archived}</option>
        </SelectInput>
      </Field>
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton variant="outline">{t.status.save}</SubmitButton>
        <FormMessage state={state} successText={vi.common.saved} />
      </div>
    </form>
  );
}

export function BandForm({ studentId, band }: { studentId: string; band: string | null }) {
  const [state, formAction] = useActionState(assignBand.bind(null, studentId), INITIAL);
  return (
    <form action={formAction} className="space-y-3">
      <Field id="student-band" label={t.band.title} hint={t.band.hiddenNote}>
        <SelectInput id="student-band" name="band" defaultValue={band ?? "none"} aria-describedby="student-band-hint">
          <option value="none">{t.band.none}</option>
          {(Object.keys(vi.bands) as Array<keyof typeof vi.bands>).map((key) => (
            <option key={key} value={key}>
              {vi.bands[key]}
            </option>
          ))}
        </SelectInput>
      </Field>
      <Field id="student-band-reason" label={t.band.reason}>
        <TextInput id="student-band-reason" name="reason" maxLength={200} autoComplete="off" />
      </Field>
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton variant="outline">{t.band.save}</SubmitButton>
        <FormMessage state={state} successText={vi.common.saved} />
      </div>
    </form>
  );
}

export function AliasForms({
  studentId,
  alias,
  approved,
}: {
  studentId: string;
  alias: string | null;
  approved: boolean;
}) {
  const [state, formAction] = useActionState(setLeaderboardAlias.bind(null, studentId), INITIAL);
  const [approveState, approveAction] = useActionState(async () => approveLeaderboardAlias(studentId), INITIAL);
  return (
    <div className="space-y-4">
      <form action={formAction} className="space-y-3">
        <Field id="student-alias" label={t.alias.label} hint={t.alias.clearHint}>
          <TextInput
            id="student-alias"
            name="alias"
            defaultValue={alias ?? ""}
            maxLength={20}
            autoComplete="off"
            aria-describedby="student-alias-hint"
          />
        </Field>
        <div className="flex flex-wrap items-center gap-3">
          <SubmitButton variant="outline">{t.alias.save}</SubmitButton>
          <FormMessage state={state} successText={vi.common.saved} />
        </div>
      </form>
      {alias && !approved ? (
        <form action={approveAction} className="flex flex-wrap items-center gap-3">
          <SubmitButton>
            <CheckCheck aria-hidden="true" className="size-5" />
            {t.alias.approve}
          </SubmitButton>
          <FormMessage state={approveState} />
        </form>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// Đồng ý
// ---------------------------------------------------------------------------------------------------------------

export function RecordConsentForm({ studentId, scope }: { studentId: string; scope: ConsentScope }) {
  const c = vi.consent.record;
  const [state, formAction] = useActionState(recordConsent.bind(null, studentId), INITIAL);
  const id = `consent-${scope}`;
  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="scope" value={scope} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field id={`${id}-notice`} label={c.notice}>
          <SelectInput id={`${id}-notice`} name="noticeVersion" defaultValue={CONSENT_NOTICES[0].version}>
            {CONSENT_NOTICES.map((notice) => (
              <option key={notice.version} value={notice.version}>
                {notice.label}
              </option>
            ))}
          </SelectInput>
        </Field>
        <Field id={`${id}-method`} label={c.method}>
          <SelectInput id={`${id}-method`} name="method" defaultValue="paper_form">
            {CONSENT_METHODS.map((method) => (
              <option key={method} value={method}>
                {c.methods[method]}
              </option>
            ))}
          </SelectInput>
        </Field>
      </div>
      <Field id={`${id}-note`} label={c.note}>
        <TextInput id={`${id}-note`} name="note" maxLength={200} autoComplete="off" />
      </Field>
      <label className="flex min-h-touch items-start gap-3 rounded-2xl bg-surface-muted p-3 font-semibold text-ink">
        <input type="checkbox" name="attested" value="yes" required className="mt-1 size-5 shrink-0 accent-brand-600" />
        {c.attest}
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton>
          <ShieldCheck aria-hidden="true" className="size-5" />
          {c.submit}
        </SubmitButton>
        <FormMessage state={state} successText={vi.common.saved} />
      </div>
    </form>
  );
}

export function WithdrawConsentForm({ studentId, scope }: { studentId: string; scope: ConsentScope }) {
  const c = vi.consent.withdraw;
  const [state, formAction] = useActionState(withdrawConsent.bind(null, studentId), INITIAL);
  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="scope" value={scope} />
      <label className="flex min-h-touch items-start gap-3 rounded-2xl bg-surface-muted p-3 font-semibold text-ink">
        <input type="checkbox" name="confirm" value="yes" required className="mt-1 size-5 shrink-0 accent-coral-600" />
        {c.confirm}
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton variant="outline">
          <Undo2 aria-hidden="true" className="size-5" />
          {c.submit}
        </SubmitButton>
        <FormMessage state={state} />
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// Thẻ học và thiết bị
// ---------------------------------------------------------------------------------------------------------------

const ISSUE_INITIAL: IssueCodeState = { status: "idle" };

export function IssueCodeForm({
  studentId,
  studentName,
  disabled,
}: {
  studentId: string;
  studentName: string;
  disabled: boolean;
}) {
  const c = t.loginCode;
  const [state, formAction] = useActionState(issueLoginCode.bind(null, studentId), ISSUE_INITIAL);
  return (
    <div className="space-y-5">
      <form action={formAction} className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <Field id="code-days" label={c.validDays}>
          <SelectInput id="code-days" name="validDays" defaultValue="14" disabled={disabled}>
            {[1, 7, 14, 30].map((days) => (
              <option key={days} value={days}>
                {days}
              </option>
            ))}
          </SelectInput>
        </Field>
        <Field id="code-devices" label={c.maxDevices}>
          <SelectInput id="code-devices" name="maxDevices" defaultValue="3" disabled={disabled}>
            {[1, 2, 3, 4, 5].map((count) => (
              <option key={count} value={count}>
                {count}
              </option>
            ))}
          </SelectInput>
        </Field>
        <SubmitButton pendingLabel={c.issuing} disabled={disabled}>
          <KeyRound aria-hidden="true" className="size-5" />
          {c.issue}
        </SubmitButton>
      </form>
      {state.status === "error" ? <FormMessage state={state} /> : null}
      {state.status === "issued" ? <IssuedCard code={state.code} studentName={studentName} /> : null}
    </div>
  );
}

function IssuedCard({
  code,
  studentName,
}: {
  code: Extract<IssueCodeState, { status: "issued" }>["code"];
  studentName: string;
}) {
  const c = t.loginCode;
  const size = code.qr.length;
  const dark = code.qr.flatMap((row, y) =>
    [...row].flatMap((cell, x) => (cell === "1" ? [`M${x + 4} ${y + 4}h1v1h-1z`] : [])),
  );
  return (
    <section
      aria-labelledby="issued-code-title"
      className="rounded-3xl border-4 border-dashed border-brand-600 bg-surface p-5 print:border-solid"
    >
      <h3 id="issued-code-title" className="text-xl font-extrabold text-ink">
        {c.issuedTitle}
      </h3>
      <p className="mt-1 text-sm font-semibold text-coral-800">{c.issuedNote}</p>
      <div className="mt-4 flex flex-col gap-5 sm:flex-row sm:items-center">
        <svg
          role="img"
          aria-label={c.qrLabel.replace("{name}", studentName)}
          viewBox={`0 0 ${size + 8} ${size + 8}`}
          className="size-48 shrink-0 rounded-xl bg-white"
          shapeRendering="crispEdges"
        >
          <rect width={size + 8} height={size + 8} fill="#ffffff" />
          <path d={dark.join("")} fill="#000000" />
        </svg>
        <dl className="min-w-0 space-y-3">
          <div>
            <dt className="text-sm font-semibold text-ink-soft">{vi.studentPage.profile.displayName}</dt>
            <dd className="text-lg font-extrabold text-ink">{studentName}</dd>
          </div>
          <div>
            <dt className="text-sm font-semibold text-ink-soft">{c.backup}</dt>
            <dd className="font-reading text-3xl font-bold tracking-[0.2em] text-ink">{code.backupCode}</dd>
          </div>
          <div>
            <dt className="text-sm font-semibold text-ink-soft">{c.expires}</dt>
            <dd className="text-ink">
              {new Intl.DateTimeFormat("vi-VN", { dateStyle: "long", timeZone: "Asia/Ho_Chi_Minh" }).format(
                new Date(code.expiresAt),
              )}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-semibold text-ink-soft">{c.link}</dt>
            <dd className="break-all text-xs text-ink-soft">{code.joinUrl}</dd>
          </div>
        </dl>
      </div>
      <Button type="button" variant="outline" className="mt-4 print:hidden" onClick={() => window.print()}>
        <Printer aria-hidden="true" className="size-5" />
        {c.print}
      </Button>
    </section>
  );
}

export function RevokeButton({ kind, id, label }: { kind: "code" | "device"; id: string; label: string }) {
  const [state, formAction] = useActionState(
    async () => (kind === "code" ? revokeLoginCode(id) : revokeDevice(id)),
    INITIAL,
  );
  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <SubmitButton variant="outline" size="sm">
        <Ban aria-hidden="true" className="size-4" />
        {label}
      </SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}
