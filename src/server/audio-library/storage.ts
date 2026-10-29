import "server-only";
import { AUDIO_BUCKET } from "@/features/audio-library/limits";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { fail, ok, type Result } from "@/server/result";

/**
 * Truy cập bucket Storage RIÊNG TƯ `teacher-audio` bằng khóa secret — chỉ máy chủ, chỉ sau khi đã xác thực GV và kiểm
 * tra quyền (RLS/hàm CSDL). Không có URL công khai hay URL ký gửi cho trình duyệt: tệp được phát lại qua route proxy
 * (`/api/teacher/audio/versions/[id]/audio`). Khóa đối tượng do máy chủ sinh từ UUID — không nhận tên tệp từ client.
 */

export async function putAudioObject(key: string, bytes: Uint8Array, contentType: string): Promise<Result<null>> {
  const admin = createSupabaseAdminClient();
  if (!admin) return fail("STORAGE_UNAVAILABLE");
  // upsert:false → không bao giờ ghi đè đối tượng có sẵn (phiên bản cũ bất biến).
  const { error } = await admin.storage.from(AUDIO_BUCKET).upload(key, bytes, { contentType, upsert: false });
  return error ? fail("STORAGE_UNAVAILABLE") : ok(null);
}

/** Gỡ đối tượng mồ côi sau khi ghi metadata thất bại (best effort; script đối soát dọn phần còn sót). */
export async function removeAudioObject(key: string): Promise<void> {
  const admin = createSupabaseAdminClient();
  if (!admin) return;
  await admin.storage.from(AUDIO_BUCKET).remove([key]);
}

export async function readAudioObject(key: string): Promise<Result<Uint8Array<ArrayBuffer>>> {
  const admin = createSupabaseAdminClient();
  if (!admin) return fail("STORAGE_UNAVAILABLE");
  const { data, error } = await admin.storage.from(AUDIO_BUCKET).download(key);
  if (error || !data) return fail("NOT_FOUND");
  return ok(new Uint8Array(await data.arrayBuffer()));
}
