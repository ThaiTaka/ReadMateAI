import type { Metadata } from "next";
import { LifeBuoy, QrCode, ShieldCheck, Smartphone, Sprout } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { vi } from "@/strings/vi";
import { JoinForm } from "./join-form";

export const metadata: Metadata = {
  title: vi.join.meta.title,
  description: vi.join.meta.description,
  robots: { index: false, follow: false },
};

const STEP_ICONS = [QrCode, Smartphone, Sprout] as const;

/**
 * Liên kết thiết bị bằng thẻ học (R03 — docs/STUDENT_ACCESS.md). Header Referrer-Policy: no-referrer đặt riêng cho
 * /join. Mã sai/hết hạn/thu hồi đều nhận cùng một thông báo, không tiết lộ thông tin học sinh.
 */
export default function JoinPage() {
  const t = vi.join;

  return (
    <Container className="py-12 sm:py-16">
      <div className="mx-auto max-w-3xl">
        <Badge tone="lagoon">{t.eyebrow}</Badge>
        <h1 className="mt-4 text-4xl font-extrabold leading-tight text-ink sm:text-5xl">{t.title}</h1>
        <p className="mt-4 text-lg leading-relaxed text-ink-soft">{t.intro}</p>

        <section aria-labelledby="join-form-title" className="mt-10">
          <h2 id="join-form-title" className="sr-only">
            {t.form.legend}
          </h2>
          <Card className="p-6 sm:p-8">
            <JoinForm />
          </Card>
        </section>

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

        <section aria-labelledby="join-help-title" className="mt-12">
          <Card variant="tinted" className="p-6 sm:p-8">
            <span className="flex size-12 items-center justify-center rounded-2xl bg-sun-300 text-ink">
              <LifeBuoy aria-hidden="true" className="size-6" />
            </span>
            <h2 id="join-help-title" className="mt-4 text-2xl font-extrabold leading-tight text-ink">
              {t.help.title}
            </h2>
            <ul className="mt-5 space-y-3">
              {t.help.items.map((item) => (
                <li key={item} className="flex items-start gap-3 leading-relaxed text-ink">
                  <span aria-hidden="true" className="mt-2.5 size-2 shrink-0 rounded-full bg-sun-600" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </Card>
        </section>

        <section aria-labelledby="join-privacy-title" className="mt-8">
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
