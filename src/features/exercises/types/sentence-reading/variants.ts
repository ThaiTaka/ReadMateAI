import { INSTRUCTION_RULES, NEVER, type VariantAudioPolicy } from "../../core/audio.ts";
import type { VariantDefinition } from "../../core/module.ts";

/** Định nghĩa biến thể của dạng 6 (đọc câu – hiểu câu): câu lệnh chuẩn, mục tiêu, chính sách âm thanh, bản phiếu. */

const READING_POLICY: VariantAudioPolicy = {
  objectiveKind: "reading",
  stimulusContent: "sentence",
  beforeGrading: { instruction: INSTRUCTION_RULES, stimulus: NEVER, options: NEVER },
  modelAfterGrading: true,
  required: ["instruction"],
  rationale:
    "Bài đọc hiểu: không đọc câu, câu hỏi hay các phương án trước khi chấm (A3); câu lệnh không chứa cụm từ nào của câu; sau khi chấm mới được nghe đọc mẫu.",
};

export const SENTENCE_READING_VARIANTS = {
  sentence_picture: {
    id: "sentence_picture",
    type: "sentence_reading",
    title: "Đọc câu – chọn tranh",
    objective: "read_sentence_meaning",
    objectiveDescription: "Tự đọc một câu ngắn và chọn tranh của sự vật được nói tới.",
    instruction: { icon: "read", text: "Đọc câu. Chọn hình đúng.", spoken: "Con đọc câu rồi chọn hình đúng nhé." },
    audioPolicy: READING_POLICY,
    paper: { supported: true, layout: "sentence_circle_picture", note: null },
    responseKind: "choice",
    recommendedBands: ["developing", "extending"],
  },
  comprehension_question: {
    id: "comprehension_question",
    type: "sentence_reading",
    title: "Đọc câu – trả lời câu hỏi",
    objective: "answer_literal_question",
    objectiveDescription: "Đọc hiểu câu ngắn: trả lời câu hỏi mà đáp án nằm ngay trong câu.",
    instruction: {
      icon: "read",
      text: "Đọc câu. Trả lời câu hỏi.",
      spoken: "Con đọc câu và câu hỏi rồi chọn câu trả lời đúng nhé.",
    },
    audioPolicy: READING_POLICY,
    paper: { supported: true, layout: "sentence_question_circle", note: null },
    responseKind: "choice",
    recommendedBands: ["extending"],
  },
  arrange_words: {
    id: "arrange_words",
    type: "sentence_reading",
    title: "Sắp xếp từ thành câu",
    objective: "build_sentence_order",
    objectiveDescription: "Đọc các từ và sắp xếp thành câu đúng (vận dụng).",
    instruction: {
      icon: "arrange",
      text: "Sắp xếp các từ thành câu.",
      spoken: "Con chạm vào từng từ theo thứ tự để tạo thành câu nhé.",
    },
    audioPolicy: READING_POLICY,
    paper: { supported: true, layout: "arrange_write_sentence", note: null },
    responseKind: "order",
    recommendedBands: ["developing", "extending"],
  },
} as const satisfies Record<string, VariantDefinition>;
