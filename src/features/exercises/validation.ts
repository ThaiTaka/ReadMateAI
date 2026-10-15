import { inspectText } from "../../lib/vietnamese/normalize.ts";
import { syllableTokens, tokenize } from "../../lib/vietnamese/tokenize.ts";
import type { Band } from "../../types/learning.ts";
import { resolveKnowledgeState } from "../knowledge/curriculum.ts";
import type { KbFileKey, KnowledgeBase } from "../knowledge/load.ts";
import { checkReadability } from "../knowledge/readability.ts";
import type { CurriculumProfile, ReviewStatus } from "../knowledge/schema.ts";
import { BAND_CONSTRAINTS } from "./core/bands.ts";
import { checkUnitsTaught } from "./core/checks.ts";
import { profileGate, reviewAllowed, type ContentMode } from "./core/content-mode.ts";
import { hintText, retryFeedbackTexts } from "./core/feedback.ts";
import { checkAudioLeaks, checkTextLeaks } from "./core/leaks.ts";
import { findAudio, findPicture, type MediaLibrary } from "./core/media.ts";
import type { ItemCheckContext } from "./core/module.ts";
import { hasErrors, issue, type ValidationIssue } from "./core/primitives.ts";
import { exerciseItemSchema, type ExerciseItem } from "./items.ts";
import { moduleOf, variantOf } from "./registry.ts";

/**
 * Chuỗi kiểm tra một câu bài tập (ARCHITECTURE §11.3, điều chỉnh ở GĐ4 — docs/EXERCISE_ENGINE.md §5):
 *
 *  1. Lược đồ zod                         SCHEMA_INVALID
 *  2. Hồ sơ lớp hợp với chế độ             PROFILE_NOT_CONFIRMED
 *  3. Unicode NFC, ký tự lạ               NOT_NFC, TEXT_ISSUE
 *  4. Chỉ dùng điều đã học (bộ máy GĐ3)   CONTENT_NOT_TAUGHT, CONTENT_UNVERIFIED, CONTENT_INVALID, UNIT_NOT_TAUGHT
 *  5. Kiểm tra riêng của dạng bài          AMBIGUOUS_ANSWER, ANSWER_MISMATCH, DISTRACTOR_IS_CORRECT, …
 *  6. Chống lộ đáp án (chữ + âm thanh)    TEXT_LEAKS_ANSWER, AUDIO_LEAKS_ANSWER, AUDIO_ROLE_FORBIDDEN
 *  7. Tranh/âm thanh có nguồn và đã duyệt  MISSING_IMAGE, MISSING_AUDIO, AUDIO_NOT_AVAILABLE
 *  8. Trạng thái duyệt theo chế độ         CONTENT_NOT_APPROVED, DEMO_UNREVIEWED_CONTENT
 *  9. Ràng buộc theo nhóm                  BAND_CONSTRAINT
 *
 * `unknown` của bộ máy tiếng Việt luôn là LỖI — không bao giờ âm thầm coi là hợp lệ.
 */

export type ValidationContext = {
  kb: KnowledgeBase;
  profile: CurriculumProfile;
  band: Band;
  lessonOrdinal?: number;
  mode: ContentMode;
  media: MediaLibrary;
  /** Trạng thái duyệt của nội dung khai báo trong fixture (ví dụ câu hỏi đọc hiểu). */
  fixtureReview?: (fixtureId: string) => ReviewStatus | null;
  /**
   * Chỉ bản chơi thử: cho phép câu thiếu âm thanh BẮT BUỘC để xem giao diện (câu được đánh dấu
   * `previewOnly`, không chấm được). Không có tác dụng ở chế độ học thật.
   */
  allowMissingRequiredAudio?: boolean;
};

export type ValidationReport = {
  ok: boolean;
  item: ExerciseItem | null;
  issues: ValidationIssue[];
  /** Câu chỉ để xem giao diện (thiếu âm thanh bắt buộc ở bản chơi thử). */
  previewOnly: boolean;
};

/** Tệp dữ liệu tham chiếu mà bộ phân tích tiếng và bộ kiểm tra dựa vào. */
const REFERENCE_FILES = ["letters", "phonemes", "tones", "rimes", "rules"] as const satisfies readonly KbFileKey[];

function corpusReview(kb: KnowledgeBase, id: string): ReviewStatus | null {
  const all = [...kb.syllables, ...kb.words, ...kb.sentences];
  return all.find((entry) => entry.id === id)?.review.status ?? null;
}

