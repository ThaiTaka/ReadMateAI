import { describe, expect, it } from "vitest";
import { KNOWLEDGE_BASE } from "@/features/knowledge/default-kb";
import { analyzeSyllable, diagnoseRimeForm, isBareVowelRime, type SyllableAnalysis } from "@/lib/vietnamese/syllable";

const inventory = KNOWLEDGE_BASE.inventory;

function analyze(text: string): SyllableAnalysis {
  const result = analyzeSyllable(text, inventory);
  if (result.status !== "ok") throw new Error(`"${text}" không phân tích được: ${result.status} ${result.code}`);
  return result.analysis;
}

type Row = [
  input: string,
  onset: string | null,
  medial: "o" | "u" | null,
  nucleus: string,
  coda: string | null,
  tone: string,
];

// prettier-ignore
const VALID: Row[] = [
  // 16 phụ âm đầu một chữ
  ["ba", "b", null, "a", null, "ngang"], ["cá", "c", null, "a", null, "sac"], ["dê", "d", null, "ê", null, "ngang"],
  ["đò", "đ", null, "o", null, "huyen"], ["gà", "g", null, "a", null, "huyen"], ["hè", "h", null, "e", null, "huyen"],
  ["kẻ", "k", null, "e", null, "hoi"], ["lá", "l", null, "a", null, "sac"], ["mẹ", "m", null, "e", null, "nang"],
  ["nơ", "n", null, "ơ", null, "ngang"], ["pin", "p", null, "i", "n", "ngang"], ["rổ", "r", null, "ô", null, "hoi"],
  ["sẻ", "s", null, "e", null, "hoi"], ["tủ", "t", null, "u", null, "hoi"], ["vở", "v", null, "ơ", null, "hoi"],
  ["xe", "x", null, "e", null, "ngang"],
  // 11 tổ hợp chữ ghi âm đầu
  ["chó", "ch", null, "o", null, "sac"], ["ghế", "gh", null, "ê", null, "sac"], ["giỏ", "gi", null, "o", null, "hoi"],
  ["khế", "kh", null, "ê", null, "sac"], ["ngõ", "ng", null, "o", null, "nga"], ["nghé", "ngh", null, "e", null, "sac"],
  ["nhà", "nh", null, "a", null, "huyen"], ["phố", "ph", null, "ô", null, "sac"], ["quả", "qu", null, "a", null, "hoi"],
  ["thỏ", "th", null, "o", null, "hoi"], ["tre", "tr", null, "e", null, "ngang"],
  // không có âm đầu
  ["ăn", null, null, "ă", "n", "ngang"], ["ổ", null, null, "ô", null, "hoi"], ["ý", null, null, "y", null, "sac"],
  ["yêu", null, null, "yê", "u", "ngang"], ["uống", null, null, "uô", "ng", "sac"], ["ước", null, null, "ươ", "c", "sac"],
  ["oai", null, "o", "a", "i", "ngang"],
  // nguyên âm đôi không có âm cuối: ia, ua, ưa, (u)ya
  ["mía", "m", null, "ia", null, "sac"], ["kìa", "k", null, "ia", null, "huyen"], ["cua", "c", null, "ua", null, "ngang"],
  ["mưa", "m", null, "ưa", null, "ngang"], ["khuya", "kh", "u", "ya", null, "ngang"],
  // nguyên âm đôi có âm cuối: iê, yê, uô, ươ
  ["tiếng", "t", null, "iê", "ng", "sac"], ["nghiêng", "ngh", null, "iê", "ng", "ngang"], ["muốn", "m", null, "uô", "n", "sac"],
  ["cuộc", "c", null, "uô", "c", "nang"], ["người", "ng", null, "ươ", "i", "huyen"], ["cười", "c", null, "ươ", "i", "huyen"],
  ["thuyền", "th", "u", "yê", "n", "huyen"],
  // âm đệm o, u
  ["hoa", "h", "o", "a", null, "ngang"], ["khoẻ", "kh", "o", "e", null, "hoi"], ["thuỷ", "th", "u", "y", null, "hoi"],
  ["hoàng", "h", "o", "a", "ng", "huyen"], ["xoăn", "x", "o", "ă", "n", "ngang"], ["ngoằn", "ng", "o", "ă", "n", "huyen"],
  ["huệ", "h", "u", "ê", null, "nang"], ["tuần", "t", "u", "â", "n", "huyen"], ["huơ", "h", "u", "ơ", null, "ngang"],
  ["khuấy", "kh", "u", "â", "y", "sac"],
  // o dài viết hai chữ o
  ["xoong", "x", null, "oo", "ng", "ngang"],
  // các âm cuối
  ["học", "h", null, "o", "c", "nang"], ["sách", "s", null, "a", "ch", "sac"], ["cam", "c", null, "a", "m", "ngang"],
  ["xanh", "x", null, "a", "nh", "ngang"], ["đẹp", "đ", null, "e", "p", "nang"], ["mắt", "m", null, "ă", "t", "sac"],
  ["tay", "t", null, "a", "y", "ngang"], ["cao", "c", null, "a", "o", "ngang"], ["rau", "r", null, "a", "u", "ngang"],
  ["voi", "v", null, "o", "i", "ngang"], ["kêu", "k", null, "ê", "u", "ngang"], ["chịu", "ch", null, "i", "u", "nang"],
  // qu, gi với các vần khác nhau
  ["gió", "gi", null, "o", null, "sac"], ["giữa", "gi", null, "ưa", null, "nga"], ["quốc", "qu", null, "ô", "c", "sac"],
  ["quạt", "qu", null, "a", "t", "nang"],
  // chữ hoa
  ["Bé", "b", null, "e", null, "sac"], ["ĐƯỜNG", "đ", null, "ươ", "ng", "huyen"],
];

