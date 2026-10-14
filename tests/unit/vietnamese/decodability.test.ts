import { describe, expect, it } from "vitest";
import { KNOWLEDGE_BASE } from "@/features/knowledge/default-kb";
import {
  checkDecodability,
  requiredUnitsOf,
  UNSET_CONVENTIONS,
  type LanguageConventions,
} from "@/lib/vietnamese/decodability";
import { analyzeSyllable } from "@/lib/vietnamese/syllable";

const inventory = KNOWLEDGE_BASE.inventory;
const CONFIRMED: LanguageConventions = {
  quAnalysis: "qu_onset",
  giAnalysis: "gi_onset",
  giSharedI: "shared_i",
  tonePlacement: "on_main_vowel",
};

const check = (text: string, taught: string[], conventions: LanguageConventions = CONFIRMED) =>
  checkDecodability(text, { inventory, taughtUnits: new Set(taught), conventions });

function unitsOf(text: string) {
  const result = analyzeSyllable(text, inventory);
  if (result.status !== "ok") throw new Error(text);
  return requiredUnitsOf(result.analysis);
}

describe("đơn vị kiến thức cần biết của một tiếng", () => {
  it.each([
    ["ba", { onset: "phoneme:b", rime: "phoneme:a", tone: "tone:ngang" }],
    ["bàn", { onset: "phoneme:b", rime: "rime:an", tone: "tone:huyen" }],
    ["ăn", { onset: null, rime: "rime:ăn", tone: "tone:ngang" }],
    ["mía", { onset: "phoneme:m", rime: "rime:ia", tone: "tone:sac" }],
    ["nghé", { onset: "phoneme:ngh", rime: "phoneme:e", tone: "tone:sac" }],
    ["quả", { onset: "phoneme:qu", rime: "phoneme:a", tone: "tone:hoi" }],
    ["gì", { onset: "phoneme:gi", rime: "phoneme:i", tone: "tone:huyen" }],
    ["hoa", { onset: "phoneme:h", rime: "rime:oa", tone: "tone:ngang" }],
  ])("%s", (text, expected) => {
    expect(unitsOf(text)).toEqual(expected);
  });
});

describe("kết luận giải mã: readable / not_yet_learned", () => {
  it("đọc được khi mọi đơn vị đã học", () => {
    const result = check("bà", ["phoneme:b", "phoneme:a", "tone:huyen"]);
    expect(result.verdict).toBe("readable");
    expect(result.knownUnits).toEqual(["phoneme:b", "phoneme:a", "tone:huyen"]);
    expect(result.missingUnits).toEqual([]);
  });

  it("chưa học thanh → not_yet_learned, chỉ rõ thanh còn thiếu", () => {
    const result = check("bà", ["phoneme:b", "phoneme:a", "tone:ngang"]);
    expect(result.verdict).toBe("not_yet_learned");
    expect(result.missingUnits).toEqual(["tone:huyen"]);
    expect(result.reasons[0]?.code).toBe("UNITS_NOT_TAUGHT");
  });

  it("chưa học âm đầu → not_yet_learned", () => {
    expect(check("nghé", ["phoneme:e", "tone:sac", "phoneme:ng"]).missingUnits).toEqual(["phoneme:ngh"]);
  });

  it("biết a và n nhưng chưa học vần an thì KHÔNG coi là đọc được (không tự ghép vần)", () => {
    const result = check("bàn", ["phoneme:b", "phoneme:a", "phoneme:n", "tone:huyen"]);
    expect(result.verdict).toBe("not_yet_learned");
    expect(result.missingUnits).toEqual(["rime:an"]);
  });

  it("học vần ia không có nghĩa đã học âm i — và ngược lại", () => {
    expect(check("mía", ["phoneme:m", "phoneme:i", "phoneme:a", "tone:sac"]).missingUnits).toEqual(["rime:ia"]);
    expect(check("mì", ["phoneme:m", "rime:ia", "tone:huyen"]).missingUnits).toEqual(["phoneme:i"]);
  });

  it("biết gh không có nghĩa đã biết g (hai cách viết là hai đơn vị)", () => {
    expect(check("gà", ["phoneme:gh", "phoneme:a", "tone:huyen"]).verdict).toBe("not_yet_learned");
  });

  it("tập đã học rỗng → mọi tiếng đều chưa học", () => {
    expect(check("ba", []).verdict).toBe("not_yet_learned");
  });
});

