"use client";

import { Square, Volume2, VolumeX } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { browserSupportsMime } from "@/features/audio-playback/support";
import { cn } from "@/lib/cn";
import { vi } from "@/strings/vi";
import { claimAudio, releaseAudio } from "./exclusive-audio";

/** Nguồn đã được MÁY CHỦ cho phép phát (đúng câu, đúng khe). Tệp thật chỉ tải về khi trẻ chạm nút. */
export type AudioSource = { url: string; mimeType: string };

type AudioSlotProps = {
  /** Việc nút sẽ làm khi có âm thanh, ví dụ "Nghe câu lệnh". */
  label: string;
  /** Ghi chú cho người lớn (ví dụ "sẽ tự phát khi có âm thanh"). */
  note?: string;
  className?: string;
  /** Có nguồn hợp lệ → nút phát được. Không có → nút khóa "Chưa có âm thanh" (không giả lập, không giọng trình duyệt). */
  source?: AudioSource | null;
  /** Đang hỏi máy chủ xem có âm thanh không. */
  pending?: boolean;
  /** Học sinh đã tắt âm thanh trong cài đặt: không phát. */
  muted?: boolean;
  /** Nút kín chiều ngang của ô chứa (ô chữ ở trang Học tập). Không đổi hành vi. */
  fill?: boolean;
  /** Tên truy cập khi sẵn sàng (phải chứa chữ hiển thị). Ví dụ "Nghe tên chữ b". */
  ariaLabel?: string;
  /** Lý do KHÔNG phát khi không có nguồn (mặc định "Chưa có âm thanh"). Ví dụ "Chờ kiểm chứng cách đọc": nói đúng sự thật thay vì "chưa có". */
  unavailableReason?: string;
};

type PlayState = "ready" | "loading" | "playing" | "error";

const lockedBase =
  "inline-flex items-center gap-1.5 rounded-full border-2 border-dashed border-line-strong bg-surface-muted px-3 font-semibold text-ink-soft";
// Nút khóa nhỏ ở khung câu hỏi; nút khóa kín ô (ô chữ) giữ cùng chiều cao 64 px với nút phát để ô không "nhảy" khi mở khóa.
const lockedClasses = `${lockedBase} min-h-10 text-xs`;
const lockedFillClasses = `${lockedBase} min-h-touch-kid text-sm`;
const playClasses =
  "inline-flex min-h-touch-kid min-w-touch-kid items-center gap-3 rounded-full border-2 border-ink bg-surface px-5 text-lg font-extrabold text-ink hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2";

/**
 * Điểm tích hợp âm thanh (docs/EXERCISE_ENGINE.md §5, docs/AUDIO_ENGINE.md §13). Nút CHỈ phát được khi có `source` do
 * máy chủ cấp (bản ghi giáo viên đã duyệt); ngược lại luôn khóa và ghi rõ "Chưa có âm thanh".
 *
 * - Chỉ bắt đầu phát trong hàm xử lý thao tác chạm của người dùng (iOS/Safari chặn tự phát) — không có tự phát.
 * - Dùng thẻ audio của trình duyệt với URL cùng nguồn; KHÔNG dùng Web Speech API / giọng đọc của trình duyệt, và không
 *   âm thầm thay bằng giọng tổng hợp. Định dạng không phát được → báo "chưa phát được", không chuyển mã.
 * - Mỗi lần chạm là một yêu cầu mới tới máy chủ (không lưu bộ nhớ đệm) nên bản ghi bị thu hồi sẽ không phát lại được.
 * - Một âm tại một thời điểm (`claimAudio`); rời trang hoặc đổi `key` của thành phần (đổi câu) → dừng và nhả tài nguyên.
 */
