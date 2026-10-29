"use client";

import { useEffect, useState } from "react";
import { AudioSlot, type AudioSource } from "@/components/kid/audio-slot";
import { useSoundMuted } from "@/components/kid/sound-mute";
import type { PlaybackRole } from "@/features/audio-playback/roles";
import { vi } from "@/strings/vi";

type Availability =
  | { phase: "pending" }
  | { phase: "done"; muted: boolean; withheld: boolean; preview: boolean; source: AudioSource | null };

/**
 * Nút nghe bản ghi giáo viên của MỘT khe của MỘT câu (R10.3a). Hỏi máy chủ (`GET …/audio`) xem khe này phát được ngay bây
 * giờ không; chỉ khi có mới hiện nút phát. Cờ tắt / chưa có bản ghi đã duyệt / lỗi mạng → nút khóa "Chưa có âm thanh" —
 * KHÔNG yêu cầu tệp âm thanh nào. Tệp chỉ được tải khi trẻ chạm nút (trong AudioSlot). Không bao giờ tự phát.
 * Không biết (và không cần biết) mã tài nguyên hay đường dẫn lưu trữ: URL phát luôn là `/audio/{role}` của chính câu.
 *
 * Khe `feedback` (lời nhắn sau khi trả lời) cần `feedbackRef` — mã dòng của khung phản hồi; máy chủ đối chiếu với trạng thái thật của câu.
 * Không có tệp thì KHÔNG vẽ gì (lời nhắn chỉ là phần thêm, khác với câu lệnh). Tệp của chế độ trình diễn được ghi chú nhỏ "Giọng máy trình diễn".
 */
export function QuestionAudio({
  questionId,
  role,
  label,
  className,
  feedbackRef,
}: {
  questionId: string;
  role: PlaybackRole;
  label: string;
  className?: string;
  feedbackRef?: string;
}) {
  // Gắn trạng thái với đúng câu/khe đã hỏi: đổi câu thì trạng thái cũ không bị dùng lại (không cần setState đồng bộ).
  const [found, setFound] = useState<{ key: string; value: Availability } | null>(null);
  const key = `${questionId}:${role}:${feedbackRef ?? ""}`;
  const soundOff = useSoundMuted();

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      let value: Availability = { phase: "done", muted: false, withheld: false, preview: false, source: null };
      try {
        const query = feedbackRef ? `?feedback=${encodeURIComponent(feedbackRef)}` : "";
        const response = await fetch(`/api/student/question-instances/${questionId}/audio${query}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const body = (await response.json()) as {
          ok?: boolean;
          data?: {
            muted?: boolean;
            slots?: Partial<Record<PlaybackRole, { mimeType?: unknown }>>;
            withheld?: unknown;
            preview?: unknown;
          };
        };
        const slot = body.ok ? body.data?.slots?.[role] : undefined;
        value = {
          phase: "done",
          muted: body.ok === true && body.data?.muted === true,
          // Khe bị chính sách giữ lại ở mức hỗ trợ này (ví dụ câu lệnh ở H1/H0): không phải "chưa có âm thanh" nên không vẽ nút.
          withheld: body.ok === true && Array.isArray(body.data?.withheld) && body.data.withheld.includes(role),
          preview: body.ok === true && Array.isArray(body.data?.preview) && body.data.preview.includes(role),
          source:
            slot && typeof slot.mimeType === "string"
              ? {
                  url: `/api/student/question-instances/${questionId}/audio/${role}${feedbackRef ? `?line=${encodeURIComponent(feedbackRef)}` : ""}`,
                  mimeType: slot.mimeType,
                }
              : null,
        };
      } catch {
        if (controller.signal.aborted) return;
      }
      setFound({ key, value });
    })();
    return () => controller.abort();
  }, [questionId, role, key, feedbackRef]);

  const current = found?.key === key ? found.value : ({ phase: "pending" } as const);
  if (current.phase === "done" && current.withheld) return null;
  if (role === "feedback" && current.phase === "done" && !current.source && !current.muted) return null;
  return (
    <AudioSlot
      key={key}
      label={label}
      className={className}
      pending={current.phase === "pending"}
      muted={soundOff || (current.phase === "done" && current.muted)}
      source={current.phase === "done" ? current.source : null}
      {...(current.phase === "done" && current.preview ? { note: vi.contest.voiceNote } : {})}
    />
  );
}
