import { cn } from "@/lib/cn";

/** Linh vật chú cú đọc sách cho khu vực học sinh. Thuần trang trí. */
export function MascotOwl({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 120" aria-hidden="true" className={cn("size-24", className)}>
      <ellipse cx="60" cy="112" rx="34" ry="5" fill="#1d2433" opacity="0.08" />
      <path d="M30 44c0-18 13-30 30-30s30 12 30 30v38c0 16-13 26-30 26S30 98 30 82z" fill="#0b7a63" />
      <path d="M38 30l-6-14 16 8M82 30l6-14-16 8" fill="#0b7a63" />
      <ellipse cx="60" cy="80" rx="20" ry="22" fill="#d2f8ea" />
      <circle cx="47" cy="50" r="12" fill="#ffffff" />
      <circle cx="73" cy="50" r="12" fill="#ffffff" />
      <circle cx="49" cy="51" r="5.5" fill="#1d2433" />
      <circle cx="71" cy="51" r="5.5" fill="#1d2433" />
      <circle cx="51" cy="49" r="1.8" fill="#ffffff" />
      <circle cx="73" cy="49" r="1.8" fill="#ffffff" />
      <path d="M56 60l4 6 4-6z" fill="#fdc126" />
      <path
        d="M36 84c8-6 16-6 24 0 8-6 16-6 24 0v14c-8-6-16-6-24 0-8-6-16-6-24 0z"
        fill="#ffffff"
        stroke="#fdc126"
        strokeWidth="2"
      />
      <path d="M60 84v14" stroke="#fdc126" strokeWidth="2" />
    </svg>
  );
}
