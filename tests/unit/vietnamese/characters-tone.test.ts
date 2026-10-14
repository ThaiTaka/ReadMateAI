import { describe, expect, it } from "vitest";
import {
  FOREIGN_LATIN_LETTERS,
  isAlphabetLetter,
  isVowelLetter,
  VIETNAMESE_ALPHABET,
  VOWEL_LETTERS,
} from "@/lib/vietnamese/characters";
import { applyTone, extractTone, stripTones, TONE_COMBINING_MARKS, TONE_IDS, toneOfMark } from "@/lib/vietnamese/tone";

describe("bảng chữ cái tiếng Việt", () => {
  it("có đúng 29 chữ cái theo thứ tự chuẩn", () => {
    expect(VIETNAMESE_ALPHABET).toHaveLength(29);
    expect(VIETNAMESE_ALPHABET.join(" ")).toBe("a ă â b c d đ e ê g h i k l m n o ô ơ p q r s t u ư v x y");
  });

  it("có 12 nguyên âm và 17 phụ âm", () => {
    expect(VOWEL_LETTERS.size).toBe(12);
    expect(VIETNAMESE_ALPHABET.filter((letter) => !isVowelLetter(letter))).toHaveLength(17);
  });

  it("mỗi chữ cái có chữ hoa riêng và quay lại đúng chữ thường (kể cả Đ, Ư, Ơ)", () => {
    for (const letter of VIETNAMESE_ALPHABET) {
      const upper = letter.toUpperCase();
      expect(upper).not.toBe(letter);
      expect(upper.toLowerCase()).toBe(letter);
    }
    expect("đ".toUpperCase()).toBe("Đ");
  });

  it.each(["f", "j", "w", "z"])("'%s' không thuộc bảng chữ cái tiếng Việt", (letter) => {
    expect(FOREIGN_LATIN_LETTERS.has(letter)).toBe(true);
    expect(isAlphabetLetter(letter)).toBe(false);
  });

  it("chữ có dấu thanh không phải là chữ cái riêng", () => {
    expect(isAlphabetLetter("á")).toBe(false);
    expect(isAlphabetLetter("ế")).toBe(false);
    expect(isAlphabetLetter("ê")).toBe(true);
  });

  it("phân biệt Đ (U+0110) với \u00D0 Iceland (U+00D0) trông giống nhau", () => {
    expect(isAlphabetLetter("\u00D0".toLowerCase())).toBe(false);
    expect(isAlphabetLetter("Đ".toLowerCase())).toBe(true);
  });
});

describe("sáu thanh và dấu thanh", () => {
  it("có đúng sáu thanh, thanh ngang không có dấu", () => {
    expect(TONE_IDS).toEqual(["ngang", "huyen", "sac", "hoi", "nga", "nang"]);
    expect(Object.keys(TONE_COMBINING_MARKS)).not.toContain("ngang");
  });

  it.each([
    ["a", "ngang"],
    ["à", "huyen"],
    ["á", "sac"],
    ["ả", "hoi"],
    ["ã", "nga"],
    ["ạ", "nang"],
  ] as const)("'%s' mang thanh %s", (text, tone) => {
    const result = extractTone(text);
    expect(result.ok && result.tone).toBe(tone);
    expect(result.ok && result.base).toBe("a");
  });

  it.each(Object.entries(TONE_COMBINING_MARKS))("dấu tổ hợp của thanh %s được nhận ra", (tone, mark) => {
    expect(toneOfMark(mark)).toBe(tone);
  });

  it("dấu mũ, dấu móc, dấu trăng không phải dấu thanh", () => {
    expect(toneOfMark("\u0302")).toBeNull();
    expect(toneOfMark("\u031B")).toBeNull();
    expect(toneOfMark("\u0306")).toBeNull();
  });

  it.each([
    ["người", "ngươi", "huyen", 3],
    ["tiếng", "tiêng", "sac", 2],
    ["việt", "viêt", "nang", 2],
    ["quả", "qua", "hoi", 2],
    ["ba", "ba", "ngang", null],
  ] as const)("'%s' → chữ gốc '%s', thanh %s, dấu ở vị trí %s", (text, base, tone, index) => {
    expect(extractTone(text)).toEqual({ ok: true, base, tone, markIndex: index });
  });

  it.each(["Tiếng", "người", "khuỷu", "ượt", "đặt"])("'%s' ở dạng NFD cho cùng kết quả như NFC", (word) => {
    const lower = word.toLowerCase();
    expect(extractTone(lower.normalize("NFD"))).toEqual(extractTone(lower));
  });

  it("báo lỗi khi một tiếng có hai dấu thanh", () => {
    expect(extractTone("mèó")).toMatchObject({ ok: false, code: "MULTIPLE_TONE_MARKS" });
  });

  it("báo lỗi khi dấu thanh nằm trên phụ âm (\u1E3F)", () => {
    expect(extractTone("\u1E3Fa")).toMatchObject({ ok: false, code: "TONE_MARK_ON_CONSONANT" });
  });

  it("báo lỗi khi còn dấu tổ hợp không gắn được vào chữ", () => {
    expect(extractTone("b\u0300a")).toMatchObject({ ok: false, code: "STRAY_COMBINING_MARK" });
  });

  it("báo lỗi với dấu không thuộc chữ viết tiếng Việt (ö, ç)", () => {
    expect(extractTone("ö")).toMatchObject({ ok: false, code: "UNKNOWN_MARK" });
    expect(extractTone("ça")).toMatchObject({ ok: false, code: "UNKNOWN_MARK" });
  });

  it("stripTones bỏ dấu thanh nhưng giữ ă, â, ê, ô, ơ, ư, đ", () => {
    expect(stripTones("Tiếng Việt")).toBe("Tiêng Viêt");
    expect(stripTones("đường phố")).toBe("đương phô");
    expect(stripTones("ăn ấm ở")).toBe("ăn âm ơ");
  });

  it.each(TONE_IDS)("applyTone đặt đúng thanh %s và tách lại được", (tone) => {
    const toned = applyTone("ngươi", tone, tone === "ngang" ? null : 3);
    const extracted = extractTone(toned);
    expect(extracted.ok && extracted.tone).toBe(tone);
    expect(extracted.ok && extracted.base).toBe("ngươi");
  });

  it("applyTone báo lỗi khi vị trí nằm ngoài chuỗi", () => {
    expect(() => applyTone("ba", "sac", 5)).toThrow(RangeError);
  });
});
