import { describe, expect, it } from "vitest";
import {
  findProfile,
  lessonIntroducing,
  resolveKnowledgeState,
  unitsIntroducedThrough,
} from "@/features/knowledge/curriculum";
import { KNOWLEDGE_BASE as kb } from "@/features/knowledge/default-kb";
import type { KnowledgeBase } from "@/features/knowledge/load";
import { analyzeVocabulary, checkReadability } from "@/features/knowledge/readability";
import type { CurriculumProfile } from "@/features/knowledge/schema";
import { selectCorpusItems } from "@/features/knowledge/selection";

function profile(id: string): CurriculumProfile {
  const found = findProfile(kb, id);
  if (!found) throw new Error(id);
  return found;
}
const class1a2 = profile("profile:class-1a2");
const demo = profile("profile:illustrative-demo");
const series = kb.series[0];
if (!series) throw new Error("thiếu bộ bài minh họa");

const verdictAt = (text: string, lessonOrdinal: number, band?: "foundation" | "developing" | "extending") =>
  checkReadability(kb, text, { profile: demo, lessonOrdinal, ...(band ? { band } : {}) }).verdict;

describe("hồ sơ lớp 1A2 — chưa được giáo viên xác nhận", () => {
  it("ở trạng thái unconfirmed, chưa có bộ sách, vị trí bài, quy ước", () => {
    expect(class1a2).toMatchObject({
      status: "unconfirmed",
      seriesId: null,
      currentLessonOrdinal: null,
      confirmation: null,
    });
    expect(Object.values(class1a2.conventions)).toEqual([null, null, null, null]);
  });

  it("không suy ra được tập kiến thức đã học", () => {
    expect(resolveKnowledgeState(kb, class1a2)).toMatchObject({ ok: false, code: "PROFILE_HAS_NO_PROGRESS" });
  });

  it("không ngữ liệu nào được kết luận 'đọc được' theo hồ sơ này", () => {
    for (const item of [...kb.syllables, ...kb.words, ...kb.sentences]) {
      const report = checkReadability(kb, item.text, { profile: class1a2 });
      expect(report.verdict, item.id).toBe("unknown");
      expect(report.profileProblem?.code).toBe("PROFILE_HAS_NO_PROGRESS");
    }
  });

  it("nhưng lỗi chính tả vẫn được phát hiện (không phụ thuộc hồ sơ)", () => {
    expect(checkReadability(kb, "kà", { profile: class1a2 }).verdict).toBe("invalid");
  });

  it("không được dùng để giao bài", () => {
    expect(selectCorpusItems(kb, { profile: class1a2, purpose: "assignment", kind: "word" })).toMatchObject({
      ok: false,
      code: "PROFILE_NOT_CONFIRMED",
    });
  });
});

describe("tiến độ học tập: suy ra kiến thức đã học từ hồ sơ", () => {
  it("chuỗi bài minh họa: tập đã học tăng dần theo bài", () => {
    let previous = new Set<string>();
    for (const lesson of series.lessons) {
      const current = unitsIntroducedThrough(series, lesson.ordinal);
      expect([...previous].every((unit) => current.has(unit))).toBe(true);
      previous = current;
    }
    expect(lessonIntroducing(series, "rime:an")).toBe(12);
    expect(lessonIntroducing(series, "rime:iêng")).toBeNull();
  });

  it("hồ sơ minh họa ở bài 10: đã học qu nhưng chưa học vần an", () => {
    const result = resolveKnowledgeState(kb, demo);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.lessonOrdinal).toBe(10);
    expect(result.state.introduced.has("phoneme:qu")).toBe(true);
    expect(result.state.introduced.has("rime:an")).toBe(false);
    expect(result.state.usableForAssignments).toBe(false);
  });

  it("Nhóm 3 (foundation) tính đến bài trước", () => {
    const result = resolveKnowledgeState(kb, demo, { band: "foundation" });
    expect(result.ok && result.state.effectiveLessonOrdinal).toBe(9);
    expect(result.ok && result.state.introduced.has("phoneme:qu")).toBe(false);
  });

  it("Nhóm 1 (extending) được dùng thêm đơn vị GV cho phép, nhưng không tính là 'đã học'", () => {
    const result = resolveKnowledgeState(kb, demo, { band: "extending" });
    expect(result.ok && result.state.allowedForPractice.has("rime:ia")).toBe(true);
    expect(result.ok && result.state.introduced.has("rime:ia")).toBe(false);
  });

  it("GV thêm/bớt đơn vị bằng dữ liệu hồ sơ, không cần sửa mã", () => {
    const edited: CurriculumProfile = {
      ...demo,
      additionalTaughtUnits: ["rime:an"],
      excludedUnits: ["phoneme:p"],
    };
    const result = resolveKnowledgeState(kb, edited);
    expect(result.ok && result.state.introduced.has("rime:an")).toBe(true);
    expect(result.ok && result.state.introduced.has("phoneme:p")).toBe(false);
  });

  it("hồ sơ không có bộ sách nhưng có danh sách đơn vị do GV nhập vẫn dùng được", () => {
    const manual: CurriculumProfile = {
      ...class1a2,
      additionalTaughtUnits: ["phoneme:b", "phoneme:a", "tone:ngang", "tone:huyen"],
    };
    expect(checkReadability(kb, "bà", { profile: manual }).verdict).toBe("readable");
    expect(checkReadability(kb, "bé", { profile: manual }).verdict).toBe("not_yet_learned");
  });

  it("báo lỗi rõ khi bài hoặc bộ sách không tồn tại", () => {
    expect(resolveKnowledgeState(kb, demo, { lessonOrdinal: 99 })).toMatchObject({
      ok: false,
      code: "LESSON_NOT_FOUND",
    });
    expect(resolveKnowledgeState(kb, { ...demo, seriesId: "series:khong-co" })).toMatchObject({
      ok: false,
      code: "SERIES_NOT_FOUND",
    });
    expect(resolveKnowledgeState(kb, { ...demo, currentLessonOrdinal: null })).toMatchObject({
      ok: false,
      code: "PROFILE_HAS_NO_PROGRESS",
    });
  });

  it("đơn vị cần ôn do GV chọn được giữ nguyên", () => {
    const result = resolveKnowledgeState(kb, demo);
    expect(result.ok && [...result.state.reviewFocus]).toEqual(["phoneme:b", "phoneme:d"]);
  });
});

