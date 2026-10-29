import type { ContestEntry } from "./catalog.ts";
import {
  CONTEST_LIFETIME_MAX_REQUESTS,
  CONTEST_RUN_DEFAULT_MAX_REQUESTS,
  CONTEST_RUN_HARD_MAX_REQUESTS,
} from "./config.ts";

/**
 * Kế hoạch gọi nhà cung cấp cho một lần chạy `generate`. HÀM THUẦN. Quy tắc chống tốn chi phí:
 *  - mỗi KHÓA TỆP (chữ + cấu hình giọng) chỉ gọi một lần, dù nhiều mục dùng chung;
 *  - khóa đã có tệp (bộ nhớ đệm trên máy hoặc đã đăng ký) → KHÔNG gọi lại;
 *  - tối đa `maxRequests` yêu cầu mỗi lần chạy (mặc định 40, trần cứng 120) và `lifetimeCap` yêu cầu tổng cộng theo sổ ghi trên máy;
 *  - khóa đã từng bị nhà cung cấp từ chối (lỗi) KHÔNG tự gọi lại — mỗi lần gọi tốn một lượt; muốn thử lại phải yêu cầu rõ (`retryFailed`);
 *  - thứ tự ưu tiên khi hạn mức không đủ cho tất cả: mục an toàn trước mục cần kiểm chứng; câu lệnh, rồi lời phản hồi, rồi tên chữ cái, rồi âm;
 *  - phần vượt hạn mức KHÔNG bị bỏ qua âm thầm: được trả về trong `deferred` để báo cáo.
 */

export type ContestJob = {
  assetKey: string;
  text: string;
  /** Mục dùng chung tệp này (để báo cáo). */
  entryIds: string[];
  /** Nhỏ hơn = tạo trước. */
  priority: number;
};

const KIND_PRIORITY: Record<ContestEntry["kind"], number> = { instruction: 0, feedback: 1, letter: 2, phoneme: 3 };
const priorityOf = (entry: ContestEntry): number =>
  (entry.riskClass === "standard" ? 0 : 10) + KIND_PRIORITY[entry.kind];

export type ContestPlan = {
  jobs: ContestJob[];
  /** Khóa tệp đã có sẵn, không gọi lại. */
  reusedKeys: string[];
  /** Cần gọi nhưng vượt hạn mức lần chạy này hoặc hạn mức tổng. */
  deferred: ContestJob[];
  /** Đã từng lỗi ở nhà cung cấp nên không tự gọi lại. */
  previouslyFailed: ContestJob[];
  /** Lý do bị hoãn (nếu có). */
  blockedBy: "RUN_CAP" | "LIFETIME_CAP" | null;
  maxRequests: number;
  lifetimeRemaining: number;
};

export function clampMaxRequests(requested: number | undefined): number {
  const value = requested ?? CONTEST_RUN_DEFAULT_MAX_REQUESTS;
  if (!Number.isInteger(value) || value < 1) return CONTEST_RUN_DEFAULT_MAX_REQUESTS;
  return Math.min(value, CONTEST_RUN_HARD_MAX_REQUESTS);
}

export function planContestRun(input: {
  entries: readonly ContestEntry[];
  /** Khóa tệp đã có tệp (đệm cục bộ hoặc đã đăng ký). */
  haveKeys: ReadonlySet<string>;
  maxRequests?: number | undefined;
  /** Số yêu cầu đã gửi nhà cung cấp theo sổ ghi (suốt đời). */
  lifetimeUsed: number;
  lifetimeCap?: number;
  /** Khóa tệp đã từng bị nhà cung cấp trả lỗi. */
  failedKeys?: ReadonlySet<string>;
  retryFailed?: boolean;
}): ContestPlan {
  const maxRequests = clampMaxRequests(input.maxRequests);
  const lifetimeCap = input.lifetimeCap ?? CONTEST_LIFETIME_MAX_REQUESTS;
  const lifetimeRemaining = Math.max(0, lifetimeCap - Math.max(0, input.lifetimeUsed));

  const byKey = new Map<string, ContestJob>();
  for (const entry of input.entries) {
    const job = byKey.get(entry.assetKey);
    if (job) {
      job.entryIds.push(entry.id);
      job.priority = Math.min(job.priority, priorityOf(entry));
    } else {
      byKey.set(entry.assetKey, {
        assetKey: entry.assetKey,
        text: entry.text,
        entryIds: [entry.id],
        priority: priorityOf(entry),
      });
    }
  }

  const reusedKeys: string[] = [];
  const missing: ContestJob[] = [];
  const previouslyFailed: ContestJob[] = [];
  for (const job of byKey.values()) {
    if (input.haveKeys.has(job.assetKey)) reusedKeys.push(job.assetKey);
    else if (!input.retryFailed && input.failedKeys?.has(job.assetKey)) previouslyFailed.push(job);
    else missing.push(job);
  }

  missing.sort((a, b) => a.priority - b.priority); // sắp ổn định: cùng mức giữ thứ tự danh mục
  const allowed = Math.min(maxRequests, lifetimeRemaining);
  const jobs = missing.slice(0, allowed);
  const deferred = missing.slice(allowed);
  const blockedBy = deferred.length === 0 ? null : lifetimeRemaining <= maxRequests ? "LIFETIME_CAP" : "RUN_CAP";
  return { jobs, reusedKeys, deferred, previouslyFailed, blockedBy, maxRequests, lifetimeRemaining };
}
