"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { VOICE_NOTICE_VERSION } from "@/features/audio-library/limits";
import { AUDIO_UNIT_BY_KEY } from "@/features/audio-library/p0-catalog";
import type { TeacherSession } from "@/server/auth/teacher";
import { teacherOrFail } from "@/server/audio-library/http";
import { fail, mapDbError, ok, type Result } from "@/server/result";

/**
 * Server Actions của /teacher/audio. Mỗi action: xác thực GV (thiết bị học sinh → FORBIDDEN) → zod `strictObject` →
 * hàm CSDL `teacher_*` bằng JWT của GV. Trình duyệt KHÔNG gửi trạng thái, người duyệt hay thời điểm: mọi thứ do CSDL đặt.
 * Không có action nào đổi trạng thái thành "đã duyệt" ngoài `reviewAudioVersion` (CSDL kiểm tra đã nghe, cách đọc, đồng ý).
 */

const uuid = z.uuid();
const text = (min: number, max: number) =>
  z
    .string()
    .transform((value) => value.normalize("NFC").trim())
    .pipe(z.string().min(min).max(max));

async function ensureAsset(session: TeacherSession, unitKey: string): Promise<Result<string>> {
  const unit = AUDIO_UNIT_BY_KEY.get(unitKey);
  if (!unit) return fail("INVALID_INPUT");
  const { data, error } = await session.supabase.rpc("teacher_ensure_audio_asset", {
    p_unit_kind: unit.kind,
    p_unit_text: unit.text,
    p_proposed_label: unit.proposedLabel,
  });
  return error || typeof data !== "string" ? fail(error ? mapDbError(error) : "UNKNOWN") : ok(data);
}

async function run<T extends z.ZodType>(
  schema: T,
  input: unknown,
  invoke: (session: TeacherSession, data: z.infer<T>) => Promise<Result<null>>,
): Promise<Result<null>> {
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

export async function grantVoiceConsent(input: unknown): Promise<Result<null>> {
  // `acknowledged: true` = GV đã tự đánh dấu ô đồng ý (ô không chọn sẵn); máy chủ ghi phiên bản thông báo hiện hành.
  return run(z.strictObject({ acknowledged: z.literal(true) }), input, async (s) =>
    fromRpc((await s.supabase.rpc("teacher_grant_audio_consent", { p_notice_version: VOICE_NOTICE_VERSION })).error),
  );
}

export async function withdrawVoiceConsent(input: unknown): Promise<Result<null>> {
  return run(z.strictObject({ reason: text(3, 300) }), input, async (s, data) =>
    fromRpc((await s.supabase.rpc("teacher_withdraw_audio_consent", { p_reason: data.reason })).error),
  );
}

export async function confirmPronunciation(input: unknown): Promise<Result<null>> {
  return run(z.strictObject({ unitKey: z.string().max(20), label: text(1, 40) }), input, async (s, data) => {
    const asset = await ensureAsset(s, data.unitKey);
    if (!asset.ok) return asset;
    return fromRpc(
      (await s.supabase.rpc("teacher_confirm_audio_pronunciation", { p_asset_id: asset.data, p_label: data.label }))
        .error,
    );
  });
}

export async function saveUnitNote(input: unknown): Promise<Result<null>> {
  return run(z.strictObject({ unitKey: z.string().max(20), note: text(0, 300) }), input, async (s, data) => {
    const asset = await ensureAsset(s, data.unitKey);
    if (!asset.ok) return asset;
    return fromRpc(
      (await s.supabase.rpc("teacher_set_audio_note", { p_asset_id: asset.data, p_note: data.note })).error,
    );
  });
}

export async function submitAudioVersion(input: unknown): Promise<Result<null>> {
  return run(z.strictObject({ versionId: uuid }), input, async (s, data) =>
    fromRpc((await s.supabase.rpc("teacher_submit_audio_version", { p_version_id: data.versionId })).error),
  );
}

export async function discardAudioVersion(input: unknown): Promise<Result<null>> {
  return run(z.strictObject({ versionId: uuid }), input, async (s, data) =>
    fromRpc((await s.supabase.rpc("teacher_discard_audio_version", { p_version_id: data.versionId })).error),
  );
}

export async function reviewAudioVersion(input: unknown): Promise<Result<null>> {
  return run(
    z.strictObject({
      versionId: uuid,
      decision: z.enum(["approve", "reject"]),
      note: text(0, 500),
      listened: z.boolean(),
    }),
    input,
    async (s, data) =>
      fromRpc(
        (
          await s.supabase.rpc("teacher_review_audio_version", {
            p_version_id: data.versionId,
            p_decision: data.decision,
            p_note: data.note,
            p_listened: data.listened,
          })
        ).error,
      ),
  );
}

export async function revokeAudioVersion(input: unknown): Promise<Result<null>> {
  return run(z.strictObject({ versionId: uuid, reason: text(3, 300) }), input, async (s, data) =>
    fromRpc(
      (await s.supabase.rpc("teacher_revoke_audio_version", { p_version_id: data.versionId, p_reason: data.reason }))
        .error,
    ),
  );
}
