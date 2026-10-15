import type { ReviewStatus } from "../knowledge/schema.ts";
import type { MediaLibrary, PictureAsset } from "../exercises/core/media.ts";
import type { ComprehensionSpec } from "../exercises/generation/context.ts";

/**
 * Fixture RIÊNG của bản chơi thử (docs/EXERCISE_ENGINE.md §8). Chỉ dùng ở chế độ `demo`; không làm thay
 * đổi trạng thái duyệt của kho tri thức chính (content/). Mọi mục ở đây đều `pending_review`, nên bộ máy ở
 * chế độ học thật (`production`) luôn chặn chúng.
 *
 * Không chứa — và không bao giờ được chứa — thông tin của học sinh thật.
 */

export const PRACTICE_FIXTURE_IS_FICTIONAL = true as const;

/** Lớp minh họa: hồ sơ hư cấu `profile:illustrative-demo`, giả định đang ở bài MH16 của chuỗi bài minh họa. */
export const DEMO_PROFILE_ID = "profile:illustrative-demo";
export const DEMO_LESSON_ORDINAL = 16;

const LUCIDE = {
  kind: "icon_library",
  library: "lucide-react 1.55.0",
  license: "ISC",
  licenseNote:
    "Biểu tượng của Lucide Icons (ISC; một số biểu tượng gốc từ Feather — MIT). Đã có sẵn trong dự án dưới dạng thư viện; không tải tài nguyên ngoài.",
} as const;

const pending = (note: string) => ({ status: "pending_review" as const, note });

function picture(iconKey: string, word: string, wordId: string, clarityNote: string): PictureAsset {
  return {
    id: `picture:${iconKey}`,
    iconKey,
    word,
    wordId,
    source: LUCIDE,
    review: pending("Tranh minh họa tạm cho bản chơi thử — GV cần xác nhận tranh rõ nghĩa với học sinh lớp 1."),
    clarityNote,
    scope: "demo_fixture",
  };
}

/**
 * Tranh minh họa: biểu tượng nét đơn giản (in đen trắng vẫn rõ). Chỉ chọn những sự vật có biểu tượng
 * tương đối rõ nghĩa; mỗi tranh ghi các cách gọi khác có thể gây mơ hồ để GV xem khi duyệt.
 */
export const DEMO_PICTURES: readonly PictureAsset[] = [
  picture("fish", "cá", "word:cá", "Có thể gọi “con cá”."),
  picture("leaf", "lá", "word:lá", "Có thể gọi “chiếc lá”."),
  picture("flag", "cờ", "word:cờ", "Có thể gọi “lá cờ” (cũng có trong kho) — không dùng chung một bài."),
  picture("rabbit", "thỏ", "word:thỏ", "Có thể gọi “con thỏ”."),
  picture("house", "nhà", "word:nhà", "Có thể gọi “ngôi nhà”, “cái nhà”."),
  picture("grape", "nho", "word:nho", "Có thể gọi “chùm nho”."),
  picture("dog", "chó", "word:chó", "Có thể gọi “con chó”, “cún”."),
  picture("notebook", "vở", "word:vở", "Có thể nhầm với “sổ”."),
  picture("shopping-basket", "giỏ", "word:giỏ", "Có thể gọi “rổ” — cần GV xác nhận."),
  picture("cloud-rain", "mưa", "word:mưa", "Có thể gọi “mây”, “trời mưa”."),
  picture("book", "sách", "word:sách", "Có thể gọi “quyển sách”; có thể nhầm với “vở”."),
  picture("hand", "tay", "word:tay", "Có thể gọi “bàn tay”."),
  picture("flower", "hoa", "word:hoa", "Có thể gọi “bông hoa” (cũng có trong kho)."),
  picture("sailboat", "thuyền", "word:thuyền", "Có thể gọi “thuyền buồm”."),
  picture("backpack", "ba lô", "word:ba-lô", "Có thể gọi “cặp”, “cặp sách”."),
  picture("citrus", "quả cam", "word:quả-cam", "Có thể bị gọi là “quả chanh”, “quả quýt” — cần GV xác nhận."),
  picture("bike", "xe đạp", "word:xe-đạp", "Có thể gọi “xe”."),
  picture("cat", "con mèo", "word:con-mèo", "Có thể gọi “mèo”."),
  picture("ship", "tàu thuỷ", "word:tàu-thuỷ", "Có thể gọi “tàu”, “thuyền”."),
  picture("baby", "bé", "word:bé", "Có thể gọi “em bé”."),
  picture("armchair", "ghế", "word:ghế", "Biểu tượng là ghế bành; có thể gọi “cái ghế”."),
  picture("leafy-green", "rau", "word:rau", "Có thể gọi “bó rau”, “cải”."),
];

export const DEMO_MEDIA: MediaLibrary = { pictures: DEMO_PICTURES, audio: [] };

type FixtureQuestion = ComprehensionSpec & { review: { status: ReviewStatus; note: string } };

const question = (
  id: string,
  sentenceId: string,
  text: string,
  answer: string,
  distractors: readonly string[],
): FixtureQuestion => ({
  id,
  sentenceId,
  question: text,
  answer,
  distractors,
  review: pending("Câu hỏi đọc hiểu do trợ lý AI soạn cho bản chơi thử — chờ GV duyệt."),
});

/**
 * Câu hỏi đọc hiểu khai báo sẵn cho câu trong kho tri thức. Bộ máy KHÔNG tự đặt câu hỏi; bộ kiểm tra
 * bắt buộc đáp án nằm nguyên văn trong câu và phương án nhiễu không nằm trong câu.
 */
export const DEMO_QUESTIONS: readonly FixtureQuestion[] = [
  question("demo-question:001", "sentence:001", "Bà có gì?", "cá", ["gà", "cờ"]),
  question("demo-question:002", "sentence:006", "Ai bế bé?", "mẹ", ["bà", "bố"]),
  question("demo-question:003", "sentence:017", "Bò ăn gì?", "cỏ", ["lá", "rau"]),
  question("demo-question:004", "sentence:019", "Bé làm gì?", "đọc sách", ["vẽ hoa", "đi bộ"]),
  question("demo-question:005", "sentence:015", "Mẹ mua gì?", "cua", ["cá", "gà"]),
  question("demo-question:006", "sentence:020", "Ông có con gì?", "cá vàng", ["con mèo", "con chó"]),
  question("demo-question:007", "sentence:024", "Mẹ có gì?", "bó hoa", ["cá vàng", "quả cam"]),
  question("demo-question:008", "sentence:023", "Bé chơi với con gì?", "mèo", ["chó", "gà"]),
];

export function demoFixtureReview(id: string): ReviewStatus | null {
  return DEMO_QUESTIONS.find((entry) => entry.id === id)?.review.status ?? null;
}
