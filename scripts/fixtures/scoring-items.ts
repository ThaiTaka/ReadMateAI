/**
 * FIXTURE KIỂM THỬ R04 — câu bài tập HƯ CẤU chỉ dùng trên Supabase LOCAL để kiểm thử luồng tính điểm.
 *
 * Không phải học liệu thật: KHÔNG lấy từ kho tri thức content/ (kho thật có 0 mục đã duyệt và không được tự chuyển
 * sang approved — CLAUDE.md §9.2.3). Các câu ở đây là bài "Tìm chữ giống chữ mẫu" (dạng 1, biến thể visual_match)
 * dựng tay, gắn origin = test_fixture, thuộc chuỗi bài series_kind = test_fixture. CSDL chỉ nhận chúng khi
 * private.test_environment bật (chỉ script local bật) — production luôn từ chối.
 *
 * Đáp án của visual_match là phương án có chữ GIỐNG chữ mẫu → E2E tự tìm được đáp án từ giao diện, giống học sinh.
 */
import type { ExerciseItem } from "../../src/features/exercises/items.ts";
import { LETTER_SOUND_VARIANTS } from "../../src/features/exercises/types/letter-sound/variants.ts";

export const FIXTURE_SERIES_KEY = "series:test-fixture-r04";
export const FIXTURE_TAG = "fixture:r04-scoring";

type Spec = { sample: string; distractors: [string, string] };

/** Cặp chữ dễ nhầm hình dạng — mỗi dòng một nội dung khác nhau (vân tay khác nhau). */
const SPECS: readonly Spec[] = [
  { sample: "b", distractors: ["d", "p"] },
  { sample: "d", distractors: ["b", "q"] },
  { sample: "m", distractors: ["n", "u"] },
  { sample: "n", distractors: ["m", "u"] },
  { sample: "u", distractors: ["n", "ư"] },
  { sample: "o", distractors: ["ô", "ơ"] },
  { sample: "ô", distractors: ["o", "ơ"] },
  { sample: "ơ", distractors: ["o", "ô"] },
  { sample: "a", distractors: ["ă", "â"] },
  { sample: "ă", distractors: ["a", "â"] },
  { sample: "â", distractors: ["a", "ă"] },
  { sample: "e", distractors: ["ê", "c"] },
  { sample: "ê", distractors: ["e", "c"] },
  { sample: "l", distractors: ["h", "k"] },
  { sample: "h", distractors: ["l", "k"] },
  { sample: "t", distractors: ["l", "đ"] },
  // Hai câu "chưa học" (bài 3 — lớp kiểm thử đang ở bài 2) và hai câu "chưa duyệt".
  { sample: "g", distractors: ["q", "y"] },
  { sample: "y", distractors: ["g", "v"] },
  { sample: "x", distractors: ["s", "k"] },
  { sample: "s", distractors: ["x", "r"] },
];

const SPOKEN = LETTER_SOUND_VARIANTS.visual_match.instruction.spoken;

/** Dựng một câu visual_match; `rotation` đổi vị trí đáp án (mô phỏng hai lần sinh khác seed). */
export function fixtureItem(spec: Spec, index: number, rotation = index % 3, idSuffix = ""): ExerciseItem {
  const texts = [spec.sample, ...spec.distractors];
  const order = [0, 1, 2].map((offset) => texts[(offset + 3 - (rotation % 3)) % 3]!);
  const options = order.map((text, position) => ({ id: `o${position + 1}`, text }));
  const answerId = options.find((option) => option.text === spec.sample)!.id;
  const distractorTags = Object.fromEntries(
    options
      .filter((option) => option.id !== answerId)
      .map((option) => [option.id, `confusion:${spec.sample}-${option.text}`]),
  );
  const number = String(index + 1).padStart(2, "0");
  return {
    id: `fixture.visual_match.${number}${idSuffix}`,
    schemaVersion: 1,
    type: "letter_sound",
    variant: "visual_match",
    objective: { code: "discriminate_letter_shape", focusUnits: [`letter:${spec.sample}`], ruleIds: [] },
    difficulty: 1,
    requiredUnits: texts.map((text) => `letter:${text}` as const),
    source: { corpusIds: [], pictureIds: [], fixtureIds: [FIXTURE_TAG] },
    audio: { instruction: { spokenText: SPOKEN, assetId: null } },
    content: { sample: spec.sample, options },
    answer: { optionId: answerId, distractorTags },
  };
}

export type FixtureExercise = {
  key: string;
  title: string;
  lessonOrdinal: number;
  /** approved = phát được; in_review = chưa duyệt (không bao giờ được phát). */
  status: "approved" | "in_review";
  items: ExerciseItem[];
};

const items = SPECS.map((spec, index) => fixtureItem(spec, index));

export const FIXTURE_EXERCISES: readonly FixtureExercise[] = [
  {
    key: "fixture:r04:letters-a",
    title: "Kiểm thử R04 — chữ dễ nhầm A",
    lessonOrdinal: 1,
    status: "approved",
    items: items.slice(0, 8),
  },
  {
    key: "fixture:r04:letters-b",
    title: "Kiểm thử R04 — chữ dễ nhầm B",
    lessonOrdinal: 2,
    status: "approved",
    items: items.slice(8, 16),
  },
  {
    // CÙNG nội dung với câu đầu tiên nhưng mã câu và thứ tự phương án khác (như sinh bằng seed khác) — chống cày điểm.
    key: "fixture:r04:duplicate",
    title: "Kiểm thử R04 — bản sao nội dung",
    lessonOrdinal: 1,
    status: "approved",
    items: [fixtureItem(SPECS[0]!, 0, 2, ".seed-khac")],
  },
  {
    key: "fixture:r04:not-yet-taught",
    title: "Kiểm thử R04 — chưa học",
    lessonOrdinal: 3,
    status: "approved",
    items: items.slice(16, 18),
  },
  {
    key: "fixture:r04:unreviewed",
    title: "Kiểm thử R04 — chưa duyệt",
    lessonOrdinal: 1,
    status: "in_review",
    items: items.slice(18, 20),
  },
];

/** Số nội dung KHÁC NHAU phát được cho lớp ở bài 2 (không tính bản sao, chưa học, chưa duyệt). */
export const FIXTURE_DISTINCT_ELIGIBLE = 16;

/** Đáp án của một câu visual_match nhìn từ nội dung hiển thị: phương án có chữ giống chữ mẫu. */
export function visualMatchAnswer(content: { sample: string; options: Array<{ id: string; text: string }> }): string {
  const found = content.options.find((option) => option.text === content.sample);
  if (!found) throw new Error("fixture không có đáp án");
  return found.id;
}
