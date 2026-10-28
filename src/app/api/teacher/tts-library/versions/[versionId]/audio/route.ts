import { z } from "zod";
import { jsonResult, teacherOrFail } from "@/server/audio-library/http";
import { audioResponse } from "@/server/audio-playback/respond";
import { fail } from "@/server/result";
import { readTtsObject } from "@/server/tts-library/storage";

/**
 * GET /api/teacher/tts-library/versions/[versionId]/audio — giáo viên NGHE một tệp giọng máy (để duyệt/đối chiếu).
 * Quyền do RLS quyết (cùng trường): chỉ khi GV "thấy" được dòng phiên bản thì máy chủ mới đọc tệp bằng khóa secret. Khóa lưu trữ không rời
 * máy chủ; phản hồi `no-store`, `nosniff`, sandbox, hỗ trợ Range (Safari bắt buộc). Không URL công khai/URL ký; học sinh không có route này.
 */
export async function GET(request: Request, ctx: RouteContext<"/api/teacher/tts-library/versions/[versionId]/audio">) {
  const auth = await teacherOrFail();
  if (!auth.ok) return jsonResult(auth);
  const { versionId } = await ctx.params;
  if (!z.uuid().safeParse(versionId).success) return jsonResult(fail("NOT_FOUND"));

  const { data, error } = await auth.data.supabase
    .from("tts_audio_versions")
    .select("storage_key, mime_type")
    .eq("id", versionId)
    .maybeSingle();
  if (error) return jsonResult(fail("UNKNOWN"));
  if (!data) return jsonResult(fail("NOT_FOUND"));

  const object = await readTtsObject(data.storage_key);
  if (!object.ok) return jsonResult(object);
  return audioResponse(object.data, data.mime_type, request.headers.get("range"));
}
