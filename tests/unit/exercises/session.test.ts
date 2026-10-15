import { describe, expect, it } from "vitest";
import type { Response } from "@/features/exercises/core/primitives";
import type { ExerciseItem } from "@/features/exercises/items";
import { runtimeOf } from "@/features/exercises/runtime-registry";
import { summarizeSession } from "@/features/exercises/session/results";
import {
  activeHints,
  allSettled,
  canHint,
  canSubmit,
  createSession,
  hasHelpButton,
  needsIntro,
  sessionReducer,
  type SessionAction,
  type SessionEntry,
  type SessionState,
} from "@/features/exercises/session/session";
import type { SupportLevel } from "@/types/learning";
import { demoItems, firstItem } from "./helpers";

function entries(items: readonly ExerciseItem[], supportLevel: SupportLevel, previewOnly = false): SessionEntry[] {
  return items.map((item) => ({ item, supportLevel, blockId: "b1", previewOnly }));
}

function run(state: SessionState, ...actions: SessionAction[]): SessionState {
  return actions.reduce(sessionReducer, state);
}

const started = (items: readonly ExerciseItem[], level: SupportLevel) =>
  run(createSession(entries(items, level)), { type: "begin_block", at: 1000 });

function correct(state: SessionState): Response {
  const item = state.entries[state.index]?.item;
  if (!item) throw new Error("không có câu");
  return runtimeOf(item).correctResponse(item);
}

function wrong(state: SessionState): Response {
  const item = state.entries[state.index]?.item;
  if (!item || !("options" in item.content)) throw new Error("cần câu có phương án");
  const right = runtimeOf(item).correctResponse(item);
  const option = item.content.options.find((entry) => right.kind === "choice" && entry.id !== right.optionId);
  if (!option) throw new Error("thiếu phương án sai");
  return { kind: "choice", optionId: option.id };
}

