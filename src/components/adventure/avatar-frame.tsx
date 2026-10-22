import type { ReactNode } from "react";
import { KidAvatar } from "@/components/art/avatars";
import type { AvatarKey } from "@/features/avatars/catalog";
import { cn } from "@/lib/cn";

const sizes = {
  sm: "size-12 p-0.5",
  md: "size-16 p-1",
  lg: "size-24 p-1.5",
  xl: "size-32 p-2",
  /** Đầu trang học sinh: lớn dần theo màn hình. */
  hero: "size-24 p-1.5 sm:size-32 sm:p-2",
} as const;

const rings = {
  sun: "from-sun-200 via-sun-400 to-sun-600",
  jade: "from-jade-200 via-jade-400 to-jade-600",
  magic: "from-magic-200 via-magic-400 to-magic-600",
} as const;

type AvatarFrameProps = {
  avatar: AvatarKey;
  size?: keyof typeof sizes;
  ring?: keyof typeof rings;
  /** Nhãn cho trình đọc màn hình; bỏ trống khi tên đã hiển thị ngay cạnh. */
  label?: string;
  /** Huy hiệu nhỏ ở góc dưới (vd. số hạng, ngôi sao). */
  badge?: ReactNode;
  className?: string;
};

/** Khung avatar tròn: viền gradient + viền trắng trong. Avatar là nhân vật hoạt hình có sẵn, không phải ảnh thật. */
export function AvatarFrame({ avatar, size = "md", ring = "sun", label, badge, className }: AvatarFrameProps) {
  return (
    <span className={cn("relative inline-flex shrink-0", className)}>
      <span className={cn("block rounded-full bg-linear-to-br shadow-soft", rings[ring], sizes[size])}>
        <span className="block size-full overflow-hidden rounded-full bg-surface p-0.5">
          <KidAvatar avatar={avatar} className="size-full" {...(label ? { title: label } : {})} />
        </span>
      </span>
      {badge ? <span className="absolute -right-1 -bottom-1">{badge}</span> : null}
    </span>
  );
}
