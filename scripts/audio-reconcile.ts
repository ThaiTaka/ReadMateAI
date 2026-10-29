/**
 * Đối soát bucket `teacher-audio` với bảng `audio_asset_versions` (R10.2): tìm tệp MỒ CÔI (có trong Storage, không có
 * metadata — ví dụ tải lên xong nhưng ghi CSDL lỗi và việc gỡ cũng lỗi) và metadata trỏ tới tệp KHÔNG TỒN TẠI.
 *
 *   node scripts/audio-reconcile.ts            # chỉ báo cáo (đọc)
 *   node scripts/audio-reconcile.ts --delete   # gỡ tệp mồ côi cũ hơn 1 giờ — CHỈ trên Supabase local
 *
 * Cần SUPABASE_SECRET_KEY + NEXT_PUBLIC_SUPABASE_URL (xem .env.local). Không in khóa đối tượng của bản ghi đã duyệt,
 * chỉ đếm. Trên môi trường không phải local script từ chối xóa (chạy tay có kiểm soát theo docs/AUDIO_RECORDING_PLAN §8).
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const secret = process.env.SUPABASE_SECRET_KEY ?? "";
const wantDelete = process.argv.includes("--delete");
const isLocal = /^http:\/\/(127\.0\.0\.1|localhost):\d+$/u.test(url);
if (!url || !secret) throw new Error("Thiếu NEXT_PUBLIC_SUPABASE_URL hoặc SUPABASE_SECRET_KEY.");
if (wantDelete && !isLocal) throw new Error("Từ chối: chỉ được --delete trên Supabase local.");

const admin = createClient(url, secret, { auth: { persistSession: false } });
const BUCKET = "teacher-audio";
const ONE_HOUR = 3_600_000;

async function listAll(): Promise<{ key: string; createdAt: number }[]> {
  const out: { key: string; createdAt: number }[] = [];
  const walk = async (prefix: string, depth: number): Promise<void> => {
    const { data, error } = await admin.storage.from(BUCKET).list(prefix, { limit: 1000 });
    if (error) throw new Error(`Không liệt kê được Storage: ${error.message}`);
    for (const entry of data ?? []) {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (depth < 2) await walk(path, depth + 1);
      else out.push({ key: path, createdAt: Date.parse(entry.created_at ?? "") || 0 });
    }
  };
  await walk("", 0);
  return out;
}

const objects = await listAll();
const { data: rows, error } = await admin.from("audio_asset_versions").select("storage_key");
if (error) throw new Error(`Không đọc được metadata: ${error.message}`);
const known = new Set((rows ?? []).map((row) => row.storage_key));
const stored = new Set(objects.map((object) => object.key));
const orphans = objects.filter((object) => !known.has(object.key));
const missing = [...known].filter((key) => !stored.has(key));

console.log(`Đối tượng trong Storage: ${objects.length}; metadata: ${known.size}`);
console.log(`Tệp mồ côi (không có metadata): ${orphans.length}`);
console.log(`Metadata trỏ tới tệp không tồn tại: ${missing.length}`);
if (wantDelete) {
  const old = orphans.filter((object) => Date.now() - object.createdAt > ONE_HOUR).map((object) => object.key);
  if (old.length > 0) await admin.storage.from(BUCKET).remove(old);
  console.log(`Đã gỡ ${old.length} tệp mồ côi cũ hơn 1 giờ.`);
}
process.exitCode = missing.length > 0 ? 1 : 0;
