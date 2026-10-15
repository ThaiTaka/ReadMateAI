import { cn } from "@/lib/cn";

type ReadingTextProps = {
  text: string;
  /** Gợi ý: tách từng tiếng bằng dấu chấm giữa (quả • na). */
  split?: boolean;
  /** Gợi ý: tô màu âm đầu / phần còn lại của tiếng. */
  segments?: ReadonlyArray<{ text: string; part: "onset" | "rest" }> | undefined;
  size?: "md" | "lg" | "xl";
  className?: string;
};

const SIZES = { md: "text-read", lg: "text-read-lg", xl: "text-read-xl" } as const;

/**
 * Chữ học liệu cho trẻ đọc: font Andika (a, g một tầng), cỡ lớn, giãn dòng đủ cho dấu chồng tầng.
 * Phần tô màu luôn kèm gạch chân để không truyền tin chỉ bằng màu.
 */
export function ReadingText({ text, split = false, segments, size = "lg", className }: ReadingTextProps) {
  if (segments && segments.length > 0) {
    return (
      <span lang="vi" className={cn("font-reading font-bold text-ink", SIZES[size], className)}>
        {segments.map((segment, index) => (
          <span
            key={index}
            className={
              segment.part === "onset"
                ? "rounded bg-lagoon-100 px-0.5 text-lagoon-800 underline decoration-4 underline-offset-8"
                : "rounded bg-sun-100 px-0.5 text-sun-800"
            }
          >
            {segment.text}
          </span>
        ))}
      </span>
    );
  }
  const shown = split ? text.split(" ").join(" • ") : text;
  return (
    <span lang="vi" className={cn("font-reading font-bold text-ink", SIZES[size], className)}>
      {shown}
    </span>
  );
}
