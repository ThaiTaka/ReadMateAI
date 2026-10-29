/**
 * Trạng thái hiển thị của từng đơn vị âm thanh — hàm thuần, dùng chung cho tổng quan, bộ lọc và test.
 * Mỗi đơn vị có ĐÚNG MỘT trạng thái (tổng các trạng thái = tổng số đơn vị), ưu tiên:
 * chờ duyệt > bản nháp của chính mình > đã có bản duyệt đang dùng > cần ghi lại (bị từ chối/thu hồi) > chưa ghi.
 */

export const VERSION_STATUSES = [
  "draft",
  "pending_review",
  "approved",
  "rejected",
  "revoked",
  "superseded",
  "discarded",
] as const;
export type VersionStatus = (typeof VERSION_STATUSES)[number];

export type VersionSummary = {
  id: string;
  versionNo: number;
  status: VersionStatus;
  spokenLabel: string;
  mimeType: string;
  sizeBytes: number;
  durationMs: number;
  createdBy: string;
  createdAt: string;
  submittedAt: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  revokeReason: string | null;
};

export type AssetSummary = {
  id: string;
  unitKind: string;
  unitText: string;
  proposedLabel: string;
  confirmedLabel: string | null;
  confirmedAt: string | null;
  note: string | null;
  activeVersionId: string | null;
  versions: readonly VersionSummary[];
};

export const UNIT_STATES = ["missing", "draft", "pending_review", "approved", "rerecord"] as const;
export type UnitState = (typeof UNIT_STATES)[number];

export function deriveUnitState(asset: AssetSummary | undefined, myId: string): UnitState {
  if (!asset) return "missing";
  const live = asset.versions.filter((v) => v.status !== "discarded" && v.status !== "superseded");
  if (live.some((v) => v.status === "pending_review")) return "pending_review";
  if (live.some((v) => v.status === "draft" && v.createdBy === myId)) return "draft";
  if (asset.activeVersionId && live.some((v) => v.id === asset.activeVersionId && v.status === "approved")) {
    return "approved";
  }
  if (live.some((v) => v.status === "rejected" || v.status === "revoked")) return "rerecord";
  return "missing";
}

export type UnitCounts = Record<UnitState, number> & { total: number };

export function countStates(states: readonly UnitState[]): UnitCounts {
  const counts: UnitCounts = {
    missing: 0,
    draft: 0,
    pending_review: 0,
    approved: 0,
    rerecord: 0,
    total: states.length,
  };
  for (const state of states) counts[state]++;
  return counts;
}

/** Cách đọc đã được giáo viên xác nhận chưa (chưa xác nhận → "Chờ xác nhận cách đọc"). */
export function isPronunciationConfirmed(asset: Pick<AssetSummary, "confirmedLabel"> | undefined): boolean {
  return Boolean(asset?.confirmedLabel);
}
