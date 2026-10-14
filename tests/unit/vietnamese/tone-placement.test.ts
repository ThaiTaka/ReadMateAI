import { describe, expect, it } from "vitest";
import { KNOWLEDGE_BASE } from "@/features/knowledge/default-kb";
import { analyzeSyllable } from "@/lib/vietnamese/syllable";
import { checkTonePlacement, expectedToneIndex } from "@/lib/vietnamese/tone-placement";

function placement(text: string) {
  const result = analyzeSyllable(text, KNOWLEDGE_BASE.inventory);
  if (result.status !== "ok") throw new Error(`"${text}" không phân tích được`);
  return checkTonePlacement(result.analysis);
}

describe("vị trí dấu thanh mà mọi kiểu đặt dấu đều thống nhất", () => {
  it.each([
    "mùa",
    "của",
    "mía",
    "cửa",
    "người",
    "muốn",
    "tiếng",
    "quả",
    "già",
    "giếng",
    "khuấy",
    "ngoái",
    "hoàn",
    "thuyền",
    "soóc",
    "khuỷu",
    "huệ",
    "thuở",
  ])("%s đặt dấu đúng", (text) => {
    expect(placement(text).status).toBe("ok");
  });

  it.each(["ba", "hoa", "khuya", "ngươi"])("%s không có dấu thanh", (text) => {
    expect(placement(text).status).toBe("no_mark");
  });
});

describe("hai kiểu đặt dấu (hoà/hòa) — phụ thuộc quy ước nhà trường", () => {
  it.each([
    ["hoà", "on_main_vowel"],
    ["hòa", "traditional"],
    ["khoẻ", "on_main_vowel"],
    ["khỏe", "traditional"],
    ["thuỷ", "on_main_vowel"],
    ["thủy", "traditional"],
    ["luỹ", "on_main_vowel"],
    ["lũy", "traditional"],
  ])("%s → kiểu %s", (text, style) => {
    expect(placement(text)).toMatchObject({ status: "style_dependent", matches: style });
  });

  it("khi có âm cuối, cả hai kiểu đều đặt trên âm chính (hoàn, không phải hòan)", () => {
    expect(placement("hoàn").status).toBe("ok");
    expect(placement("hòan").status).toBe("misplaced");
  });
});

describe("dấu đặt sai theo mọi kiểu → lỗi chắc chắn", () => {
  it.each(["muà", "qủa", "gìa", "tíêng", "ngứơi", "mià"])("%s đặt dấu sai", (text) => {
    expect(placement(text).status).toBe("misplaced");
  });
});

describe("expectedToneIndex", () => {
  it("tính vị trí theo cấu tạo tiếng", () => {
    expect(expectedToneIndex({ rimeStart: 1, medial: "o", nucleus: "a", coda: null })).toEqual({
      on_main_vowel: 2,
      traditional: 1,
    });
    expect(expectedToneIndex({ rimeStart: 2, medial: null, nucleus: "ươ", coda: "i" })).toEqual({
      on_main_vowel: 3,
      traditional: 3,
    });
    expect(expectedToneIndex({ rimeStart: 1, medial: null, nucleus: "ua", coda: null })).toEqual({
      on_main_vowel: 1,
      traditional: 1,
    });
  });
});
