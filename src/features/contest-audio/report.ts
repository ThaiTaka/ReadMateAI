import type { ContestEntry } from "./catalog.ts";
import { CONTEST_LIFETIME_MAX_REQUESTS } from "./config.ts";

/**
 * Báo cáo độ phủ âm thanh TRÌNH DIỄN (`audio:contest report`). HÀM THUẦN: nhận trạng thái đã đọc (tệp, kết quả kiểm tra kỹ thuật, dòng
 * đăng ký, công tắc) và trả số liệu + câu chữ. Nguyên tắc trung thực:
 *  - "đã tạo" ≠ "phát được" ≠ "đã kiểm duyệt": kiểm tra kỹ thuật không bao giờ được trình bày thành kiểm duyệt phát âm;
 *  - không bao giờ tuyên bố "mọi mục đều đọc đúng"; mục có rủi ro cách đọc luôn được liệt kê riêng;
 *  - mục chưa có tệp, tệp không qua kiểm tra, mục chưa đăng ký đều được nêu tên.
 */

export type ReportInput = {
  entries: readonly ContestEntry[];
  /** Khóa tệp đã có trong bộ nhớ đệm. */
  cachedKeys: ReadonlySet<string>;
  /** Kết quả kiểm tra kỹ thuật theo khóa tệp. */
  verify: Readonly<Record<string, { ok: boolean; problems: readonly string[] } | undefined>>;
  /** Mục đang được đăng ký (chưa thu hồi) — gộp theo mã mục: số trường có tệp. */
  registeredSchools: ReadonlyMap<string, number>;
  schoolCount: number;
  requestsUsed: number;
  lifetimeCap?: number;
  modeEnabled: boolean;
  gateEnabled: boolean;
  playUnverified: boolean;
};

export type ContestReport = {
  total: number;
  distinctRequests: number;
  /** Có tệp ĐÃ qua kiểm tra kỹ thuật. */
  generatedOk: number;
  verifyFailed: Array<{ id: string; problems: string[] }>;
  missing: string[];
  /** Có tệp qua kiểm tra nhưng chưa đăng ký cho đủ trường. */
  unregistered: string[];
  /** Phát được NGAY BÂY GIỜ cho học sinh (chế độ bật, đã đăng ký đủ trường, và không bị giữ vì rủi ro). */
  playableNow: string[];
  /** Mục có rủi ro cách đọc: đang bị giữ hay đã được cho phép. */
  needsVerification: Array<{ id: string; text: string; reasons: string[]; held: boolean }>;
  attention: Array<{ id: string; flags: string[] }>;
  byKind: Record<string, { total: number; generatedOk: number; playableNow: number }>;
  requestsUsed: number;
  requestsRemaining: number;
  modeActive: boolean;
  /** Mọi mục đã có tệp qua kiểm tra kỹ thuật và đã đăng ký — KHÔNG có nghĩa là đã kiểm duyệt. */
  technicallyComplete: boolean;
};

