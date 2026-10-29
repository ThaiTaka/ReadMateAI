/**
 * FIXTURE KIỂM THỬ R10.3a — câu "Nghe âm – chọn chữ" (listen_letter) HƯ CẤU chỉ dùng trên Supabase LOCAL để kiểm thử
 * đường phát bản ghi giáo viên cho học sinh. Không phải học liệu thật: kho tri thức `content/` vẫn có 0 mục đã duyệt
 * (CLAUDE.md §9.2.3). Chuỗi bài kiểm thử RIÊNG (không đụng bộ R04/R08), origin = test_fixture; CSDL chỉ nhận khi
 * private.test_environment bật (chỉ script local bật). Cách đọc (`spokenText`) lấy từ nhãn đề xuất của kho tri thức.
 */
import type { ExerciseItem } from "../../src/features/exercises/items.ts";
import { LETTER_SOUND_VARIANTS } from "../../src/features/exercises/types/letter-sound/variants.ts";
import type { FixtureExercise } from "./scoring-items.ts";

export const AUDIO_FIXTURE_SERIES_KEY = "series:test-fixture-r10-3a";
export const AUDIO_FIXTURE_TAG = "fixture:r10-3a-audio";

type Spec = { letter: string; label: string; distractors: [string, string] };

/** Âm → cách đọc đề xuất của kho tri thức (content/kb/phonemes.json) — chờ GV xác nhận ở hệ thật. */
export const LISTEN_SPECS: Record<string, Spec> = {
  b: { letter: "b", label: "bờ", distractors: ["d", "p"] },
  c: { letter: "c", label: "cờ", distractors: ["o", "e"] },
  d: { letter: "d", label: "dờ", distractors: ["b", "đ"] },
  i: { letter: "i", label: "i", distractors: ["l", "t"] },
  y: { letter: "y", label: "i", distractors: ["v", "g"] },
  k: { letter: "k", label: "ca", distractors: ["h", "l"] },
};

const SPOKEN = LETTER_SOUND_VARIANTS.listen_letter.instruction.spoken;

export function listenLetterItem(spec: Spec, index: number): ExerciseItem {
  const texts = [spec.letter, ...spec.distractors];
  const options = texts.map((text, position) => ({ id: `o${position + 1}`, text, unit: `phoneme:${text}` }));
  const answerId = options[0]!.id;
  return {
    id: `fixture.listen_letter.${String(index + 1).padStart(2, "0")}.${spec.letter}`,
    schemaVersion: 1,
    type: "letter_sound",
    variant: "listen_letter",
    objective: { code: "map_sound_to_letter", focusUnits: [`phoneme:${spec.letter}`], ruleIds: [] },
    difficulty: 1,
    requiredUnits: texts.map((text) => `phoneme:${text}` as const),
    source: { corpusIds: [], pictureIds: [], fixtureIds: [AUDIO_FIXTURE_TAG] },
    audio: {
      instruction: { spokenText: SPOKEN, assetId: null },
      stimulus: { spokenText: spec.label, assetId: null },
      model: { spokenText: spec.label, assetId: null },
    },
    content: { options },
    answer: {
      optionId: answerId,
      distractorTags: Object.fromEntries(options.slice(1).map((option) => [option.id, "distractor:other"])),
    },
  };
}

const LETTERS = Object.keys(LISTEN_SPECS);

export const AUDIO_FIXTURE_EXERCISES: readonly FixtureExercise[] = [
  {
    key: "fixture:r10-3a:listen-letters",
    title: "Kiểm thử R10.3a — nghe âm, bài 1",
    lessonOrdinal: 1,
    status: "approved",
    items: LETTERS.map((letter, index) => listenLetterItem(LISTEN_SPECS[letter]!, index)),
  },
];
