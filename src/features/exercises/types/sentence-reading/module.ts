import { toLowerVi } from "../../../../lib/vietnamese/normalize.ts";
import { containsForm, contiguousPhrases, type AudioExposure, type TextExposure } from "../../core/leaks.ts";
import { findPicture } from "../../core/media.ts";
import type { ExerciseTypeModule, ItemCheckContext } from "../../core/module.ts";
import { issue, type ValidationIssue } from "../../core/primitives.ts";
import type { WorksheetItem } from "../../core/worksheet.ts";
import { neutralPictureLabel } from "../word-picture/runtime.ts";
import { sentenceReadingItemSchema, type SentenceReadingItem } from "./schema.ts";
import { SENTENCE_READING_VARIANTS } from "./variants.ts";
import { joinTokens, optionText, PUNCTUATION, sentenceOf, sentenceReadingRuntime } from "./runtime.ts";

function validate(item: SentenceReadingItem, ctx: ItemCheckContext): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (item.variant === "sentence_picture") {
    const { sentence, options } = item.content;
    if (!containsForm(sentence, item.answer.keyword)) {
      issues.push(issue("ANSWER_NOT_IN_TEXT", `Từ "${item.answer.keyword}" không có trong câu "${sentence}".`));
    }
    for (const option of options) {
      const name = item.answer.pictureNames[option.id] ?? "";
      const asset = findPicture(ctx.media, option.picture.pictureId);
      if (asset && toLowerVi(asset.word) !== toLowerVi(name)) {
        issues.push(issue("ANSWER_MISMATCH", `Tên tranh "${name}" không khớp thư viện ("${asset.word}").`));
      }
      if (option.id === item.answer.optionId) {
        if (toLowerVi(name) !== toLowerVi(item.answer.keyword)) {
          issues.push(issue("ANSWER_MISMATCH", `Tranh đáp án "${name}" không thể hiện từ "${item.answer.keyword}".`));
        }
      } else if (containsForm(sentence, name)) {
        issues.push(issue("DISTRACTOR_IN_TEXT", `Tranh nhiễu "${name}" cũng được nói tới trong câu.`));
      }
    }
    return issues;
  }
  if (item.variant === "comprehension_question") {
    const { sentence } = item.content;
    for (const option of item.content.options) {
      const inText = containsForm(sentence, option.text);
      if (option.id === item.answer.optionId && !inText) {
        issues.push(issue("ANSWER_NOT_IN_TEXT", `Đáp án "${option.text}" không xác định được từ câu "${sentence}".`));
      }
      if (option.id !== item.answer.optionId && inText) {
        issues.push(
          issue("DISTRACTOR_IN_TEXT", `Phương án nhiễu "${option.text}" cũng có trong câu — đáp án không duy nhất.`),
        );
      }
    }
    if (!item.content.question.trim().endsWith("?")) {
      issues.push(issue("CONTENT_INVALID", "Câu hỏi phải kết thúc bằng dấu chấm hỏi.", "warning"));
    }
    return issues;
  }
  const first = item.answer.orders[0] ?? [];
  if (joinTokens(first) !== item.answer.sentence) {
    issues.push(
      issue(
        "ANSWER_MISMATCH",
        `Thứ tự đáp án ghép thành "${joinTokens(first)}", không phải "${item.answer.sentence}".`,
      ),
    );
  }
  const shown = item.content.tokens.map((token) => token.text);
  if (item.answer.orders.some((order) => order.join("\u0000") === shown.join("\u0000"))) {
    issues.push(issue("TEXT_LEAKS_ANSWER", "Các thẻ từ đang hiển thị đúng thứ tự của câu — chưa được xáo trộn."));
  }
  const words = shown.filter((text) => !PUNCTUATION.test(text)).map(toLowerVi);
  if (/[,;]/u.test(item.answer.sentence) || new Set(words).size !== words.length) {
    issues.push(
      issue(
        "ORDER_MAY_HAVE_ALTERNATIVES",
        "Câu có dấu phẩy hoặc từ lặp lại — có thể có nhiều thứ tự đúng chưa được khai báo.",
      ),
    );
  }
  return issues;
}

