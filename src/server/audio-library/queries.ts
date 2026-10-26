import "server-only";
import { z } from "zod";
import { VERSION_STATUSES, type AssetSummary, type VersionSummary } from "@/features/audio-library/unit-state";
import type { TeacherSession } from "@/server/auth/teacher";
import { fail, ok, type Result } from "@/server/result";

/**
 * Đọc dữ liệu cho /teacher/audio bằng JWT của GV → RLS quyết định thấy gì (cùng trường; bản nháp chỉ người tạo).
 * KHÔNG chọn `storage_key`/`content_hash`: đường dẫn lưu trữ không bao giờ rời máy chủ (nghe qua route proxy theo id).
 */

const statusSchema = z.object({
  recording_enabled: z.boolean(),
  consent_active: z.boolean(),
  consent_notice_version: z.string().nullable(),
  consent_granted_at: z.string().nullable(),
  role: z.string(),
});

const assetRow = z.object({
  id: z.uuid(),
  unit_kind: z.string(),
  unit_text: z.string(),
  proposed_label: z.string(),
  confirmed_label: z.string().nullable(),
  pronunciation_confirmed_at: z.string().nullable(),
  teacher_note: z.string().nullable(),
  active_version_id: z.uuid().nullable(),
});

const versionRow = z.object({
  id: z.uuid(),
  asset_id: z.uuid(),
  version_no: z.number().int(),
  status: z.enum(VERSION_STATUSES),
  spoken_label: z.string(),
  mime_type: z.string(),
  size_bytes: z.number().int(),
  duration_ms: z.number().int(),
  created_by: z.uuid(),
  created_at: z.string(),
  submitted_at: z.string().nullable(),
  reviewed_at: z.string().nullable(),
  review_note: z.string().nullable(),
  revoke_reason: z.string().nullable(),
});

export type AudioStudioData = {
  userId: string;
  isAdmin: boolean;
  recordingEnabled: boolean;
  consentActive: boolean;
  assets: AssetSummary[];
};

export async function loadAudioStudio(teacher: TeacherSession): Promise<Result<AudioStudioData>> {
  const { supabase } = teacher;
  const [statusResult, assetsResult, versionsResult] = await Promise.all([
    supabase.rpc("teacher_audio_status"),
    supabase
      .from("audio_assets")
      .select(
        "id, unit_kind, unit_text, proposed_label, confirmed_label, pronunciation_confirmed_at, teacher_note, active_version_id",
      )
      .limit(500),
    supabase
      .from("audio_asset_versions")
      .select(
        "id, asset_id, version_no, status, spoken_label, mime_type, size_bytes, duration_ms, created_by, created_at, submitted_at, reviewed_at, review_note, revoke_reason",
      )
      .order("version_no", { ascending: false })
      .limit(2000),
  ]);
  if (statusResult.error || assetsResult.error || versionsResult.error) return fail("UNKNOWN");
  const status = statusSchema.safeParse(statusResult.data);
  const assets = z.array(assetRow).safeParse(assetsResult.data);
  const versions = z.array(versionRow).safeParse(versionsResult.data);
  if (!status.success || !assets.success || !versions.success) return fail("UNKNOWN");

  const byAsset = new Map<string, VersionSummary[]>();
  for (const v of versions.data) {
    const list = byAsset.get(v.asset_id) ?? [];
    list.push({
      id: v.id,
      versionNo: v.version_no,
      status: v.status,
      spokenLabel: v.spoken_label,
      mimeType: v.mime_type,
      sizeBytes: v.size_bytes,
      durationMs: v.duration_ms,
      createdBy: v.created_by,
      createdAt: v.created_at,
      submittedAt: v.submitted_at,
      reviewedAt: v.reviewed_at,
      reviewNote: v.review_note,
      revokeReason: v.revoke_reason,
    });
    byAsset.set(v.asset_id, list);
  }
  return ok({
    userId: teacher.userId,
    isAdmin: status.data.role === "admin",
    recordingEnabled: status.data.recording_enabled,
    consentActive: status.data.consent_active,
    assets: assets.data.map((a) => ({
      id: a.id,
      unitKind: a.unit_kind,
      unitText: a.unit_text,
      proposedLabel: a.proposed_label,
      confirmedLabel: a.confirmed_label,
      confirmedAt: a.pronunciation_confirmed_at,
      note: a.teacher_note,
      activeVersionId: a.active_version_id,
      versions: byAsset.get(a.id) ?? [],
    })),
  });
}
