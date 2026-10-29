import Link from "next/link";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import type { Coverage, LineRow, UnitRow } from "@/features/audio-coverage/build";
import type { UnitState } from "@/features/audio-library/unit-state";
import { vi } from "@/strings/vi";

const t = vi.audioCoverage;

const UNIT_TONE: Record<UnitState, BadgeTone> = {
  approved: "lagoon",
  pending_review: "sun",
  draft: "neutral",
  rerecord: "coral",
  missing: "neutral",
};

const fill = (template: string, values: Record<string, string | number>) =>
  Object.entries(values).reduce((text, [key, value]) => text.replaceAll(`{${key}}`, String(value)), template);

function Stat({ label, value, note, testId }: { label: string; value: string; note?: string; testId: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <dt className="text-sm font-semibold text-ink-soft">{label}</dt>
      <dd className="mt-1">
        <span className="block text-2xl font-extrabold text-ink" data-testid={testId}>
          {value}
        </span>
        {note ? <span className="mt-1 block text-sm text-ink-soft">{note}</span> : null}
      </dd>
    </div>
  );
}

function UnitGrid({ rows, testId }: { rows: UnitRow[]; testId: string }) {
  return (
    <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3" data-testid={testId}>
      {rows.map((row) => (
        <li
          key={row.key}
          data-unit={row.key}
          data-state={row.state}
          className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-surface px-3 py-2"
        >
          <span className="text-ink">
            <span className="text-lg font-extrabold">{row.display}</span>
            <span className="ml-2 text-ink-soft">{row.label}</span>
            {row.needsDecision && !row.labelConfirmed ? (
              <span className="ml-2 text-xs font-semibold text-ink-faint">{t.needsDecision}</span>
            ) : null}
          </span>
          <Badge tone={UNIT_TONE[row.state]}>{t.states[row.state]}</Badge>
        </li>
      ))}
    </ul>
  );
}

function lineBadges(row: LineRow): Array<{ tone: BadgeTone; text: string }> {
  if (row.usable) return [{ tone: "lagoon", text: t.lineStates.usable }];
  const badges: Array<{ tone: BadgeTone; text: string }> = [];
  if (row.scriptStatus === "pending") badges.push({ tone: "neutral", text: t.lineStates.scriptPending });
  if (row.scriptStatus === "rejected") badges.push({ tone: "coral", text: t.lineStates.scriptRejected });
  const audioTone: BadgeTone =
    row.audioStatus === "pending_review" ? "sun" : row.audioStatus === "missing" ? "neutral" : "coral";
  badges.push({ tone: audioTone, text: vi.ttsLibrary.audio[row.audioStatus] });
  if (row.stale) badges.push({ tone: "coral", text: t.lineStates.stale });
  return badges;
}

function LineList({ rows, testId }: { rows: LineRow[]; testId: string }) {
  return (
    <ul className="mt-3 flex flex-col gap-2" data-testid={testId}>
      {rows.map((row) => (
        <li
          key={row.id}
          data-line={row.id}
          data-usable={row.usable ? "yes" : "no"}
          className="flex flex-col gap-2 rounded-xl border border-line bg-surface px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <span className="text-ink">{row.text}</span>
          <span className="flex flex-wrap gap-2">
            {lineBadges(row).map((badge) => (
              <Badge key={badge.text} tone={badge.tone}>
                {badge.text}
              </Badge>
            ))}
          </span>
        </li>
      ))}
    </ul>
  );
}

function Section({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="text-2xl font-extrabold leading-snug text-ink">{title}</h2>
      <p className="mt-1 text-ink-soft">{hint}</p>
      {children}
    </section>
  );
}

const names = (rows: UnitRow[]) => rows.map((row) => `${row.display} (${row.label})`).join(", ");

