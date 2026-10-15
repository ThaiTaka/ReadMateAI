import type { SupportLevel } from "../../../types/learning.ts";
import type { ExerciseItem } from "../items.ts";
import { runtimeOf, variantOf } from "../runtime-registry.ts";
import { decideBeforeGrading } from "../core/audio.ts";
import { feedbackFor, type Feedback } from "../core/feedback.ts";
import type { GradeResult, HintView, Response } from "../core/primitives.ts";
import { SUPPORT_POLICIES } from "../core/support.ts";

/**
 * Bộ chạy phiên luyện — HÀM THUẦN (reducer), không phụ thuộc React, dùng được để kiểm thử và (GĐ7) để
 * server dựng lại phiên. Mọi quy tắc (số lượt, gợi ý, hiện đáp án) đọc từ SUPPORT_POLICIES; thời điểm
 * (`at`) do giao diện truyền vào từ sự kiện của người dùng — reducer không tự đọc đồng hồ.
 *
 * Chống bấm nhiều lần: mọi hành động không hợp lệ ở trạng thái hiện tại bị bỏ qua (trả về đúng state cũ),
 * ví dụ bấm "Kiểm tra" hai lần liên tiếp chỉ chấm một lần.
 */

export type SessionEntry = {
  item: ExerciseItem;
  supportLevel: SupportLevel;
  /** Khối (dạng bài) mà câu thuộc về — để hiện màn hướng dẫn khi đổi dạng. */
  blockId: string;
  /** Câu chỉ để xem giao diện (thiếu âm thanh bắt buộc) — không chấm được. */
  previewOnly: boolean;
};

export type ItemStatus = "answering" | "retry" | "correct" | "revealed";

export type AttemptRecord = { response: Response; correct: boolean; errorTags: string[]; hintsBefore: number };

export type ItemProgress = {
  status: ItemStatus;
  draft: Response | null;
  attempts: AttemptRecord[];
  /** Số bậc gợi ý đang hiện. */
  hintsShown: number;
  /** Số lần trẻ bấm "Gợi ý". */
  hintRequests: number;
  /** Gợi ý tự hiện sau lần sai (chỉ H3). */
  proactiveHints: number;
  /** Số lần bấm "Trợ giúp" (H1) — được tính là dùng gợi ý. */
  helpRequests: number;
  lastGrade: GradeResult | null;
  feedback: Feedback | null;
  visited: boolean;
  /** Trẻ đã tự chọn phương án trước khi dùng bất kỳ gợi ý/trợ giúp nào (chỉ số nghiên cứu). */
  actedBeforeHelp: boolean | null;
  startedAt: number | null;
  completedAt: number | null;
};

export type SessionState = {
  entries: SessionEntry[];
  progress: ItemProgress[];
  index: number;
  /** Khối đã xem màn hướng dẫn. */
  introducedBlocks: string[];
  phase: "running" | "finished";
  startedAt: number | null;
  finishedAt: number | null;
  /** Tổng thời gian trang bị ẩn (chuyển tab) trong phiên — trừ ra khỏi thời gian làm bài. */
  hiddenMs: number;
};

export type SessionAction =
  | { type: "begin_block"; at: number }
  | { type: "change"; response: Response }
  | { type: "submit"; at: number }
  | { type: "retry" }
  | { type: "hint" }
  | { type: "help" }
  | { type: "next"; at: number }
  | { type: "prev" }
  | { type: "goto"; index: number }
  | { type: "finish"; at: number }
  | { type: "restart" }
  | { type: "hidden_time"; ms: number };

function freshProgress(entry: SessionEntry, visited: boolean): ItemProgress {
  return {
    status: "answering",
    draft: runtimeOf(entry.item).emptyResponse(entry.item),
    attempts: [],
    hintsShown: 0,
    hintRequests: 0,
    proactiveHints: 0,
    helpRequests: 0,
    lastGrade: null,
    feedback: null,
    visited,
    actedBeforeHelp: null,
    startedAt: null,
    completedAt: null,
  };
}

export function createSession(entries: readonly SessionEntry[]): SessionState {
  return {
    entries: [...entries],
    progress: entries.map((entry, index) => freshProgress(entry, index === 0)),
    index: 0,
    introducedBlocks: [],
    phase: "running",
    startedAt: null,
    finishedAt: null,
    hiddenMs: 0,
  };
}

export function isDone(progress: ItemProgress): boolean {
  return progress.status === "correct" || progress.status === "revealed";
}

