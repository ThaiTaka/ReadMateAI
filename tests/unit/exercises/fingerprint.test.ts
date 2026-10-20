import { describe, expect, it } from "vitest";
import type { VariantId } from "@/features/exercises/core/module";
import { responseIds, responseKey } from "@/features/exercises/core/response-key";
import { contentFingerprint, stableStringify } from "@/features/exercises/fingerprint";
import { generateExerciseSet } from "@/features/exercises/generation/generate";
import type { ExerciseItem } from "@/features/exercises/items";
import { demoRequest } from "./helpers";

function generateByKey(variant: VariantId, seed: string): Map<string, ExerciseItem> {
  const result = generateExerciseSet(demoRequest(variant, "extending", { seed, count: 6 }));
  if (!result.ok) throw new Error(`${variant}: ${result.message}`);
  return new Map(result.set.keys.map((key, index) => [key, result.set.items[index]!]));
}

let comparedEqualMaterial = 0;

describe("vân tay nội dung (chống 'cùng nội dung, khác seed' — AD-43)", () => {
  const variants: VariantId[] = [
    "visual_match",
    "picture_onset",
    "which_rime",
    "find_with_unit",
    "missing_rime",
    "choose_picture",
    "match_pairs",
    "comprehension_question",
    "arrange_words",
  ];

  for (const variant of variants) {
    it(`${variant}: cùng mục tiêu, hai seed → mã câu/thứ tự khác nhưng vân tay giống`, () => {
      const first = generateByKey(variant, "seed-mot");
      const second = generateByKey(variant, "seed-hai");
      const shared = [...first.keys()].filter((key) => second.has(key));
      expect(shared.length).toBeGreaterThan(0);
      let differentIds = 0;
      for (const key of shared) {
        const a = first.get(key)!;
        const b = second.get(key)!;
        if (a.id !== b.id) differentIds += 1;
        // Cùng mục tiêu có thể có phương án nhiễu khác → chỉ so khi phần nội dung (bỏ thứ tự) giống nhau.
        const sameMaterial = stableStringify(sortedOptions(a.content)) === stableStringify(sortedOptions(b.content));
        if (sameMaterial) {
          comparedEqualMaterial += 1;
          expect(contentFingerprint(a)).toBe(contentFingerprint(b));
        }
      }
      expect(differentIds).toBeGreaterThan(0);
    });
  }

  it("đã thực sự so được nhiều cặp cùng chất liệu từ bộ sinh thật", () => {
    expect(comparedEqualMaterial).toBeGreaterThanOrEqual(5);
  });

  it("đổi thứ tự phương án và đánh lại mã o1/o2/o3 không đổi vân tay; đổi đáp án thì đổi", () => {
    const base = {
      type: "letter_sound",
      variant: "visual_match",
      content: {
        sample: "b",
        options: [
          { id: "o1", text: "d" },
          { id: "o2", text: "b" },
          { id: "o3", text: "p" },
        ],
      },
      answer: { optionId: "o2", distractorTags: { o1: "confusion:b-d", o3: "confusion:b-p" } },
    };
    const shuffled = {
      ...base,
      content: {
        sample: "b",
        options: [
          { id: "o1", text: "p" },
          { id: "o2", text: "d" },
          { id: "o3", text: "b" },
        ],
      },
      answer: { optionId: "o3", distractorTags: { o2: "confusion:b-d", o1: "confusion:b-p" } },
    };
    expect(contentFingerprint(shuffled)).toBe(contentFingerprint(base));
    expect(contentFingerprint({ ...base, answer: { ...base.answer, optionId: "o1" } })).not.toBe(
      contentFingerprint(base),
    );
    expect(contentFingerprint({ ...base, content: { ...base.content, sample: "d" } })).not.toBe(
      contentFingerprint(base),
    );
    expect(contentFingerprint(base)).toMatch(/^[0-9a-f]{64}$/u);
  });

  it("chuẩn hóa NFC: cùng chữ ở dạng tổ hợp và dựng sẵn cho cùng vân tay", () => {
    const composed = { type: "x", variant: "y", content: { sample: String.fromCodePoint(0x1ebf) }, answer: {} };
    const decomposed = {
      type: "x",
      variant: "y",
      content: { sample: "e" + String.fromCodePoint(0x302, 0x301) },
      answer: {},
    };
    expect(contentFingerprint(decomposed)).toBe(contentFingerprint(composed));
  });
});

describe("khóa câu trả lời (từ chối gửi lại đúng câu trả lời cũ)", () => {
  it("chọn nhiều/nối cặp không phụ thuộc thứ tự; sắp xếp câu thì phụ thuộc", () => {
    expect(responseKey({ kind: "multi", optionIds: ["o2", "o1"] })).toBe(
      responseKey({ kind: "multi", optionIds: ["o1", "o2"] }),
    );
    expect(responseKey({ kind: "match", pairs: { w1: "p2", w2: "p1" } })).toBe(
      responseKey({ kind: "match", pairs: { w2: "p1", w1: "p2" } }),
    );
    expect(responseKey({ kind: "order", tokenIds: ["k1", "k2"] })).not.toBe(
      responseKey({ kind: "order", tokenIds: ["k2", "k1"] }),
    );
    expect(responseKey({ kind: "choice", optionId: "o1" })).not.toBe(responseKey({ kind: "choice", optionId: "o2" }));
    expect(responseKey({ kind: "build", onset: "o1", rime: null, tone: "t2" })).toBe("build:o1|-|t2");
  });

  it("liệt kê mã được nhắc tới", () => {
    expect(responseIds({ kind: "build", onset: "o1", rime: null, tone: "t2" })).toEqual(["o1", "t2"]);
    expect(responseIds({ kind: "match", pairs: { w1: "p2" } })).toEqual(["w1", "p2"]);
  });
});

/** Nội dung với mọi nhóm phương án sắp theo chữ và bỏ mã — để biết hai câu có cùng "chất liệu" hay không. */
function sortedOptions(value: unknown): unknown {
  if (Array.isArray(value)) {
    const mapped = value.map(sortedOptions);
    return mapped.every((entry) => typeof entry === "object" && entry !== null)
      ? [...mapped].sort((a, b) => stableStringify(a).localeCompare(stableStringify(b)))
      : mapped;
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => key !== "id")
        .map(([key, entry]) => [key, sortedOptions(entry)]),
    );
  }
  return value;
}
