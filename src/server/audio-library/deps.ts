import "server-only";
import { randomUUID } from "node:crypto";
import type { TeacherSession } from "@/server/auth/teacher";
import { fail, mapDbError, ok } from "@/server/result";
import { putAudioObject, removeAudioObject } from "./storage";
import type { UploadDeps } from "./upload";

/** Nối lõi tải lên với CSDL (JWT của GV, hàm `teacher_*`) và Storage (khóa secret, chỉ máy chủ). */
export function buildUploadDeps(session: TeacherSession): UploadDeps {
  const { supabase } = session;
  return {
    schoolId: session.schoolId,
    newId: () => randomUUID(),
    ensureAsset: async (kind, text, proposedLabel) => {
      const { data, error } = await supabase.rpc("teacher_ensure_audio_asset", {
        p_unit_kind: kind,
        p_unit_text: text,
        p_proposed_label: proposedLabel,
      });
      return error || typeof data !== "string" ? fail(error ? mapDbError(error) : "UNKNOWN") : ok(data);
    },
    consentActive: async () => {
      const { data, error } = await supabase.rpc("teacher_audio_status");
      if (error) return fail(mapDbError(error));
      const active = (data as { consent_active?: unknown } | null)?.consent_active;
      return typeof active === "boolean" ? ok(active) : fail("UNKNOWN");
    },
    putObject: putAudioObject,
    removeObject: removeAudioObject,
    createVersion: async (args) => {
      const { data, error } = await supabase.rpc("teacher_create_audio_version", {
        p_asset_id: args.assetId,
        p_version_id: args.versionId,
        p_storage_key: args.storageKey,
        p_content_hash: args.contentHash,
        p_mime_type: args.mimeType,
        p_size_bytes: args.sizeBytes,
        p_duration_ms: args.durationMs,
      });
      if (error) return fail(mapDbError(error));
      const versionNo = (data as { version_no?: unknown } | null)?.version_no;
      return typeof versionNo === "number" ? ok({ versionNo }) : fail("UNKNOWN");
    },
  };
}
