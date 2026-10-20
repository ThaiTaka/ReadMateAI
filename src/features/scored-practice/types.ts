import type { Feedback } from "../exercises/core/feedback.ts";
import type { HintView, Mark, Response, RevealView } from "../exercises/core/primitives.ts";
import type { HintMode } from "../exercises/core/support.ts";
import type { ExerciseItem } from "../exercises/items.ts";
import type { MapTileKey } from "../game-world/catalog.ts";
import type { GameKey } from "../gamification/rules.ts";
import type { GameUnlockState } from "../gamification/unlocks.ts";
import type { SupportLevel } from "../../types/learning.ts";

/**
 * Dữ liệu (DTO) mà student gateway trả cho trình duyệt trong chế độ CÓ ĐIỂM (R04). Chỉ kiểu — không có mã chạy.
 *
 * Bất biến bảo mật (AD-41, GAMIFICATION_SPEC §5.8): trước khi câu đóng, câu chỉ có `view` (dạng, biến thể, nội dung
 * hiển thị) — không `answer`, không `reveal`, không tên tranh. `reveal` chỉ khác null khi câu đã đúng/hết lượt.
 * Không có `student_id`, `class_id`, nhóm năng lực hay tổng điểm bị trừ.
 */

export type QuestionView = ExerciseItem extends infer I
  ? I extends ExerciseItem
    ? Pick<I, "type" | "variant" | "content">
    : never
  : never;

export type QuestionStatus = "open" | "correct" | "exhausted" | "void";

export type PublicQuestion = {
  id: string;
  sessionId: string;
  position: number;
  total: number;
  view: QuestionView;
  status: QuestionStatus;
  attemptsUsed: number;
  maxAttempts: number;
  supportLevel: SupportLevel;
  /** false = "Câu luyện thêm – Không tính điểm". */
  scorable: boolean;
  lastResponse: Response | null;
  /** Dấu đúng/sai CHỈ cho những gì học sinh đã chọn ở lượt gần nhất. */
  marks: Record<string, Mark>;
  feedback: Feedback | null;
  /** Gợi ý sau lượt sai (theo mức hỗ trợ); null khi không có. */
  hint: HintView | null;
  hintMode: HintMode;
  reveal: RevealView | null;
};

export type SessionQuestionSummary = { id: string; position: number; status: QuestionStatus; scorable: boolean };

export type ScoreSummary = { balance: number; earnedTotal: number };

export type PracticeSessionDto = {
  id: string;
  status: "in_progress" | "completed" | "abandoned" | "void";
  questions: SessionQuestionSummary[];
  /** Câu đang mở đầu tiên (hoặc null khi buổi đã xong). */
  current: PublicQuestion | null;
  summary: { total: number; correct: number; closed: number; earnedInSession: number };
  score: ScoreSummary;
};

export type AttemptDto = {
  question: PublicQuestion;
  /** Điểm thay đổi THỰC TẾ của lượt này (null với câu không tính điểm). */
  points: { nominalDelta: number; appliedDelta: number } | null;
  score: ScoreSummary;
  tilesAvailable: number;
  newlyUnlockedGames: GameKey[];
  sessionStatus: PracticeSessionDto["status"];
  /** true khi đây là kết quả của lần gửi trước (cùng clientAttemptId). */
  replayed: boolean;
};

export type MapStateDto = {
  allowed: number;
  revealed: number;
  available: number;
  total: number;
  revealedTiles: MapTileKey[];
  frontier: MapTileKey[];
};

export type PracticeBlocker = "CONSENT_REQUIRED" | "CURRICULUM_UNCONFIRMED" | "NO_BAND" | "SEASON_CLOSED";

export type StudentHomeDto = {
  student: { displayName: string; avatarKey: string; className: string };
  season: { seqNo: number } | null;
  /** Đã có đồng ý thu dữ liệu học tập — chưa có thì chỉ chơi thử (không lưu). */
  learningDataConsent: boolean;
  score: ScoreSummary;
  map: MapStateDto;
  games: Array<GameUnlockState & { discovered: boolean }>;
  practice: {
    blocker: PracticeBlocker | null;
    openSession: { id: string; closed: number; total: number } | null;
  };
};

export type RevealTileDto = { outcome: "revealed" | "already_revealed"; map: MapStateDto };
