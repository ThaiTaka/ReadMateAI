import "server-only";
import { z } from "zod";
import type { ContestRow } from "@/features/contest-audio/overview";
import type { TeacherSession } from "@/server/auth/teacher";
import { fail, ok, type Result } from "@/server/result";

/**
 * Đọc các tệp trình diễn ĐANG DÙNG của trường cho trang giáo viên bằng JWT của GV → RLS quyết định thấy gì (cùng trường).
 * KHÔNG chọn `storage_key`/`content_sha256`: đường dẫn lưu trữ không bao giờ rời máy chủ.
 */

const row = z.object({ entry_id: z.string(), content_hash: z.string(), asset_key: z.string(), risk_class: z.string() });

export async function loadContestRows(teacher: TeacherSession): Promise<Result<ContestRow[]>> {
  const { data, error } = await teacher.supabase
    .from("contest_audio_assets")
    .select("entry_id, content_hash, asset_key, risk_class")
    .is("revoked_at", null);
  if (error) return fail("UNKNOWN");
  const parsed = z.array(row).safeParse(data);
  if (!parsed.success) return fail("UNKNOWN");
  return ok(
    parsed.data.map((item) => ({
      entryId: item.entry_id,
      contentHash: item.content_hash,
      assetKey: item.asset_key,
      riskClass: item.risk_class,
    })),
  );
}
