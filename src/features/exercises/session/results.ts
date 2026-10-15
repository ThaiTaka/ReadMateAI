import type { SupportLevel } from "../../../types/learning.ts";
import { isDone, type SessionState } from "./session.ts";

/**
 * Kết quả buổi luyện (docs/EXERCISE_ENGINE.md §7). Ở bản chơi thử, kết quả CHỈ tồn tại trong bộ nhớ của
 * trang đang mở: không lưu server, không localStorage, không hồ sơ học sinh.
 *
 * Chỉ số nghiên cứu được chia hai nguồn: `app` (đo được trong ứng dụng, có giới hạn rõ ràng) và
 * `classroom_observation` (chỉ GV ghi nhận được ở lớp — ứng dụng KHÔNG suy ra từ điểm ở nhà và không
 * điền số liệu giả).
 */

export type ItemResult = {
  itemId: string;
  variant: string;
  supportLevel: SupportLevel;
  attempted: boolean;
  completed: boolean;
  correct: boolean;
  /** Đúng ngay lần đầu, không dùng gợi ý/trợ giúp nào trước đó. */
  independent: boolean;
  revealed: boolean;
  attempts: number;
  hintsUsed: number;
  helpRequests: number;
  durationMs: number | null;
};

export type ResearchIndicator = {
  id: "self_started" | "completed_without_hints" | "paper_transfer" | "teacher_reexplanations";
  question: string;
  source: "app" | "classroom_observation";
  /** `null` khi ứng dụng không đo được (phải ghi nhận ở lớp). */
  value: { numerator: number; denominator: number } | null;
  caveat: string;
};

export type SessionResult = {
  totalItems: number;
  gradableItems: number;
  attemptedItems: number;
  completedItems: number;
  correctItems: number;
  independentItems: number;
  revealedItems: number;
  /** Số lượt trả lời thêm sau lượt đầu. */
  retries: number;
  hintsUsed: number;
  helpRequests: number;
  supportLevels: SupportLevel[];
  /** completedItems / gradableItems (0–1). */
  completionRate: number;
  /** Thời gian từ lúc bắt đầu tới lúc xem kết quả, trừ thời gian trang bị ẩn — chỉ là ước lượng. */
  activeDurationMs: number | null;
  durationNote: string;
  items: ItemResult[];
  research: ResearchIndicator[];
};

export function summarizeSession(state: SessionState): SessionResult {
  const items: ItemResult[] = state.entries.map((entry, index) => {
    const progress = state.progress[index];
    const attempts = progress?.attempts ?? [];
    const first = attempts[0];
    const hintsUsed = (progress?.hintRequests ?? 0) + (progress?.proactiveHints ?? 0);
    const helpRequests = progress?.helpRequests ?? 0;
    return {
      itemId: entry.item.id,
      variant: entry.item.variant,
      supportLevel: entry.supportLevel,
      attempted: attempts.length > 0,
      completed: progress !== undefined && isDone(progress),
      correct: progress?.status === "correct",
      independent: first !== undefined && first.correct && first.hintsBefore === 0 && helpRequests === 0,
      revealed: progress?.status === "revealed",
      attempts: attempts.length,
      hintsUsed,
      helpRequests,
      durationMs:
        progress && progress.startedAt !== null && progress.completedAt !== null
          ? progress.completedAt - progress.startedAt
          : null,
    };
  });
  const gradable = state.entries.filter((entry) => !entry.previewOnly).length;
  const graded = items.filter((_item, index) => !state.entries[index]?.previewOnly);
  const completed = graded.filter((item) => item.completed).length;
  const attempted = graded.filter((item) => item.attempted);
  const selfStarted = state.progress.filter(
    (progress, index) => !state.entries[index]?.previewOnly && progress.actedBeforeHelp === true,
  ).length;
  const startedItems = state.progress.filter(
    (progress, index) => !state.entries[index]?.previewOnly && progress.actedBeforeHelp !== null,
  ).length;
  const noHints = graded.filter((item) => item.completed && item.hintsUsed + item.helpRequests === 0).length;
  const active =
    state.startedAt !== null && state.finishedAt !== null
      ? Math.max(0, state.finishedAt - state.startedAt - state.hiddenMs)
      : null;

  return {
    totalItems: items.length,
    gradableItems: gradable,
    attemptedItems: attempted.length,
    completedItems: completed,
    correctItems: graded.filter((item) => item.correct).length,
    independentItems: graded.filter((item) => item.independent).length,
    revealedItems: graded.filter((item) => item.revealed).length,
    retries: attempted.reduce((sum, item) => sum + Math.max(0, item.attempts - 1), 0),
    hintsUsed: graded.reduce((sum, item) => sum + item.hintsUsed, 0),
    helpRequests: graded.reduce((sum, item) => sum + item.helpRequests, 0),
    supportLevels: Array.from(new Set(state.entries.map((entry) => entry.supportLevel))).sort((a, b) => b - a),
    completionRate: gradable === 0 ? 0 : completed / gradable,
    activeDurationMs: active,
    durationNote:
      "Ước lượng từ lúc bấm Bắt đầu tới lúc xem kết quả, đã trừ thời gian chuyển sang tab khác; vẫn gồm lúc trẻ nghỉ hoặc người lớn giải thích.",
    items,
    research: [
      {
        id: "self_started",
        question: "Học sinh có tự bắt đầu nhiệm vụ không?",
        source: "app",
        value: { numerator: selfStarted, denominator: startedItems },
        caveat:
          "Đếm số câu trẻ tự chọn phương án trước khi bấm Gợi ý/Trợ giúp. Ứng dụng không biết người lớn có nhắc hay chỉ hộ hay không.",
      },
      {
        id: "completed_without_hints",
        question: "Học sinh có hoàn thành mà không cần gợi ý không?",
        source: "app",
        value: { numerator: noHints, denominator: gradable },
        caveat: "Bản chơi thử chưa có âm thanh, nên chưa đo được việc trẻ có cần nghe lại hướng dẫn hay không.",
      },
      {
        id: "paper_transfer",
        question: "Học sinh có làm đúng dạng bài tương tự khi chuyển sang phiếu giấy không?",
        source: "classroom_observation",
        value: null,
        caveat:
          "Chỉ ghi nhận được khi GV quan sát học sinh làm phiếu ở lớp (dự kiến GĐ8); không suy ra từ điểm bài ở nhà.",
      },
      {
        id: "teacher_reexplanations",
        question: "Giáo viên cần hướng dẫn lại bao nhiêu lần?",
        source: "classroom_observation",
        value: null,
        caveat: "Do GV tự ghi nhận ở lớp (mức tự lực: tự làm được / cần nhắc 1–2 lần / cần hướng dẫn riêng).",
      },
    ],
  };
}
