import { jsonResult, teacherOrFail } from "@/server/audio-library/http";
import { fail } from "@/server/result";
import { servePocSample } from "@/server/tts/poc/serve";
import { defaultPocDir } from "@/server/tts/poc/store";

/**
 * GET /api/teacher/tts-poc/[file] — giáo viên nghe tệp giọng máy THỬ NGHIỆM (R10.3b2-P0), đọc từ thư mục cục bộ `.tts-poc/`.
 * Chỉ giáo viên; thiết bị học sinh bị từ chối. Không URL nhà cung cấp, không tệp trong Git/Storage.
 */
export async function GET(request: Request, ctx: RouteContext<"/api/teacher/tts-poc/[file]">) {
  const auth = await teacherOrFail();
  if (!auth.ok) return jsonResult(auth);
  const { file } = await ctx.params;
  const response = await servePocSample({ dir: defaultPocDir(), file, rangeHeader: request.headers.get("range") });
  return response.status === 404 ? jsonResult(fail("NOT_FOUND")) : response;
}
