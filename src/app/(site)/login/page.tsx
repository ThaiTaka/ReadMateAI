import type { Metadata } from "next";
import { Suspense } from "react";
import { KeyRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { LoadingState } from "@/components/ui/loading-state";
import { vi } from "@/strings/vi";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: vi.auth.meta.title,
  description: vi.auth.meta.description,
  robots: { index: false, follow: false },
};

/** Đăng nhập giáo viên (R03). Không có đăng ký: tài khoản GV do quản trị viên tạo (docs/AUTHENTICATION.md). */
export default function LoginPage() {
  const t = vi.auth;
  return (
    <Container className="py-12 sm:py-16">
      <div className="mx-auto max-w-lg">
        <Badge tone="lagoon">{t.eyebrow}</Badge>
        <h1 className="mt-4 text-4xl font-extrabold leading-tight text-ink">{t.title}</h1>
        <p className="mt-3 text-lg leading-relaxed text-ink-soft">{t.intro}</p>
        <Card className="mt-8 p-6 sm:p-8">
          <span className="mb-5 flex size-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">
            <KeyRound aria-hidden="true" className="size-6" />
          </span>
          {/* useSearchParams (lý do chuyển về trang đăng nhập) chỉ biết lúc request → đặt trong Suspense. */}
          <Suspense fallback={<LoadingState />}>
            <LoginForm />
          </Suspense>
        </Card>
        <p className="mt-6 text-sm text-ink-soft">{t.noSignup}</p>
        <div className="mt-4">
          <ButtonLink href="/join" variant="ghost">
            {t.studentLink}
          </ButtonLink>
        </div>
      </div>
    </Container>
  );
}
