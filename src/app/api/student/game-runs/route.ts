import { startGameRunRequestSchema } from "@/features/game-runs/dto";
import { startGameRun } from "@/server/game-runs/student";
import { limitDevice, pickStudent, STUDENT_RATE_LIMITS, studentContext } from "@/server/student-gateway/context";
import { json, readJson } from "@/server/student-gateway/http";

/**
 * POST /api/student/game-runs — bắt đầu hoặc tiếp tục lượt Mê cung kho báu. Ngưỡng điểm, đồng ý và mùa do CSDL quyết;
 * chưa có nội dung R08 → 409 INSUFFICIENT_CONTENT (không tạo lượt tính điểm giả).
 */
export async function POST(request: Request) {
  const context = await studentContext();
  if (!context.ok) return json(context);
  const body = await readJson(request, startGameRunRequestSchema);
  if (!body.ok) return json(body);
  const limited = await limitDevice(context.data, STUDENT_RATE_LIMITS.action);
  if (!limited.ok) return json(limited);
  const student = pickStudent(context.data, body.data.studentId);
  if (!student.ok) return json(student);
  return json(await startGameRun(context.data, student.data.id, body.data.levelKey));
}
