"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Notice } from "@/components/ui/notice";
import { inputClass } from "@/components/forms/form-controls";
import type { AudioUnit, AudioUnitKind } from "@/features/audio-library/p0-catalog";
import {
  countStates,
  deriveUnitState,
  UNIT_STATES,
  type AssetSummary,
  type UnitState,
} from "@/features/audio-library/unit-state";
import { cn } from "@/lib/cn";
import { vi } from "@/strings/vi";
import { ConsentCard } from "./consent-card";
import { UnitPanel } from "./unit-panel";
import type { StudioContext } from "./version-list";

type Props = {
  units: readonly AudioUnit[];
  assets: readonly AssetSummary[];
  context: StudioContext;
};

const STATE_TONE: Record<UnitState, BadgeTone> = {
  missing: "neutral",
  draft: "sun",
  pending_review: "lagoon",
  approved: "brand",
  rerecord: "coral",
};

type Filter = "all" | UnitState;
type KindFilter = "all" | AudioUnitKind;
const KIND_FILTERS: readonly KindFilter[] = ["all", "letter", "phoneme"];

export function AudioStudio({ units, assets, context }: Props) {
  const t = vi.audioStudio;
  const [filter, setFilter] = useState<Filter>("all");
  const [kindFilter, setKindFilter] = useState<KindFilter>("all");
  const [query, setQuery] = useState("");
  const [openKey, setOpenKey] = useState<string | null>(null);

  const rows = useMemo(() => {
    const byKey = new Map(assets.map((asset) => [`${asset.unitKind}:${asset.unitText}`, asset]));
    return units.map((unit) => {
      const asset = byKey.get(unit.key);
      return { unit, asset, state: deriveUnitState(asset, context.userId) };
    });
  }, [units, assets, context.userId]);

  const counts = countStates(rows.map((row) => row.state));
  const needle = query.normalize("NFC").trim().toLowerCase();
  const visible = rows.filter(
    (row) =>
      (filter === "all" || row.state === filter) &&
      (kindFilter === "all" || row.unit.kind === kindFilter) &&
      (needle === "" ||
        row.unit.displayText.toLowerCase().includes(needle) ||
        row.unit.text.toLowerCase().startsWith(needle)),
  );

  return (
    <div className="mt-8 grid gap-8">
      {context.recordingEnabled ? null : (
        <Notice tone="progress" title={t.notice.previewTitle}>
          {t.notice.previewText}
        </Notice>
      )}
      <Notice tone="info" title={t.notice.trialTitle}>
        {t.notice.trialText}
      </Notice>

      <section aria-label={t.stats.total}>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Stat label={t.stats.total} value={counts.total} />
          {UNIT_STATES.map((state) => (
            <Stat key={state} label={t.stats[state]} value={counts[state]} />
          ))}
        </dl>
      </section>

      <ConsentCard consentActive={context.consentActive} recordingEnabled={context.recordingEnabled} />

      <section aria-labelledby="audio-list-title">
        <h2 id="audio-list-title" className="text-2xl font-extrabold text-ink">
          {t.filters.label}
        </h2>
        <div role="group" aria-label={t.filters.label} className="mt-3 flex flex-wrap gap-2">
          {(["all", ...UNIT_STATES] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={filter === value}
              onClick={() => setFilter(value)}
              className={cn(
                "min-h-touch rounded-full border-2 px-4 text-sm font-semibold transition-colors",
                filter === value
                  ? "border-brand-600 bg-brand-50 text-brand-800"
                  : "border-line-strong bg-surface text-ink-soft hover:border-brand-400",
              )}
            >
              {t.filters[value]}
            </button>
          ))}
        </div>
        <div role="group" aria-label={t.kindFilterLabel} className="mt-3 flex flex-wrap gap-2">
          {KIND_FILTERS.map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={kindFilter === value}
              onClick={() => setKindFilter(value)}
              className={cn(
                "min-h-touch rounded-full border-2 px-4 text-sm font-semibold transition-colors",
                kindFilter === value
                  ? "border-lagoon-600 bg-lagoon-50 text-lagoon-800"
                  : "border-line-strong bg-surface text-ink-soft hover:border-lagoon-400",
              )}
            >
              {t.kinds[value]}
            </button>
          ))}
        </div>
        <label htmlFor="audio-search" className="mt-4 block font-semibold text-ink">
          {t.filters.searchLabel}
        </label>
        <input
          id="audio-search"
          type="search"
          className={`${inputClass} mt-2 max-w-sm`}
          placeholder={t.filters.searchPlaceholder}
          value={query}
          autoComplete="off"
          onChange={(event) => setQuery(event.target.value)}
        />
        <p aria-live="polite" className="mt-3 text-sm text-ink-soft">
          {t.filters.resultCount.replace("{count}", String(visible.length))}
        </p>

        {visible.length === 0 ? (
          <EmptyState className="mt-4" icon={null} title={t.filters.noResult} description="" />
        ) : (
          <ul className="mt-4 grid gap-3">
            {visible.map(({ unit, asset, state }) => {
              const open = openKey === unit.key;
              const confirmed = Boolean(asset?.confirmedLabel);
              const panelId = `panel-${unit.key.replace(/[^a-z0-9]/giu, "_")}`;
              return (
                <li
                  key={unit.key}
                  data-unit={unit.key}
                  className="rounded-card border border-line bg-surface shadow-soft"
                >
                  <div className="flex flex-wrap items-center gap-3 p-4">
                    <span
                      className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-2xl font-extrabold text-brand-800"
                      aria-hidden="true"
                    >
                      {unit.displayText}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-extrabold text-ink">
                        {unit.displayText}{" "}
                        <span className="font-semibold text-ink-soft">
                          · {confirmed ? t.unit.confirmed : t.unit.proposed}: “
                          {asset?.confirmedLabel ?? unit.proposedLabel}”
                        </span>
                      </p>
                      <div className="mt-1 flex flex-wrap gap-2">
                        <Badge tone={unit.kind === "letter" ? "lagoon" : "sun"}>{t.kinds[unit.kind]}</Badge>
                        <Badge tone={STATE_TONE[state]}>{t.state[state]}</Badge>
                        {confirmed ? null : <Badge tone="sun">{t.unit.awaitingConfirm}</Badge>}
                        {asset?.activeVersionId ? <Badge tone="brand">{t.unit.active}</Badge> : null}
                      </div>
                      {unit.alsoCovers.length > 0 ? (
                        <p className="mt-1 text-sm text-ink-soft">
                          {t.unit.alsoCovers.replace("{letters}", unit.alsoCovers.join(", "))}
                        </p>
                      ) : null}
                      {unit.needsDecision && !confirmed ? (
                        <p className="mt-1 text-sm text-ink-soft">{t.unit.needsDecision}</p>
                      ) : null}
                    </div>
                    <Button
                      variant={open ? "outline" : "primary"}
                      aria-expanded={open}
                      aria-controls={panelId}
                      aria-label={(unit.kind === "letter" ? t.unit.openLabelLetter : t.unit.openLabel).replace(
                        "{unit}",
                        unit.displayText,
                      )}
                      onClick={() => setOpenKey(open ? null : unit.key)}
                    >
                      {open ? (
                        <ChevronUp aria-hidden="true" className="size-5" />
                      ) : (
                        <ChevronDown aria-hidden="true" className="size-5" />
                      )}
                      {open ? t.unit.close : t.unit.open}
                    </Button>
                  </div>
                  {open ? (
                    <div id={panelId} className="px-4 pb-5">
                      <UnitPanel unit={unit} asset={asset} context={context} />
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <Card variant="tinted" as="section" aria-labelledby="audio-help-title" className="p-5">
        <h2 id="audio-help-title" className="text-xl font-extrabold text-ink">
          {t.help.title}
        </h2>
        <ol className="mt-3 list-decimal space-y-1 pl-5 text-ink-soft">
          {t.help.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <Card className="p-4">
      <dt className="text-sm font-semibold text-ink-soft">{label}</dt>
      <dd className="mt-1 text-3xl font-extrabold text-ink">{value}</dd>
    </Card>
  );
}
