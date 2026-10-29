import { checkSynthesizedAudio } from "../audio-check.ts";
import { CharBudget, synthesizeSpeech } from "../service.ts";
import type { TtsErrorCode, TtsProvider } from "../types.ts";
import type { PocSample } from "./manifest.ts";
import { POC_MAX_CHARS_PER_RUN, type PocJob } from "./plan.ts";
import type { PocProviderId } from "./voices.ts";

/**
 * Chạy các việc nghe thử đã lập kế hoạch (R10.3b2-P0). Tuần tự (không song song), KHÔNG thử lại, và dừng gọi một nhà cung cấp
 * sau 2 lần lỗi liên tiếp để một khóa sai/hết hạn mức không tốn thêm lượt. Mỗi tệp nhà cung cấp trả về đều qua
 * `checkSynthesizedAudio` (nhận ra định dạng theo NỘI DUNG) trước khi lưu — byte của mock không bao giờ thành tệp nghe thử.
 */

export const POC_MAX_CONSECUTIVE_FAILURES = 2;

export interface PocStore {
  write(sample: PocSample, bytes: Uint8Array): Promise<void>;
}

export type PocJobStatus = "saved" | "failed" | "skipped_no_provider" | "skipped_provider_stopped";

export type PocJobResult = {
  requestKey: string;
  voiceKey: string;
  sentenceId: string;
  status: PocJobStatus;
  code?: TtsErrorCode | "AUDIO_REJECTED";
  latencyMs?: number;
  bytes?: number;
};

export type RunPocParams = {
  jobs: readonly PocJob[];
  providers: Partial<Record<PocProviderId, TtsProvider>>;
  store: PocStore;
  /** Đồng hồ đơn điệu (ms) để đo thời gian tạo; truyền vào để kiểm thử không phụ thuộc giờ thật. */
  clock: () => number;
  nowIso: () => string;
  /** Một số chung, hoặc thời gian chờ riêng cho từng nhà cung cấp (mỗi bên có độ trễ điển hình khác nhau). */
  timeoutMs: number | Readonly<Record<PocProviderId, number>>;
};

export async function runPocJobs(params: RunPocParams): Promise<PocJobResult[]> {
  const { jobs, providers, store, clock, nowIso, timeoutMs } = params;
  const budget = new CharBudget(POC_MAX_CHARS_PER_RUN);
  const failures = new Map<PocProviderId, number>();
  const results: PocJobResult[] = [];

  for (const job of jobs) {
    const base = { requestKey: job.requestKey, voiceKey: job.voice.key, sentenceId: job.sentence.id };
    const provider = providers[job.voice.provider];
    if (!provider || provider.id === "none") {
      results.push({ ...base, status: "skipped_no_provider" });
      continue;
    }
    if ((failures.get(job.voice.provider) ?? 0) >= POC_MAX_CONSECUTIVE_FAILURES) {
      results.push({ ...base, status: "skipped_provider_stopped" });
      continue;
    }

    const started = clock();
    const outcome = await synthesizeSpeech({
      provider,
      request: { text: job.sentence.text, purpose: job.sentence.purpose, voiceKey: job.voice.key, speed: job.speed },
      budget,
      timeoutMs: typeof timeoutMs === "number" ? timeoutMs : timeoutMs[job.voice.provider],
    });
    const latencyMs = Math.max(0, Math.round(clock() - started));
    if (!outcome.ok) {
      failures.set(job.voice.provider, (failures.get(job.voice.provider) ?? 0) + 1);
      results.push({ ...base, status: "failed", code: outcome.code, latencyMs });
      continue;
    }
    const checked = checkSynthesizedAudio(outcome.data);
    if (!checked.ok) {
      failures.set(job.voice.provider, (failures.get(job.voice.provider) ?? 0) + 1);
      results.push({ ...base, status: "failed", code: "AUDIO_REJECTED", latencyMs });
      continue;
    }
    failures.set(job.voice.provider, 0);

    const format = checked.audio.mime === "audio/wav" ? "wav" : "mp3";
    const sample: PocSample = {
      requestKey: job.requestKey,
      file: `${checked.audio.sha256}.${format}`,
      sha256: checked.audio.sha256,
      provider: job.voice.provider,
      voiceKey: job.voice.key,
      providerVoice: job.voice.providerVoice,
      speed: job.speed,
      format,
      mime: checked.audio.mime === "audio/wav" ? "audio/wav" : "audio/mpeg",
      sentenceId: job.sentence.id,
      sentenceKind: job.sentence.kind,
      text: job.sentence.text,
      chars: job.chars,
      bytes: checked.audio.byteLength,
      durationMs: checked.audio.durationMs,
      latencyMs,
      createdAt: nowIso(),
    };
    await store.write(sample, outcome.data.bytes);
    results.push({ ...base, status: "saved", latencyMs, bytes: sample.bytes });
  }
  return results;
}
