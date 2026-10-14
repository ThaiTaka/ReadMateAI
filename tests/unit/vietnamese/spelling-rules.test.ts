import { describe, expect, it } from "vitest";
import { KNOWLEDGE_BASE } from "@/features/knowledge/default-kb";
import { diagnoseSyllable } from "@/lib/vietnamese/diagnostics";
import { checkSpelling, ONSET_BY_VOWEL_RULES, SPELLING_RULE_SPECS, STOP_CODAS } from "@/lib/vietnamese/spelling-rules";
import { analyzeSyllable } from "@/lib/vietnamese/syllable";

const inventory = KNOWLEDGE_BASE.inventory;

function spellingOf(text: string) {
  const result = analyzeSyllable(text, inventory);
  if (result.status !== "ok") throw new Error(`"${text}" không phân tích được`);
  return checkSpelling(result.analysis);
}

describe("tiếng viết đúng không bị báo lỗi chính tả", () => {
  it.each([
    "kẻ",
    "kìa",
    "kỳ",
    "kiến",
    "cá",
    "cô",
    "cua",
    "của",
    "ghế",
    "ghi",
    "gà",
    "gỗ",
    "goá",
    "nghé",
    "nghỉ",
    "ngõ",
    "ngà",
    "ngoan",
    "quả",
    "quê",
    "yên",
    "tiên",
    "thuyền",
    "sách",
    "học",
    "đẹp",
    "mắt",
    "tốt",
  ])("%s", (text) => {
    expect(spellingOf(text)).toEqual([]);
  });
});

describe("vi phạm quy tắc chính tả chắc chắn — có gợi ý, không tự sửa", () => {
  it.each([
    ["cẻ", "SPELLING_C_K", "kẻ"],
    ["cê", "SPELLING_C_K", "kê"],
    ["cìa", "SPELLING_C_K", "kìa"],
    ["kà", "SPELLING_C_K", "cà"],
    ["kô", "SPELLING_C_K", "cô"],
    ["gế", "SPELLING_G_GH", "ghế"],
    ["ge", "SPELLING_G_GH", "ghe"],
    ["ghà", "SPELLING_G_GH", "gà"],
    ["ghô", "SPELLING_G_GH", "gô"],
    ["ngé", "SPELLING_NG_NGH", "nghé"],
    ["ngỉ", "SPELLING_NG_NGH", "nghỉ"],
    ["nghà", "SPELLING_NG_NGH", "ngà"],
    ["nghô", "SPELLING_NG_NGH", "ngô"],
    ["coa", "SPELLING_QU", "qua"],
    ["coá", "SPELLING_QU", "quá"],
    ["còa", "SPELLING_QU", "quà"],
    ["kuê", "SPELLING_QU", "quê"],
    ["cuân", "SPELLING_QU", "quân"],
    ["iên", "SPELLING_IE_YE", "yên"],
    ["iến", "SPELLING_IE_YE", "yến"],
    ["tyên", "SPELLING_IE_YE", "tiên"],
    ["tyến", "SPELLING_IE_YE", "tiến"],
  ])("%s → %s, gợi ý %s", (text, code, suggestion) => {
    const issues = spellingOf(text);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ code, suggestion });
  });

  it.each(["bàt", "sach", "cảc", "mãp", "hòc", "sảch"])(
    "%s: âm cuối p, t, c, ch đi với thanh khác sắc/nặng",
    (text) => {
      expect(spellingOf(text).map((issue) => issue.code)).toEqual(["TONE_STOP_CODA"]);
    },
  );

  it("một tiếng có thể vi phạm nhiều quy tắc cùng lúc", () => {
    expect(spellingOf("kàt").map((issue) => issue.code)).toEqual(["SPELLING_C_K", "TONE_STOP_CODA"]);
  });

  it("mỗi lỗi gắn với mã quy tắc trong kho tri thức", () => {
    const ruleIds = new Set(KNOWLEDGE_BASE.rules.map((rule) => rule.id));
    for (const text of ["cẻ", "gế", "ngé", "coa", "iên", "bàt"]) {
      for (const issue of spellingOf(text)) expect(ruleIds.has(issue.ruleId)).toBe(true);
    }
  });
});

describe("đặc tả quy tắc dùng chung giữa mã và dữ liệu", () => {
  it("ba quy tắc chọn chữ theo nguyên âm đứng sau", () => {
    expect(ONSET_BY_VOWEL_RULES.map((rule) => `${rule.elsewhere}/${rule.beforeFrontVowel}`)).toEqual([
      "c/k",
      "g/gh",
      "ng/ngh",
    ]);
    expect(STOP_CODAS).toEqual(["p", "t", "c", "ch"]);
  });

  it("spec trong content/kb/rules.json trùng khớp với hằng số của bộ máy", () => {
    for (const [ruleId, spec] of Object.entries(SPELLING_RULE_SPECS)) {
      const rule = KNOWLEDGE_BASE.rules.find((entry) => entry.id === ruleId);
      expect(rule?.spec).toEqual(spec);
    }
  });

  it("mọi ví dụ đúng/sai trong rules.json cho kết quả như mô tả", () => {
    for (const rule of KNOWLEDGE_BASE.rules) {
      for (const example of rule.examples) expect(diagnoseSyllable(example, inventory).status).toBe("ok");
      for (const counter of rule.counterExamples) {
        const found = diagnoseSyllable(counter.text, inventory).diagnostics.map((diagnostic) => diagnostic.code);
        expect(found).toContain(counter.expectedCode);
      }
    }
  });
});

describe("chẩn đoán một tiếng (diagnoseSyllable)", () => {
  it("phân biệt lỗi (error) với điểm cần GV rà soát (warning)", () => {
    expect(diagnoseSyllable("kà", inventory)).toMatchObject({ status: "error" });
    expect(diagnoseSyllable("quả", inventory)).toMatchObject({
      status: "ok",
      diagnostics: [{ code: "CONVENTION_DEPENDENT", severity: "warning", ruleId: "syllable.qu_onset" }],
    });
    expect(diagnoseSyllable("quýt", inventory)).toMatchObject({
      status: "unverified",
      diagnostics: [{ code: "AMBIGUOUS_QU_Y", severity: "warning" }],
    });
    expect(diagnoseSyllable("hửm", inventory)).toMatchObject({ status: "unverified" });
    expect(diagnoseSyllable("ba", inventory)).toMatchObject({ status: "ok", diagnostics: [] });
  });

  it("vị trí dấu: sai chắc chắn là lỗi, khác kiểu đặt dấu chỉ là cảnh báo", () => {
    expect(diagnoseSyllable("muà", inventory).diagnostics).toMatchObject([
      { code: "TONE_MARK_MISPLACED", severity: "error" },
    ]);
    expect(diagnoseSyllable("hòa", inventory).diagnostics).toMatchObject([
      { code: "TONE_PLACEMENT_CONVENTION", severity: "warning" },
    ]);
  });
});
