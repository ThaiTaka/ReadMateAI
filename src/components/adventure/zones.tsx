import type { ReactNode } from "react";
import { BookOpenCheck, Gamepad2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { vi } from "@/strings/vi";

/**
 * Hai khu vực của trang học sinh có xác thực (HỌC TẬP / THI ĐẤU). Mỗi khu vực có màu, biểu tượng, tiêu đề và lời giải
 * thích riêng để trẻ không nhầm "học để làm quen" với "thử sức trong trò chơi". Màu chỉ để trang trí — tên khu vực luôn là chữ.
 */

export type ZoneKey = "learn" | "compete";

export const ZONE_ANCHOR: Record<ZoneKey, string> = { learn: "hoc-tap", compete: "thi-dau" };

const ZONE_LOOK: Record<ZoneKey, { gradient: string; chip: string; Icon: typeof Gamepad2 }> = {
  learn: {
    gradient: "from-jade-600 via-jade-700 to-deep-800",
    chip: "bg-jade-50 text-jade-900",
    Icon: BookOpenCheck,
  },
  compete: {
    gradient: "from-magic-600 via-magic-700 to-deep-800",
    chip: "bg-magic-50 text-magic-900",
    Icon: Gamepad2,
  },
};

/** Hai nút lớn đầu trang: nhảy tới khu vực tương ứng (liên kết neo trong trang, vùng chạm ≥ 64 px). */
export function ZoneSwitcher({ className }: { className?: string }) {
  return (
    <nav aria-label={vi.zones.switcherLabel} className={cn("grid grid-cols-2 gap-3", className)}>
      {(["learn", "compete"] as const).map((zone) => {
        const { Icon, gradient } = ZONE_LOOK[zone];
        return (
          <a
            key={zone}
            href={`#${ZONE_ANCHOR[zone]}`}
            data-zone-link={zone}
            className={cn(
              "flex min-h-touch-kid flex-col items-center justify-center gap-1 rounded-2xl bg-linear-to-br px-3 py-3 text-center text-white shadow-lift transition-transform hover:-translate-y-0.5 active:translate-y-px",
              gradient,
            )}
          >
            <Icon aria-hidden="true" className="size-7" />
            <span className="text-lg font-extrabold leading-tight uppercase sm:text-xl">{vi.zones[zone].name}</span>
            <span className="text-sm font-semibold leading-snug text-white/90">{vi.zones[zone].tagline}</span>
          </a>
        );
      })}
    </nav>
  );
}

/** Khung đầu mỗi khu vực: nhãn "Khu vực n", tên khu vực lớn, câu mô tả. `children` là các hành động/nội dung của khu vực. */
export function ZoneSection({
  zone,
  titleId,
  children,
  className,
}: {
  zone: ZoneKey;
  titleId: string;
  children: ReactNode;
  className?: string;
}) {
  const { Icon, gradient, chip } = ZONE_LOOK[zone];
  const t = vi.zones[zone];
  return (
    <section
      id={ZONE_ANCHOR[zone]}
      aria-labelledby={titleId}
      data-zone={zone}
      className={cn("flex scroll-mt-6 flex-col gap-6", className)}
    >
      <header
        className={cn(
          "relative overflow-hidden rounded-world bg-linear-to-br p-5 text-white shadow-world sm:p-7",
          gradient,
        )}
      >
        <div className="flex items-start gap-4">
          <span
            aria-hidden="true"
            className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-white/15"
          >
            <Icon className="size-8" />
          </span>
          <div className="min-w-0">
            <p
              className={cn(
                "inline-flex rounded-full px-3 py-0.5 text-xs font-extrabold tracking-wide uppercase",
                chip,
              )}
            >
              {t.eyebrow}
            </p>
            <h2 id={titleId} className="mt-1 text-3xl font-extrabold leading-tight uppercase sm:text-4xl">
              {t.name}
            </h2>
            <p className="mt-1 text-lg font-bold text-white/95">{t.tagline}</p>
            <p className="mt-2 max-w-2xl leading-relaxed text-white/90">{t.text}</p>
          </div>
        </div>
      </header>
      {children}
    </section>
  );
}
