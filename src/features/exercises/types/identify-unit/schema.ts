import { z } from "zod";
import {
  distractorTagsSchema,
  itemBaseFields,
  nfc,
  optionId,
  refineOptions,
  textOptionSchema,
  unitId,
} from "../../core/schemas.ts";

/**
 * Dạng 3 — Tìm âm, vần, thanh trong tiếng (`identify_unit`, PRD §9.2).
 * - `which_onset` / `which_rime` / `which_tone`: đọc tiếng, chọn một đáp án.
 * - `find_with_unit`: chọn TẤT CẢ các tiếng có vần cho sẵn — nhiều đáp án hợp lệ, được khai báo
 *   tường minh và bộ kiểm tra tính lại từ bộ phân tích tiếng.
 */

const base = { ...itemBaseFields, type: z.literal("identify_unit") };

const whichFields = {
  ...base,
  content: z.strictObject({ syllable: nfc, options: z.array(textOptionSchema) }),
  answer: z.strictObject({ optionId, distractorTags: distractorTagsSchema }),
};

export const whichOnsetItemSchema = z
  .strictObject({ ...whichFields, variant: z.literal("which_onset") })
  .superRefine((item, ctx) => refineOptions(item.content.options, [item.answer.optionId], ctx));
export const whichRimeItemSchema = z
  .strictObject({ ...whichFields, variant: z.literal("which_rime") })
  .superRefine((item, ctx) => refineOptions(item.content.options, [item.answer.optionId], ctx));
export const whichToneItemSchema = z
  .strictObject({ ...whichFields, variant: z.literal("which_tone") })
  .superRefine((item, ctx) => refineOptions(item.content.options, [item.answer.optionId], ctx));

export const findWithUnitItemSchema = z
  .strictObject({
    ...base,
    variant: z.literal("find_with_unit"),
    content: z.strictObject({ unitText: nfc, unit: unitId, options: z.array(textOptionSchema) }),
    answer: z.strictObject({ optionIds: z.array(optionId), distractorTags: distractorTagsSchema }),
  })
  .superRefine((item, ctx) => {
    refineOptions(item.content.options, item.answer.optionIds, ctx);
    if (new Set(item.answer.optionIds).size !== item.answer.optionIds.length) {
      ctx.addIssue({ code: "custom", path: ["answer", "optionIds"], message: "Đáp án bị khai báo trùng" });
    }
    if (item.answer.optionIds.length >= item.content.options.length) {
      ctx.addIssue({ code: "custom", path: ["answer", "optionIds"], message: "Phải có ít nhất một phương án sai" });
    }
  });

export const identifyUnitItemSchema = z.discriminatedUnion("variant", [
  whichOnsetItemSchema,
  whichRimeItemSchema,
  whichToneItemSchema,
  findWithUnitItemSchema,
]);
export type IdentifyUnitItem = z.infer<typeof identifyUnitItemSchema>;
