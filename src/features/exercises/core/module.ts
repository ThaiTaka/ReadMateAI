import type { z } from "zod";
import type { UnitId } from "../../../lib/vietnamese/decodability.ts";
import type { KnowledgeState } from "../../knowledge/curriculum.ts";
import type { KnowledgeBase } from "../../knowledge/load.ts";
import type { CurriculumProfile } from "../../knowledge/schema.ts";
import type { Band, ExerciseTypeCode, InstructionIcon } from "../../../types/learning.ts";
import type { VariantAudioPolicy } from "./audio.ts";
import type { ContentMode } from "./content-mode.ts";
import type { AudioExposure, TextExposure } from "./leaks.ts";
import type { MediaLibrary } from "./media.ts";
import type { GradeResult, HintView, ObjectiveCode, Response, RevealView, ValidationIssue } from "./primitives.ts";
import type { WorksheetItem, WorksheetLayout } from "./worksheet.ts";

/**
 * Giao diện Exercise Type Module (ARCHITECTURE §11.1, AD-06): mỗi dạng bài gồm lược đồ, hàm chấm,
 * bộ kiểm tra riêng, thang gợi ý, chính sách âm thanh, cách lộ/không lộ chữ, biểu diễn phiếu và
 * Player (giao diện, đăng ký riêng ở phía client). Phần logic ở đây là HÀM THUẦN, không phụ thuộc React.
 */

export const VARIANT_IDS = [
  "picture_onset",
  "visual_match",
  "listen_letter",
  "picture_build",
  "parts_to_syllable",
  "which_onset",
  "which_rime",
  "which_tone",
  "find_with_unit",
  "missing_onset",
  "missing_rime",
  "missing_tone",
  "choose_picture",
  "match_pairs",
  "sentence_picture",
  "comprehension_question",
  "arrange_words",
] as const;
export type VariantId = (typeof VARIANT_IDS)[number];

export type VariantDefinition = {
  id: VariantId;
  type: ExerciseTypeCode;
  /** Tên biến thể cho người lớn (GV, phụ huynh). */
  title: string;
  objective: ObjectiveCode;
  objectiveDescription: string;
  /** Câu lệnh chuẩn dùng chung cho ứng dụng và phiếu; `spoken` là lời đọc dự kiến (chưa có tệp). */
  instruction: { icon: InstructionIcon; text: string; spoken: string };
  audioPolicy: VariantAudioPolicy;
  paper: { supported: boolean; layout: WorksheetLayout | null; note: string | null };
  responseKind: Response["kind"];
  recommendedBands: readonly Band[];
};

/** Bối cảnh cho bộ kiểm tra riêng của dạng bài (do chuỗi kiểm tra chung dựng sẵn). */
export type ItemCheckContext = {
  kb: KnowledgeBase;
  profile: CurriculumProfile;
  band: Band;
  lessonOrdinal: number | undefined;
  /** `null` khi hồ sơ không có tiến độ dùng được (ví dụ lớp 1A2 chưa xác nhận). */
  state: KnowledgeState | null;
  mode: ContentMode;
  media: MediaLibrary;
};

/**
 * Phần CHẠY TRÊN TRÌNH DUYỆT của một dạng bài (chấm, gợi ý, hiện đáp án) — không phụ thuộc zod hay kho tri
 * thức, để bundle của học sinh nhẹ. Server dùng chung đúng các hàm này để chấm lại (GĐ7).
 */
export interface ExerciseTypeRuntime<Item> {
  code: ExerciseTypeCode;
  /** Câu trả lời ban đầu (`null` = chưa chọn phương án nào). */
  emptyResponse(item: Item): Response | null;
  /** Đã đủ để bấm "Kiểm tra" chưa (ví dụ đã ghép đủ âm đầu, vần, dấu). */
  isComplete(item: Item, response: Response | null): boolean;
  grade(item: Item, response: Response): GradeResult;
  /** Câu trả lời đúng (dùng cho phần "Cô làm mẫu" và kiểm thử) — giao diện không tự suy ra đáp án. */
  correctResponse(item: Item): Response;
  /** Thang gợi ý (không gồm bước hiện đáp án — đáp án chỉ hiện khi hết lượt). */
  hints(item: Item): HintView[];
  /**
   * (Tùy chọn) Điều chỉnh câu trả lời đang làm khi một gợi ý được bật — ví dụ bài sắp xếp câu đặt sẵn
   * thẻ đầu câu và dấu chấm cuối câu vào đúng chỗ.
   */
  adjustForHint?(item: Item, response: Response | null, hint: HintView): Response | null;
  reveal(item: Item): RevealView;
}

/** Module đầy đủ (máy chủ / lúc build): thêm lược đồ, bộ kiểm tra, chống lộ đáp án, biểu diễn phiếu. */
export interface ExerciseTypeModule<Item> extends ExerciseTypeRuntime<Item> {
  itemSchema: z.ZodType<Item>;
  /** Kiểm tra riêng của dạng bài: đáp án duy nhất, phương án nhiễu hợp lệ, khớp kho tri thức… */
  validate(item: Item, ctx: ItemCheckContext): ValidationIssue[];
  /** Những chữ học sinh phải TỰ ĐỌC (kiểm tra "chỉ dùng điều đã học"). */
  readingTexts(item: Item): string[];
  /** Đơn vị kiến thức hiển thị như phương án/thẻ (chữ, vần, dấu) — phải là đơn vị đã học. */
  displayUnits(item: Item): UnitId[];
  /** Số phương án lớn nhất trong một lượt chọn (ràng buộc theo nhóm). */
  maxChoices(item: Item): number;
  textExposure(item: Item): TextExposure;
  audioExposure(item: Item, kb: KnowledgeBase): AudioExposure;
  worksheet(item: Item): WorksheetItem;
}
