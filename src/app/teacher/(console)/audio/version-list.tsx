"use client";

import { Check, RotateCcw, Send, Trash2, Undo2 } from "lucide-react";
import { useId, useState } from "react";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { inputClass } from "@/components/forms/form-controls";
import { approvalBlocker } from "@/features/audio-library/review-rules";
import type { AssetSummary, VersionStatus, VersionSummary } from "@/features/audio-library/unit-state";
import {
  discardAudioVersion,
  revokeAudioVersion,
  reviewAudioVersion,
  submitAudioVersion,
} from "@/server/audio-library/actions";
import { vi } from "@/strings/vi";
import { ActionNoteView, formatSeconds, useAction } from "./use-action";

export type StudioContext = {
  userId: string;
  isAdmin: boolean;
  recordingEnabled: boolean;
  consentActive: boolean;
};

const STATUS_TONE: Record<VersionStatus, BadgeTone> = {
  draft: "sun",
  pending_review: "lagoon",
  approved: "brand",
  rejected: "coral",
  revoked: "coral",
  superseded: "neutral",
  discarded: "neutral",
};

type Props = {
  unitLabel: string;
  asset: AssetSummary | undefined;
  context: StudioContext;
};

export function VersionList({ unitLabel, asset, context }: Props) {
  const t = vi.audioStudio.versions;
  const versions = (asset?.versions ?? []).filter((v) => v.status !== "discarded");
  return (
    <section aria-label={t.title}>
      <h4 className="text-lg font-extrabold text-ink">{t.title}</h4>
      {versions.length === 0 ? (
        <p className="mt-2 text-sm text-ink-soft">{t.empty}</p>
      ) : (
        <ul className="mt-3 grid gap-3">
          {versions.map((version) => (
            <VersionItem key={version.id} unitLabel={unitLabel} asset={asset!} version={version} context={context} />
          ))}
        </ul>
      )}
    </section>
  );
}

function VersionItem({
  unitLabel,
  asset,
  version,
  context,
}: {
  unitLabel: string;
  asset: AssetSummary;
  version: VersionSummary;
  context: StudioContext;
}) {
  const t = vi.audioStudio.versions;
  const mine = version.createdBy === context.userId;
  const isActive = asset.activeVersionId === version.id;
  const [heard, setHeard] = useState(false);
  const submit = useAction();
  const discard = useAction();

  return (
    <li className="rounded-2xl border border-line bg-surface p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-extrabold text-ink">{t.version.replace("{no}", String(version.versionNo))}</span>
        <Badge tone={STATUS_TONE[version.status]}>{t.status[version.status]}</Badge>
        {isActive ? <Badge tone="brand">{t.active}</Badge> : null}
        <Badge>{mine ? t.yours : t.others}</Badge>
        <span className="text-sm text-ink-soft">
          {t.duration.replace("{seconds}", formatSeconds(version.durationMs))}
        </span>
        <span className="text-sm text-ink-soft">· “{version.spokenLabel}”</span>
      </div>

      <audio
        controls
        preload="none"
        className="mt-3 w-full"
        src={`/api/teacher/audio/versions/${version.id}/audio`}
        aria-label={t.listenLabel.replace("{no}", String(version.versionNo)).replace("{unit}", unitLabel)}
        onPlaying={() => setHeard(true)}
      />

      {version.reviewNote ? (
        <p className="mt-2 text-sm text-ink-soft">{t.reviewNote.replace("{note}", version.reviewNote)}</p>
      ) : null}
      {version.revokeReason ? (
        <p className="mt-2 text-sm text-ink-soft">{t.revokedReason.replace("{reason}", version.revokeReason)}</p>
      ) : null}

      {version.status === "draft" && mine ? (
        <div className="mt-3">
          <p className="text-sm text-ink-soft">{t.submitHint}</p>
          <div className="mt-2 flex flex-wrap gap-3">
            <Button
              disabled={!context.recordingEnabled || submit.pending || discard.pending}
              onClick={() =>
                submit.run(
                  () => submitAudioVersion({ versionId: version.id }),
                  vi.audioStudio.versions.status.pending_review,
                )
              }
            >
              <Send aria-hidden="true" className="size-5" />
              {submit.pending ? t.submitting : t.submit}
            </Button>
            <Button
              variant="outline"
              disabled={!context.recordingEnabled || submit.pending || discard.pending}
              onClick={() => discard.run(() => discardAudioVersion({ versionId: version.id }), t.status.discarded)}
            >
              <Trash2 aria-hidden="true" className="size-5" />
              {t.discard}
            </Button>
          </div>
          <ActionNoteView note={submit.note ?? discard.note} className="mt-2" />
        </div>
      ) : null}

      {version.status === "pending_review" ? (
        <ReviewForm asset={asset} version={version} context={context} unitLabel={unitLabel} heard={heard} />
      ) : null}

      {(version.status === "draft" || version.status === "pending_review" || version.status === "approved") &&
      (mine || context.isAdmin) ? (
        <RevokeForm versionId={version.id} />
      ) : null}
    </li>
  );
}

