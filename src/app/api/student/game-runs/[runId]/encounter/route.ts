import { getEncounterState } from "@/server/game-runs/encounters";
import { fail } from "@/server/result";
import { uuidSchema } from "@/server/student-gateway/api-schemas";
import { limitDevice, STUDENT_RATE_LIMITS, studentContext } from "@/server/student-gateway/context";
import { json } from "@/server/student-gateway/http";

/** GET /api/student/game-runs/{runId}/encounter — chạm trán đang diễn ra (nếu có) sau khi tải lại; không đáp án, không phần chưa xuất hiện. */
export async function GET(_request: Request, ctx: RouteContext<"/api/student/game-runs/[runId]/encounter">) {
  const { runId } = await ctx.params;
  if (!uuidSchema.safeParse(runId).success) return json(fail("NOT_FOUND"));
  const context = await studentContext();
  if (!context.ok) return json(context);
  const limited = await limitDevice(context.data, STUDENT_RATE_LIMITS.read);
  if (!limited.ok) return json(limited);
  return json(await getEncounterState(context.data, runId));
}
