/**
 * Trạng thái của từng LỜI ĐỌC cố định trong thư viện giọng máy (R10.5) — hàm thuần, dùng chung cho trang giáo viên và báo cáo độ phủ.
 *
 * Một lời đọc "dùng được" khi và chỉ khi: (1) bản duyệt lời đọc khớp băm nội dung hiện hành đang là "đã duyệt", và (2) có tệp
 * `approved` mà khóa tệp (nhà cung cấp + giọng + tốc độ + phiên bản cấu hình + chữ) KHỚP cấu hình hiện hành. Đổi chữ hoặc đổi
 * giọng làm bản đã duyệt cũ thành "lỗi thời" (không còn phát) cho tới khi tạo và duyệt lại.
 */

export type ScriptStatus = "pending" | "approved" | "rejected";
export type AudioStatus = "missing" | "pending_review" | "approved" | "rejected" | "revoked";

export type ReviewRow = {
  entryId: string;
  contentHash: string;
  decision: "approved" | "rejected";
  pronunciationConfirmed: boolean;
};

export type VersionRow = {
  id: string;
  entryId: string;
  contentHash: string;
  assetKey: string;
  versionNo: number;
  status: "pending_review" | "approved" | "rejected" | "revoked" | "superseded";
  testOnly: boolean;
  durationMs: number;
  reviewNote: string | null;
  revokeReason: string | null;
  generatedAt: string;
};

export type LineKey = { id: string; contentHash: string; assetKey: string };

export type LineState = {
  entryId: string;
  scriptStatus: ScriptStatus;
  audioStatus: AudioStatus;
  /** Bản đang chờ duyệt hoặc đang dùng của cấu hình hiện hành (để nghe/duyệt/thu hồi). */
  currentVersion: VersionRow | null;
  /** Có bản đã duyệt của chữ/giọng CŨ — không còn phát; cần tạo và duyệt lại. */
  staleApproved: boolean;
  /** Dùng được ngay: lời đọc đã duyệt + tệp đã duyệt khớp cấu hình hiện hành (chưa tính cờ hệ thống). */
  usable: boolean;
};

export function deriveLineState(
  line: LineKey,
  reviews: readonly ReviewRow[],
  versions: readonly VersionRow[],
): LineState {
  const review = reviews.find((row) => row.entryId === line.id && row.contentHash === line.contentHash);
  const scriptStatus: ScriptStatus =
    review === undefined
      ? "pending"
      : review.decision === "approved" && review.pronunciationConfirmed
        ? "approved"
        : review.decision === "rejected"
          ? "rejected"
          : "pending";

  const ofEntry = versions.filter((row) => row.entryId === line.id && !row.testOnly);
  const current = ofEntry.filter((row) => row.contentHash === line.contentHash && row.assetKey === line.assetKey);
  const live =
    current.find((row) => row.status === "approved") ?? current.find((row) => row.status === "pending_review") ?? null;
  const latest = [...current].sort((a, b) => b.versionNo - a.versionNo)[0] ?? null;
  const audioStatus: AudioStatus = live
    ? live.status === "approved"
      ? "approved"
      : "pending_review"
    : latest && (latest.status === "rejected" || latest.status === "revoked")
      ? latest.status
      : "missing";
  const staleApproved = ofEntry.some(
    (row) => row.status === "approved" && (row.contentHash !== line.contentHash || row.assetKey !== line.assetKey),
  );
  return {
    entryId: line.id,
    scriptStatus,
    audioStatus,
    currentVersion: live,
    staleApproved,
    usable: scriptStatus === "approved" && audioStatus === "approved",
  };
}
