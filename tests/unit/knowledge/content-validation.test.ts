import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";
import { computeContentHash, validateContent, type Severity } from "@/features/knowledge/content-validation";

type JsonObject = Record<string, unknown>;
type ItemsFile = JsonObject & { items: JsonObject[] };

const CONTENT_DIR = join(process.cwd(), "content");
const BASE = new Map<string, string>();
for (const entry of readdirSync(CONTENT_DIR, { recursive: true, withFileTypes: true })) {
  if (entry.isFile() && entry.name.endsWith(".json")) {
    const fullPath = join(entry.parentPath, entry.name);
    BASE.set(relative(CONTENT_DIR, fullPath).split(sep).join("/"), readFileSync(fullPath, "utf8"));
  }
}

function read<T>(files: Map<string, string>, path: string): T {
  const raw = files.get(path);
  if (raw === undefined) throw new Error(`thiếu ${path}`);
  return JSON.parse(raw) as T;
}

/** Bản sao dữ liệu thật với một thay đổi gài lỗi. */
function mutate<T = ItemsFile>(path: string, change: (json: T) => void): Map<string, string> {
  const files = new Map(BASE);
  const json = read<T>(files, path);
  change(json);
  files.set(path, JSON.stringify(json, null, 2));
  return files;
}

function item(file: ItemsFile, id: string): JsonObject {
  const found = file.items.find((entry) => entry.id === id);
  if (!found) throw new Error(id);
  return found;
}

const codes = (files: Map<string, string>, severity: Severity = "error") =>
  validateContent(files)
    .issues.filter((issue) => issue.severity === severity)
    .map((issue) => issue.code);

describe("dữ liệu thật trong content/", () => {
  const report = validateContent(BASE);

  it("không có lỗi", () => {
    expect(report.issues.filter((issue) => issue.severity === "error")).toEqual([]);
  });

  it("cảnh báo đúng những điểm cần giáo viên rà soát", () => {
    const warnings = new Set(report.issues.filter((issue) => issue.severity === "warning").map((issue) => issue.code));
    for (const code of ["PENDING_REVIEW", "PROFILE_UNCONFIRMED", "CONVENTION_DEPENDENT", "UNVERIFIED_SYLLABLE"]) {
      expect(warnings.has(code)).toBe(true);
    }
  });

  it("thống kê quy mô kho tri thức", () => {
    expect(report.stats).toMatchObject({
      letters: 29,
      phonemes: 39,
      multiLetterPhonemes: 11,
      tones: 6,
      rimes: 153,
      syllables: 58,
      words: 60,
      sentences: 31,
      series: 1,
      profiles: 2,
    });
    expect(report.stats.corpusReview.approved).toBe(0);
  });
});

describe("lỗi tệp và cú pháp", () => {
  it("JSON hỏng", () => {
    const files = new Map(BASE).set("kb/words.json", "{ hỏng");
    expect(codes(files)).toContain("JSON_SYNTAX");
  });

  it("thiếu tệp bắt buộc", () => {
    const files = new Map(BASE);
    files.delete("kb/tones.json");
    expect(codes(files)).toContain("MISSING_FILE");
  });

  it("tệp lạ trong content/", () => {
    expect(codes(new Map(BASE).set("kb/extra.json", "{}"))).toContain("UNEXPECTED_FILE");
  });

  it("tệp có BOM", () => {
    expect(codes(new Map(BASE).set("manifest.json", `\uFEFF${BASE.get("manifest.json")}`))).toContain("BOM");
  });

  it("trường bắt buộc bị thiếu → lỗi lược đồ", () => {
    expect(codes(mutate("kb/words.json", (file) => delete item(file, "word:bà").difficulty))).toContain(
      "SCHEMA_INVALID",
    );
  });
});

