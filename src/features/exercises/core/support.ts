import type { SupportLevel } from "../../../types/learning.ts";

/**
 * Bốn mức hỗ trợ H3 → H0 (docs/PRD.md §11). Mức hỗ trợ được theo dõi riêng cho từng học sinh ×
 * dạng bài; ở GĐ4 (bản chơi thử) mức hỗ trợ do người lớn chọn, chưa có luật tự lên/xuống bậc.
 *
 * Bảng này là NGUỒN DUY NHẤT về hành vi của từng mức — bộ chạy phiên và giao diện chỉ đọc bảng,
 * không tự quyết định.
 */

export type HintMode = "proactive" | "on_request" | "none";
/**
 * `guided`: khung nhiều màu, có minh họa hướng dẫn (H3, H2); `focused`: khung gọn, ít tín hiệu phụ để trẻ tự
 * tập trung (H1, H0). Từ R02 không còn bố cục "giống phiếu ở lớp" (AD-51) — chỉ đổi cách trình bày, logic giữ nguyên.
 */
export type SupportLayout = "guided" | "focused";

export type SupportPolicy = {
  level: SupportLevel;
  code: "H3" | "H2" | "H1" | "H0";
  name: string;
  /** Câu lệnh tự phát khi mở câu (H3). Ở H2 phát khi chạm loa; H1 qua nút "Trợ giúp" (tính là gợi ý). */
  autoPlayInstruction: boolean;
  /** Âm thanh kích thích (nếu chính sách của dạng bài cho phép) tự phát ở H3. */
  autoPlayStimulus: boolean;
  /** "Cô làm mẫu": xem một câu ví dụ đã giải trước câu đầu của dạng bài. */
  showWorkedExample: boolean;
  /**
   * `proactive`: sau mỗi lần sai, gợi ý bậc kế tiếp tự hiện (và trẻ vẫn có thể bấm "Gợi ý");
   * `on_request`: chỉ hiện khi trẻ bấm; `none`: không có gợi ý (trẻ tự làm).
   */
  hints: HintMode;
  /** Số lần trả lời tối đa cho một câu; hết lượt thì hiện đáp án (PRD §6.2, quy tắc A5). */
  maxAttempts: number;
  layout: SupportLayout;
};

export const SUPPORT_POLICIES: Readonly<Record<SupportLevel, SupportPolicy>> = {
  3: {
    level: 3,
    code: "H3",
    name: "Hỗ trợ đầy đủ",
    autoPlayInstruction: true,
    autoPlayStimulus: true,
    showWorkedExample: true,
    hints: "proactive",
    maxAttempts: 3,
    layout: "guided",
  },
  2: {
    level: 2,
    code: "H2",
    name: "Hỗ trợ một phần",
    autoPlayInstruction: false,
    autoPlayStimulus: false,
    showWorkedExample: false,
    hints: "on_request",
    maxAttempts: 3,
    layout: "guided",
  },
  1: {
    level: 1,
    code: "H1",
    name: "Hỗ trợ tối thiểu",
    autoPlayInstruction: false,
    autoPlayStimulus: false,
    showWorkedExample: false,
    hints: "on_request",
    maxAttempts: 2,
    layout: "focused",
  },
  0: {
    level: 0,
    code: "H0",
    /** Tên hiển thị tạm "Tự làm" (RQ-02 — chờ GV góp ý); thay cho "Thử như ở lớp" từ R02. */
    name: "Tự làm",
    autoPlayInstruction: false,
    autoPlayStimulus: false,
    showWorkedExample: false,
    hints: "none",
    maxAttempts: 1,
    layout: "focused",
  },
};

export const SUPPORT_LEVELS: readonly SupportLevel[] = [3, 2, 1, 0];

export function supportPolicy(level: SupportLevel): SupportPolicy {
  return SUPPORT_POLICIES[level];
}