/** Câu đã xong hoặc không chấm được (chỉ xem giao diện). */
export function isSettled(state: SessionState, index: number): boolean {
  const progress = state.progress[index];
  const entry = state.entries[index];
  return progress !== undefined && entry !== undefined && (isDone(progress) || entry.previewOnly);
}

export function needsIntro(state: SessionState): boolean {
  const entry = state.entries[state.index];
  return entry !== undefined && !state.introducedBlocks.includes(entry.blockId);
}

export function canSubmit(state: SessionState): boolean {
  const entry = state.entries[state.index];
  const progress = state.progress[state.index];
  if (!entry || !progress || entry.previewOnly || state.phase !== "running" || needsIntro(state)) return false;
  if (progress.status !== "answering" && progress.status !== "retry") return false;
  // Vừa sai và chưa chọn lại: không chấm lại đúng câu trả lời đó (bấm hai lần không làm mất lượt).
  if (progress.status === "retry" && progress.lastGrade !== null) return false;
  return runtimeOf(entry.item).isComplete(entry.item, progress.draft);
}

export function hintSteps(entry: SessionEntry): HintView[] {
  return SUPPORT_POLICIES[entry.supportLevel].hints === "none" ? [] : runtimeOf(entry.item).hints(entry.item);
}

export function canHint(state: SessionState): boolean {
  const entry = state.entries[state.index];
  const progress = state.progress[state.index];
  if (!entry || !progress || entry.previewOnly || needsIntro(state)) return false;
  if (progress.status !== "answering" && progress.status !== "retry") return false;
  return progress.hintsShown < hintSteps(entry).length;
}

/** "Trợ giúp" chỉ có khi câu lệnh ở mức này là loại "phát khi bấm, tính là gợi ý" (H1). */
export function hasHelpButton(entry: SessionEntry): boolean {
  return decideBeforeGrading(variantOf(entry.item).audioPolicy, "instruction", entry.supportLevel).countsAsHint;
}

export function allSettled(state: SessionState): boolean {
  return state.entries.every((_entry, index) => isSettled(state, index));
}

function update(state: SessionState, index: number, patch: Partial<ItemProgress>): SessionState {
  const progress = state.progress.map((entry, position) => (position === index ? { ...entry, ...patch } : entry));
  return { ...state, progress };
}

function usedHelp(progress: ItemProgress): boolean {
  return progress.hintRequests + progress.helpRequests + progress.proactiveHints > 0;
}

/** Gộp các bậc gợi ý đầu tiên `count` của một câu thành một lượt hiển thị. */
export function mergeHints(views: readonly HintView[]): HintView | null {
  if (views.length === 0) return null;
  return views.reduce<HintView>(
    (acc, view) => ({
      messageKey: view.messageKey,
      ...(acc.params || view.params ? { params: { ...acc.params, ...view.params } } : {}),
      eliminate: [...(acc.eliminate ?? []), ...(view.eliminate ?? [])],
      highlightParts: Boolean(acc.highlightParts || view.highlightParts),
      splitSyllables: Boolean(acc.splitSyllables || view.splitSyllables),
      enlargePicture: Boolean(acc.enlargePicture || view.enlargePicture),
      ...((view.segments ?? acc.segments) ? { segments: view.segments ?? acc.segments } : {}),
      ...((view.fixedTokenIds ?? acc.fixedTokenIds) ? { fixedTokenIds: view.fixedTokenIds ?? acc.fixedTokenIds } : {}),
    }),
    { messageKey: views[0]?.messageKey ?? "removedOne" },
  );
}

/** Câu trả lời sau khi bật thêm gợi ý (ví dụ đặt sẵn thẻ đầu câu) — dạng bài không điều chỉnh thì giữ nguyên. */
function draftAfterHint(entry: SessionEntry, draft: Response | null, hintsShown: number): Response | null {
  const typeModule = runtimeOf(entry.item);
  const merged = mergeHints(hintSteps(entry).slice(0, hintsShown));
  return merged && typeModule.adjustForHint ? typeModule.adjustForHint(entry.item, draft, merged) : draft;
}

