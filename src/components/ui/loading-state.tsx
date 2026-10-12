import { cn } from "@/lib/cn";
import { vi } from "@/strings/vi";

type LoadingStateProps = {
  label?: string;
  className?: string;
};

/** Trạng thái đang tải: có role="status" để trình đọc màn hình thông báo. */
export function LoadingState({ label = vi.a11y.loading, className }: LoadingStateProps) {
  return (
    <div role="status" aria-live="polite" className={cn("flex items-center gap-3 text-ink-soft", className)}>
      <span
        aria-hidden="true"
        className="size-5 animate-spin rounded-full border-[3px] border-brand-200 border-t-brand-600"
      />
      <span>{label}</span>
    </div>
  );
}

type SkeletonProps = {
  className?: string;
};

/** Khối giữ chỗ trong lúc chờ nội dung — thuần trang trí, ẩn với trình đọc màn hình. */
export function Skeleton({ className }: SkeletonProps) {
  return <div aria-hidden="true" className={cn("animate-pulse rounded-xl bg-surface-muted", className)} />;
}
