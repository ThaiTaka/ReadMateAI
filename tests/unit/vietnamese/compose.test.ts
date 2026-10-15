import { describe, expect, it } from "vitest";
import { KNOWLEDGE_BASE } from "@/features/knowledge/default-kb";
import { composeSyllable, joinOnsetRime, tonedRime } from "@/lib/vietnamese/compose";

const inventory = KNOWLEDGE_BASE.inventory;

describe("composeSyllable — ghép âm đầu + vần + thanh (khứ hồi qua bộ phân tích)", () => {
  it.each([
    [{ onset: "b", rime: "a", tone: "huyen" }, "bà"],
    [{ onset: "c", rime: "a", tone: "sac" }, "cá"],
    [{ onset: "ngh", rime: "e", tone: "sac" }, "nghé"],
    [{ onset: "gh", rime: "ê", tone: "sac" }, "ghế"],
    [{ onset: "s", rime: "ach", tone: "sac" }, "sách"],
    [{ onset: "đ", rime: "ap", tone: "nang" }, "đạp"],
    [{ onset: "m", rime: "ưa", tone: "ngang" }, "mưa"],
    [{ onset: "qu", rime: "a", tone: "hoi" }, "quả"],
    [{ onset: "gi", rime: "o", tone: "hoi" }, "giỏ"],
    [{ onset: "gi", rime: "i", tone: "huyen" }, "gì"],
    [{ onset: "th", rime: "uyên", tone: "huyen" }, "thuyền"],
    [{ onset: null, rime: "ăn", tone: "ngang" }, "ăn"],
  ] as const)("%j → %s", (parts, expected) => {
    const result = composeSyllable(parts, inventory);
    expect(result.ok && result.text).toBe(expected);
    expect(result.ok && result.text.normalize("NFC")).toBe(expected);
  });

  it("vần phụ thuộc kiểu đặt dấu (oa, oe, uy không âm cuối): cần kiểu đặt dấu, không tự quyết", () => {
    expect(composeSyllable({ onset: "h", rime: "oa", tone: "huyen" }, inventory)).toMatchObject({
      ok: false,
      code: "TONE_STYLE_REQUIRED",
    });
    const modern = composeSyllable({ onset: "h", rime: "oa", tone: "huyen" }, inventory, "on_main_vowel");
    const traditional = composeSyllable({ onset: "h", rime: "oa", tone: "huyen" }, inventory, "traditional");
    expect(modern.ok && modern.text).toBe("hoà");
    expect(traditional.ok && traditional.text).toBe("hòa");
    expect(modern.ok && modern.styleDependent).toBe(true);
  });

  it("phép ghép bị bộ phân tích đọc khác đi thì bị coi là mơ hồ (g + ia đọc thành gi + a)", () => {
    expect(composeSyllable({ onset: "g", rime: "ia", tone: "ngang" }, inventory)).toMatchObject({
      ok: false,
      code: "AMBIGUOUS_COMPOSITION",
    });
  });

  it("không kiểm tra chính tả: ghép sai quy tắc vẫn ra chữ để làm phương án nhiễu (k + a → ká)", () => {
    const result = composeSyllable({ onset: "k", rime: "a", tone: "sac" }, inventory);
    expect(result.ok && result.text).toBe("ká");
  });

  it("vần ngoài danh mục → không ghép được", () => {
    expect(composeSyllable({ onset: "b", rime: "ưm", tone: "ngang" }, inventory)).toMatchObject({
      ok: false,
      code: "UNPARSABLE",
    });
  });

  it("joinOnsetRime: gi dùng chung chữ i với vần bắt đầu bằng i", () => {
    expect(joinOnsetRime("gi", "iêng")).toBe("giêng");
    expect(joinOnsetRime("gi", "o")).toBe("gio");
    expect(joinOnsetRime(null, "an")).toBe("an");
  });

  it("tonedRime: vần đứng riêng kèm dấu (phương án của bài điền vần)", () => {
    expect(tonedRime("an", "huyen", inventory)).toBe("àn");
    expect(tonedRime("ap", "nang", inventory)).toBe("ạp");
    expect(tonedRime("iêng", "sac", inventory)).toBe("iếng");
    expect(tonedRime("oa", "huyen", inventory)).toBeNull();
    expect(tonedRime("oa", "huyen", inventory, "on_main_vowel")).toBe("oà");
  });
});
