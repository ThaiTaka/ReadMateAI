import type { UnitId } from "../../../../lib/vietnamese/decodability.ts";
import type { KnowledgeBase } from "../../../knowledge/load.ts";
import { analyzeStrict, teachingLabelOf } from "../../core/checks.ts";
import type { AudioExposure, AudioForbiddenForm, TextExposure } from "../../core/leaks.ts";
import type { ExerciseTypeModule, ItemCheckContext } from "../../core/module.ts";
import { issue, type ValidationIssue } from "../../core/primitives.ts";
import type { WorksheetItem } from "../../core/worksheet.ts";
import { identifyUnitItemSchema, type IdentifyUnitItem } from "./schema.ts";
import { IDENTIFY_UNIT_VARIANTS } from "./variants.ts";
import { answerText, identifyUnitRuntime, reveal } from "./runtime.ts";

function validate(item: IdentifyUnitItem, ctx: ItemCheckContext): ValidationIssue[] {
  if (item.variant === "find_with_unit") {
    const issues: ValidationIssue[] = [];
    const expected: string[] = [];
    for (const option of item.content.options) {
      const checked = analyzeStrict(option.text, ctx);
      if (!checked.ok) {
        issues.push(...checked.issues);
        continue;
      }
      if (checked.analysis.rime === item.content.unitText) expected.push(option.id);
    }
    if (issues.length > 0) return issues;
    const declared = new Set(item.answer.optionIds);
    const same = expected.length === declared.size && expected.every((id) => declared.has(id));
    if (!same) {
      issues.push(
        issue(
          "ANSWER_MISMATCH",
          `Đáp án khai báo không khớp các tiếng có vần "${item.content.unitText}" theo bộ phân tích.`,
        ),
      );
    }
    if (item.content.unit !== `rime:${item.content.unitText}`) {
      issues.push(issue("CONTENT_INVALID", "Mã đơn vị không khớp vần hiển thị."));
    }
    return issues;
  }

  const checked = analyzeStrict(item.content.syllable, ctx);
  if (!checked.ok) return checked.issues;
  const { analysis } = checked;
  const expected =
    item.variant === "which_onset" ? analysis.onset : item.variant === "which_rime" ? analysis.rime : analysis.tone;
  const issues: ValidationIssue[] = [];
  if (expected === null) {
    return [issue("ANSWER_MISMATCH", `Tiếng "${item.content.syllable}" không có âm đầu.`)];
  }
  const matching = item.content.options.filter((option) =>
    item.variant === "which_tone" ? option.tone === expected : option.text === expected,
  );
  if (matching.length !== 1 || matching[0]?.id !== item.answer.optionId) {
    issues.push(
      issue(
        matching.length > 1 ? "AMBIGUOUS_ANSWER" : "ANSWER_MISMATCH",
        `Đáp án của "${item.content.syllable}" theo bộ phân tích là "${expected}".`,
      ),
    );
  }
  return issues;
}

function textExposure(item: IdentifyUnitItem): TextExposure {
  const definition = IDENTIFY_UNIT_VARIANTS[item.variant];
  const options = item.content.options.map((option) => ({ field: "option_label" as const, text: option.text }));
  if (item.variant === "find_with_unit") {
    const answers = item.content.options.filter((option) => item.answer.optionIds.includes(option.id));
    return {
      exposed: [
        { field: "instruction_text", text: definition.instruction.text },
        { field: "stimulus_text", text: item.content.unitText },
        ...options,
      ],
      forbidden: answers.map((option) => ({
        form: option.text,
        reason: "câu lệnh không được nêu tiếng cần chọn",
        allowedIn: ["option_label"] as const,
      })),
    };
  }
  return {
    exposed: [
      { field: "instruction_text", text: definition.instruction.text },
      { field: "stimulus_text", text: item.content.syllable },
      ...options,
    ],
    // Đáp án (âm/vần/dấu) nằm sẵn trong tiếng — đó là nhiệm vụ phân tích; chỉ cấm nêu đáp án ở chỗ khác.
    forbidden: [
      { form: answerText(item), reason: "chỉ được thấy đáp án trong các phương án", allowedIn: ["option_label"] },
    ],
  };
}

function audioExposure(item: IdentifyUnitItem, kb: KnowledgeBase): AudioExposure {
  if (item.variant === "find_with_unit") {
    return {
      forbidden: item.content.options
        .filter((option) => item.answer.optionIds.includes(option.id))
        .map((option) => ({ form: option.text, reason: "không đọc tiếng cần chọn trước khi chấm", allowedRoles: [] })),
    };
  }
  const answer = answerText(item);
  const forbidden: AudioForbiddenForm[] = [
    { form: answer, reason: "lời đọc không được nói đáp án", allowedRoles: [] },
    { form: item.content.syllable, reason: "câu lệnh không chứa tiếng cần phân tích", allowedRoles: ["stimulus"] },
  ];
  const label = item.variant === "which_onset" ? teachingLabelOf(kb, answer) : null;
  if (label && label !== item.content.syllable) {
    forbidden.push({ form: label, reason: "lời đọc không được phát âm đáp án", allowedRoles: [] });
  }
  return { forbidden };
}

function worksheet(item: IdentifyUnitItem): WorksheetItem {
  const choices = item.content.options.map((option) => option.text);
  if (item.variant === "find_with_unit") {
    return {
      layout: "underline_syllables",
      printed: { text: item.content.unitText, choices },
      answerKey: reveal(item).answerText,
    };
  }
  return {
    layout: "syllable_circle_unit",
    printed: {
      text: item.content.syllable,
      ...(item.variant === "which_tone"
        ? { toneChoices: item.content.options.flatMap((option) => (option.tone ? [option.tone] : [])) }
        : { choices }),
    },
    answerKey: answerText(item),
  };
}

export const identifyUnitModule: ExerciseTypeModule<IdentifyUnitItem> = {
  ...identifyUnitRuntime,
  itemSchema: identifyUnitItemSchema,
  validate,
  readingTexts: (item) =>
    item.variant === "find_with_unit" ? item.content.options.map((option) => option.text) : [item.content.syllable],
  displayUnits: (item): UnitId[] =>
    item.variant === "find_with_unit"
      ? [item.content.unit]
      : item.content.options.map((option) => option.unit).filter((unit): unit is UnitId => unit !== undefined),
  maxChoices: (item) => item.content.options.length,
  textExposure,
  audioExposure,
  worksheet,
};
