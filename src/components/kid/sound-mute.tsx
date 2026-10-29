"use client";

import { Volume2, VolumeX } from "lucide-react";
import { useSyncExternalStore } from "react";
import { cn } from "@/lib/cn";
import { vi } from "@/strings/vi";
import { stopAllAudio } from "./exclusive-audio";

/**
 * Nút TẮT/BẬT tiếng ngay trong màn chơi (buổi luyện, Mê cung kho báu, Học tập). Chỉ là trạng thái tạm trong bộ nhớ của trang này —
 * không lưu localStorage/cookie và không đổi cài đặt âm thanh đã lưu của học sinh (cài đặt đó vẫn do người lớn chọn ở trang của con).
 * Tắt tiếng thì dừng ngay âm đang phát và các nút nghe chuyển sang trạng thái khóa "Âm thanh đang tắt"; bật lại thì nghe được như cũ.
 */

let muted = false;
const listeners = new Set<() => void>();

function setMuted(value: boolean): void {
  if (muted === value) return;
  muted = value;
  if (value) stopAllAudio();
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Trạng thái tắt tiếng tạm của trang (máy chủ luôn coi là chưa tắt). */
export function useSoundMuted(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => muted,
    () => false,
  );
}

export function SoundMuteButton({ className }: { className?: string }) {
  const isMuted = useSoundMuted();
  const t = vi.soundMute;
  const Icon = isMuted ? VolumeX : Volume2;
  return (
    <button
      type="button"
      aria-pressed={isMuted}
      data-testid="sound-mute"
      onClick={() => setMuted(!isMuted)}
      className={cn(
        "inline-flex min-h-touch-kid items-center gap-2 rounded-full border-2 border-ink bg-surface px-4 text-base font-extrabold text-ink hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2",
        className,
      )}
    >
      <Icon aria-hidden="true" className="size-6" />
      <span>{isMuted ? t.turnOn : t.turnOff}</span>
    </button>
  );
}