describe("ID, Unicode và tham chiếu", () => {
  it("ID trùng", () => {
    const files = mutate("kb/words.json", (file) => file.items.push({ ...item(file, "word:bà") }));
    expect(codes(files)).toContain("DUPLICATE_ID");
  });

  it("nội dung trùng", () => {
    const files = mutate("kb/sentences.json", (file) =>
      file.items.push({ ...item(file, "sentence:001"), id: "sentence:099" }),
    );
    expect(codes(files)).toContain("DUPLICATE_TEXT");
  });

  it("ID không khớp nội dung", () => {
    expect(codes(mutate("kb/words.json", (file) => (item(file, "word:ba-lô").text = "ba lo")))).toContain(
      "ID_MISMATCH",
    );
  });

  it("chuỗi NFD bị chặn", () => {
    const files = mutate("kb/words.json", (file) => (item(file, "word:bà").text = "bà".normalize("NFD")));
    expect(codes(files)).toEqual(expect.arrayContaining(["NOT_NFC", "SCHEMA_INVALID"]));
  });

  it("ký tự ẩn và văn bản dán từ bảng mã cũ bị chặn", () => {
    expect(
      codes(mutate("kb/sentences.json", (file) => (item(file, "sentence:001").text = "Bà có\u200B cá."))),
    ).toContain("TEXT_INVISIBLE_CHARACTER");
    expect(codes(mutate("kb/words.json", (file) => (item(file, "word:bà").note = "ViÖt Nam")))).toContain(
      "TEXT_LEGACY_ENCODING_SUSPECTED",
    );
  });

  it("tham chiếu chủ đề không tồn tại", () => {
    expect(codes(mutate("kb/words.json", (file) => (item(file, "word:bà").topics = ["topic:khong_co"])))).toContain(
      "UNKNOWN_REFERENCE",
    );
  });

  it("bài học tham chiếu đơn vị không tồn tại", () => {
    const files = mutate<{ lessons: Array<{ introduces: string[] }> }>(
      "curriculum/series/illustrative-v1.json",
      (series) => series.lessons[0]?.introduces.push("rime:khongco"),
    );
    expect(codes(files)).toContain("UNKNOWN_REFERENCE");
  });
});

describe("quan hệ tiên quyết", () => {
  it("vòng lặp g ↔ gh bị chặn", () => {
    const files = mutate("kb/prerequisites.json", (file) =>
      file.items.push({ unit: "phoneme:g", requires: ["phoneme:gh"], basis: "pedagogical", note: "Gài lỗi." }),
    );
    expect(codes(files)).toContain("PREREQUISITE_CYCLE");
  });

  it("tiên quyết của chính nó bị chặn", () => {
    const files = mutate("kb/prerequisites.json", (file) =>
      file.items.push({ unit: "phoneme:b", requires: ["phoneme:b"], basis: "pedagogical", note: "Gài lỗi." }),
    );
    expect(codes(files)).toContain("PREREQUISITE_CYCLE");
  });
});

describe("chính tả và phân tích ngữ liệu", () => {
  it("lỗi c/k trong ngân hàng từ là lỗi chặn", () => {
    const files = mutate("kb/words.json", (file) =>
      file.items.push({ ...item(file, "word:bà"), id: "word:kà", text: "kà" }),
    );
    expect(codes(files)).toContain("CORPUS_SPELLING_ERROR");
  });

  it("âm cuối t với thanh huyền trong câu là lỗi chặn", () => {
    expect(codes(mutate("kb/sentences.json", (file) => (item(file, "sentence:001").text = "Bà bàt cá.")))).toContain(
      "CORPUS_SPELLING_ERROR",
    );
  });

  it("phân tích khai báo lệch bộ máy là lỗi", () => {
    const files = mutate("kb/syllables.json", (file) => {
      item(file, "syllable:bà").expected = { onset: "b", rime: "an", tone: "huyen" };
    });
    expect(codes(files)).toContain("ANALYSIS_MISMATCH");
  });

  it("chưa ghi phân tích cho tiếng phân tích được → chỉ cảnh báo", () => {
    const files = mutate("kb/syllables.json", (file) => (item(file, "syllable:ba").expected = null));
    expect(codes(files, "warning")).toContain("EXPECTED_ANALYSIS_MISSING");
    expect(codes(files)).toEqual([]);
  });

  it("tiếng ngoài danh mục vần → cảnh báo, không chặn", () => {
    const files = mutate("kb/words.json", (file) =>
      file.items.push({ ...item(file, "word:bà"), id: "word:hửm", text: "hửm" }),
    );
    expect(codes(files, "warning")).toContain("UNVERIFIED_SYLLABLE");
    expect(codes(files)).toEqual([]);
  });

  it("độ khó dự kiến lệch nhiều so với cấu tạo → cảnh báo", () => {
    expect(
      codes(
        mutate("kb/words.json", (file) => (item(file, "word:thuyền").difficulty = 5)),
        "warning",
      ),
    ).toContain("DIFFICULTY_DIVERGENCE");
  });

  it("tên riêng chưa khai báo → cảnh báo kiểm tra không phải tên học sinh thật", () => {
    const files = mutate("kb/sentences.json", (file) => (item(file, "sentence:001").text = "Bà Mi có cá."));
    expect(codes(files, "warning")).toContain("PROPER_NOUN_REVIEW");
  });

  it("câu thiếu dấu kết thúc → cảnh báo định dạng", () => {
    expect(
      codes(
        mutate("kb/sentences.json", (file) => (item(file, "sentence:001").text = "Bà có cá")),
        "warning",
      ),
    ).toContain("SENTENCE_FORMAT");
  });
});

