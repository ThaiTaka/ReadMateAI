import { describe, expect, it } from "vitest";
import { VARIANT_IDS } from "@/features/exercises/core/module";
import type { Response } from "@/features/exercises/core/primitives";
import { exerciseItemSchema, type ExerciseItem } from "@/features/exercises/items";
import { moduleOf } from "@/features/exercises/registry";
import { runtimeOf } from "@/features/exercises/runtime-registry";
import { clone, demoItems, firstItem } from "./helpers";

/** Mọi câu trả lời SAI có thể dựng được cho một câu (để kiểm tra chấm sai nhất quán). */
function wrongResponses(item: ExerciseItem): Response[] {
  const correct = runtimeOf(item).correctResponse(item);
  switch (correct.kind) {
    case "choice": {
      const options: ReadonlyArray<{ id: string }> = "options" in item.content ? item.content.options : [];
      return options
        .filter((option) => option.id !== correct.optionId)
        .map((option) => ({ kind: "choice", optionId: option.id }));
    }
    case "multi": {
      const responses: Response[] = [{ kind: "multi", optionIds: correct.optionIds.slice(1) }];
      if ("options" in item.content) {
        for (const option of item.content.options) {
          if (!correct.optionIds.includes(option.id)) {
            responses.push({ kind: "multi", optionIds: [...correct.optionIds, option.id] });
          }
        }
      }
      return responses.filter((response) => response.kind !== "multi" || response.optionIds.length > 0);
    }
    case "build":
      return item.variant === "picture_build"
        ? item.content.tiles.onsets
            .filter((tile) => tile.id !== correct.onset)
            .map((tile): Response => ({ ...correct, onset: tile.id }))
        : [];
    case "match": {
      const [first, second] = Object.keys(correct.pairs);
      if (!first || !second) return [];
      return [
        {
          kind: "match",
          pairs: { ...correct.pairs, [first]: correct.pairs[second] ?? "", [second]: correct.pairs[first] ?? "" },
        },
      ];
    }
    case "order":
      return [{ kind: "order", tokenIds: [...correct.tokenIds].reverse() }];
  }
}

describe("lược đồ câu bài tập (zod)", () => {
  it("mọi câu do bộ sinh tạo cho cả 17 biến thể đều hợp lệ theo lược đồ", () => {
    for (const variant of VARIANT_IDS) {
      for (const item of demoItems(variant)) {
        expect(exerciseItemSchema.safeParse(item).success, `${variant} ${item.id}`).toBe(true);
      }
    }
  });

  it("thiếu phương án (chỉ còn 1) → lỗi", () => {
    const item = clone(firstItem("which_onset"));
    item.content.options = item.content.options.filter((option) => option.id === item.answer.optionId);
    const result = exerciseItemSchema.safeParse(item);
    expect(result.success).toBe(false);
    expect(JSON.stringify(result.error?.issues)).toContain("Cần ít nhất 2 phương án");
  });

  it("đáp án không tồn tại trong danh sách phương án → lỗi", () => {
    const item = clone(firstItem("missing_onset"));
    item.answer.optionId = "o9";
    expect(JSON.stringify(exerciseItemSchema.safeParse(item).error?.issues)).toContain(
      "không có trong danh sách phương án",
    );
  });

  it("phương án trùng nội dung (kể cả khác hoa thường) → lỗi", () => {
    const item = clone(firstItem("visual_match", "foundation"));
    const [first, second] = item.content.options;
    if (!first || !second) throw new Error("thiếu phương án");
    second.text = first.text.toUpperCase();
    expect(JSON.stringify(exerciseItemSchema.safeParse(item).error?.issues)).toContain("Phương án trùng nội dung");
  });

  it("phần hiển thị KHÔNG được mang tên tranh: thêm trường lạ vào content bị từ chối (strictObject)", () => {
    const item = clone(firstItem("picture_onset")) as unknown as { content: Record<string, unknown> };
    item.content.pictureName = "cá";
    expect(exerciseItemSchema.safeParse(item).success).toBe(false);
  });

  it("bài nhiều đáp án: phải còn ít nhất một phương án sai; đáp án không được trùng", () => {
    const item = clone(firstItem("find_with_unit"));
    item.answer.optionIds = item.content.options.map((option) => option.id);
    expect(JSON.stringify(exerciseItemSchema.safeParse(item).error?.issues)).toContain("ít nhất một phương án sai");
  });

  it("bài nối: mỗi từ nối đúng một tranh khác nhau", () => {
    const item = clone(firstItem("match_pairs"));
    const values = Object.values(item.answer.pairs);
    const keys = Object.keys(item.answer.pairs);
    if (keys[1] && values[0]) item.answer.pairs[keys[1]] = values[0];
    expect(JSON.stringify(exerciseItemSchema.safeParse(item).error?.issues)).toContain(
      "Mỗi từ phải nối với đúng một tranh",
    );
  });

  it("bài sắp xếp: thứ tự đáp án phải dùng đúng các thẻ từ", () => {
    const item = clone(firstItem("arrange_words"));
    item.answer.orders = [[...(item.answer.orders[0] ?? []), "thừa"]];
    expect(JSON.stringify(exerciseItemSchema.safeParse(item).error?.issues)).toContain("dùng đúng các thẻ từ");
  });

  it("bài ghép tiếng: mã thẻ không được trùng giữa các nhóm", () => {
    const item = clone(firstItem("picture_build"));
    const rime = item.content.tiles.rimes[0];
    const onset = item.content.tiles.onsets[0];
    if (!rime || !onset) throw new Error("thiếu thẻ");
    rime.id = onset.id;
    expect(JSON.stringify(exerciseItemSchema.safeParse(item).error?.issues)).toContain("trùng giữa các nhóm");
  });
});

