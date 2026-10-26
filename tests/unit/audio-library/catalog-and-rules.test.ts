import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import phonemes from "../../../content/kb/phonemes.json";
import { AUDIO_BUCKET, AUDIO_MAX_BYTES, AUDIO_MIME_TYPES } from "@/features/audio-library/limits";
import { findP0Unit, P0_UNITS } from "@/features/audio-library/p0-catalog";
import { approvalBlocker, canTransition, isContentLocked } from "@/features/audio-library/review-rules";
import {
  countStates,
  deriveUnitState,
  isPronunciationConfirmed,
  VERSION_STATUSES,
  type AssetSummary,
  type VersionSummary,
} from "@/features/audio-library/unit-state";

describe("danh mục P0 dự kiến", () => {
  it("có đúng 38 cách gọi âm (39 chữ ghi âm, i và y chung một bản ghi)", () => {
    expect(phonemes.items).toHaveLength(39);
    expect(P0_UNITS).toHaveLength(38);
    expect(new Set(P0_UNITS.map((unit) => unit.key)).size).toBe(38);
  });

  it("nhãn lấy đúng từ kho tri thức, không tự đặt", () => {
    for (const unit of P0_UNITS) {
      const source = phonemes.items.find((item) => item.text === unit.text);
      expect(source?.teachingLabel.proposed).toBe(unit.proposedLabel);
    }
  });

  it("i dùng chung với y; y không có bản ghi riêng", () => {
    expect(findP0Unit("phoneme", "i")?.alsoCovers).toEqual(["y"]);
    expect(findP0Unit("phoneme", "i")?.displayText).toBe("i / y");
    expect(findP0Unit("phoneme", "y")).toBeUndefined();
  });

  it("đánh dấu 8 điểm quy ước cần GV chốt (k, gh, ngh, gi, qu, ă, â, i/y)", () => {
    expect(
      P0_UNITS.filter((unit) => unit.needsDecision)
        .map((unit) => unit.text)
        .sort(),
    ).toEqual(["gh", "gi", "i", "k", "ngh", "qu", "â", "ă"].sort());
  });

  it("chỉ là âm: không có vần, không có mục nào ở dạng đã xác nhận", () => {
    expect(P0_UNITS.every((unit) => unit.kind === "phoneme")).toBe(true);
    expect(findP0Unit("rime", "an")).toBeUndefined();
    expect(Object.keys(P0_UNITS[0] ?? {})).not.toContain("confirmedLabel");
  });

  it("văn bản đã chuẩn hóa NFC", () => {
    for (const unit of P0_UNITS) {
      expect(unit.text).toBe(unit.text.normalize("NFC"));
      expect(unit.proposedLabel).toBe(unit.proposedLabel.normalize("NFC"));
    }
  });
});

const version = (over: Partial<VersionSummary>): VersionSummary => ({
  id: "v1",
  versionNo: 1,
  status: "draft",
  spokenLabel: "bờ",
  mimeType: "audio/wav",
  sizeBytes: 100,
  durationMs: 1000,
  createdBy: "me",
  createdAt: "2026-10-26T00:00:00Z",
  submittedAt: null,
  reviewedAt: null,
  reviewNote: null,
  revokeReason: null,
  ...over,
});
const asset = (versions: VersionSummary[], over: Partial<AssetSummary> = {}): AssetSummary => ({
  id: "a1",
  unitKind: "phoneme",
  unitText: "b",
  proposedLabel: "bờ",
  confirmedLabel: null,
  confirmedAt: null,
  note: null,
  activeVersionId: null,
  versions,
  ...over,
});

describe("trạng thái đơn vị", () => {
  it("chưa ghi âm thì chưa có tài nguyên → 'missing'", () => {
    expect(deriveUnitState(undefined, "me")).toBe("missing");
    expect(deriveUnitState(asset([]), "me")).toBe("missing");
  });

  it("ưu tiên: chờ duyệt > nháp của mình > đang dùng > cần ghi lại", () => {
    expect(
      deriveUnitState(asset([version({ status: "pending_review" }), version({ id: "v2", versionNo: 2 })]), "me"),
    ).toBe("pending_review");
    expect(deriveUnitState(asset([version({})]), "me")).toBe("draft");
    expect(deriveUnitState(asset([version({ status: "approved" })], { activeVersionId: "v1" }), "me")).toBe("approved");
    expect(deriveUnitState(asset([version({ status: "rejected" })]), "me")).toBe("rerecord");
    expect(deriveUnitState(asset([version({ status: "revoked" })]), "me")).toBe("rerecord");
  });

  it("bản nháp của đồng nghiệp không tính là bản nháp của mình", () => {
    expect(deriveUnitState(asset([version({ createdBy: "other" })]), "me")).toBe("missing");
  });

  it("bản được duyệt đang dùng vẫn là 'approved' dù có bản bị từ chối sau đó", () => {
    const a = asset([version({ status: "approved" }), version({ id: "v2", versionNo: 2, status: "rejected" })], {
      activeVersionId: "v1",
    });
    expect(deriveUnitState(a, "me")).toBe("approved");
  });

  it("tổng các trạng thái = tổng số đơn vị", () => {
    const counts = countStates(["missing", "missing", "draft", "approved", "rerecord", "pending_review"]);
    expect(counts.total).toBe(6);
    expect(counts.missing + counts.draft + counts.pending_review + counts.approved + counts.rerecord).toBe(6);
  });

  it("chưa xác nhận cách đọc → 'Chờ xác nhận'", () => {
    expect(isPronunciationConfirmed(undefined)).toBe(false);
    expect(isPronunciationConfirmed(asset([]))).toBe(false);
    expect(isPronunciationConfirmed(asset([], { confirmedLabel: "bờ" }))).toBe(true);
  });
});

