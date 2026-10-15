import { INSTRUCTION_RULES, NAMING_STIMULUS_RULES, NEVER, TASK_STIMULUS_RULES } from "../../core/audio.ts";
import type { VariantDefinition } from "../../core/module.ts";

/** Định nghĩa biến thể của dạng 1 (nhận diện chữ – âm): câu lệnh chuẩn, mục tiêu, chính sách âm thanh, bản phiếu. */

export const LETTER_SOUND_VARIANTS = {
  picture_onset: {
    id: "picture_onset",
    type: "letter_sound",
    title: "Nhìn tranh – chọn chữ ghi âm đầu",
    objective: "recognize_onset_letter",
    objectiveDescription: "Nhận ra âm đầu của tên tranh và chọn chữ ghi âm đó.",
    instruction: {
      icon: "look",
      text: "Nhìn hình. Chọn chữ ghi âm đầu.",
      spoken: "Con nhìn hình rồi chọn chữ ghi âm đầu nhé.",
    },
    audioPolicy: {
      objectiveKind: "encoding",
      stimulusContent: "picture_name",
      beforeGrading: { instruction: INSTRUCTION_RULES, stimulus: NAMING_STIMULUS_RULES, options: NEVER },
      modelAfterGrading: true,
      required: ["instruction"],
      rationale:
        "Mục tiêu là nhận ra âm đầu chứ không phải đọc chữ, nên tên tranh được đọc ở H3–H2 (H1 khi bấm Trợ giúp); ở H0 trẻ tự gọi tên tranh như khi làm phiếu. Không đọc các phương án vì khi đó trẻ chỉ cần so âm.",
    },
    paper: { supported: true, layout: "picture_circle_letter", note: null },
    responseKind: "choice",
    recommendedBands: ["foundation", "developing"],
  },
  visual_match: {
    id: "visual_match",
    type: "letter_sound",
    title: "Tìm chữ giống chữ mẫu",
    objective: "discriminate_letter_shape",
    objectiveDescription: "Phân biệt những chữ dễ nhầm hình dạng (b/d, m/n, n/u).",
    instruction: { icon: "look", text: "Tìm chữ giống chữ mẫu.", spoken: "Con tìm chữ giống chữ mẫu nhé." },
    audioPolicy: {
      objectiveKind: "visual",
      stimulusContent: "none",
      beforeGrading: { instruction: INSTRUCTION_RULES, stimulus: NEVER, options: NEVER },
      modelAfterGrading: true,
      required: ["instruction"],
      rationale:
        "Bài nhìn để phân biệt hình dạng chữ: không đọc tên chữ mẫu hay các phương án trước khi chấm, nếu không bài nhìn trở thành bài nghe.",
    },
    paper: { supported: true, layout: "circle_same_letter", note: null },
    responseKind: "choice",
    recommendedBands: ["foundation"],
  },
  listen_letter: {
    id: "listen_letter",
    type: "letter_sound",
    title: "Nghe âm – chọn chữ",
    objective: "map_sound_to_letter",
    objectiveDescription: "Liên hệ âm nghe được với chữ ghi âm.",
    instruction: { icon: "listen", text: "Nghe âm. Chọn chữ đúng.", spoken: "Con nghe âm rồi chọn chữ đúng nhé." },
    audioPolicy: {
      objectiveKind: "listening",
      stimulusContent: "phoneme",
      beforeGrading: { instruction: INSTRUCTION_RULES, stimulus: TASK_STIMULUS_RULES, options: NEVER },
      modelAfterGrading: true,
      required: ["instruction", "stimulus"],
      rationale:
        "Nghe âm là chính nhiệm vụ nên âm mục tiêu được phát ở mọi mức (kể cả H0) — đây không phải lộ đáp án. Âm đơn lẻ bắt buộc dùng bản ghi âm của GV đã duyệt (A7). Không đọc các phương án.",
    },
    paper: {
      supported: false,
      layout: null,
      note: "Chỉ có trên ứng dụng (cần nghe âm). Phiếu tương đương dùng biến thể Nhìn tranh – chọn chữ ghi âm đầu.",
    },
    responseKind: "choice",
    recommendedBands: ["foundation"],
  },
} as const satisfies Record<string, VariantDefinition>;