export function buildContestReport(input: ReportInput): ContestReport {
  const modeActive = input.modeEnabled && input.gateEnabled;
  const verifyFailed: ContestReport["verifyFailed"] = [];
  const missing: string[] = [];
  const unregistered: string[] = [];
  const playableNow: string[] = [];
  const byKind: ContestReport["byKind"] = {};
  let generatedOk = 0;

  for (const entry of input.entries) {
    const bucket = (byKind[entry.kind] ??= { total: 0, generatedOk: 0, playableNow: 0 });
    bucket.total += 1;
    const record = input.verify[entry.assetKey];
    if (!input.cachedKeys.has(entry.assetKey)) {
      missing.push(entry.id);
      continue;
    }
    if (!record?.ok) {
      verifyFailed.push({ id: entry.id, problems: [...(record?.problems ?? ["NOT_VERIFIED"])] });
      continue;
    }
    generatedOk += 1;
    bucket.generatedOk += 1;
    const schools = input.registeredSchools.get(entry.id) ?? 0;
    if (input.schoolCount > 0 && schools < input.schoolCount) unregistered.push(entry.id);
    const held = entry.riskClass === "needs_verification" && !input.playUnverified;
    if (modeActive && schools > 0 && !held) {
      playableNow.push(entry.id);
      bucket.playableNow += 1;
    }
  }

  const cap = input.lifetimeCap ?? CONTEST_LIFETIME_MAX_REQUESTS;
  return {
    total: input.entries.length,
    distinctRequests: new Set(input.entries.map((entry) => entry.assetKey)).size,
    generatedOk,
    verifyFailed,
    missing,
    unregistered,
    playableNow,
    needsVerification: input.entries
      .filter((entry) => entry.riskClass === "needs_verification")
      .map((entry) => ({
        id: entry.id,
        text: entry.text,
        reasons: [...entry.riskReasons],
        held: !input.playUnverified,
      })),
    attention: input.entries
      .filter((entry) => entry.attention.length > 0)
      .map((entry) => ({ id: entry.id, flags: entry.attention })),
    byKind,
    requestsUsed: input.requestsUsed,
    requestsRemaining: Math.max(0, cap - input.requestsUsed),
    modeActive,
    technicallyComplete: missing.length === 0 && verifyFailed.length === 0 && unregistered.length === 0,
  };
}

const KIND_LABEL: Record<string, string> = {
  letter: "Tên chữ cái",
  phoneme: "Âm của chữ",
  instruction: "Câu hướng dẫn",
  feedback: "Lời phản hồi",
};

export function formatContestReport(report: ContestReport): string[] {
  const lines: string[] = [];
  const list = (title: string, items: readonly string[]) => {
    if (items.length === 0) return;
    lines.push(`${title} (${items.length}):`, `  ${items.join(", ")}`);
  };
  lines.push(
    `Chế độ trình diễn: ${report.modeActive ? "ĐANG BẬT (local)" : "TẮT"} — âm thanh ở đây do máy tạo tự động, chưa ai nghe/duyệt cách đọc.`,
    `Danh mục: ${report.total} mục, cần tối đa ${report.distinctRequests} yêu cầu (mục cùng chữ dùng chung một tệp).`,
    `Đã có tệp qua kiểm tra KỸ THUẬT: ${report.generatedOk}/${report.total}. Phát được ngay cho học sinh: ${report.playableNow.length}.`,
    `Yêu cầu đã gửi nhà cung cấp (theo sổ ghi trên máy này): ${report.requestsUsed}; còn lại trong hạn mức: ${report.requestsRemaining}.`,
  );
  for (const [kind, counts] of Object.entries(report.byKind)) {
    lines.push(
      `  - ${KIND_LABEL[kind] ?? kind}: ${counts.generatedOk}/${counts.total} có tệp, ${counts.playableNow} phát được ngay`,
    );
  }
  list("Chưa có tệp", report.missing);
  list(
    "Tệp không qua kiểm tra kỹ thuật",
    report.verifyFailed.map((item) => `${item.id} [${item.problems.join("+")}]`),
  );
  list("Có tệp nhưng chưa đăng ký đủ trường", report.unregistered);
  if (report.needsVerification.length > 0) {
    const held = report.needsVerification.filter((item) => item.held).length;
    lines.push(
      `Cần kiểm chứng cách đọc (${report.needsVerification.length}; ${held} đang bị GIỮ, không phát):`,
      `  ${report.needsVerification.map((item) => `${item.id}="${item.text}"`).join(", ")}`,
    );
  }
  if (report.attention.length > 0) {
    lines.push(
      `Cần giáo viên xác nhận trước khi dùng thật (xưng hô "con", từ phủ định): ${report.attention.length} mục câu lệnh/phản hồi.`,
    );
  }
  lines.push(
    report.technicallyComplete
      ? "Về mặt kỹ thuật đã đủ tệp cho cả danh mục. Điều này KHÔNG có nghĩa là cách đọc đã được kiểm chứng hay giáo viên đã duyệt."
      : "Chưa đủ tệp cho cả danh mục — xem các mục nêu trên.",
  );
  return lines;
}
