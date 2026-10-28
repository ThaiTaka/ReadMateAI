import "server-only";
import type { TtsScriptEntry } from "./catalog.ts";
import { ttsScriptEntrySchema } from "./catalog.ts";
import { checkSynthesizedAudio, type SynthesizedAudioMeta } from "./audio-check.ts";
import { assetKeyOf, contentHashOf } from "./hash.ts";
import { checkTtsRequest } from "./request.ts";
import { scriptStatusOf } from "./script-review.ts";
import { CharBudget, DEFAULT_BATCH_CHAR_BUDGET, synthesizeSpeech } from "./service.ts";
import type { TtsErrorCode, TtsProvider, TtsRequest } from "./types.ts";
import { ttsAudioVersionSchema, type TtsVersionStatus } from "./versions.ts";
import { isProvisionalVoice, type TtsVoiceProfile } from "./voice.ts";

/**
 * Kế hoạch và chạy lô tạo TTS (R10.3b1; docs/AUDIO_ENGINE.md §14.6).
 *
 * Luồng: lời đọc ĐÃ DUYỆT → kiểm tra chính sách và đầu vào → chống trùng (khóa tệp) → giới hạn số tác vụ/ký tự → sinh →
 * kiểm tra kỹ thuật → ứng viên `pending_review` (giáo viên nghe duyệt ở bước sau). `planTtsBatch` là hàm thuần (chạy khô,
 * không gọi gì). `runTtsBatch` chỉ gọi nhà cung cấp truyền vào; với `none` thì thoát ngay, không gọi mạng. KHÔNG có route,
 * tác vụ nền hay đường gọi từ học sinh; chưa lưu gì (không Storage, không CSDL).
 */

export const TTS_BATCH_MAX_JOBS = 40;

export type PlanSkipReason =
  | "SCRIPT_NOT_APPROVED"
  | "ALREADY_GENERATED"
  | "PREVIOUSLY_REJECTED"
  | "REVOKED_BLOCKED"
  | "NOT_SYNTHESIZABLE"
  | "CONTENT_HASH_MISMATCH"
  | "OVER_JOB_LIMIT"
  | "OVER_CHAR_BUDGET"
  | Extract<TtsErrorCode, "INVALID_INPUT" | "PERSONAL_DATA_REJECTED">;

export type TtsBatchJob = {
  assetKey: string;
  request: TtsRequest;
  contentHash: string;
  /** Các mục dùng chung tệp này (cùng khóa tệp). */
  entryIds: string[];
};

export type TtsBatchPlan = {
  providerId: string;
  voice: TtsVoiceProfile;
  jobs: TtsBatchJob[];
  skipped: Array<{ entryId: string; reason: PlanSkipReason }>;
  totalChars: number;
  limits: { maxJobs: number; maxChars: number };
};

export type PlanParams = {
  entries: readonly TtsScriptEntry[];
  /** Bản duyệt lời đọc của giáo viên (chưa hợp lệ/không khớp hash bị bỏ qua). */
  scriptReviews: readonly unknown[];
  /** Phiên bản tệp đã có (mọi trạng thái) để chống tạo trùng. */
  versions: readonly unknown[];
  providerId: string;
  voice: TtsVoiceProfile;
  limits?: Partial<{ maxJobs: number; maxChars: number }>;
};

const BLOCK_RANK: Readonly<Record<TtsVersionStatus, number>> = {
  pending_review: 1,
  approved: 1,
  superseded: 1,
  rejected: 2,
  revoked: 3,
};

