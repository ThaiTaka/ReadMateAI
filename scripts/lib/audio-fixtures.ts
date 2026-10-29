/**
 * Cài nội dung FIXTURE R10.3a (scripts/fixtures/audio-items.ts) vào Supabase LOCAL: chuỗi bài kiểm thử riêng với các câu
 * "Nghe âm – chọn chữ". Chạy lặp lại không nhân bản. Gọi enableLocalTestFixtures() trước.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { AUDIO_FIXTURE_EXERCISES, AUDIO_FIXTURE_SERIES_KEY, AUDIO_FIXTURE_TAG } from "../fixtures/audio-items.ts";
import { installFixtureSet, type InstalledFixtures } from "./scoring-fixtures.ts";

export function installAudioFixtures(admin: SupabaseClient, reviewerId: string): Promise<InstalledFixtures> {
  return installFixtureSet(admin, reviewerId, {
    seriesKey: AUDIO_FIXTURE_SERIES_KEY,
    tag: AUDIO_FIXTURE_TAG,
    title: "Chuỗi bài KIỂM THỬ R10.3a (hư cấu — không phải sách giáo khoa)",
    exercises: AUDIO_FIXTURE_EXERCISES,
  });
}
