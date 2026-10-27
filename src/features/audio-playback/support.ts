/**
 * Trình duyệt này có phát được định dạng của bản ghi không (R10.3a). HÀM THUẦN: nhận `canPlayType` của một thẻ audio để
 * kiểm thử được ở môi trường không có thẻ thật. Chỉ BÁO không hỗ trợ — không chuyển mã, không đổi sang giọng khác.
 *
 * WebM/Opus: Safari/iPhone cũ không phát được → khi đó GV cần cung cấp bản M4A hoặc MP3 (docs/TEACHER_AUDIO_GUIDE.md).
 */

const PROBES: Readonly<Record<string, readonly string[]>> = {
  "audio/webm": ['audio/webm; codecs="opus"', 'audio/webm; codecs="vorbis"'],
  "audio/ogg": ['audio/ogg; codecs="opus"', 'audio/ogg; codecs="vorbis"'],
  "audio/mp4": ['audio/mp4; codecs="mp4a.40.2"', "audio/mp4"],
  "audio/mpeg": ["audio/mpeg"],
  "audio/wav": ["audio/wav", "audio/x-wav"],
};

export function mimeSupported(mimeType: string, canPlayType: (type: string) => string): boolean {
  const probes = PROBES[mimeType];
  if (!probes) return false;
  return probes.some((probe) => canPlayType(probe) !== "");
}

/** Dùng ở trình duyệt: tạo thẻ audio tạm chỉ để hỏi `canPlayType` (không tải gì). */
export function browserSupportsMime(mimeType: string): boolean {
  if (typeof document === "undefined") return false;
  const probe = document.createElement("audio");
  if (typeof probe.canPlayType !== "function") return false;
  return mimeSupported(mimeType, (type) => probe.canPlayType(type));
}
