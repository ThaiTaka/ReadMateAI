import { Badge } from "@/components/ui/badge";
import type { ContestEntry } from "@/features/contest-audio/catalog";
import type { ContestOverview } from "@/features/contest-audio/overview";
import { vi } from "@/strings/vi";

const t = vi.contestTeacher;

const fill = (template: string, values: Record<string, string | number>) =>
  Object.entries(values).reduce((text, [key, value]) => text.replaceAll(`{${key}}`, String(value)), template);

function Stat({ label, value, testId }: { label: string; value: number; testId: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <dt className="text-sm font-semibold text-ink-soft">{label}</dt>
      <dd className="mt-1 text-2xl font-extrabold text-ink" data-testid={testId}>
        {value}
      </dd>
    </div>
  );
}

function Names({ entries, testId }: { entries: readonly ContestEntry[]; testId: string }) {
  if (entries.length === 0) return <p className="mt-2 text-ink-soft">{t.none}</p>;
  return (
    <ul className="mt-3 flex flex-wrap gap-2" data-testid={testId}>
      {entries.map((entry) => (
        <li
          key={entry.id}
          data-entry={entry.id}
          className="rounded-xl border border-line bg-surface px-3 py-1.5 text-ink"
          title={entry.id}
        >
          <span className="text-xs font-semibold text-ink-faint">{t.kinds[entry.kind]}</span>{" "}
          <span className="font-extrabold">
            {entry.kind === "letter" || entry.kind === "phoneme" ? entry.unit : entry.text}
          </span>
          {entry.kind === "letter" || entry.kind === "phoneme" ? (
            <span className="ml-1 text-ink-soft">{entry.text}</span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

/**
 * Âm thanh TRÌNH DIỄN cho giáo viên (docs/CONTEST_AUDIO.md). Bốn nhóm riêng biệt; không bao giờ cộng vào số liệu "đã duyệt" ở trên.
 */
export function ContestSection({ overview }: { overview: ContestOverview }) {
  return (
    <section className="mt-12 rounded-3xl border-2 border-dashed border-line-strong p-5" data-testid="contest-section">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-2xl font-extrabold leading-snug text-ink">{t.title}</h2>
        <Badge tone="sun">{vi.contest.chip}</Badge>
      </div>
      <p className="mt-2 text-ink-soft">{t.intro}</p>
      <p className="mt-1 text-sm font-semibold text-ink-soft">{t.onlyLocal}</p>

      <dl className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={t.stats.auto} value={overview.auto.length} testId="contest-auto" />
        <Stat label={t.stats.missing} value={overview.missing.length} testId="contest-missing" />
        <Stat label={t.stats.verify} value={overview.needsVerification.length} testId="contest-verify" />
        <Stat label={t.stats.stale} value={overview.stale.length} testId="contest-stale" />
      </dl>
      <p className="mt-3 font-semibold text-ink" data-testid="contest-total">
        {fill(t.total, { auto: overview.auto.length, total: overview.total })}
      </p>
      <ul className="mt-2 flex flex-wrap gap-2 text-sm text-ink-soft">
        {Object.entries(overview.byKind).map(([kind, counts]) => (
          <li key={kind} className="rounded-full border border-line px-3 py-1">
            {t.kinds[kind as keyof typeof t.kinds]}: {counts.auto}/{counts.total}
          </li>
        ))}
      </ul>

      <div className="mt-6" data-testid="contest-group-auto">
        <h3 className="text-xl font-extrabold text-ink">{t.groups.auto.title}</h3>
        <p className="text-ink-soft">{t.groups.auto.hint}</p>
        <Names entries={overview.auto} testId="contest-auto-list" />
      </div>
      <div className="mt-6" data-testid="contest-group-verify">
        <h3 className="text-xl font-extrabold text-ink">{t.groups.verify.title}</h3>
        <p className="text-ink-soft">{t.groups.verify.hint}</p>
        <ul className="mt-3 flex flex-wrap gap-2" data-testid="contest-verify-list">
          {overview.needsVerification.map(({ entry, hasFile }) => (
            <li
              key={entry.id}
              data-entry={entry.id}
              data-file={hasFile ? "yes" : "no"}
              className="flex items-center gap-2 rounded-xl border border-line bg-surface px-3 py-1.5 text-ink"
            >
              <span className="text-xs font-semibold text-ink-faint">{t.kinds[entry.kind]}</span>
              <span className="font-extrabold">{entry.unit}</span>
              <span className="text-ink-soft">{entry.text}</span>
              <Badge tone={hasFile ? "sun" : "neutral"}>
                {hasFile ? t.groups.verify.withFile : t.groups.verify.noFile}
              </Badge>
            </li>
          ))}
        </ul>
      </div>
      <div className="mt-6" data-testid="contest-group-missing">
        <h3 className="text-xl font-extrabold text-ink">{t.groups.missing.title}</h3>
        <p className="text-ink-soft">{t.groups.missing.hint}</p>
        <Names entries={overview.missing} testId="contest-missing-list" />
      </div>
      {overview.stale.length > 0 ? (
        <div className="mt-6" data-testid="contest-group-stale">
          <h3 className="text-xl font-extrabold text-ink">{t.groups.stale.title}</h3>
          <p className="text-ink-soft">{t.groups.stale.hint}</p>
          <Names entries={overview.stale} testId="contest-stale-list" />
        </div>
      ) : null}
    </section>
  );
}
