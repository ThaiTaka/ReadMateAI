"use client";

import { LogIn } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useActionState } from "react";
import { Field, FormMessage, SubmitButton, TextInput } from "@/components/forms/form-controls";
import { Notice } from "@/components/ui/notice";
import { signInTeacher, type SignInState } from "@/server/auth/actions";
import { vi } from "@/strings/vi";

const INITIAL: SignInState = { status: "idle" };
type Reason = keyof typeof vi.auth.reasons;

/**
 * Biểu mẫu đăng nhập GV. Mật khẩu chỉ đi qua Server Action (POST, HTTPS ở production) — không lưu ở
 * localStorage, không vào URL. `next` chỉ được máy chủ chấp nhận khi trỏ vào /teacher.
 */
export function LoginForm() {
  const params = useSearchParams();
  const [state, formAction] = useActionState(signInTeacher, INITIAL);
  const reasonKey = params.get("reason");
  const reason = reasonKey && reasonKey in vi.auth.reasons ? vi.auth.reasons[reasonKey as Reason] : null;
  const t = vi.auth;

  return (
    <form action={formAction} className="space-y-5">
      {reason && state.status === "idle" ? (
        <Notice tone="info" title={reason}>
          {t.noSignup}
        </Notice>
      ) : null}
      <input type="hidden" name="next" value={params.get("next") ?? ""} />
      <Field id="login-email" label={t.email}>
        <TextInput id="login-email" name="email" type="email" autoComplete="username" required maxLength={254} />
      </Field>
      <Field id="login-password" label={t.password}>
        <TextInput
          id="login-password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          maxLength={200}
        />
      </Field>
      <FormMessage state={state} />
      <SubmitButton pendingLabel={t.submitting} size="lg" className="w-full sm:w-auto">
        <LogIn aria-hidden="true" className="size-5" />
        {t.submit}
      </SubmitButton>
    </form>
  );
}
