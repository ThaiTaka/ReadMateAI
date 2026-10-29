"use client";

import { useRouter } from "next/navigation";
import { RotateCcw, TriangleAlert } from "lucide-react";
import { useId, useRef, useState, useTransition } from "react";
import { Button, buttonClasses } from "@/components/ui/button";
import { confirmationMatches } from "@/features/gamification/season-reset";
import { resetSeason } from "@/server/teacher/season";
import { vi } from "@/strings/vi";

const t = vi.leaderboard.teacher.reset;

type Props = {
  classId: string;
  className: string;
  /** Mùa đang diễn ra đọc từ máy chủ (null: lớp chưa có mùa). Không suy ra từ số thứ tự mùa. */
  seasonId: string | null;
  isOwner: boolean;
};

type Step = 1 | 2;
type Message = { tone: "ok" | "error"; text: string; stale?: boolean };

/**
 * Reset điểm hai bước. `requestId` tạo MỘT lần khi mở hộp thoại và giữ nguyên cho mọi lần thử lại trong lần mở đó
 * (CSDL dùng nó làm khóa ý định: gửi lại không tạo mùa thứ ba). Đóng hộp thoại không gọi máy chủ. Quyền thật và tên lớp
 * vẫn được máy chủ + CSDL kiểm tra lại; phần này chỉ là lớp giao diện.
 */
export function SeasonReset({ classId, className, seasonId, isOwner }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const busy = useRef(false);
  const requestId = useRef<string | null>(null);
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const titleId = useId();
  const [step, setStep] = useState<Step>(1);
  const [typed, setTyped] = useState("");
  const [message, setMessage] = useState<Message | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const canOpen = isOwner && seasonId !== null;
  const matches = confirmationMatches(typed, className);

  const open = () => {
    const dialog = dialogRef.current;
    if (!dialog || dialog.open || !canOpen) return;
    requestId.current = crypto.randomUUID();
    setStep(1);
    setTyped("");
    setMessage(null);
    setDone(null);
    // jsdom (unit test) chưa có showModal.
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
  };

  const close = () => {
    if (busy.current) return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (typeof dialog.close === "function") dialog.close();
    else dialog.removeAttribute("open");
    triggerRef.current?.focus();
  };

  const submit = () => {
    if (busy.current || !matches || !seasonId || !requestId.current || message?.stale) return;
    busy.current = true;
    setMessage(null);
    const id = requestId.current;
    startTransition(async () => {
      try {
        const result = await resetSeason({ classId, requestId: id, expectedSeasonId: seasonId, confirmation: typed });
        if (result.ok) {
          setDone(t.done.replace("{no}", String(result.data.seqNo)));
          busy.current = false;
          close();
          router.refresh();
          return;
        }
        if (result.code === "SEASON_MISMATCH") {
          setMessage({ tone: "error", text: vi.errors.SEASON_MISMATCH, stale: true });
        } else {
          if (result.code === "CONFIRMATION_MISMATCH") {
            setTyped("");
            inputRef.current?.focus();
          }
          setMessage({ tone: "error", text: vi.errors[result.code] });
        }
      } finally {
        busy.current = false;
      }
    });
  };

  const reload = () => {
    close();
    router.refresh();
  };

  return (
    <div className="space-y-3">
      <p className="text-ink-soft">{t.intro}</p>
      <div>
        <button
          ref={triggerRef}
          type="button"
          className={buttonClasses("outline")}
          disabled={!canOpen}
          aria-haspopup="dialog"
          aria-describedby="reset-help"
          onClick={open}
        >
          <RotateCcw aria-hidden="true" className="size-5" />
          {t.open}
        </button>
        <p id="reset-help" className="mt-2 text-sm text-ink-soft">
          {!isOwner ? t.ownerOnly : seasonId === null ? t.noSeason : t.irreversible}
        </p>
      </div>
      <div aria-live="polite">{done ? <p className="text-sm font-semibold text-brand-700">{done}</p> : null}</div>

      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        onCancel={(event) => {
          // Esc khi đang gửi: giữ hộp thoại để không mất kết quả.
          if (busy.current) event.preventDefault();
        }}
        onClose={() => triggerRef.current?.focus()}
        className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-3xl border-0 bg-surface p-0 text-ink shadow-world backdrop:bg-deep-900/55"
      >
        <div className="space-y-4 p-5 sm:p-6">
          <h2 id={titleId} className="text-2xl leading-tight font-extrabold text-ink">
            {step === 1 ? t.step1Title.replace("{name}", className) : t.step2Title}
          </h2>

          {step === 1 ? (
            <>
              <p className="text-ink-soft">{t.step1Lead}</p>
              <ul className="list-disc space-y-1 pl-6 text-ink">
                {t.effects.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
              <ul className="list-disc space-y-1 pl-6 text-ink-soft">
                {t.keeps.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
              <p className="flex items-start gap-2 rounded-2xl border border-sun-200 bg-sun-50 px-4 py-3 font-semibold text-ink">
                <TriangleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-sun-700" />
                {t.irreversible}
              </p>
              <div className="flex flex-wrap justify-end gap-3">
                <Button type="button" variant="ghost" onClick={close}>
                  {t.cancel}
                </Button>
                <Button type="button" variant="primary" onClick={() => setStep(2)}>
                  {t.next}
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="text-ink-soft">{t.step2Lead}</p>
              <p className="rounded-2xl bg-surface-muted px-4 py-3 text-lg font-extrabold break-words text-ink">
                {t.className.replace("{name}", className)}
              </p>
              <label className="block font-semibold text-ink">
                {t.inputLabel}
                <input
                  ref={inputRef}
                  type="text"
                  value={typed}
                  autoComplete="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  disabled={pending}
                  onChange={(event) => setTyped(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      submit();
                    }
                  }}
                  className="mt-2 block min-h-touch w-full rounded-2xl border-2 border-line bg-surface px-4 text-lg text-ink"
                />
              </label>
              <div aria-live="polite">
                {message ? (
                  <p
                    role="alert"
                    className="rounded-2xl border border-sun-200 bg-sun-50 px-4 py-3 text-sm font-semibold text-ink"
                  >
                    {message.text}
                  </p>
                ) : null}
                {pending ? <p className="text-sm font-semibold text-ink-soft">{t.working}</p> : null}
              </div>
              <div className="flex flex-wrap justify-end gap-3">
                <Button type="button" variant="ghost" disabled={pending} onClick={close}>
                  {t.cancel}
                </Button>
                <Button type="button" variant="outline" disabled={pending} onClick={() => setStep(1)}>
                  {t.back}
                </Button>
                {message?.stale ? (
                  <Button type="button" variant="primary" onClick={reload}>
                    {t.reload}
                  </Button>
                ) : (
                  <Button type="button" variant="primary" disabled={!matches || pending} onClick={submit}>
                    {t.confirm}
                  </Button>
                )}
              </div>
            </>
          )}
        </div>
      </dialog>
    </div>
  );
}
