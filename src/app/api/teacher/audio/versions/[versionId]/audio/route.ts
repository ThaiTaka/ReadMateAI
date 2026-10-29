import { z } from "zod";
import { parseByteRange } from "@/server/audio-library/range";
import { jsonResult, teacherOrFail } from "@/server/audio-library/http";
import { readAudioObject } from "@/server/audio-library/storage";
import { fail } from "@/server/result";

/**
 * GET /api/teacher/audio/versions/[versionId]/audio — GV nghe lại một bản ghi.
 * Quyền do RLS quyết (cùng trường; bản nháp chỉ người tạo): chỉ khi GV "thấy" được dòng phiên bản thì máy chủ mới đọc tệp
 * bằng khóa secret. Khóa lưu trữ không rời máy chủ; phản hồi `no-store`, `nosniff`, sandbox, hỗ trợ Range (Safari bắt buộc).
 * Không có URL công khai/URL ký: UUID đoán được cũng không cho gì nếu RLS không cho thấy.
 */
export async function GET(request: Request, ctx: RouteContext<"/api/teacher/audio/versions/[versionId]/audio">) {
  const auth = await teacherOrFail();
  if (!auth.ok) return jsonResult(auth);
  const { versionId } = await ctx.params;
  if (!z.uuid().safeParse(versionId).success) return jsonResult(fail("NOT_FOUND"));

  const { data, error } = await auth.data.supabase
    .from("audio_asset_versions")
    .select("storage_key, mime_type, status")
    .eq("id", versionId)
    .maybeSingle();
  if (error) return jsonResult(fail("UNKNOWN"));
  // Bản đã bỏ/thu hồi vẫn nghe lại được để đối chiếu, nhưng không có dòng thấy được thì là NOT_FOUND (không phân biệt "không tồn tại" và "không có quyền").
  if (!data) return jsonResult(fail("NOT_FOUND"));

  const object = await readAudioObject(data.storage_key);
  if (!object.ok) return jsonResult(object);
  const bytes = object.data;

  const headers: Record<string, string> = {
    "Content-Type": data.mime_type,
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'; sandbox",
    "Accept-Ranges": "bytes",
    "Content-Disposition": "inline",
  };
  const rangeHeader = request.headers.get("range");
  if (rangeHeader) {
    const range = parseByteRange(rangeHeader, bytes.byteLength);
    if (!range) {
      return new Response(null, {
        status: 416,
        headers: { ...headers, "Content-Range": `bytes */${bytes.byteLength}` },
      });
    }
    const slice = bytes.slice(range.start, range.end + 1);
    return new Response(slice, {
      status: 206,
      headers: {
        ...headers,
        "Content-Range": `bytes ${range.start}-${range.end}/${bytes.byteLength}`,
        "Content-Length": String(slice.byteLength),
      },
    });
  }
  return new Response(bytes, { status: 200, headers: { ...headers, "Content-Length": String(bytes.byteLength) } });
}
