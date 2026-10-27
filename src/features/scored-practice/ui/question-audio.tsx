"use client";

import { useEffect, useState } from "react";
import { AudioSlot, type AudioSource } from "@/components/kid/audio-slot";
import type { PlaybackRole } from "@/features/audio-playback/roles";

type Availability = { phase: "pending" } | { phase: "done"; muted: boolean; source: AudioSource | null };

/**
 * Nút nghe bản ghi giáo viên của MỘT khe của MỘT câu (R10.3a). Hỏi máy chủ (`GET …/audio`) xem khe này phát được ngay bây
 * giờ không; chỉ khi có mới hiện nút phát. Cờ tắt / chưa có bản ghi đã duyệt / lỗi mạng → nút khóa "Chưa có âm thanh" —
 * KHÔNG yêu cầu tệp âm thanh nào. Tệp chỉ được tải khi trẻ chạm nút (trong AudioSlot). Không bao giờ tự phát.
 * Không biết (và không cần biết) mã tài nguyên hay đường dẫn lưu trữ: URL phát luôn là `/audio/{role}` của chính câu.
 */
export function QuestionAudio({
  questionId,
  role,
  label,
  className,
}: {
  questionId: string;
  role: PlaybackRole;
  label: string;
  className?: string;
}) {
  // Gắn trạng thái với đúng câu/khe đã hỏi: đổi câu thì trạng thái cũ không bị dùng lại (không cần setState đồng bộ).
  const [found, setFound] = useState<{ key: string; value: Availability } | null>(null);
  const key = `${questionId}:${role}`;

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      let value: Availability = { phase: "done", muted: false, source: null };
      try {
        const response = await fetch(`/api/student/question-instances/${questionId}/audio`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const body = (await response.json()) as {
          ok?: boolean;
          data?: { muted?: boolean; slots?: Partial<Record<PlaybackRole, { mimeType?: unknown }>> };
        };
        const slot = body.ok ? body.data?.slots?.[role] : undefined;
        value = {
          phase: "done",
          muted: body.ok === true && body.data?.muted === true,
          source:
            slot && typeof slot.mimeType === "string"
              ? { url: `/api/student/question-instances/${questionId}/audio/${role}`, mimeType: slot.mimeType }
              : null,
        };
      } catch {
        if (controller.signal.aborted) return;
      }
      setFound({ key, value });
    })();
    return () => controller.abort();
  }, [questionId, role, key]);

  const current = found?.key === key ? found.value : ({ phase: "pending" } as const);
  return (
    <AudioSlot
      key={key}
      label={label}
      className={className}
      pending={current.phase === "pending"}
      muted={current.phase === "done" && current.muted}
      source={current.phase === "done" ? current.source : null}
    />
  );
}
