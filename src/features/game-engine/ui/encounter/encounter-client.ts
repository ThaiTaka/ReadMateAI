import type { ActivateEncounterDto, EncounterStateDto, TreasureDto } from "@/features/game-runs/encounter-dto";
import type { AttemptDto } from "@/features/scored-practice/types";
import type { Response } from "@/features/exercises/core/primitives";
import type { ErrorCode } from "@/server/result";
import { call } from "../game-run-client.ts";

/*
 * Gọi API chạm trán/kho báu từ trình duyệt (R08.4). Không import giá trị từ encounter-dto.ts (kéo zod vào bundle): máy chủ
 * đã kiểm bằng zod, ở đây chỉ kiểm hình dạng tối thiểu. Không bao giờ gửi tọa độ, HP, điểm, mã chạm trán hay đáp án đúng.
 */

export type ApiResult<T> = { ok: true; data: T } | { ok: false; code: ErrorCode | "NETWORK" };

async function request<T>(url: string, init: RequestInit, valid: (data: unknown) => boolean): Promise<ApiResult<T>> {
  const result = await call(url, init);
  if (!result) return { ok: false, code: "NETWORK" };
  if (!result.ok) return { ok: false, code: result.code };
  return valid(result.data) ? { ok: true, data: result.data as T } : { ok: false, code: "UNKNOWN" };
}

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

function isEncounterState(value: unknown): value is EncounterStateDto {
  return (
    isObject(value) &&
    typeof value.runId === "string" &&
    Array.isArray(value.resolvedTriggerKeys) &&
    isObject(value.progress) &&
    typeof value.progress.resolved === "number" &&
    typeof value.progress.total === "number" &&
    (value.encounter === null ||
      (isObject(value.encounter) &&
        typeof value.encounter.monsterKey === "string" &&
        typeof value.encounter.hpRemaining === "number" &&
        Array.isArray(value.encounter.questions)))
  );
}

export function fetchEncounterState(runId: string): Promise<ApiResult<EncounterStateDto>> {
  return request(`/api/student/game-runs/${encodeURIComponent(runId)}/encounter`, { method: "GET" }, isEncounterState);
}

export function activateEncounter(studentId: string, runId: string): Promise<ApiResult<ActivateEncounterDto>> {
  return request(
    `/api/student/game-runs/${encodeURIComponent(runId)}/encounters/activate`,
    { method: "POST", body: JSON.stringify({ studentId }) },
    (data) => isObject(data) && isEncounterState(data.state) && data.state.encounter !== null,
  );
}

export function submitEncounterAttempt(
  questionId: string,
  clientAttemptId: string,
  response: Response,
): Promise<ApiResult<AttemptDto>> {
  return request(
    `/api/student/question-instances/${encodeURIComponent(questionId)}/attempts`,
    { method: "POST", body: JSON.stringify({ clientAttemptId, response }) },
    (data) => isObject(data) && isObject(data.question) && isObject(data.score),
  );
}

export function openTreasure(studentId: string, runId: string): Promise<ApiResult<TreasureDto>> {
  return request(
    `/api/student/game-runs/${encodeURIComponent(runId)}/treasure/open`,
    { method: "POST", body: JSON.stringify({ studentId }) },
    (data) => isObject(data) && typeof data.defeated === "number" && typeof data.undefeated === "number",
  );
}
