import { describe, expect, it } from "vitest";
import { hintText, retryFeedbackTexts } from "@/features/exercises/core/feedback";
import { containsForm } from "@/features/exercises/core/leaks";
import { VARIANT_IDS } from "@/features/exercises/core/module";
import type { ExerciseItem } from "@/features/exercises/items";
import { moduleOf, VARIANTS } from "@/features/exercises/registry";
import { validateExerciseItem } from "@/features/exercises/validation";
import { approvedKb, class1a2, clone, confirmedProfile, demoItems, demoValidation, firstItem, kb } from "./helpers";

const codes = (item: unknown, ctx = demoValidation()) =>
  validateExerciseItem(item, ctx)
    .issues.filter((entry) => entry.severity === "error")
    .map((entry) => entry.code);

/** Mọi chữ trong `content` (đệ quy) — phần học sinh nhìn thấy trước khi nộp bài. */
function contentStrings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(contentStrings);
  if (value && typeof value === "object") return Object.values(value).flatMap(contentStrings);
  return [];
}

const FULL_ANSWER_VARIANTS = new Set<string>([
  "picture_build",
  "parts_to_syllable",
  "missing_onset",
  "missing_rime",
  "missing_tone",
]);
const READING_VARIANTS = new Set<string>([
  "choose_picture",
  "match_pairs",
  "sentence_picture",
  "comprehension_question",
  "arrange_words",
]);

function pictureNamesOf(item: ExerciseItem): string[] {
  const answer = item.answer as { pictureName?: string | null; pictureNames?: Record<string, string> };
  return [answer.pictureName ?? null, ...Object.values(answer.pictureNames ?? {})].filter(
    (name): name is string => typeof name === "string",
  );
}

describe("mọi câu do bộ sinh tạo đều qua chuỗi kiểm tra", () => {
  it("17 biến thể × 3 nhóm: không có lỗi (chỉ cảnh báo của bản chơi thử)", () => {
    for (const band of ["foundation", "developing", "extending"] as const) {
      for (const variant of VARIANT_IDS) {
        for (const item of demoItems(variant, band, { minCount: 1 })) {
          const report = validateExerciseItem(item, {
            ...demoValidation(band),
            allowMissingRequiredAudio: variant === "listen_letter",
          });
          expect(report.ok, `${band} ${variant}: ${JSON.stringify(report.issues)}`).toBe(true);
          expect(report.issues.map((entry) => entry.code)).toContain("DEMO_UNREVIEWED_CONTENT");
        }
      }
    }
  });

  it("phần hiển thị (content) không bao giờ chứa tên tranh — tên tranh chỉ nằm ở phần đáp án", () => {
    for (const variant of [
      "picture_onset",
      "picture_build",
      "missing_rime",
      "missing_tone",
      "choose_picture",
      "match_pairs",
      "sentence_picture",
    ] as const) {
      for (const item of demoItems(variant)) {
        // Bài đọc: từ/câu cần đọc được phép hiển thị (đó là kích thích đọc), tranh thì không có chú thích.
        const stimuli = new Set([
          ...("word" in item.content ? [item.content.word] : []),
          ...("sentence" in item.content ? [item.content.sentence] : []),
          ...("words" in item.content ? item.content.words.map((word) => word.text) : []),
        ]);
        const shown = contentStrings(item.content)
          .filter((text) => !stimuli.has(text))
          .join(" | ");
        for (const name of pictureNamesOf(item)) {
          expect(containsForm(shown, name), `${variant}: "${name}" lộ trong ${shown}`).toBe(false);
        }
      }
    }
  });

  it("phản hồi khi còn lượt và mọi câu gợi ý không nói đáp án (từ hoàn chỉnh / tên tranh)", () => {
    for (const variant of VARIANT_IDS) {
      for (const item of demoItems(variant)) {
        const answerWord = moduleOf(item).reveal(item).answerText;
        const texts = [...retryFeedbackTexts(), ...moduleOf(item).hints(item).map(hintText)];
        // Bài ghép/điền: tiếng/từ hoàn chỉnh là đáp án. Bài đọc: từ/câu đang hiển thị được phép tách tiếng trong
        // gợi ý (đó là kích thích đọc). Bài nhìn tranh còn lại: tên tranh không được xuất hiện.
        const forbidden = FULL_ANSWER_VARIANTS.has(variant)
          ? [answerWord]
          : READING_VARIANTS.has(variant)
            ? []
            : pictureNamesOf(item);
        for (const form of forbidden) {
          for (const text of texts)
            expect(containsForm(text, form), `${variant}: "${text}" chứa "${form}"`).toBe(false);
        }
      }
    }
  });
});

