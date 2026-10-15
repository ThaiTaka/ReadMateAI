import { toLowerVi } from "../../../../lib/vietnamese/normalize.ts";
import { containsForm, type AudioExposure, type TextExposure } from "../../core/leaks.ts";
import { findPicture } from "../../core/media.ts";
import type { ExerciseTypeModule, ItemCheckContext } from "../../core/module.ts";
import { issue, type ValidationIssue } from "../../core/primitives.ts";
import type { WorksheetItem } from "../../core/worksheet.ts";
import { wordPictureItemSchema, type WordPictureItem } from "./schema.ts";
import { WORD_PICTURE_VARIANTS } from "./variants.ts";
import { neutralPictureLabel, pictureEntries, wordPictureRuntime } from "./runtime.ts";

function validate(item: WordPictureItem, ctx: ItemCheckContext): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  for (const option of pictureEntries(item)) {
    const asset = findPicture(ctx.media, option.picture.pictureId);
    const name = item.answer.pictureNames[option.id];
    if (asset && name && toLowerVi(asset.word) !== toLowerVi(name)) {
      issues.push(issue("ANSWER_MISMATCH", `Tên tranh "${name}" không khớp thư viện ("${asset.word}").`));
    }
  }
  const names = Object.values(item.answer.pictureNames).map(toLowerVi);
  if (new Set(names).size !== names.length) {
    issues.push(issue("AMBIGUOUS_ANSWER", "Hai tranh có cùng tên gọi."));
  }
  if (item.variant === "choose_picture") {
    const word = item.content.word;
    for (const option of item.content.options) {
      const name = item.answer.pictureNames[option.id] ?? "";
      const isAnswer = option.id === item.answer.optionId;
      if (isAnswer && toLowerVi(name) !== toLowerVi(word)) {
        issues.push(issue("ANSWER_MISMATCH", `Tranh đáp án là "${name}", từ cần đọc là "${word}".`));
      }
      if (!isAnswer && (containsForm(word, name) || containsForm(name, word))) {
        issues.push(issue("DISTRACTOR_IS_CORRECT", `Tranh nhiễu "${name}" trùng một phần với từ "${word}".`));
      }
    }
    return issues;
  }
  for (const word of item.content.words) {
    const pictureOptionId = item.answer.pairs[word.id] ?? "";
    const name = item.answer.pictureNames[pictureOptionId] ?? "";
    if (toLowerVi(name) !== toLowerVi(word.text)) {
      issues.push(issue("ANSWER_MISMATCH", `Từ "${word.text}" được nối với tranh "${name}".`));
    }
  }
  const texts = item.content.words.map((word) => word.text);
  for (const text of texts) {
    if (texts.some((other) => other !== text && containsForm(other, text))) {
      issues.push(issue("AMBIGUOUS_ANSWER", `Từ "${text}" nằm trong một từ khác của bài.`));
    }
  }
  return issues;
}

function textExposure(item: WordPictureItem): TextExposure {
  const definition = WORD_PICTURE_VARIANTS[item.variant];
  const words = item.variant === "choose_picture" ? [item.content.word] : item.content.words.map((word) => word.text);
  return {
    exposed: [
      { field: "instruction_text", text: definition.instruction.text },
      ...words.map((text) => ({ field: "stimulus_text" as const, text })),
      ...pictureEntries(item).map((_option, index) => ({
        field: "picture_label" as const,
        text: neutralPictureLabel(index),
      })),
    ],
    // Từ cần đọc được phép hiển thị (đó là kích thích đọc) và được tách tiếng trong gợi ý;
    // tên tranh tuyệt đối không xuất hiện ở nhãn tranh hay câu lệnh.
    forbidden: Object.values(item.answer.pictureNames).map((name) => ({
      form: name,
      reason: "tên tranh không được hiện ngoài từ cần đọc (bài kiểm tra kỹ năng đọc)",
      allowedIn: ["stimulus_text", "hint"] as const,
    })),
  };
}

function audioExposure(item: WordPictureItem): AudioExposure {
  const words = item.variant === "choose_picture" ? [item.content.word] : item.content.words.map((word) => word.text);
  return {
    forbidden: [
      ...words.map((text) => ({ form: text, reason: "không đọc hộ từ cần đọc trước khi chấm (A3)", allowedRoles: [] })),
      ...Object.values(item.answer.pictureNames).map((name) => ({
        form: name,
        reason: "không đọc tên tranh trước khi chấm",
        allowedRoles: [],
      })),
    ],
  };
}

function worksheet(item: WordPictureItem): WorksheetItem {
  if (item.variant === "choose_picture") {
    return {
      layout: "word_circle_picture",
      printed: { text: item.content.word, pictureChoices: item.content.options.map((option) => option.picture) },
      answerKey: item.content.word,
    };
  }
  return {
    layout: "match_lines",
    printed: {
      matchWords: item.content.words.map((word) => word.text),
      pictureChoices: item.content.pictures.map((option) => option.picture),
    },
    answerKey: item.content.words
      .map((word, index) => `${index + 1}–${item.answer.pictureNames[item.answer.pairs[word.id] ?? ""] ?? ""}`)
      .join("; "),
  };
}

export const wordPictureModule: ExerciseTypeModule<WordPictureItem> = {
  ...wordPictureRuntime,
  itemSchema: wordPictureItemSchema,
  validate,
  readingTexts: (item) =>
    item.variant === "choose_picture" ? [item.content.word] : item.content.words.map((word) => word.text),
  displayUnits: () => [],
  maxChoices: (item) => pictureEntries(item).length,
  textExposure,
  audioExposure,
  worksheet,
};