export function sessionReducer(state: SessionState, action: SessionAction): SessionState {
  const entry = state.entries[state.index];
  const progress = state.progress[state.index];
  if (!entry || !progress) return state;

  switch (action.type) {
    case "begin_block": {
      if (!needsIntro(state)) return state;
      const started = update(state, state.index, { startedAt: progress.startedAt ?? action.at });
      return {
        ...started,
        introducedBlocks: [...state.introducedBlocks, entry.blockId],
        startedAt: state.startedAt ?? action.at,
      };
    }
    case "change": {
      // Câu chỉ để xem giao diện vẫn chọn được phương án (xem cơ chế), nhưng không chấm được (canSubmit).
      if (state.phase !== "running" || needsIntro(state)) return state;
      if (progress.status !== "answering" && progress.status !== "retry") return state;
      return update(state, state.index, {
        draft: action.response,
        // Chọn lại sau khi sai: xóa dấu đúng/sai cũ để trẻ thử lại trên màn hình sạch.
        lastGrade: progress.status === "retry" ? null : progress.lastGrade,
        feedback: progress.status === "retry" ? null : progress.feedback,
        actedBeforeHelp: progress.actedBeforeHelp ?? !usedHelp(progress),
      });
    }
    case "submit": {
      if (!canSubmit(state) || progress.draft === null) return state;
      const typeModule = runtimeOf(entry.item);
      const grade = typeModule.grade(entry.item, progress.draft);
      const attempts = [
        ...progress.attempts,
        {
          response: progress.draft,
          correct: grade.correct,
          errorTags: grade.errorTags,
          hintsBefore: progress.hintsShown,
        },
      ];
      const policy = SUPPORT_POLICIES[entry.supportLevel];
      const exhausted = !grade.correct && attempts.length >= policy.maxAttempts;
      const status: ItemStatus = grade.correct ? "correct" : exhausted ? "revealed" : "retry";
      const proactive =
        status === "retry" && policy.hints === "proactive" && progress.hintsShown < hintSteps(entry).length;
      const hintsShown = proactive ? progress.hintsShown + 1 : progress.hintsShown;
      return update(state, state.index, {
        status,
        attempts,
        draft: proactive ? draftAfterHint(entry, progress.draft, hintsShown) : progress.draft,
        lastGrade: grade,
        feedback: feedbackFor({
          variant: entry.item.variant,
          grade,
          attemptNo: attempts.length,
          maxAttempts: policy.maxAttempts,
          position: state.index,
          reveal: typeModule.reveal(entry.item),
        }),
        hintsShown,
        proactiveHints: proactive ? progress.proactiveHints + 1 : progress.proactiveHints,
        completedAt: status === "retry" ? null : action.at,
        startedAt: progress.startedAt ?? action.at,
      });
    }
    case "retry": {
      // "Thử lại": xóa lựa chọn cũ (giữ phần gợi ý đã đặt sẵn), giữ nguyên số lượt và gợi ý đã dùng.
      if (progress.status !== "retry") return state;
      return update(state, state.index, {
        draft: draftAfterHint(entry, runtimeOf(entry.item).emptyResponse(entry.item), progress.hintsShown),
        lastGrade: null,
        feedback: null,
      });
    }
    case "hint": {
      if (!canHint(state)) return state;
      const hintsShown = progress.hintsShown + 1;
      return update(state, state.index, {
        hintsShown,
        hintRequests: progress.hintRequests + 1,
        draft: draftAfterHint(entry, progress.draft, hintsShown),
      });
    }
    case "help": {
      if (!hasHelpButton(entry) || entry.previewOnly || isDone(progress) || needsIntro(state)) return state;
      return update(state, state.index, { helpRequests: progress.helpRequests + 1 });
    }
    case "next": {
      if (!isSettled(state, state.index) || state.index >= state.entries.length - 1) return state;
      const index = state.index + 1;
      const moved = update({ ...state, index }, index, { visited: true });
      const nextProgress = moved.progress[index];
      return nextProgress && nextProgress.startedAt === null && !needsIntro(moved)
        ? update(moved, index, { startedAt: action.at })
        : moved;
    }
    case "prev": {
      if (state.index === 0) return state;
      return { ...state, index: state.index - 1 };
    }
    case "goto": {
      const target = state.progress[action.index];
      if (!target || !target.visited) return state;
      return { ...state, index: action.index };
    }
    case "finish": {
      if (state.phase !== "running" || !allSettled(state)) return state;
      return { ...state, phase: "finished", finishedAt: action.at };
    }
    case "restart":
      return createSession(state.entries);
    case "hidden_time":
      return state.phase === "running" && state.startedAt !== null && action.ms > 0
        ? { ...state, hiddenMs: state.hiddenMs + action.ms }
        : state;
  }
}

/** Gợi ý đang hiện của câu hiện tại, gộp lại (loại phương án, tô màu, tách tiếng…). */
export function activeHints(state: SessionState): { views: HintView[]; merged: HintView | null } {
  const entry = state.entries[state.index];
  const progress = state.progress[state.index];
  if (!entry || !progress || progress.hintsShown === 0) return { views: [], merged: null };
  const views = hintSteps(entry).slice(0, progress.hintsShown);
  return { views, merged: mergeHints(views) };
}