describe("kiểm tra ngữ liệu theo mốc bài (hồ sơ minh họa)", () => {
  it.each([
    ["Bà có cá.", 1, "not_yet_learned"],
    ["Bà có cá.", 2, "readable"],
    ["Mẹ bế bé.", 5, "not_yet_learned"],
    ["Mẹ bế bé.", 6, "readable"],
    ["bàn", 11, "not_yet_learned"],
    ["bàn", 12, "readable"],
    ["Bé đọc sách.", 13, "not_yet_learned"],
    ["Bé đọc sách.", 14, "readable"],
    ["Trời mưa to.", 15, "readable"],
    ["bông hoa", 15, "not_yet_learned"],
    ["bông hoa", 16, "readable"],
  ] as const)("“%s” ở bài %i → %s", (text, lesson, verdict) => {
    expect(verdictAt(text, lesson)).toBe(verdict);
  });

  it("nêu rõ đơn vị còn thiếu và lý do", () => {
    const report = checkReadability(kb, "Mẹ bế bé.", { profile: demo, lessonOrdinal: 5 });
    expect(report.decoding.missingUnits).toEqual(["phoneme:m"]);
    expect(report.reasons[0]?.code).toBe("UNITS_NOT_TAUGHT");
  });

  it("ngữ liệu dùng vần ngoài chuỗi bài thì luôn chưa học (âm tính)", () => {
    const report = checkReadability(kb, "Thuyền đi trên sông.", { profile: demo, lessonOrdinal: 17 });
    expect(report.verdict).toBe("not_yet_learned");
    expect(report.decoding.missingUnits).toEqual(["rime:uyên", "rime:ên"]);
    expect(verdictAt("Bố tưới cây.", 17)).toBe("not_yet_learned");
    expect(verdictAt("giếng", 17)).toBe("not_yet_learned");
  });

  it("“quýt” vẫn chưa xác định ngay cả ở bài cuối", () => {
    expect(verdictAt("quả quýt", 17)).toBe("unknown");
  });

  it("Nhóm 3 chậm một bài; Nhóm 1 dùng được đơn vị GV cho phép", () => {
    expect(verdictAt("quả", 10, "developing")).toBe("readable");
    expect(verdictAt("quả", 10, "foundation")).toBe("not_yet_learned");
    expect(verdictAt("mía", 10, "developing")).toBe("not_yet_learned");
    expect(verdictAt("mía", 10, "extending")).toBe("readable");
  });

  it("quy ước chưa khai báo → tiếng có qu/gi là chưa xác định", () => {
    const noConventions: CurriculumProfile = {
      ...demo,
      conventions: { quAnalysis: null, giAnalysis: null, giSharedI: null, tonePlacement: null },
    };
    expect(checkReadability(kb, "quả", { profile: noConventions }).verdict).toBe("unknown");
    expect(checkReadability(kb, "Bé vẽ gì?", { profile: noConventions }).verdict).toBe("unknown");
    expect(checkReadability(kb, "Bé vẽ gì?", { profile: demo }).verdict).toBe("readable");
  });

  it("số ngữ liệu đọc được không giảm khi lớp học thêm bài (bài 5 ≤ bài 10 ≤ bài 16)", () => {
    const readableCount = (lesson: number) =>
      [...kb.words, ...kb.sentences].filter((item) => verdictAt(item.text, lesson) === "readable").length;
    const counts = [5, 10, 16].map(readableCount);
    expect(counts[0]).toBeGreaterThan(0);
    expect(counts[0]).toBeLessThanOrEqual(counts[1] ?? 0);
    expect(counts[1]).toBeLessThan(counts[2] ?? 0);
  });
});

