"use server";

import { randomUUID } from "node:crypto";
import { refresh } from "next/cache";
import { z } from "zod";
import { deriveLineState } from "@/features/tts-library/state";
import type { TeacherSession } from "@/server/auth/teacher";
import { teacherOrFail } from "@/server/audio-library/http";
import { fail, mapDbError, ok, type Result } from "@/server/result";
import { libraryProvider } from "./provider";
import { LIBRARY_BULK_LIMIT, LIBRARY_PROVIDER_ID, LIBRARY_VOICE } from "./voice";
import { LIBRARY_ENTRIES, libraryEntry, type LibraryEntry } from "./entries";
import { generateLine, type GenerateDeps, type GeneratedVersion } from "./generate";
import { loadTtsLibrary } from "./queries";
import { putTtsObject, removeTtsObject } from "./storage";

/**
 * Server Actions của /teacher/tts-script. Mỗi action: xác thực GV (thiết bị học sinh → FORBIDDEN) → zod `strictObject` → hàm CSDL
 * `teacher_*` bằng JWT của GV. Trình duyệt KHÔNG gửi bản băm, khóa tệp, người duyệt hay thời điểm: máy chủ lấy bản băm từ danh mục
 * của chính nó; CSDL đặt phần còn lại. Không có action nào đổi trạng thái thành "đã duyệt" ngoài hai hàm duyệt (đã nghe + xác nhận
 * cách đọc + lời đọc đã duyệt). Tạo âm thanh chỉ là bấm của giáo viên và chỉ gọi dịch vụ khi đã duyệt lời đọc.
 */

const entryId = z.string().regex(/^(instruction|feedback):[a-z0-9_.]{1,60}$/u);
const note = z
  .string()
  .transform((value) => value.normalize("NFC").trim())
  .pipe(z.string().max(500));

function depsFor(session: TeacherSession): GenerateDeps {
  const { supabase } = session;
  return {
    schoolId: session.schoolId,
    provider: libraryProvider(),
    newId: () => randomUUID(),
    libraryEnabled: async () => {
      const { data, error } = await supabase.rpc("teacher_tts_status");
      const enabled = (data as { library_enabled?: unknown } | null)?.library_enabled;
      return error || typeof enabled !== "boolean" ? fail(error ? mapDbError(error) : "UNKNOWN") : ok(enabled);
    },
    scriptApproved: async (entry) => {
      const { data, error } = await supabase
        .from("tts_script_reviews")
        .select("entry_id")
        .eq("entry_id", entry.id)
        .eq("content_hash", entry.contentHash)
        .eq("decision", "approved")
        .eq("pronunciation_confirmed", true)
        .limit(1);
      return error ? fail("UNKNOWN") : ok((data ?? []).length > 0);
    },
    liveVersionExists: async (entry) => {
      const { data, error } = await supabase
        .from("tts_audio_versions")
        .select("id")
        .eq("entry_id", entry.id)
        .eq("asset_key", entry.assetKey)
        .in("status", ["pending_review", "approved"])
        .limit(1);
      return error ? fail("UNKNOWN") : ok((data ?? []).length > 0);
    },
    putObject: putTtsObject,
    removeObject: removeTtsObject,
    register: async ({ versionId, entry, storageKey, mimeType, sizeBytes, durationMs, contentSha256 }) => {
      const { data, error } = await supabase.rpc("teacher_register_tts_version", {
        p_version_id: versionId,
        p_entry_id: entry.id,
        p_purpose: entry.purpose,
        p_text: entry.text,
        p_content_hash: entry.contentHash,
        p_asset_key: entry.assetKey,
        p_provider: LIBRARY_PROVIDER_ID,
        p_voice_key: LIBRARY_VOICE.voiceKey,
        p_speed: LIBRARY_VOICE.speed,
        p_config_version: LIBRARY_VOICE.configVersion,
        p_storage_key: storageKey,
        p_mime_type: mimeType,
        p_size_bytes: sizeBytes,
        p_duration_ms: durationMs,
        p_content_sha256: contentSha256,
        p_test_only: false,
      });
      if (error) return fail(mapDbError(error));
      const versionNo = (data as { version_no?: unknown } | null)?.version_no;
      return typeof versionNo === "number" ? ok({ versionNo }) : fail("UNKNOWN");
    },
    // Viettel trả tệp trong vài giây; chờ tối đa 30 giây rồi dừng, không thử lại tự động.
    timeoutMs: 30_000,
  };
}

