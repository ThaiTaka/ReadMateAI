/**
 * Bật "môi trường kiểm thử" trên Supabase LOCAL để CSDL chấp nhận dữ liệu fixture (origin/series_kind = test_fixture).
 *
 * AN TOÀN: lệnh `supabase db query --local` CHỈ kết nối CSDL local (Docker) — không có đường tới dự án Cloud.
 * Migration giữ cờ này TẮT; production không bao giờ chạy script này.
 */
import { execSync } from "node:child_process";

export function enableLocalTestFixtures(): void {
  execSync(
    'npx supabase db query --local "update private.test_environment set fixtures_allowed = true, updated_at = now() where singleton"',
    { stdio: ["ignore", "ignore", "pipe"] },
  );
}