function ReviewForm({
  asset,
  version,
  context,
  unitLabel,
  heard,
}: {
  asset: AssetSummary;
  version: VersionSummary;
  context: StudioContext;
  unitLabel: string;
  heard: boolean;
}) {
  const t = vi.audioStudio.review;
  const id = useId();
  const [listened, setListened] = useState(false);
  const [note, setNote] = useState("");
  const action = useAction();

  const blocker = approvalBlocker({
    recordingEnabled: context.recordingEnabled,
    status: version.status,
    listened,
    confirmedLabel: asset.confirmedLabel,
    spokenLabel: version.spokenLabel,
    // Chỉ biết chắc đồng ý của chính mình; của người khác do CSDL kiểm tra.
    creatorConsentActive: version.createdBy === context.userId ? context.consentActive : undefined,
  });
  const canReject = context.recordingEnabled && note.trim().length >= 3 && !action.pending;

  return (
    <fieldset className="mt-4 rounded-2xl border border-lagoon-200 bg-lagoon-50 p-4">
      <legend className="px-2 font-extrabold text-ink">{t.title}</legend>
      <ul className="text-sm text-ink-soft">
        <li>{t.unit.replace("{unit}", unitLabel)}</li>
        <li>
          {asset.confirmedLabel
            ? t.expected.replace("{label}", asset.confirmedLabel)
            : vi.audioStudio.unit.awaitingConfirm}
        </li>
      </ul>
      <div className="mt-3 flex items-start gap-3">
        <input
          id={`${id}-listened`}
          type="checkbox"
          className="mt-1 size-6 shrink-0 accent-brand-600"
          checked={listened}
          disabled={!heard}
          onChange={(event) => setListened(event.target.checked)}
        />
        <label htmlFor={`${id}-listened`} className="font-semibold text-ink">
          {t.listenedCheck}
        </label>
      </div>
      {!heard ? <p className="mt-1 text-sm text-ink-soft">{t.blockers.LISTEN_REQUIRED}</p> : null}
      <label htmlFor={`${id}-note`} className="mt-3 block font-semibold text-ink">
        {t.note}
      </label>
      <textarea
        id={`${id}-note`}
        className={`${inputClass} mt-2 py-3`}
        rows={2}
        maxLength={500}
        value={note}
        onChange={(event) => setNote(event.target.value)}
      />
      {blocker && blocker !== "LISTEN_REQUIRED" ? (
        <p className="mt-2 text-sm font-semibold text-sun-800">{t.blockers[blocker]}</p>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-3">
        <Button
          disabled={blocker !== null || action.pending}
          onClick={() =>
            action.run(
              () => reviewAudioVersion({ versionId: version.id, decision: "approve", note, listened }),
              t.approved,
            )
          }
        >
          <Check aria-hidden="true" className="size-5" />
          {action.pending ? t.working : t.approve}
        </Button>
        <Button
          variant="outline"
          disabled={!canReject}
          onClick={() =>
            action.run(
              () => reviewAudioVersion({ versionId: version.id, decision: "reject", note, listened }),
              t.rejected,
            )
          }
        >
          <RotateCcw aria-hidden="true" className="size-5" />
          {t.reject}
        </Button>
      </div>
      <ActionNoteView note={action.note} className="mt-2" />
    </fieldset>
  );
}

function RevokeForm({ versionId }: { versionId: string }) {
  const t = vi.audioStudio.versions;
  const id = useId();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const action = useAction();

  if (!open) {
    return (
      <div className="mt-3">
        <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
          <Undo2 aria-hidden="true" className="size-4" />
          {t.revoke}
        </Button>
      </div>
    );
  }
  return (
    <div className="mt-3 rounded-xl border border-line p-3">
      <label htmlFor={`${id}-reason`} className="block text-sm font-semibold text-ink">
        {t.revokeReason}
      </label>
      <input
        id={`${id}-reason`}
        className={`${inputClass} mt-2`}
        maxLength={300}
        value={reason}
        onChange={(event) => setReason(event.target.value)}
      />
      <div className="mt-2 flex flex-wrap gap-3">
        <Button
          variant="outline"
          size="sm"
          disabled={reason.trim().length < 3 || action.pending}
          onClick={() => action.run(() => revokeAudioVersion({ versionId, reason }), t.status.revoked)}
        >
          {t.revokeConfirm}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
          {vi.common.cancel}
        </Button>
      </div>
      <ActionNoteView note={action.note} className="mt-2" />
    </div>
  );
}
