import type { ToneId } from "@/lib/vietnamese/tone";
import { cn } from "@/lib/cn";

/**
 * Dấu thanh vẽ bằng SVG (dự án tự vẽ) — không phụ thuộc font có hỗ trợ dấu tổ hợp đứng riêng hay không,
 * in đen trắng vẫn rõ. Thanh ngang (không dấu) là một ô nét đứt.
 */
export function ToneGlyph({ tone, className }: { tone: ToneId; className?: string }) {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2.5,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={cn("size-8 shrink-0", className)}>
      {tone === "ngang" ? (
        <rect x="6" y="6" width="12" height="12" rx="2" {...common} strokeWidth={1.5} strokeDasharray="2 2.5" />
      ) : null}
      {tone === "huyen" ? <path d="M8 4 L16 13" {...common} /> : null}
      {tone === "sac" ? <path d="M16 4 L8 13" {...common} /> : null}
      {tone === "hoi" ? <path d="M8.5 6.5 C8.5 3.5 15.5 3.5 15.5 6.5 C15.5 9 12 9.5 12 12.5" {...common} /> : null}
      {tone === "nga" ? <path d="M4.5 9.5 C7 6 9.5 6 12 9.5 C14.5 13 17 13 19.5 9.5" {...common} /> : null}
      {tone === "nang" ? <circle cx="12" cy="18.5" r="2.4" fill="currentColor" /> : null}
    </svg>
  );
}
