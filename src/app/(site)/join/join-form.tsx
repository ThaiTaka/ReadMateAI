"use client";

import { KeyRound, LoaderCircle } from "lucide-react";
import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import { Field, FormMessage, SubmitButton, TextInput } from "@/components/forms/form-controls";
import { joinWithCode, type JoinState } from "@/server/student-gateway/actions";
import { vi } from "@/strings/vi";

const INITIAL: JoinState = { status: "idle" };

/**
 * Liên kết thiết bị. Mã QR nằm ở FRAGMENT (`/join#c=…`) nên không bao giờ tới log máy chủ; trang đọc fragment,
 * XÓA ngay khỏi thanh địa chỉ (không để lại trong lịch sử trình duyệt) rồi gửi qua Server Action (POST).
 * Mã dự phòng: phụ huynh gõ tay. Không lưu mã vào localStorage/sessionStorage.
 */
export function JoinForm() {
  const t = vi.join.form;
  const [state, formAction, pending] = useActionState(joinWithCode, INITIAL);
  const [fromQr, setFromQr] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const token = new URLSearchParams(window.location.hash.slice(1)).get("c");
    if (!token) return;
    window.history.replaceState(null, "", window.location.pathname);
    const data = new FormData();
    data.set("kind", "token");
    data.set("code", token);
    startTransition(() => {
      setFromQr(true);
      formAction(data);
    });
  }, [formAction]);

  const qrFailed = fromQr && !pending && state.status === "error";

  return (
    <div className="space-y-6">
      {fromQr && pending ? (
        <p role="status" className="flex items-center gap-3 rounded-2xl bg-lagoon-50 p-4 font-semibold text-lagoon-800">
          <LoaderCircle aria-hidden="true" className="size-6 animate-spin motion-reduce:animate-none" />
          {t.qrChecking}
        </p>
      ) : null}
      {qrFailed ? (
        <p role="alert" className="rounded-2xl bg-coral-50 p-4 font-semibold text-coral-800">
          {state.code === "CODE_INVALID" ? t.qrFailed : vi.errors[state.code]}
        </p>
      ) : null}

      <form action={formAction} className="space-y-4" aria-describedby="join-code-hint">
        <input type="hidden" name="kind" value="backup" />
        <fieldset className="space-y-4" disabled={pending}>
          <legend className="flex items-center gap-2 text-lg font-bold text-ink">
            <KeyRound aria-hidden="true" className="size-5 text-brand-700" />
            {t.legend}
          </legend>
          <Field id="join-backup-code" label={t.label} hint={t.hint}>
            <TextInput
              id="join-backup-code"
              name="code"
              type="text"
              inputMode="text"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              required
              maxLength={12}
              aria-describedby="join-backup-code-hint"
              className="max-w-xs font-reading text-xl tracking-[0.3em] uppercase"
            />
          </Field>
          {!qrFailed ? <FormMessage state={state} /> : null}
          <SubmitButton pendingLabel={t.submitting} size="lg" className="w-full sm:w-auto">
            {t.submit}
          </SubmitButton>
        </fieldset>
      </form>
    </div>
  );
}
