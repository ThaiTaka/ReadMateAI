import { z } from "zod";
import { isNFC } from "../../../../lib/vietnamese/normalize.ts";
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
 * Dạng 4 — Điền âm, vần, dấu thanh còn thiếu (`fill_blank`, PRD §9.2).
 * - `missing_onset`: điền c/k, g/gh, ng/ngh — đáp án duy nhất NHỜ QUY TẮC CHÍNH TẢ (không cần tranh).
 * - `missing_rime`: nhìn tranh, điền vần — tranh quyết định đáp án (nhiều vần có thể ghép ra tiếng có nghĩa).
 * - `missing_tone`: nhìn tranh, điền dấu thanh — tranh quyết định đáp án.
 * Bộ kiểm tra đếm số phương án ghép ra tiếng viết đúng: thiếu tranh mà có hơn một → đáp án mơ hồ.
 */

const nfcOrEmpty = z.string().refine(isNFC, { message: "Chuỗi phải ở dạng Unicode NFC" });

/** Từ có chỗ trống: `wordPrefix` + (`before` + [chỗ trống] + `after`) + `wordSuffix`. */
const templateSchema = z.strictObject({
  wordPrefix: nfcOrEmpty,
  before: nfcOrEmpty,
  after: nfcOrEmpty,
  wordSuffix: nfcOrEmpty,
  /** Bài điền dấu: vị trí ký tự trong `before` nhận dấu thanh (để hiện tiếng sau khi trẻ chọn dấu). */
  markIndex: z.int().min(0).optional(),
});
export type BlankTemplate = z.infer<typeof templateSchema>;

const base = { ...itemBaseFields, type: z.literal("fill_blank") };

const answerSchema = z.strictObject({
  optionId,
  /** Từ hoàn chỉnh sau khi điền đúng. */
  result: nfc,
  pictureName: nfc.nullable(),
  distractorTags: distractorTagsSchema,
});

export const missingOnsetItemSchema = z
  .strictObject({
    ...base,
    variant: z.literal("missing_onset"),
    content: z.strictObject({
      picture: pictureRefSchema.nullable(),
      template: templateSchema,
      options: z.array(textOptionSchema),
    }),
    answer: answerSchema,
  })
  .superRefine((item, ctx) => refineOptions(item.content.options, [item.answer.optionId], ctx));

export const missingRimeItemSchema = z
  .strictObject({
    ...base,
    variant: z.literal("missing_rime"),
    content: z.strictObject({
      picture: pictureRefSchema.nullable(),
      template: templateSchema,
      options: z.array(textOptionSchema),
    }),
    answer: answerSchema,
  })
  .superRefine((item, ctx) => refineOptions(item.content.options, [item.answer.optionId], ctx));

export const missingToneItemSchema = z
  .strictObject({
    ...base,
    variant: z.literal("missing_tone"),
    content: z.strictObject({
      picture: pictureRefSchema.nullable(),
      /** Tiếng chưa có dấu thanh, ví dụ "ca" (đáp án "cá"). */
      template: templateSchema,
      options: z.array(textOptionSchema),
    }),
    answer: answerSchema,
  })
  .superRefine((item, ctx) => {
    refineOptions(item.content.options, [item.answer.optionId], ctx);
    if (item.content.options.some((option) => option.tone === undefined)) {
      ctx.addIssue({
        code: "custom",
        path: ["content", "options"],
        message: "Phương án dấu thanh phải khai báo thanh",
      });
    }
  });

export const fillBlankItemSchema = z.discriminatedUnion("variant", [
  missingOnsetItemSchema,
  missingRimeItemSchema,
  missingToneItemSchema,
]);
export type FillBlankItem = z.infer<typeof fillBlankItemSchema>;
