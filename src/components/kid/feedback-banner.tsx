import { BookOpenCheck, PartyPopper, RotateCcw } from "lucide-react";
import type { Feedback } from "@/features/exercises/core/feedback";
import { cn } from "@/lib/cn";

const STYLES = {
  correct: { box: "border-brand-300 bg-brand-50", icon: "text-brand-700", Icon: PartyPopper },
  retry: { box: "border-sun-300 bg-sun-50", icon: "text-sun-800", Icon: RotateCcw },
  reveal: { box: "border-lagoon-200 bg-lagoon-50", icon: "text-lagoon-700", Icon: BookOpenCheck },
} as const;

/**
 * Phản hồi sau khi chấm: biểu tượng + tiêu đề + lời nhắc, được trình đọc màn hình thông báo (aria-live).
 * Đáp án chỉ hiện khi câu đã xong (đúng hoặc hết lượt) — quy tắc A5.
 */
export function FeedbackBanner({ feedback, className }: { feedback: Feedback | null; className?: string }) {
  return (
    <div role="status" aria-live="polite" className={cn("min-h-0", className)}>
      {feedback ? (
        <div className={cn("flex gap-3 rounded-2xl border-2 p-4", STYLES[feedback.tone].box)}>
          {(() => {
            const { Icon, icon } = STYLES[feedback.tone];
            return <Icon aria-hidden="true" className={cn("mt-0.5 size-7 shrink-0", icon)} />;
          })()}
          <div className="min-w-0">
            <p className="text-lg font-extrabold text-ink">{feedback.title}</p>
            <p className="text-ink-soft">
              {feedback.message}
              {feedback.tone === "reveal" && feedback.reveal ? ":" : ""}
            </p>
            {feedback.tone === "reveal" && feedback.reveal ? (
              <p className="mt-1 font-reading text-read font-bold text-ink">{feedback.reveal.answerText}</p>
            ) : null}
            {feedback.tone !== "retry" && feedback.reveal?.explanation ? (
              <p className="mt-1 text-sm text-ink-soft">{feedback.reveal.explanation}</p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
