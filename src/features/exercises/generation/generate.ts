import type { UnitId } from "../../../lib/vietnamese/decodability.ts";
import type { Band, ExerciseTypeCode } from "../../../types/learning.ts";
import { resolveKnowledgeState } from "../../knowledge/curriculum.ts";
import { profileGate, type ContentMode } from "../core/content-mode.ts";
import type { VariantId } from "../core/module.ts";
import type { ObjectiveCode, ValidationIssue } from "../core/primitives.ts";
import type { ExerciseItem } from "../items.ts";
import { VARIANTS } from "../registry.ts";
import { buildSyllableCandidates } from "../types/build-syllable/generate.ts";
import { fillBlankCandidates } from "../types/fill-blank/generate.ts";
import { identifyUnitCandidates } from "../types/identify-unit/generate.ts";
import { letterSoundCandidates } from "../types/letter-sound/generate.ts";
import { sentenceReadingCandidates } from "../types/sentence-reading/generate.ts";
import { wordPictureCandidates } from "../types/word-picture/generate.ts";
import { validateExerciseItem } from "../validation.ts";
import type { CandidateBuilder } from "./candidate.ts";
import { buildContext, type GenerationRequest } from "./context.ts";
import { createRng } from "./rng.ts";

/**
 * Bộ máy sinh biến thể bài tập theo quy tắc (không AI — ARCHITECTURE §11.4):
 *  1. chặn theo chế độ (demo chỉ hồ sơ minh họa; học thật chỉ hồ sơ đã xác nhận + nội dung đã duyệt);
 *  2. lấy ứng viên HỮU HẠN từ ngữ liệu đọc được bằng kiến thức đã học của nhóm;
 *  3. xáo thứ tự ứng viên bằng seed, dựng từng câu (phương án nhiễu từ cặp dễ nhầm, vị trí đáp án xáo);
 *  4. MỖI câu qua toàn bộ chuỗi kiểm tra — câu có lỗi bị loại và ghi lại lý do;
 *  5. không đủ câu hợp lệ → trả về thất bại kèm chẩn đoán, không nới quy tắc.
 */

export const GENERATOR_VERSION = "gd4.1";

const BUILDERS: Readonly<Record<ExerciseTypeCode, CandidateBuilder>> = {
  letter_sound: letterSoundCandidates,
  build_syllable: buildSyllableCandidates,
  identify_unit: identifyUnitCandidates,
  fill_blank: fillBlankCandidates,
  word_picture: wordPictureCandidates,
  sentence_reading: sentenceReadingCandidates,
};

export type ExerciseSet = {
  type: ExerciseTypeCode;
  variant: VariantId;
  items: ExerciseItem[];
  /** Khóa mục tiêu của từng câu (cùng thứ tự với `items`). */
  keys: string[];
  objective: { code: ObjectiveCode; focusUnits: UnitId[]; ruleIds: string[] };
  seed: string;
  generatorVersion: string;
  mode: ContentMode;
  profileId: string;
  band: Band;
  lessonOrdinal: number | null;
  /** Mọi câu chỉ để xem giao diện (thiếu âm thanh bắt buộc ở bản chơi thử). */
  previewOnly: boolean;
  /** Cảnh báo (không chặn) của các câu được chọn, đã gộp. */
  warnings: ValidationIssue[];
};

export type GenerationDiagnostics = {
  requested: number;
  produced: number;
  candidatesConsidered: number;
  candidatesFiltered: number;
  rejected: Array<{ key: string; codes: string[] }>;
  rejectedByCode: Record<string, number>;
  shortfall: string | null;
};

export type GenerationFailureCode =
  "PROFILE_NOT_CONFIRMED" | "DEMO_REQUIRES_ILLUSTRATIVE_PROFILE" | "PROFILE_NOT_USABLE" | "INSUFFICIENT_CONTENT";

export type GenerationResult =
  | { ok: true; set: ExerciseSet; diagnostics: GenerationDiagnostics }
  | { ok: false; code: GenerationFailureCode; message: string; diagnostics: GenerationDiagnostics };

function emptyDiagnostics(requested: number): GenerationDiagnostics {
  return {
    requested,
    produced: 0,
    candidatesConsidered: 0,
    candidatesFiltered: 0,
    rejected: [],
    rejectedByCode: {},
    shortfall: null,
  };
}

