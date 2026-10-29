import { audioResponse } from "@/server/audio-playback/respond";
import { loadLearningAudio } from "@/server/audio-playback/learning";
import { fail } from "@/server/result";
import { isSameOrigin } from "@/server/same-origin";
import { uuidSchema } from "@/server/student-gateway/api-schemas";
import { limitDevice, STUDENT_RATE_LIMITS, studentContext } from "@/server/student-gateway/context";
import { json } from "@/server/student-gateway/http";

function decode(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

/**
 * GET /api/student/learning-audio/{kind}/{unit}?student={id} — phát bản ghi giáo viên ĐÃ DUYỆT của một tên chữ cái
 * (`letter`) hoặc âm của chữ (`phoneme`) khi học. Không nhận mã tài nguyên/đường dẫn/cách đọc từ trình duyệt: máy chủ tra
 * danh mục và hàm CSDL kiểm lại mọi điều kiện ở MỖI yêu cầu. Chỉ cùng nguồn (thẻ <audio>); không URL công khai hay URL ký.
 */
export async function GET(request: Request, ctx: RouteContext<"/api/student/learning-audio/[kind]/[unit]">) {
  const { kind, unit } = await ctx.params;
  const text = decode(unit);
  const student = new URL(request.url).searchParams.get("student");
  if (text === null || !uuidSchema.safeParse(student).success) return json(fail("NOT_FOUND"));
  if (!isSameOrigin(request)) return json(fail("FORBIDDEN"));
  const context = await studentContext();
  if (!context.ok) return json(context);
  const limited = await limitDevice(context.data, STUDENT_RATE_LIMITS.learningAudio);
  if (!limited.ok) return json(limited);
  const audio = await loadLearningAudio(context.data, student as string, kind, text);
  if (!audio.ok) return json(audio);
  return audioResponse(audio.data.bytes, audio.data.mimeType, request.headers.get("range"));
}