describe("kiểm duyệt: không có mục nào được dùng như đã duyệt khi chưa duyệt", () => {
  const approve = (reviewedBy: string, hash?: string, reviewedAt = "2026-10-15") =>
    mutate("kb/words.json", (file) => {
      const word = item(file, "word:bố");
      word.review = { status: "approved", reviewedBy, reviewedAt, contentHash: hash ?? computeContentHash(word) };
    });

  it("approved thiếu người duyệt/hash → lỗi lược đồ", () => {
    const files = mutate("kb/words.json", (file) => (item(file, "word:bố").review = { status: "approved" }));
    expect(codes(files)).toContain("SCHEMA_INVALID");
  });

  it("AI/hệ thống không được duyệt", () => {
    expect(codes(approve("Claude (AI)"))).toContain("APPROVAL_BY_AI");
  });

  it("nội dung đổi sau khi duyệt → phải duyệt lại", () => {
    expect(codes(approve("Cô giáo chủ nhiệm", "a".repeat(64)))).toContain("APPROVAL_STALE");
  });

  it("ngày duyệt trước ngày tạo → lỗi", () => {
    expect(codes(approve("Cô giáo chủ nhiệm", undefined, "2020-01-01"))).toContain("APPROVAL_DATE_INVALID");
  });

  it("duyệt hợp lệ bởi giáo viên → không lỗi", () => {
    const report = validateContent(approve("Cô giáo chủ nhiệm"));
    expect(report.errorCount).toBe(0);
    expect(report.stats.corpusReview.approved).toBe(1);
  });

  it("từ đã duyệt chứa tiếng chưa duyệt → cảnh báo", () => {
    const files = mutate("kb/words.json", (file) => {
      const word = item(file, "word:ba-lô");
      word.review = {
        status: "approved",
        reviewedBy: "Cô giáo chủ nhiệm",
        reviewedAt: "2026-10-15",
        contentHash: computeContentHash(word),
      };
    });
    expect(codes(files, "warning")).toContain("APPROVED_DEPENDS_ON_UNAPPROVED");
  });

  it("computeContentHash ổn định theo thứ tự khóa và bỏ qua trường review", () => {
    expect(computeContentHash({ a: 1, b: [2, { c: 3 }] })).toBe(computeContentHash({ b: [2, { c: 3 }], a: 1 }));
    expect(computeContentHash({ text: "bà", review: { status: "draft" } })).toBe(computeContentHash({ text: "bà" }));
    expect(computeContentHash({ text: "bà" })).not.toBe(computeContentHash({ text: "ba" }));
  });
});

describe("tiến độ học tập: không trình bày dữ liệu minh họa như chương trình thật", () => {
  const PROFILE = "curriculum/profiles/illustrative-demo.json";

  it("hồ sơ đã xác nhận không được dùng chuỗi bài minh họa chưa duyệt", () => {
    const files = mutate<JsonObject>(PROFILE, (profile) => {
      profile.status = "confirmed";
      profile.confirmation = { confirmedBy: "Cô giáo chủ nhiệm", confirmedAt: "2026-10-15" };
    });
    expect(codes(files)).toEqual(
      expect.arrayContaining(["PROFILE_USES_ILLUSTRATIVE_SERIES", "PROFILE_USES_UNAPPROVED_SERIES"]),
    );
  });

  it("hồ sơ xác nhận phải có người xác nhận, và không được là AI", () => {
    expect(codes(mutate<JsonObject>(PROFILE, (profile) => (profile.status = "confirmed")))).toContain("SCHEMA_INVALID");
    const byAi = mutate<JsonObject>(PROFILE, (profile) => {
      profile.status = "confirmed";
      profile.confirmation = { confirmedBy: "hệ thống tự động", confirmedAt: "2026-10-15" };
    });
    expect(codes(byAi)).toContain("APPROVAL_BY_AI");
  });

  it("tên tệp phải khớp ID hồ sơ", () => {
    const files = new Map(BASE);
    files.set("curriculum/profiles/lop-khac.json", files.get(PROFILE) ?? "");
    expect(codes(files)).toContain("FILE_ID_MISMATCH");
  });

  it("thứ tự bài của bộ sách thật phải ghi nguồn; thứ tự bài phải liên tục", () => {
    const series = "curriculum/series/illustrative-v1.json";
    expect(codes(mutate<JsonObject>(series, (data) => (data.seriesKind = "textbook")))).toContain(
      "SERIES_SOURCE_MISSING",
    );
    const gap = mutate<{ lessons: Array<{ ordinal: number }> }>(series, (data) => {
      const last = data.lessons.at(-1);
      if (last) last.ordinal = 99;
    });
    expect(codes(gap)).toContain("SERIES_ORDINALS");
  });
});

