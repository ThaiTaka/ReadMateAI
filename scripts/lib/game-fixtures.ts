/**
 * Cài nội dung FIXTURE R08.2 (scripts/fixtures/game-items.ts) vào Supabase LOCAL: chuỗi bài kiểm thử riêng, 3 bài, đủ
 * > 21 câu khác nhau đã duyệt GIẢ LẬP. Chạy lặp lại không nhân bản. Gọi enableLocalTestFixtures() trước.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { GAME_FIXTURE_EXERCISES, GAME_FIXTURE_SERIES_KEY, GAME_FIXTURE_TAG } from "../fixtures/game-items.ts";
import { installFixtureSet, type InstalledFixtures } from "./scoring-fixtures.ts";

export function installGameFixtures(admin: SupabaseClient, reviewerId: string): Promise<InstalledFixtures> {
  return installFixtureSet(admin, reviewerId, {
    seriesKey: GAME_FIXTURE_SERIES_KEY,
    tag: GAME_FIXTURE_TAG,
    title: "Chuỗi bài KIỂM THỬ R08.2 (hư cấu — không phải sách giáo khoa)",
    exercises: GAME_FIXTURE_EXERCISES,
  });
}
