import { describe, expect, it } from "vitest";
import { DEMO_DATA_IS_FICTIONAL, DEMO_SESSIONS, DEMO_SUPPORT_LEVELS } from "@/features/demo/demo-data";
import { EXERCISE_TYPES } from "@/features/exercises/catalog";
import { LEARNING_PATHS } from "@/features/learning-paths/catalog";
import { isNFC } from "@/lib/vietnamese/normalize";

const PATH_IDS = ["khoi-dong", "vung-buoc", "tang-toc"] as const;

describe("danh mục sáu dạng bài (PRD §9)", () => {
  it("đúng sáu mã dạng bài theo thứ tự", () => {
    expect(EXERCISE_TYPES.map((type) => type.code)).toEqual([
      "letter_sound",
      "build_syllable",
      "identify_unit",
      "fill_blank",
      "word_picture",
      "sentence_reading",
    ]);
    expect(EXERCISE_TYPES.map((type) => type.order)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("tên dạng bài không trùng và ở dạng NFC", () => {
    const names = EXERCISE_TYPES.map((type) => type.name);
    expect(new Set(names).size).toBe(names.length);
    expect(names.every(isNFC)).toBe(true);
  });

  it("mọi dạng bài có phiếu tương đương và lộ trình hợp lệ", () => {
    for (const type of EXERCISE_TYPES) {
      expect(type.paperEquivalent.length).toBeGreaterThan(0);
      expect(type.primaryPaths.length).toBeGreaterThan(0);
      for (const path of type.primaryPaths) expect(PATH_IDS).toContain(path);
    }
  });
});

describe("ba lộ trình luyện tập (PRD §10)", () => {
  it("ánh xạ đúng lộ trình ↔ nhóm năng lực ↔ mức hỗ trợ khởi đầu", () => {
    expect(LEARNING_PATHS.map(({ id, band, startingSupport }) => ({ id, band, startingSupport }))).toEqual([
      { id: "khoi-dong", band: "foundation", startingSupport: 3 },
      { id: "vung-buoc", band: "developing", startingSupport: 2 },
      { id: "tang-toc", band: "extending", startingSupport: 1 },
    ]);
  });

  it("nhãn nhóm khớp cách gọi của giáo viên (Nhóm 1 = Đọc tốt)", () => {
    expect(LEARNING_PATHS.map((path) => path.teacherGroupLabel)).toEqual([
      "Nhóm 3 – Cần hỗ trợ nền tảng",
      "Nhóm 2 – Đang phát triển",
      "Nhóm 1 – Đọc tốt",
    ]);
  });

  it("chỉ tham chiếu dạng bài có trong danh mục", () => {
    const codes = new Set(EXERCISE_TYPES.map((type) => type.code));
    for (const path of LEARNING_PATHS) {
      for (const code of path.exerciseTypes) expect(codes.has(code)).toBe(true);
    }
  });
});

describe("dữ liệu demo giả lập", () => {
  it("được đánh dấu là giả lập", () => {
    expect(DEMO_DATA_IS_FICTIONAL).toBe(true);
  });

  it("mỗi buổi luyện mẫu dài 10–15 phút, có bước 'Thử như ở lớp' và kết thúc bằng lời khen", () => {
    for (const id of PATH_IDS) {
      const steps = DEMO_SESSIONS[id];
      const minutes = steps.reduce((sum, step) => sum + step.minutes, 0);
      expect(minutes).toBeGreaterThanOrEqual(10);
      expect(minutes).toBeLessThanOrEqual(15);
      expect(steps.some((step) => step.kind === "classroom_like")).toBe(true);
      expect(steps.at(-1)?.kind).toBe("celebrate");
    }
  });

  it("không có trường thông tin cá nhân nào", () => {
    const serialized = JSON.stringify({ DEMO_SESSIONS, DEMO_SUPPORT_LEVELS });
    expect(serialized).not.toMatch(
      /"(full_?name|first_?name|last_?name|student_?name|birth\w*|dob|phone\w*|email|address|photo\w*)"\s*:/i,
    );
  });

  it("bốn mức hỗ trợ giảm dần H3 → H0", () => {
    expect(DEMO_SUPPORT_LEVELS.map((level) => level.code)).toEqual(["H3", "H2", "H1", "H0"]);
    expect(DEMO_SUPPORT_LEVELS.map((level) => level.level)).toEqual([3, 2, 1, 0]);
  });
});