describe("dữ liệu tham chiếu phải khớp bộ máy", () => {
  it("bảng chữ cái thiếu chữ", () => {
    expect(
      codes(mutate("kb/letters.json", (file) => (file.items = file.items.filter((entry) => entry.id !== "letter:đ")))),
    ).toContain("ALPHABET_MISMATCH");
  });

  it("thanh ngang không được đi với âm cuối p, t, c, ch (lỗi từng gặp khi soạn dữ liệu)", () => {
    expect(codes(mutate("kb/tones.json", (file) => (item(file, "tone:ngang").allowedWithStopCoda = true)))).toContain(
      "TONE_DATA_MISMATCH",
    );
  });

  it("vần khai báo cấu tạo sai", () => {
    const files = mutate("kb/rimes.json", (file) =>
      file.items.push({ id: "rime:ian", text: "ian", nucleus: "ia", coda: "n" }),
    );
    expect(codes(files)).toContain("RIME_STRUCTURE_INVALID");
  });

  it("spec quy tắc lệch với bộ máy", () => {
    const files = mutate("kb/rules.json", (file) => {
      const spec = item(file, "spelling.c_k").spec as { frontVowels: string[] };
      spec.frontVowels = ["i", "e", "ê"];
    });
    expect(codes(files)).toContain("RULE_SPEC_MISMATCH");
  });

  it("ví dụ sai không bị phát hiện, hoặc ví dụ đúng bị báo lỗi", () => {
    const counter = mutate("kb/rules.json", (file) =>
      (item(file, "spelling.c_k").counterExamples as JsonObject[]).push({ text: "cá", expectedCode: "SPELLING_C_K" }),
    );
    expect(codes(counter)).toContain("RULE_COUNTEREXAMPLE_FAILED");
    const example = mutate("kb/rules.json", (file) => (item(file, "spelling.c_k").examples as string[]).push("kà"));
    expect(codes(example)).toContain("RULE_EXAMPLE_FAILED");
  });

  it("thiếu mô tả quy tắc mà bộ máy dùng, hoặc mã lỗi lạ", () => {
    expect(
      codes(mutate("kb/rules.json", (file) => (file.items = file.items.filter((rule) => rule.id !== "spelling.qu")))),
    ).toContain("RULE_MISSING");
    expect(codes(mutate("kb/rules.json", (file) => (item(file, "spelling.c_k").detectedBy = ["MA_LA"])))).toContain(
      "UNKNOWN_ENGINE_CODE",
    );
  });
});

describe("không có dữ liệu nhận dạng học sinh thật", () => {
  // Ghép chuỗi lúc chạy để mã nguồn kiểm thử không chứa mẫu email/số điện thoại (xem repo-hygiene.test.ts).
  const fakePhone = ["09", "12", "345", "678"].join("");
  const fakeEmail = ["phu.huynh", "example.com"].join("@");

  it.each([fakePhone, fakeEmail])("phát hiện chuỗi giống dữ liệu cá nhân trong ghi chú", (value) => {
    expect(codes(mutate("kb/words.json", (file) => (item(file, "word:bà").note = `Liên hệ ${value}`)))).toContain(
      "PERSONAL_DATA_PATTERN",
    );
  });

  it("trường dữ liệu cá nhân bị cấm (và lược đồ chặt chẽ từ chối trường lạ)", () => {
    const files = mutate("kb/words.json", (file) => (item(file, "word:bà").studentName = "Nguyễn Văn A"));
    expect(codes(files)).toEqual(expect.arrayContaining(["FORBIDDEN_FIELD", "SCHEMA_INVALID"]));
  });
});
