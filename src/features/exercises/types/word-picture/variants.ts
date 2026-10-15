import { INSTRUCTION_RULES, NEVER, type VariantAudioPolicy } from "../../core/audio.ts";
import type { VariantDefinition } from "../../core/module.ts";

/** Định nghĩa biến thể của dạng 5 (đọc từ – chọn/nối hình): câu lệnh chuẩn, mục tiêu, chính sách âm thanh, bản phiếu. */

const READING_POLICY: VariantAudioPolicy = {
  objectiveKind: "reading",
  stimulusContent: "word",
  beforeGrading: { instruction: INSTRUCTION_RULES, stimulus: NEVER, options: NEVER },
  modelAfterGrading: true,
  required: ["instruction"],
  rationale:
    "Bài kiểm tra kỹ năng đọc thật sự: không đọc từ và không đọc tên tranh ở MỌI mức trước khi chấm (A3); gợi ý chỉ bằng hình ảnh; sau khi chấm mới được nghe đọc mẫu.",
};

export const WORD_PICTURE_VARIANTS = {
  choose_picture: {
    id: "choose_picture",
    type: "word_picture",
    title: "Đọc từ – chọn tranh",
    objective: "read_word_meaning",
    objectiveDescription: "Tự đọc trơn một từ và hiểu nghĩa qua tranh.",
    instruction: { icon: "read", text: "Đọc từ. Chọn hình đúng.", spoken: "Con đọc từ rồi chọn hình đúng nhé." },
    audioPolicy: READING_POLICY,
    paper: { supported: true, layout: "word_circle_picture", note: null },
    responseKind: "choice",
    recommendedBands: ["foundation", "developing", "extending"],
  },
  match_pairs: {
    id: "match_pairs",
    type: "word_picture",
    title: "Đọc từ – nối với tranh",
    objective: "read_word_meaning",
    objectiveDescription: "Tự đọc nhiều từ và nối mỗi từ với tranh đúng.",
    instruction: {
      icon: "match",
      text: "Đọc từ. Nối từ với hình.",
      spoken: "Con đọc từng từ rồi nối với hình đúng nhé.",
    },
    audioPolicy: READING_POLICY,
    paper: { supported: true, layout: "match_lines", note: null },
    responseKind: "match",
    recommendedBands: ["developing", "extending"],
  },
} as const satisfies Record<string, VariantDefinition>;
