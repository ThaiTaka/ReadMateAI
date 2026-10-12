import { describe, expect, it } from "vitest";
import { equalsNFC, isNFC, toNFC } from "@/lib/vietnamese/normalize";

describe("chuẩn hóa Unicode tiếng Việt", () => {
  const composed = "Tiếng Việt";
  const decomposed = composed.normalize("NFD");

  it("phân biệt được dạng dựng sẵn (NFC) và dạng tổ hợp (NFD)", () => {
    expect(decomposed).not.toBe(composed);
    expect(decomposed.length).toBeGreaterThan(composed.length);
    expect(isNFC(composed)).toBe(true);
    expect(isNFC(decomposed)).toBe(false);
  });

  it("toNFC đưa dạng tổ hợp về dạng dựng sẵn", () => {
    expect(toNFC(decomposed)).toBe(composed);
  });

  it("equalsNFC coi hai cách mã hóa của cùng một chữ là bằng nhau", () => {
    expect(equalsNFC(decomposed, composed)).toBe(true);
  });

  it("equalsNFC vẫn phân biệt dấu thanh", () => {
    expect(equalsNFC("bà", "ba")).toBe(false);
    expect(equalsNFC("bà", "bá")).toBe(false);
    expect(equalsNFC("hỏi", "hõi")).toBe(false);
  });

  it.each(["a", "à", "á", "ả", "ã", "ạ", "ă", "ằ", "ẫ", "ặ", "ổ", "ượ", "đ"])(
    "'%s' sau chuẩn hóa là ký tự dựng sẵn",
    (letter) => {
      const normalized = toNFC(letter.normalize("NFD"));
      expect(normalized).toBe(letter);
      expect(isNFC(normalized)).toBe(true);
    },
  );
});
