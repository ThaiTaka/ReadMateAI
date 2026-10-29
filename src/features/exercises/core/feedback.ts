import { vi } from "../../../strings/vi.ts";
import type { GradeResult, HintView, RevealView } from "./primitives.ts";

/**
 * Phản hồi cho trẻ (PRD §6.2, quy tắc A5): khi còn lượt thử, phản hồi KHÔNG nói đáp án — chỉ nhắc
 * nhẹ nhàng nên xem lại phần nào; đáp án chỉ hiện khi hết lượt. Lời khen chọn theo thứ tự câu
 * (không ngẫu nhiên) để kết quả tái lập được.
 */

export type FeedbackTone = "correct" | "retry" | "reveal";

export type Feedback = {
  tone: FeedbackTone;
  title: string;
  message: string;
  /** Mã dòng giọng nói của lời này (features/audio-playback/feedback-lines.ts): đúng → lời khen; còn lượt → lời nhắc; hết lượt → tiêu đề xem đáp án. */
  audioRef: string;
  /** Chỉ có khi `tone === "reveal"` hoặc `"correct"` (câu đã chấm xong). */
  reveal: RevealView | null;
};

export type RetryCategory = keyof typeof vi.practice.feedback.retry;

/** Nhóm lời nhắc dựa trên dạng bài và thẻ lỗi — không dựa vào nội dung đáp án. */
export function retryCategory(variant: string, grade: GradeResult): RetryCategory {
  const tags = grade.errorTags;
  if (tags.includes("selection:missed") && tags.length === 1) return "missed";
  if (tags.includes("match:wrong_pair")) return "match";
  if (tags.includes("order:wrong")) return "order";
  switch (variant) {
    case "visual_match":
      return "shape";
    case "picture_onset":
    case "listen_letter":
      return "sound";
    case "picture_build":
      return "build";
    case "missing_onset":
      return "spelling";
    case "missing_rime":
    case "which_rime":
    case "find_with_unit":
      return "rime";
    case "missing_tone":
    case "which_tone":
      return "tone";
    case "choose_picture":
    case "sentence_picture":
    case "comprehension_question":
      return "reading";
    default:
      return "generic";
  }
}

export type FeedbackInput = {
  variant: string;
  grade: GradeResult;
  attemptNo: number;
  maxAttempts: number;
  /** Vị trí câu trong phiên (để chọn lời khen tái lập được). */
  position: number;
  reveal: RevealView;
};

export function feedbackFor(input: FeedbackInput): Feedback {
  const texts = vi.practice.feedback;
  if (input.grade.correct) {
    const titles = texts.correctTitles;
    return {
      tone: "correct",
      title: titles[input.position % titles.length] ?? titles[0],
      message: texts.correctMessage,
      audioRef: `correct_title_${(input.position % titles.length) + 1}`,
      reveal: input.reveal,
    };
  }
  if (input.attemptNo < input.maxAttempts) {
    const category = retryCategory(input.variant, input.grade);
    return {
      tone: "retry",
      title: texts.retryTitle,
      message: texts.retry[category],
      audioRef: `retry.${category}`,
      reveal: null,
    };
  }
  return {
    tone: "reveal",
    title: texts.revealTitle,
    message: texts.revealMessage,
    audioRef: "reveal_title",
    reveal: input.reveal,
  };
}

/** Mọi lời phản hồi có thể xuất hiện khi CÒN lượt thử — để bộ kiểm tra soát không chứa đáp án. */
export function retryFeedbackTexts(): string[] {
  return [vi.practice.feedback.retryTitle, ...Object.values(vi.practice.feedback.retry)];
}

/** Chữ của một bậc gợi ý (thay tham số vào mẫu câu trong src/strings/vi.ts). */
export function hintText(hint: HintView): string {
  const template: string = vi.practice.hints[hint.messageKey];
  return template.replace(/\{(\w+)\}/gu, (_match, key: string) => hint.params?.[key] ?? "");
}
