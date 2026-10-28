import { learningAudioStatus } from "@/server/audio-playback/learning";
import { fail } from "@/server/result";
import { uuidSchema } from "@/server/student-gateway/api-schemas";
import { limitDevice, STUDENT_RATE_LIMITS, studentContext } from "@/server/student-gateway/context";
import { json } from "@/server/student-gateway/http";

/**
 * GET /api/student/learning-audio?student={id} — chữ/âm nào nghe được NGAY BÂY GIỜ ở khu vực Học tập (JSON nhỏ, không có
 * tệp âm thanh, không có khóa lưu trữ). Cờ tắt / chưa có bản ghi đã duyệt → danh sách rỗng, không lỗi.
 * `student` chỉ là khóa tra cứu: phải thuộc danh sách hồ sơ của thiết bị này (hồ sơ lạ → FORBIDDEN).
 */
export async function GET(request: Request) {
  const student = new URL(request.url).searchParams.get("student");
  if (!uuidSchema.safeParse(student).success) return json(fail("INVALID_INPUT"));
  const context = await studentContext();
  if (!context.ok) return json(context);
  const limited = await limitDevice(context.data, STUDENT_RATE_LIMITS.read);
  if (!limited.ok) return json(limited);
  return json(await learningAudioStatus(context.data, student as string));
}
