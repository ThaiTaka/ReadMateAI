/**
 * Kiểu dữ liệu học tập dùng chung (khớp docs/PRD.md và docs/DATA_MODEL.md).
 */

/** Nhóm năng lực trong mã: foundation = Nhóm 3, developing = Nhóm 2, extending = Nhóm 1. */
export type Band = "foundation" | "developing" | "extending";

/** Lộ trình luyện tập hiển thị cho người lớn (giáo viên, phụ huynh); học sinh không thấy tên lộ trình. */
export type LearningPathId = "khoi-dong" | "vung-buoc" | "tang-toc";

/** Mức hỗ trợ: 3 = đầy đủ … 0 = tự lực ("Thử như ở lớp"). */
export type SupportLevel = 0 | 1 | 2 | 3;

/** Sáu dạng bài MVP (PRD §9). */
export type ExerciseTypeCode =
  "letter_sound" | "build_syllable" | "identify_unit" | "fill_blank" | "word_picture" | "sentence_reading";

/** Biểu tượng hướng dẫn dùng chung giữa ứng dụng và phiếu học tập (PRD §5). */
export type InstructionIcon = "listen" | "look" | "choose" | "match" | "build" | "fill" | "arrange" | "read";
