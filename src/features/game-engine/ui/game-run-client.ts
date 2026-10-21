import type { GamePositionDto, GameRunDto } from "@/features/game-runs/dto";
import type { ErrorCode } from "@/server/result";
import type { Position } from "../core/types.ts";
import type { SendResult } from "./position-saver.ts";

/*
 * Gọi `/api/student/game-runs` từ trình duyệt (R07.5b2). Không import giá trị từ dto.ts (kéo zod vào bundle); chỉ kiểm
 * hình dạng tối thiểu của phản hồi — máy chủ đã kiểm bằng zod. Không gửi class/season/điểm/scored.
 */

export type StartResult = { ok: true; data: GameRunDto } | { ok: false; code: ErrorCode | "NETWORK" };

type Envelope = { ok: true; data: unknown } | { ok: false; code: ErrorCode };

async function call(url: string, init: RequestInit): Promise<Envelope | null> {
  try {
    const response = await fetch(url, {
      ...init,
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      cache: "no-store",
    });
    const body: unknown = await response.json();
    if (typeof body !== "object" || body === null || !("ok" in body)) return null;
    return body as Envelope;
  } catch {
    return null;
  }
}

function isRun(data: unknown): data is GameRunDto {
  const run = (data as GameRunDto | undefined)?.run;
  return (
    typeof run?.id === "string" &&
    typeof run.stateVersion === "number" &&
    typeof run.position?.row === "number" &&
    typeof run.position.col === "number" &&
    typeof run.scored === "boolean"
  );
}

export async function startRun(studentId: string, levelKey: string): Promise<StartResult> {
  const result = await call("/api/student/game-runs", {
    method: "POST",
    body: JSON.stringify({ studentId, gameKey: "treasure_maze", levelKey }),
  });
  if (!result) return { ok: false, code: "NETWORK" };
  if (!result.ok) return { ok: false, code: result.code };
  return isRun(result.data) ? { ok: true, data: result.data } : { ok: false, code: "UNKNOWN" };
}

export async function sendPosition(
  studentId: string,
  runId: string,
  path: readonly Position[],
  stateVersion: number,
  keepalive: boolean,
): Promise<SendResult> {
  const result = await call(`/api/student/game-runs/${encodeURIComponent(runId)}/position`, {
    method: "PATCH",
    body: JSON.stringify({ studentId, stateVersion, path }),
    keepalive,
  });
  if (!result) return { kind: "failed" };
  if (result.ok) {
    const data = result.data as GamePositionDto;
    if (typeof data?.stateVersion === "number" && typeof data.position?.row === "number") {
      return { kind: "ok", stateVersion: data.stateVersion, position: data.position };
    }
    return { kind: "failed" };
  }
  switch (result.code) {
    case "STATE_CONFLICT":
    case "INVALID_POSITION":
    case "INVALID_INPUT":
    case "NOT_FOUND":
      return { kind: "conflict" };
    case "SEASON_CLOSED":
    case "RUN_NOT_ACTIVE":
      return { kind: "closed" };
    case "UNAUTHENTICATED":
    case "FORBIDDEN":
      return { kind: "signed_out" };
    default:
      return { kind: "failed" };
  }
}
