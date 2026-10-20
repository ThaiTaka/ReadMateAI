import { Hammer } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { vi } from "@/strings/vi";

type ComingSoonStateProps = {
  title: string;
  description: ReactNode;
  /** Minh họa tùy chọn (thay biểu tượng búa). */
  art?: ReactNode;
  /** Nội dung thêm (danh sách tính năng dự kiến, ghi chú an toàn…). Không đặt nút hoạt động giả ở đây. */
  children?: ReactNode;
  className?: string;
};

/**
 * Trạng thái "Sắp có – Đang phát triển": cho biết chức năng chưa hoạt động và sẽ làm gì. Luôn có nhãn chữ;
 * không có nút trông như hoạt động (CLAUDE.md §9.1.7).
 */
export function ComingSoonState({ title, description, art, children, className }: ComingSoonStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 rounded-card border-2 border-dashed border-line-strong bg-surface/80 p-6 sm:flex-row sm:items-start",
        className,
      )}
    >
      <div aria-hidden="true" className="shrink-0">
        {art ?? (
          <span className="flex size-14 items-center justify-center rounded-2xl bg-magic-50 text-magic-700">
            <Hammer className="size-7" />
          </span>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <span className="self-start rounded-full bg-magic-100 px-3 py-1 text-xs font-extrabold text-magic-800">
          {vi.status.comingSoonDev}
        </span>
        <p className="text-lg font-bold text-ink">{title}</p>
        <div className="leading-relaxed text-ink-soft">{description}</div>
        {children}
      </div>
    </div>
  );
}
