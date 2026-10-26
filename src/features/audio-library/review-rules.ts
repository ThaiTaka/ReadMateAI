import type { VersionStatus } from "./unit-state.ts";

/**
 * Điều kiện duyệt bản ghi — BẢN SAO để giao diện biết vì sao nút "Duyệt" bị khóa. Nguồn quyết định duy nhất là hàm CSDL
 * `teacher_review_audio_version` (kiểm tra lại cùng thứ tự); không có đường duyệt nào khác.
 */

export type ApprovalBlocker =
  | "AUDIO_RECORDING_DISABLED"
  | "STATE_CONFLICT"
  | "LISTEN_REQUIRED"
  | "PRONUNCIATION_UNCONFIRMED"
  | "LABEL_MISMATCH"
  | "VOICE_CONSENT_REQUIRED";

export type ApprovalInput = {
  recordingEnabled: boolean;
  status: VersionStatus;
  /** GV đã nghe bản ghi trong phiên làm việc này và xác nhận. */
  listened: boolean;
  /** Cách đọc đã được GV xác nhận cho đơn vị (null = chưa). */
  confirmedLabel: string | null;
  /** Cách đọc ghi trên phiên bản lúc tạo. */
  spokenLabel: string;
  /** Người ghi còn đồng ý dùng giọng. `undefined` = không biết (CSDL sẽ kiểm tra). */
  creatorConsentActive?: boolean;
};

export function approvalBlocker(input: ApprovalInput): ApprovalBlocker | null {
  if (!input.recordingEnabled) return "AUDIO_RECORDING_DISABLED";
  if (input.status !== "pending_review") return "STATE_CONFLICT";
  if (!input.listened) return "LISTEN_REQUIRED";
  if (!input.confirmedLabel) return "PRONUNCIATION_UNCONFIRMED";
  if (input.confirmedLabel !== input.spokenLabel) return "LABEL_MISMATCH";
  if (input.creatorConsentActive === false) return "VOICE_CONSENT_REQUIRED";
  return null;
}

/** Chuyển trạng thái hợp lệ (khớp trigger `guard_audio_version`). */
const TRANSITIONS: Record<VersionStatus, readonly VersionStatus[]> = {
  draft: ["pending_review", "discarded", "revoked"],
  pending_review: ["approved", "rejected", "revoked"],
  approved: ["superseded", "revoked"],
  rejected: [],
  revoked: [],
  superseded: [],
  discarded: [],
};

export function canTransition(from: VersionStatus, to: VersionStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

/** Phiên bản đã gửi duyệt (hoặc muộn hơn) không được sửa nội dung — chỉ trạng thái đổi theo máy trạng thái. */
export function isContentLocked(status: VersionStatus): boolean {
  return status !== "draft" && status !== "discarded";
}
