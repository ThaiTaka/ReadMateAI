/**
 * Đánh giá KỸ THUẬT một tệp đã giải mã (bước `verify`). HÀM THUẦN trên số liệu đo; việc giải mã làm ở script (Chromium).
 *
 * Đây là kiểm tra kỹ thuật — KHÔNG phải kiểm duyệt phát âm: tệp qua được bước này vẫn chưa ai nghe, không được ghi là "đã duyệt".
 */

export type DecodedStats = {
  durationMs: number;
  sampleRate: number;
  /** Biên độ đỉnh 0…1. */
  peak: number;
  /** Căn bậc hai trung bình bình phương 0…1. */
  rms: number;
  /** Tỉ lệ mẫu có biên độ tuyệt đối trên ngưỡng "có tiếng" (0…1). */
  voicedRatio: number;
};

export const VERIFY_LIMITS = {
  minDurationMs: 300,
  maxDurationMs: 10_000,
  /** Dưới ngưỡng này coi là im lặng. */
  minPeak: 0.05,
  minRms: 0.005,
  /** Quá to: có nguy cơ méo tiếng. */
  maxPeak: 0.999,
  minVoicedRatio: 0.05,
} as const;

export type VerifyProblem = "TOO_SHORT" | "TOO_LONG" | "SILENT" | "TOO_QUIET" | "MOSTLY_SILENCE" | "BAD_STATS";
export type VerifyWarning = "CLIPPING";

export function evaluateDecoded(stats: DecodedStats): {
  ok: boolean;
  problems: VerifyProblem[];
  warnings: VerifyWarning[];
} {
  const problems: VerifyProblem[] = [];
  const finite = [stats.durationMs, stats.peak, stats.rms, stats.voicedRatio].every(Number.isFinite);
  if (!finite || stats.sampleRate <= 0) return { ok: false, problems: ["BAD_STATS"], warnings: [] };
  if (stats.durationMs < VERIFY_LIMITS.minDurationMs) problems.push("TOO_SHORT");
  if (stats.durationMs > VERIFY_LIMITS.maxDurationMs) problems.push("TOO_LONG");
  if (stats.peak < VERIFY_LIMITS.minPeak) problems.push("SILENT");
  else if (stats.rms < VERIFY_LIMITS.minRms) problems.push("TOO_QUIET");
  const warnings: VerifyWarning[] = stats.peak > VERIFY_LIMITS.maxPeak ? ["CLIPPING"] : [];
  if (stats.voicedRatio < VERIFY_LIMITS.minVoicedRatio && !problems.includes("SILENT")) problems.push("MOSTLY_SILENCE");
  return { ok: problems.length === 0, problems, warnings };
}
