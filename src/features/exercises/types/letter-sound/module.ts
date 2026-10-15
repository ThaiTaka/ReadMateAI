import type { UnitId } from "../../../../lib/vietnamese/decodability.ts";
import type { KnowledgeBase } from "../../../knowledge/load.ts";
import { analyzeStrict, teachingLabelOf } from "../../core/checks.ts";
import type { AudioExposure, AudioForbiddenForm, TextExposure } from "../../core/leaks.ts";
import type { ExerciseTypeModule, ItemCheckContext } from "../../core/module.ts";
import { issue, type ValidationIssue } from "../../core/primitives.ts";
import type { WorksheetItem } from "../../core/worksheet.ts";
import { letterSoundItemSchema, type LetterSoundItem } from "./schema.ts";
import { LETTER_SOUND_VARIANTS } from "./variants.ts";
import { answerText, letterSoundRuntime } from "./runtime.ts";

function validate(item: LetterSoundItem, ctx: ItemCheckContext): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const answer = answerText(item);
  const graphemes = new Set(ctx.kb.phonemes.map((phoneme) => phoneme.text));
  for (const option of item.content.options) {
    if (!graphemes.has(option.text)) {
      issues.push(issue("CONTENT_INVALID", `Phương án "${option.text}" không phải chữ ghi âm trong kho tri thức.`));
    }
  }
  if (item.variant === "picture_onset") {
    const name = item.answer.pictureName;
    if (name.includes(" ")) {
      issues.push(issue("AMBIGUOUS_ANSWER", `Tên tranh "${name}" có nhiều tiếng — âm đầu của tranh không rõ ràng.`));
      return issues;
    }
    const checked = analyzeStrict(name, ctx);
    if (!checked.ok) return [...issues, ...checked.issues];
    const onset = checked.analysis.onset;
    if (onset === null) {
      issues.push(issue("ANSWER_MISMATCH", `Tiếng "${name}" không có âm đầu.`));
    } else if (onset !== answer) {
      issues.push(issue("ANSWER_MISMATCH", `Âm đầu của "${name}" là "${onset}", nhưng đáp án là "${answer}".`));
    }
  } else if (item.variant === "visual_match") {
    if (answer !== item.content.sample) {
      issues.push(issue("ANSWER_MISMATCH", `Đáp án "${answer}" không giống chữ mẫu "${item.content.sample}".`));
    }
  }
  return issues;
}

function textExposure(item: LetterSoundItem): TextExposure {
  const definition = LETTER_SOUND_VARIANTS[item.variant];
  const exposed: TextExposure["exposed"] = [
    { field: "instruction_text", text: definition.instruction.text },
    ...item.content.options.map((option) => ({ field: "option_label" as const, text: option.text })),
  ];
  if (item.variant === "picture_onset") {
    return {
      exposed,
      forbidden: [{ form: item.answer.pictureName, reason: "tên tranh cho biết ngay âm đầu cần tìm", allowedIn: [] }],
    };
  }
  if (item.variant === "visual_match") {
    // Chữ mẫu chính là nhiệm vụ (so hình dạng) — hiển thị chữ mẫu không phải lộ đáp án.
    return { exposed: [...exposed, { field: "stimulus_text", text: item.content.sample }], forbidden: [] };
  }
  return {
    exposed,
    forbidden: [
      { form: answerText(item), reason: "câu lệnh không được nói chữ cần chọn", allowedIn: ["option_label"] },
    ],
  };
}

function audioExposure(item: LetterSoundItem, kb: KnowledgeBase): AudioExposure {
  const answer = answerText(item);
  const label = teachingLabelOf(kb, answer);
  if (item.variant === "listen_letter") {
    // Bài nghe: âm mục tiêu nằm trong khe kích thích là đúng mục tiêu; câu lệnh thì không được nói.
    const forbidden: AudioForbiddenForm[] = [
      { form: answer, reason: "câu lệnh không được nói chữ cần chọn", allowedRoles: ["stimulus"] },
    ];
    if (label)
      forbidden.push({ form: label, reason: "câu lệnh không được phát âm cần chọn", allowedRoles: ["stimulus"] });
    return { forbidden };
  }
  if (item.variant === "visual_match") {
    const forbidden: AudioForbiddenForm[] = [
      { form: item.content.sample, reason: "đọc tên chữ mẫu biến bài nhìn thành bài nghe", allowedRoles: [] },
    ];
    if (label)
      forbidden.push({ form: label, reason: "đọc âm của chữ mẫu biến bài nhìn thành bài nghe", allowedRoles: [] });
    return { forbidden };
  }
  const forbidden: AudioForbiddenForm[] = [
    { form: answer, reason: "lời đọc không được nói chữ đáp án", allowedRoles: [] },
    { form: item.answer.pictureName, reason: "chỉ khe kích thích được đọc tên tranh", allowedRoles: ["stimulus"] },
  ];
  // Khi tên tranh trùng cách gọi âm (tranh "cờ", âm "cờ"), quy tắc tên tranh ở trên đã bao trùm.
  if (label && label !== item.answer.pictureName) {
    forbidden.push({ form: label, reason: "lời đọc không được phát âm đáp án tách rời", allowedRoles: [] });
  }
  return { forbidden };
}

function worksheet(item: LetterSoundItem): WorksheetItem {
  const choices = item.content.options.map((option) => option.text);
  if (item.variant === "picture_onset") {
    return {
      layout: "picture_circle_letter",
      printed: { picture: item.content.picture, choices },
      answerKey: answerText(item),
    };
  }
  if (item.variant === "visual_match") {
    return {
      layout: "circle_same_letter",
      printed: { text: item.content.sample, choices },
      answerKey: answerText(item),
    };
  }
  return { layout: "circle_same_letter", printed: { choices }, answerKey: answerText(item) };
}

export const letterSoundModule: ExerciseTypeModule<LetterSoundItem> = {
  ...letterSoundRuntime,
  itemSchema: letterSoundItemSchema,
  validate,
  readingTexts: () => [],
  displayUnits: (item) =>
    item.content.options.map((option) => option.unit).filter((unit): unit is UnitId => unit !== undefined),
  maxChoices: (item) => item.content.options.length,
  textExposure,
  audioExposure,
  worksheet,
};
