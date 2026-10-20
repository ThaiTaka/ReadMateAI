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

/**
 * Giả lập "cờ hệ thống bảng xếp hạng đã được chấp thuận" CHỈ trên Supabase LOCAL để kiểm thử R05.
 * Production không bao giờ chạy hàm này: cờ `leaderboard_feature_approved` chỉ đổi bằng migration sau khi có chấp thuận
 * bằng văn bản của nhà trường và rà soát pháp lý (PRIVACY_AND_SECURITY §5). Mặc định (migration R03) là TẮT.
 */
export function setLocalLeaderboardApproval(approved: boolean): void {
  execSync(
    `npx supabase db query --local "update private.feature_flags set enabled = ${approved ? "true" : "false"}, updated_at = now() where key = 'leaderboard_feature_approved'"`,
    { stdio: ["ignore", "ignore", "pipe"] },
  );
}