describe("tách bạch giải mã, từ vựng và đọc hiểu", () => {
  it("từ vựng: đối chiếu ngân hàng từ, ghép tiếng thành từ theo khớp dài nhất", () => {
    const report = analyzeVocabulary(kb, "Bà có quả na.");
    expect(report.status).toBe("partially_in_bank");
    expect(report.entries.map((entry) => [entry.text, entry.wordId])).toEqual([
      ["bà", "word:bà"],
      ["có", null],
      ["quả na", "word:quả-na"],
    ]);
  });

  it("giải mã được nhưng không có trong ngân hàng từ vẫn là readable — từ vựng không quyết định giải mã", () => {
    const report = checkReadability(kb, "bố bế bé", { profile: demo });
    expect(report.verdict).toBe("readable");
    expect(report.vocabulary.status).toBe("partially_in_bank");
  });

  it("có trong ngân hàng từ không biến tiếng chưa học thành đọc được", () => {
    const report = checkReadability(kb, "thuyền", { profile: demo });
    expect(report.vocabulary.status).toBe("all_in_bank");
    expect(report.verdict).toBe("not_yet_learned");
  });

  it("đọc hiểu không được bộ máy đánh giá; câu trong ngân hàng có câu hỏi gợi ý cho GV", () => {
    const sentence = checkReadability(kb, "Bé đi bộ.", { profile: demo });
    expect(sentence.comprehension).toMatchObject({
      assessed: false,
      demand: "sentence_meaning",
      teacherPrompt: "Bé làm gì?",
    });
    expect(checkReadability(kb, "bà", { profile: demo }).comprehension.demand).toBe("word_meaning");
  });

  it("luôn kèm lưu ý: 'đọc được' không có nghĩa học sinh thực tế đọc được", () => {
    const report = checkReadability(kb, "bà", { profile: demo });
    expect(report.verdict).toBe("readable");
    expect(report.caveats.join(" ")).toContain("không khẳng định học sinh thực tế đọc được");
    expect(report.caveats.join(" ")).toContain("Hồ sơ minh họa");
  });
});

describe("chọn ngữ liệu — chỉ nội dung đã duyệt mới được giao bài thật", () => {
  const confirmed: CurriculumProfile = {
    ...demo,
    status: "confirmed",
    confirmation: { confirmedBy: "GV thử nghiệm", confirmedAt: "2026-10-14" },
  };

  it("hồ sơ minh họa không dùng để giao bài", () => {
    expect(selectCorpusItems(kb, { profile: demo, purpose: "assignment", kind: "word" })).toMatchObject({
      ok: false,
      code: "PROFILE_NOT_CONFIRMED",
    });
  });

  it("hồ sơ đã xác nhận nhưng chưa có mục nào được duyệt → không có gì để giao", () => {
    const result = selectCorpusItems(kb, { profile: confirmed, purpose: "assignment", kind: "word" });
    expect(result.ok && result.items).toEqual([]);
    expect(result.ok && result.excludedByReview.pending_review).toBeGreaterThan(0);
  });

  it("chỉ mục approved được trả về khi giao bài", () => {
    const withApproved: KnowledgeBase = {
      ...kb,
      words: kb.words.map((word) =>
        word.id === "word:bà"
          ? {
              ...word,
              review: {
                status: "approved" as const,
                reviewedBy: "GV thử nghiệm",
                reviewedAt: "2026-10-14",
                contentHash: "0".repeat(64),
              },
            }
          : word,
      ),
    };
    const result = selectCorpusItems(withApproved, { profile: confirmed, purpose: "assignment", kind: "word" });
    expect(result.ok && result.items.map((entry) => entry.item.id)).toEqual(["word:bà"]);
  });

  it("xem trước trả về mục chờ duyệt kèm trạng thái, bỏ mục bị từ chối", () => {
    const withRejected: KnowledgeBase = {
      ...kb,
      words: kb.words.map((word) =>
        word.id === "word:bé" ? { ...word, review: { status: "rejected" as const } } : word,
      ),
    };
    const result = selectCorpusItems(withRejected, {
      profile: demo,
      purpose: "preview",
      kind: "word",
      lessonOrdinal: 6,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const ids = result.items.map((entry) => entry.item.id);
    expect(ids).toContain("word:bà");
    expect(ids).not.toContain("word:bé");
    expect(result.items.every((entry) => entry.reviewStatus === "pending_review" && entry.verdict === "readable")).toBe(
      true,
    );
    expect(result.excludedByReview.rejected).toBe(1);
  });
});