describe("phân tích tiếng hợp lệ", () => {
  it.each(VALID)(
    "%s → âm đầu %s, âm đệm %s, âm chính %s, âm cuối %s, thanh %s",
    (input, onset, medial, nucleus, coda, tone) => {
      const analysis = analyze(input);
      expect({
        onset: analysis.onset,
        medial: analysis.medial,
        nucleus: analysis.nucleus,
        coda: analysis.coda,
        tone: analysis.tone,
      }).toEqual({
        onset,
        medial,
        nucleus,
        coda,
        tone,
      });
      expect(analysis.rime).toBe((medial ?? "") + nucleus + (coda ?? ""));
    },
  );

  it("đầu vào NFD cho cùng kết quả phân tích với NFC", () => {
    const withoutInput = (analysis: SyllableAnalysis) => ({ ...analysis, input: "" });
    for (const [input] of VALID) {
      expect(withoutInput(analyze(input.normalize("NFD")))).toEqual(withoutInput(analyze(input)));
    }
  });

  it("ghi nhận chữ hoa nhưng phân tích theo chữ thường", () => {
    expect(analyze("Bé").hasUppercase).toBe(true);
    expect(analyze("bé").hasUppercase).toBe(false);
    expect(analyze("ĐƯỜNG").text).toBe("đường");
  });

  it("vị trí bắt đầu của vần và của dấu thanh", () => {
    expect(analyze("ăn").rimeStart).toBe(0);
    expect(analyze("ba").rimeStart).toBe(1);
    expect(analyze("quả")).toMatchObject({ rimeStart: 2, toneMarkIndex: 2 });
    expect(analyze("nghé")).toMatchObject({ rimeStart: 3, toneMarkIndex: 3 });
  });

  it("mọi âm đầu trong kho tri thức đều được nhận diện", () => {
    for (const onset of inventory.onsets) {
      const vowel = ["k", "gh", "ngh"].includes(onset) ? "e" : "a";
      expect(analyze(onset + vowel).onset).toBe(onset);
    }
  });

  it("mọi vần trong danh mục đều phân tích lại đúng chính nó (đối chiếu dữ liệu – bộ máy)", () => {
    for (const rime of inventory.rimes.values()) {
      const result = analyzeSyllable(rime.text, inventory);
      expect(result.status === "ok" && result.analysis.rime).toBe(rime.text);
    }
  });

  it("isBareVowelRime chỉ đúng với vần gồm một nguyên âm đơn", () => {
    expect(isBareVowelRime(analyze("ba"))).toBe(true);
    expect(isBareVowelRime(analyze("mía"))).toBe(false);
    expect(isBareVowelRime(analyze("ăn"))).toBe(false);
    expect(isBareVowelRime(analyze("hoa"))).toBe(false);
  });
});

