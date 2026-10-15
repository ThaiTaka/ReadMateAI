import type { UnitId } from "../../../lib/vietnamese/decodability.ts";
import type { ToneId } from "../../../lib/vietnamese/tone.ts";
import type { Band, ExerciseTypeCode, InstructionIcon, SupportLevel } from "../../../types/learning.ts";
import type { ContentMode } from "./content-mode.ts";
import type { ObjectiveCode, PictureRef } from "./primitives.ts";

/**
 * Biểu diễn bài tập dạng PHIẾU GIẤY (chuẩn bị cho GĐ8 — chưa dựng PDF).
 *
 * Mục tiêu: bài ở nhà có hướng dẫn → bài trên lớp cùng thao tác, nội dung mới → GV đánh giá khả năng
 * tự làm. Mỗi dạng bài chuyển một câu thành `WorksheetItem` (phần in cho học sinh + đáp án cho GV);
 * `ExerciseTaskContract` gói đủ 8 thông tin của hợp đồng dữ liệu (docs/EXERCISE_ENGINE.md §3.4).
 */

export type WorksheetLayout =
  | "picture_circle_letter"
  | "circle_same_letter"
  | "picture_write_syllable"
  | "parts_circle_syllable"
  | "syllable_circle_unit"
  | "underline_syllables"
  | "fill_in_blank"
  | "word_circle_picture"
  | "match_lines"
  | "sentence_circle_picture"
  | "sentence_question_circle"
  | "arrange_write_sentence";

export type WorksheetItem = {
  layout: WorksheetLayout;
  /** Phần in cho học sinh — không có đáp án. */
  printed: {
    picture?: PictureRef;
    text?: string;
    question?: string;
    choices?: string[];
    toneChoices?: ToneId[];
    pictureChoices?: PictureRef[];
    matchWords?: string[];
    tokens?: string[];
    /** Dòng kẻ để học sinh viết lại (tiếng, câu). */
    writeLine?: boolean;
  };
  /** Đáp án cho GV (in riêng, không in trên phiếu của học sinh). */
  answerKey: string;
};

export type WorksheetSection = {
  type: ExerciseTypeCode;
  variant: string;
  icon: InstructionIcon;
  /** Câu lệnh chuẩn — giống hệt câu lệnh trên ứng dụng (PRD P2). */
  instruction: string;
  paperSupported: boolean;
  note: string | null;
  items: WorksheetItem[];
};

export const DIFFICULTY_CAVEAT =
  "Độ khó là ước lượng theo cấu tạo tiếng/từ; chưa được kiểm chứng bằng dữ liệu thử nghiệm thực tế, nên không khẳng định hai bài tương đương hoàn toàn.";

export type ExerciseTaskContract = {
  contractVersion: 1;
  role: "home" | "classroom";
  learningObjective: { code: ObjectiveCode; description: string; focusUnits: UnitId[]; ruleIds: string[] };
  exerciseType: ExerciseTypeCode;
  variant: string;
  difficulty: { level: 1 | 2 | 3 | 4 | 5; mean: number; basis: "structural_estimate"; caveat: string };
  requiredKnowledge: UnitId[];
  /** Ở nhà: mức hỗ trợ đề xuất theo lộ trình; ở lớp: luôn H0 (tự làm). */
  supportLevel: SupportLevel;
  answerKey: Array<{ itemId: string; answer: string }>;
  worksheet: WorksheetSection;
  variantMetadata: {
    seed: string;
    generatorVersion: string;
    mode: ContentMode;
    profileId: string;
    band: Band;
    lessonOrdinal: number | null;
    itemIds: string[];
    sourceIds: string[];
  };
};
