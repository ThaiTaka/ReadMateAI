import { requestKeyOf } from "./manifest.ts";
import { POC_SENTENCE_SETS, type PocSentence, type PocSentenceSet } from "./sentences.ts";
import { POC_VOICES, type PocVoice, type PocVoiceKey } from "./voices.ts";

/**
 * Kế hoạch một lần chạy nghe thử (R10.3b2-P0). HÀM THUẦN: không mạng, không tệp, không môi trường.
 * Giới hạn cứng chống chi phí bất ngờ: lần chạy đầu tối đa 6 câu × 2 giọng = 12 lần gọi, không có đường chạy 34 câu hàng loạt.
 */

export const POC_MAX_REQUESTS_PER_RUN = 12;
/** 6 câu mẫu (≈220 ký tự) × 2 giọng ≈ 440 ký tự; trần này nới vừa đủ cho một lần chạy hợp lệ, không hơn. */
export const POC_MAX_CHARS_PER_RUN = 600;

export type PocJob = {
  requestKey: string;
  voice: PocVoice;
  sentence: PocSentence;
  speed: "slow" | "normal";
  format: "mp3" | "wav";
  chars: number;
};

export type PocPlanError = "NO_VOICES" | "UNKNOWN_VOICE" | "LIMIT_REQUESTS" | "LIMIT_CHARS";

export type PocPlan =
  | {
      ok: true;
      /** Cần gọi nhà cung cấp. */
      jobs: PocJob[];
      /** Đã có tệp (cùng khóa yêu cầu) — không gọi lại, không tốn chi phí. */
      cached: PocJob[];
      chars: number;
    }
  | { ok: false; code: PocPlanError };

export type PocPlanInput = {
  voices: readonly string[];
  set: PocSentenceSet;
  speed: "slow" | "normal";
  format: "mp3" | "wav";
  existingKeys: ReadonlySet<string>;
  /** Chỉ được HẠ giới hạn, không nâng quá `POC_MAX_REQUESTS_PER_RUN`. */
  maxRequests?: number;
};

export function planPocRun(input: PocPlanInput): PocPlan {
  const unique = [...new Set(input.voices)];
  if (unique.length === 0) return { ok: false, code: "NO_VOICES" };
  const voices: PocVoice[] = [];
  for (const key of unique) {
    const voice = POC_VOICES[key as PocVoiceKey];
    if (!voice) return { ok: false, code: "UNKNOWN_VOICE" };
    voices.push(voice);
  }
  const limit = Math.min(
    Math.max(1, Math.floor(input.maxRequests ?? POC_MAX_REQUESTS_PER_RUN)),
    POC_MAX_REQUESTS_PER_RUN,
  );

  const jobs: PocJob[] = [];
  const cached: PocJob[] = [];
  for (const sentence of POC_SENTENCE_SETS[input.set]) {
    for (const voice of voices) {
      const requestKey = requestKeyOf({
        provider: voice.provider,
        voiceKey: voice.key,
        speed: input.speed,
        format: input.format,
        text: sentence.text,
      });
      const job: PocJob = {
        requestKey,
        voice,
        sentence,
        speed: input.speed,
        format: input.format,
        chars: sentence.text.length,
      };
      (input.existingKeys.has(requestKey) ? cached : jobs).push(job);
    }
  }
  if (jobs.length > limit) return { ok: false, code: "LIMIT_REQUESTS" };
  const chars = jobs.reduce((sum, job) => sum + job.chars, 0);
  if (chars > POC_MAX_CHARS_PER_RUN) return { ok: false, code: "LIMIT_CHARS" };
  return { ok: true, jobs, cached, chars };
}