async function run<T extends z.ZodType, R>(
  schema: T,
  input: unknown,
  invoke: (session: TeacherSession, data: z.infer<T>) => Promise<Result<R>>,
): Promise<Result<R>> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return fail("INVALID_INPUT");
  const auth = await teacherOrFail();
  if (!auth.ok) return auth;
  const result = await invoke(auth.data, parsed.data);
  if (result.ok) refresh();
  return result;
}

const fromRpc = (error: { code?: string; message?: string } | null): Result<null> =>
  error ? fail(mapDbError(error)) : ok(null);

/** Bước 1: duyệt hoặc từ chối LỜI ĐỌC. Bản băm lấy từ danh mục của máy chủ, không từ trình duyệt. */
export async function reviewScript(input: unknown): Promise<Result<null>> {
  return run(
    z.strictObject({
      entryId,
      decision: z.enum(["approve", "reject"]),
      pronunciationConfirmed: z.boolean(),
      note: note.optional(),
    }),
    input,
    async (session, data) => {
      const entry = libraryEntry(data.entryId);
      if (!entry) return fail("NOT_FOUND");
      return fromRpc(
        (
          await session.supabase.rpc("teacher_review_tts_script", {
            p_entry_id: entry.id,
            p_content_hash: entry.contentHash,
            p_decision: data.decision,
            p_pronunciation_confirmed: data.pronunciationConfirmed,
            p_note: data.note ?? "",
          })
        ).error,
      );
    },
  );
}

/** Bấm "Tạo âm thanh" cho MỘT lời đọc đã duyệt. Gọi nhà cung cấp tối đa một lần, không thử lại tự động. */
export async function generateOne(input: unknown): Promise<Result<GeneratedVersion>> {
  return run(z.strictObject({ entryId }), input, async (session, data) => {
    const entry = libraryEntry(data.entryId);
    if (!entry) return fail("NOT_FOUND");
    return generateLine(depsFor(session), entry);
  });
}

export type BulkOutcome = { generated: number; skipped: number; stoppedBy: string | null };

/** "Tạo các lời đã duyệt còn thiếu": tối đa LIBRARY_BULK_LIMIT lời mỗi lần, tuần tự; dừng ở lỗi nhà cung cấp đầu tiên. */
export async function generateMissing(input: unknown): Promise<Result<BulkOutcome>> {
  return run(z.strictObject({}), input, async (session) => {
    const library = await loadTtsLibrary(session);
    if (!library.ok) return library;
    const wanted: LibraryEntry[] = [];
    for (const entry of LIBRARY_ENTRIES) {
      const state = deriveLineState(entry, library.data.reviews, library.data.versions);
      const needsAudio =
        state.audioStatus === "missing" || state.audioStatus === "rejected" || state.audioStatus === "revoked";
      if (state.scriptStatus === "approved" && needsAudio) wanted.push(entry);
    }
    const deps = depsFor(session);
    let generated = 0;
    let stoppedBy: string | null = null;
    for (const entry of wanted.slice(0, LIBRARY_BULK_LIMIT)) {
      const result = await generateLine(deps, entry);
      if (result.ok) generated += 1;
      else if (result.code !== "ALREADY_GENERATED") {
        stoppedBy = result.code;
        break;
      }
    }
    return ok({ generated, skipped: Math.max(0, wanted.length - generated), stoppedBy });
  });
}

/** Bước 2: nghe rồi duyệt/từ chối TỆP. CSDL kiểm: đã nghe, xác nhận cách đọc, lời đọc đã duyệt khớp bản băm. */
export async function reviewVersion(input: unknown): Promise<Result<null>> {
  return run(
    z.strictObject({
      versionId: z.uuid(),
      decision: z.enum(["approve", "reject"]),
      listened: z.boolean(),
      pronunciationConfirmed: z.boolean(),
      note: note.optional(),
    }),
    input,
    async (session, data) =>
      fromRpc(
        (
          await session.supabase.rpc("teacher_review_tts_version", {
            p_version_id: data.versionId,
            p_decision: data.decision,
            p_note: data.note ?? "",
            p_listened: data.listened,
            p_pronunciation_confirmed: data.pronunciationConfirmed,
          })
        ).error,
      ),
  );
}

export async function revokeVersion(input: unknown): Promise<Result<null>> {
  return run(
    z.strictObject({ versionId: z.uuid(), reason: note.pipe(z.string().min(3)) }),
    input,
    async (session, data) =>
      fromRpc(
        (
          await session.supabase.rpc("teacher_revoke_tts_version", {
            p_version_id: data.versionId,
            p_reason: data.reason,
          })
        ).error,
      ),
  );
}
