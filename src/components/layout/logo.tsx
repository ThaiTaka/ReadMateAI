import { cn } from "@/lib/cn";

/** Biểu trưng: quyển sách mở + ngôi sao nhỏ (tiến bộ mỗi ngày). Thuần trang trí. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" aria-hidden="true" className={cn("size-9 shrink-0", className)}>
      <rect width="40" height="40" rx="12" fill="#0b7a63" />
      <path
        d="M9.5 13.6c3.4-1 6.9-.5 10.5 1.7 3.6-2.2 7.1-2.7 10.5-1.7v14.2c-3.4-1-6.9-.5-10.5 1.7-3.6-2.2-7.1-2.7-10.5-1.7z"
        fill="#ffffff"
      />
      <path d="M20 15.4v14.1" stroke="#0b7a63" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="31" cy="9.5" r="3.6" fill="#fdc126" />
    </svg>
  );
}

export function LogoWordmark({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark />
      <span className="whitespace-nowrap text-lg font-extrabold tracking-tight text-ink">
        ReadMate<span className="text-brand-600"> AI</span>
      </span>
    </span>
  );
}
