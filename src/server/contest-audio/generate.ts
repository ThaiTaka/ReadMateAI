import { checkSynthesizedAudio } from "../tts/audio-check.ts";
import type { TtsProvider } from "../tts/types.ts";
import { CONTEST_MAX_CONSECUTIVE_FAILURES, CONTEST_VOICE } from "../../features/contest-audio/config.ts";
import type { ContestJob } from "../../features/contest-audio/plan.ts";

/**
 * Chạy các việc gọi nhà cung cấp của `audio:contest generate` (lõi thuần; nhà cung cấp, bộ nhớ đệm, sổ ghi và đồng hồ được tiêm vào để
 * kiểm thử không cần mạng). Đây là NƠI DUY NHẤT của chế độ trình diễn gọi nhà cung cấp; đường phát cho học sinh không import tệp này.
 *
 * Quy tắc: tuần tự, KHÔNG thử lại, chỉ gửi {chữ cố định, mục đích, mã giọng, tốc độ} — không dữ liệu học sinh; mỗi yêu cầu được ghi vào
 * sổ NGAY TRƯỚC khi gửi (kể cả khi lỗi, vì nhà cung cấp có thể đã tính lượt); dừng sau vài lần lỗi liên tiếp hoặc khi `shouldStop()`
 * (khóa sai / hết hạn mức); tệp nhận về phải qua kiểm tra theo NỘI DUNG trước khi lưu.
 */

export type ContestJobStatus = "saved" | "failed" | "skipped_stopped";

export type ContestJobResult = {
  assetKey: string;
  status: ContestJobStatus;
  code?: string;
  bytes?: number;
};

export type ContestRunDeps = {
  provider: TtsProvider;
  timeoutMs: number;
  /** Lưu tệp (đã qua kiểm tra) vào bộ nhớ đệm cục bộ theo khóa tệp. */
  saveBytes: (assetKey: string, bytes: Uint8Array, mimeType: string) => Promise<void>;
  /** Ghi sổ MỘT yêu cầu sắp gửi. Ném lỗi → không gửi (không bao giờ gửi mà không ghi sổ). */
  recordRequest: (assetKey: string) => Promise<void>;
  /** Ghi kết quả của yêu cầu vừa gửi (để lần sau không tự gọi lại khóa đã lỗi). */
  recordOutcome: (assetKey: string, ok: boolean, code?: string) => Promise<void>;
  /** Khóa sai/hết hạn mức do nhà cung cấp báo → dừng gọi ngay. */
  shouldStop: () => boolean;
  sleep: (ms: number) => Promise<void>;
  gapMs: number;
};

export async function runContestJobs(jobs: readonly ContestJob[], deps: ContestRunDeps): Promise<ContestJobResult[]> {
  const results: ContestJobResult[] = [];
  const seen = new Set<string>();
  let consecutiveFailures = 0;
  let sent = 0;

  for (const job of jobs) {
    if (seen.has(job.assetKey)) continue; // phòng hờ: không bao giờ gửi hai lần cùng một khóa trong một lần chạy
    seen.add(job.assetKey);
    if (consecutiveFailures >= CONTEST_MAX_CONSECUTIVE_FAILURES || deps.shouldStop()) {
      results.push({ assetKey: job.assetKey, status: "skipped_stopped" });
      continue;
    }
    if (sent > 0 && deps.gapMs > 0) await deps.sleep(deps.gapMs);

    await deps.recordRequest(job.assetKey);
    sent += 1;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), deps.timeoutMs);
    let outcome: Awaited<ReturnType<TtsProvider["synthesize"]>>;
    try {
      outcome = await deps.provider.synthesize(
        { text: job.text, purpose: "word", voiceKey: CONTEST_VOICE.voiceKey, speed: CONTEST_VOICE.speed },
        { signal: controller.signal },
      );
    } finally {
      clearTimeout(timer);
    }
    if (!outcome.ok) {
      consecutiveFailures += 1;
      await deps.recordOutcome(job.assetKey, false, outcome.code);
      results.push({ assetKey: job.assetKey, status: "failed", code: outcome.code });
      continue;
    }
    const checked = checkSynthesizedAudio(outcome.data);
    if (!checked.ok) {
      consecutiveFailures += 1;
      await deps.recordOutcome(job.assetKey, false, "AUDIO_REJECTED");
      results.push({ assetKey: job.assetKey, status: "failed", code: "AUDIO_REJECTED" });
      continue;
    }
    consecutiveFailures = 0;
    await deps.saveBytes(job.assetKey, outcome.data.bytes, checked.audio.mime);
    await deps.recordOutcome(job.assetKey, true);
    results.push({ assetKey: job.assetKey, status: "saved", bytes: checked.audio.byteLength });
  }
  return results;
}
