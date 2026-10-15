import type { ExerciseTypeCode } from "../../types/learning.ts";
import type { ExerciseTypeModule } from "./core/module.ts";
import type { ExerciseItem, ExerciseItemOfType } from "./items.ts";
import { buildSyllableModule } from "./types/build-syllable/module.ts";
import { fillBlankModule } from "./types/fill-blank/module.ts";
import { identifyUnitModule } from "./types/identify-unit/module.ts";
import { letterSoundModule } from "./types/letter-sound/module.ts";
import { sentenceReadingModule } from "./types/sentence-reading/module.ts";
import { wordPictureModule } from "./types/word-picture/module.ts";

export { VARIANTS, VARIANTS_BY_TYPE, variantOf } from "./runtime-registry.ts";

/**
 * Sổ đăng ký ĐẦY ĐỦ sáu dạng bài (lược đồ zod, bộ kiểm tra, chống lộ đáp án, biểu diễn phiếu) — dùng ở
 * phía máy chủ / lúc build (bộ sinh, bộ kiểm tra). Giao diện chỉ dùng runtime-registry.ts.
 * Thêm dạng bài mới: tạo thư mục types/<dạng>/ rồi đăng ký ở cả hai sổ — xem docs/EXERCISE_ENGINE.md §9.
 */

type ModuleRegistry = { [T in ExerciseTypeCode]: ExerciseTypeModule<ExerciseItemOfType<T>> };

export const EXERCISE_MODULES: ModuleRegistry = {
  letter_sound: letterSoundModule,
  build_syllable: buildSyllableModule,
  identify_unit: identifyUnitModule,
  fill_blank: fillBlankModule,
  word_picture: wordPictureModule,
  sentence_reading: sentenceReadingModule,
};

/** Module đầy đủ của một câu (ép kiểu gói gọn tại đây — khóa tra cứu chính là `item.type`). */
export function moduleOf<Item extends ExerciseItem>(item: Item): ExerciseTypeModule<Item> {
  return EXERCISE_MODULES[item.type] as unknown as ExerciseTypeModule<Item>;
}
