/**
 * npm run db:env — tạo/cập nhật `.env.local` cho máy dev từ Supabase LOCAL (`supabase status`).
 *
 * - Chỉ ghi khóa của Supabase local (127.0.0.1) — từ chối nếu không phải máy local.
 * - Giữ nguyên các biến đã có; chỉ cập nhật URL/khóa Supabase local. Sinh LOGIN_CODE_PEPPER và
 *   SEED_TEACHER_PASSWORD ngẫu nhiên nếu chưa có.
 * - KHÔNG in giá trị khóa/mật khẩu ra màn hình. `.env.local` đã nằm trong .gitignore — không commit.
 */
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { isLocalUrl, readLocalStatus } from "./lib/local-supabase.ts";

const ENV_PATH = join(process.cwd(), ".env.local");
const status = readLocalStatus();
if (!isLocalUrl(status.apiUrl)) throw new Error("Từ chối: chỉ ghi cấu hình của Supabase local.");

const lines = existsSync(ENV_PATH) ? readFileSync(ENV_PATH, "utf8").split(/\r?\n/u) : [];
const values = new Map<string, string>();
for (const line of lines) {
  const match = /^([A-Z0-9_]+)=(.*)$/u.exec(line.trim());
  if (match?.[1]) values.set(match[1], match[2] ?? "");
}

// Mật khẩu GV giả: đủ độ dài + chữ hoa + chữ thường + số (khớp config.toml password_requirements).
const strongPassword = () => `Rm${randomBytes(18).toString("base64url")}9a`;

const updates: Record<string, string> = {
  NEXT_PUBLIC_SITE_URL: values.get("NEXT_PUBLIC_SITE_URL") || "http://127.0.0.1:3000",
  NEXT_PUBLIC_SUPABASE_URL: status.apiUrl,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: status.publishableKey,
  SUPABASE_SECRET_KEY: status.secretKey,
  LOGIN_CODE_PEPPER: values.get("LOGIN_CODE_PEPPER") || randomBytes(48).toString("base64url"),
  SEED_TEACHER_PASSWORD: values.get("SEED_TEACHER_PASSWORD") || strongPassword(),
};

const written = new Set<string>();
const output = lines.map((line) => {
  const key = /^([A-Z0-9_]+)=/u.exec(line.trim())?.[1];
  if (key && key in updates) {
    written.add(key);
    return `${key}=${updates[key]}`;
  }
  return line;
});
const missing = Object.keys(updates).filter((key) => !written.has(key));
if (missing.length > 0) {
  if (output.length === 0) output.push("# Cấu hình máy dev — sinh bởi npm run db:env (Supabase LOCAL). KHÔNG commit.");
  for (const key of missing) output.push(`${key}=${updates[key]}`);
}
writeFileSync(ENV_PATH, `${output.filter((line, index, all) => line !== "" || index < all.length - 1).join("\n")}\n`);
console.log(`Đã cập nhật .env.local (${Object.keys(updates).join(", ")}) — không in giá trị.`);
