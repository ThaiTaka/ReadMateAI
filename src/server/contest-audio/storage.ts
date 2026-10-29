import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { fail, ok, type Result } from "@/server/result";
import { CONTEST_BUCKET } from "@/features/contest-audio/config";

/**
 * Bucket Storage RIÊNG TƯ `contest-audio` của chế độ trình diễn — tách hẳn `teacher-audio` và `tts-audio`. Đường phát cho học sinh chỉ
 * ĐỌC, bằng khóa secret, sau khi hàm CSDL đã kiểm quyền. Không URL công khai hay URL ký.
 */

export async function readContestObject(key: string): Promise<Result<Uint8Array<ArrayBuffer>>> {
  const admin = createSupabaseAdminClient();
  if (!admin) return fail("STORAGE_UNAVAILABLE");
  const { data, error } = await admin.storage.from(CONTEST_BUCKET).download(key);
  if (error || !data) return fail("NOT_FOUND");
  return ok(new Uint8Array(await data.arrayBuffer()));
}
