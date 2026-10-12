import type { Band, ExerciseTypeCode, LearningPathId, SupportLevel } from "@/types/learning";

/**
 * Ba lộ trình luyện tập, tương ứng ba nhóm năng lực linh hoạt (docs/PRD.md §10).
 * Tên lộ trình chỉ hiển thị cho người lớn; học sinh chỉ thấy nhiệm vụ của mình.
 */
export type LearningPath = {
  id: LearningPathId;
  band: Band;
  /** Cách gọi nhóm của giáo viên lớp 1A2 (chỉ hiển thị cho giáo viên). */
  teacherGroupLabel: string;
  name: string;
  tagline: string;
  description: string;
  focus: readonly string[];
  startingSupport: SupportLevel;
  exerciseTypes: readonly ExerciseTypeCode[];
};

export const LEARNING_PATHS: readonly LearningPath[] = [
  {
    id: "khoi-dong",
    band: "foundation",
    teacherGroupLabel: "Nhóm 3 – Cần hỗ trợ nền tảng",
    name: "Khởi động",
    tagline: "Làm quen chữ và âm",
    description: "Nhận diện chữ – âm, ghi nhớ và ghép tiếng theo từng bước nhỏ, ôn lặp lại thường xuyên.",
    focus: ["Nhận diện chữ và âm đã học", "Ghép tiếng từng bước", "Ôn lại vào đúng lúc"],
    startingSupport: 3,
    exerciseTypes: ["letter_sound", "build_syllable", "word_picture"],
  },
  {
    id: "vung-buoc",
    band: "developing",
    teacherGroupLabel: "Nhóm 2 – Đang phát triển",
    name: "Vững bước",
    tagline: "Ghép tiếng chắc chắn",
    description: "Luyện ghép tiếng, củng cố âm – vần, đọc chính xác và lưu loát hơn.",
    focus: ["Ghép và phân tích tiếng", "Củng cố âm – vần", "Đọc từ chính xác"],
    startingSupport: 2,
    exerciseTypes: ["build_syllable", "identify_unit", "fill_blank", "word_picture"],
  },
  {
    id: "tang-toc",
    band: "extending",
    teacherGroupLabel: "Nhóm 1 – Đọc tốt",
    name: "Tăng tốc",
    tagline: "Đọc hiểu và mở rộng",
    description: "Mở rộng vốn từ, đọc câu, đọc hiểu và đọc lưu loát.",
    focus: ["Mở rộng vốn từ", "Đọc hiểu câu ngắn", "Đọc lưu loát"],
    startingSupport: 1,
    exerciseTypes: ["fill_blank", "word_picture", "sentence_reading"],
  },
];