describe("chặn nội dung chưa duyệt / chế độ học thật", () => {
  it("chế độ học thật với hồ sơ minh họa → PROFILE_NOT_CONFIRMED", () => {
    expect(codes(firstItem("missing_onset"), { ...demoValidation(), mode: "production" })).toContain(
      "PROFILE_NOT_CONFIRMED",
    );
  });

  it("chế độ học thật, hồ sơ đã xác nhận nhưng ngữ liệu chờ duyệt → CONTENT_NOT_APPROVED (+ thiếu âm thanh đã duyệt)", () => {
    const result = codes(firstItem("missing_onset"), {
      ...demoValidation(),
      mode: "production",
      profile: confirmedProfile,
    });
    expect(result).toContain("CONTENT_NOT_APPROVED");
    expect(result).toContain("MISSING_AUDIO");
    expect(result).not.toContain("PROFILE_NOT_CONFIRMED");
  });

  it("bản chơi thử không được dùng hồ sơ của lớp thật (1A2)", () => {
    expect(codes(firstItem("missing_onset"), { ...demoValidation(), profile: class1a2 })).toContain(
      "PROFILE_NOT_CONFIRMED",
    );
  });

  it("tranh chỉ dành cho bản chơi thử bị chặn ở chế độ học thật kể cả khi đã duyệt", () => {
    const approved = approvedKb([]);
    const item = firstItem("picture_onset");
    const media = {
      pictures: demoValidation().media.pictures.map((picture) => ({
        ...picture,
        review: { status: "approved" as const, note: "giả lập" },
      })),
      audio: [],
    };
    const result = codes(item, {
      ...demoValidation(),
      kb: approved,
      mode: "production",
      profile: confirmedProfile,
      media,
    });
    expect(result).toContain("CONTENT_NOT_APPROVED");
  });

  it("ngữ liệu bản nháp (draft) bị chặn kể cả ở bản chơi thử", () => {
    const item = clone(firstItem("missing_onset"));
    item.source.corpusIds = ["word:quả-quýt"];
    expect(codes(item)).toContain("CONTENT_NOT_APPROVED");
  });
});

describe("chặn ngữ liệu chưa học và trường hợp chưa xác định (unknown)", () => {
  it("đơn vị chưa học theo vị trí bài của nhóm → CONTENT_NOT_TAUGHT / UNIT_NOT_TAUGHT", () => {
    const item = firstItem("which_rime");
    // Bài MH10: chưa học vần nào nhiều chữ.
    const result = codes(item, { ...demoValidation(), lessonOrdinal: 10 });
    expect(result.some((code) => code === "CONTENT_NOT_TAUGHT" || code === "UNIT_NOT_TAUGHT")).toBe(true);
  });

  it("Nhóm 3 dùng kiến thức đến bài trước: câu hợp lệ ở Nhóm 2 có thể bị chặn ở Nhóm 3", () => {
    const items = demoItems("which_rime", "developing", { count: 30, minCount: 1, lessonOrdinal: 16 });
    const blocked = items.filter((item) => !validateExerciseItem(item, demoValidation("foundation")).ok);
    expect(blocked.length).toBeGreaterThan(0);
  });

  it("hồ sơ không có tiến độ (lớp 1A2 chưa xác nhận) → CONTENT_UNVERIFIED, không bao giờ coi là hợp lệ", () => {
    const result = codes(firstItem("which_onset"), { ...demoValidation(), profile: class1a2, mode: "production" });
    expect(result).toContain("CONTENT_UNVERIFIED");
  });

  it("tiếng phụ thuộc quy ước chưa xác nhận (qu, gi) → CONVENTION_REQUIRED", () => {
    const item = clone(firstItem("which_tone"));
    item.content.syllable = "quả";
    const unconfirmed = {
      ...demoValidation(),
      profile: {
        ...clone(confirmedProfile),
        status: "illustrative" as const,
        conventions: { quAnalysis: null, giAnalysis: null, giSharedI: null, tonePlacement: null },
      },
    };
    const result = codes(item, unconfirmed);
    expect(result.some((code) => code === "CONVENTION_REQUIRED" || code === "CONTENT_UNVERIFIED")).toBe(true);
  });

  it("tiếng phân tích mơ hồ (quýt) → không hợp lệ", () => {
    const item = clone(firstItem("which_tone"));
    item.content.syllable = "quýt";
    expect(codes(item)).toContain("CONTENT_UNVERIFIED");
  });

  it("lỗi chính tả trong chữ hiển thị → CONTENT_INVALID", () => {
    const item = clone(firstItem("which_tone"));
    item.content.syllable = "kà";
    expect(codes(item)).toEqual(expect.arrayContaining(["CONTENT_INVALID"]));
  });
});

