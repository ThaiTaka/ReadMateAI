import { execSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { setLocalLeaderboardApproval } from "../../scripts/lib/test-fixtures";

/**
 * Trước E2E có CSDL: xác minh Supabase LOCAL đang chạy và có dữ liệu giả; xóa bộ đếm giới hạn tần suất của máy dev
 * (để chạy lại bộ kiểm thử nhiều lần trong 15 phút không bị khóa). Không bao giờ chạm CSDL ngoài máy local.
 */
export default async function globalSetup() {
  let raw: string;
  try {
    raw = execSync("npx supabase status -o json", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  } catch {
    throw new Error("BLOCKED: Supabase local chưa chạy — `npm run db:start`, `npm run db:env`, `npm run db:seed`.");
  }
  const status = JSON.parse(raw.slice(raw.indexOf("{"))) as Record<string, string>;
  if (!/^http:\/\/127\.0\.0\.1:\d+$/u.test(status.API_URL ?? ""))
    throw new Error("Từ chối: chỉ chạy với Supabase local.");
  const admin = createClient(status.API_URL!, status.SECRET_KEY!, { auth: { persistSession: false } });
  const seeded = await admin.from("classes").select("id").eq("id", "5eed0000-0000-4000-8000-0000000000a1");
  if (!seeded.data?.length) throw new Error("BLOCKED: chưa có dữ liệu giả — chạy `npm run db:seed`.");
  const cleared = await admin.from("rate_limit_buckets").delete().neq("key_hash", "");
  if (cleared.error) throw cleared.error;
  // R05: giả lập 'cờ hệ thống bảng xếp hạng đã được chấp thuận' CHỈ trên local trong lúc chạy E2E; global-teardown trả về TẮT.
  setLocalLeaderboardApproval(true);
}
