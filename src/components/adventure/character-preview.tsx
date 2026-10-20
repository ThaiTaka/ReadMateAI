import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { vi } from "@/strings/vi";

type CharacterPreviewProps = {
  /** Hình nhân vật (thành phần trong src/components/art). */
  art: ReactNode;
  name: string;
  role: string;
  /** Mô tả ngắn / lời thoại. */
  note?: string;
  /** Mọi nhân vật R02 đều là bản phác thảo chờ GV duyệt — luôn hiện nhãn, không có trạng thái "đã duyệt" giả. */
  sketch?: boolean;
  tone?: "jade" | "magic" | "sun" | "lagoon";
  className?: string;
};

const backgrounds = {
  jade: "from-jade-50 to-jade-100",
  magic: "from-magic-50 to-magic-100",
  sun: "from-sun-50 to-sun-100",
  lagoon: "from-lagoon-50 to-lagoon-100",
} as const;

/** Thẻ giới thiệu nhân vật: hình trên nền dịu + tên + vai trò + nhãn trạng thái duyệt. */
export function CharacterPreview({
  art,
  name,
  role,
  note,
  sketch = true,
  tone = "jade",
  className,
}: CharacterPreviewProps) {
  return (
    <figure
      className={cn(
        "flex h-full flex-col overflow-hidden rounded-card border border-line bg-surface shadow-soft",
        className,
      )}
    >
      <div className={cn("flex aspect-square items-center justify-center bg-linear-to-b p-5", backgrounds[tone])}>
        {/* Lưới nhiều nhân vật: tắt hoạt cảnh để trang nhẹ và để GV nhìn rõ hình. */}
        <div className="w-full max-w-44 [&_*]:animate-none!">{art}</div>
      </div>
      <figcaption className="flex flex-1 flex-col gap-1 p-4">
        <span className="text-lg font-extrabold text-ink">{name}</span>
        <span className="text-sm font-semibold text-ink-soft">{role}</span>
        {note ? <span className="text-sm text-ink-soft">{note}</span> : null}
        {sketch ? (
          <span className="mt-2 self-start rounded-full bg-sun-100 px-2.5 py-0.5 text-xs font-bold text-sun-800">
            {vi.status.sketch}
          </span>
        ) : null}
      </figcaption>
    </figure>
  );
}
