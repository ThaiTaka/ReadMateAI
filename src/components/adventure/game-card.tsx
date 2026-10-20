import { Lock } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type GameCardProps = {
  /** Cảnh minh họa (thành phần trong src/components/art), phủ kín khung 16:10. */
  art: ReactNode;
  title: string;
  /** id của tiêu đề để vùng thẻ có tên (aria-labelledby). */
  titleId: string;
  tagline?: string;
  /** Chip trạng thái ở góc trên (luôn có chữ). */
  status?: ReactNode;
  /** Dòng thông tin dưới tiêu đề (ngưỡng điểm, mô tả ngắn…). */
  children?: ReactNode;
  /** Vùng nút ở đáy thẻ. */
  actions?: ReactNode;
  /** Lớp viền nhấn (vd. "ring-jade-300"). */
  accentRing?: string;
  as?: "article" | "li" | "div";
  id?: string;
  className?: string;
};

/**
 * Thẻ trò chơi/khu vực: khung ảnh có chiều sâu, nổi nhẹ khi rê chuột hoặc khi focus vào nút trong thẻ.
 * Không cả thẻ là một liên kết — hành động nằm ở nút rõ ràng (vùng chạm lớn, đọc được bằng trình đọc màn hình).
 */
export function GameCard({
  art,
  title,
  titleId,
  tagline,
  status,
  children,
  actions,
  accentRing = "ring-line",
  as: Tag = "article",
  id,
  className,
}: GameCardProps) {
  return (
    <Tag
      id={id}
      aria-labelledby={titleId}
      className={cn(
        "group relative flex scroll-mt-24 flex-col overflow-hidden rounded-world bg-surface shadow-world ring-2 transition-[transform,box-shadow] duration-300",
        "hover:-translate-y-1 hover:shadow-lift focus-within:-translate-y-1",
        accentRing,
        className,
      )}
    >
      <div className="relative aspect-[16/10] overflow-hidden">
        <div className="size-full transition-transform duration-500 group-hover:scale-105">{art}</div>
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-linear-to-t from-deep-900/35 to-transparent"
        />
        {status ? <div className="absolute top-3 left-3 flex flex-wrap gap-2">{status}</div> : null}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-5">
        <h3 id={titleId} className="text-xl font-extrabold leading-snug text-ink sm:text-2xl">
          {title}
        </h3>
        {tagline ? <p className="font-semibold text-ink-soft">{tagline}</p> : null}
        {children}
        {actions ? <div className="mt-auto flex flex-wrap gap-3 pt-3">{actions}</div> : null}
      </div>
    </Tag>
  );
}

/** Lớp phủ ổ khóa đặt trên ảnh của thẻ khi chưa đủ điểm (luôn đi kèm chữ ở chip trạng thái). */
function LockOverlay() {
  return (
    <div aria-hidden="true" className="absolute inset-0 flex items-center justify-center">
      <span className="flex size-16 items-center justify-center rounded-full bg-surface/90 text-magic-700 shadow-lift ring-4 ring-magic-200">
        <Lock className="size-8" strokeWidth={2.6} />
      </span>
    </div>
  );
}

/** Thẻ khu vực chưa mở: như GameCard nhưng ảnh phủ sương + ổ khóa. Ảnh truyền vào nên ở chế độ `dimmed`. */
export function LockedGameCard(props: GameCardProps) {
  return (
    <GameCard
      {...props}
      art={
        <div className="relative size-full">
          {props.art}
          <LockOverlay />
        </div>
      }
    />
  );
}
