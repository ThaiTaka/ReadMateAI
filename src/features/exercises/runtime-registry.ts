import type { ExerciseTypeCode } from "../../types/learning.ts";
import type { ExerciseTypeRuntime, VariantDefinition, VariantId } from "./core/module.ts";
import type { ExerciseItem, ExerciseItemOfType } from "./items.ts";
import { buildSyllableRuntime } from "./types/build-syllable/runtime.ts";
import { BUILD_SYLLABLE_VARIANTS } from "./types/build-syllable/variants.ts";
import { fillBlankRuntime } from "./types/fill-blank/runtime.ts";
import { FILL_BLANK_VARIANTS } from "./types/fill-blank/variants.ts";
import { identifyUnitRuntime } from "./types/identify-unit/runtime.ts";
import { IDENTIFY_UNIT_VARIANTS } from "./types/identify-unit/variants.ts";
import { letterSoundRuntime } from "./types/letter-sound/runtime.ts";
import { LETTER_SOUND_VARIANTS } from "./types/letter-sound/variants.ts";
import { sentenceReadingRuntime } from "./types/sentence-reading/runtime.ts";
import { SENTENCE_READING_VARIANTS } from "./types/sentence-reading/variants.ts";
import { wordPictureRuntime } from "./types/word-picture/runtime.ts";
import { WORD_PICTURE_VARIANTS } from "./types/word-picture/variants.ts";

/**
 * Sổ đăng ký phần CHẠY TRÊN TRÌNH DUYỆT của sáu dạng bài (chấm, gợi ý, hiện đáp án) và định nghĩa biến thể.
 * Không kéo zod hay kho tri thức vào bundle của học sinh. Phần đầy đủ (lược đồ, bộ kiểm tra): registry.ts.
 */

type RuntimeRegistry = { [T in ExerciseTypeCode]: ExerciseTypeRuntime<ExerciseItemOfType<T>> };

export const EXERCISE_RUNTIMES: RuntimeRegistry = {
  letter_sound: letterSoundRuntime,
  build_syllable: buildSyllableRuntime,
  identify_unit: identifyUnitRuntime,
  fill_blank: fillBlankRuntime,
  word_picture: wordPictureRuntime,
  sentence_reading: sentenceReadingRuntime,
};

export const VARIANTS: Readonly<Record<VariantId, VariantDefinition>> = {
  ...LETTER_SOUND_VARIANTS,
  ...BUILD_SYLLABLE_VARIANTS,
  ...IDENTIFY_UNIT_VARIANTS,
  ...FILL_BLANK_VARIANTS,
  ...WORD_PICTURE_VARIANTS,
  ...SENTENCE_READING_VARIANTS,
};

export const VARIANTS_BY_TYPE: Readonly<Record<ExerciseTypeCode, readonly VariantId[]>> = {
  letter_sound: Object.keys(LETTER_SOUND_VARIANTS) as VariantId[],
  build_syllable: Object.keys(BUILD_SYLLABLE_VARIANTS) as VariantId[],
  identify_unit: Object.keys(IDENTIFY_UNIT_VARIANTS) as VariantId[],
  fill_blank: Object.keys(FILL_BLANK_VARIANTS) as VariantId[],
  word_picture: Object.keys(WORD_PICTURE_VARIANTS) as VariantId[],
  sentence_reading: Object.keys(SENTENCE_READING_VARIANTS) as VariantId[],
};

/**
 * Phần chạy của một câu. TypeScript không liên kết được kiểu hợp (union) của `item` với bảng ánh xạ ở trên,
 * nên phép ép kiểu được gói gọn tại đây; đúng đắn được bảo đảm vì khóa tra cứu chính là `item.type`.
 */
export function runtimeOf<Item extends ExerciseItem>(item: Item): ExerciseTypeRuntime<Item> {
  return EXERCISE_RUNTIMES[item.type] as unknown as ExerciseTypeRuntime<Item>;
}

export function variantOf(item: Pick<ExerciseItem, "variant">): VariantDefinition {
  return VARIANTS[item.variant];
}
