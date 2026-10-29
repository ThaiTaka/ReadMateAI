import { execSync } from "node:child_process";
import type { TestProject } from "vitest/node";

export type LocalSupabase = { url: string; publishableKey: string; secretKey: string; jwtSecret: string };

declare module "vitest" {
  export interface ProvidedContext {
    supabase: LocalSupabase;
  }
}

/**
 * Lấy URL/khóa của Supabase LOCAL từ `supabase status` và chuyển cho các tệp kiểm thử (`inject("supabase")`).
 * Từ chối chạy với bất kỳ địa chỉ nào không phải máy local (không bao giờ kiểm thử trên dự án Cloud/production).
 */
export default function setup(project: TestProject) {
  let raw: string;
  try {
    raw = execSync("npx supabase status -o json", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  } catch {
    throw new Error("BLOCKED: Supabase local chưa chạy (cần Docker) — chạy `npm run db:start` rồi thử lại.");
  }
  const status = JSON.parse(raw.slice(raw.indexOf("{"))) as Record<string, string | undefined>;
  const url = status.API_URL ?? "";
  if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/u.test(url))
    throw new Error("Từ chối: chỉ kiểm thử trên Supabase local.");
  project.provide("supabase", {
    url,
    publishableKey: status.PUBLISHABLE_KEY ?? "",
    secretKey: status.SECRET_KEY ?? "",
    jwtSecret: status.JWT_SECRET ?? "",
  });
}
