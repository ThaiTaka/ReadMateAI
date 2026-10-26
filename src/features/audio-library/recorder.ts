import { AUDIO_MIN_DURATION_MS } from "./limits.ts";

/**
 * Phần thuần của trình ghi âm ở trình duyệt: chọn định dạng MediaRecorder theo khả năng thật của trình duyệt (không cố
 * định WebM — Safari/iPhone ghi MP4), ánh xạ lỗi micro, và máy trạng thái. Không tự ghi, không tự gửi: trạng thái
 * `recorded` chỉ là bản nghe thử; gửi lên máy chủ luôn là thao tác riêng của giáo viên.
 */

/** Thứ tự ưu tiên; trả null nếu trình duyệt không ghi được định dạng nào (khi đó chỉ còn cách tải tệp lên). */
const RECORDER_MIME_CANDIDATES = [
  "audio/webm;codecs=opus",
  "audio/mp4",
  "audio/ogg;codecs=opus",
  "audio/webm",
] as const;

export function pickRecorderMime(isTypeSupported: ((mime: string) => boolean) | null | undefined): string | null {
  if (!isTypeSupported) return null;
  for (const mime of RECORDER_MIME_CANDIDATES) {
    try {
      if (isTypeSupported(mime)) return mime;
    } catch {
      // Trình duyệt ném lỗi với tham số lạ: coi như không hỗ trợ.
    }
  }
  return null;
}

export const RECORDER_ERRORS = [
  "UNSUPPORTED",
  "MIC_DENIED",
  "MIC_NOT_FOUND",
  "MIC_BUSY",
  "DEVICE_LOST",
  "RECORD_FAILED",
  "EMPTY_RECORDING",
  "TOO_SHORT",
] as const;
export type RecorderError = (typeof RECORDER_ERRORS)[number];

/** Tên lỗi của `getUserMedia` (DOMException.name) → mã dễ hiểu cho giáo viên. */
export function mapMediaError(name: string | undefined): RecorderError {
  switch (name) {
    case "NotAllowedError":
    case "SecurityError":
    case "PermissionDeniedError":
      return "MIC_DENIED";
    case "NotFoundError":
    case "DevicesNotFoundError":
    case "OverconstrainedError":
      return "MIC_NOT_FOUND";
    case "NotReadableError":
    case "TrackStartError":
    case "AbortError":
      return "MIC_BUSY";
    default:
      return "RECORD_FAILED";
  }
}

export type RecorderState =
  | { phase: "idle" }
  | { phase: "requesting" }
  | { phase: "recording" }
  | { phase: "recorded"; durationMs: number; sizeBytes: number }
  | { phase: "error"; code: RecorderError };

export type RecorderAction =
  | { type: "request" }
  | { type: "started" }
  | { type: "stopped"; durationMs: number; sizeBytes: number }
  | { type: "failed"; code: RecorderError }
  | { type: "reset" };

export const RECORDER_INITIAL: RecorderState = { phase: "idle" };

export function recorderReducer(state: RecorderState, action: RecorderAction): RecorderState {
  switch (action.type) {
    case "request":
      // Chỉ xin quyền micro khi đang rảnh/đã xong/lỗi — không chồng hai phiên ghi.
      return state.phase === "requesting" || state.phase === "recording" ? state : { phase: "requesting" };
    case "started":
      return state.phase === "requesting" ? { phase: "recording" } : state;
    case "stopped":
      if (state.phase !== "recording") return state;
      if (action.sizeBytes <= 0) return { phase: "error", code: "EMPTY_RECORDING" };
      if (action.durationMs < AUDIO_MIN_DURATION_MS) return { phase: "error", code: "TOO_SHORT" };
      return { phase: "recorded", durationMs: action.durationMs, sizeBytes: action.sizeBytes };
    case "failed":
      return { phase: "error", code: action.code };
    case "reset":
      return RECORDER_INITIAL;
  }
}
