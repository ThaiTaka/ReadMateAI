/**
 * Đồng ý hai phạm vi (PRIVACY_AND_SECURITY §4). Hàm thuần — dùng chung cho màn GV và kiểm thử.
 *
 * Ba trạng thái hiển thị, không bao giờ suy ra "đã đồng ý" khi không có bản ghi:
 *   - `none`      — chưa xác nhận (chưa có phiếu nào được ghi nhận)
 *   - `granted`   — đã xác nhận hợp lệ (có bản ghi `granted` còn hiệu lực)
 *   - `withdrawn` — đã rút lại (bản ghi gần nhất là `withdrawn`, chưa ghi nhận lại)
 */

export const CONSENT_SCOPES = ["learning_data", "leaderboard_display"] as const;
export type ConsentScope = (typeof CONSENT_SCOPES)[number];

export const CONSENT_METHODS = ["paper_form", "other"] as const;
export type ConsentMethod = (typeof CONSENT_METHODS)[number];

/**
 * Phiên bản thông báo xử lý dữ liệu gửi phụ huynh. Nội dung pháp lý CHƯA được nhà trường xác nhận (Q-05,
 * RQ-P1–P3) → chỉ có bản nháp dùng cho môi trường phát triển với dữ liệu giả.
 */
export const CONSENT_NOTICES = [
  {
    version: "nhap-2026-10",
    label: "Bản nháp tháng 10/2026 — chưa được nhà trường duyệt, chỉ dùng với dữ liệu giả",
    approved: false,
  },
] as const;
export type ConsentNoticeVersion = (typeof CONSENT_NOTICES)[number]["version"];

export type ConsentRecord = {
  scope: ConsentScope;
  status: "granted" | "withdrawn";
  recordedAt: string;
  withdrawnAt: string | null;
  noticeVersion: string;
};

export type ConsentState =
  { state: "none" } | { state: "granted"; record: ConsentRecord } | { state: "withdrawn"; record: ConsentRecord };

export function consentStateFor(records: readonly ConsentRecord[], scope: ConsentScope): ConsentState {
  const forScope = records.filter((record) => record.scope === scope);
  const active = forScope.find((record) => record.status === "granted");
  if (active) return { state: "granted", record: active };
  const latest = forScope
    .filter((record) => record.status === "withdrawn")
    .sort((a, b) => (a.withdrawnAt ?? a.recordedAt).localeCompare(b.withdrawnAt ?? b.recordedAt))
    .at(-1);
  return latest ? { state: "withdrawn", record: latest } : { state: "none" };
}

/** Bảng xếp hạng (R05) chỉ hiển thị học sinh có CẢ hai phạm vi còn hiệu lực. */
export function canAppearOnLeaderboard(records: readonly ConsentRecord[]): boolean {
  return CONSENT_SCOPES.every((scope) => consentStateFor(records, scope).state === "granted");
}
