import type { SupportLevel } from "../../../types/learning.ts";
import type { AudioRole } from "./primitives.ts";
import { SUPPORT_POLICIES } from "./support.ts";

/**
 * Chính sách âm thanh theo MỤC TIÊU HỌC TẬP (docs/PRD.md §9.2, §12; docs/EXERCISE_ENGINE.md §5).
 *
 * Không có một quy tắc chống lộ đáp án chung cho mọi dạng bài:
 * - bài NGHE âm để chọn chữ: phát âm mục tiêu chính là nhiệm vụ → khe kích thích luôn được phát;
 * - bài ĐỌC (đọc từ, đọc câu): không bao giờ đọc hộ chữ/từ/câu cần đọc trước khi chấm (A3);
 * - bài ghép/điền từ tranh (mã hóa, chính tả): được nghe tên tranh khi hỗ trợ cao, tắt dần ở H1/H0.
 *
 * Ký hiệu: `allowed` được phát · `hint` chỉ phát khi trẻ chủ động bấm (tính là gợi ý) · `forbidden` không phát.
 * Sau khi câu đã chấm xong, âm thanh mẫu (`model`) được phát nếu chính sách cho phép (A4).
 */

export type AudioRule = "allowed" | "hint" | "forbidden";
export type LevelRules = Readonly<Record<SupportLevel, AudioRule>>;

export type ObjectiveKind = "visual" | "listening" | "encoding" | "decoding" | "analysis" | "spelling" | "reading";

export type StimulusContent = "none" | "phoneme" | "picture_name" | "syllable" | "word" | "sentence";

export type VariantAudioPolicy = {
  objectiveKind: ObjectiveKind;
  stimulusContent: StimulusContent;
  beforeGrading: Readonly<Record<"instruction" | "stimulus" | "options", LevelRules>>;
  /** Được phát âm thanh mẫu sau khi chấm. */
  modelAfterGrading: boolean;
  /** Khe bắt buộc có tệp âm thanh ĐÃ DUYỆT ở chế độ học thật. */
  required: readonly AudioRole[];
  /** Lý do của chính sách — hiển thị cho GV/tài liệu. */
  rationale: string;
};

const level = (h3: AudioRule, h2: AudioRule, h1: AudioRule, h0: AudioRule): LevelRules => ({
  3: h3,
  2: h2,
  1: h1,
  0: h0,
});

/** Câu lệnh: H3 tự phát, H2 chạm loa, H1 chỉ qua "Trợ giúp" (tính là gợi ý), H0 không phát (giống phiếu). */
export const INSTRUCTION_RULES = level("allowed", "allowed", "hint", "forbidden");
/** Tên tranh trong bài mã hóa/chính tả: H3–H2 được nghe, H1 khi bấm trợ giúp, H0 không (ở lớp trẻ tự gọi tên tranh). */
export const NAMING_STIMULUS_RULES = level("allowed", "allowed", "hint", "forbidden");
/** Kích thích là chính nhiệm vụ (nghe âm – chọn chữ): luôn phát. */
export const TASK_STIMULUS_RULES = level("allowed", "allowed", "allowed", "allowed");
/** Đọc tiếng để phân tích: chỉ là gợi ý ở H3–H2, tắt ở H1–H0. */
export const ANALYSIS_STIMULUS_RULES = level("hint", "hint", "forbidden", "forbidden");
export const NEVER = level("forbidden", "forbidden", "forbidden", "forbidden");

export type AudioDecision = {
  permitted: boolean;
  /** Phát khi trẻ chủ động bấm và được tính là một lần dùng gợi ý. */
  countsAsHint: boolean;
  /** Tự phát khi mở câu (chỉ khi được phép và mức hỗ trợ tự phát). */
  autoPlay: boolean;
};

/** Quyết định phát một khe âm thanh TRƯỚC khi chấm ở một mức hỗ trợ. */
export function decideBeforeGrading(
  policy: VariantAudioPolicy,
  role: "instruction" | "stimulus" | "options",
  supportLevel: SupportLevel,
): AudioDecision {
  const rule = policy.beforeGrading[role][supportLevel];
  if (rule === "forbidden") return { permitted: false, countsAsHint: false, autoPlay: false };
  const support = SUPPORT_POLICIES[supportLevel];
  const autoPlay =
    rule === "allowed" &&
    ((role === "instruction" && support.autoPlayInstruction) || (role === "stimulus" && support.autoPlayStimulus));
  return { permitted: true, countsAsHint: rule === "hint", autoPlay };
}

/** Quyết định phát một khe âm thanh SAU khi chấm (chỉ âm thanh mẫu và phản hồi). */
export function decideAfterGrading(policy: VariantAudioPolicy, role: AudioRole): boolean {
  if (role === "model") return policy.modelAfterGrading;
  return role === "feedback" || role === "instruction";
}

/** Khe nào bị cấm ở MỌI mức trước khi chấm — câu bài tập không được mang âm thanh cho khe đó. */
export function alwaysForbiddenRoles(policy: VariantAudioPolicy): Array<"instruction" | "stimulus" | "options"> {
  return (["instruction", "stimulus", "options"] as const).filter((role) =>
    Object.values(policy.beforeGrading[role]).every((rule) => rule === "forbidden"),
  );
}
