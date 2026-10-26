"use client";

import { ShieldCheck } from "lucide-react";
import { useId, useState } from "react";
import { inputClass } from "@/components/forms/form-controls";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { grantVoiceConsent, withdrawVoiceConsent } from "@/server/audio-library/actions";
import { vi } from "@/strings/vi";
import { ActionNoteView, useAction } from "./use-action";

type Props = { consentActive: boolean; recordingEnabled: boolean };

/**
 * Đồng ý dùng giọng: ô đánh dấu KHÔNG chọn sẵn; GV phải tự đánh dấu rồi bấm "Tôi đồng ý". Máy chủ ghi chứng từ (phiên bản
 * thông báo, thời điểm) — trình duyệt không gửi gì ngoài việc đã đánh dấu. Rút đồng ý luôn được phép.
 */
export function ConsentCard({ consentActive, recordingEnabled }: Props) {
  const t = vi.audioStudio.consent;
  const id = useId();
  const [checked, setChecked] = useState(false);
  const [reason, setReason] = useState("");
  const [confirmWithdraw, setConfirmWithdraw] = useState(false);
  const grant = useAction();
  const withdraw = useAction();

  if (consentActive) {
    return (
      <Card as="section" aria-labelledby={`${id}-active`} className="p-5">
        <p id={`${id}-active`} className="flex items-center gap-2 font-bold text-ink">
          <ShieldCheck aria-hidden="true" className="size-5 text-brand-700" />
          {t.active}
        </p>
        <details className="mt-3">
          <summary className="min-h-touch cursor-pointer py-2 font-semibold text-ink-soft">{t.withdrawTitle}</summary>
          <p className="mt-1 text-sm text-ink-soft">{t.withdrawHelp}</p>
          <label htmlFor={`${id}-reason`} className="mt-3 block text-sm font-semibold text-ink">
            {t.withdrawReason}
          </label>
          <input
            id={`${id}-reason`}
            className={`${inputClass} mt-2 max-w-md`}
            value={reason}
            maxLength={300}
            onChange={(event) => setReason(event.target.value)}
          />
          {confirmWithdraw ? (
            <div className="mt-3 flex flex-wrap gap-3">
              <Button
                variant="outline"
                disabled={reason.trim().length < 3 || withdraw.pending}
                onClick={() => withdraw.run(() => withdrawVoiceConsent({ reason }), t.withdrawn)}
              >
                {withdraw.pending ? t.withdrawing : t.withdraw}
              </Button>
              <Button variant="ghost" onClick={() => setConfirmWithdraw(false)}>
                {vi.common.cancel}
              </Button>
            </div>
          ) : (
            <div className="mt-3">
              <Button variant="outline" disabled={reason.trim().length < 3} onClick={() => setConfirmWithdraw(true)}>
                {t.withdraw}
              </Button>
            </div>
          )}
          <ActionNoteView note={withdraw.note} className="mt-2" />
        </details>
      </Card>
    );
  }

  return (
    <Card as="section" aria-labelledby={`${id}-title`} className="p-5 sm:p-6">
      <h2 id={`${id}-title`} className="text-xl font-extrabold text-ink">
        {t.title}
      </h2>
      <ul className="mt-3 list-disc space-y-1 pl-5 text-ink-soft">
        {t.points.map((point) => (
          <li key={point}>{point}</li>
        ))}
      </ul>
      <div className="mt-4 flex items-start gap-3">
        <input
          id={`${id}-check`}
          type="checkbox"
          className="mt-1 size-6 shrink-0 accent-brand-600"
          checked={checked}
          disabled={!recordingEnabled}
          onChange={(event) => setChecked(event.target.checked)}
        />
        <label htmlFor={`${id}-check`} className="font-semibold text-ink">
          {t.checkbox}
        </label>
      </div>
      <div className="mt-4">
        <Button
          disabled={!checked || !recordingEnabled || grant.pending}
          onClick={() => grant.run(() => grantVoiceConsent({ acknowledged: true }), t.active)}
        >
          {grant.pending ? t.granting : t.grant}
        </Button>
      </div>
      <ActionNoteView note={grant.note} className="mt-2" />
    </Card>
  );
}
