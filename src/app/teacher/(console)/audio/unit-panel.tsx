"use client";

import { useRouter } from "next/navigation";
import { CircleCheck, Save, Upload } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { inputClass } from "@/components/forms/form-controls";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { AUDIO_FILE_ACCEPT, AUDIO_MAX_BYTES } from "@/features/audio-library/limits";
import type { AudioUnit } from "@/features/audio-library/p0-catalog";
import type { AssetSummary } from "@/features/audio-library/unit-state";
import { confirmPronunciation, saveUnitNote } from "@/server/audio-library/actions";
import type { ErrorCode } from "@/server/result";
import { vi } from "@/strings/vi";
import { Recorder } from "./recorder";
import { ActionNoteView, useAction, type ActionNote } from "./use-action";
import { VersionList, type StudioContext } from "./version-list";

type Props = { unit: AudioUnit; asset: AssetSummary | undefined; context: StudioContext };

const isErrorCode = (code: unknown): code is ErrorCode => typeof code === "string" && code in vi.errors;

export function UnitPanel({ unit, asset, context }: Props) {
  const t = vi.audioStudio;
  const router = useRouter();
  const [uploading, setUploading] = useState(false);
  const [uploadNote, setUploadNote] = useState<ActionNote | null>(null);
  const [recorderKey, setRecorderKey] = useState(0);
  const [fileKey, setFileKey] = useState(0);

  const blockedReason = !context.recordingEnabled
    ? t.recorder.disabled
    : !context.consentActive
      ? t.recorder.needConsent
      : null;

  /** Chỉ chạy khi GV bấm "Lưu bản nháp": gửi bản ghi/tệp lên máy chủ (multipart) và luôn tạo BẢN NHÁP. */
  async function upload(blob: Blob) {
    setUploading(true);
    setUploadNote(null);
    try {
      const form = new FormData();
      form.set("unitKind", unit.kind);
      form.set("unitText", unit.text);
      form.set("file", blob, "ban-ghi");
      const response = await fetch("/api/teacher/audio/versions", { method: "POST", body: form });
      const body: unknown = await response.json().catch(() => null);
      const result = body as { ok?: unknown; code?: unknown } | null;
      if (result?.ok === true) {
        setUploadNote({ kind: "ok", text: t.upload.saved });
        setRecorderKey((n) => n + 1);
        setFileKey((n) => n + 1);
        router.refresh();
      } else {
        setUploadNote({ kind: "error", text: vi.errors[isErrorCode(result?.code) ? result.code : "UNKNOWN"] });
      }
    } catch {
      setUploadNote({ kind: "error", text: vi.errors.UNKNOWN });
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="mt-4 grid gap-6 border-t border-line pt-5">
      <PronunciationForm
        key={`${unit.key}-${asset?.confirmedLabel ?? ""}`}
        unit={unit}
        asset={asset}
        context={context}
      />
      <Recorder key={recorderKey} blockedReason={blockedReason} saving={uploading} onSave={upload} />
      <FileUpload key={fileKey} blockedReason={blockedReason} saving={uploading} onSave={upload} />
      <ActionNoteView note={uploadNote} />
      <VersionList unitLabel={unit.displayText} asset={asset} context={context} />
      <NoteForm key={`${unit.key}-note-${asset?.note ?? ""}`} unit={unit} asset={asset} context={context} />
    </div>
  );
}

function PronunciationForm({ unit, asset, context }: Props) {
  const t = vi.audioStudio.pronunciation;
  const id = useId();
  const [label, setLabel] = useState(asset?.confirmedLabel ?? unit.proposedLabel);
  const action = useAction();
  const confirmed = Boolean(asset?.confirmedLabel);
  return (
    <section aria-labelledby={`${id}-title`}>
      <h4 id={`${id}-title`} className="text-lg font-extrabold text-ink">
        {t.title}
      </h4>
      <p className="mt-1 text-sm text-ink-soft">{t.help}</p>
      {unit.needsDecision && !confirmed ? (
        <Notice tone="progress" title={vi.audioStudio.unit.awaitingConfirm} className="mt-3">
          {vi.audioStudio.unit.needsDecision}
        </Notice>
      ) : null}
      <label htmlFor={`${id}-label`} className="mt-3 block font-semibold text-ink">
        {t.label}
      </label>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <input
          id={`${id}-label`}
          className={`${inputClass} max-w-xs`}
          value={label}
          maxLength={40}
          autoComplete="off"
          onChange={(event) => setLabel(event.target.value)}
        />
        <Button
          variant={confirmed && label === asset?.confirmedLabel ? "outline" : "primary"}
          disabled={!context.recordingEnabled || label.trim() === "" || action.pending}
          onClick={() => action.run(() => confirmPronunciation({ unitKey: unit.key, label }), t.saved)}
        >
          <CircleCheck aria-hidden="true" className="size-5" />
          {action.pending ? t.confirming : t.confirm}
        </Button>
      </div>
      <ActionNoteView note={action.note} className="mt-2" />
    </section>
  );
}

function FileUpload({
  blockedReason,
  saving,
  onSave,
}: {
  blockedReason: string | null;
  saving: boolean;
  onSave: (blob: Blob) => void;
}) {
  const t = vi.audioStudio.upload;
  const id = useId();
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [tooLarge, setTooLarge] = useState(false);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  return (
    <section aria-labelledby={`${id}-title`} className="rounded-2xl border border-line bg-surface-muted/50 p-4 sm:p-5">
      <h4 id={`${id}-title`} className="text-lg font-extrabold text-ink">
        {t.title}
      </h4>
      <p className="mt-1 text-sm text-ink-soft">{t.help}</p>
      <p className="mt-1 text-sm text-ink-faint">{t.iphoneHint}</p>
      <label htmlFor={`${id}-file`} className="mt-3 block font-semibold text-ink">
        {t.choose}
      </label>
      <input
        id={`${id}-file`}
        type="file"
        accept={AUDIO_FILE_ACCEPT}
        disabled={Boolean(blockedReason) || saving}
        className="mt-2 block w-full min-h-touch rounded-2xl border-2 border-line-strong bg-surface px-3 py-2 text-base"
        onChange={(event) => {
          const chosen = event.target.files?.[0] ?? null;
          setPreviewUrl(chosen ? URL.createObjectURL(chosen) : null);
          // Kiểm tra sớm cho dễ hiểu; máy chủ vẫn kiểm tra lại theo nội dung tệp.
          setTooLarge(Boolean(chosen && chosen.size > AUDIO_MAX_BYTES));
          setFile(chosen && chosen.size <= AUDIO_MAX_BYTES ? chosen : null);
        }}
      />
      {tooLarge ? (
        <p role="alert" className="mt-2 rounded-xl bg-coral-50 px-4 py-3 text-sm font-semibold text-coral-800">
          {vi.errors.AUDIO_TOO_LARGE}
        </p>
      ) : null}
      {file && previewUrl ? (
        <div className="mt-3 grid gap-3">
          <p className="text-sm text-ink-soft">
            {t.selected.replace("{kb}", String(Math.max(1, Math.round(file.size / 1024))))}
          </p>
          <audio controls src={previewUrl} aria-label={vi.audioStudio.recorder.previewLabel} className="w-full" />
          <div>
            <Button onClick={() => onSave(file)} disabled={saving || Boolean(blockedReason)}>
              <Upload aria-hidden="true" className="size-5" />
              {saving ? t.saving : t.save}
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function NoteForm({ unit, asset, context }: Props) {
  const t = vi.audioStudio.note;
  const id = useId();
  const [note, setNote] = useState(asset?.note ?? "");
  const action = useAction();
  return (
    <section aria-labelledby={`${id}-title`}>
      <h4 id={`${id}-title`} className="text-lg font-extrabold text-ink">
        {t.label}
      </h4>
      <textarea
        aria-labelledby={`${id}-title`}
        className={`${inputClass} mt-2 py-3`}
        rows={2}
        maxLength={300}
        value={note}
        onChange={(event) => setNote(event.target.value)}
      />
      <div className="mt-2">
        <Button
          variant="outline"
          disabled={!context.recordingEnabled || action.pending}
          onClick={() => action.run(() => saveUnitNote({ unitKey: unit.key, note }), t.saved)}
        >
          <Save aria-hidden="true" className="size-5" />
          {action.pending ? t.saving : t.save}
        </Button>
      </div>
      <ActionNoteView note={action.note} className="mt-2" />
    </section>
  );
}
