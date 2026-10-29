import { isFeedbackRef } from "@/features/audio-playback/feedback-lines";
import { isPlaybackRole } from "@/features/audio-playback/roles";
import { audioResponse } from "@/server/audio-playback/respond";
import { loadPlayableAudio } from "@/server/audio-playback/service";
import { fail } from "@/server/result";
import { isSameOrigin } from "@/server/same-origin";
import { uuidSchema } from "@/server/student-gateway/api-schemas";
import { limitDevice, STUDENT_RATE_LIMITS, studentContext } from "@/server/student-gateway/context";
import { json } from "@/server/student-gateway/http";

/**
 * GET /api/student/question-instances/{id}/audio/{role} — phát bản ghi giáo viên ĐÃ DUYỆT của khe `stimulus`/`model`.
 * Không nhận mã tài nguyên từ trình duyệt: âm được suy ra từ chính câu. Mọi điều kiện kiểm tra lại ở MỖI yêu cầu
 * (cờ, thiết bị, đồng ý, trường, trạng thái duyệt, cách đọc, đồng ý của người ghi, chính sách chống lộ đáp án).
 * Chỉ nhận yêu cầu cùng nguồn (thẻ <audio> của trang); không có URL công khai hay URL ký.
 */
export async function GET(request: Request, ctx: RouteContext<"/api/student/question-instances/[id]/audio/[role]">) {
  const { id, role } = await ctx.params;
  if (!uuidSchema.safeParse(id).success || !isPlaybackRole(role)) return json(fail("NOT_FOUND"));
  if (!isSameOrigin(request)) return json(fail("FORBIDDEN"));
  const context = await studentContext();
  if (!context.ok) return json(context);
  const limited = await limitDevice(context.data, STUDENT_RATE_LIMITS.audio);
  if (!limited.ok) return json(limited);
  // Lời phản hồi cần mã dòng (`?line=`); máy chủ vẫn đối chiếu với trạng thái thật của câu.
  const line = new URL(request.url).searchParams.get("line");
  if (line !== null && !isFeedbackRef(line)) return json(fail("INVALID_INPUT"));
  const audio = await loadPlayableAudio(context.data, id, role, line ?? undefined);
  if (!audio.ok) return json(audio);
  return audioResponse(audio.data.bytes, audio.data.mimeType, request.headers.get("range"));
}
