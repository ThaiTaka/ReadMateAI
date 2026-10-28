"use client";

import { useEffect, useRef } from "react";

/**
 * Bọc các thẻ <audio> để chỉ một đoạn phát tại một thời điểm (nghe A/B không bị chồng tiếng). Không tự phát, không gọi mạng.
 * Sự kiện `play` không nổi bọt nên bắt ở pha capture.
 */
export function ExclusiveAudio({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const onPlay = (event: Event) => {
      for (const audio of root.querySelectorAll("audio")) {
        if (audio !== event.target && !audio.paused) audio.pause();
      }
    };
    root.addEventListener("play", onPlay, true);
    return () => root.removeEventListener("play", onPlay, true);
  }, []);
  return <div ref={ref}>{children}</div>;
}
