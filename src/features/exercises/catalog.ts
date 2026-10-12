import type { ExerciseTypeCode, InstructionIcon, LearningPathId } from "@/types/learning";

/**
 * Danh mục sáu dạng bài MVP (docs/PRD.md §9).
 * Đây là siêu dữ liệu để hiển thị; bộ máy bài tập (lược đồ, chấm điểm, chính sách âm thanh)
 * sẽ được xây dựng theo từng dạng ở Giai đoạn 4 — xem docs/ARCHITECTURE.md §11.
 */
export type ExerciseTypeInfo = {
  code: ExerciseTypeCode;
  order: number;
  name: string;
  skill: string;
  paperEquivalent: string;
  icon: InstructionIcon;
  primaryPaths: readonly LearningPathId[];
};

export const EXERCISE_TYPES: readonly ExerciseTypeInfo[] = [
  {
    code: "letter_sound",
    order: 1,
    name: "Nhận diện chữ – âm",
    skill: "Nối âm với chữ ghi âm, nhận ra âm đầu của tiếng.",
    paperEquivalent: "Nhìn hình, khoanh chữ ghi âm đầu.",
    icon: "look",
    primaryPaths: ["khoi-dong", "vung-buoc"],
  },
  {
    code: "build_syllable",
    order: 2,
    name: "Ghép tiếng",
    skill: "Ghép âm đầu, vần và dấu thanh thành tiếng.",
    paperEquivalent: "Ghép rồi viết tiếng; nối âm với vần.",
    icon: "build",
    primaryPaths: ["khoi-dong", "vung-buoc"],
  },
  {
    code: "identify_unit",
    order: 3,
    name: "Tìm âm, vần, thanh trong tiếng",
    skill: "Phân tích tiếng: tìm âm đầu, vần, dấu thanh.",
    paperEquivalent: "Gạch chân tiếng có vần đã học.",
    icon: "choose",
    primaryPaths: ["vung-buoc"],
  },
  {
    code: "fill_blank",
    order: 4,
    name: "Điền âm, vần, dấu thanh",
    skill: "Chính tả và quy tắc ghép (c/k, g/gh, ng/ngh).",
    paperEquivalent: "Điền c hay k; điền vần còn thiếu.",
    icon: "fill",
    primaryPaths: ["vung-buoc", "tang-toc"],
  },
  {
    code: "word_picture",
    order: 5,
    name: "Đọc từ – chọn hình",
    skill: "Đọc trơn từ và hiểu nghĩa qua hình ảnh.",
    paperEquivalent: "Đọc rồi nối từ với hình.",
    icon: "read",
    primaryPaths: ["vung-buoc", "tang-toc"],
  },
  {
    code: "sentence_reading",
    order: 6,
    name: "Đọc câu – hiểu câu",
    skill: "Đọc hiểu câu ngắn, mở rộng vốn từ, sắp xếp câu.",
    paperEquivalent: "Đọc câu, khoanh hình đúng; sắp xếp từ thành câu.",
    icon: "arrange",
    primaryPaths: ["tang-toc"],
  },
];
