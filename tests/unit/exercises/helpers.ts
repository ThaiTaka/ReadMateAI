import { findProfile } from "@/features/knowledge/curriculum";
import { KNOWLEDGE_BASE } from "@/features/knowledge/default-kb";
import type { KnowledgeBase } from "@/features/knowledge/load";
import type { CurriculumProfile, Review } from "@/features/knowledge/schema";
import { DEMO_LESSON_ORDINAL, DEMO_MEDIA, DEMO_QUESTIONS, demoFixtureReview } from "@/features/demo/practice-fixture";
import type { VariantId } from "@/features/exercises/core/module";
import type { AudioAsset, MediaLibrary } from "@/features/exercises/core/media";
import type { GenerationRequest } from "@/features/exercises/generation/context";
import { generateExerciseSet } from "@/features/exercises/generation/generate";
import type { ExerciseItem } from "@/features/exercises/items";
import { VARIANTS } from "@/features/exercises/registry";
import type { ValidationContext } from "@/features/exercises/validation";
import type { Band } from "@/types/learning";

export const kb = KNOWLEDGE_BASE;

function requireProfile(id: string): CurriculumProfile {
  const profile = findProfile(kb, id);
  if (!profile) throw new Error(`thiếu hồ sơ ${id}`);
  return profile;
}

export const demoProfile = requireProfile("profile:illustrative-demo");
export const class1a2 = requireProfile("profile:class-1a2");

/** Yêu cầu sinh bài ở chế độ demo (hồ sơ minh họa, bài MH16). */
export function demoRequest(variant: VariantId, band: Band = "developing", extra: Partial<GenerationRequest> = {}) {
  return {
    kb,
    profile: demoProfile,
    band,
    lessonOrdinal: DEMO_LESSON_ORDINAL,
    mode: "demo" as const,
    media: DEMO_MEDIA,
    variant,
    count: 4,
    seed: "unit-test",
    comprehension: DEMO_QUESTIONS,
    fixtureReview: demoFixtureReview,
    allowPreviewOnly: true,
    ...extra,
  } satisfies GenerationRequest;
}

export function demoValidation(band: Band = "developing", extra: Partial<ValidationContext> = {}): ValidationContext {
  return {
    kb,
    profile: demoProfile,
    band,
    lessonOrdinal: DEMO_LESSON_ORDINAL,
    mode: "demo",
    media: DEMO_MEDIA,
    fixtureReview: demoFixtureReview,
    ...extra,
  };
}

/** Sinh bài demo và trả về các câu (ném lỗi nếu bộ sinh thất bại — để test rõ ràng). */
export function demoItems(variant: VariantId, band: Band = "developing", extra: Partial<GenerationRequest> = {}) {
  const result = generateExerciseSet(demoRequest(variant, band, extra));
  if (!result.ok) throw new Error(`${variant}: ${result.code} ${result.message}`);
  return result.set.items;
}

export function firstItem<V extends VariantId>(variant: V, band: Band = "developing") {
  const item = demoItems(variant, band)[0];
  if (!item) throw new Error(`không có câu ${variant}`);
  return item as Extract<ExerciseItem, { variant: V }>;
}

export function clone<T>(value: T): T {
  return structuredClone(value);
}

// ---------------------------------------------------------------------------
// Dữ liệu "đã duyệt" GIẢ LẬP — chỉ trong bộ nhớ của kiểm thử, để chứng minh cổng chặn của chế độ học thật.
// Không ghi vào content/, không phải quyết định duyệt của giáo viên nào.
// ---------------------------------------------------------------------------

const FAKE_APPROVAL: Review = {
  status: "approved",
  reviewedBy: "Giáo viên giả lập (chỉ trong kiểm thử)",
  reviewedAt: "2026-10-15",
  contentHash: "0".repeat(64),
};

/** Hồ sơ lớp đã xác nhận (giả lập trong bộ nhớ), dùng chuỗi bài minh họa ở bài MH16. */
export const confirmedProfile: CurriculumProfile = {
  ...clone(demoProfile),
  id: "profile:test-confirmed",
  status: "confirmed",
  confirmation: { confirmedBy: "Giáo viên giả lập (chỉ trong kiểm thử)", confirmedAt: "2026-10-15" },
};

/**
 * Kho tri thức có dữ liệu tham chiếu đã duyệt và CHỈ những tiếng trong `approvedSyllables` đã duyệt
 * (giả lập trong bộ nhớ).
 */
export function approvedKb(approvedSyllables: readonly string[]): KnowledgeBase {
  const copy = clone(kb);
  for (const key of Object.keys(copy.fileMeta) as Array<keyof KnowledgeBase["fileMeta"]>) {
    copy.fileMeta[key].review = FAKE_APPROVAL;
  }
  copy.syllables = copy.syllables.map((item) =>
    approvedSyllables.includes(item.text) ? { ...item, review: FAKE_APPROVAL } : item,
  );
  return copy;
}

/** Thư viện media có bản ghi câu lệnh đã duyệt (giả lập) cho một biến thể. */
export function mediaWithInstruction(variant: VariantId): MediaLibrary {
  const asset: AudioAsset = {
    id: `audio:test-${variant}`,
    role: "instruction",
    spokenText: VARIANTS[variant].instruction.spoken,
    source: "teacher_recording",
    review: { status: "approved" },
  };
  return { pictures: [], audio: [asset] };
}
