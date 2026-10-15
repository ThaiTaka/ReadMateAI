import { z } from "zod";
import {
  distractorTagsSchema,
  itemBaseFields,
  nfc,
  optionId,
  pictureRefSchema,
  refineOptions,
  textOptionSchema,
} from "../../core/schemas.ts";

/**
 * Dạng 1 — Nhận diện chữ – âm (`letter_sound`, PRD §9.2).
 * - `picture_onset`: nhìn tranh, chọn chữ ghi âm đầu của tên tranh (tên tranh KHÔNG có trong `content`).
 * - `visual_match`: tìm chữ giống chữ mẫu — phân biệt chữ dễ nhầm hình dạng (b/d, m/n, n/u).
 * - `listen_letter`: nghe âm (bản ghi âm GV) rồi chọn chữ — chỉ có trên ứng dụng.
 */

const base = { ...itemBaseFields, type: z.literal("letter_sound") };

export const pictureOnsetItemSchema = z
  .strictObject({
    ...base,
    variant: z.literal("picture_onset"),
    content: z.strictObject({ picture: pictureRefSchema, options: z.array(textOptionSchema) }),
    answer: z.strictObject({ optionId, pictureName: nfc, distractorTags: distractorTagsSchema }),
  })
  .superRefine((item, ctx) => refineOptions(item.content.options, [item.answer.optionId], ctx));

export const visualMatchItemSchema = z
  .strictObject({
    ...base,
    variant: z.literal("visual_match"),
    content: z.strictObject({ sample: nfc, options: z.array(textOptionSchema) }),
    answer: z.strictObject({ optionId, distractorTags: distractorTagsSchema }),
  })
  .superRefine((item, ctx) => refineOptions(item.content.options, [item.answer.optionId], ctx));

export const listenLetterItemSchema = z
  .strictObject({
    ...base,
    variant: z.literal("listen_letter"),
    content: z.strictObject({ options: z.array(textOptionSchema) }),
    answer: z.strictObject({ optionId, distractorTags: distractorTagsSchema }),
  })
  .superRefine((item, ctx) => refineOptions(item.content.options, [item.answer.optionId], ctx));

export const letterSoundItemSchema = z.discriminatedUnion("variant", [
  pictureOnsetItemSchema,
  visualMatchItemSchema,
  listenLetterItemSchema,
]);
export type LetterSoundItem = z.infer<typeof letterSoundItemSchema>;
