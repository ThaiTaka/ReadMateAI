import { createHash } from "node:crypto";
import { z } from "zod";
import { inspectAudio } from "@/features/audio-library/inspect";
import { AUDIO_EXTENSIONS, AUDIO_MAX_BYTES } from "@/features/audio-library/limits";
import { findAudioUnit } from "@/features/audio-library/p0-catalog";
import { fail, ok, type Result } from "@/server/result";

/**
 * Xử lý tải bản ghi lên (lõi thuần, phụ thuộc được tiêm vào để kiểm thử không cần Storage/CSDL):
 *   1. kiểm tra đơn vị thuộc danh mục thư viện (tên chữ cái / âm của chữ) + tệp (kích thước, chữ ký, thời lượng) — theo NỘI DUNG, không theo tên/MIME;
 *   2. tiền kiểm: cờ hệ thống + tài nguyên + đồng ý dùng giọng (CSDL kiểm lại khi ghi);
 *   3. máy chủ sinh khóa đối tượng từ UUID → tải lên Storage (không ghi đè) → ghi metadata bằng hàm CSDL;
 *   4. ghi metadata lỗi → gỡ tệp vừa tải (không để mồ côi); tải lỗi → không tạo metadata (không trỏ vào tệp không có).
 * Không tự gửi duyệt: kết quả luôn là bản nháp.
 */

export const uploadFieldsSchema = z.strictObject({
  unitKind: z.enum(["letter", "phoneme"]),
  unitText: z.string().min(1).max(6),
});

export type UploadDeps = {
  schoolId: string;
  newId: () => string;
  ensureAsset: (kind: string, text: string, proposedLabel: string) => Promise<Result<string>>;
  consentActive: () => Promise<Result<boolean>>;
  putObject: (key: string, bytes: Uint8Array, contentType: string) => Promise<Result<null>>;
  removeObject: (key: string) => Promise<void>;
  createVersion: (args: {
    assetId: string;
    versionId: string;
    storageKey: string;
    contentHash: string;
    mimeType: string;
    sizeBytes: number;
    durationMs: number;
  }) => Promise<Result<{ versionNo: number }>>;
};

export type UploadedVersion = { assetId: string; versionId: string; versionNo: number; durationMs: number };

export async function processAudioUpload(
  deps: UploadDeps,
  input: { unitKind: unknown; unitText: unknown; file: unknown },
): Promise<Result<UploadedVersion>> {
  const fields = uploadFieldsSchema.safeParse({ unitKind: input.unitKind, unitText: input.unitText });
  if (!fields.success) return fail("INVALID_INPUT");
  const unit = findAudioUnit(fields.data.unitKind, fields.data.unitText.normalize("NFC"));
  if (!unit) return fail("INVALID_INPUT");

  if (!(input.file instanceof Blob)) return fail("INVALID_INPUT");
  // Kiểm tra kích thước TRƯỚC khi đọc cả tệp vào bộ nhớ.
  if (input.file.size === 0) return fail("AUDIO_EMPTY");
  if (input.file.size > AUDIO_MAX_BYTES) return fail("AUDIO_TOO_LARGE");
  const bytes = new Uint8Array(await input.file.arrayBuffer());
  const inspection = inspectAudio(bytes);
  if (!inspection.ok) return fail(inspection.code);

  const consent = await deps.consentActive();
  if (!consent.ok) return consent;
  if (!consent.data) return fail("VOICE_CONSENT_REQUIRED");

  const asset = await deps.ensureAsset(unit.kind, unit.text, unit.proposedLabel);
  if (!asset.ok) return asset;

  const versionId = deps.newId();
  const storageKey = `${deps.schoolId}/${asset.data}/${versionId}.${AUDIO_EXTENSIONS[inspection.mime]}`;
  const stored = await deps.putObject(storageKey, bytes, inspection.mime);
  if (!stored.ok) return stored;

  const created = await deps.createVersion({
    assetId: asset.data,
    versionId,
    storageKey,
    contentHash: createHash("sha256").update(bytes).digest("hex"),
    mimeType: inspection.mime,
    sizeBytes: bytes.byteLength,
    durationMs: inspection.durationMs,
  });
  if (!created.ok) {
    await deps.removeObject(storageKey);
    return created;
  }
  return ok({
    assetId: asset.data,
    versionId,
    versionNo: created.data.versionNo,
    durationMs: inspection.durationMs,
  });
}
