import { INSTRUCTION_RULES, NAMING_STIMULUS_RULES, NEVER } from "../../core/audio.ts";
import type { VariantDefinition } from "../../core/module.ts";

/** Định nghĩa biến thể của dạng 2 (ghép tiếng): câu lệnh chuẩn, mục tiêu, chính sách âm thanh, bản phiếu. */

export const BUILD_SYLLABLE_VARIANTS = {
  picture_build: {
    id: "picture_build",
    type: "build_syllable",
    title: "Nhìn tranh – ghép tiếng",
    objective: "encode_syllable",
    objectiveDescription: "Ghép âm đầu, vần và dấu thanh thành tiếng là tên tranh (mã hóa).",
    instruction: {
      icon: "build",
      text: "Nhìn hình. Ghép tiếng.",
      spoken: "Con nhìn hình rồi ghép âm, vần và dấu thanh thành tiếng nhé.",
    },
    audioPolicy: {
      objectiveKind: "encoding",
      stimulusContent: "picture_name",
      beforeGrading: { instruction: INSTRUCTION_RULES, stimulus: NAMING_STIMULUS_RULES, options: NEVER },
      modelAfterGrading: true,
      required: ["instruction"],
      rationale:
        "Bài mã hóa (trẻ biết tên tranh, ghép ra chữ), không phải bài đọc: tên tranh được đọc ở H3–H2, H1 khi bấm Trợ giúp, tắt ở H0. Không đọc các thẻ.",
    },
    paper: { supported: true, layout: "picture_write_syllable", note: null },
    responseKind: "build",
    recommendedBands: ["foundation", "developing"],
  },
  parts_to_syllable: {
    id: "parts_to_syllable",
    type: "build_syllable",
    title: "Ghép các phần – chọn tiếng đúng",
    objective: "blend_syllable",
    objectiveDescription: "Ghép âm đầu, vần và thanh cho sẵn rồi nhận ra tiếng viết đúng (giải mã).",
    instruction: {
      icon: "build",
      text: "Ghép các phần. Chọn tiếng đúng.",
      spoken: "Con ghép âm, vần và dấu thanh rồi chọn tiếng đúng nhé.",
    },
    audioPolicy: {
      objectiveKind: "decoding",
      stimulusContent: "none",
      beforeGrading: { instruction: INSTRUCTION_RULES, stimulus: NEVER, options: NEVER },
      modelAfterGrading: true,
      required: ["instruction"],
      rationale:
        "Bài giải mã: không đọc tiếng kết quả hay các phương án trước khi chấm (A3) — trẻ phải tự ghép; chỉ nghe đọc mẫu sau khi chấm.",
    },
    paper: { supported: true, layout: "parts_circle_syllable", note: null },
    responseKind: "choice",
    recommendedBands: ["foundation", "developing"],
  },
} as const satisfies Record<string, VariantDefinition>;
