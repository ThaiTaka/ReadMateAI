import { describe, expect, it } from "vitest";
import { optionKey } from "@/features/exercises/core/primitives";
import { VARIANT_IDS } from "@/features/exercises/core/module";
import { generateExerciseSet } from "@/features/exercises/generation/generate";
import { buildTaskContract, generateHomeClassPair } from "@/features/exercises/generation/pair";
import { createRng, hashString } from "@/features/exercises/generation/rng";
import type { ExerciseItem } from "@/features/exercises/items";
import { moduleOf } from "@/features/exercises/registry";
import { validateExerciseItem } from "@/features/exercises/validation";
import { approvedKb, class1a2, confirmedProfile, demoRequest, demoValidation, mediaWithInstruction } from "./helpers";

function optionTexts(item: ExerciseItem): string[][] {
  const content = item.content as Record<string, unknown>;
  const groups: string[][] = [];
  if (Array.isArray(content.options)) {
    groups.push(
      (content.options as Array<{ text?: string; picture?: { pictureId: string } }>).map(
        (option) => option.text ?? option.picture?.pictureId ?? "",
      ),
    );
  }
  if (item.variant === "picture_build") {
    const { onsets, rimes, tones } = item.content.tiles;
    groups.push(
      onsets.map((tile) => tile.text),
      rimes.map((tile) => tile.text),
      tones.map((tile) => tile.tone),
    );
  }
  if (item.variant === "match_pairs") groups.push(item.content.words.map((word) => word.text));
  return groups;
}

describe("bộ sinh số có seed", () => {
  it("cùng seed → cùng dãy; khác seed → khác dãy", () => {
    const a = createRng("abc");
    const b = createRng("abc");
    const c = createRng("abd");
    const seqA = Array.from({ length: 5 }, () => a.next());
    expect(Array.from({ length: 5 }, () => b.next())).toEqual(seqA);
    expect(Array.from({ length: 5 }, () => c.next())).not.toEqual(seqA);
    expect(hashString("readmate")).toBe(hashString("readmate"));
  });

  it("xáo trộn không làm mất hay nhân đôi phần tử", () => {
    const items = ["a", "b", "c", "d", "e"];
    expect([...createRng("x").shuffle(items)].sort()).toEqual(items);
    expect(items).toEqual(["a", "b", "c", "d", "e"]);
  });
});

