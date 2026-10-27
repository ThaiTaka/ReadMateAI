import { decideAfterGrading, decideBeforeGrading, type VariantAudioPolicy } from "@/features/exercises/core/audio";
import type { SupportLevel } from "@/types/learning";
import type { PlaybackRole } from "./roles";

/**
 * Có được phát khe âm thanh này lúc này không (AD-35, PRD §12) — dùng lại CHÍNH `decideBeforeGrading`/`decideAfterGrading`
 * của bộ máy bài tập, không có logic thứ hai. HÀM THUẦN.
 *
 *  - `stimulus` (âm cần nghe): theo chính sách H3–H0 của biến thể TRƯỚC khi chấm. `allowed` → phát. `hint` (chỉ khi trẻ chủ
 *    động xin và được tính là gợi ý) → R10.3a từ chối vì chưa có đường ghi nhận "đã dùng gợi ý" (fail-closed).
 *  - `model` (đọc mẫu): chỉ SAU khi câu đã chấm xong (đúng hoặc hết lượt) và chính sách cho phép.
 * Nghe lại một lần nữa không phải là "làm xong câu": chấm điểm chỉ do câu trả lời được nộp, không do việc phát âm thanh.
 */

export type PlaybackDecision = { ok: true } | { ok: false; reason: "NOT_PERMITTED" | "HINT_ONLY" | "NOT_GRADED" };

export function decidePlayback(input: {
  policy: VariantAudioPolicy;
  role: PlaybackRole;
  supportLevel: SupportLevel;
  /** Câu đã đóng: đúng hoặc hết lượt. */
  graded: boolean;
}): PlaybackDecision {
  if (input.role === "model") {
    if (!input.graded) return { ok: false, reason: "NOT_GRADED" };
    return decideAfterGrading(input.policy, "model") ? { ok: true } : { ok: false, reason: "NOT_PERMITTED" };
  }
  const decision = decideBeforeGrading(input.policy, "stimulus", input.supportLevel);
  if (!decision.permitted) return { ok: false, reason: "NOT_PERMITTED" };
  if (decision.countsAsHint) return { ok: false, reason: "HINT_ONLY" };
  return { ok: true };
}