describe("đáp án duy nhất, phương án nhiễu hợp lệ", () => {
  it("điền chữ không có tranh mà hai phương án đều ghép ra tiếng đúng (b/d + à) → AMBIGUOUS_ANSWER", () => {
    const item = clone(firstItem("missing_onset"));
    item.content.template = { wordPrefix: "", before: "", after: "à", wordSuffix: "" };
    item.content.options = [
      { id: "o1", text: "b", unit: "phoneme:b" },
      { id: "o2", text: "d", unit: "phoneme:d" },
    ];
    item.answer = { optionId: "o1", result: "bà", pictureName: null, distractorTags: { o2: "confusion:b-d" } };
    item.source.corpusIds = ["word:bà"];
    expect(codes(item)).toContain("AMBIGUOUS_ANSWER");
  });

  it("điền vần không có tranh → AMBIGUOUS_ANSWER (nhiều vần ghép ra tiếng có nghĩa)", () => {
    const item = clone(firstItem("missing_rime"));
    item.content.picture = null;
    expect(codes(item)).toContain("AMBIGUOUS_ANSWER");
  });

  it("đáp án khai báo không khớp bộ phân tích → ANSWER_MISMATCH", () => {
    const item = clone(firstItem("which_onset"));
    const wrong = item.content.options.find((option) => option.id !== item.answer.optionId);
    if (!wrong) throw new Error("thiếu phương án");
    item.answer.optionId = wrong.id;
    expect(codes(item)).toContain("ANSWER_MISMATCH");
  });

  it("bài nhiều đáp án: khai báo thiếu một tiếng có vần cần tìm → ANSWER_MISMATCH", () => {
    const item = clone(
      demoItems("find_with_unit", "developing", { count: 40, minCount: 1 }).find(
        (entry) => entry.variant === "find_with_unit" && entry.answer.optionIds.length > 1,
      ),
    );
    if (!item || item.variant !== "find_with_unit") throw new Error("cần câu có 2 đáp án");
    item.answer.optionIds = item.answer.optionIds.slice(1);
    expect(codes(item)).toContain("ANSWER_MISMATCH");
  });

  it("câu hỏi đọc hiểu: phương án nhiễu cũng có trong câu → DISTRACTOR_IN_TEXT; đáp án không có trong câu → ANSWER_NOT_IN_TEXT", () => {
    const item = clone(firstItem("comprehension_question"));
    const answerText = item.content.options.find((option) => option.id === item.answer.optionId)?.text ?? "";
    const inSentence = item.content.sentence
      .replace(/[.!?]/gu, "")
      .split(" ")
      .map((word) => word.toLowerCase())
      .find((word) => !containsForm(answerText, word));
    const distractor = item.content.options.find((option) => option.id !== item.answer.optionId);
    if (!distractor || !inSentence) throw new Error("thiếu phương án");
    distractor.text = inSentence;
    expect(codes(item)).toContain("DISTRACTOR_IN_TEXT");
    const other = clone(firstItem("comprehension_question"));
    const answer = other.content.options.find((option) => option.id === other.answer.optionId);
    if (!answer) throw new Error("thiếu đáp án");
    answer.text = "nho";
    expect(codes(other)).toContain("ANSWER_NOT_IN_TEXT");
  });

  it("vượt số phương án của nhóm → BAND_CONSTRAINT", () => {
    const item = firstItem("find_with_unit", "developing");
    expect(codes(item, demoValidation("foundation"))).toContain("BAND_CONSTRAINT");
  });

  it("tranh không có trong thư viện → MISSING_IMAGE", () => {
    const item = clone(firstItem("choose_picture"));
    item.source.pictureIds = [...item.source.pictureIds, "picture:unknown"];
    expect(codes(item)).toContain("MISSING_IMAGE");
  });
});