export function planTtsBatch(params: PlanParams): TtsBatchPlan {
  const limits = {
    maxJobs: params.limits?.maxJobs ?? TTS_BATCH_MAX_JOBS,
    maxChars: params.limits?.maxChars ?? DEFAULT_BATCH_CHAR_BUDGET,
  };
  // Trạng thái "chặn" nặng nhất của mỗi khóa tệp: thu hồi > từ chối > đã có (chờ duyệt/đã duyệt/đã thay).
  const byKey = new Map<string, TtsVersionStatus>();
  for (const raw of params.versions) {
    const parsed = ttsAudioVersionSchema.safeParse(raw);
    if (!parsed.success) continue;
    const prior = byKey.get(parsed.data.assetKey);
    if (prior === undefined || BLOCK_RANK[parsed.data.status] > BLOCK_RANK[prior]) {
      byKey.set(parsed.data.assetKey, parsed.data.status);
    }
  }

  const jobs = new Map<string, TtsBatchJob>();
  const skipped: TtsBatchPlan["skipped"] = [];
  let totalChars = 0;

  for (const raw of params.entries) {
    const parsedEntry = ttsScriptEntrySchema.safeParse(raw);
    const entryId = typeof raw?.id === "string" ? raw.id : "?";
    if (!parsedEntry.success) {
      skipped.push({ entryId, reason: "INVALID_INPUT" });
      continue;
    }
    const entry = raw;
    if (contentHashOf(entry) !== entry.contentHash) {
      skipped.push({ entryId, reason: "CONTENT_HASH_MISMATCH" });
      continue;
    }
    if (scriptStatusOf(entry, params.scriptReviews) !== "approved") {
      skipped.push({ entryId, reason: "SCRIPT_NOT_APPROVED" });
      continue;
    }
    // Mục chỉ có khe bị cấm ở mọi mức thì không có gì để đọc.
    const everywhereForbidden = entry.usages.every((usage) =>
      Object.values(usage.availability).every((value) => value === "forbidden"),
    );
    if (everywhereForbidden) {
      skipped.push({ entryId, reason: "NOT_SYNTHESIZABLE" });
      continue;
    }
    const request: TtsRequest = {
      text: entry.text,
      purpose: entry.purpose,
      voiceKey: params.voice.voiceKey,
      speed: params.voice.speed,
    };
    const checked = checkTtsRequest(request);
    if (!checked.ok) {
      skipped.push({ entryId, reason: checked.code });
      continue;
    }
    const assetKey = assetKeyOf({
      providerId: params.providerId,
      purpose: entry.purpose,
      text: checked.data.text,
      voice: params.voice,
    });
    const known = byKey.get(assetKey);
    if (known === "revoked") {
      skipped.push({ entryId, reason: "REVOKED_BLOCKED" });
      continue;
    }
    if (known === "rejected") {
      skipped.push({ entryId, reason: "PREVIOUSLY_REJECTED" });
      continue;
    }
    if (known !== undefined) {
      skipped.push({ entryId, reason: "ALREADY_GENERATED" });
      continue;
    }
    const sameJob = jobs.get(assetKey);
    if (sameJob) {
      sameJob.entryIds.push(entryId);
      continue;
    }
    if (jobs.size >= limits.maxJobs) {
      skipped.push({ entryId, reason: "OVER_JOB_LIMIT" });
      continue;
    }
    if (totalChars + checked.data.text.length > limits.maxChars) {
      skipped.push({ entryId, reason: "OVER_CHAR_BUDGET" });
      continue;
    }
    totalChars += checked.data.text.length;
    jobs.set(assetKey, { assetKey, request: checked.data, contentHash: entry.contentHash, entryIds: [entryId] });
  }

  return {
    providerId: params.providerId,
    voice: params.voice,
    jobs: [...jobs.values()],
    skipped,
    totalChars,
    limits,
  };
}

// ---------------------------------------------------------------------------
// Chạy lô
// ---------------------------------------------------------------------------

export type TtsCandidate = {
  assetKey: string;
  contentHash: string;
  entryIds: string[];
  providerId: string;
  voice: TtsVoiceProfile;
  audio: SynthesizedAudioMeta;
  bytes: Uint8Array;
  /** Luôn chờ giáo viên nghe duyệt; không có đường tự duyệt. */
  status: "pending_review";
  /** Nhà cung cấp kiểm thử — không bao giờ dùng cho học sinh. */
  testOnly: boolean;
};

export type TtsRunFailure = {
  assetKey: string;
  code: TtsErrorCode | "VOICE_NOT_CHOSEN" | "AUDIO_REJECTED";
  /** Mã từ chối kỹ thuật khi `code` là `AUDIO_REJECTED`. */
  audioCode?: string;
};

export type TtsRunResult = { candidates: TtsCandidate[]; failures: TtsRunFailure[] };

export async function runTtsBatch(params: {
  plan: TtsBatchPlan;
  provider: TtsProvider;
  timeoutMs?: number;
  /** Chỉ cho kiểm thử/chạy khô: cho phép chạy với giọng chưa chọn (kết quả vẫn không bao giờ dùng được). */
  allowProvisionalVoice?: boolean;
}): Promise<TtsRunResult> {
  const { plan, provider } = params;
  const candidates: TtsCandidate[] = [];
  const failures: TtsRunFailure[] = [];
  if (plan.jobs.length === 0) return { candidates, failures };
  if (provider.id === "none") {
    // Không nhà cung cấp: không gọi gì, mọi tác vụ báo NO_PROVIDER.
    return { candidates, failures: plan.jobs.map((job) => ({ assetKey: job.assetKey, code: "NO_PROVIDER" })) };
  }
  if (provider.id !== plan.providerId) {
    return { candidates, failures: plan.jobs.map((job) => ({ assetKey: job.assetKey, code: "INVALID_INPUT" })) };
  }
  if (isProvisionalVoice(plan.voice) && !params.allowProvisionalVoice) {
    return { candidates, failures: plan.jobs.map((job) => ({ assetKey: job.assetKey, code: "VOICE_NOT_CHOSEN" })) };
  }
  const budget = new CharBudget(plan.limits.maxChars);
  for (const job of plan.jobs) {
    const outcome = await synthesizeSpeech({
      provider,
      request: job.request,
      budget,
      timeoutMs: params.timeoutMs,
    });
    if (!outcome.ok) {
      failures.push({ assetKey: job.assetKey, code: outcome.code });
      continue;
    }
    const checked = checkSynthesizedAudio(outcome.data);
    if (!checked.ok) {
      failures.push({ assetKey: job.assetKey, code: "AUDIO_REJECTED", audioCode: checked.code });
      continue;
    }
    candidates.push({
      assetKey: job.assetKey,
      contentHash: job.contentHash,
      entryIds: job.entryIds,
      providerId: provider.id,
      voice: plan.voice,
      audio: checked.audio,
      bytes: outcome.data.bytes,
      status: "pending_review",
      testOnly: provider.id === "mock",
    });
  }
  return { candidates, failures };
}
