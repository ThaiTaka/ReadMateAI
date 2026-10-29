"use client";

import { Mic, Play, RotateCcw, Save, Square } from "lucide-react";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { RECORDING_AUTO_STOP_MS } from "@/features/audio-library/limits";
import {
  mapMediaError,
  pickRecorderMime,
  RECORDER_INITIAL,
  recorderReducer,
  type RecorderError,
} from "@/features/audio-library/recorder";
import { vi } from "@/strings/vi";
import { formatSeconds } from "./use-action";

type Props = {
  /** Lý do không ghi được (chưa bật, chưa đồng ý…); có giá trị thì mọi nút ghi bị khóa. */
  blockedReason: string | null;
  saving: boolean;
  /** Chỉ được gọi khi giáo viên bấm "Lưu bản nháp" — không bao giờ tự gọi sau khi dừng ghi. */
  onSave: (blob: Blob) => void;
};

/**
 * Trình ghi âm trong trình duyệt (MediaRecorder). Quy tắc an toàn:
 *  - chỉ xin quyền micro SAU khi GV bấm "Bắt đầu ghi" (không xin lúc tải trang, không ghi nền);
 *  - luôn tắt micro khi dừng, khi lỗi, khi rời trang/đổi âm (cleanup) — thiết bị ngắt giữa chừng thì bỏ bản ghi dở;
 *  - kết quả chỉ là bản nghe thử cho tới khi GV chủ động bấm "Lưu bản nháp".
 */
