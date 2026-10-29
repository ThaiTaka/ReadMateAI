/**
 * Bộ câu NGHE THỬ (R10.3b2-P0; docs/AUDIO_ENGINE.md §15). Sáu câu ngắn lấy từ 34 lời đọc của danh mục tĩnh
 * (`catalog.ts`; unit test đối chiếu chữ từng câu với danh mục) và một câu chẩn đoán phát âm.
 *
 * Câu chẩn đoán KHÔNG phải học liệu: không nằm trong danh mục, không vào thư viện phát cho học sinh và không thay bản ghi
 * giáo viên (âm/vần đơn lẻ luôn do giáo viên ghi — PRD A7). Chỉ để nghe xem giọng máy xử lý dấu thanh ra sao.
 */

export type PocSentenceKind = "catalog" | "diagnostic";

export type PocSentence = {
  id: string;
  kind: PocSentenceKind;
  /** Mã mục trong danh mục lời đọc (chỉ khi `kind = catalog`). */
  catalogId: string | null;
  purpose: "instruction" | "feedback";
  text: string;
  /** Vì sao chọn câu này — hiển thị cho giáo viên trên trang so sánh. */
  why: string;
};

export const POC_CATALOG_SENTENCES: readonly PocSentence[] = [
  {
    id: "s1-picture-onset",
    kind: "catalog",
    catalogId: "instruction:picture_onset",
    purpose: "instruction",
    text: "Con nhìn hình rồi chọn chữ ghi âm đầu nhé.",
    why: "Câu hướng dẫn thường gặp, có nhiều dấu thanh khác nhau.",
  },
  {
    id: "s2-picture-build",
    kind: "catalog",
    catalogId: "instruction:picture_build",
    purpose: "instruction",
    text: "Con nhìn hình rồi ghép âm, vần và dấu thanh thành tiếng nhé.",
    why: "Câu dài nhất trong danh mục (60 ký tự): xem giọng ngắt nghỉ và giữ nhịp ra sao.",
  },
  {
    id: "s3-which-tone",
    kind: "catalog",
    catalogId: "instruction:which_tone",
    purpose: "instruction",
    text: "Con đọc tiếng rồi chọn dấu thanh của tiếng đó nhé.",
    why: "Có nhiều từ về âm thanh; xem giọng phát âm “thanh”, “tiếng”, “dấu”.",
  },
  {
    id: "s4-praise",
    kind: "catalog",
    catalogId: "feedback:correct_title_2",
    purpose: "feedback",
    text: "Con làm tốt lắm!",
    why: "Lời khen ngắn: xem giọng có vui, ấm áp mà không giả.",
  },
  {
    id: "s5-retry-short",
    kind: "catalog",
    catalogId: "feedback:retry.generic",
    purpose: "feedback",
    text: "Con thử lại nhé!",
    why: "Lời nhắc thử lại ngắn: cần nhẹ nhàng, không tạo cảm giác bị trách.",
  },
  {
    id: "s6-retry-sound",
    kind: "catalog",
    catalogId: "feedback:retry.sound",
    purpose: "feedback",
    text: "Con nói thật chậm rồi chọn lại nhé.",
    why: "Lời nhắc thử lại dài hơn, có từ “thật chậm”.",
  },
];

/** Một lần gọi duy nhất đọc bốn từ mẫu (FPT yêu cầu tối thiểu 3 ký tự mỗi yêu cầu nên không gửi từng từ rời). */
export const POC_DIAGNOSTIC_SENTENCES: readonly PocSentence[] = [
  {
    id: "d1-tone-words",
    kind: "diagnostic",
    catalogId: null,
    purpose: "instruction",
    text: "bà, bá, mẹ, nhà",
    why: "Chẩn đoán dấu huyền, sắc, nặng và âm “nh”. KHÔNG phải học liệu, không vào thư viện phát cho học sinh.",
  },
];

export const POC_SENTENCE_SETS = {
  catalog: POC_CATALOG_SENTENCES,
  diagnostic: POC_DIAGNOSTIC_SENTENCES,
} as const;
export type PocSentenceSet = keyof typeof POC_SENTENCE_SETS;

export const ALL_POC_SENTENCES: readonly PocSentence[] = [...POC_CATALOG_SENTENCES, ...POC_DIAGNOSTIC_SENTENCES];
