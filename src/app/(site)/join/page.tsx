import type { Metadata } from "next";
import { KeyRound, Lock, QrCode, ShieldCheck, Smartphone, Sprout } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { Notice } from "@/components/ui/notice";
import { vi } from "@/strings/vi";

export const metadata: Metadata = {
  title: vi.join.meta.title,
  description: vi.join.meta.description,
};

const STEP_ICONS = [QrCode, Smartphone, Sprout] as const;

/**
 * Trang chuẩn bị cho liên kết thiết bị (hiện thực ở GĐ5 — docs/ARCHITECTURE.md §8.2).
 * Biểu mẫu bị khóa hoàn toàn (fieldset disabled, không có action): trang không nhận, không gửi
 * và không lưu mã nào. Header Referrer-Policy: no-referrer được đặt riêng cho /join.
 */
export default function JoinPage() {
  const t = vi.join;
  const hintId = "join-code-hint";
  const statusId = "join-code-status";

  return (
    <Container className="py-12 sm:py-16">
      <div className="mx-auto max-w-3xl">
        <div className="flex flex-wrap gap-2">
          <Badge tone="lagoon">{t.eyebrow}</Badge>
          <Badge tone="sun">{vi.status.comingSoon}</Badge>
        </div>
        <h1 className="mt-4 text-4xl font-extrabold leading-tight text-ink sm:text-5xl">{t.title}</h1>
        <p className="mt-4 text-lg leading-relaxed text-ink-soft">{t.intro}</p>
        <Notice tone="progress" title={t.notice.title} className="mt-8">
          {t.notice.text}
        </Notice>

        <section aria-labelledby="join-steps-title" className="mt-12">
          <h2 id="join-steps-title" className="text-2xl font-extrabold text-ink">
            {t.stepsTitle}
          </h2>
          <ol className="mt-5 grid gap-4 sm:grid-cols-3">
            {t.steps.map((step, index) => {
              const Icon = STEP_ICONS[index] ?? Sprout;
              return (
                <Card as="li" key={step.title} className="flex flex-col gap-3 p-5">
                  <span className="flex size-12 items-center justify-center rounded-2xl bg-lagoon-50 text-lagoon-700">
                    <Icon aria-hidden="true" className="size-6" />
                  </span>
                  <h3 className="font-bold text-ink">
                    {index + 1}. {step.title}
                  </h3>
                  <p className="leading-relaxed text-ink-soft">{step.text}</p>
                </Card>
              );
            })}
          </ol>
        </section>

        <section aria-labelledby="join-form-title" className="mt-12">
          <h2 id="join-form-title" className="sr-only">
            {t.form.legend}
          </h2>
          <Card variant="placeholder" className="p-6 sm:p-8">
            {/* Cố ý không dùng <form>: không có đường nào gửi mã đi trong bản xem trước. */}
            <div>
              <fieldset disabled aria-describedby={statusId} className="space-y-4">
                <legend className="flex items-center gap-2 text-lg font-bold text-ink">
                  <KeyRound aria-hidden="true" className="size-5 text-ink-faint" />
                  {t.form.legend}
                  <Badge tone="neutral">{vi.status.comingSoon}</Badge>
                </legend>
                <div>
                  <label htmlFor="join-backup-code" className="block font-semibold text-ink">
                    {t.form.label}
                  </label>
                  <p id={hintId} className="mt-1 text-sm text-ink-soft">
                    {t.form.hint}
                  </p>
                  <input
                    id="join-backup-code"
                    type="text"
                    inputMode="text"
                    autoComplete="off"
                    autoCapitalize="characters"
                    spellCheck={false}
                    maxLength={8}
                    aria-describedby={`${hintId} ${statusId}`}
                    className="mt-3 block min-h-touch w-full max-w-xs rounded-2xl border-2 border-line-strong bg-surface-muted px-4 font-reading text-xl tracking-[0.3em] text-ink-faint"
                  />
                </div>
                <Button type="button" variant="primary" className="w-full sm:w-auto">
                  <Lock aria-hidden="true" className="size-5" />
                  {t.form.submit}
                </Button>
              </fieldset>
              <p id={statusId} className="mt-4 text-sm font-semibold text-sun-800">
                {t.form.disabledNote}
              </p>
            </div>
          </Card>
        </section>

        <section aria-labelledby="join-privacy-title" className="mt-12">
          <Card variant="tinted" className="p-6 sm:p-8">
            <span className="flex size-12 items-center justify-center rounded-2xl bg-brand-600 text-white">
              <ShieldCheck aria-hidden="true" className="size-6" />
            </span>
            <h2 id="join-privacy-title" className="mt-4 text-2xl font-extrabold leading-tight text-ink">
              {t.privacy.title}
            </h2>
            <ul className="mt-5 space-y-3">
              {t.privacy.items.map((item) => (
                <li key={item} className="flex items-start gap-3 leading-relaxed text-ink">
                  <span aria-hidden="true" className="mt-2.5 size-2 shrink-0 rounded-full bg-brand-600" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </Card>
        </section>

        <div className="mt-10">
          <ButtonLink href="/" variant="ghost">
            {vi.notFound.action}
          </ButtonLink>
        </div>
      </div>
    </Container>
  );
}
