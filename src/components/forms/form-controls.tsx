"use client";

import { LoaderCircle } from "lucide-react";
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";
import { useFormStatus } from "react-dom";
import { Button, type ButtonSize, type ButtonVariant } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import type { ErrorCode } from "@/server/result";
import { vi } from "@/strings/vi";

/**
 * Điều khiển biểu mẫu cho khu vực giáo viên/phụ huynh (≥ 48 px, nhãn luôn hiện, lỗi đọc được bằng trình đọc
 * màn hình). Không lưu gì vào localStorage; giá trị chỉ gửi qua Server Action (POST), không vào query string.
 */

export const inputClass =
  "block min-h-touch w-full rounded-2xl border-2 border-line-strong bg-surface px-4 text-base text-ink placeholder:text-ink-faint focus:border-brand-600 focus:outline-none disabled:bg-surface-muted disabled:text-ink-faint";

type FieldProps = { id: string; label: string; hint?: string; children: ReactNode; className?: string };

export function Field({ id, label, hint, children, className }: FieldProps) {
  return (
    <div className={className}>
      <label htmlFor={id} className="block font-semibold text-ink">
        {label}
      </label>
      {hint ? (
        <p id={`${id}-hint`} className="mt-1 text-sm text-ink-soft">
          {hint}
        </p>
      ) : null}
      <div className="mt-2">{children}</div>
    </div>
  );
}

export function TextInput({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(inputClass, className)} {...props} />;
}

export function SelectInput({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(inputClass, "pr-10", className)} {...props} />;
}

type SubmitProps = {
  children: ReactNode;
  pendingLabel?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  disabled?: boolean;
};

/** Nút gửi có trạng thái đang xử lý (chặn bấm lặp trong lúc chờ). */
export function SubmitButton({
  children,
  pendingLabel,
  variant = "primary",
  size = "md",
  className,
  disabled,
}: SubmitProps) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant={variant}
      size={size}
      className={className}
      disabled={disabled || pending}
      aria-disabled={disabled || pending}
    >
      {pending ? <LoaderCircle aria-hidden="true" className="size-5 animate-spin motion-reduce:animate-none" /> : null}
      {pending ? (pendingLabel ?? vi.common.saving) : children}
    </Button>
  );
}

type FormMessageProps = {
  state: { status: string; code?: ErrorCode };
  successText?: string;
  className?: string;
};

/** Thông báo kết quả của Server Action — mã lỗi → câu chữ tiếng Việt, không hiện chi tiết kỹ thuật. */
export function FormMessage({ state, successText, className }: FormMessageProps) {
  if (state.status === "error" && state.code) {
    return (
      <p
        role="alert"
        className={cn("rounded-xl bg-coral-50 px-4 py-3 text-sm font-semibold text-coral-800", className)}
      >
        {vi.errors[state.code]}
      </p>
    );
  }
  if (state.status === "ok" && successText) {
    return (
      <p role="status" className={cn("text-sm font-semibold text-brand-700", className)}>
        {successText}
      </p>
    );
  }
  return <p role="status" className="sr-only" />;
}
