import "server-only";
import { checkAudioLeaks, type AudioExposure } from "../../features/exercises/core/leaks.ts";
import type { VariantAudioPolicy } from "../../features/exercises/core/audio.ts";
import type { AudioRole, AudioSlot } from "../../features/exercises/core/primitives.ts";
import { assetKeyOf } from "./hash.ts";
import { createFptProvider } from "./fpt-provider.ts";
import { createGoogleProvider, createMockProvider, noneProvider } from "./providers.ts";
import { createViettelProvider } from "./viettel-provider.ts";
import { checkTtsRequest } from "./request.ts";
import type { TtsErrorCode, TtsOutcome, TtsProvider, TtsPurpose, TtsRequest } from "./types.ts";
import type { TtsVoiceKey } from "./voice.ts";

/**
 * Dịch vụ TTS phía máy chủ (docs/AUDIO_ENGINE.md §5–§6). Chỉ dùng cho tác vụ tạo âm thanh TRƯỚC của GV;
 * không có đường gọi từ học sinh, không gọi khi mở bài, không tạo hàng loạt tự động (mỗi lô có hạn mức ký tự).
 */

export const DEFAULT_TIMEOUT_MS = 8000;
export const DEFAULT_BATCH_CHAR_BUDGET = 3000;

export type ProviderEnv = Readonly<Record<string, string | undefined>>;

/** `TTS_PROVIDER` = none | mock | google | fpt | viettel. Thiếu khóa hoặc giá trị lạ → `none` (không rò rỉ, không lỗi khởi động). */
export function createTtsProvider(env: ProviderEnv): TtsProvider {
  const name = (env.TTS_PROVIDER ?? "none").trim();
  if (name === "mock") return createMockProvider();
  if (name === "google") {
    const key = env.TTS_GOOGLE_API_KEY?.trim();
    return key ? createGoogleProvider(key) : noneProvider;
  }
  if (name === "fpt") {
    const key = env.TTS_FPT_API_KEY?.trim();
    return key ? createFptProvider({ apiKey: key }) : noneProvider;
  }
  if (name === "viettel") {
    const token = env.TTS_VIETTEL_TOKEN?.trim();
    return token ? createViettelProvider({ token }) : noneProvider;
  }
  return noneProvider;
}

/** Hạn mức ký tự cho một lô yêu cầu (chi phí tính theo ký tự). */
export class CharBudget {
  readonly limit: number;
  private used = 0;
  constructor(limit: number = DEFAULT_BATCH_CHAR_BUDGET) {
    this.limit = limit;
  }
  tryUse(chars: number): boolean {
    if (this.used + chars > this.limit) return false;
    this.used += chars;
    return true;
  }
  get remaining(): number {
    return this.limit - this.used;
  }
}

/**
 * Khóa dùng lại tệp đã tạo: nhà cung cấp + mục đích + giọng + tốc độ + phiên bản cấu hình giọng + văn bản NFC (hash.ts).
 * Không chứa dữ liệu học sinh. Cùng khóa ⇒ cùng một tệp; đổi bất kỳ thành phần nào ⇒ tệp/phiên bản khác.
 */
export function ttsCacheKey(request: TtsRequest, providerId: string, configVersion = "unversioned"): string {
  return assetKeyOf({
    providerId,
    purpose: request.purpose,
    text: request.text,
    voice: { voiceKey: request.voiceKey as TtsVoiceKey, speed: request.speed, configVersion },
  });
}

export type SynthesizeParams = {
  provider: TtsProvider;
  request: unknown;
  budget: CharBudget;
  timeoutMs?: number;
};

export async function synthesizeSpeech({
  provider,
  request,
  budget,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}: SynthesizeParams): Promise<TtsOutcome> {
  const checked = checkTtsRequest(request);
  if (!checked.ok) return { ok: false, code: checked.code };
  if (provider.id === "none") return { ok: false, code: "NO_PROVIDER" };
  // Hạn mức chỉ trừ khi thật sự sẽ gọi nhà cung cấp.
  if (!budget.tryUse(checked.data.text.length)) return { ok: false, code: "BUDGET_EXCEEDED" };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await provider.synthesize(checked.data, { signal: controller.signal });
  } catch {
    return { ok: false, code: "PROVIDER_ERROR" };
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Lập kế hoạch theo chính sách âm thanh của dạng bài (AD-35)
// ---------------------------------------------------------------------------

const ROLE_PURPOSE: Readonly<Record<AudioRole, TtsPurpose>> = {
  instruction: "instruction",
  stimulus: "picture_name",
  options: "word",
  model: "model",
  feedback: "feedback",
};

export type PlanResult = { ok: true; purpose: TtsPurpose } | { ok: false; code: TtsErrorCode };

/**
 * Một khe âm thanh của câu có được phép dùng TTS không? Trả mã lỗi thay vì tạo âm thanh khi:
 * - kích thích là âm/vần đơn lẻ → bắt buộc bản ghi âm GV (A7);
 * - chính sách cấm khe đó, hoặc lời đọc làm lộ đáp án trước khi chấm (dùng lại `checkAudioLeaks`).
 */
export function planSlotSynthesis(params: {
  role: AudioRole;
  slot: AudioSlot;
  policy: VariantAudioPolicy;
  exposure: AudioExposure;
}): PlanResult {
  const { role, slot, policy, exposure } = params;
  if (role === "stimulus" && policy.stimulusContent === "phoneme") {
    return { ok: false, code: "TEACHER_RECORDING_REQUIRED" };
  }
  const issues = checkAudioLeaks({ [role]: slot } as Parameters<typeof checkAudioLeaks>[0], policy, exposure);
  if (issues.some((entry) => entry.code === "AUDIO_LEAKS_ANSWER")) return { ok: false, code: "AUDIO_LEAKS_ANSWER" };
  if (issues.some((entry) => entry.severity === "error")) return { ok: false, code: "AUDIO_ROLE_FORBIDDEN" };
  return { ok: true, purpose: ROLE_PURPOSE[role] };
}
