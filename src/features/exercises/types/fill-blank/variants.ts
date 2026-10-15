import { INSTRUCTION_RULES, NAMING_STIMULUS_RULES, NEVER, type VariantAudioPolicy } from "../../core/audio.ts";
import type { VariantDefinition } from "../../core/module.ts";

/** Định nghĩa biến thể của dạng 4 (điền âm, vần, dấu thanh): câu lệnh chuẩn, mục tiêu, chính sách âm thanh, bản phiếu. */

const SPELLING_POLICY: VariantAudioPolicy = {
  objectiveKind: "spelling",
  stimulusContent: "word",
  beforeGrading: { instruction: INSTRUCTION_RULES, stimulus: NAMING_STIMULUS_RULES, options: NEVER },
  modelAfterGrading: true,
  required: ["instruction"],
  rationale:
    "Kỹ năng chính tả (nghe – viết), không phải kỹ năng đọc: được nghe từ ở H3–H2, H1 khi bấm Trợ giúp, tắt ở H0. Không đọc các phương án.",
};

export const FILL_BLANK_VARIANTS = {
  missing_onset: {
    id: "missing_onset",
    type: "fill_blank",
    title: "Điền chữ còn thiếu (c/k, g/gh, ng/ngh)",
    objective: "apply_spelling_rule",
    objectiveDescription: "Áp dụng quy tắc chính tả c/k, g/gh, ng/ngh để viết đúng tiếng.",
    instruction: {
      icon: "fill",
      text: "Chọn chữ còn thiếu.",
      spoken: "Con chọn chữ còn thiếu để viết đúng tiếng nhé.",
    },
    audioPolicy: SPELLING_POLICY,
    paper: { supported: true, layout: "fill_in_blank", note: null },
    responseKind: "choice",
    recommendedBands: ["developing", "extending"],
  },
  missing_rime: {
    id: "missing_rime",
    type: "fill_blank",
    title: "Nhìn tranh – điền vần còn thiếu",
    objective: "distinguish_rime",
    objectiveDescription: "Phân biệt các vần gần nhau để viết đúng tên tranh.",
    instruction: {
      icon: "fill",
      text: "Nhìn hình. Chọn vần còn thiếu.",
      spoken: "Con nhìn hình rồi chọn vần còn thiếu nhé.",
    },
    audioPolicy: SPELLING_POLICY,
    paper: { supported: true, layout: "fill_in_blank", note: null },
    responseKind: "choice",
    recommendedBands: ["developing", "extending"],
  },
  missing_tone: {
    id: "missing_tone",
    type: "fill_blank",
    title: "Nhìn tranh – điền dấu thanh",
    objective: "distinguish_tone",
    objectiveDescription: "Phân biệt dấu thanh để viết đúng tên tranh.",
    instruction: {
      icon: "fill",
      text: "Nhìn hình. Chọn dấu thanh.",
      spoken: "Con nhìn hình rồi chọn dấu thanh đúng nhé.",
    },
    audioPolicy: SPELLING_POLICY,
    paper: { supported: true, layout: "fill_in_blank", note: null },
    responseKind: "choice",
    recommendedBands: ["developing", "extending"],
  },
} as const satisfies Record<string, VariantDefinition>;
