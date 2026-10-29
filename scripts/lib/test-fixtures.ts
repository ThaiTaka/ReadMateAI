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

/**
 * Giả lập "cờ hệ thống vinh danh TOP 3 đã được chấp thuận" CHỈ trên Supabase LOCAL để kiểm thử R06.1.
 * Production không bao giờ chạy hàm này: cờ `honors_feature_approved` chỉ đổi bằng migration sau khi nhà trường chấp
 * thuận. Mặc định (migration R03) là TẮT; kiểm thử phải trả về TẮT khi xong.
 */
export function setLocalHonorsApproval(approved: boolean): void {
  execSync(
    `npx supabase db query --local "update private.feature_flags set enabled = ${approved ? "true" : "false"}, updated_at = now() where key = 'honors_feature_approved'"`,
    { stdio: ["ignore", "ignore", "pipe"] },
  );
}

/** Khoảng chống lặp tạo ảnh chụp vinh danh (giây) — chỉ đổi ở Supabase local, mặc định của hệ thống là 15. */
export function setLocalHonorDedupeSeconds(seconds: number): void {
  if (!Number.isInteger(seconds) || seconds < 0 || seconds > 600) throw new Error("dedupe_seconds không hợp lệ");
  execSync(`npx supabase db query --local "update private.honor_settings set dedupe_seconds = ${seconds}"`, {
    stdio: ["ignore", "ignore", "pipe"],
  });
}

/**
 * Cho phép tạo lượt chơi game KHÔNG tính điểm để kiểm thử cơ chế lưu trạng thái (R07.5a) CHỈ trên Supabase LOCAL.
 * Cần cả `fixtures_allowed` (enableLocalTestFixtures). Production luôn tắt: tạo lượt mới trả INSUFFICIENT_CONTENT
 * cho tới khi R08 phân bổ 7 chạm trán + 21 câu. Kiểm thử phải trả về TẮT khi xong.
 */
export function setLocalGameRunFixtures(allowed: boolean): void {
  execSync(
    `npx supabase db query --local "update private.test_environment set game_run_fixtures_allowed = ${allowed ? "true" : "false"}, updated_at = now() where singleton"`,
    { stdio: ["ignore", "ignore", "pipe"] },
  );
}

/**
 * Giả lập "cờ hệ thống ghi âm giọng giáo viên đã được chấp thuận" CHỈ trên Supabase LOCAL để kiểm thử R10.2.
 * Production không bao giờ chạy hàm này: cờ `teacher_audio_recording_approved` chỉ đổi bằng migration sau khi giáo viên
 * đồng ý bằng văn bản và chủ dự án cho phép. Mặc định (migration R10.2) là TẮT; kiểm thử phải trả về TẮT khi xong.
 */
export function setLocalTeacherAudioApproval(approved: boolean): void {
  execSync(
    `npx supabase db query --local "update private.feature_flags set enabled = ${approved ? "true" : "false"}, updated_at = now() where key = 'teacher_audio_recording_approved'"`,
    { stdio: ["ignore", "ignore", "pipe"] },
  );
}

/**
 * Giả lập "cờ hệ thống phát bản ghi giáo viên cho học sinh đã được chấp thuận" CHỈ trên Supabase LOCAL để kiểm thử R10.3a.
 * Production không bao giờ chạy hàm này: cờ `student_teacher_audio_playback_approved` chỉ đổi bằng migration sau khi có
 * bản ghi thật được duyệt, GV đồng ý, thử trên iPhone/Android và chủ dự án cho phép. Mặc định là TẮT; kiểm thử phải trả về TẮT khi xong.
 */
export function setLocalStudentAudioPlayback(approved: boolean): void {
  execSync(
    `npx supabase db query --local "update private.feature_flags set enabled = ${approved ? "true" : "false"}, updated_at = now() where key = 'student_teacher_audio_playback_approved'"`,
    { stdio: ["ignore", "ignore", "pipe"] },
  );
}

/**
 * Giả lập "cờ hệ thống thư viện giọng máy đã được chấp thuận" (giáo viên duyệt lời đọc, tạo và duyệt âm thanh) CHỈ trên Supabase LOCAL để
 * kiểm thử R10.5. Production không bao giờ chạy hàm này: cờ `tts_library_approved` chỉ đổi bằng migration sau khi chủ dự án chọn nhà cung
 * cấp/giọng và xác nhận điều khoản/chi phí. Mặc định là TẮT; kiểm thử phải trả về TẮT khi xong.
 */
export function setLocalTtsLibrary(approved: boolean): void {
  execSync(
    `npx supabase db query --local "update private.feature_flags set enabled = ${approved ? "true" : "false"}, updated_at = now() where key = 'tts_library_approved'"`,
    { stdio: ["ignore", "ignore", "pipe"] },
  );
}

/**
 * Giả lập "cờ phát giọng máy ĐÃ DUYỆT cho học sinh" CHỈ trên Supabase LOCAL để kiểm thử R10.5. Production không bao giờ chạy hàm này:
 * cờ `student_tts_playback_approved` chỉ đổi bằng migration sau khi giáo viên đã nghe và duyệt tệp, đã thử trên iPhone/Android và chủ dự án
 * cho phép. Mặc định là TẮT; kiểm thử phải trả về TẮT khi xong.
 */
export function setLocalStudentTtsPlayback(approved: boolean): void {
  execSync(
    `npx supabase db query --local "update private.feature_flags set enabled = ${approved ? "true" : "false"}, updated_at = now() where key = 'student_tts_playback_approved'"`,
    { stdio: ["ignore", "ignore", "pipe"] },
  );
}

/** Tắt/bật "môi trường kiểm thử" (fixture) để kiểm tra rằng tệp `test_only` KHÔNG phát được khi môi trường kiểm thử tắt. Chỉ Supabase local. */
export function setLocalFixturesAllowed(allowed: boolean): void {
  execSync(
    `npx supabase db query --local "update private.test_environment set fixtures_allowed = ${allowed ? "true" : "false"}, updated_at = now() where singleton"`,
    { stdio: ["ignore", "ignore", "pipe"] },
  );
}

/**
 * Bật/tắt CHẾ ĐỘ TRÌNH DIỄN âm thanh (docs/CONTEST_AUDIO.md) CHỈ trên Supabase LOCAL để kiểm thử: cờ hệ thống, cổng local của CSDL và cờ
 * "phát cả mục chờ kiểm chứng". Production không bao giờ chạy hàm này; cả ba mặc định TẮT. Kiểm thử phải trả về TẮT khi xong
 * (hoặc khôi phục trạng thái ban đầu của máy dev bằng `npm run audio:contest -- status`).
 */
export function setLocalContestAudio(state: { enabled: boolean; gate: boolean; playUnverified?: boolean }): void {
  const run = (statement: string) =>
    execSync(`npx supabase db query --local "${statement}"`, { stdio: ["ignore", "ignore", "pipe"] });
  run(
    `update private.feature_flags set enabled = ${state.enabled}, updated_at = now() where key = 'contest_audio_preview_enabled'`,
  );
  run(
    `update private.feature_flags set enabled = ${state.playUnverified === true}, updated_at = now() where key = 'contest_audio_play_unverified'`,
  );
  run(`update private.test_environment set contest_audio_allowed = ${state.gate}, updated_at = now() where singleton`);
}