describe("bộ chạy phiên luyện (reducer thuần)", () => {
  const items = demoItems("which_tone", "developing", { count: 3 });

  it("phải xem hướng dẫn của dạng bài trước khi làm câu đầu", () => {
    const state = createSession(entries(items, 2));
    expect(needsIntro(state)).toBe(true);
    expect(canSubmit(run(state, { type: "change", response: correct(state) }))).toBe(false);
    expect(needsIntro(run(state, { type: "begin_block", at: 1 }))).toBe(false);
  });

  it("chưa chọn thì chưa được kiểm tra; chọn đúng → đúng, khóa câu, có phản hồi khen", () => {
    let state = started(items, 2);
    expect(canSubmit(state)).toBe(false);
    state = run(state, { type: "change", response: correct(state) }, { type: "submit", at: 2000 });
    const progress = state.progress[0];
    expect(progress?.status).toBe("correct");
    expect(progress?.feedback?.tone).toBe("correct");
    // Chọn lại sau khi đã đúng bị bỏ qua (câu đã khóa).
    const after = run(state, { type: "change", response: wrong(state) });
    expect(after.progress[0]?.draft).toEqual(progress?.draft);
  });

  it("bấm Kiểm tra hai lần liên tiếp chỉ chấm một lần", () => {
    let state = started(items, 2);
    state = run(
      state,
      { type: "change", response: wrong(state) },
      { type: "submit", at: 2 },
      { type: "submit", at: 3 },
    );
    expect(state.progress[0]?.attempts).toHaveLength(1);
  });

  it("sai → phản hồi không nói đáp án → Thử lại xóa lựa chọn nhưng giữ số lượt → chọn lại đúng", () => {
    let state = started(items, 2);
    state = run(state, { type: "change", response: wrong(state) }, { type: "submit", at: 2 });
    const feedback = state.progress[0]?.feedback;
    expect(state.progress[0]?.status).toBe("retry");
    expect(feedback?.tone).toBe("retry");
    expect(feedback?.reveal).toBeNull();
    state = run(state, { type: "retry" });
    expect(state.progress[0]?.draft).toBeNull();
    expect(state.progress[0]?.attempts).toHaveLength(1);
    state = run(state, { type: "change", response: correct(state) }, { type: "submit", at: 3 });
    expect(state.progress[0]?.status).toBe("correct");
    expect(state.progress[0]?.attempts.map((attempt) => attempt.correct)).toEqual([false, true]);
  });

  it("chọn lại sau khi sai (không bấm Thử lại) cũng được: dấu sai cũ được xóa, lựa chọn mới được giữ", () => {
    let state = started(items, 2);
    state = run(state, { type: "change", response: wrong(state) }, { type: "submit", at: 2 });
    state = run(state, { type: "change", response: correct(state) });
    expect(state.progress[0]?.lastGrade).toBeNull();
    expect(state.progress[0]?.draft).toEqual(correct(state));
  });

  it("hết lượt → hiện đáp án (H3: 3 lượt, H1: 2 lượt, H0: 1 lượt)", () => {
    for (const [level, attempts] of [
      [3, 3],
      [1, 2],
      [0, 1],
    ] as const) {
      let state = started(items, level);
      for (let index = 0; index < attempts; index += 1) {
        state = run(state, { type: "change", response: wrong(state) }, { type: "submit", at: index });
      }
      expect(state.progress[0]?.status, `H${level}`).toBe("revealed");
      expect(state.progress[0]?.feedback?.tone).toBe("reveal");
      expect(state.progress[0]?.feedback?.reveal?.answerText).toBeTruthy();
    }
  });

  it("gợi ý: H3 tự hiện sau lần sai; H2 khi bấm; H0 không có gợi ý", () => {
    let h3 = started(items, 3);
    h3 = run(h3, { type: "change", response: wrong(h3) }, { type: "submit", at: 2 });
    expect(h3.progress[0]?.proactiveHints).toBe(1);
    expect(activeHints(h3).views).toHaveLength(1);

    let h2 = started(items, 2);
    expect(canHint(h2)).toBe(true);
    h2 = run(h2, { type: "hint" });
    expect(h2.progress[0]?.hintRequests).toBe(1);

    const h0 = started(items, 0);
    expect(canHint(h0)).toBe(false);
    expect(run(h0, { type: "hint" }).progress[0]?.hintsShown).toBe(0);
  });

  it("Trợ giúp chỉ có ở H1 và được tính là dùng gợi ý", () => {
    const h1 = started(items, 1);
    const entry = h1.entries[0];
    if (!entry) throw new Error("không có câu");
    expect(hasHelpButton(entry)).toBe(true);
    expect(run(h1, { type: "help" }).progress[0]?.helpRequests).toBe(1);
    const h2 = started(items, 2);
    expect(run(h2, { type: "help" }).progress[0]?.helpRequests).toBe(0);
  });

  it("chuyển câu: chưa xong không sang câu sau; xong rồi sang được; quay lại xem câu đã làm; kết thúc khi xong hết", () => {
    let state = started(items, 2);
    expect(run(state, { type: "next", at: 1 }).index).toBe(0);
    for (let index = 0; index < items.length; index += 1) {
      state = run(state, { type: "change", response: correct(state) }, { type: "submit", at: 10 + index });
      if (index < items.length - 1) {
        expect(run(state, { type: "finish", at: 99 }).phase).toBe("running");
        state = run(state, { type: "next", at: 20 + index });
      }
    }
    expect(state.index).toBe(items.length - 1);
    expect(run(state, { type: "prev" }).index).toBe(items.length - 2);
    expect(run(state, { type: "goto", index: 0 }).index).toBe(0);
    expect(allSettled(state)).toBe(true);
    state = run(state, { type: "finish", at: 5000 });
    expect(state.phase).toBe("finished");
  });

  it("không nhảy tới câu chưa mở", () => {
    const state = started(items, 2);
    expect(run(state, { type: "goto", index: 2 }).index).toBe(0);
  });

  it("Làm lại: bắt đầu lại từ đầu với cùng các câu", () => {
    let state = started(items, 2);
    state = run(state, { type: "change", response: correct(state) }, { type: "submit", at: 2 }, { type: "restart" });
    expect(state.index).toBe(0);
    expect(state.progress.every((progress) => progress.attempts.length === 0)).toBe(true);
    expect(state.entries.map((entry) => entry.item.id)).toEqual(items.map((item) => item.id));
  });

  it("câu chỉ để xem giao diện (thiếu âm thanh bắt buộc): không chấm được nhưng vẫn chuyển câu được", () => {
    const preview = demoItems("listen_letter", "foundation", { count: 2 });
    let state = run(createSession(entries(preview, 3, true)), { type: "begin_block", at: 1 });
    state = run(state, { type: "change", response: correct(state) }, { type: "submit", at: 2 });
    expect(state.progress[0]?.attempts).toHaveLength(0);
    expect(run(state, { type: "next", at: 3 }).index).toBe(1);
  });

  it("bài sắp xếp câu: gợi ý đặt sẵn thẻ đầu câu (và dấu chấm cuối câu) vào câu trả lời", () => {
    const item = firstItem("arrange_words", "extending");
    let state = run(createSession(entries([item], 2)), { type: "begin_block", at: 1 }, { type: "hint" });
    const correctOrder = runtimeOf(item).correctResponse(item);
    if (correctOrder.kind !== "order") throw new Error("sai kiểu");
    const draft = state.progress[0]?.draft;
    expect(draft?.kind === "order" && draft.tokenIds[0]).toBe(correctOrder.tokenIds[0]);
    state = run(state, { type: "hint" });
    const after = state.progress[0]?.draft;
    expect(after?.kind === "order" && after.tokenIds.at(-1)).toBe(correctOrder.tokenIds.at(-1));
  });
});