export function AudioSlot({
  label,
  note,
  className,
  source = null,
  pending = false,
  muted = false,
  fill = false,
  ariaLabel,
  unavailableReason,
}: AudioSlotProps) {
  const [state, setState] = useState<PlayState>("ready");
  const [played, setPlayed] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(
    () => () => {
      const audio = audioRef.current;
      audioRef.current = null;
      if (audio) releaseAudio(audio);
    },
    [],
  );

  const stop = () => {
    const audio = audioRef.current;
    audioRef.current = null;
    if (audio) releaseAudio(audio);
  };

  const press = () => {
    if (!source) return;
    if (state === "loading" || state === "playing") {
      stop();
      setState("ready");
      return;
    }
    const audio = new Audio();
    audio.preload = "none";
    audioRef.current = audio;
    audio.addEventListener("playing", () => setState("playing"));
    audio.addEventListener("ended", () => {
      setState("ready");
      setPlayed(true);
    });
    audio.addEventListener("pause", () => {
      // Âm khác giành quyền phát (claimAudio) hoặc bị dừng: nút về trạng thái sẵn sàng.
      if (!audio.ended && audioRef.current === audio) setState("ready");
    });
    audio.addEventListener("error", () => {
      if (audioRef.current === audio) setState("error");
    });
    claimAudio(audio);
    setState("loading");
    // `src` đặt ngay trong thao tác chạm: yêu cầu mới tới máy chủ, máy chủ kiểm tra lại quyền.
    audio.src = source.url;
    audio.play().catch(() => {
      if (audioRef.current === audio) setState("error");
    });
  };

  const tail = note ? <span className="pl-2 text-xs text-ink-faint">{note}</span> : null;
  const fillClasses = fill ? "w-full justify-center text-center" : "";
  const locked = (reason: string, busy = false) => (
    <span className={cn("inline-flex flex-col items-start gap-1", fill && "w-full", className)}>
      <button
        type="button"
        disabled
        aria-disabled="true"
        aria-busy={busy || undefined}
        aria-label={ariaLabel ? `${ariaLabel}: ${reason}` : undefined}
        className={cn(fill ? lockedFillClasses : lockedClasses, fillClasses)}
      >
        {busy ? <Volume2 aria-hidden="true" className="size-4" /> : <VolumeX aria-hidden="true" className="size-4" />}
        <span>
          {label}: {reason}
        </span>
      </button>
      {tail}
    </span>
  );

  if (muted) return locked(vi.practice.audio.muted);
  if (pending) return locked(vi.practice.audio.loading, true);
  if (!source) return locked(unavailableReason ?? vi.practice.audio.unavailable);
  if (!browserSupportsMime(source.mimeType)) {
    return (
      <span className={cn("inline-flex flex-col items-start gap-1", fill && "w-full", className)}>
        <button
          type="button"
          disabled
          aria-disabled="true"
          aria-label={ariaLabel ? `${ariaLabel}: ${vi.practice.audio.unavailable}` : undefined}
          className={cn(fill ? lockedFillClasses : lockedClasses, fillClasses)}
        >
          <VolumeX aria-hidden="true" className="size-4" />
          <span>
            {label}: {vi.practice.audio.unavailable}
          </span>
        </button>
        <span aria-live="polite" className="pl-2 text-sm font-semibold text-ink-soft">
          {vi.practice.audio.unsupported}
        </span>
      </span>
    );
  }

  const busy = state === "loading" || state === "playing";
  const text =
    state === "loading"
      ? vi.practice.audio.loading
      : state === "playing"
        ? vi.practice.audio.playing
        : played
          ? vi.practice.audio.replay
          : label;
  return (
    <span className={cn("inline-flex flex-col items-start gap-1", fill && "w-full", className)}>
      <button
        type="button"
        onClick={press}
        aria-label={
          !busy
            ? ariaLabel
              ? played
                ? `${text}: ${ariaLabel}`
                : ariaLabel
              : played
                ? `${text}: ${label}`
                : undefined
            : undefined
        }
        aria-busy={state === "loading" || undefined}
        data-audio-state={state}
        className={cn(playClasses, fillClasses)}
      >
        {busy ? <Square aria-hidden="true" className="size-6" /> : <Volume2 aria-hidden="true" className="size-7" />}
        <span>{text}</span>
      </button>
      <span aria-live="polite" className="pl-2 text-sm font-semibold text-ink-soft">
        {state === "error" ? vi.practice.audio.error : ""}
      </span>
      {tail}
    </span>
  );
}