describe("sinh biến thể bài tập", () => {
  it("tái lập được: cùng seed → kết quả giống hệt; khác seed → khác", () => {
    for (const variant of ["picture_onset", "missing_rime", "arrange_words", "find_with_unit"] as const) {
      const first = generateExerciseSet(demoRequest(variant));
      const second = generateExerciseSet(demoRequest(variant));
      const other = generateExerciseSet(demoRequest(variant, "developing", { seed: "seed-khac" }));
      expect(first).toEqual(second);
      expect(first.ok && other.ok && JSON.stringify(first.set.items) !== JSON.stringify(other.set.items)).toBe(true);
    }
  });

  it("không tạo phương án trùng trong cùng một câu (mọi biến thể)", () => {
    for (const variant of VARIANT_IDS) {
      const result = generateExerciseSet(demoRequest(variant, "developing", { count: 12, minCount: 1 }));
      expect(result.ok, variant).toBe(true);
      if (!result.ok) continue;
      for (const item of result.set.items) {
        for (const group of optionTexts(item))
          expect(new Set(group.map(optionKey)).size, `${variant} ${group}`).toBe(group.length);
      }
      expect(new Set(result.set.keys).size).toBe(result.set.keys.length);
    }
  });

  it("vị trí đáp án được xáo (không phải lúc nào cũng là phương án đầu)", () => {
    const result = generateExerciseSet(demoRequest("which_onset", "developing", { count: 20, minCount: 1 }));
    if (!result.ok) throw new Error(result.message);
    const positions = new Set(
      result.set.items.map((item) =>
        item.variant === "which_onset" ? item.content.options.findIndex((o) => o.id === item.answer.optionId) : -1,
      ),
    );
    expect(positions.size).toBeGreaterThan(1);
  });

  it("phương án nhiễu ưu tiên cặp dễ nhầm trong kho tri thức (c/k, g/gh, ng/ngh ở bài điền chữ)", () => {
    const result = generateExerciseSet(demoRequest("missing_onset", "developing", { count: 10, minCount: 1 }));
    if (!result.ok) throw new Error(result.message);
    for (const item of result.set.items) {
      if (item.variant !== "missing_onset") throw new Error("sai biến thể");
      expect(Object.values(item.answer.distractorTags).every((tag) => /^confusion:(c-k|g-gh|ng-ngh)$/u.test(tag))).toBe(
        true,
      );
    }
  });

  it("mỗi câu đã qua chuỗi kiểm tra; số ứng viên hữu hạn và có chẩn đoán", () => {
    const result = generateExerciseSet(demoRequest("which_tone", "foundation", { count: 200, minCount: 1 }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.diagnostics.candidatesConsidered).toBeLessThan(500);
    expect(result.set.items.length).toBeLessThanOrEqual(result.diagnostics.candidatesConsidered);
    for (const item of result.set.items) expect(validateExerciseItem(item, demoValidation("foundation")).ok).toBe(true);
    // Những ứng viên bị loại đều có mã lý do.
    for (const rejection of result.diagnostics.rejected) expect(rejection.codes.length).toBeGreaterThan(0);
  });

  it("không đủ ngữ liệu → thất bại kèm lý do, không nới quy tắc", () => {
    const result = generateExerciseSet(demoRequest("missing_rime", "developing", { count: 50 }));
    expect(result).toMatchObject({ ok: false, code: "INSUFFICIENT_CONTENT" });
    if (result.ok) return;
    expect(result.diagnostics.shortfall).toMatch(/Chỉ tạo được \d+\/50/u);
    const empty = generateExerciseSet(demoRequest("which_rime", "developing", { lessonOrdinal: 10 }));
    expect(empty).toMatchObject({ ok: false, code: "INSUFFICIENT_CONTENT" });
  });

  it("lọc theo đơn vị trọng tâm (ôn b–d): mọi câu đều nhắm đúng nhóm đơn vị", () => {
    const result = generateExerciseSet(
      demoRequest("visual_match", "foundation", { focusUnits: new Set(["phoneme:b", "phoneme:d"]), minCount: 1 }),
    );
    if (!result.ok) throw new Error(result.message);
    for (const item of result.set.items) {
      expect(item.objective.focusUnits.some((unit) => unit === "phoneme:b" || unit === "phoneme:d")).toBe(true);
    }
  });
});

describe("hai chế độ nội dung", () => {
  it("bản chơi thử không bao giờ dùng hồ sơ của lớp thật", () => {
    expect(generateExerciseSet(demoRequest("missing_onset", "developing", { profile: class1a2 }))).toMatchObject({
      ok: false,
      code: "DEMO_REQUIRES_ILLUSTRATIVE_PROFILE",
    });
  });

  it("học thật: hồ sơ chưa xác nhận → PROFILE_NOT_CONFIRMED (lớp 1A2 và hồ sơ minh họa)", () => {
    for (const profile of [class1a2, demoRequest("missing_onset").profile]) {
      expect(generateExerciseSet({ ...demoRequest("missing_onset"), mode: "production", profile })).toMatchObject({
        ok: false,
        code: "PROFILE_NOT_CONFIRMED",
      });
    }
  });

  it("học thật với dữ liệu thật hiện nay (0 mục đã duyệt) → không có bài hợp lệ", () => {
    const result = generateExerciseSet({
      ...demoRequest("missing_onset"),
      mode: "production",
      profile: confirmedProfile,
    });
    expect(result).toMatchObject({ ok: false, code: "INSUFFICIENT_CONTENT" });
    if (result.ok) return;
    expect(result.diagnostics.produced).toBe(0);
  });

  it("học thật CHỈ dùng nội dung đã duyệt (kho giả lập trong bộ nhớ có vài tiếng đã duyệt + câu lệnh đã ghi âm)", () => {
    const approved = ["kẻ", "ghế", "gà", "cá", "nghé"];
    const result = generateExerciseSet({
      ...demoRequest("missing_onset"),
      kb: approvedKb(approved),
      media: mediaWithInstruction("missing_onset"),
      mode: "production",
      profile: confirmedProfile,
      count: 3,
      minCount: 1,
      allowPreviewOnly: false,
    });
    if (!result.ok)
      throw new Error(`${result.code}: ${result.message} ${JSON.stringify(result.diagnostics.rejectedByCode)}`);
    for (const item of result.set.items) {
      if (item.variant !== "missing_onset") throw new Error("sai biến thể");
      expect(approved).toContain(item.answer.result);
      expect(item.audio.instruction.assetId).toBe("audio:test-missing_onset");
    }
    expect(result.set.warnings.map((entry) => entry.code)).not.toContain("DEMO_UNREVIEWED_CONTENT");
  });
});

describe("cặp bài ở nhà – bài ở lớp (bài sinh đôi)", () => {
  for (const [variant, band] of [
    ["picture_onset", "foundation"],
    ["missing_onset", "developing"],
    ["visual_match", "foundation"],
    ["sentence_picture", "extending"],
    ["comprehension_question", "extending"],
  ] as const) {
    it(`${variant}: cùng dạng, cùng mục tiêu, độ khó chênh ≤ 1, khác nội dung, không trùng đáp án y hệt`, () => {
      const pair = generateHomeClassPair({
        ...demoRequest(variant, band),
        count: 3,
        classroomCount: 3,
        minCount: 2,
        homeSupportLevel: 3,
      });
      if (!pair.ok) throw new Error(pair.message);
      expect(pair.home.variant).toBe(pair.classroom.variant);
      expect(pair.equivalence.sameObjective).toBe(true);
      expect(pair.equivalence.sharedTargets).toEqual([]);
      expect(pair.home.keys.filter((key) => pair.classroom.keys.includes(key))).toEqual([]);
      expect(pair.equivalence.identicalAnswerKey).toBe(false);
      expect(pair.equivalence.difficulty.withinOneLevel).toBe(true);
      for (const twin of pair.equivalence.twins) {
        const home = pair.home.items.find((item) => item.id === twin.homeItemId);
        const classroom = pair.classroom.items.find((item) => item.id === twin.classroomItemId);
        expect([...(home?.objective.focusUnits ?? [])].sort()).toEqual(
          [...(classroom?.objective.focusUnits ?? [])].sort(),
        );
        expect(Math.abs((home?.difficulty ?? 0) - (classroom?.difficulty ?? 9))).toBeLessThanOrEqual(1);
        expect(moduleOf(home as ExerciseItem).reveal(home as ExerciseItem).answerText).toBeTruthy();
      }
      expect(pair.equivalence.caveat).toContain("chưa được kiểm chứng");
    });
  }

  it("hợp đồng dữ liệu có đủ 8 thông tin; phiếu ở lớp luôn H0, cùng câu lệnh với ứng dụng", () => {
    const pair = generateHomeClassPair({ ...demoRequest("missing_onset"), count: 3, minCount: 2, homeSupportLevel: 2 });
    if (!pair.ok) throw new Error(pair.message);
    const { home, classroom } = pair.contracts;
    for (const contract of [home, classroom]) {
      expect(contract.learningObjective.code).toBe("apply_spelling_rule");
      expect(contract.exerciseType).toBe("fill_blank");
      expect(contract.difficulty.basis).toBe("structural_estimate");
      expect(contract.requiredKnowledge.length).toBeGreaterThan(0);
      expect(contract.answerKey).toHaveLength(contract.worksheet.items.length);
      expect(contract.variantMetadata.seed).toBeTruthy();
      expect(contract.worksheet.instruction).toBe("Chọn chữ còn thiếu.");
    }
    expect(home.supportLevel).toBe(2);
    expect(classroom.supportLevel).toBe(0);
    // Phiếu in cho học sinh không chứa đáp án.
    for (const [index, item] of classroom.worksheet.items.entries()) {
      expect(JSON.stringify(item.printed)).not.toContain(classroom.answerKey[index]?.answer ?? "\u0000");
    }
  });

  it("không đủ ngữ liệu cho bài ở lớp → trả lý do rõ ràng, bài ở nhà vẫn dùng được", () => {
    const pair = generateHomeClassPair({
      ...demoRequest("missing_rime", "developing"),
      count: 6,
      classroomCount: 6,
      minCount: 6,
      homeSupportLevel: 2,
    });
    expect(pair.ok).toBe(false);
    if (pair.ok) return;
    expect(pair.code).toBe("INSUFFICIENT_CONTENT_FOR_PAIR");
    expect(pair.message).toMatch(/bài sinh đôi/u);
  });

  it("buildTaskContract dùng được cho mọi bộ bài", () => {
    const result = generateExerciseSet(demoRequest("arrange_words", "extending"));
    if (!result.ok) throw new Error(result.message);
    const contract = buildTaskContract(result.set, "home", 1);
    expect(contract.worksheet.items.every((item) => item.layout === "arrange_write_sentence")).toBe(true);
  });
});
