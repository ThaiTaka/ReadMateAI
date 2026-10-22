import { cn } from "@/lib/cn";
import { vi } from "@/strings/vi";

function Heart({ full }: { full: boolean }) {
  return (
    <svg viewBox="0 0 32 30" aria-hidden="true" className="size-7 shrink-0">
      <path
        d="M16 28S2 19.5 2 10.2C2 5.6 5.5 2 9.8 2c2.7 0 4.9 1.4 6.2 3.5C17.3 3.4 19.5 2 22.2 2 26.5 2 30 5.6 30 10.2 30 19.5 16 28 16 28z"
        fill={full ? "#ff8aa8" : "none"}
        stroke={full ? "#d6476f" : "#9aa1b2"}
        strokeWidth="2.6"
        strokeLinejoin="round"
        strokeDasharray={full ? undefined : "4 3"}
      />
      {full ? <path d="M8 9q1.5-3 4.5-3" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" fill="none" /> : null}
    </svg>
  );
}

type HeartIndicatorProps = {
  /** Số trái tim còn lại của quái vật (không phải của học sinh — học sinh không bao giờ "mất mạng"). */
  remaining: number;
  total?: number;
  className?: string;
  /** Nhãn chữ tùy biến ("{n}" và "{total}" được thay); mặc định dùng câu chung của design system. */
  label?: string;
};

/** Trái tim của quái vật: đầy / viền đứt + nhãn chữ "Quái vật còn n/3 trái tim" (không chỉ dựa vào màu). */
export function HeartIndicator({ remaining, total = 3, className, label: template }: HeartIndicatorProps) {
  const left = Math.min(Math.max(remaining, 0), total);
  const label = (template ?? vi.adventure.hearts.label).replace("{n}", String(left)).replace("{total}", String(total));
  return (
    <div className={cn("inline-flex flex-wrap items-center gap-2", className)}>
      <span className="flex gap-1">
        {Array.from({ length: total }, (_, index) => (
          <Heart key={index} full={index < left} />
        ))}
      </span>
      <span className="text-sm font-bold text-ink-soft">{label}</span>
    </div>
  );
}