describe("chấm điểm (hàm thuần, dùng chung client/server)", () => {
  it("với MỌI câu của 17 biến thể: câu trả lời đúng → đúng; mọi câu trả lời sai dựng được → sai", () => {
    for (const variant of VARIANT_IDS) {
      for (const item of demoItems(variant)) {
        const runtime = runtimeOf(item);
        const correct = runtime.correctResponse(item);
        expect(runtime.isComplete(item, correct), `${variant} hoàn chỉnh`).toBe(true);
        expect(runtime.grade(item, correct).correct, `${variant} đúng`).toBe(true);
        for (const wrong of wrongResponses(item)) {
          expect(runtime.grade(item, wrong).correct, `${variant} sai ${JSON.stringify(wrong)}`).toBe(false);
        }
        // module đầy đủ dùng lại đúng phần chạy của client
        expect(moduleOf(item).grade).toBe(runtime.grade);
      }
    }
  });

  it("chọn sai một phương án nhiễu → trả thẻ lỗi của phương án đó; chỉ đánh dấu phương án đã chọn", () => {
    const item = firstItem("missing_onset");
    const wrong = item.content.options.find((option) => option.id !== item.answer.optionId);
    if (!wrong) throw new Error("thiếu phương án");
    const result = runtimeOf(item).grade(item, { kind: "choice", optionId: wrong.id });
    expect(result.errorTags).toEqual([item.answer.distractorTags[wrong.id]]);
    expect(result.marks).toEqual({ [wrong.id]: "incorrect" });
  });

  it("chọn nhiều: thiếu một đáp án → sai, thẻ selection:missed, không đánh dấu ô bỏ sót", () => {
    const item = demoItems("find_with_unit", "developing", { count: 40, minCount: 1 }).find(
      (entry) => entry.variant === "find_with_unit" && entry.answer.optionIds.length > 1,
    );
    if (!item || item.variant !== "find_with_unit") throw new Error("cần câu có 2 đáp án");
    const [kept, missed] = item.answer.optionIds;
    const result = runtimeOf(item).grade(item, { kind: "multi", optionIds: [kept ?? ""] });
    expect(result.correct).toBe(false);
    expect(result.errorTags).toContain("selection:missed");
    expect(Object.keys(result.marks)).toEqual([kept]);
    expect(result.marks[missed ?? ""]).toBeUndefined();
  });

  it("ghép tiếng: đánh dấu đúng/sai theo từng nhóm thẻ đã chọn", () => {
    const item = firstItem("picture_build");
    const wrongOnset = item.content.tiles.onsets.find((tile) => tile.id !== item.answer.onset);
    if (!wrongOnset) throw new Error("thiếu thẻ");
    const result = runtimeOf(item).grade(item, {
      kind: "build",
      onset: wrongOnset.id,
      rime: item.answer.rime,
      tone: item.answer.tone,
    });
    expect(result.correct).toBe(false);
    expect(result.marks).toEqual({
      [wrongOnset.id]: "incorrect",
      [item.answer.rime]: "correct",
      [item.answer.tone]: "correct",
    });
  });

  it("chưa đủ thì chưa được kiểm tra (ghép thiếu dấu, nối thiếu cặp, sắp xếp thiếu thẻ)", () => {
    const build = firstItem("picture_build");
    expect(
      runtimeOf(build).isComplete(build, {
        kind: "build",
        onset: build.answer.onset,
        rime: build.answer.rime,
        tone: null,
      }),
    ).toBe(false);
    const match = firstItem("match_pairs");
    const [word, picture] = Object.entries(match.answer.pairs)[0] ?? [];
    expect(runtimeOf(match).isComplete(match, { kind: "match", pairs: { [word ?? ""]: picture ?? "" } })).toBe(false);
    const order = firstItem("arrange_words");
    expect(runtimeOf(order).isComplete(order, { kind: "order", tokenIds: [order.content.tokens[0]?.id ?? ""] })).toBe(
      false,
    );
    const choice = firstItem("which_tone");
    expect(runtimeOf(choice).isComplete(choice, null)).toBe(false);
  });

  it("câu trả lời sai kiểu → sai với thẻ response:wrong_kind (không ném lỗi)", () => {
    const item = firstItem("choose_picture");
    expect(runtimeOf(item).grade(item, { kind: "order", tokenIds: [] })).toEqual({
      correct: false,
      errorTags: ["response:wrong_kind"],
      marks: {},
    });
  });
});
