import { revealMapTile } from "@/server/scoring/home";
import { mapTileRequestSchema } from "@/server/student-gateway/api-schemas";
import { limitDevice, pickStudent, STUDENT_RATE_LIMITS, studentContext } from "@/server/student-gateway/context";
import { json, readJson } from "@/server/student-gateway/http";

/** POST /api/student/map-tiles — `{ tileKey }` khám phá một thẻ kề vùng đã mở (không tiêu điểm). */
export async function POST(request: Request) {
  const context = await studentContext();
  if (!context.ok) return json(context);
  const body = await readJson(request, mapTileRequestSchema);
  if (!body.ok) return json(body);
  const limited = await limitDevice(context.data, STUDENT_RATE_LIMITS.action);
  if (!limited.ok) return json(limited);
  const student = pickStudent(context.data, body.data.studentId);
  if (!student.ok) return json(student);
  return json(await revealMapTile(context.data, student.data, body.data.tileKey));
}
