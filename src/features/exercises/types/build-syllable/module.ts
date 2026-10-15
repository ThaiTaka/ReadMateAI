import type { UnitId } from "../../../../lib/vietnamese/decodability.ts";
import { analyzeStrict, composeWithProfile } from "../../core/checks.ts";
import type { AudioExposure, TextExposure } from "../../core/leaks.ts";
import type { ExerciseTypeModule, ItemCheckContext } from "../../core/module.ts";
import { issue, rimeUnitId, toneUnitId, type ValidationIssue } from "../../core/primitives.ts";
import type { WorksheetItem } from "../../core/worksheet.ts";
import { buildSyllableItemSchema, type BuildSyllableItem } from "./schema.ts";
import { BUILD_SYLLABLE_VARIANTS } from "./variants.ts";
import { answerOf, buildSyllableRuntime, partsText, tileText } from "./runtime.ts";

function validate(item: BuildSyllableItem, ctx: ItemCheckContext): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (item.variant === "picture_build") {
    if (item.answer.result !== item.answer.pictureName) {
      issues.push(issue("ANSWER_MISMATCH", "Tiếng đáp án phải là tên tranh."));
    }
    const checked = analyzeStrict(item.answer.pictureName, ctx);
    if (!checked.ok) return [...issues, ...checked.issues];
    const { analysis } = checked;
    const onset = tileText(item, item.answer.onset);
    const rime = tileText(item, item.answer.rime);
    const tone = item.content.tiles.tones.find((tile) => tile.id === item.answer.tone)?.tone;
    if (analysis.onset !== onset || analysis.rime !== rime || analysis.tone !== tone) {
      issues.push(
        issue("ANSWER_MISMATCH", `Các thẻ đáp án không ghép thành "${item.answer.pictureName}" theo bộ phân tích.`),
      );
    }
    // Đáp án duy nhất: trong MỌI tổ hợp thẻ, chỉ đúng một tổ hợp ghép ra tên tranh.
    let matches = 0;
    for (const onsetTile of item.content.tiles.onsets) {
      for (const rimeTile of item.content.tiles.rimes) {
        for (const toneTile of item.content.tiles.tones) {
          const text = composeWithProfile({ onset: onsetTile.text, rime: rimeTile.text, tone: toneTile.tone }, ctx);
          if (text === item.answer.pictureName) matches += 1;
        }
      }
    }
    if (matches !== 1) {
      issues.push(issue("AMBIGUOUS_ANSWER", `Có ${matches} tổ hợp thẻ ghép ra "${item.answer.pictureName}".`));
    }
    return issues;
  }

  const { onset, rime, tone } = item.content.parts;
  const composed = composeWithProfile({ onset, rime, tone }, ctx);
  if (composed === null) {
    return [issue("CONTENT_UNVERIFIED", `Không ghép chắc chắn được ${partsText(item)}.`)];
  }
  if (answerOf(item) !== composed) {
    issues.push(
      issue("ANSWER_MISMATCH", `${partsText(item)} ghép thành "${composed}", không phải "${answerOf(item)}".`),
    );
  }
  for (const option of item.content.options) {
    const checked = analyzeStrict(option.text, ctx);
    if (!checked.ok) issues.push(...checked.issues);
    if (option.id !== item.answer.optionId && option.text === composed) {
      issues.push(issue("DISTRACTOR_IS_CORRECT", `Phương án nhiễu "${option.text}" cũng là tiếng đúng.`));
    }
  }
  return issues;
}

function textExposure(item: BuildSyllableItem): TextExposure {
  const definition = BUILD_SYLLABLE_VARIANTS[item.variant];
  if (item.variant === "picture_build") {
    const { onsets, rimes, tones } = item.content.tiles;
    return {
      exposed: [
        { field: "instruction_text", text: definition.instruction.text },
        ...[...onsets, ...rimes, ...tones].map((tile) => ({ field: "option_label" as const, text: tile.text })),
      ],
      forbidden: [{ form: item.answer.pictureName, reason: "tên tranh chính là tiếng cần ghép", allowedIn: [] }],
    };
  }
  return {
    exposed: [
      { field: "instruction_text", text: definition.instruction.text },
      { field: "stimulus_text", text: partsText(item) },
      ...item.content.options.map((option) => ({ field: "option_label" as const, text: option.text })),
    ],
    forbidden: [
      { form: answerOf(item), reason: "chỉ được thấy tiếng đúng trong các phương án", allowedIn: ["option_label"] },
    ],
  };
}

function audioExposure(item: BuildSyllableItem): AudioExposure {
  if (item.variant === "picture_build") {
    return {
      forbidden: [
        { form: item.answer.pictureName, reason: "chỉ khe kích thích được đọc tên tranh", allowedRoles: ["stimulus"] },
      ],
    };
  }
  return {
    forbidden: [{ form: answerOf(item), reason: "không đọc tiếng kết quả trước khi chấm (A3)", allowedRoles: [] }],
  };
}

function worksheet(item: BuildSyllableItem): WorksheetItem {
  if (item.variant === "picture_build") {
    const { onsets, rimes, tones } = item.content.tiles;
    return {
      layout: "picture_write_syllable",
      printed: {
        picture: item.content.picture,
        choices: [...onsets, ...rimes].map((tile) => tile.text),
        toneChoices: tones.map((tile) => tile.tone),
        writeLine: true,
      },
      answerKey: item.answer.result,
    };
  }
  return {
    layout: "parts_circle_syllable",
    printed: { text: partsText(item), choices: item.content.options.map((option) => option.text) },
    answerKey: answerOf(item),
  };
}

export const buildSyllableModule: ExerciseTypeModule<BuildSyllableItem> = {
  ...buildSyllableRuntime,
  itemSchema: buildSyllableItemSchema,
  validate,
  readingTexts: (item) =>
    item.variant === "parts_to_syllable" ? item.content.options.map((option) => option.text) : [],
  displayUnits: (item): UnitId[] => {
    if (item.variant === "picture_build") {
      const { onsets, rimes, tones } = item.content.tiles;
      return [...onsets, ...rimes, ...tones].map((tile) => tile.unit);
    }
    const { onset, rime, tone } = item.content.parts;
    return [...(onset === null ? [] : [`phoneme:${onset}`]), rimeUnitId(rime), toneUnitId(tone)];
  },
  maxChoices: (item) =>
    item.variant === "picture_build"
      ? Math.max(item.content.tiles.onsets.length, item.content.tiles.rimes.length, item.content.tiles.tones.length)
      : item.content.options.length,
  textExposure,
  audioExposure,
  worksheet,
};
