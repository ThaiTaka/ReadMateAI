import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { fail, ok, type Result } from "@/server/result";

/**
 * Bucket Storage RIÊNG TƯ `tts-audio` (giọng máy) — tách hẳn bucket `teacher-audio` (bản ghi giáo viên). Chỉ máy chủ, bằng khóa secret,
 * chỉ sau khi đã kiểm quyền. Khóa đối tượng do máy chủ sinh từ UUID; không URL công khai hay URL ký.
 */

export const TTS_BUCKET = "tts-audio";

export async function putTtsObject(key: string, bytes: Uint8Array, contentType: string): Promise<Result<null>> {
  const admin = createSupabaseAdminClient();
  if (!admin) return fail("STORAGE_UNAVAILABLE");
  // upsert:false → không bao giờ ghi đè đối tượng có sẵn (phiên bản đã tạo bất biến).
  const { error } = await admin.storage.from(TTS_BUCKET).upload(key, bytes, { contentType, upsert: false });
  return error ? fail("STORAGE_UNAVAILABLE") : ok(null);
}

export async function removeTtsObject(key: string): Promise<void> {
  const admin = createSupabaseAdminClient();
  if (!admin) return;
  await admin.storage.from(TTS_BUCKET).remove([key]);
}

export async function readTtsObject(key: string): Promise<Result<Uint8Array<ArrayBuffer>>> {
  const admin = createSupabaseAdminClient();
  if (!admin) return fail("STORAGE_UNAVAILABLE");
  const { data, error } = await admin.storage.from(TTS_BUCKET).download(key);
  if (error || !data) return fail("NOT_FOUND");
  return ok(new Uint8Array(await data.arrayBuffer()));
}
