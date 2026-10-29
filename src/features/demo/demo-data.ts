import type { SupportLevel } from "@/types/learning";

/**
 * Dữ liệu minh họa HOÀN TOÀN GIẢ LẬP cho trang /demo.
 * Không chứa — và không bao giờ được chứa — thông tin của học sinh thật
 * (không tên, không kết quả, không thiết bị). Kiểm thử tests/unit/catalog.test.ts bảo vệ quy tắc này.
 *
 * Từ GĐ4, buổi luyện mẫu của từng lộ trình là bài tập THẬT do bộ máy sinh (xem practice-data.ts);
 * tệp này chỉ còn phần mô tả bốn mức hỗ trợ cho người lớn.
 */
export const DEMO_DATA_IS_FICTIONAL = true as const;

export type DemoSupportLevel = {
  level: SupportLevel;
  code: string;
  name: string;
  description: string;
};

/** Bốn mức hỗ trợ giảm dần (docs/PRD.md §11) — mô tả ngắn cho người lớn. */
export const DEMO_SUPPORT_LEVELS: readonly DemoSupportLevel[] = [
  { level: 3, code: "H3", name: "Hỗ trợ đầy đủ", description: "Tự đọc yêu cầu, có phần làm mẫu và gợi ý chủ động." },
  { level: 2, code: "H2", name: "Hỗ trợ một phần", description: "Chạm loa để nghe yêu cầu, gợi ý khi em cần." },
  {
    level: 1,
    code: "H1",
    name: "Hỗ trợ tối thiểu",
    description: "Gợi ý và trợ giúp chỉ khi em bấm; tối đa 2 lần trả lời.",
  },
  { level: 0, code: "H0", name: "Tự làm", description: "Em tự đọc, tự suy nghĩ và hoàn thành bài — không có gợi ý." },
];
