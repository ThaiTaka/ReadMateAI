import { describe, expect, it } from "vitest";
import {
  detectLegacyEncoding,
  equalsIgnoreCase,
  hasResidualMarks,
  inspectText,
  normalizeWhitespace,
  prepareText,
  toLowerVi,
} from "@/lib/vietnamese/normalize";

const codes = (text: string) => inspectText(text).map((issue) => issue.code);

describe("chữ hoa, chữ thường, khoảng trắng", () => {
  it("toLowerVi xử lý đúng chữ hoa có dấu và Đ", () => {
    expect(toLowerVi("ĐƯỜNG LÀNG")).toBe("đường làng");
    expect(toLowerVi("Ơ".normalize("NFD"))).toBe("ơ");
  });

  it("equalsIgnoreCase bỏ qua hoa/thường nhưng vẫn phân biệt dấu", () => {
    expect(equalsIgnoreCase("Bà", "bà")).toBe(true);
    expect(equalsIgnoreCase("Bà", "ba")).toBe(false);
    expect(equalsIgnoreCase("NGHỈ", "nghĩ")).toBe(false);
  });

  it.each([
    ["  bé   đi  bộ ", "bé đi bộ"],
    ["bé\tđi\nbộ", "bé đi bộ"],
    ["bé\u00A0đi", "bé đi"],
    ["bà", "bà"],
  ])("normalizeWhitespace(%j) = %j", (input, expected) => {
    expect(normalizeWhitespace(input)).toBe(expected);
  });
});

describe("soát văn bản (inspectText) — chỉ báo cáo, không sửa", () => {
  it("văn bản tiếng Việt sạch không có vấn đề", () => {
    expect(inspectText("Bé nghỉ hè ở nhà bà.")).toEqual([]);
  });

  it("phát hiện văn bản dạng NFD", () => {
    expect(codes("Tiếng Việt".normalize("NFD"))).toContain("NOT_NFC");
  });

  it("phát hiện ký tự ẩn (zero-width, BOM, gạch nối mềm)", () => {
    expect(codes("bà\u200Bngoại")).toContain("INVISIBLE_CHARACTER");
    expect(codes("\uFEFFbà")).toContain("INVISIBLE_CHARACTER");
    expect(codes("bà\u00ADngoại")).toContain("INVISIBLE_CHARACTER");
  });

  it("phát hiện khoảng trắng không chuẩn và ký tự điều khiển", () => {
    expect(codes("bé  đi")).toContain("IRREGULAR_WHITESPACE");
    expect(codes(" bé")).toContain("IRREGULAR_WHITESPACE");
    expect(codes("bé\u00A0đi")).toContain("IRREGULAR_WHITESPACE");
    expect(codes("bé\tđi")).toContain("CONTROL_CHARACTER");
  });

  it("phát hiện chữ Kirin giả dạng chữ Latinh (homoglyph)", () => {
    expect(codes("b\u0430")).toContain("NON_LATIN_LETTER");
  });

  it("phát hiện dấu tổ hợp sót lại khi gõ dấu thanh trước dấu mũ", () => {
    const wrongOrder = "e\u0301\u0302"; // sắc rồi mới mũ: NFC không ghép được thành "ế"
    expect(hasResidualMarks(wrongOrder)).toBe(true);
    expect(codes(wrongOrder)).toContain("RESIDUAL_COMBINING_MARK");
    expect(hasResidualMarks("e\u0302\u0301")).toBe(false);
  });

  it("prepareText chỉ áp dụng NFC và khoảng trắng, ghi lại thay đổi", () => {
    const prepared = prepareText("  Tiếng   Việt ".normalize("NFD"));
    expect(prepared.text).toBe("Tiếng Việt");
    expect(prepared.changes).toEqual(["nfc", "whitespace"]);
    expect(prepared.issues).toEqual([]);
  });

  it("prepareText không âm thầm xóa ký tự ẩn — vẫn báo trong issues", () => {
    const prepared = prepareText("bà\u200Bngoại");
    expect(prepared.text).toBe("bà\u200Bngoại");
    expect(prepared.changes).toEqual([]);
    expect(prepared.issues.map((issue) => issue.code)).toContain("INVISIBLE_CHARACTER");
  });

  it("prepareText không sửa lỗi chính tả", () => {
    expect(prepareText("kà").text).toBe("kà");
  });
});

describe("phát hiện văn bản dán từ bảng mã cũ", () => {
  it.each([
    "Tiếng Việt",
    "ĐƯỜNG LÀNG QUÊ HƯƠNG",
    "ă â đ ê ô ơ ư à á ả ã ạ ằ ắ ẳ ẵ ặ ầ ấ ẩ ẫ ậ è é ẻ ẽ ẹ ề ế ể ễ ệ ì í ỉ ĩ ị ò ó ỏ õ ọ ồ ố ổ ỗ ộ ờ ớ ở ỡ ợ ù ú ủ ũ ụ ừ ứ ử ữ ự ỳ ý ỷ ỹ ỵ",
    "À Á Â Ã È É Ê Ì Í Ò Ó Ô Õ Ù Ú Ý Ă Đ Ĩ Ũ Ơ Ư",
    "© 2026 ReadMate",
    "Nhiệt độ 30°C",
    "«Bé đi học»",
  ])("không nghi ngờ văn bản Unicode hợp lệ: %s", (text) => {
    expect(detectLegacyEncoding(text).suspected).toBe(false);
  });

  it("nhận ra dấu hiệu TCVN3 (Hµ Néi, ViÖt Nam)", () => {
    expect(detectLegacyEncoding("Hµ Néi")).toMatchObject({ suspected: true, likelyEncoding: "tcvn3" });
    expect(detectLegacyEncoding("ViÖt Nam")).toMatchObject({ suspected: true, likelyEncoding: "tcvn3" });
  });

  it("nhận ra dấu hiệu VNI (Vieät Nam, ñaây)", () => {
    expect(detectLegacyEncoding("Tieáng Vieät")).toMatchObject({ suspected: true, likelyEncoding: "vni" });
    expect(detectLegacyEncoding("ñaây")).toMatchObject({ suspected: true, likelyEncoding: "vni" });
  });

  it("chỉ phát hiện, không chuyển mã: inspectText báo LEGACY_ENCODING_SUSPECTED", () => {
    expect(codes("ViÖt Nam")).toContain("LEGACY_ENCODING_SUSPECTED");
    expect(detectLegacyEncoding("ViÖt Nam").characters).toEqual(["Ö"]);
  });
});
