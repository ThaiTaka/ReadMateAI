import { describe, expect, it } from "vitest";
import { KNOWLEDGE_BASE } from "@/features/knowledge/default-kb";
import { estimateDifficulty, syllableComplexity } from "@/lib/vietnamese/difficulty";
import { analyzeSyllable, type SyllableAnalysis } from "@/lib/vietnamese/syllable";
import { syllableTokens, tokenize } from "@/lib/vietnamese/tokenize";

const analyses = (text: string): SyllableAnalysis[] =>
  syllableTokens(text).map((token) => {
    const result = analyzeSyllable(token.text, KNOWLEDGE_BASE.inventory);
    if (result.status !== "ok") throw new Error(token.text);
    return result.analysis;
  });

describe("tách token", () => {
  it("phân loại chữ, dấu câu, số, ký hiệu và giữ vị trí", () => {
    expect(tokenize("Bé có bi, có 2 bóng!")).toEqual([
      { kind: "syllable", text: "Bé", start: 0, end: 2 },
      { kind: "syllable", text: "có", start: 3, end: 5 },
      { kind: "syllable", text: "bi", start: 6, end: 8 },
      { kind: "punctuation", text: ",", start: 8, end: 9 },
      { kind: "syllable", text: "có", start: 10, end: 12 },
      { kind: "number", text: "2", start: 13, end: 14 },
      { kind: "syllable", text: "bóng", start: 15, end: 19 },
      { kind: "punctuation", text: "!", start: 19, end: 20 },
    ]);
  });

  it("chuẩn hóa NFC trước khi tách nên dấu không bị tách khỏi chữ", () => {
    const tokens = tokenize("Tiếng Việt".normalize("NFD"));
    expect(tokens.map((token) => token.text)).toEqual(["Tiếng", "Việt"]);
  });

  it("ký hiệu lạ là token riêng", () => {
    expect(tokenize("bé @ bi").map((token) => token.kind)).toEqual(["syllable", "symbol", "syllable"]);
  });

  it("syllableTokens chỉ giữ chuỗi chữ", () => {
    expect(syllableTokens("A, mẹ về!").map((token) => token.text)).toEqual(["A", "mẹ", "về"]);
  });
});

describe("ước lượng độ khó — không chỉ dựa vào độ dài", () => {
  it.each([
    ["ba", 1],
    ["bà", 1],
    ["nghé", 2],
    ["bàn", 2],
    ["hoa", 2],
    ["thuyền", 3],
    ["nghiêng", 3],
  ])("%s → mức %i", (text, level) => {
    expect(estimateDifficulty(analyses(text), "word").level).toBe(level);
  });

  it("từ một tiếng có thể khó hơn từ hai tiếng (thuyền > ba lô)", () => {
    expect(estimateDifficulty(analyses("thuyền"), "word").level).toBeGreaterThan(
      estimateDifficulty(analyses("ba lô"), "word").level,
    );
  });

  it("giải thích được: liệt kê các yếu tố tạo nên điểm", () => {
    const codes = syllableComplexity(analyses("nghiêng")[0] as SyllableAnalysis).factors.map((factor) => factor.code);
    expect(codes).toEqual(["BASE", "ONSET_MULTI_LETTER", "ONSET_SPELLING_VARIANT", "RIME_DIPHTHONG", "RIME_CODA"]);
  });

  it("thanh hỏi, ngã được tính là yếu tố khó (dễ nhầm)", () => {
    expect(syllableComplexity(analyses("cỏ")[0] as SyllableAnalysis).score).toBeGreaterThan(
      syllableComplexity(analyses("cò")[0] as SyllableAnalysis).score,
    );
  });

  it("câu cộng thêm theo số tiếng nhẹ hơn từ", () => {
    const sentence = estimateDifficulty(analyses("bé đi bộ"), "sentence");
    const word = estimateDifficulty(analyses("bé đi bộ"), "word");
    expect(sentence.score).toBeLessThan(word.score);
  });

  it("giới hạn trong khoảng 1–5", () => {
    expect(estimateDifficulty([], "word").level).toBe(1);
    expect(estimateDifficulty(analyses("thuyền nghiêng khuya thuyền nghiêng khuya thuyền"), "word").level).toBe(5);
  });
});
