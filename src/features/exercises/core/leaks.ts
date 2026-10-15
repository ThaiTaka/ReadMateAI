import { toLowerVi } from "../../../lib/vietnamese/normalize.ts";
import { tokenize } from "../../../lib/vietnamese/tokenize.ts";
import type { SupportLevel } from "../../../types/learning.ts";
import { decideBeforeGrading, type VariantAudioPolicy } from "./audio.ts";
import { issue, type AudioRole, type ItemAudio, type ValidationIssue } from "./primitives.ts";

/**
 * Chống lộ đáp án (PRD §12.1, A1–A6; ARCHITECTURE §11.3 bước 6).
 *
 * Mỗi dạng bài tự khai báo (theo mục tiêu học tập của nó):
 * - những chữ nào HIỂN THỊ / ĐƯỢC ĐỌC trước khi chấm (kể cả tên dành cho trình đọc màn hình),
 * - những "dạng đáp án" nào không được xuất hiện, và chỉ được phép xuất hiện ở trường nào.
 * Bộ kiểm tra ở đây chỉ so khớp — vì vậy cùng một chữ có thể hợp lệ ở bài này mà lộ đáp án ở bài khác
 * (ví dụ tiếng "bàn" là kích thích của bài tìm vần, nhưng tên tranh "cá" không được hiện ở bài nhìn tranh).
 *
 * So khớp: NFC, không phân biệt hoa thường, theo ranh giới tiếng (chuỗi tiếng liên tiếp), bỏ dấu câu.
 * "c" không khớp với "cá"; "cá" khớp với "Con cá bơi." .
 */

export type ExposureField =
  "prompt" | "instruction_text" | "stimulus_text" | "question" | "option_label" | "picture_label" | "hint" | "feedback";

export type ExposedText = { field: ExposureField; text: string };

export type ForbiddenForm = {
  form: string;
  /** Vì sao không được lộ (hiện trong báo cáo kiểm tra). */
  reason: string;
  /** Trường được phép chứa dạng này (ví dụ chính từ cần đọc nằm ở `stimulus_text`). */
  allowedIn: readonly ExposureField[];
};

export type TextExposure = { exposed: ExposedText[]; forbidden: ForbiddenForm[] };

export type AudioForbiddenForm = {
  form: string;
  reason: string;
  /** Khe âm thanh được phép chứa dạng này vì đó chính là nhiệm vụ (ví dụ bài nghe âm – chọn chữ). */
  allowedRoles: readonly AudioRole[];
};

export type AudioExposure = { forbidden: AudioForbiddenForm[] };

/** Chuỗi tiếng (chữ thường, NFC) của một văn bản; bỏ dấu câu, số, ký hiệu. */
export function syllableSequence(text: string): string[] {
  return tokenize(text)
    .filter((token) => token.kind === "syllable")
    .map((token) => toLowerVi(token.text));
}

/** `haystack` có chứa `form` như một chuỗi tiếng liên tiếp hay không. */
export function containsForm(haystack: string, form: string): boolean {
  const target = syllableSequence(form);
  if (target.length === 0) return false;
  const words = syllableSequence(haystack);
  for (let start = 0; start + target.length <= words.length; start += 1) {
    if (target.every((syllable, offset) => words[start + offset] === syllable)) return true;
  }
  return false;
}

/** Mọi chuỗi con liên tiếp ≥ `minLength` tiếng của một văn bản (dùng cho quy tắc A3 với câu). */
export function contiguousPhrases(text: string, minLength: number): string[] {
  const words = syllableSequence(text);
  const phrases: string[] = [];
  for (let size = Math.max(1, minLength); size <= words.length; size += 1) {
    for (let start = 0; start + size <= words.length; start += 1) {
      phrases.push(words.slice(start, start + size).join(" "));
    }
  }
  return phrases;
}

export function checkTextLeaks(exposure: TextExposure): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const seen = new Set<string>();
  for (const forbidden of exposure.forbidden) {
    for (const exposed of exposure.exposed) {
      if (forbidden.allowedIn.includes(exposed.field)) continue;
      if (!containsForm(exposed.text, forbidden.form)) continue;
      const key = `${forbidden.form}|${exposed.field}`;
      if (seen.has(key)) continue;
      seen.add(key);
      issues.push(
        issue(
          "TEXT_LEAKS_ANSWER",
          `Chữ hiển thị ở "${exposed.field}" ("${exposed.text}") chứa "${forbidden.form}" — ${forbidden.reason}.`,
        ),
      );
    }
  }
  return issues;
}

const BEFORE_GRADING_ROLES = ["instruction", "stimulus", "options"] as const;
const LEVELS: readonly SupportLevel[] = [3, 2, 1, 0];

/**
 * Soát lời đọc của các khe âm thanh có thể phát TRƯỚC khi chấm (ở bất kỳ mức hỗ trợ nào mà chính sách
 * cho phép). Âm thanh mẫu sau khi chấm không bị soát (A4). Câu mang âm thanh cho khe mà chính sách cấm ở
 * mọi mức cũng bị chặn — để không thể vô tình phát.
 */
export function checkAudioLeaks(
  audio: ItemAudio,
  policy: VariantAudioPolicy,
  exposure: AudioExposure,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  for (const role of BEFORE_GRADING_ROLES) {
    const slot = audio[role];
    if (!slot) continue;
    const permittedLevels = LEVELS.filter((supportLevel) => decideBeforeGrading(policy, role, supportLevel).permitted);
    if (permittedLevels.length === 0) {
      issues.push(
        issue(
          "AUDIO_ROLE_FORBIDDEN",
          `Dạng bài này không được phát âm thanh "${role}" trước khi chấm, nhưng câu lại khai báo lời đọc "${slot.spokenText}".`,
        ),
      );
      continue;
    }
    for (const forbidden of exposure.forbidden) {
      if (forbidden.allowedRoles.includes(role)) continue;
      if (!containsForm(slot.spokenText, forbidden.form)) continue;
      issues.push(
        issue(
          "AUDIO_LEAKS_ANSWER",
          `Lời đọc "${role}" ("${slot.spokenText}") chứa "${forbidden.form}" và có thể phát trước khi chấm ở mức ${permittedLevels
            .map((supportLevel) => `H${supportLevel}`)
            .join(", ")} — ${forbidden.reason}.`,
        ),
      );
    }
  }
  if (audio.model && !policy.modelAfterGrading) {
    issues.push(issue("AUDIO_ROLE_FORBIDDEN", "Dạng bài này không dùng âm thanh mẫu sau khi chấm."));
  }
  return issues;
}