describe("chặn lộ đáp án trái quy tắc (phân biệt theo mục tiêu học tập)", () => {
  it("khuôn điền dấu hiển thị nguyên đáp án (tiếng thanh ngang) → TEXT_LEAKS_ANSWER", () => {
    const item = clone(firstItem("missing_tone"));
    item.content.template = { ...item.content.template, before: item.answer.result };
    expect(codes(item)).toContain("TEXT_LEAKS_ANSWER");
  });

  it("câu hỏi đọc hiểu chứa sẵn câu trả lời → TEXT_LEAKS_ANSWER", () => {
    const item = clone(firstItem("comprehension_question"));
    const answer = item.content.options.find((option) => option.id === item.answer.optionId)?.text ?? "";
    item.content.question = `${answer} là gì?`;
    expect(codes(item)).toContain("TEXT_LEAKS_ANSWER");
  });

  it("thẻ từ hiển thị đúng thứ tự câu (chưa xáo) → TEXT_LEAKS_ANSWER", () => {
    const item = clone(firstItem("arrange_words"));
    const order = item.answer.orders[0] ?? [];
    item.content.tokens = order.map((text, index) => ({ id: `k${index + 1}`, text }));
    expect(codes(item)).toContain("TEXT_LEAKS_ANSWER");
  });

  it("bài ĐỌC từ mang âm thanh đọc từ trước khi chấm → AUDIO_ROLE_FORBIDDEN (A3)", () => {
    const item = clone(firstItem("choose_picture"));
    item.audio.stimulus = { spokenText: item.content.word, assetId: null };
    expect(codes(item)).toContain("AUDIO_ROLE_FORBIDDEN");
  });

  it("câu lệnh đọc to từ cần đọc → AUDIO_LEAKS_ANSWER (A1)", () => {
    const item = clone(firstItem("choose_picture"));
    item.audio.instruction = { spokenText: `Con đọc từ ${item.content.word} nhé.`, assetId: null };
    expect(codes(item)).toContain("AUDIO_LEAKS_ANSWER");
  });

  it("câu lệnh của bài đọc câu chứa một cụm từ của câu → AUDIO_LEAKS_ANSWER", () => {
    const item = clone(firstItem("sentence_picture"));
    const words = item.content.sentence.replace(/[.!?]/gu, "").split(" ");
    item.audio.instruction = { spokenText: `Con tìm hình ${words.slice(0, 2).join(" ")} nhé.`, assetId: null };
    expect(codes(item)).toContain("AUDIO_LEAKS_ANSWER");
  });

  it("bài NGHE âm – chọn chữ: âm mục tiêu trong khe kích thích là hợp lệ, nhưng câu lệnh nói âm đó thì bị chặn", () => {
    const item = clone(firstItem("listen_letter", "foundation"));
    const ok = validateExerciseItem(item, { ...demoValidation("foundation"), allowMissingRequiredAudio: true });
    expect(ok.issues.filter((entry) => entry.code.includes("LEAK"))).toEqual([]);
    const spoken = item.audio.stimulus?.spokenText ?? "";
    item.audio.instruction = { spokenText: `Con nghe âm ${spoken} rồi chọn chữ.`, assetId: null };
    expect(codes(item, { ...demoValidation("foundation"), allowMissingRequiredAudio: true })).toContain(
      "AUDIO_LEAKS_ANSWER",
    );
  });

  it("bài nhìn tranh: tên tranh được đọc ở khe kích thích (H3–H2), nhưng không được nằm trong câu lệnh", () => {
    const item = clone(firstItem("picture_onset"));
    expect(item.audio.stimulus?.spokenText).toBe(item.answer.pictureName);
    expect(codes(item)).not.toContain("AUDIO_LEAKS_ANSWER");
    item.audio.instruction = { spokenText: `Con nhìn hình ${item.answer.pictureName} nhé.`, assetId: null };
    expect(codes(item)).toContain("AUDIO_LEAKS_ANSWER");
  });

  it("âm thanh mẫu SAU khi chấm được phép chứa đáp án (A4)", () => {
    const item = firstItem("choose_picture");
    expect(item.audio.model?.spokenText).toBe(item.content.word);
    expect(codes(item)).not.toContain("AUDIO_LEAKS_ANSWER");
  });

  it("bài nghe âm thiếu bản ghi âm bắt buộc: chặn (MISSING_AUDIO); chỉ cho XEM giao diện khi được phép rõ ràng", () => {
    const item = firstItem("listen_letter", "foundation");
    expect(codes(item, demoValidation("foundation"))).toContain("MISSING_AUDIO");
    const preview = validateExerciseItem(item, { ...demoValidation("foundation"), allowMissingRequiredAudio: true });
    expect(preview.ok).toBe(true);
    expect(preview.previewOnly).toBe(true);
    expect(VARIANTS.listen_letter.paper.supported).toBe(false);
  });

  it("dữ liệu tham chiếu chưa duyệt chặn chế độ học thật (cả khi ngữ liệu đã duyệt)", () => {
    const item = firstItem("missing_onset");
    const result = codes(item, { ...demoValidation(), kb, mode: "production", profile: confirmedProfile });
    expect(result).toContain("CONTENT_NOT_APPROVED");
  });
});
