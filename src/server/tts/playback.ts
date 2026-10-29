import {
  decideAfterGrading,
  decideBeforeGrading,
  type VariantAudioPolicy,
} from "../../features/exercises/core/audio.ts";
import type { AudioRole } from "../../features/exercises/core/primitives.ts";
import type { SupportLevel } from "../../types/learning.ts";
import type { TtsScriptEntry } from "./catalog.ts";
import { checkVersionUsable, type TtsAudioVersion, type UnusableCode } from "./versions.ts";
import type { TtsScriptStatus } from "./script-review.ts";
import type { TtsVoiceProfile } from "./voice.ts";

/**
 * Điều kiện PHÁT một lời đọc TTS cho học sinh (R10.3b1; docs/AUDIO_ENGINE.md §14.5). HÀM THUẦN, chưa có đường gọi nào
 * từ giao diện học sinh. Dùng lại CHÍNH `decideBeforeGrading`/`decideAfterGrading` của bộ máy bài tập (AD-35) — không có
 * quy tắc chống lộ đáp án thứ hai. Cờ phát luôn do bên gọi truyền vào (mặc định TẮT ở mọi môi trường); không có mã ứng dụng
 * nào bật cờ.
 */

export type TtsPlayRefusal =
  "FLAG_OFF" | "MUTED" | "TEACHER_RECORDING_REQUIRED" | "NOT_PERMITTED" | "NOT_GRADED" | "HINT_TRACKING_UNAVAILABLE";

export type TtsPlayDecision = { ok: true } | { ok: false; reason: TtsPlayRefusal };

export type TtsPlayContext = {
  policy: VariantAudioPolicy;
  role: AudioRole;
  supportLevel: SupportLevel;
  /** Câu đã đóng (đúng hoặc hết lượt). */
  graded: boolean;
  /** Học sinh tắt âm thanh. */
  muted: boolean;
  /** Cờ hệ thống cho phép phát TTS cho học sinh. TẮT cho tới khi chủ dự án quyết định (R10.3b2). */
  flagEnabled: boolean;
  /** Có đường ghi nhận "đã dùng gợi ý" cho âm thanh chưa. Chưa có (R10.3b1) → khe `hint` bị khóa. */
  hintTracking: boolean;
};

export function decideTtsPlayback(context: TtsPlayContext): TtsPlayDecision {
  const { policy, role, supportLevel, graded } = context;
  if (!context.flagEnabled) return { ok: false, reason: "FLAG_OFF" };
  if (context.muted) return { ok: false, reason: "MUTED" };
  // Âm/vần đơn lẻ luôn là bản ghi giáo viên, kể cả khi mọi điều kiện khác đạt.
  if (role === "stimulus" && policy.stimulusContent === "phoneme") {
    return { ok: false, reason: "TEACHER_RECORDING_REQUIRED" };
  }
  if (role === "model" || role === "feedback") {
    if (!graded) return { ok: false, reason: "NOT_GRADED" };
    return decideAfterGrading(policy, role) ? { ok: true } : { ok: false, reason: "NOT_PERMITTED" };
  }
  if (graded && decideAfterGrading(policy, role)) return { ok: true };
  const decision = decideBeforeGrading(policy, role, supportLevel);
  if (!decision.permitted) return { ok: false, reason: "NOT_PERMITTED" };
  if (decision.countsAsHint && !context.hintTracking) return { ok: false, reason: "HINT_TRACKING_UNAVAILABLE" };
  return { ok: true };
}

export type TtsPlayRequest = TtsPlayContext & {
  entry: TtsScriptEntry;
  scriptStatus: TtsScriptStatus;
  version: unknown;
  /** Cấu hình giọng hiện hành đã được chọn. */
  voice: TtsVoiceProfile;
};

export type TtsPlayVerdict =
  { ok: true; version: TtsAudioVersion } | { ok: false; reason: TtsPlayRefusal | UnusableCode };

/** Quyết định cuối: chính sách + tệp đã duyệt. Có thể phát chỉ khi CẢ HAI đạt. */
export function decideTtsPlay(request: TtsPlayRequest): TtsPlayVerdict {
  const policyDecision = decideTtsPlayback(request);
  if (!policyDecision.ok) return policyDecision;
  const usable = checkVersionUsable({
    version: request.version,
    entry: request.entry,
    scriptStatus: request.scriptStatus,
    voice: request.voice,
  });
  if (!usable.ok) return { ok: false, reason: usable.code };
  return { ok: true, version: request.version as TtsAudioVersion };
}