function textExposure(item: SentenceReadingItem): TextExposure {
  const definition = SENTENCE_READING_VARIANTS[item.variant];
  const instruction = { field: "instruction_text" as const, text: definition.instruction.text };
  if (item.variant === "sentence_picture") {
    return {
      exposed: [
        instruction,
        { field: "stimulus_text", text: item.content.sentence },
        ...item.content.options.map((_option, index) => ({
          field: "picture_label" as const,
          text: neutralPictureLabel(index),
        })),
      ],
      forbidden: Object.values(item.answer.pictureNames).map((name) => ({
        form: name,
        reason: "tên tranh không được hiện ngoài câu cần đọc",
        allowedIn: ["stimulus_text", "hint"] as const,
      })),
    };
  }
  if (item.variant === "comprehension_question") {
    return {
      exposed: [
        instruction,
        { field: "stimulus_text", text: item.content.sentence },
        { field: "question", text: item.content.question },
        ...item.content.options.map((option) => ({ field: "option_label" as const, text: option.text })),
      ],
      forbidden: [
        {
          form: optionText(item, item.answer.optionId),
          reason: "câu hỏi không được chứa sẵn câu trả lời",
          allowedIn: ["stimulus_text", "option_label"],
        },
      ],
    };
  }
  return {
    exposed: [
      instruction,
      ...item.content.tokens.map((token) => ({ field: "option_label" as const, text: token.text })),
    ],
    forbidden: [{ form: item.answer.sentence, reason: "câu hoàn chỉnh chính là đáp án", allowedIn: [] }],
  };
}

function audioExposure(item: SentenceReadingItem): AudioExposure {
  const sentence = sentenceOf(item);
  const forbidden: AudioExposure["forbidden"] = [
    { form: sentence, reason: "không đọc hộ câu cần đọc trước khi chấm (A3)", allowedRoles: [] },
    ...contiguousPhrases(sentence, 2).map((phrase) => ({
      form: phrase,
      reason: "lời đọc không được chứa cụm từ của câu cần đọc (A3)",
      allowedRoles: [] as const,
    })),
  ];
  if (item.variant === "comprehension_question") {
    forbidden.push(
      { form: item.content.question, reason: "trẻ tự đọc câu hỏi", allowedRoles: [] },
      { form: optionText(item, item.answer.optionId), reason: "lời đọc không được nói đáp án", allowedRoles: [] },
    );
  }
  if (item.variant === "sentence_picture") {
    for (const name of Object.values(item.answer.pictureNames)) {
      forbidden.push({ form: name, reason: "không đọc tên tranh trước khi chấm", allowedRoles: [] });
    }
  }
  return { forbidden };
}

function worksheet(item: SentenceReadingItem): WorksheetItem {
  if (item.variant === "sentence_picture") {
    return {
      layout: "sentence_circle_picture",
      printed: {
        text: item.content.sentence,
        pictureChoices: item.content.options.map((option) => option.picture),
      },
      answerKey: item.answer.keyword,
    };
  }
  if (item.variant === "comprehension_question") {
    return {
      layout: "sentence_question_circle",
      printed: {
        text: item.content.sentence,
        question: item.content.question,
        choices: item.content.options.map((option) => option.text),
      },
      answerKey: optionText(item, item.answer.optionId),
    };
  }
  return {
    layout: "arrange_write_sentence",
    printed: { tokens: item.content.tokens.map((token) => token.text), writeLine: true },
    answerKey: item.answer.sentence,
  };
}

export const sentenceReadingModule: ExerciseTypeModule<SentenceReadingItem> = {
  ...sentenceReadingRuntime,
  itemSchema: sentenceReadingItemSchema,
  validate,
  readingTexts: (item) =>
    item.variant === "comprehension_question"
      ? [item.content.sentence, item.content.question, ...item.content.options.map((option) => option.text)]
      : [sentenceOf(item)],
  displayUnits: () => [],
  maxChoices: (item) => (item.variant === "arrange_words" ? 0 : item.content.options.length),
  textExposure,
  audioExposure,
  worksheet,
};
