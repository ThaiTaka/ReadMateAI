import { FlaskConical } from "lucide-react";
import { cn } from "@/lib/cn";
import { vi } from "@/strings/vi";

/**
 * Nhãn bắt buộc của mọi màn dùng dữ liệu minh họa (R02): "BẢN CHƠI THỬ – DỮ LIỆU MINH HỌA" + giải thích ngắn.
 * Chữ in hoa bằng CSS để trình đọc màn hình đọc như câu thường.
 */
export function PreviewRibbon({ className }: { className?: string }) {
  return (
    <div
      role="note"
      className={cn(
        "flex flex-col gap-1 rounded-2xl border-2 border-dashed border-sun-400 bg-sun-50 px-4 py-3 sm:flex-row sm:items-center sm:gap-3",
        className,
      )}
    >
      <span className="inline-flex items-center gap-2 text-sm font-extrabold tracking-wide text-sun-800 uppercase">
        <FlaskConical aria-hidden="true" className="size-5 shrink-0" />
        {vi.adventure.previewRibbon}
      </span>
      <span className="text-sm text-ink-soft">{vi.adventure.previewRibbonNote}</span>
    </div>
  );
}
