/**
 * Quy tắc "câu có còn quyền tính điểm không" và "lượt có hợp lệ không" (docs/GAMIFICATION_SPEC.md §4) —
 * HÀM THUẦN. Máy chủ quyết định khi phát câu; hàm CSDL kiểm tra lại trong giao dịch (chỉ mục duy nhất từng phần
 * `(season_id, student_id, content_fingerprint) where scorable` là bảo đảm cuối cùng).
 */

export type SeasonStatus = "active" | "closed";

export function isSeasonActive(season: { status: string } | null | undefined): boolean {
  return season?.status === "active";
}

/** Lý do một câu phát hành KHÔNG tính điểm (vẫn chấm, vẫn phản hồi — "Câu luyện thêm – Không tính điểm"). */
export type NotScorableReason =
  | "DEMO_MODE"
  | "NO_LEARNING_DATA_CONSENT"
  | "SEASON_NOT_ACTIVE"
  | "ALREADY_SCORED_IN_SEASON"
  | "PREVIEW_ONLY"
  | "WORKED_EXAMPLE";

export type ScorableInput = {
  mode: "demo" | "production";
  learningDataConsent: boolean;
  seasonActive: boolean;
  /** Nội dung (vân tay) đã từng được phát dạng tính điểm cho học sinh này trong mùa này. */
  alreadyScoredInSeason: boolean;
  previewOnly?: boolean;
  workedExample?: boolean;
};

export type ScorableDecision = { scorable: true; reason: null } | { scorable: false; reason: NotScorableReason };

/** Thứ tự kiểm tra cố định để lý do trả về tái lập được. */
export function scorableDecision(input: ScorableInput): ScorableDecision {
  if (input.mode !== "production") return { scorable: false, reason: "DEMO_MODE" };
  if (!input.learningDataConsent) return { scorable: false, reason: "NO_LEARNING_DATA_CONSENT" };
  if (!input.seasonActive) return { scorable: false, reason: "SEASON_NOT_ACTIVE" };
  if (input.workedExample) return { scorable: false, reason: "WORKED_EXAMPLE" };
  if (input.previewOnly) return { scorable: false, reason: "PREVIEW_ONLY" };
  if (input.alreadyScoredInSeason) return { scorable: false, reason: "ALREADY_SCORED_IN_SEASON" };
  return { scorable: true, reason: null };
}

export type QuestionStatus = "open" | "correct" | "exhausted" | "void";

export type AttemptGate =
  | { ok: true; attemptNo: number }
  | { ok: false; code: "SEASON_CLOSED" | "QUESTION_CLOSED" | "NO_ATTEMPTS_LEFT" | "DUPLICATE_RESPONSE" };

/**
 * Lượt hợp lệ (§4.1, phần không phụ thuộc phiên): mùa đang diễn ra, câu còn mở, còn lượt, câu trả lời khác mọi
 * câu trả lời trước của cùng câu (gửi lại đúng đáp án cũ không tốn lượt, không bị trừ).
 */
export function attemptGate(input: {
  seasonActive: boolean;
  status: QuestionStatus;
  attemptsUsed: number;
  maxAttempts: number;
  previousResponseKeys: readonly string[];
  responseKey: string;
}): AttemptGate {
  if (!input.seasonActive) return { ok: false, code: "SEASON_CLOSED" };
  if (input.status !== "open") return { ok: false, code: "QUESTION_CLOSED" };
  if (input.attemptsUsed >= input.maxAttempts) return { ok: false, code: "NO_ATTEMPTS_LEFT" };
  if (input.previousResponseKeys.includes(input.responseKey)) return { ok: false, code: "DUPLICATE_RESPONSE" };
  return { ok: true, attemptNo: input.attemptsUsed + 1 };
}

/** Trạng thái câu sau một lượt: đúng → đóng `correct`; sai và hết lượt → `exhausted`; còn lại vẫn `open`. */
export function statusAfterAttempt(correct: boolean, attemptNo: number, maxAttempts: number): QuestionStatus {
  if (correct) return "correct";
  return attemptNo >= maxAttempts ? "exhausted" : "open";
}
