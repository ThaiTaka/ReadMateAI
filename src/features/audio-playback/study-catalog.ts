import letters from "../../../content/kb/letters.json";
import phonemes from "../../../content/kb/phonemes.json";
import type { LearningUnitKind } from "./learning-units.ts";

/**
 * Bố cục trang "Nghe cách đọc chữ" (R10.4): mỗi ô là MỘT chữ với tối đa hai nút nghe KHÁC NHAU — tên chữ cái (ví dụ b → "bê")
 * và âm của chữ (ví dụ b → "bờ"). Không gộp hai loại này; ô nào thiếu một loại thì không có nút loại đó (q chỉ có tên chữ:
 * âm của nó là "qu", nằm ở nhóm chữ ghép). Dữ liệu lấy từ kho tri thức, không có câu hỏi, không đáp án → không phải bài đánh giá.
 */

export type UnitRef = { kind: LearningUnitKind; text: string };

export type StudyTile = {
  id: string;
  /** Chữ lớn hiển thị (chữ thường, NFC). */
  display: string;
  /** Chữ hoa kèm theo (chỉ ô chữ cái). */
  upper: string | null;
  name: UnitRef | null;
  sound: UnitRef | null;
};

type RawLetter = { lower: string; upper: string; order: number };
type RawPhoneme = { text: string; letters: string[]; graphemeType: string };

const letterItems = (letters as { items: RawLetter[] }).items;
const phonemeItems = (phonemes as { items: RawPhoneme[] }).items;

const singleSound = new Map(
  phonemeItems
    .filter((item) => item.graphemeType === "single" && item.letters.length === 1)
    .map((item) => [item.letters[0]!.replace(/^letter:/u, "").normalize("NFC"), item.text.normalize("NFC")]),
);

/** 29 chữ cái theo thứ tự bảng chữ cái. */
export const STUDY_LETTERS: readonly StudyTile[] = [...letterItems]
  .sort((a, b) => a.order - b.order)
  .map((item): StudyTile => {
    const text = item.lower.normalize("NFC");
    const sound = singleSound.get(text);
    return {
      id: `letter:${text}`,
      display: text,
      upper: item.upper.normalize("NFC"),
      name: { kind: "letter", text },
      sound: sound ? { kind: "phoneme", text: sound } : null,
    };
  });

/** 11 chữ ghép (ch, gh, gi, kh, ng, ngh, nh, ph, qu, th, tr): chỉ có âm của chữ. */
export const STUDY_DIGRAPHS: readonly StudyTile[] = phonemeItems
  .filter((item) => item.graphemeType !== "single")
  .map((item): StudyTile => {
    const text = item.text.normalize("NFC");
    return { id: `phoneme:${text}`, display: text, upper: null, name: null, sound: { kind: "phoneme", text } };
  });

/** Mọi đơn vị trang này có thể hỏi máy chủ (để dựng danh sách "nghe được ngay bây giờ"). */
export const STUDY_UNITS: readonly UnitRef[] = [...STUDY_LETTERS, ...STUDY_DIGRAPHS].flatMap((tile) =>
  [tile.name, tile.sound].filter((unit): unit is UnitRef => unit !== null),
);
