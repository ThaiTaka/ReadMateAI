import { describe, expect, it } from "vitest";
import { alwaysForbiddenRoles, decideBeforeGrading, decideAfterGrading } from "@/features/exercises/core/audio";
import { checkTextLeaks, containsForm, contiguousPhrases, syllableSequence } from "@/features/exercises/core/leaks";
import { SUPPORT_POLICIES } from "@/features/exercises/core/support";
import { VARIANTS } from "@/features/exercises/registry";
import type { SupportLevel } from "@/types/learning";

const LEVELS: SupportLevel[] = [3, 2, 1, 0];

describe("so khớp chống lộ đáp án theo ranh giới tiếng", () => {
  it("không phân biệt hoa thường, chịu được NFD, bỏ dấu câu", () => {
    expect(syllableSequence("Con Cá bơi.")).toEqual(["con", "cá", "bơi"]);
    expect(containsForm("Con cá bơi.", "cá")).toBe(true);
    expect(containsForm("Con cá bơi.", "ca\u0301")).toBe(true);
    expect(containsForm("CÁ VÀNG", "cá vàng")).toBe(true);
  });

  it("theo ranh giới tiếng: chữ c không khớp tiếng cá; cá không khớp cà; quả cam không khớp quả na", () => {
    expect(containsForm("cá", "c")).toBe(false);
    expect(containsForm("chữ c đứng trước", "c")).toBe(true);
    expect(containsForm("bà có cà", "cá")).toBe(false);
    expect(containsForm("quả na", "quả cam")).toBe(false);
  });

  it("chuỗi con liên tiếp ≥ 2 tiếng (quy tắc A3 cho câu)", () => {
    expect(contiguousPhrases("Mẹ đi chợ.", 2)).toEqual(["mẹ đi", "đi chợ", "mẹ đi chợ"]);
  });

  it("chữ được phép ở trường đã khai báo, bị chặn ở trường khác", () => {
    const forbidden = [{ form: "ba lô", reason: "tên tranh", allowedIn: ["stimulus_text"] as const }];
    expect(checkTextLeaks({ exposed: [{ field: "stimulus_text", text: "ba lô" }], forbidden })).toEqual([]);
    const leaks = checkTextLeaks({ exposed: [{ field: "picture_label", text: "Hình: ba lô" }], forbidden });
    expect(leaks.map((entry) => entry.code)).toEqual(["TEXT_LEAKS_ANSWER"]);
  });
});

describe("chính sách âm thanh theo mục tiêu học tập (PRD §9.2, §12)", () => {
  const rule = (variant: keyof typeof VARIANTS, role: "instruction" | "stimulus" | "options", level: SupportLevel) =>
    decideBeforeGrading(VARIANTS[variant].audioPolicy, role, level);

  it("câu lệnh: H3 tự phát, H2 chạm loa, H1 qua Trợ giúp (tính là gợi ý), H0 không phát", () => {
    for (const variant of Object.keys(VARIANTS) as Array<keyof typeof VARIANTS>) {
      expect(rule(variant, "instruction", 3)).toEqual({ permitted: true, countsAsHint: false, autoPlay: true });
      expect(rule(variant, "instruction", 2)).toEqual({ permitted: true, countsAsHint: false, autoPlay: false });
      expect(rule(variant, "instruction", 1)).toEqual({ permitted: true, countsAsHint: true, autoPlay: false });
      expect(rule(variant, "instruction", 0).permitted).toBe(false);
    }
  });

  it("bài đọc (đọc từ, đọc câu): KHÔNG phát từ/câu cần đọc ở mọi mức trước khi chấm; nghe mẫu sau khi chấm", () => {
    for (const variant of [
      "choose_picture",
      "match_pairs",
      "sentence_picture",
      "comprehension_question",
      "arrange_words",
    ] as const) {
      for (const level of LEVELS) {
        expect(rule(variant, "stimulus", level).permitted).toBe(false);
        expect(rule(variant, "options", level).permitted).toBe(false);
      }
      expect(decideAfterGrading(VARIANTS[variant].audioPolicy, "model")).toBe(true);
      expect(alwaysForbiddenRoles(VARIANTS[variant].audioPolicy)).toEqual(["stimulus", "options"]);
    }
  });

  it("bài nghe âm – chọn chữ: âm mục tiêu là chính nhiệm vụ → được phát ở mọi mức, kể cả H0", () => {
    for (const level of LEVELS) expect(rule("listen_letter", "stimulus", level).permitted).toBe(true);
    expect(VARIANTS.listen_letter.audioPolicy.required).toContain("stimulus");
  });

  it("bài nhìn tranh (mã hóa, chính tả): tên tranh H3–H2 được phát, H1 khi bấm (gợi ý), H0 không", () => {
    for (const variant of [
      "picture_onset",
      "picture_build",
      "missing_rime",
      "missing_tone",
      "missing_onset",
    ] as const) {
      expect(rule(variant, "stimulus", 3)).toMatchObject({ permitted: true, countsAsHint: false });
      expect(rule(variant, "stimulus", 2)).toMatchObject({ permitted: true, countsAsHint: false });
      expect(rule(variant, "stimulus", 1)).toMatchObject({ permitted: true, countsAsHint: true });
      expect(rule(variant, "stimulus", 0).permitted).toBe(false);
    }
  });

  it("bài phân tích tiếng: đọc tiếng chỉ là gợi ý ở H3–H2, tắt ở H1–H0", () => {
    for (const variant of ["which_onset", "which_rime", "which_tone"] as const) {
      expect(rule(variant, "stimulus", 3)).toMatchObject({ permitted: true, countsAsHint: true });
      expect(rule(variant, "stimulus", 2)).toMatchObject({ permitted: true, countsAsHint: true });
      expect(rule(variant, "stimulus", 1).permitted).toBe(false);
      expect(rule(variant, "stimulus", 0).permitted).toBe(false);
    }
  });

  it("không dạng bài nào đọc các phương án trước khi chấm", () => {
    for (const variant of Object.keys(VARIANTS) as Array<keyof typeof VARIANTS>) {
      for (const level of LEVELS) expect(rule(variant, "options", level).permitted).toBe(false);
    }
  });

  it("mức hỗ trợ H3 → H0: số lượt, gợi ý, bố cục giảm dần", () => {
    expect([3, 2, 1, 0].map((level) => SUPPORT_POLICIES[level as SupportLevel].maxAttempts)).toEqual([3, 3, 2, 1]);
    expect([3, 2, 1, 0].map((level) => SUPPORT_POLICIES[level as SupportLevel].hints)).toEqual([
      "proactive",
      "on_request",
      "on_request",
      "none",
    ]);
    expect(SUPPORT_POLICIES[3].showWorkedExample).toBe(true);
    expect(SUPPORT_POLICIES[2].showWorkedExample).toBe(false);
    expect(SUPPORT_POLICIES[1].layout).toBe("paper_like");
    expect(SUPPORT_POLICIES[0].layout).toBe("paper_like");
  });

  it("câu lệnh chuẩn của mọi biến thể không chứa tiếng/từ cụ thể nào — chỉ mô tả việc cần làm (A1)", () => {
    for (const definition of Object.values(VARIANTS)) {
      expect(definition.instruction.text.normalize("NFC")).toBe(definition.instruction.text);
      expect(definition.instruction.spoken.length).toBeGreaterThan(definition.instruction.text.length - 5);
      expect(definition.audioPolicy.rationale.length).toBeGreaterThan(20);
    }
  });
});
