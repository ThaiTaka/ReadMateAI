import { ANALYSIS_STIMULUS_RULES, INSTRUCTION_RULES, NEVER, type VariantAudioPolicy } from "../../core/audio.ts";
import type { VariantDefinition } from "../../core/module.ts";

/** Định nghĩa biến thể của dạng 3 (tìm âm, vần, thanh): câu lệnh chuẩn, mục tiêu, chính sách âm thanh, bản phiếu. */

const ANALYSIS_POLICY: VariantAudioPolicy = {
  objectiveKind: "analysis",
  stimulusContent: "syllable",
  beforeGrading: { instruction: INSTRUCTION_RULES, stimulus: ANALYSIS_STIMULUS_RULES, options: NEVER },
  modelAfterGrading: true,
  required: ["instruction"],
  rationale:
    "Câu lệnh không chứa tiếng cần phân tích; đọc tiếng chỉ là gợi ý ở H3–H2 (tính là một lần gợi ý), tắt ở H1–H0. Không đọc các phương án.",
};

export const IDENTIFY_UNIT_VARIANTS = {
  which_onset: {
    id: "which_onset",
    type: "identify_unit",
    title: "Tìm âm đầu của tiếng",
    objective: "analyze_onset",
    objectiveDescription: "Phân tích tiếng: nhận ra âm đầu (kể cả chữ ghép như nh, ngh).",
    instruction: {
      icon: "choose",
      text: "Đọc tiếng. Chọn âm đầu.",
      spoken: "Con đọc tiếng rồi chọn âm đầu của tiếng đó nhé.",
    },
    audioPolicy: ANALYSIS_POLICY,
    paper: { supported: true, layout: "syllable_circle_unit", note: null },
    responseKind: "choice",
    recommendedBands: ["foundation", "developing"],
  },
  which_rime: {
    id: "which_rime",
    type: "identify_unit",
    title: "Tìm vần của tiếng",
    objective: "analyze_rime",
    objectiveDescription: "Phân tích tiếng: nhận ra vần, phân biệt vần gần nhau (an/ang…).",
    instruction: {
      icon: "choose",
      text: "Đọc tiếng. Chọn vần.",
      spoken: "Con đọc tiếng rồi chọn vần của tiếng đó nhé.",
    },
    audioPolicy: ANALYSIS_POLICY,
    paper: { supported: true, layout: "syllable_circle_unit", note: null },
    responseKind: "choice",
    recommendedBands: ["developing", "extending"],
  },
  which_tone: {
    id: "which_tone",
    type: "identify_unit",
    title: "Tìm dấu thanh của tiếng",
    objective: "analyze_tone",
    objectiveDescription: "Nhận ra dấu thanh của tiếng (phân biệt hỏi/ngã…).",
    instruction: {
      icon: "choose",
      text: "Đọc tiếng. Chọn dấu thanh.",
      spoken: "Con đọc tiếng rồi chọn dấu thanh của tiếng đó nhé.",
    },
    audioPolicy: ANALYSIS_POLICY,
    paper: { supported: true, layout: "syllable_circle_unit", note: null },
    responseKind: "choice",
    recommendedBands: ["developing"],
  },
  find_with_unit: {
    id: "find_with_unit",
    type: "identify_unit",
    title: "Chọn các tiếng có vần cho sẵn",
    objective: "find_unit_in_syllables",
    objectiveDescription: "Tìm mọi tiếng chứa một vần — bài có nhiều đáp án đúng.",
    instruction: {
      icon: "choose",
      text: "Chọn các tiếng có vần này.",
      spoken: "Con chọn tất cả các tiếng có vần cho sẵn nhé.",
    },
    audioPolicy: {
      ...ANALYSIS_POLICY,
      stimulusContent: "none",
      beforeGrading: { instruction: INSTRUCTION_RULES, stimulus: NEVER, options: NEVER },
      rationale: "Không đọc các tiếng (phương án) trước khi chấm; vần cần tìm hiển thị bằng chữ.",
    },
    paper: { supported: true, layout: "underline_syllables", note: null },
    responseKind: "multi",
    recommendedBands: ["developing", "extending"],
  },
} as const satisfies Record<string, VariantDefinition>;
