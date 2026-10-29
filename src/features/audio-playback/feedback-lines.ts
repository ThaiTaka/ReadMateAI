/**
 * Lời phản hồi bằng giọng nói: dòng nào được phép phát ở trạng thái nào của câu. HÀM THUẦN, không phụ thuộc gì (dùng được ở cả máy chủ
 * lẫn trình duyệt).
 *
 * Mã dòng (`audioRef`) do `feedbackFor` (core/feedback.ts) đặt cùng chữ hiển thị trên khung phản hồi: `correct_title_1…3`, `retry.<nhóm>`,
 * `reveal_title`. Máy chủ KHÔNG tin trình duyệt về trạng thái câu: nó đối chiếu mã dòng với trạng thái thật của câu trong CSDL, nên
 * không thể xin lời "Đúng rồi!" cho câu chưa đúng, hay xin lời nhắc khi chưa trả lời. Lời phản hồi cố định không chứa đáp án (đã kiểm
 * khi dựng danh mục), nên chỉ cần khớp trạng thái.
 */

export type FeedbackQuestionState = { status: string; attemptsUsed: number };

const CORRECT = /^correct_title_[1-9]$/u;
const RETRY = /^retry\.[a-z]{1,20}$/u;

export function isFeedbackRef(ref: string): boolean {
  return CORRECT.test(ref) || RETRY.test(ref) || ref === "reveal_title";
}

export function feedbackRefAllowed(ref: string, question: FeedbackQuestionState): boolean {
  if (CORRECT.test(ref)) return question.status === "correct";
  if (RETRY.test(ref)) return question.status === "open" && question.attemptsUsed >= 1;
  if (ref === "reveal_title") return question.status === "exhausted";
  return false;
}