describe("quy ước chưa xác nhận → unknown, không mặc định là đọc được", () => {
  const taught = ["phoneme:qu", "phoneme:a", "tone:hoi", "phoneme:gi", "phoneme:o", "phoneme:i", "tone:huyen"];

  it("quả: dù đã học mọi đơn vị, quy ước qu chưa xác nhận thì là unknown", () => {
    const result = check("quả", taught, UNSET_CONVENTIONS);
    expect(result.verdict).toBe("unknown");
    expect(result.unverifiable[0]).toMatchObject({ token: "quả", code: "CONVENTION_NOT_CONFIRMED" });
  });

  it("quả: quy ước đã xác nhận → readable", () => {
    expect(check("quả", taught).verdict).toBe("readable");
  });

  it("thiếu thanh thì chắc chắn chưa học, dù quy ước chưa xác nhận", () => {
    expect(check("quá", taught, UNSET_CONVENTIONS).verdict).toBe("not_yet_learned");
  });

  it("gì cần cả quy ước gi là âm đầu lẫn chữ i dùng chung", () => {
    expect(check("gì", taught, { ...CONFIRMED, giSharedI: null }).verdict).toBe("unknown");
    expect(check("gì", taught).verdict).toBe("readable");
    expect(check("giỏ", taught, { ...CONFIRMED, giSharedI: null }).verdict).toBe("readable");
  });

  it("qu + y mơ hồ → unknown kể cả khi quy ước qu đã xác nhận", () => {
    const result = check("quýt", ["phoneme:qu", "rime:uyt", "rime:yt", "tone:sac"]);
    expect(result.verdict).toBe("unknown");
    expect(result.unverifiable[0]?.code).toBe("PARSE_AMBIGUOUS");
  });

  it("vần ngoài danh mục → unknown", () => {
    expect(check("hửm", ["phoneme:h", "tone:hoi"]).verdict).toBe("unknown");
  });
});

describe("văn bản sai chính tả → invalid, bất kể đã học gì", () => {
  it.each(["kà", "gế", "muà", "bàt", "mian", "fan"])("%s", (text) => {
    expect(check(text, ["phoneme:k", "phoneme:a", "tone:huyen"]).verdict).toBe("invalid");
  });

  it("chuỗi rỗng hoặc chỉ có dấu câu → invalid", () => {
    expect(check("", []).reasons[0]?.code).toBe("EMPTY_TEXT");
    expect(check("...", []).verdict).toBe("invalid");
  });
});

describe("kiểm tra cả câu", () => {
  const taught = [
    "phoneme:b",
    "phoneme:e",
    "phoneme:đ",
    "phoneme:i",
    "phoneme:ô",
    "tone:sac",
    "tone:ngang",
    "tone:nang",
  ];

  it("bỏ qua dấu câu, gộp đơn vị của mọi tiếng (không trùng lặp)", () => {
    const result = check("Bé đi bộ.", taught);
    expect(result.verdict).toBe("readable");
    expect(result.syllables).toHaveLength(3);
    expect(result.requiredUnits).toEqual([
      "phoneme:b",
      "phoneme:e",
      "tone:sac",
      "phoneme:đ",
      "phoneme:i",
      "tone:ngang",
      "phoneme:ô",
      "tone:nang",
    ]);
  });

  it("nhắc GV khi câu có chữ hoa", () => {
    expect(check("Bé đi bộ.", taught).caveats.map((caveat) => caveat.code)).toContain("UPPERCASE_LETTERS");
  });

  it("chữ số và ký hiệu lạ là unknown", () => {
    expect(check("Bé có 2 bi.", taught).unverifiable.map((item) => item.code)).toContain("NUMBER_TOKEN");
    expect(check("bé @ bi", taught).unverifiable.map((item) => item.code)).toContain("UNSUPPORTED_SYMBOL");
  });

  it("thứ tự ưu tiên kết luận: invalid > not_yet_learned > unknown > readable", () => {
    expect(check("bé kà mèo", taught).verdict).toBe("invalid");
    expect(check("bé hửm mèo", taught).verdict).toBe("not_yet_learned");
    expect(check("bé hửm", taught).verdict).toBe("unknown");
    expect(check("bé", taught).verdict).toBe("readable");
  });

  it("nêu rõ từng tiếng thiếu đơn vị nào", () => {
    const result = check("bé đi học", taught);
    expect(result.verdict).toBe("not_yet_learned");
    expect(result.missingUnits).toEqual(["phoneme:h", "rime:oc"]);
    expect(result.syllables.map((syllable) => syllable.status)).toEqual(["readable", "readable", "not_yet_learned"]);
  });
});

describe("kiểu đặt dấu: chỉ là lưu ý, không đổi kết luận", () => {
  const taught = ["phoneme:h", "rime:oa", "tone:huyen"];
  it.each([
    [null, ["TONE_PLACEMENT_CONVENTION"]],
    ["traditional", ["TONE_PLACEMENT_STYLE_MISMATCH"]],
    ["either", []],
    ["on_main_vowel", []],
  ] as const)("hoà với quy ước %s", (style, caveats) => {
    const result = check("hoà", taught, { ...CONFIRMED, tonePlacement: style });
    expect(result.verdict).toBe("readable");
    expect(result.caveats.map((caveat) => caveat.code)).toEqual(caveats);
  });
});
