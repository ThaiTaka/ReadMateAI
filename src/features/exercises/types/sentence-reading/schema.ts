import { z } from "zod";
import {
  distractorTagsSchema,
  itemBaseFields,
  nfc,
  optionId,
  pictureOptionSchema,
  refineOptions,
  textOptionSchema,
} from "../../core/schemas.ts";

/**
 * Dạng 6 — Đọc câu – hiểu câu (`sentence_reading`, PRD §9.2), ưu tiên Nhóm 1 (Tăng tốc).
 * - `sentence_picture`: đọc câu, chọn tranh của sự vật được nói tới trong câu.
 * - `comprehension_question`: đọc câu và câu hỏi, chọn câu trả lời — đáp án PHẢI nằm nguyên văn trong câu,
 *   phương án nhiễu KHÔNG được nằm trong câu (để đáp án xác định được từ chính ngữ liệu).
 * - `arrange_words`: chạm các thẻ từ theo thứ tự để tạo câu.
 */

const base = { ...itemBaseFields, type: z.literal("sentence_reading") };

export const sentencePictureItemSchema = z
  .strictObject({
    ...base,
    variant: z.literal("sentence_picture"),
    content: z.strictObject({ sentence: nfc, options: z.array(pictureOptionSchema) }),
    answer: z.strictObject({
      optionId,
      /** Từ trong câu mà tranh đáp án thể hiện. */
      keyword: nfc,
      pictureNames: z.record(optionId, nfc),
      distractorTags: distractorTagsSchema,
    }),
  })
  .superRefine((item, ctx) => {
    refineOptions(item.content.options, [item.answer.optionId], ctx);
    const pictureIds = item.content.options.map((option) => option.picture.pictureId);
    if (new Set(pictureIds).size !== pictureIds.length) {
      ctx.addIssue({ code: "custom", path: ["content", "options"], message: "Một tranh xuất hiện hai lần" });
    }
  });

export const comprehensionItemSchema = z
  .strictObject({
    ...base,
    variant: z.literal("comprehension_question"),
    content: z.strictObject({ sentence: nfc, question: nfc, options: z.array(textOptionSchema) }),
    answer: z.strictObject({ optionId, distractorTags: distractorTagsSchema }),
  })
  .superRefine((item, ctx) => refineOptions(item.content.options, [item.answer.optionId], ctx));

export const arrangeWordsItemSchema = z
  .strictObject({
    ...base,
    variant: z.literal("arrange_words"),
    content: z.strictObject({ tokens: z.array(z.strictObject({ id: optionId, text: nfc })) }),
    answer: z.strictObject({
      sentence: nfc,
      /** Các thứ tự chấp nhận (theo chữ của thẻ). Mặc định chỉ thứ tự của câu gốc. */
      orders: z.array(z.array(nfc)).min(1),
    }),
  })
  .superRefine((item, ctx) => {
    const tokens = item.content.tokens;
    if (tokens.length < 3) {
      ctx.addIssue({ code: "custom", path: ["content", "tokens"], message: "Cần ít nhất 3 thẻ từ" });
    }
    if (new Set(tokens.map((token) => token.id)).size !== tokens.length) {
      ctx.addIssue({ code: "custom", path: ["content", "tokens"], message: "Mã thẻ từ bị trùng" });
    }
    const multiset = (texts: readonly string[]) => [...texts].sort().join("\u0000");
    const available = multiset(tokens.map((token) => token.text));
    for (const order of item.answer.orders) {
      if (multiset(order) !== available) {
        ctx.addIssue({
          code: "custom",
          path: ["answer", "orders"],
          message: "Thứ tự đáp án phải dùng đúng các thẻ từ",
        });
      }
    }
  });

export const sentenceReadingItemSchema = z.discriminatedUnion("variant", [
  sentencePictureItemSchema,
  comprehensionItemSchema,
  arrangeWordsItemSchema,
]);
export type SentenceReadingItem = z.infer<typeof sentenceReadingItemSchema>;
