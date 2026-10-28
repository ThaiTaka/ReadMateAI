import { inspectAudio, type AudioRejection } from "../../features/audio-library/inspect.ts";
import type { AudioMimeType } from "../../features/audio-library/limits.ts";
import { sha256Hex } from "./hash.ts";
import type { TtsAudio } from "./types.ts";

/**
 * Kiểm tra KỸ THUẬT tệp nhà cung cấp trả về, theo NỘI DUNG (dùng lại `inspectAudio` của thư viện bản ghi giáo viên):
 * nhận ra định dạng thật, tính thời lượng, đối chiếu MIME mà nhà cung cấp khai. Byte của mock (`MOCK-TTS…`) không phải
 * âm thanh nên bị từ chối ở đây — không bao giờ tới trình phát hay giả làm MP3 (docs/AUDIO_ENGINE.md §14.4).
 * Không giải mã nên không phát hiện tệp im lặng: giáo viên phải NGHE trước khi duyệt.
 */

export type SynthesizedAudioMeta = {
  sha256: string;
  byteLength: number;
  mime: AudioMimeType;
  durationMs: number;
  /** Đã qua `inspectAudio`; không có đường nào tạo giá trị `true` mà không kiểm tra. */
  inspected: true;
};

export type SynthesizedAudioCheck =
  { ok: true; audio: SynthesizedAudioMeta } | { ok: false; code: AudioRejection | "AUDIO_MIME_MISMATCH" };

export function checkSynthesizedAudio(data: TtsAudio): SynthesizedAudioCheck {
  const inspection = inspectAudio(data.bytes);
  if (!inspection.ok) return { ok: false, code: inspection.code };
  if (inspection.mime !== data.mimeType) return { ok: false, code: "AUDIO_MIME_MISMATCH" };
  return {
    ok: true,
    audio: {
      sha256: sha256Hex(data.bytes),
      byteLength: data.bytes.byteLength,
      mime: inspection.mime,
      durationMs: inspection.durationMs,
      inspected: true,
    },
  };
}