describe("điều kiện duyệt (bản sao của hàm CSDL)", () => {
  const ok = {
    recordingEnabled: true,
    status: "pending_review" as const,
    listened: true,
    confirmedLabel: "bờ",
    spokenLabel: "bờ",
  };

  it("đủ điều kiện thì không bị chặn", () => {
    expect(approvalBlocker(ok)).toBeNull();
  });

  it("chưa xác nhận cách đọc → không duyệt", () => {
    expect(approvalBlocker({ ...ok, confirmedLabel: null })).toBe("PRONUNCIATION_UNCONFIRMED");
  });

  it("cách đọc xác nhận khác cách đọc trên bản ghi → không duyệt", () => {
    expect(approvalBlocker({ ...ok, confirmedLabel: "bê" })).toBe("LABEL_MISMATCH");
  });

  it("chưa nghe → không duyệt", () => {
    expect(approvalBlocker({ ...ok, listened: false })).toBe("LISTEN_REQUIRED");
  });

  it("thiếu quyền dùng giọng (người ghi đã rút đồng ý) → không duyệt", () => {
    expect(approvalBlocker({ ...ok, creatorConsentActive: false })).toBe("VOICE_CONSENT_REQUIRED");
    expect(approvalBlocker({ ...ok, creatorConsentActive: undefined })).toBeNull();
  });

  it("chỉ duyệt bản đang chờ duyệt; tính năng tắt thì không duyệt", () => {
    for (const status of VERSION_STATUSES.filter((s) => s !== "pending_review")) {
      expect(approvalBlocker({ ...ok, status })).toBe("STATE_CONFLICT");
    }
    expect(approvalBlocker({ ...ok, recordingEnabled: false })).toBe("AUDIO_RECORDING_DISABLED");
  });
});

describe("máy trạng thái phiên bản", () => {
  it("chỉ các chuyển hợp lệ", () => {
    expect(canTransition("draft", "pending_review")).toBe(true);
    expect(canTransition("pending_review", "approved")).toBe(true);
    expect(canTransition("pending_review", "rejected")).toBe(true);
    expect(canTransition("approved", "superseded")).toBe(true);
    expect(canTransition("approved", "revoked")).toBe(true);
  });

  it("không tự nhảy thẳng tới 'approved' và không quay lại", () => {
    expect(canTransition("draft", "approved")).toBe(false);
    expect(canTransition("rejected", "approved")).toBe(false);
    expect(canTransition("approved", "draft")).toBe(false);
    expect(canTransition("approved", "pending_review")).toBe(false);
    for (const status of ["rejected", "revoked", "superseded", "discarded"] as const) {
      for (const to of VERSION_STATUSES) expect(canTransition(status, to)).toBe(false);
    }
  });

  it("bản đã gửi duyệt (và muộn hơn) bất biến nội dung", () => {
    expect(isContentLocked("draft")).toBe(false);
    for (const status of ["pending_review", "approved", "rejected", "revoked", "superseded"] as const) {
      expect(isContentLocked(status)).toBe(true);
    }
  });
});

describe("giới hạn và cấu hình lưu trữ", () => {
  it("giới hạn khớp ràng buộc CSDL và cấu hình bucket", () => {
    const migration = readFileSync("supabase/migrations/20261031090000_r10_teacher_audio.sql", "utf8");
    expect(migration).toContain(`size_bytes between 1 and ${AUDIO_MAX_BYTES}`);
    expect(migration).toContain("duration_ms between 300 and 10000");
    for (const mime of AUDIO_MIME_TYPES) expect(migration).toContain(`'${mime}'`);
    expect(migration).toContain(`'${AUDIO_BUCKET}'`);

    const config = readFileSync("supabase/config.toml", "utf8");
    const bucket = config.slice(config.indexOf(`[storage.buckets.${AUDIO_BUCKET}]`));
    expect(bucket).toMatch(/public = false/u);
    expect(bucket).toContain('file_size_limit = "2MiB"');
    for (const mime of AUDIO_MIME_TYPES) expect(bucket.split("\n\n")[0]).toContain(`"${mime}"`);
  });
});
