/**
 * Kết nối Supabase cho script dev/seed (chạy bằng Node 24 trực tiếp: `node --env-file-if-exists=.env.local …`).
 *
 * AN TOÀN: script ghi dữ liệu giả CHỈ chạy với Supabase local (127.0.0.1/localhost) trừ khi đặt tường minh
 * ALLOW_REMOTE_SEED=dev-only — không bao giờ seed vào dự án production (CLAUDE.md §6.10).
 */
import { execSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

export type LocalStatus = { apiUrl: string; publishableKey: string; secretKey: string };

/** Đọc URL + khóa từ `supabase status` của máy dev (khóa local, không phải secret của Cloud). */
export function readLocalStatus(): LocalStatus {
  const raw = execSync("npx supabase status -o json", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  const json = JSON.parse(raw.slice(raw.indexOf("{"))) as Record<string, string | undefined>;
  const apiUrl = json.API_URL;
  const publishableKey = json.PUBLISHABLE_KEY;
  const secretKey = json.SECRET_KEY;
  if (!apiUrl || !publishableKey || !secretKey)
    throw new Error("Supabase local chưa chạy — hãy chạy `npm run db:start`.");
  return { apiUrl, publishableKey, secretKey };
}

export function isLocalUrl(url: string): boolean {
  return /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?(\/|$)/u.test(url);
}

/** Client đặc quyền cho script, lấy từ biến môi trường (`.env.local`) hoặc từ `supabase status`. */
export function scriptEnv(): LocalStatus {
  const fromEnv = {
    apiUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    publishableKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "",
    secretKey: process.env.SUPABASE_SECRET_KEY ?? "",
  };
  const env = fromEnv.apiUrl && fromEnv.secretKey && fromEnv.publishableKey ? fromEnv : readLocalStatus();
  if (!isLocalUrl(env.apiUrl) && process.env.ALLOW_REMOTE_SEED !== "dev-only") {
    throw new Error(
      "Từ chối: script chỉ chạy với Supabase local. Dự án dev trên Cloud cần ALLOW_REMOTE_SEED=dev-only.",
    );
  }
  return env;
}

export function adminClient(env: LocalStatus) {
  return createClient(env.apiUrl, env.secretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

export function publicClient(env: LocalStatus) {
  return createClient(env.apiUrl, env.publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
