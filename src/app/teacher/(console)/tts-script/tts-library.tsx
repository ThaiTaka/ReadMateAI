"use client";

import { useState } from "react";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import { inputClass } from "@/components/forms/form-controls";
import type { LineState } from "@/features/tts-library/state";
import { generateMissing, generateOne, reviewScript, reviewVersion, revokeVersion } from "@/server/tts-library/actions";
import { vi } from "@/strings/vi";
import { ActionNoteView, formatSeconds, useAction } from "../audio/use-action";

export type LibraryLine = {
  id: string;
  text: string;
  purpose: "instruction" | "feedback";
  usedBy: string;
  attention: string[];
  state: LineState;
};

type Props = {
  lines: readonly LibraryLine[];
  libraryEnabled: boolean;
  providerReady: boolean;
  bulkLimit: number;
};

const AUDIO_TONE: Record<LineState["audioStatus"], BadgeTone> = {
  missing: "neutral",
  pending_review: "lagoon",
  approved: "brand",
  rejected: "coral",
  revoked: "coral",
};

const SCRIPT_TONE: Record<LineState["scriptStatus"], BadgeTone> = {
  pending: "sun",
  approved: "brand",
  rejected: "coral",
};

/** Quản lý thư viện giọng máy cho lời hướng dẫn và phản hồi cố định (R10.5). Mọi thao tác đi qua Server Action đã xác thực giáo viên. */
export function TtsLibrary({ lines, libraryEnabled, providerReady, bulkLimit }: Props) {
  const t = vi.ttsLibrary;
  const bulk = useAction();
  const counts = {
    total: lines.length,
    usable: lines.filter((line) => line.state.usable).length,
    pending: lines.filter((line) => line.state.audioStatus === "pending_review").length,
    missing: lines.filter((line) => line.state.audioStatus === "missing").length,
  };

  return (
    <div className="mt-6 flex flex-col gap-6">
      <Notice tone="info" title={t.voiceTitle}>
        <p>{t.voiceText}</p>
      </Notice>
      {libraryEnabled ? null : (
        <Notice tone="progress" title={t.notices.disabledTitle}>
          <p>{t.notices.disabledText}</p>
        </Notice>
      )}
      {providerReady ? (
        <Notice title={t.notices.costTitle}>
          <p>{t.notices.costText}</p>
        </Notice>
      ) : (
        <Notice tone="progress" title={t.notices.noProviderTitle}>
          <p>{t.notices.noProviderText}</p>
        </Notice>
      )}

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label={t.title}>
        <Stat label={t.stats.total} value={counts.total} />
        <Stat label={t.stats.usable} value={counts.usable} testId="tts-stat-usable" />
        <Stat label={t.stats.pending} value={counts.pending} testId="tts-stat-pending" />
        <Stat label={t.stats.missing} value={counts.missing} />
      </dl>

      <div className="flex flex-col gap-2">
        <Button
          variant="outline"
          disabled={!libraryEnabled || !providerReady || bulk.pending}
          data-testid="tts-generate-missing"
          onClick={() =>
            bulk.run(async () => {
              const result = await generateMissing({});
              if (result.ok) {
                bulk.setNote({
                  kind: result.data.stoppedBy ? "error" : "ok",
                  text: (result.data.stoppedBy ? t.bulk.stopped : t.bulk.done)
                    .replace("{generated}", String(result.data.generated))
                    .replace("{skipped}", String(result.data.skipped)),
                });
              }
              return result;
            }, "")
          }
          className="self-start"
        >
          {bulk.pending ? t.bulk.working : t.bulk.button.replace("{n}", String(bulkLimit))}
        </Button>
        <ActionNoteView note={bulk.note?.text ? bulk.note : null} />
      </div>

      <ul className="flex flex-col gap-4">
        {lines.map((line) => (
          <li key={line.id}>
            <LineCard line={line} libraryEnabled={libraryEnabled} providerReady={providerReady} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function Stat({ label, value, testId }: { label: string; value: number; testId?: string }) {
  return (
    <Card className="p-4">
      <dt className="text-sm font-semibold text-ink-soft">{label}</dt>
      <dd className="mt-1 text-3xl font-extrabold text-ink" data-testid={testId}>
        {value}
      </dd>
    </Card>
  );
}

function LineCard({
  line,
  libraryEnabled,
  providerReady,
}: {
  line: LibraryLine;
  libraryEnabled: boolean;
  providerReady: boolean;
}) {
  const t = vi.ttsLibrary;
  const { state } = line;
  const script = useAction();
  const generate = useAction();
  const review = useAction();
  const revoke = useAction();
  const [confirmScript, setConfirmScript] = useState(false);
  const [scriptNote, setScriptNote] = useState("");
  const [listened, setListened] = useState(false);
  const [pronunciation, setPronunciation] = useState(false);
  const [note, setNote] = useState("");
  const [reason, setReason] = useState("");
  const version = state.currentVersion;
  const idBase = line.id.replace(/[^a-z0-9]/giu, "_");

  return (
    <Card as="article" aria-label={line.id} data-line={line.id} className="flex flex-col gap-4 p-5">
      <div>
        <p className="text-xl font-bold leading-relaxed text-ink">“{line.text}”</p>
        <p className="mt-1 text-sm text-ink-soft">{t.usedBy.replace("{where}", line.usedBy)}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Badge tone="lagoon">{t.purposes[line.purpose]}</Badge>
        <Badge tone={SCRIPT_TONE[state.scriptStatus]}>{t.script[state.scriptStatus]}</Badge>
        <Badge tone={AUDIO_TONE[state.audioStatus]}>{t.audio[state.audioStatus]}</Badge>
        {line.attention.map((flag) => (
          <Badge key={flag} tone="coral">
            {(vi.ttsScript.attention as Record<string, string>)[flag] ?? flag}
          </Badge>
        ))}
      </div>
      {state.staleApproved ? <p className="text-sm font-semibold text-coral-800">{t.audio.stale}</p> : null}

      <fieldset disabled={!libraryEnabled} className="flex flex-col gap-3 border-0 p-0">
        <legend className="sr-only">{t.script[state.scriptStatus]}</legend>
        {state.scriptStatus === "approved" ? (
          <details>
            <summary className="min-h-touch cursor-pointer font-semibold text-ink-soft">{t.script.withdraw}</summary>
            <ScriptRejectForm
              idBase={idBase}
              note={scriptNote}
              setNote={setScriptNote}
              pending={script.pending}
              onSubmit={() =>
                script.run(
                  () =>
                    reviewScript({
                      entryId: line.id,
                      decision: "reject",
                      pronunciationConfirmed: false,
                      note: scriptNote,
                    }),
                  t.script.rejected_ok,
                )
              }
            />
          </details>
        ) : (
          <div className="flex flex-col gap-3">
            <label className="flex items-start gap-3 text-ink">
              <input
                type="checkbox"
                className="mt-1 size-5"
                checked={confirmScript}
                onChange={(event) => setConfirmScript(event.target.checked)}
              />
              <span>{t.script.confirm}</span>
            </label>
            <div className="flex flex-wrap gap-3">
              <Button
                disabled={!confirmScript || script.pending}
                onClick={() =>
                  script.run(
                    () =>
                      reviewScript({ entryId: line.id, decision: "approve", pronunciationConfirmed: confirmScript }),
                    t.script.approved_ok,
                  )
                }
              >
                {script.pending ? t.script.approving : t.script.approve}
              </Button>
            </div>
            <details>
              <summary className="min-h-touch cursor-pointer font-semibold text-ink-soft">{t.script.reject}</summary>
              <ScriptRejectForm
                idBase={idBase}
                note={scriptNote}
                setNote={setScriptNote}
                pending={script.pending}
                onSubmit={() =>
                  script.run(
                    () =>
                      reviewScript({
                        entryId: line.id,
                        decision: "reject",
                        pronunciationConfirmed: false,
                        note: scriptNote,
                      }),
                    t.script.rejected_ok,
                  )
                }
              />
            </details>
          </div>
        )}
        <ActionNoteView note={script.note} />
      </fieldset>

      {state.scriptStatus === "approved" && !version ? (
        <div className="flex flex-col gap-2">
          <Button
            variant="outline"
            disabled={!libraryEnabled || !providerReady || generate.pending}
            onClick={() => generate.run(() => generateOne({ entryId: line.id }), t.audio.generated_ok)}
            className="self-start"
          >
            {generate.pending ? t.audio.generating : t.audio.generate}
          </Button>
          <ActionNoteView note={generate.note} />
        </div>
      ) : state.scriptStatus !== "approved" ? (
        <p className="text-sm text-ink-soft">{t.audio.needScript}</p>
      ) : null}

      {version ? (
        <div className="flex flex-col gap-3 rounded-2xl border border-line bg-surface-muted p-4">
          <p className="text-sm font-semibold text-ink-soft">
            {t.audio.duration.replace("{seconds}", formatSeconds(version.durationMs))}
          </p>
          {/* Tệp riêng tư: máy chủ chỉ phát cho giáo viên của trường; không tự phát, chỉ tải khi bấm nghe. */}
          <audio
            controls
            preload="none"
            aria-label={`${t.audio.listen}: ${line.text}`}
            src={`/api/teacher/tts-library/versions/${version.id}/audio`}
            className="w-full"
          />
          {version.status === "pending_review" ? (
            <fieldset disabled={!libraryEnabled} className="flex flex-col gap-3 border-0 p-0">
              <label className="flex items-start gap-3 text-ink">
                <input
                  type="checkbox"
                  className="mt-1 size-5"
                  checked={listened}
                  onChange={(e) => setListened(e.target.checked)}
                />
                <span>{t.audio.listened}</span>
              </label>
              <label className="flex items-start gap-3 text-ink">
                <input
                  type="checkbox"
                  className="mt-1 size-5"
                  checked={pronunciation}
                  onChange={(e) => setPronunciation(e.target.checked)}
                />
                <span>{t.audio.pronunciation}</span>
              </label>
              <label className="flex flex-col gap-1 text-sm font-semibold text-ink-soft" htmlFor={`${idBase}-note`}>
                {t.audio.note}
                <input
                  id={`${idBase}-note`}
                  className={inputClass}
                  value={note}
                  maxLength={500}
                  onChange={(event) => setNote(event.target.value)}
                />
              </label>
              <div className="flex flex-wrap gap-3">
                <Button
                  disabled={!listened || !pronunciation || review.pending}
                  onClick={() =>
                    review.run(
                      () =>
                        reviewVersion({
                          versionId: version.id,
                          decision: "approve",
                          listened,
                          pronunciationConfirmed: pronunciation,
                          note,
                        }),
                      t.audio.approved_ok,
                    )
                  }
                >
                  {review.pending ? t.audio.saving : t.audio.approve}
                </Button>
                <Button
                  variant="outline"
                  disabled={note.trim().length < 3 || review.pending}
                  onClick={() =>
                    review.run(
                      () =>
                        reviewVersion({
                          versionId: version.id,
                          decision: "reject",
                          listened,
                          pronunciationConfirmed: false,
                          note,
                        }),
                      t.audio.rejected_ok,
                    )
                  }
                >
                  {t.audio.reject}
                </Button>
              </div>
              <ActionNoteView note={review.note} />
            </fieldset>
          ) : null}
          <details>
            <summary className="min-h-touch cursor-pointer font-semibold text-ink-soft">{t.audio.revoke}</summary>
            <div className="mt-2 flex flex-col gap-2">
              <label className="flex flex-col gap-1 text-sm font-semibold text-ink-soft" htmlFor={`${idBase}-revoke`}>
                {t.audio.revokeReason}
                <input
                  id={`${idBase}-revoke`}
                  className={inputClass}
                  value={reason}
                  maxLength={300}
                  onChange={(event) => setReason(event.target.value)}
                />
              </label>
              <Button
                variant="outline"
                disabled={reason.trim().length < 3 || revoke.pending}
                onClick={() => revoke.run(() => revokeVersion({ versionId: version.id, reason }), t.audio.revoked_ok)}
                className="self-start"
              >
                {t.audio.revoke}
              </Button>
              <ActionNoteView note={revoke.note} />
            </div>
          </details>
        </div>
      ) : null}
    </Card>
  );
}

function ScriptRejectForm({
  idBase,
  note,
  setNote,
  pending,
  onSubmit,
}: {
  idBase: string;
  note: string;
  setNote: (value: string) => void;
  pending: boolean;
  onSubmit: () => void;
}) {
  const t = vi.ttsLibrary.script;
  return (
    <div className="mt-2 flex flex-col gap-2">
      <label className="flex flex-col gap-1 text-sm font-semibold text-ink-soft" htmlFor={`${idBase}-script-note`}>
        {t.rejectNote}
        <input
          id={`${idBase}-script-note`}
          className={inputClass}
          value={note}
          maxLength={500}
          onChange={(event) => setNote(event.target.value)}
        />
      </label>
      <Button variant="outline" disabled={note.trim().length < 3 || pending} onClick={onSubmit} className="self-start">
        {t.reject}
      </Button>
    </div>
  );
}
