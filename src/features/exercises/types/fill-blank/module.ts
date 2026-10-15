import type { UnitId } from "../../../../lib/vietnamese/decodability.ts";
import { analyzeSyllable } from "../../../../lib/vietnamese/syllable.ts";
import { analyzeStrict, composeWithProfile, isWellFormed } from "../../core/checks.ts";
import type { AudioExposure, ForbiddenForm, TextExposure } from "../../core/leaks.ts";
import type { ExerciseTypeModule, ItemCheckContext } from "../../core/module.ts";
import { issue, type TextOption, type ValidationIssue } from "../../core/primitives.ts";
import type { WorksheetItem } from "../../core/worksheet.ts";
import { fillBlankItemSchema, type FillBlankItem } from "./schema.ts";
import { FILL_BLANK_VARIANTS } from "./variants.ts";
import { answerOption, fillBlankRuntime } from "./runtime.ts";

/** Tiếng ghép ra khi điền một phương án (`null` nếu không ghép được). */
export function filledSyllable(
  item: FillBlankItem,
  option: TextOption,
  ctx: Pick<ItemCheckContext, "kb" | "state">,
): string | null {
  const { before, after } = item.content.template;
  if (item.variant !== "missing_tone") return `${before}${option.text}${after}`;
  const parsed = analyzeSyllable(before, ctx.kb.inventory);
  if (parsed.status !== "ok" || option.tone === undefined) return null;
  return composeWithProfile({ onset: parsed.analysis.onset, rime: parsed.analysis.rime, tone: option.tone }, ctx);
}

export function templateDisplay(item: FillBlankItem): string {
  const { wordPrefix, before, after, wordSuffix } = item.content.template;
  return item.variant === "missing_tone"
    ? `${wordPrefix}${before}${wordSuffix}`
    : `${wordPrefix}${before}_${after}${wordSuffix}`;
}

function answerSyllable(item: FillBlankItem, ctx: Pick<ItemCheckContext, "kb" | "state">): string | null {
  const option = answerOption(item);
  return option ? filledSyllable(item, option, ctx) : null;
}

function validate(item: FillBlankItem, ctx: ItemCheckContext): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const { wordPrefix, wordSuffix } = item.content.template;
  const syllable = answerSyllable(item, ctx);
  if (syllable === null) return [issue("CONTENT_UNVERIFIED", "Không ghép chắc chắn được tiếng đáp án.")];
  if (`${wordPrefix}${syllable}${wordSuffix}` !== item.answer.result) {
    issues.push(
      issue(
        "ANSWER_MISMATCH",
        `Điền đáp án được "${wordPrefix}${syllable}${wordSuffix}", không phải "${item.answer.result}".`,
      ),
    );
  }
  const checked = analyzeStrict(syllable, ctx);
  if (!checked.ok) return [...issues, ...checked.issues];
  if (item.variant === "missing_onset" && checked.analysis.onset !== answerOption(item)?.text) {
    issues.push(issue("ANSWER_MISMATCH", `Âm đầu của "${syllable}" không phải phương án đáp án.`));
  }

  let wellFormed = 0;
  for (const option of item.content.options) {
    const candidate = filledSyllable(item, option, ctx);
    const ok = candidate !== null && isWellFormed(candidate, ctx.kb);
    if (ok) wellFormed += 1;
    if (option.id !== item.answer.optionId && candidate === syllable) {
      issues.push(issue("DISTRACTOR_IS_CORRECT", `Phương án "${option.text}" cũng ghép ra "${syllable}".`));
    }
    if (!ok && item.variant !== "missing_onset") {
      // Điền vần/dấu: mọi phương án phải ghép ra tiếng viết đúng, để trẻ chọn theo nghĩa (tranh), không theo lỗi.
      issues.push(
        issue("SPELLING_INVALID", `Phương án "${option.text}" ghép ra tiếng viết sai (${candidate ?? "?"}).`),
      );
    }
  }
  if (item.content.picture === null && wellFormed !== 1) {
    issues.push(
      issue(
        "AMBIGUOUS_ANSWER",
        `Không có tranh nhưng ${wellFormed} phương án ghép ra tiếng viết đúng — cần tranh/âm thanh để xác định đáp án.`,
      ),
    );
  }
  if (item.content.picture !== null && item.answer.pictureName !== item.answer.result) {
    issues.push(issue("ANSWER_MISMATCH", "Từ đáp án phải trùng tên tranh."));
  }
  return issues;
}

function forbiddenForms(item: FillBlankItem): ForbiddenForm[] {
  const answer = answerOption(item)?.text ?? "";
  const forms: ForbiddenForm[] = [{ form: item.answer.result, reason: "từ hoàn chỉnh chính là đáp án", allowedIn: [] }];
  if (item.answer.pictureName) {
    forms.push({ form: item.answer.pictureName, reason: "tên tranh chính là đáp án", allowedIn: [] });
  }
  // Gợi ý quy tắc chính tả nêu cả hai chữ (c và k…), nên chữ đáp án được phép xuất hiện trong gợi ý.
  forms.push({
    form: answer,
    reason: "chỉ được thấy đáp án trong các phương án",
    allowedIn: item.variant === "missing_onset" ? ["option_label", "hint"] : ["option_label"],
  });
  return forms;
}

function textExposure(item: FillBlankItem): TextExposure {
  const definition = FILL_BLANK_VARIANTS[item.variant];
  return {
    exposed: [
      { field: "instruction_text", text: definition.instruction.text },
      { field: "stimulus_text", text: templateDisplay(item) },
      ...item.content.options.map((option) => ({ field: "option_label" as const, text: option.text })),
    ],
    forbidden: forbiddenForms(item),
  };
}

function audioExposure(item: FillBlankItem): AudioExposure {
  const answer = answerOption(item)?.text ?? "";
  const forbidden: AudioExposure["forbidden"] = [
    { form: answer, reason: "lời đọc không được nói phương án đúng", allowedRoles: [] },
    { form: item.answer.result, reason: "chỉ khe kích thích được đọc từ (bài chính tả)", allowedRoles: ["stimulus"] },
  ];
  return { forbidden };
}

function worksheet(item: FillBlankItem): WorksheetItem {
  return {
    layout: "fill_in_blank",
    printed: {
      ...(item.content.picture ? { picture: item.content.picture } : {}),
      text: templateDisplay(item),
      ...(item.variant === "missing_tone"
        ? { toneChoices: item.content.options.flatMap((option) => (option.tone ? [option.tone] : [])) }
        : { choices: item.content.options.map((option) => option.text) }),
      writeLine: true,
    },
    answerKey: item.answer.result,
  };
}

export const fillBlankModule: ExerciseTypeModule<FillBlankItem> = {
  ...fillBlankRuntime,
  itemSchema: fillBlankItemSchema,
  validate,
  // Trẻ phải viết được cả từ → mọi đơn vị của từ hoàn chỉnh phải là đơn vị đã học.
  readingTexts: (item) => [item.answer.result],
  displayUnits: (item) =>
    item.content.options.map((option) => option.unit).filter((unit): unit is UnitId => unit !== undefined),
  maxChoices: (item) => item.content.options.length,
  textExposure,
  audioExposure,
  worksheet,
};