describe("kết quả buổi luyện (chỉ trong bộ nhớ)", () => {
  const items = demoItems("which_tone", "developing", { count: 3 });

  it("đếm đúng: số câu đúng, đúng độc lập, thử lại, gợi ý, tỉ lệ hoàn thành, thời gian (trừ lúc ẩn trang)", () => {
    let state = started(items, 2);
    // Câu 1: đúng ngay, không gợi ý.
    state = run(
      state,
      { type: "change", response: correct(state) },
      { type: "submit", at: 2000 },
      { type: "next", at: 2100 },
    );
    // Câu 2: bấm gợi ý, sai một lần rồi đúng.
    state = run(state, { type: "hint" }, { type: "change", response: wrong(state) }, { type: "submit", at: 3000 });
    state = run(
      state,
      { type: "change", response: correct(state) },
      { type: "submit", at: 3500 },
      { type: "next", at: 3600 },
    );
    // Câu 3: sai hết lượt.
    for (let index = 0; index < 3; index += 1) {
      state = run(state, { type: "change", response: wrong(state) }, { type: "submit", at: 4000 + index });
    }
    state = run(state, { type: "hidden_time", ms: 500 }, { type: "finish", at: 6000 });
    const result = summarizeSession(state);
    expect(result).toMatchObject({
      totalItems: 3,
      gradableItems: 3,
      attemptedItems: 3,
      completedItems: 3,
      correctItems: 2,
      independentItems: 1,
      revealedItems: 1,
      retries: 3,
      hintsUsed: 1,
      helpRequests: 0,
      supportLevels: [2],
      completionRate: 1,
      activeDurationMs: 4500,
    });
  });

  it("chỉ số nghiên cứu: phần đo trong ứng dụng có số liệu; phần ghi nhận ở lớp để trống (không suy ra, không giả lập)", () => {
    let state = started(items, 2);
    state = run(state, { type: "change", response: correct(state) }, { type: "submit", at: 2 });
    const research = summarizeSession(state).research;
    const app = research.filter((indicator) => indicator.source === "app");
    const classroom = research.filter((indicator) => indicator.source === "classroom_observation");
    expect(app.map((indicator) => indicator.id)).toEqual(["self_started", "completed_without_hints"]);
    expect(classroom.map((indicator) => indicator.id)).toEqual(["paper_transfer", "teacher_reexplanations"]);
    expect(classroom.every((indicator) => indicator.value === null)).toBe(true);
    expect(app[0]?.value).toEqual({ numerator: 1, denominator: 1 });
  });

  it("kết quả không chứa thông tin cá nhân nào", () => {
    const serialized = JSON.stringify(summarizeSession(started(items, 2)));
    expect(serialized).not.toMatch(/"(full_?name|student_?name|birth\w*|phone\w*|email|address|nickname)"\s*:/iu);
  });
});