function dedupe(issues: readonly ValidationIssue[]): ValidationIssue[] {
  const seen = new Set<string>();
  return issues.filter((entry) => {
    const key = `${entry.code}|${entry.severity}|${entry.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function isSentence(text: string): boolean {
  return tokenize(text).some((token) => token.kind === "punctuation" && /[.!?]/u.test(token.text));
}

export function validateExerciseItem(raw: unknown, ctx: ValidationContext): ValidationReport {
  const parsed = exerciseItemSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      item: null,
      previewOnly: false,
      issues: parsed.error.issues.map((entry) =>
        issue("SCHEMA_INVALID", `${entry.path.join(".") || "(câu)"}: ${entry.message}`),
      ),
    };
  }
  const item = parsed.data;
  const typeModule = moduleOf(item);
  const variant = variantOf(item);
  const issues: ValidationIssue[] = [];
  let previewOnly = false;

  if (variant.type !== item.type) {
    issues.push(issue("SCHEMA_INVALID", `Biến thể "${item.variant}" không thuộc dạng "${item.type}".`));
  }

  // 2. Hồ sơ lớp
  const gate = profileGate(ctx.mode, ctx.profile);
  if (!gate.ok) issues.push(issue("PROFILE_NOT_CONFIRMED", gate.message));
  const resolved = resolveKnowledgeState(ctx.kb, ctx.profile, {
    band: ctx.band,
    ...(ctx.lessonOrdinal !== undefined ? { lessonOrdinal: ctx.lessonOrdinal } : {}),
  });
  const checkCtx: ItemCheckContext = {
    kb: ctx.kb,
    profile: ctx.profile,
    band: ctx.band,
    lessonOrdinal: ctx.lessonOrdinal,
    state: resolved.ok ? resolved.state : null,
    mode: ctx.mode,
    media: ctx.media,
  };

  // 3. Văn bản hiển thị
  const exposure = typeModule.textExposure(item);
  const readingTexts = typeModule.readingTexts(item);
  for (const text of new Set([...exposure.exposed.map((entry) => entry.text), ...readingTexts])) {
    for (const problem of inspectText(text)) {
      issues.push(issue(problem.code === "NOT_NFC" ? "NOT_NFC" : "TEXT_ISSUE", `"${text}": ${problem.message}`));
    }
  }

  // 4. Chỉ dùng điều đã học
  const limits = BAND_CONSTRAINTS[ctx.band];
  for (const text of readingTexts) {
    const report = checkReadability(ctx.kb, text, {
      profile: ctx.profile,
      band: ctx.band,
      ...(ctx.lessonOrdinal !== undefined ? { lessonOrdinal: ctx.lessonOrdinal } : {}),
    });
    const why = report.reasons.map((reason) => reason.message).join(" ");
    if (report.verdict === "invalid") issues.push(issue("CONTENT_INVALID", `"${text}" viết sai: ${why}`));
    if (report.verdict === "not_yet_learned") {
      issues.push(
        issue("CONTENT_NOT_TAUGHT", `"${text}" có đơn vị chưa học: ${report.decoding.missingUnits.join(", ")}.`),
      );
    }
    if (report.verdict === "unknown") issues.push(issue("CONTENT_UNVERIFIED", `"${text}" chưa xác minh được: ${why}`));
    const syllables = syllableTokens(text).length;
    const limit = isSentence(text) ? limits.maxSentenceSyllables : limits.maxWordSyllables;
    if (syllables > limit) {
      issues.push(issue("BAND_CONSTRAINT", `"${text}" có ${syllables} tiếng, vượt giới hạn ${limit} tiếng của nhóm.`));
    }
  }
  issues.push(...checkUnitsTaught([...typeModule.displayUnits(item), ...item.requiredUnits], checkCtx));

  // 5. Kiểm tra riêng của dạng bài
  issues.push(...typeModule.validate(item, checkCtx));

  // 6. Chống lộ đáp án
  const hintExposure = typeModule.hints(item).map((hint) => ({ field: "hint" as const, text: hintText(hint) }));
  const feedbackExposure = retryFeedbackTexts().map((text) => ({ field: "feedback" as const, text }));
  issues.push(
    ...checkTextLeaks({
      exposed: [...exposure.exposed, ...hintExposure, ...feedbackExposure],
      forbidden: exposure.forbidden,
    }),
  );
  issues.push(...checkAudioLeaks(item.audio, variant.audioPolicy, typeModule.audioExposure(item, ctx.kb)));

  // 7. Tranh và âm thanh
  let unreviewed = false;
  for (const pictureId of item.source.pictureIds) {
    const asset = findPicture(ctx.media, pictureId);
    if (!asset) {
      issues.push(issue("MISSING_IMAGE", `Không tìm thấy tranh "${pictureId}" trong thư viện.`));
      continue;
    }
    if (!asset.source.license.trim()) {
      issues.push(issue("MISSING_IMAGE", `Tranh "${pictureId}" chưa ghi giấy phép.`));
    }
    if (!reviewAllowed(ctx.mode, asset.review.status)) {
      issues.push(issue("CONTENT_NOT_APPROVED", `Tranh "${pictureId}" chưa được duyệt (${asset.review.status}).`));
    } else if (asset.review.status !== "approved") {
      unreviewed = true;
    }
    if (ctx.mode === "production" && asset.scope !== "library") {
      issues.push(issue("CONTENT_NOT_APPROVED", `Tranh "${pictureId}" chỉ dành cho bản chơi thử.`));
    }
  }
  for (const role of variant.audioPolicy.required) {
    const slot = item.audio[role];
    const asset = slot?.assetId ? findAudio(ctx.media, slot.assetId) : undefined;
    const usable = asset !== undefined && reviewAllowed(ctx.mode, asset.review.status);
    if (usable) continue;
    if (ctx.mode === "production") {
      issues.push(issue("MISSING_AUDIO", `Thiếu âm thanh "${role}" đã duyệt.`));
    } else if (role === "instruction") {
      issues.push(
        issue("AUDIO_NOT_AVAILABLE", "Chưa có âm thanh câu lệnh — bản chơi thử hiển thị câu lệnh bằng chữ.", "warning"),
      );
    } else if (ctx.allowMissingRequiredAudio) {
      previewOnly = true;
      issues.push(
        issue(
          "MISSING_AUDIO",
          `Chưa có âm thanh "${role}" bắt buộc — chỉ xem giao diện, chưa làm bài được.`,
          "warning",
        ),
      );
    } else {
      issues.push(issue("MISSING_AUDIO", `Thiếu âm thanh "${role}" bắt buộc của dạng bài.`));
    }
  }

  // 8. Trạng thái duyệt của ngữ liệu và nội dung fixture
  for (const id of item.source.corpusIds) {
    const status = corpusReview(ctx.kb, id);
    if (status === null) {
      issues.push(issue("CONTENT_INVALID", `Ngữ liệu "${id}" không có trong kho tri thức.`));
    } else if (!reviewAllowed(ctx.mode, status)) {
      issues.push(issue("CONTENT_NOT_APPROVED", `Ngữ liệu "${id}" chưa được duyệt (${status}).`));
    } else if (status !== "approved") {
      unreviewed = true;
    }
  }
  for (const id of item.source.fixtureIds) {
    const status = ctx.fixtureReview?.(id) ?? null;
    if (status === null) {
      issues.push(issue("CONTENT_INVALID", `Nội dung "${id}" không được khai báo.`));
    } else if (!reviewAllowed(ctx.mode, status)) {
      issues.push(issue("CONTENT_NOT_APPROVED", `Nội dung "${id}" chưa được duyệt (${status}).`));
    } else if (status !== "approved") {
      unreviewed = true;
    }
  }
  // Dữ liệu tham chiếu (chữ, âm, thanh, vần, quy tắc) quyết định mọi kết luận "đã học"/"viết đúng":
  // chế độ học thật đòi hỏi GV đã duyệt các tệp này (duyệt cấp tệp — VIETNAMESE_ENGINE §8).
  for (const key of REFERENCE_FILES) {
    const status = ctx.kb.fileMeta[key].review.status;
    if (!reviewAllowed(ctx.mode, status)) {
      issues.push(issue("CONTENT_NOT_APPROVED", `Dữ liệu tham chiếu "${key}" chưa được duyệt (${status}).`));
    } else if (status !== "approved") {
      unreviewed = true;
    }
  }
  if (unreviewed) {
    issues.push(
      issue(
        "DEMO_UNREVIEWED_CONTENT",
        "Câu dùng nội dung chưa được giáo viên duyệt — chỉ hợp lệ trong bản chơi thử.",
        "warning",
      ),
    );
  }

  // 9. Ràng buộc theo nhóm
  const choices = typeModule.maxChoices(item);
  if (choices > limits.maxChoices) {
    issues.push(issue("BAND_CONSTRAINT", `${choices} phương án, vượt giới hạn ${limits.maxChoices} của nhóm.`));
  }

  const all = dedupe(issues);
  return { ok: !hasErrors(all), item, issues: all, previewOnly };
}
