import { Construction, Info } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type NoticeTone = "info" | "progress";

const tones: Record<NoticeTone, { box: string; icon: string }> = {
  info: { box: "border-lagoon-200 bg-lagoon-50", icon: "text-lagoon-700" },
  progress: { box: "border-sun-200 bg-sun-50", icon: "text-sun-700" },
};

type NoticeProps = {
  title: string;
  children: ReactNode;
  tone?: NoticeTone;
  className?: string;
};

/** Khung thông báo trạng thái (ví dụ "Chức năng đang phát triển") — có biểu tượng và chữ, không chỉ dựa vào màu. */
export function Notice({ title, children, tone = "info", className }: NoticeProps) {
  const Icon = tone === "progress" ? Construction : Info;
  return (
    <div role="note" className={cn("flex gap-3 rounded-2xl border p-4 sm:p-5", tones[tone].box, className)}>
      <Icon aria-hidden="true" className={cn("mt-0.5 size-6 shrink-0", tones[tone].icon)} />
      <div>
        <p className="font-bold text-ink">{title}</p>
        <div className="mt-1 leading-relaxed text-ink-soft">{children}</div>
      </div>
    </div>
  );
}
