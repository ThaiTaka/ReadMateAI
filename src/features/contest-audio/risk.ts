import type { ContestEntryKind, ContestRiskClass } from "./config.ts";

/**
 * Phân loại RỦI RO cách đọc của chữ/âm trong chế độ trình diễn. HÀM THUẦN, không đoán cách phát âm đúng — chỉ đánh dấu mục nào
 * không thể coi là an toàn nếu chưa ai kiểm chứng:
 *
 *  - `school_convention`: cách gọi phụ thuộc quy ước nhà trường (k, q, gi, gh, ng, ngh, qu, i, y, ă, â…) — docs/AUDIO_RECORDING_PLAN §3.
 *  - `single_character`: lời đọc chỉ có MỘT ký tự (a, e, ê, á, ớ…) — bộ tổng hợp tiếng nói có thể đọc như tên chữ cái nước ngoài.
 *  - `descriptive_label`: nhãn có từ mô tả ("kép") không phải âm đọc thuần.
 * Mục `needs_verification` vẫn được tạo và kiểm tra kỹ thuật, nhưng KHÔNG phát cho học sinh cho tới khi chủ dự án chủ động cho phép
 * (cờ `contest_audio_play_unverified`) — và khi phát, giao diện nói rõ cách đọc chưa được kiểm chứng.
 */

export type RiskReason = "school_convention" | "single_character" | "descriptive_label";

const LETTER_CONVENTION: ReadonlySet<string> = new Set(["k", "q", "y", "ă", "â", "i"]);
const PHONEME_CONVENTION: ReadonlySet<string> = new Set(["k", "q", "gi", "gh", "ng", "ngh", "qu", "i", "y", "ă", "â"]);

export type RiskInput = { kind: ContestEntryKind; unit: string; spoken: string };

export function classifyRisk(input: RiskInput): { riskClass: ContestRiskClass; reasons: RiskReason[] } {
  const reasons: RiskReason[] = [];
  const unit = input.unit.normalize("NFC");
  if (input.kind === "letter" && LETTER_CONVENTION.has(unit)) reasons.push("school_convention");
  if (input.kind === "phoneme" && PHONEME_CONVENTION.has(unit)) reasons.push("school_convention");
  if (input.kind === "letter" || input.kind === "phoneme") {
    // Đếm theo điểm mã: "á" (một chữ, một dấu) vẫn là một ký tự.
    if ([...input.spoken.normalize("NFC")].length === 1) reasons.push("single_character");
    if (/\bkép\b/iu.test(input.spoken)) reasons.push("descriptive_label");
  }
  return { riskClass: reasons.length > 0 ? "needs_verification" : "standard", reasons };
}
