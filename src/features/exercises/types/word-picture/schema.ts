import { z } from "zod";
import {
  distractorTagsSchema,
  itemBaseFields,
  nfc,
  optionId,
  pictureOptionSchema,
  refineOptions,
} from "../../core/schemas.ts";

/**
 * Dạng 5 — Đọc từ – chọn/nối hình (`word_picture`, PRD §9.2). Đây là bài kiểm tra KỸ NĂNG ĐỌC thật sự:
 * không có âm thanh đọc từ hay tên tranh trước khi chấm, tranh không có chú thích chữ.
 * - `choose_picture`: đọc một từ, chọn 1 trong 2–4 tranh.
 * - `match_pairs`: nối 2–3 từ với 2–3 tranh (chạm từ rồi chạm tranh — không cần kéo thả).
 */

const base = { ...itemBaseFields, type: z.literal("word_picture") };
const pictureNamesSchema = z.record(optionId, nfc);

function refinePictures(
  pictures: ReadonlyArray<{ id: string; picture: { pictureId: string } }>,
  names: Record<string, string>,
  ctx: z.RefinementCtx,
): void {
  const pictureIds = pictures.map((option) => option.picture.pictureId);
  if (new Set(pictureIds).size !== pictureIds.length) {
    ctx.addIssue({ code: "custom", path: ["content"], message: "Một tranh xuất hiện hai lần" });
  }
  for (const option of pictures) {
    if (!names[option.id]) {
      ctx.addIssue({ code: "custom", path: ["answer", "pictureNames"], message: `Thiếu tên tranh của ${option.id}` });
    }
  }
}

export const choosePictureItemSchema = z
  .strictObject({
    ...base,
    variant: z.literal("choose_picture"),
    content: z.strictObject({ word: nfc, options: z.array(pictureOptionSchema) }),
    answer: z.strictObject({ optionId, pictureNames: pictureNamesSchema, distractorTags: distractorTagsSchema }),
  })
  .superRefine((item, ctx) => {
    refineOptions(item.content.options, [item.answer.optionId], ctx);
    refinePictures(item.content.options, item.answer.pictureNames, ctx);
  });

export const matchPairsItemSchema = z
  .strictObject({
    ...base,
    variant: z.literal("match_pairs"),
    content: z.strictObject({
      words: z.array(z.strictObject({ id: optionId, text: nfc })),
      pictures: z.array(pictureOptionSchema),
    }),
    answer: z.strictObject({ pairs: z.record(optionId, optionId), pictureNames: pictureNamesSchema }),
  })
  .superRefine((item, ctx) => {
    const { words, pictures } = item.content;
    refineOptions(words, Object.keys(item.answer.pairs), ctx, "words");
    refineOptions(pictures, Object.values(item.answer.pairs), ctx, "pictures");
    refinePictures(pictures, item.answer.pictureNames, ctx);
    if (words.length !== pictures.length) {
      ctx.addIssue({ code: "custom", path: ["content"], message: "Số từ phải bằng số tranh" });
    }
    const targets = Object.values(item.answer.pairs);
    if (Object.keys(item.answer.pairs).length !== words.length || new Set(targets).size !== targets.length) {
      ctx.addIssue({
        code: "custom",
        path: ["answer", "pairs"],
        message: "Mỗi từ phải nối với đúng một tranh khác nhau",
      });
    }
    const wordIds = new Set(words.map((word) => word.id));
    if (words.some((word) => pictures.some((picture) => picture.id === word.id)) || wordIds.size !== words.length) {
      ctx.addIssue({ code: "custom", path: ["content"], message: "Mã từ và mã tranh phải khác nhau" });
    }
  });

export const wordPictureItemSchema = z.discriminatedUnion("variant", [choosePictureItemSchema, matchPairsItemSchema]);
export type WordPictureItem = z.infer<typeof wordPictureItemSchema>;