export function CoverageView({ coverage }: { coverage: Coverage }) {
  const c = coverage;
  const missingLetters = c.letters.rows.filter((row) => !row.valid);
  const missingPhonemes = c.phonemes.rows.filter((row) => !row.valid);
  const feedbackWired = c.feedback.rows.every((row) => row.wiredForStudents);
  const complete = c.lettersAndSoundsComplete && c.instructionsComplete;
  return (
    <>
      <div
        className={`mt-6 rounded-2xl border p-4 ${complete ? "border-lagoon-200 bg-lagoon-100" : "border-sun-200 bg-sun-100"}`}
        data-testid="coverage-verdict"
        data-complete={complete ? "yes" : "no"}
      >
        <p className="text-lg font-bold text-ink">
          {complete ? t.verdict.complete : fill(t.verdict.incomplete, { count: c.missingTotal })}
        </p>
        <p className="mt-1 text-ink-soft">{t.verdict.studentNote}</p>
      </div>

      <dl className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Stat
          label={t.stats.letters}
          testId="coverage-letters"
          value={fill(t.progress, { done: c.letters.counts.approved, total: c.letters.counts.total })}
        />
        <Stat
          label={t.stats.phonemes}
          testId="coverage-phonemes"
          value={fill(t.progress, { done: c.phonemes.counts.approved, total: c.phonemes.counts.total })}
        />
        <Stat
          label={t.stats.study}
          testId="coverage-study"
          value={fill(t.studyProgress, { done: c.study.ready, total: c.study.positions })}
          note={c.study.unmapped > 0 ? fill(t.studyUnmapped, { count: c.study.unmapped }) : t.studyAllMapped}
        />
        <Stat
          label={t.stats.instruction}
          testId="coverage-instruction"
          value={fill(t.progress, { done: c.instruction.usable, total: c.instruction.total })}
        />
        <Stat
          label={t.stats.feedback}
          testId="coverage-feedback"
          value={fill(t.progress, { done: c.feedback.usable, total: c.feedback.total })}
        />
      </dl>

      <div className="mt-6 rounded-2xl border border-line bg-surface p-4" data-testid="coverage-todo">
        <h2 className="text-xl font-extrabold text-ink">{t.todoTitle}</h2>
        {c.missingTotal === 0 ? <p className="mt-2 text-ink-soft">{t.allDone}</p> : null}
        {missingLetters.length > 0 ? (
          <p className="mt-2 text-ink">
            <strong>{t.stats.letters}.</strong> {fill(t.todoRecord, { items: names(missingLetters) })}
          </p>
        ) : null}
        {missingPhonemes.length > 0 ? (
          <p className="mt-2 text-ink">
            <strong>{t.stats.phonemes}.</strong> {fill(t.todoRecord, { items: names(missingPhonemes) })}
          </p>
        ) : null}
        {c.instruction.missing > 0 ? (
          <p className="mt-2 text-ink">
            <strong>{t.stats.instruction}.</strong> {fill(t.todoLines, { count: c.instruction.missing })}
          </p>
        ) : null}
        <p className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
          <Link href="/teacher/audio" className="font-semibold underline">
            {t.links.record}
          </Link>
          <Link href="/teacher/tts-script" className="font-semibold underline">
            {t.links.tts}
          </Link>
        </p>
      </div>

      <Section title={t.sections.letters.title} hint={t.sections.letters.hint}>
        <UnitGrid rows={c.letters.rows} testId="coverage-letters-list" />
      </Section>
      <Section title={t.sections.phonemes.title} hint={t.sections.phonemes.hint}>
        <UnitGrid rows={c.phonemes.rows} testId="coverage-phonemes-list" />
      </Section>
      <Section title={t.sections.instruction.title} hint={t.sections.instruction.hint}>
        <LineList rows={c.instruction.rows} testId="coverage-instruction-list" />
      </Section>
      <Section title={t.sections.feedback.title} hint={t.sections.feedback.hint}>
        {feedbackWired ? null : <p className="mt-2 font-semibold text-ink">{t.sections.feedback.notWired}</p>}
        <LineList rows={c.feedback.rows} testId="coverage-feedback-list" />
      </Section>

      <section className="mt-10 rounded-2xl border border-line bg-surface-muted p-4" data-testid="coverage-untracked">
        <h2 className="text-xl font-extrabold text-ink">{t.untracked.title}</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-ink-soft">
          <li>{fill(t.untracked.rimes, { count: c.rimes.total })}</li>
          <li>{t.untracked.words}</li>
        </ul>
      </section>
    </>
  );
}