describe("quy ước qu, gi được ghi lại, không ẩn đi", () => {
  it.each([
    ["ba", [], "a"],
    ["quả", ["qu_onset"], "a"],
    ["giỏ", ["gi_onset"], "o"],
    ["gì", ["gi_onset", "gi_shared_i"], "i"],
    ["gìn", ["gi_onset", "gi_shared_i"], "in"],
    ["giếng", ["gi_onset", "gi_shared_i"], "iêng"],
    ["giết", ["gi_onset", "gi_shared_i"], "iêt"],
  ])("%s phụ thuộc %j, vần %s", (input, dependencies, rime) => {
    const analysis = analyze(input);
    expect(analysis.conventionDependencies).toEqual(dependencies);
    expect(analysis.rime).toBe(rime);
  });

  it("chữ i dùng chung: vần bắt đầu ngay sau chữ g", () => {
    expect(analyze("gì").rimeStart).toBe(1);
    expect(analyze("giếng")).toMatchObject({ rimeStart: 1, toneMarkIndex: 2 });
  });

  it("ghi (gh + i) không bị nhầm với gi", () => {
    expect(analyze("ghi")).toMatchObject({ onset: "gh", rime: "i", conventionDependencies: [] });
  });
});

describe("trường hợp mơ hồ: qu đứng trước y", () => {
  it.each([
    ["quý", ["y", "uy"]],
    ["quýt", ["uyt"]],
    ["quyển", ["yên", "uyên"]],
    ["quỳnh", ["uynh"]],
  ])("%s → chưa xác định, các cách phân tích: %j", (input, rimes) => {
    const result = analyzeSyllable(input, inventory);
    expect(result.status).toBe("ambiguous");
    if (result.status !== "ambiguous") return;
    expect(result.code).toBe("AMBIGUOUS_QU_Y");
    expect(result.candidates.map((candidate) => candidate.rime)).toEqual(rimes);
  });
});

describe("chuỗi chắc chắn không phải tiếng viết đúng", () => {
  it.each([
    ["", "EMPTY"],
    ["b2", "INVALID_CHARACTER"],
    ["a-b", "INVALID_CHARACTER"],
    ["b\u0430", "INVALID_CHARACTER"],
    ["fan", "FOREIGN_LETTER"],
    ["jam", "FOREIGN_LETTER"],
    ["wa", "FOREIGN_LETTER"],
    ["zô", "FOREIGN_LETTER"],
    ["mèó", "MULTIPLE_TONE_MARKS"],
    ["\u1E3Fa", "TONE_MARK_ON_CONSONANT"],
    ["b\u0300a", "STRAY_COMBINING_MARK"],
    ["qa", "Q_WITHOUT_U"],
    ["qu", "Q_WITHOUT_U"],
    ["nh", "NO_VOWEL"],
    ["bc", "NO_VOWEL"],
  ])("%j → %s", (input, code) => {
    expect(analyzeSyllable(input, inventory)).toMatchObject({ status: "invalid", code });
  });

  it.each([
    ["mian", ["iên"]],
    ["muô", ["ua"]],
    ["mươ", ["ưa"]],
    ["tuan", ["uôn", "oan"]],
    ["iê", ["ia"]],
  ])("%s sai dạng nguyên âm đôi → gợi ý %j (không tự sửa)", (input, suggestions) => {
    expect(analyzeSyllable(input, inventory)).toMatchObject({
      status: "invalid",
      code: "RIME_FORM_INVALID",
      suggestions,
    });
  });
});

describe("ngoài dữ liệu đã mô tả → chưa xác định, không đoán", () => {
  it.each([
    ["hửm", "RIME_NOT_IN_CATALOG"],
    ["ngoao", "RIME_NOT_IN_CATALOG"],
    ["nguệch", "RIME_NOT_IN_CATALOG"],
    ["hello", "RIME_NOT_IN_CATALOG"],
    ["blog", "CONSONANT_CLUSTER"],
    ["street", "CONSONANT_CLUSTER"],
  ])("%s → unrecognized (%s)", (input, code) => {
    expect(analyzeSyllable(input, inventory)).toMatchObject({ status: "unrecognized", code });
  });

  it("vần thiếu trong danh mục làm bộ phân tích dừng lại thay vì tự tách", () => {
    const reduced = {
      onsets: inventory.onsets,
      rimes: new Map([...inventory.rimes].filter(([text]) => text !== "an")),
    };
    expect(analyzeSyllable("bàn", reduced)).toMatchObject({ status: "unrecognized", code: "RIME_NOT_IN_CATALOG" });
  });
});

describe("diagnoseRimeForm", () => {
  it("chỉ chẩn đoán các dạng sai chắc chắn của nguyên âm đôi", () => {
    expect(diagnoseRimeForm("ian")?.suggestions).toEqual(["iên"]);
    expect(diagnoseRimeForm("ưat")?.suggestions).toEqual(["ươt"]);
    expect(diagnoseRimeForm("yêu")).toBeNull();
    expect(diagnoseRimeForm("ưm")).toBeNull();
  });
});
