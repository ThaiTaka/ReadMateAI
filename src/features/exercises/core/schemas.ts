import { z } from "zod";
import { isNFC } from "../../../lib/vietnamese/normalize.ts";
import { TONE_IDS } from "../../../lib/vietnamese/tone.ts";
import { OBJECTIVE_CODES, optionKey } from "./primitives.ts";

/**
 * Lược đồ zod dùng chung cho mọi dạng bài (docs/EXERCISE_ENGINE.md §3). Chỉ dùng ở phía máy chủ / lúc build
 * (bộ kiểm tra, bộ sinh) — phần chạy trên trình duyệt (runtime) không import tệp này để không kéo zod vào
 * bundle của học sinh. Kiểu TypeScript tương ứng được suy ra trong primitives.ts.
 *
 * Quy ước: một câu bài tập (`item`) tách `content` (phần học sinh nhìn thấy) khỏi `answer`
 * (đáp án, thẻ lỗi của phương án nhiễu) — giao diện chỉ nhận `content`, không tự biết đáp án.
 * Mọi chuỗi ở dạng NFC.
 */

export const nfc = z.string().min(1, "Không được để trống").refine(isNFC, { message: "Chuỗi phải ở dạng Unicode NFC" });

export const optionId = z.string().regex(/^[a-z][a-z0-9-]{0,15}$/u, "Mã phương án không hợp lệ");
export const unitId = z.string().regex(/^(letter|phoneme|rime|tone):\p{Ll}+$/u, "Mã đơn vị kiến thức không hợp lệ");
export const toneIdSchema = z.enum(TONE_IDS);

/** Phương án dạng chữ: chữ cái/âm, vần, tiếng, từ hoặc dấu thanh. */
export const textOptionSchema = z.strictObject({
  id: optionId,
  text: nfc,
  /** Đơn vị kiến thức mà phương án thể hiện (chữ, vần, thanh) — để kiểm tra "đã học". */
  unit: unitId.optional(),
  /** Với phương án dấu thanh: thanh tương ứng (để hiển thị dấu bằng hình). */
  tone: toneIdSchema.optional(),
});

/**
 * Tranh hiển thị cho học sinh: chỉ có mã tranh và mã biểu tượng, KHÔNG có tên tranh
 * (tên tranh thường chính là đáp án — xem TEXT_LEAKS_ANSWER).
 */
export const pictureRefSchema = z.strictObject({
  pictureId: z.string().regex(/^picture:[a-z0-9-]+$/u),
  iconKey: z.string().regex(/^[a-z0-9-]+$/u),
});

export const pictureOptionSchema = z.strictObject({ id: optionId, picture: pictureRefSchema });

/** Thẻ lỗi gắn với phương án nhiễu, ví dụ `confusion:b-d`, `spelling:c-k`, `distractor:other`. */
export const distractorTagsSchema = z.record(optionId, z.string().regex(/^[a-z]+:[\p{Ll}a-z0-9_-]+$/u));

export const objectiveSchema = z.strictObject({
  code: z.enum(OBJECTIVE_CODES),
  /** Đơn vị kiến thức trọng tâm (để ghép cặp bài ở nhà – bài ở lớp cùng mục tiêu). */
  focusUnits: z.array(unitId),
  /** Quy tắc chính tả trọng tâm (mã trong content/kb/rules.json), nếu có. */
  ruleIds: z.array(z.string().regex(/^[a-z]+\.[a-z_]+$/u)),
});

/**
 * Một "khe" âm thanh: lời sẽ được đọc (để bộ kiểm tra chống lộ đáp án soát trước cả khi có tệp)
 * và mã tệp âm thanh đã duyệt (`null` = chưa có tệp — GĐ6 mới sinh/ghi âm).
 */
export const audioSlotSchema = z.strictObject({ spokenText: nfc, assetId: z.string().min(1).nullable() });

export const itemAudioSchema = z.strictObject({
  instruction: audioSlotSchema,
  stimulus: audioSlotSchema.optional(),
  options: audioSlotSchema.optional(),
  model: audioSlotSchema.optional(),
  feedback: audioSlotSchema.optional(),
});

/** Nguồn ngữ liệu của câu — để chặn nội dung chưa duyệt ở chế độ học thật. */
export const itemSourceSchema = z.strictObject({
  corpusIds: z.array(z.string()),
  pictureIds: z.array(z.string()),
  fixtureIds: z.array(z.string()),
});

/** Trường chung của mọi câu bài tập. `type`/`variant`/`content`/`answer` do từng dạng bài khai báo. */
export const itemBaseFields = {
  id: z.string().regex(/^[a-z0-9_.:-]+$/u),
  schemaVersion: z.literal(1),
  objective: objectiveSchema,
  /** Độ khó ƯỚC LƯỢNG theo cấu tạo (1–5), chưa hiệu chỉnh bằng dữ liệu thật. */
  difficulty: z.int().min(1).max(5),
  /** Mọi đơn vị kiến thức học sinh cần để làm câu này. */
  requiredUnits: z.array(unitId),
  source: itemSourceSchema,
  audio: itemAudioSchema,
} as const;

export const choiceResponseSchema = z.strictObject({ kind: z.literal("choice"), optionId });
export const multiResponseSchema = z.strictObject({ kind: z.literal("multi"), optionIds: z.array(optionId) });
export const buildResponseSchema = z.strictObject({
  kind: z.literal("build"),
  onset: optionId.nullable(),
  rime: optionId.nullable(),
  tone: optionId.nullable(),
});
export const matchResponseSchema = z.strictObject({ kind: z.literal("match"), pairs: z.record(optionId, optionId) });
export const orderResponseSchema = z.strictObject({ kind: z.literal("order"), tokenIds: z.array(optionId) });

export const responseSchema = z.discriminatedUnion("kind", [
  choiceResponseSchema,
  multiResponseSchema,
  buildResponseSchema,
  matchResponseSchema,
  orderResponseSchema,
]);

/** Lỗi chung khi phương án trùng mã/trùng chữ hoặc đáp án không nằm trong danh sách phương án. */
export function refineOptions(
  options: ReadonlyArray<{ id: string; text?: string }>,
  answerIds: readonly string[],
  ctx: z.RefinementCtx,
  path: string = "options",
): void {
  if (options.length < 2) {
    ctx.addIssue({ code: "custom", path: ["content", path], message: "Cần ít nhất 2 phương án" });
  }
  const ids = new Set<string>();
  const texts = new Set<string>();
  for (const option of options) {
    if (ids.has(option.id)) {
      ctx.addIssue({ code: "custom", path: ["content", path], message: `Mã phương án trùng: ${option.id}` });
    }
    ids.add(option.id);
    if (option.text !== undefined) {
      const key = optionKey(option.text);
      if (texts.has(key)) {
        ctx.addIssue({ code: "custom", path: ["content", path], message: `Phương án trùng nội dung: ${option.text}` });
      }
      texts.add(key);
    }
  }
  if (answerIds.length === 0) {
    ctx.addIssue({ code: "custom", path: ["answer"], message: "Chưa khai báo đáp án" });
  }
  for (const answer of answerIds) {
    if (!ids.has(answer)) {
      ctx.addIssue({
        code: "custom",
        path: ["answer"],
        message: `Đáp án ${answer} không có trong danh sách phương án`,
      });
    }
  }
}
