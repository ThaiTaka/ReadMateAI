import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import { VARIANTS } from "@/features/exercises/runtime-registry";
import type { TtsExcluded, TtsScriptEntry } from "@/server/tts/catalog";
import { vi } from "@/strings/vi";

type TtsScriptListProps = {
  entries: readonly TtsScriptEntry[];
  excluded: readonly TtsExcluded[];
};

const LEVELS = [3, 2, 1, 0] as const;

/**
 * Danh sách lời đọc giọng máy để giáo viên xem trước (R10.3b1). CHỈ ĐỌC: không nút duyệt, không phát âm thanh, không gọi
 * nhà cung cấp. Dữ liệu là học liệu/chuỗi cố định, không có thông tin học sinh.
 */
export function TtsScriptList({ entries, excluded }: TtsScriptListProps) {
  const t = vi.ttsScript;
  const excludedByCode = new Map<string, number>();
  for (const item of excluded) excludedByCode.set(item.code, (excludedByCode.get(item.code) ?? 0) + 1);
  const reasons: Record<string, string> = t.excludedReasons;

  return (
    <div className="mt-6 flex flex-col gap-6">
      <Notice tone="progress" title={t.banner}>
        <p>{t.bannerText}</p>
      </Notice>
      <Notice title={t.differenceTitle}>
        <p>{t.differenceText}</p>
      </Notice>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="Thống kê lời đọc">
        <Stat label={t.stats.total} value={entries.length} />
        <Stat label={t.stats.pending} value={entries.filter((e) => e.reviewStatus === "pending_review").length} />
        <Stat label={t.stats.approved} value={0} />
        <Stat label={t.stats.excluded} value={excluded.length} />
      </dl>

      {entries.length === 0 ? (
        <p className="text-ink-soft">{t.empty}</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {entries.map((entry) => (
            <li key={entry.id}>
              <Card as="article" aria-label={entry.id} className="flex flex-col gap-3 p-5">
                <p className="text-xl font-bold leading-relaxed text-ink">“{entry.text}”</p>
                <div className="flex flex-wrap gap-2">
                  <Badge tone="lagoon">{t.purposes[entry.purpose]}</Badge>
                  <Badge tone="sun">{t.status[entry.reviewStatus]}</Badge>
                  {entry.voice.configVersion.startsWith("provisional") ? (
                    <Badge tone="neutral">{t.voiceNotChosen}</Badge>
                  ) : null}
                  {entry.attention.map((flag) => (
                    <Badge key={flag} tone="coral">
                      {t.attention[flag]}
                    </Badge>
                  ))}
                </div>
                <p className="text-sm text-ink-soft">{entry.usageNote}</p>
                <dl className="grid gap-2 text-sm sm:grid-cols-2">
                  <Field label={t.entryLabels.voice}>
                    {entry.voice.voiceKey}, {entry.voice.speed === "slow" ? t.voiceSlow : t.voiceNormal}
                  </Field>
                  <Field label={t.entryLabels.source}>{entry.source.ref}</Field>
                  <Field label={t.entryLabels.usedIn}>
                    {entry.usages
                      .map((usage) => (usage.variantId ? VARIANTS[usage.variantId].title : t.entryLabels.allKinds))
                      .join("; ")}
                  </Field>
                  <Field label={t.entryLabels.levels}>
                    {LEVELS.map((level) => `H${level}: ${t.availability[entry.usages[0]!.availability[level]]}`).join(
                      " · ",
                    )}
                  </Field>
                </dl>
                <button
                  type="button"
                  disabled
                  className="min-h-12 w-fit rounded-full border-2 border-dashed border-line-strong px-5 font-semibold text-ink-soft"
                >
                  {t.approveSoon}
                </button>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {excluded.length > 0 ? (
        <section aria-labelledby="tts-excluded" className="rounded-card border border-line bg-surface p-5">
          <h2 id="tts-excluded" className="text-lg font-bold text-ink">
            {t.excludedTitle}
          </h2>
          <p className="mt-1 text-sm text-ink-soft">{t.excludedText}</p>
          <ul className="mt-3 list-disc pl-6 text-ink">
            {[...excludedByCode.entries()].map(([code, count]) => (
              <li key={code}>
                {reasons[code] ?? t.excludedReasons.other}: {count}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <dt className="text-sm text-ink-soft">{label}</dt>
      <dd className="text-2xl font-extrabold text-ink">{value}</dd>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="font-semibold text-ink">{label}</dt>
      <dd className="text-ink-soft">{children}</dd>
    </div>
  );
}
