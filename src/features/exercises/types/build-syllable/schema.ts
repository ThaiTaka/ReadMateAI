import { z } from "zod";
import {
  distractorTagsSchema,
  itemBaseFields,
  nfc,
  optionId,
  pictureRefSchema,
  refineOptions,
  textOptionSchema,
  toneIdSchema,
  unitId,
} from "../../core/schemas.ts";

/**
 * Dạng 2 — Ghép tiếng (`build_syllable`, PRD §9.2).
 * - `picture_build` (mã hóa): nhìn tranh, chạm thẻ âm đầu → vần → dấu thanh; tiếng hiện dần.
 * - `parts_to_syllable` (giải mã): cho sẵn âm đầu + vần + thanh, chọn tiếng viết đúng.
 */

const base = { ...itemBaseFields, type: z.literal("build_syllable") };

export const tileSchema = z.strictObject({
  id: optionId,
  text: nfc,
  unit: unitId,
  /** Vị trí (trong chữ của thẻ vần) nhận dấu thanh — để giao diện hiện dần tiếng đang ghép. */
  markIndex: z.int().min(0).optional(),
});
export const toneTileSchema = z.strictObject({ id: optionId, tone: toneIdSchema, text: nfc, unit: unitId });
export type Tile = z.infer<typeof tileSchema>;
export type ToneTile = z.infer<typeof toneTileSchema>;

export const pictureBuildItemSchema = z
  .strictObject({
    ...base,
    variant: z.literal("picture_build"),
    content: z.strictObject({
      picture: pictureRefSchema,
      tiles: z.strictObject({
        onsets: z.array(tileSchema),
        rimes: z.array(tileSchema),
        tones: z.array(toneTileSchema),
      }),
    }),
    answer: z.strictObject({
      onset: optionId,
      rime: optionId,
      tone: optionId,
      /** Tiếng đúng (= tên tranh). */
      result: nfc,
      pictureName: nfc,
      distractorTags: distractorTagsSchema,
    }),
  })
  .superRefine((item, ctx) => {
    const { onsets, rimes, tones } = item.content.tiles;
    refineOptions(onsets, [item.answer.onset], ctx, "tiles.onsets");
    refineOptions(rimes, [item.answer.rime], ctx, "tiles.rimes");
    refineOptions(
      tones.map((tile) => ({ id: tile.id, text: tile.tone })),
      [item.answer.tone],
      ctx,
      "tiles.tones",
    );
    const ids = [...onsets, ...rimes, ...tones].map((tile) => tile.id);
    if (new Set(ids).size !== ids.length) {
      ctx.addIssue({ code: "custom", path: ["content", "tiles"], message: "Mã thẻ bị trùng giữa các nhóm" });
    }
  });

export const partsToSyllableItemSchema = z
  .strictObject({
    ...base,
    variant: z.literal("parts_to_syllable"),
    content: z.strictObject({
      parts: z.strictObject({ onset: nfc.nullable(), rime: nfc, tone: toneIdSchema, toneLabel: nfc }),
      options: z.array(textOptionSchema),
    }),
    answer: z.strictObject({ optionId, distractorTags: distractorTagsSchema }),
  })
  .superRefine((item, ctx) => refineOptions(item.content.options, [item.answer.optionId], ctx));

export const buildSyllableItemSchema = z.discriminatedUnion("variant", [
  pictureBuildItemSchema,
  partsToSyllableItemSchema,
]);
export type BuildSyllableItem = z.infer<typeof buildSyllableItemSchema>;
export type PictureBuildItem = z.infer<typeof pictureBuildItemSchema>;
