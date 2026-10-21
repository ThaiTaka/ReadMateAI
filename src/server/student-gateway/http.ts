import "server-only";
import type { z } from "zod";
import { fail, type ErrorCode, type Result } from "@/server/result";

/**
 * Trợ giúp HTTP cho Route Handlers của học sinh (`/api/student/**`):
 *  - mọi phản hồi có dữ liệu tài khoản: `Cache-Control: private, no-store` (không lưu ở CDN/trình duyệt);
 *  - kết quả có kiểu `{ ok: true, data } | { ok: false, code }` — không lộ lỗi CSDL nguyên văn;
 *  - POST chỉ nhận JSON cùng nguồn (chống CSRF: trình duyệt luôn gửi Origin/Sec-Fetch-Site cho request khác nguồn),
 *    thân ≤ 8 KB, lược đồ zod `strictObject` (trường lạ như `points`, `is_correct`, `student_id` → INVALID_INPUT).
 */

const NO_STORE = {
  "Cache-Control": "private, no-store",
  "Content-Type": "application/json; charset=utf-8",
  "X-Content-Type-Options": "nosniff",
} as const;

const STATUS: Partial<Record<ErrorCode, number>> = {
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  CONSENT_REQUIRED: 403,
  NOT_FOUND: 404,
  INVALID_POSITION: 400,
  INVALID_INPUT: 400,
  RATE_LIMITED: 429,
  NOT_CONFIGURED: 503,
  UNKNOWN: 500,
};

export function statusFor(code: ErrorCode): number {
  return STATUS[code] ?? 409;
}

export function json<T>(result: Result<T>): Response {
  return new Response(JSON.stringify(result), {
    status: result.ok ? 200 : statusFor(result.code),
    headers: NO_STORE,
  });
}

const MAX_BODY_BYTES = 8 * 1024;

/**
 * So Origin với Host mà trình duyệt đã gọi (không dùng `request.url`: máy chủ Next có thể dựng URL bằng tên máy khác,
 * ví dụ `localhost` thay cho `127.0.0.1`). Trên Vercel, `x-forwarded-host` là tên miền thật của trang.
 */
function sameOrigin(request: Request): boolean {
  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin") return false;
  const origin = request.headers.get("origin");
  if (!origin) return true;
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  try {
    return host !== null && new URL(origin).host === host;
  } catch {
    return false;
  }
}

export async function readJson<S extends z.ZodType>(request: Request, schema: S): Promise<Result<z.infer<S>>> {
  if (!sameOrigin(request)) return fail("FORBIDDEN");
  if (!(request.headers.get("content-type") ?? "").toLowerCase().startsWith("application/json")) {
    return fail("INVALID_INPUT");
  }
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > MAX_BODY_BYTES) return fail("INVALID_INPUT");
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return fail("INVALID_INPUT");
  }
  const parsed = schema.safeParse(body);
  return parsed.success ? { ok: true, data: parsed.data } : fail("INVALID_INPUT");
}
