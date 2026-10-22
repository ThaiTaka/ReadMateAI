/**
 * Cài nội dung FIXTURE R04 (scripts/fixtures/scoring-items.ts) vào Supabase LOCAL: chuỗi bài kiểm thử 3 bài, các bài
 * tập/phiên bản/câu, và quy trình kiểm duyệt đầy đủ (gửi duyệt → GV hư cấu duyệt) qua đúng các trigger của CSDL.
 * Chạy lặp lại không nhân bản (khóa theo `key`). Gọi enableLocalTestFixtures() trước.
 */
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { contentFingerprint } from "../../src/features/exercises/fingerprint.ts";
import { FIXTURE_EXERCISES, FIXTURE_SERIES_KEY, FIXTURE_TAG, type FixtureExercise } from "../fixtures/scoring-items.ts";

export type InstalledFixtures = { seriesId: string; lessonIds: Record<1 | 2 | 3, string> };

function must<R extends { data: unknown; error: unknown }>(result: R, step: string): NonNullable<R["data"]> {
  if (result.error) throw new Error(`${step}: ${JSON.stringify(result.error)}`);
  return result.data as NonNullable<R["data"]>;
}

/** Băm phiên bản = SHA-256 của các vân tay câu nối bằng dấu phẩy theo thứ tự (khớp private.exercise_version_hash). */
export function versionHash(fingerprints: readonly string[]): string {
  return createHash("sha256").update(fingerprints.join(","), "utf8").digest("hex");
}

export type FixtureSet = { seriesKey: string; tag: string; title: string; exercises: readonly FixtureExercise[] };

export function installScoringFixtures(admin: SupabaseClient, reviewerId: string): Promise<InstalledFixtures> {
  return installFixtureSet(admin, reviewerId, {
    seriesKey: FIXTURE_SERIES_KEY,
    tag: FIXTURE_TAG,
    title: "Chuỗi bài KIỂM THỬ R04 (hư cấu — không phải sách giáo khoa)",
    exercises: FIXTURE_EXERCISES,
  });
}

/** Cài một bộ fixture (chuỗi bài kiểm thử 3 bài + bài tập đã/chưa duyệt) — dùng chung cho R04 và R08.2. */
export async function installFixtureSet(
  admin: SupabaseClient,
  reviewerId: string,
  set: FixtureSet,
): Promise<InstalledFixtures> {
  const release = must(
    await admin.from("content_releases").select("id").order("synced_at", { ascending: false }).limit(1).maybeSingle(),
    "release",
  ) as { id: string } | null;
  if (!release) throw new Error("Chưa có content_releases — chạy db:sync-content trước.");

  const series = must(
    await admin
      .from("curriculum_series")
      .upsert(
        {
          key: set.seriesKey,
          series_kind: "test_fixture",
          title: set.title,
          source: "Dữ liệu kiểm thử tự động của dự án; chỉ tồn tại trên Supabase local",
          review_status: "approved",
          reviewed_by: set.tag,
          reviewed_at: "2026-10-20",
          content_hash: createHash("sha256").update(set.seriesKey).digest("hex"),
          release_id: release.id,
        },
        { onConflict: "key" },
      )
      .select("id")
      .single(),
    "series",
  ) as { id: string };

  const lessons = [1, 2, 3].map((ordinal) => ({
    series_id: series.id,
    ordinal,
    code: `KT${ordinal}`,
    title: `Bài kiểm thử ${ordinal}`,
    lesson_type: "new_units",
  }));
  const lessonRows = must(
    await admin.from("curriculum_lessons").upsert(lessons, { onConflict: "series_id,ordinal" }).select("id, ordinal"),
    "lessons",
  ) as Array<{ id: string; ordinal: 1 | 2 | 3 }>;
  const lessonIds = Object.fromEntries(lessonRows.map((row) => [row.ordinal, row.id])) as Record<1 | 2 | 3, string>;

  for (const fixture of set.exercises) {
    const existing = must(await admin.from("exercises").select("id").eq("key", fixture.key), "exercise read") as Array<{
      id: string;
    }>;
    if (existing.length > 0) continue;
    const exercise = must(
      await admin
        .from("exercises")
        .insert({
          key: fixture.key,
          type_code: "letter_sound",
          title: fixture.title,
          origin: "test_fixture",
          target_bands: [],
        })
        .select("id")
        .single(),
      "exercise",
    ) as { id: string };
    const version = must(
      await admin
        .from("exercise_versions")
        .insert({
          exercise_id: exercise.id,
          version_no: 1,
          series_id: series.id,
          lesson_ordinal: fixture.lessonOrdinal,
          source: { fixture: set.tag },
          validation_report: { note: "Fixture kiểm thử dựng tay — lược đồ zod kiểm ở tests/unit/scoring" },
        })
        .select("id")
        .single(),
      "version",
    ) as { id: string };
    const rows = fixture.items.map((item, index) => ({
      exercise_version_id: version.id,
      position: index + 1,
      item_key: item.id,
      type_code: item.type,
      variant: item.variant,
      content: item.content,
      answer: item.answer,
      objective: item.objective,
      required_units: item.requiredUnits,
      difficulty: item.difficulty,
      audio: item.audio,
      item_schema_version: item.schemaVersion,
      content_fingerprint: contentFingerprint(item),
    }));
    must(await admin.from("exercise_items").insert(rows), "items");
    const hash = versionHash(rows.map((row) => row.content_fingerprint));
    const now = new Date().toISOString();
    must(
      await admin
        .from("exercise_versions")
        .update({ status: "in_review", content_hash: hash, submitted_at: now })
        .eq("id", version.id),
      "submit",
    );
    must(
      await admin
        .from("content_reviews")
        .insert({ exercise_version_id: version.id, action: "submit", reviewer_id: reviewerId, content_hash: hash }),
      "review submit",
    );
    if (fixture.status === "approved") {
      must(
        await admin.from("content_reviews").insert({
          exercise_version_id: version.id,
          action: "approve",
          reviewer_id: reviewerId,
          content_hash: hash,
          checklist: { fixture: true },
          comment: "Duyệt GIẢ LẬP cho kiểm thử tự động (dữ liệu hư cấu)",
        }),
        "review approve",
      );
      must(
        await admin
          .from("exercise_versions")
          .update({ status: "approved", decided_by: reviewerId, decided_at: now })
          .eq("id", version.id),
        "approve",
      );
    }
  }
  return { seriesId: series.id, lessonIds };
}
