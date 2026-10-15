import { VolumeX } from "lucide-react";
import { cn } from "@/lib/cn";
import { vi } from "@/strings/vi";

type AudioSlotProps = {
  /** Việc nút sẽ làm khi có âm thanh, ví dụ "Nghe câu lệnh". */
  label: string;
  /** Ghi chú cho người lớn (ví dụ "sẽ tự phát khi có âm thanh"). */
  note?: string;
  className?: string;
};

/**
 * Điểm tích hợp âm thanh (docs/EXERCISE_ENGINE.md §5). GĐ4 CHƯA có tệp âm thanh nào được duyệt, nên nút
 * luôn bị khóa và ghi rõ "Chưa có âm thanh" — không giả lập phát âm thanh, không dùng giọng đọc của trình
 * duyệt (có thể gửi chữ ra máy chủ bên ngoài, chất lượng chưa xác minh). Nút chỉ được hiển thị khi chính
 * sách âm thanh của dạng bài cho phép phát khe đó ở mức hỗ trợ hiện tại.
 */
export function AudioSlot({ label, note, className }: AudioSlotProps) {
  return (
    <span className={cn("inline-flex flex-col items-start gap-0.5", className)}>
      <button
        type="button"
        disabled
        aria-disabled="true"
        className="inline-flex min-h-10 items-center gap-1.5 rounded-full border-2 border-dashed border-line-strong bg-surface-muted px-3 text-xs font-semibold text-ink-soft"
      >
        <VolumeX aria-hidden="true" className="size-4" />
        <span>
          {label}: {vi.practice.audio.unavailable}
        </span>
      </button>
      {note ? <span className="pl-2 text-xs text-ink-faint">{note}</span> : null}
    </span>
  );
}
