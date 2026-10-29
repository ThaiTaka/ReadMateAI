/**
 * Đồng bộ kho tri thức content/ → CSDL theo phiên bản (R03, REDESIGN_TASKS 3.8).
 *
 * - Chỉ chạy khi `content:check` không có lỗi (cùng hàm validateContent).
 * - Trạng thái duyệt lấy NGUYÊN từ tệp nguồn — không bao giờ tự đặt `approved` (CLAUDE.md §9.2.3); CSDL cũng chặn
 *   `approved` thiếu người duyệt/ngày/băm.
 * - Chạy lặp lại không lỗi: upsert theo khóa (`key`, (series, ordinal)); phiên bản mới chỉ tạo khi băm nội dung đổi;
 *   đơn vị không còn trong nguồn → `retired` (không xóa: bài học/lớp có thể đang tham chiếu).
 * - Chuỗi bài minh họa giữ `series_kind = illustrative` → không bao giờ xác nhận được thành chương trình thật.
 */
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import { validateContent } from "../../src/features/knowledge/content-validation.ts";
import {
  KB_FILES,
  loadKnowledgeBase,
  MANIFEST_FILE,
  PROFILES_DIR,
  SERIES_DIR,
  type KbFileKey,
} from "../../src/features/knowledge/load.ts";
import type { Review } from "../../src/features/knowledge/schema.ts";

export type SyncSummary = {
  releaseId: string;
  datasetVersion: string;
  contentHash: string;
  created: boolean;
  series: number;
  lessons: number;
  units: number;
  retired: number;
};

function readContentFiles(root: string): Map<string, string> {
  const dir = join(root, "content");
  const files = new Map<string, string>();
  for (const entry of readdirSync(dir, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
    const full = join(entry.parentPath, entry.name);
    files.set(relative(dir, full).split(sep).join("/"), readFileSync(full, "utf8"));
  }
  return files;
}

type UnitRow = {
  key: string;
  kind: string;
  text: string;
  review_status: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  content_hash: string | null;
};

function reviewColumns(review: Review) {
  return {
    review_status: review.status,
    reviewed_by: review.reviewedBy ?? null,
    reviewed_at: review.reviewedAt ?? null,
    content_hash: review.contentHash ?? null,
  };
}

export async function syncContent(admin: SupabaseClient, root = process.cwd()): Promise<SyncSummary> {
  const files = readContentFiles(root);
  const report = validateContent(files);
  if (report.errorCount > 0) throw new Error(`content:check có ${report.errorCount} lỗi — sửa trước khi đồng bộ.`);

  const parse = (path: string) => JSON.parse(files.get(path) ?? "null") as unknown;
  const loaded = loadKnowledgeBase({
    manifest: parse(MANIFEST_FILE),
    kb: Object.fromEntries((Object.keys(KB_FILES) as KbFileKey[]).map((key) => [key, parse(KB_FILES[key])])) as Record<
      KbFileKey,
      unknown
    >,
    series: [...files.keys()].filter((path) => path.startsWith(SERIES_DIR)).map((path) => [path, parse(path)] as const),
    profiles: [...files.keys()]
      .filter((path) => path.startsWith(PROFILES_DIR))
      .map((path) => [path, parse(path)] as const),
  });
  if (!loaded.ok) throw new Error("Không nạp được kho tri thức.");
  const kb = loaded.kb;

  // Băm toàn bộ kho tri thức (trừ danh mục giấy phép hình — không thuộc kho tri thức ngôn ngữ).
  const hash = createHash("sha256");
  for (const path of [...files.keys()].filter((p) => p !== "media/licenses.json").sort()) {
    hash
      .update(path)
      .update("\0")
      .update(files.get(path) ?? "")
      .update("\0");
  }
  const contentHash = hash.digest("hex");

  const existing = await admin.from("content_releases").select("id").eq("content_hash", contentHash).maybeSingle();
  let releaseId = existing.data?.id as string | undefined;
  const created = !releaseId;
  if (!releaseId) {
    const inserted = await admin
      .from("content_releases")
      .insert({
        dataset_version: kb.datasetVersion,
        content_hash: contentHash,
        stats: { series: kb.series.length, words: kb.words.length, sentences: kb.sentences.length },
      })
      .select("id")
      .single();
    if (inserted.error) throw inserted.error;
    releaseId = inserted.data.id as string;
  }

  let lessons = 0;
  for (const series of kb.series) {
    const upserted = await admin
      .from("curriculum_series")
      .upsert(
        {
          key: series.id,
          series_kind: series.seriesKind,
          title: series.title,
          source: series.source,
          ...reviewColumns(series.review),
          release_id: releaseId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "key" },
      )
      .select("id")
      .single();
    if (upserted.error) throw upserted.error;
    const rows = series.lessons.map((lesson) => ({
      series_id: upserted.data.id as string,
      ordinal: lesson.ordinal,
      code: lesson.code,
      title: lesson.title,
      lesson_type: lesson.lessonType,
      introduces: lesson.introduces,
      reviews: lesson.reviews,
    }));
    const lessonResult = await admin.from("curriculum_lessons").upsert(rows, { onConflict: "series_id,ordinal" });
    if (lessonResult.error) throw lessonResult.error;
    lessons += rows.length;
  }

  const units: UnitRow[] = [
    ...kb.letters.map((item) => ({
      key: item.id,
      kind: "letter",
      text: item.lower,
      ...reviewColumns(kb.fileMeta.letters.review),
    })),
    ...kb.phonemes.map((item) => ({
      key: item.id,
      kind: "phoneme",
      text: item.text,
      ...reviewColumns(kb.fileMeta.phonemes.review),
    })),
    ...kb.tones.map((item) => ({
      key: item.id,
      kind: "tone",
      text: item.name,
      ...reviewColumns(kb.fileMeta.tones.review),
    })),
    ...kb.rimes.map((item) => ({
      key: item.id,
      kind: "rime",
      text: item.text,
      ...reviewColumns(kb.fileMeta.rimes.review),
    })),
    ...kb.syllables.map((item) => ({ key: item.id, kind: "syllable", text: item.text, ...reviewColumns(item.review) })),
    ...kb.words.map((item) => ({ key: item.id, kind: "word", text: item.text, ...reviewColumns(item.review) })),
    ...kb.sentences.map((item) => ({ key: item.id, kind: "sentence", text: item.text, ...reviewColumns(item.review) })),
  ];
  const stamp = new Date().toISOString();
  for (let index = 0; index < units.length; index += 500) {
    const chunk = units
      .slice(index, index + 500)
      .map((unit) => ({ ...unit, release_id: releaseId, updated_at: stamp }));
    const result = await admin.from("kb_units").upsert(chunk, { onConflict: "key" });
    if (result.error) throw result.error;
  }

  // Đơn vị không còn trong nguồn → retired (giữ dòng để không gãy tham chiếu).
  const keys = new Set(units.map((unit) => unit.key));
  const all = await admin.from("kb_units").select("key, review_status");
  if (all.error) throw all.error;
  const stale = (all.data ?? []).filter((row) => !keys.has(row.key as string) && row.review_status !== "retired");
  for (const row of stale) {
    const result = await admin
      .from("kb_units")
      .update({ review_status: "retired", release_id: releaseId })
      .eq("key", row.key);
    if (result.error) throw result.error;
  }

  return {
    releaseId,
    datasetVersion: kb.datasetVersion,
    contentHash,
    created,
    series: kb.series.length,
    lessons,
    units: units.length,
    retired: stale.length,
  };
}
