import { z } from "zod";
import { buildSyllableItemSchema } from "./types/build-syllable/schema.ts";
import { fillBlankItemSchema } from "./types/fill-blank/schema.ts";
import { identifyUnitItemSchema } from "./types/identify-unit/schema.ts";
import { letterSoundItemSchema } from "./types/letter-sound/schema.ts";
import { sentenceReadingItemSchema } from "./types/sentence-reading/schema.ts";
import { wordPictureItemSchema } from "./types/word-picture/schema.ts";

/** Một câu bài tập bất kỳ trong sáu dạng (lược đồ là nguồn sự thật — DATA_MODEL §5). */
export const exerciseItemSchema = z.union([
  letterSoundItemSchema,
  buildSyllableItemSchema,
  identifyUnitItemSchema,
  fillBlankItemSchema,
  wordPictureItemSchema,
  sentenceReadingItemSchema,
]);
export type ExerciseItem = z.infer<typeof exerciseItemSchema>;
export type ExerciseItemOfType<T extends ExerciseItem["type"]> = Extract<ExerciseItem, { type: T }>;