export function Recorder({ blockedReason, saving, onSave }: Props) {
  const t = vi.audioStudio.recorder;
  const [state, dispatch] = useReducer(recorderReducer, RECORDER_INITIAL);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [autoStopped, setAutoStopped] = useState(false);
  const [preview, setPreview] = useState<{ blob: Blob; url: string } | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);
  const intervalRef = useRef<number | null>(null);
  const discardRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const stopStream = useCallback(() => {
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const releasePreview = useCallback(() => setPreview(null), []);

  // Rời trang / đổi âm: dừng ghi, tắt micro, bỏ dữ liệu (không gửi gì đi).
  useEffect(() => {
    return () => {
      discardRef.current = true;
      const recorder = recorderRef.current;
      if (recorder && recorder.state !== "inactive") recorder.stop();
      stopStream();
    };
  }, [stopStream]);
  // Thu hồi địa chỉ tạm của bản nghe thử khi đổi/bỏ bản ghi hoặc rời trang.
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview.url);
    };
  }, [preview]);

  const fail = useCallback(
    (code: RecorderError) => {
      discardRef.current = true;
      const recorder = recorderRef.current;
      if (recorder && recorder.state !== "inactive") recorder.stop();
      recorderRef.current = null;
      stopStream();
      dispatch({ type: "failed", code });
    },
    [stopStream],
  );

  const start = async () => {
    if (blockedReason) return;
    releasePreview();
    setAutoStopped(false);
    setElapsedMs(0);
    dispatch({ type: "request" });
    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      dispatch({ type: "failed", code: "UNSUPPORTED" });
      return;
    }
    const mime = pickRecorderMime(MediaRecorder.isTypeSupported?.bind(MediaRecorder));
    if (!mime) {
      dispatch({ type: "failed", code: "UNSUPPORTED" });
      return;
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (error) {
      dispatch({ type: "failed", code: mapMediaError(error instanceof DOMException ? error.name : undefined) });
      return;
    }
    streamRef.current = stream;
    chunksRef.current = [];
    discardRef.current = false;
    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(stream, { mimeType: mime });
    } catch {
      stopStream();
      dispatch({ type: "failed", code: "UNSUPPORTED" });
      return;
    }
    recorderRef.current = recorder;
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data);
    };
    recorder.onerror = () => fail("RECORD_FAILED");
    recorder.onstop = () => {
      stopStream();
      if (discardRef.current) return;
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || mime });
      const durationMs = Math.round(performance.now() - startedAtRef.current);
      dispatch({ type: "stopped", durationMs, sizeBytes: blob.size });
      if (blob.size > 0) setPreview({ blob, url: URL.createObjectURL(blob) });
    };
    stream.getAudioTracks().forEach((track) => {
      track.onended = () => {
        if (recorder.state === "recording") fail("DEVICE_LOST");
      };
    });
    startedAtRef.current = performance.now();
    recorder.start();
    dispatch({ type: "started" });
    intervalRef.current = window.setInterval(() => {
      const elapsed = performance.now() - startedAtRef.current;
      setElapsedMs(elapsed);
      if (elapsed >= RECORDING_AUTO_STOP_MS && recorder.state === "recording") {
        setAutoStopped(true);
        recorder.stop();
      }
    }, 200);
  };

  const stop = () => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state === "recording") recorder.stop();
  };

  const reset = () => {
    releasePreview();
    setAutoStopped(false);
    dispatch({ type: "reset" });
  };

  const listen = () => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = 0;
    void audio.play().catch(() => undefined);
  };

  const seconds = formatSeconds(state.phase === "recorded" ? state.durationMs : elapsedMs);
  const busy = state.phase === "requesting" || state.phase === "recording";

  return (
    <section aria-labelledby="recorder-title" className="rounded-2xl border border-line bg-surface-muted/50 p-4 sm:p-5">
      <h4 id="recorder-title" className="text-lg font-extrabold text-ink">
        {t.title}
      </h4>
      <p className="mt-1 text-sm text-ink-soft">{t.steps}</p>
      <p className="mt-1 text-sm text-ink-faint">
        {t.maxHint.replace("{seconds}", String(RECORDING_AUTO_STOP_MS / 1000))}
      </p>

      {blockedReason ? (
        <p className="mt-3 rounded-xl bg-sun-50 px-4 py-3 text-sm font-semibold text-sun-800">{blockedReason}</p>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        {state.phase === "recording" ? (
          <Button size="lg" variant="secondary" onClick={stop}>
            <Square aria-hidden="true" className="size-5" />
            {t.stop}
          </Button>
        ) : (
          <Button size="lg" onClick={start} disabled={Boolean(blockedReason) || busy || saving}>
            <Mic aria-hidden="true" className="size-5" />
            {preview ? t.rerecord : t.start}
          </Button>
        )}
        {state.phase === "recording" ? (
          <span aria-hidden="true" className="font-mono text-lg font-bold tabular-nums text-ink">
            {seconds} s
          </span>
        ) : null}
      </div>

      {/* Chỉ thông báo khi đổi trạng thái (bắt đầu/dừng), không đọc từng nhịp đếm giây. */}
      <p aria-live="polite" className="mt-3 min-h-6 text-sm font-semibold text-ink">
        {state.phase === "requesting" ? t.requesting : null}
        {state.phase === "recording" ? t.recordingStatus : null}
        {state.phase === "recorded" ? t.stoppedStatus.replace("{seconds}", seconds) : null}
        {state.phase === "recorded" && autoStopped
          ? ` ${t.autoStopped.replace("{seconds}", String(RECORDING_AUTO_STOP_MS / 1000))}`
          : null}
      </p>

      {state.phase === "error" ? (
        <p role="alert" className="mt-2 rounded-xl bg-coral-50 px-4 py-3 text-sm font-semibold text-coral-800">
          {t.errors[state.code]}
        </p>
      ) : null}

      {state.phase === "recorded" && preview ? (
        <div className="mt-3 grid gap-3">
          <audio ref={audioRef} controls src={preview.url} aria-label={t.previewLabel} className="w-full" />
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" onClick={listen}>
              <Play aria-hidden="true" className="size-5" />
              {t.listenAgain}
            </Button>
            <Button variant="outline" onClick={reset} disabled={saving}>
              <RotateCcw aria-hidden="true" className="size-5" />
              {t.rerecord}
            </Button>
            <Button onClick={() => onSave(preview.blob)} disabled={saving || Boolean(blockedReason)}>
              <Save aria-hidden="true" className="size-5" />
              {saving ? t.saving : t.save}
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