export function generateExerciseSet(request: GenerationRequest): GenerationResult {
  const diagnostics = emptyDiagnostics(request.count);
  const gate = profileGate(request.mode, request.profile);
  if (!gate.ok) return { ok: false, code: gate.code, message: gate.message, diagnostics };

  const resolved = resolveKnowledgeState(request.kb, request.profile, {
    band: request.band,
    ...(request.lessonOrdinal !== undefined ? { lessonOrdinal: request.lessonOrdinal } : {}),
  });
  if (!resolved.ok) {
    return { ok: false, code: "PROFILE_NOT_USABLE", message: resolved.message, diagnostics };
  }

  const definition = VARIANTS[request.variant];
  const ctx = buildContext(request, resolved.state);
  const all = BUILDERS[definition.type](ctx, request.variant);
  const candidates = all.filter((candidate) => {
    if (request.excludeKeys?.has(candidate.key)) return false;
    if (request.focusUnits && !candidate.focusUnits.some((unit) => request.focusUnits?.has(unit))) return false;
    if (
      request.difficulty &&
      Math.abs(candidate.difficulty - request.difficulty.target) > request.difficulty.tolerance
    ) {
      return false;
    }
    return true;
  });
  diagnostics.candidatesConsidered = all.length;
  diagnostics.candidatesFiltered = all.length - candidates.length;

  const order = createRng(`${request.seed}|${request.variant}|order`).shuffle(candidates);
  const items: ExerciseItem[] = [];
  const keys: string[] = [];
  const warnings: ValidationIssue[] = [];
  let previewOnly = false;

  for (const candidate of order) {
    if (items.length >= request.count) break;
    const raw = candidate.build(createRng(`${request.seed}|${request.variant}|${candidate.key}`));
    if (raw === null) {
      diagnostics.rejected.push({ key: candidate.key, codes: ["TOO_FEW_OPTIONS"] });
      continue;
    }
    const report = validateExerciseItem(raw, {
      kb: request.kb,
      profile: request.profile,
      band: request.band,
      ...(request.lessonOrdinal !== undefined ? { lessonOrdinal: request.lessonOrdinal } : {}),
      mode: request.mode,
      media: request.media,
      ...(request.fixtureReview ? { fixtureReview: request.fixtureReview } : {}),
      allowMissingRequiredAudio: request.mode === "demo" && request.allowPreviewOnly === true,
    });
    if (!report.ok || !report.item) {
      diagnostics.rejected.push({
        key: candidate.key,
        codes: Array.from(
          new Set(report.issues.filter((entry) => entry.severity === "error").map((entry) => entry.code)),
        ),
      });
      continue;
    }
    items.push(report.item);
    keys.push(candidate.key);
    previewOnly = previewOnly || report.previewOnly;
    for (const warning of report.issues) {
      if (!warnings.some((existing) => existing.code === warning.code)) warnings.push(warning);
    }
  }

  for (const rejection of diagnostics.rejected) {
    for (const code of rejection.codes) diagnostics.rejectedByCode[code] = (diagnostics.rejectedByCode[code] ?? 0) + 1;
  }
  diagnostics.produced = items.length;
  const minimum = request.minCount ?? request.count;
  if (items.length < request.count) {
    diagnostics.shortfall = `Chỉ tạo được ${items.length}/${request.count} câu hợp lệ cho "${definition.title}" từ ${all.length} ứng viên.`;
  }
  if (items.length < minimum) {
    return {
      ok: false,
      code: "INSUFFICIENT_CONTENT",
      message: diagnostics.shortfall ?? "Không đủ ngữ liệu hợp lệ.",
      diagnostics,
    };
  }

  const focusUnits = Array.from(new Set(items.flatMap((item) => item.objective.focusUnits)));
  const ruleIds = Array.from(new Set(items.flatMap((item) => item.objective.ruleIds)));
  return {
    ok: true,
    set: {
      type: definition.type,
      variant: request.variant,
      items,
      keys,
      objective: { code: definition.objective, focusUnits, ruleIds },
      seed: request.seed,
      generatorVersion: GENERATOR_VERSION,
      mode: request.mode,
      profileId: request.profile.id,
      band: request.band,
      lessonOrdinal: resolved.state.lessonOrdinal,
      previewOnly,
      warnings,
    },
    diagnostics,
  };
}
