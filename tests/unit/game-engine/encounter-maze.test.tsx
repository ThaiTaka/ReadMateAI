import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Level } from "../../../src/features/game-engine/core";
import { SavedMaze } from "../../../src/features/game-engine/ui/saved-maze";
import { vi as strings } from "../../../src/strings/vi";
import level1 from "../../../content/games/treasure-maze/levels/level-01.json";

/**
 * R08.4 — Mê cung có chạm trán: lưu vị trí TRƯỚC khi kích hoạt, màn quái vật, ba trái tim, điểm/HP lấy từ máy chủ, hoạt
 * cảnh kết thúc, quay lại mê cung, tải lại giữa chạm trán, mất mạng, rương. Máy chủ được giả lập tại biên fetch
 * (một "CSDL" nhỏ trong bộ nhớ) — trình duyệt thật không bao giờ chấm hay đếm.
 */

const LEVEL: Level = { id: level1.id, rows: level1.rows, triggers: level1.triggers };
const STUDENT = "5b1c3a52-7a43-4c43-9a3e-0d8f6a1d2e11";
const RUN = "6c2d4b63-8b54-4d54-8b4f-1e9a7b2e3f22";
const MONSTER = "mon-03";
const TRIGGER_IDS = LEVEL.triggers.map((trigger) => trigger.id);
const t = strings.encounter;

type Question = { id: string; status: "open" | "correct" | "exhausted"; attemptsUsed: number; last: string | null };
type Server = {
  position: { row: number; col: number };
  version: number;
  balance: number;
  /** R08.6: lượt chơi lại không tính điểm (máy chủ trả scored=false, replay=true; câu scorable=false). */
  replay: boolean;
  maxAttempts: number;
  resolved: Set<string>;
  active: null | { key: string; hp: number; questions: Question[] };
  log: string[];
  attempts: Map<string, unknown>;
  attemptBodies: { questionId: string; clientAttemptId: string }[];
  failNext: { positionPatch: number; attempt: number; attemptCode: string | null };
};
let server: Server;

const failure = (status: number, code: string) => ({ status, body: { ok: false, code } });
const ok = (data: unknown) => ({ status: 200, body: { ok: true, data } });

function publicQuestion(question: Question, index: number) {
  return {
    id: question.id,
    sessionId: "",
    position: index + 1,
    total: 3,
    view: {
      type: "identify_unit",
      variant: "which_rime",
      content: {
        syllable: "khoẻ",
        options: [
          { id: "o1", text: "ua", unit: "rime:ua" },
          { id: "o2", text: "eo", unit: "rime:eo" },
          { id: "o3", text: "oe", unit: "rime:oe" },
        ],
      },
    },
    status: question.status,
    attemptsUsed: question.attemptsUsed,
    maxAttempts: server.maxAttempts,
    supportLevel: 3,
    scorable: !server.replay,
    lastResponse: question.last ? { kind: "choice", optionId: question.last } : null,
    marks: question.last ? { [question.last]: question.last === "o3" ? "correct" : "incorrect" } : {},
    feedback: null,
    hint: null,
    hintMode: "reactive",
    reveal: null,
  };
}

function encounterState() {
  const active = server.active;
  const encounter = active && {
    id: "enc-" + active.key,
    encounterNo: server.resolved.size + 1,
    monsterKey: MONSTER,
    hpRemaining: active.hp,
    questions: active.questions.map((q, i) => ({ id: q.id, position: i + 1, status: q.status })),
    current: (() => {
      const index = active.questions.findIndex((q) => q.status === "open");
      return index < 0 ? null : publicQuestion(active.questions[index]!, index);
    })(),
    progress: { total: 3, closed: active.questions.filter((q) => q.status !== "open").length, correct: 0 },
  };
  return {
    runId: RUN,
    encounter,
    progress: { resolved: server.resolved.size, total: 7 },
    resolvedTriggerKeys: [...server.resolved],
  };
}

function route(url: string, method: string, body: Record<string, unknown> | null) {
  if (url === "/api/student/game-runs" && method === "POST") {
    return ok({
      outcome: "resumed",
      run: {
        id: RUN,
        levelKey: LEVEL.id,
        levelVersion: "v",
        position: server.position,
        stateVersion: server.version,
        status: "in_progress",
        scored: !server.replay,
        replay: server.replay,
      },
    });
  }
  if (url.endsWith("/encounter") && method === "GET") return ok(encounterState());
  if (url.endsWith("/position") && method === "PATCH") {
    if (server.failNext.positionPatch > 0) {
      server.failNext.positionPatch -= 1;
      throw new Error("mất mạng");
    }
    if (server.active) return failure(409, "ENCOUNTER_ACTIVE");
    const path = body!.path as { row: number; col: number }[];
    server.position = path.at(-1)!;
    server.version += 1;
    server.log.push(`position:${server.position.row},${server.position.col}`);
    return ok({ outcome: "saved", position: server.position, stateVersion: server.version });
  }
  if (url.endsWith("/encounters/activate") && method === "POST") {
    server.log.push("activate");
    if (server.active) return ok({ outcome: "resumed", state: encounterState() });
    const trigger = LEVEL.triggers.find((item) => item.row === server.position.row && item.col === server.position.col);
    if (!trigger) return failure(409, "NOT_AT_TRIGGER");
    if (server.resolved.has(trigger.id)) return failure(409, "ENCOUNTER_FINISHED");
    server.active = {
      key: trigger.id,
      hp: 3,
      questions: [1, 2, 3].map((n) => ({ id: `q${n}`, status: "open", attemptsUsed: 0, last: null })),
    };
    return ok({ outcome: "activated", state: encounterState() });
  }
  const attemptMatch = /question-instances\/([^/]+)\/attempts$/.exec(url);
  if (attemptMatch && method === "POST") {
    const questionId = attemptMatch[1]!;
    const clientAttemptId = String(body!.clientAttemptId);
    server.attemptBodies.push({ questionId, clientAttemptId });
    if (server.failNext.attempt > 0) {
      server.failNext.attempt -= 1;
      throw new Error("mất mạng");
    }
    if (server.failNext.attemptCode) return failure(409, server.failNext.attemptCode);
    const replay = server.attempts.get(clientAttemptId);
    if (replay) return ok({ ...(replay as object), replayed: true });
    const active = server.active!;
    const index = active.questions.findIndex((q) => q.id === questionId);
    const question = active.questions[index]!;
    const optionId = (body!.response as { optionId: string }).optionId;
    const correct = optionId === "o3";
    question.last = optionId;
    question.attemptsUsed += 1;
    let applied: number;
    if (correct) {
      question.status = "correct";
      active.hp -= 1;
      applied = server.replay ? 0 : 10;
    } else {
      applied = server.replay ? 0 : Math.max(-5, -server.balance);
      if (question.attemptsUsed >= server.maxAttempts) question.status = "exhausted";
    }
    server.balance += applied;
    let status: "active" | "defeated" | "undefeated" = "active";
    if (active.questions.every((q) => q.status !== "open")) {
      status = active.hp === 0 ? "defeated" : "undefeated";
      server.resolved.add(active.key);
      server.active = null;
    }
    const result = {
      question: publicQuestion(question, index),
      points: server.replay ? null : { nominalDelta: correct ? 10 : -5, appliedDelta: applied },
      score: { balance: server.balance, earnedTotal: server.balance },
      tilesAvailable: 0,
      newlyUnlockedGames: [],
      sessionStatus: "in_progress",
      encounter: { encounterNo: 1, status, hpRemaining: active.hp },
      replayed: false,
    };
    server.attempts.set(clientAttemptId, result);
    return ok(result);
  }
  if (url.endsWith("/treasure/open") && method === "POST") {
    server.log.push("treasure");
    if (server.resolved.size < 7) return failure(409, "ENCOUNTERS_INCOMPLETE");
    return ok({
      outcome: "opened",
      runId: RUN,
      completedAt: "2026-10-22T00:00:00Z",
      defeated: 5,
      undefeated: 2,
    });
  }
  return failure(404, "NOT_FOUND");
}

beforeEach(() => {
  window.matchMedia = vi.fn().mockReturnValue({
    matches: false,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }) as unknown as typeof window.matchMedia;
  server = {
    position: { row: 1, col: 3 },
    version: 1,
    balance: 100,
    replay: false,
    maxAttempts: 3,
    resolved: new Set(),
    active: null,
    log: [],
    attempts: new Map(),
    attemptBodies: [],
    failNext: { positionPatch: 0, attempt: 0, attemptCode: null },
  };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const reply = route(url, init?.method ?? "GET", init?.body ? JSON.parse(String(init.body)) : null);
      return { status: reply.status, json: async () => reply.body } as Response;
    }),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const mount = (balance = 100) =>
  render(
    <SavedMaze studentId={STUDENT} multipleProfiles={false} levelKey={LEVEL.id} level={LEVEL} balance={balance} />,
  );
const hero = () => screen.getByTestId("maze-hero");
const ready = async () => {
  await screen.findByTestId("maze-run");
  await act(async () => undefined);
};
const step = (code: string) => {
  fireEvent.keyDown(window, { code });
  fireEvent.keyUp(window, { code });
};
/** Đi tới điểm kích hoạt tm01-t1 (1,4) và chờ màn câu hỏi hiện ra. */
async function meetFirstMonster() {
  mount();
  await ready();
  step("ArrowRight");
  return screen.findByTestId("encounter-question");
}
const option = (text: string) => screen.getByRole("button", { name: new RegExp(`^${text}`) });
const check = async () => {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: t.check }));
  });
};
const answer = async (text: string) => {
  fireEvent.click(option(text));
  await check();
};
const hp = () => Number(screen.getByTestId("encounter-hp").getAttribute("data-hp"));
const score = () => Number(screen.getByTestId("encounter-score").getAttribute("data-score"));
const nextQuestion = async () => {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: t.next }));
  });
};

describe("Mê cung có chạm trán — kích hoạt", () => {
  it("không vẽ trước quái vật; dừng đúng ô, lưu vị trí TRƯỚC rồi mới kích hoạt; hiện đúng quái vật + 3 trái tim", async () => {
    mount();
    await ready();
    expect(screen.queryByTestId("monster-view")).toBeNull();
    expect(screen.queryByTestId("encounter-screen")).toBeNull();
    step("ArrowRight");
    await screen.findByTestId("encounter-question");
    expect(server.log).toEqual(["position:1,4", "activate"]);
    expect(hero().getAttribute("data-col")).toBe("4");
    expect(screen.getByTestId("monster-view").getAttribute("data-monster")).toBe(MONSTER);
    expect(screen.getByText(strings.monsters[MONSTER]!, { selector: "p" })).toBeTruthy();
    expect(hp()).toBe(3);
    expect(screen.getByText("Bạn quái vật còn 3 trong 3 trái tim.")).toBeTruthy();
    expect(screen.getByTestId("encounter-step").textContent).toBe("Câu hỏi 1 / 3");
    expect(screen.getByRole("dialog").getAttribute("aria-modal")).toBe("true");
  });

  it("không đi tiếp khi còn chạm trán đang diễn ra; phím trong màn quái vật không làm nhân vật di chuyển", async () => {
    await meetFirstMonster();
    step("ArrowRight");
    step("ArrowLeft");
    fireEvent.keyDown(option("oe"), { code: "ArrowRight" });
    expect(hero().getAttribute("data-col")).toBe("4");
    expect(server.log.filter((entry) => entry === "activate")).toHaveLength(1);
  });

  it("lưu vị trí thất bại → KHÔNG kích hoạt, hiện nút Thử lại; thử lại thì lưu rồi kích hoạt", async () => {
    server.failNext.positionPatch = 1;
    mount();
    await ready();
    step("ArrowRight");
    const retry = await screen.findByTestId("encounter-retry");
    expect(server.log).toEqual([]);
    expect(screen.queryByTestId("monster-view")).toBeNull();
    await act(async () => {
      fireEvent.click(within(retry).getByRole("button", { name: t.retry }));
    });
    await screen.findByTestId("encounter-question");
    expect(server.log).toEqual(["position:1,4", "activate"]);
  });

  it("điểm kích hoạt đã dùng (máy chủ báo) không dừng lại và không kích hoạt lại", async () => {
    server.resolved.add("tm01-t1");
    mount();
    await ready();
    step("ArrowRight");
    step("ArrowRight");
    expect(hero().getAttribute("data-col")).toBe("5");
    expect(screen.queryByTestId("encounter-screen")).toBeNull();
    expect(server.log).not.toContain("activate");
  });

  it("máy chủ trả ENCOUNTER_FINISHED (tab khác đã xong) → chỉ gỡ chặn, không hiện màn quái vật", async () => {
    mount();
    await ready();
    server.resolved.add("tm01-t1");
    step("ArrowRight");
    await waitFor(() => expect(server.log).toContain("activate"));
    await waitFor(() => expect(screen.queryByTestId("encounter-screen")).toBeNull());
    step("ArrowRight");
    expect(hero().getAttribute("data-col")).toBe("5");
  });
});

describe("Mê cung có chạm trán — câu hỏi, điểm, trái tim", () => {
  it("đúng: điểm +10 và HP −1 theo số máy chủ trả; hiện điểm máy chủ xác nhận", async () => {
    await meetFirstMonster();
    expect(score()).toBe(100);
    await answer("oe");
    expect(hp()).toBe(2);
    expect(score()).toBe(110);
    expect(screen.getByText("Bạn quái vật còn 2 trong 3 trái tim.")).toBeTruthy();
    expect(screen.getByLabelText(strings.scoredPractice.plusLabel.replace("{n}", "10"))).toBeTruthy();
  });

  it("sai: điểm −5, HP giữ nguyên, không hiện chữ phạt; không gửi lại đúng đáp án vừa sai", async () => {
    await meetFirstMonster();
    await answer("ua");
    expect(hp()).toBe(3);
    expect(score()).toBe(95);
    expect(document.body.textContent).not.toMatch(/thua|thất bại|sai rồi/i);
    // chưa đổi lựa chọn → nút Kiểm tra khóa
    expect((screen.getByRole("button", { name: t.check }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("sàn 0 do máy chủ quyết định", async () => {
    server.balance = 3;
    mount(3);
    await ready();
    step("ArrowRight");
    await screen.findByTestId("encounter-question");
    await answer("ua");
    expect(score()).toBe(0);
  });

  it("đủ ba câu đúng: lần lượt 1 → 2 → 3, không có câu thứ tư; defeated → ngôi sao + lời khen; quay lại đúng ô", async () => {
    await meetFirstMonster();
    for (const n of [1, 2, 3]) {
      expect(screen.getByTestId("encounter-step").textContent).toBe(`Câu hỏi ${n} / 3`);
      expect(screen.getByTestId("encounter-question").getAttribute("data-question-id")).toBe(`q${n}`);
      await answer("oe");
      expect(hp()).toBe(3 - n);
      if (n < 3) await nextQuestion();
    }
    expect(screen.queryByRole("button", { name: t.next })).toBeNull();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: t.seeResult }));
    });
    const result = await screen.findByTestId("encounter-result");
    expect(result.getAttribute("data-outcome")).toBe("defeated");
    expect(screen.getByTestId("monster-view").getAttribute("data-mood")).toBe("defeated");
    expect(screen.getAllByTestId("monster-star").length).toBeGreaterThan(0);
    expect(screen.getByText(t.defeated.title)).toBeTruthy();
    await waitFor(() =>
      expect(screen.getByTestId("encounter-progress").textContent).toBe("Con đã gặp 1/7 bạn quái vật!"),
    );
    expect(score()).toBe(130);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: t.backToMaze }));
    });
    expect(screen.queryByTestId("encounter-screen")).toBeNull();
    expect(hero().getAttribute("data-col")).toBe("4");
    await waitFor(() => expect(screen.getByTestId("maze-progress").textContent).toBe("Con đã gặp 1/7 bạn quái vật!"));
    // đi tiếp được, quay lại ô cũ không kích hoạt lại
    step("ArrowRight");
    expect(hero().getAttribute("data-col")).toBe("5");
    step("ArrowLeft");
    expect(hero().getAttribute("data-col")).toBe("4");
    expect(screen.queryByTestId("encounter-screen")).toBeNull();
    expect(server.log.filter((entry) => entry === "activate")).toHaveLength(1);
  });

  it("hết lượt cả ba câu: undefeated → bay đi ngủ, 'Hẹn gặp lại nhé!', không từ 'thua/thất bại'", async () => {
    server.maxAttempts = 1;
    await meetFirstMonster();
    for (const n of [1, 2, 3]) {
      await answer("ua");
      if (n < 3) await nextQuestion();
    }
    expect(hp()).toBe(3);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: t.seeResult }));
    });
    const result = await screen.findByTestId("encounter-result");
    expect(result.getAttribute("data-outcome")).toBe("undefeated");
    expect(screen.getByTestId("monster-view").getAttribute("data-mood")).toBe("undefeated");
    expect(screen.getByTestId("monster-zzz")).toBeTruthy();
    expect(screen.getByText("Hẹn gặp lại nhé!")).toBeTruthy();
    expect(screen.queryAllByTestId("monster-star")).toHaveLength(0);
    expect(document.body.textContent).not.toMatch(/thua|thất bại/i);
  });

  it("mất mạng khi nộp: giữ bài, 'Gửi lại' dùng ĐÚNG clientAttemptId, không nhân đôi điểm", async () => {
    await meetFirstMonster();
    server.failNext.attempt = 1;
    fireEvent.click(option("oe"));
    await check();
    expect(screen.getByRole("alert").textContent).toContain(t.networkError);
    expect(score()).toBe(100);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: t.resend }));
    });
    expect(server.attemptBodies).toHaveLength(2);
    expect(server.attemptBodies[1]!.clientAttemptId).toBe(server.attemptBodies[0]!.clientAttemptId);
    expect(score()).toBe(110);
    expect(hp()).toBe(2);
  });

  it("nút Kiểm tra khóa trong lúc gửi (không gửi song song)", async () => {
    await meetFirstMonster();
    fireEvent.click(option("oe"));
    const button = screen.getByRole("button", { name: t.check });
    await act(async () => {
      fireEvent.click(button);
      fireEvent.click(button);
    });
    expect(server.attemptBodies).toHaveLength(1);
  });

  it("mùa đã đóng giữa lúc làm câu hỏi: dừng, hướng dẫn dễ hiểu, không tiếp tục cộng điểm", async () => {
    await meetFirstMonster();
    server.failNext.attemptCode = "SEASON_CLOSED";
    await answer("oe");
    const stopped = await screen.findByTestId("encounter-stopped");
    expect(stopped.textContent).toContain(strings.treasureMazePlay.closed.text);
    expect(score).toBeTruthy();
  });

  it("tạm dừng không đổi gì; Chơi tiếp quay lại đúng câu", async () => {
    await meetFirstMonster();
    await answer("oe");
    await nextQuestion();
    await act(async () => {
      fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: t.pause }));
    });
    expect(screen.getByTestId("encounter-pause")).toBeTruthy();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: t.resume }));
    });
    expect(screen.getByTestId("encounter-step").textContent).toBe("Câu hỏi 2 / 3");
    expect(score()).toBe(110);
    expect(server.balance).toBe(110);
  });
});

describe("Mê cung có chạm trán — tải lại và kho báu", () => {
  it("tải lại giữa chạm trán: mở lại đúng câu, HP và điểm, không kích hoạt/lưu lại", async () => {
    server.position = { row: 1, col: 4 };
    server.active = {
      key: "tm01-t1",
      hp: 2,
      questions: [
        { id: "q1", status: "correct", attemptsUsed: 1, last: "o3" },
        { id: "q2", status: "open", attemptsUsed: 0, last: null },
        { id: "q3", status: "open", attemptsUsed: 0, last: null },
      ],
    };
    mount(110);
    await screen.findByTestId("encounter-question");
    expect(screen.getByTestId("encounter-step").textContent).toBe("Câu hỏi 2 / 3");
    expect(hp()).toBe(2);
    expect(score()).toBe(110);
    expect(server.log).toEqual([]);
  });

  it("đứng ở điểm kích hoạt chưa dùng khi tải lại: máy chủ không cho rời đi → mở cổng và kích hoạt", async () => {
    server.position = { row: 1, col: 4 };
    mount();
    await screen.findByTestId("encounter-question");
    expect(server.log).toContain("activate");
  });

  it("rương khóa khi chưa đủ 7/7: lời nhắc tích cực, không cộng điểm", async () => {
    server.position = { row: 7, col: 2 };
    for (const id of TRIGGER_IDS.slice(0, 3)) server.resolved.add(id);
    mount();
    await ready();
    step("ArrowLeft");
    const locked = await screen.findByTestId("treasure-locked");
    expect(locked.textContent).toContain("3/7");
    expect(screen.queryByTestId("treasure-opened")).toBeNull();
    expect(server.balance).toBe(100);
    expect(screen.queryByText(strings.treasureMazeDemo.messages.opened)).toBeNull();
  });

  it("đủ 7/7 và đứng ở rương: máy chủ mở, hiện hoạt cảnh + số liệu do máy chủ; không cộng điểm; khóa điều khiển", async () => {
    server.position = { row: 7, col: 2 };
    for (const id of TRIGGER_IDS) server.resolved.add(id);
    mount();
    await ready();
    step("ArrowLeft");
    const opened = await screen.findByTestId("treasure-opened");
    expect(opened.textContent).toContain("Con đã khám phá xong Mê cung kho báu!");
    expect(opened.textContent).toContain("5 bạn biến thành sao");
    expect(opened.textContent).toContain("2 bạn bay đi ngủ");
    expect(server.balance).toBe(100);
    expect(server.log).toEqual(["position:7,1", "treasure"]);
    step("ArrowRight");
    expect(hero().getAttribute("data-col")).toBe("1");
  });

  it("không tự mở rương dựa vào đếm của trình duyệt: ô rương luôn hỏi máy chủ", async () => {
    server.position = { row: 7, col: 2 };
    mount();
    await ready();
    step("ArrowLeft");
    await screen.findByTestId("treasure-locked");
    expect(server.log).toContain("treasure");
  });
});

describe("R08.6 — Mê cung chơi lại không tính điểm", () => {
  it("nhãn cố định, không hiện điểm hay +10/−5; đúng vẫn giảm trái tim, sai giữ nguyên; điểm máy chủ không đổi", async () => {
    server.replay = true;
    await meetFirstMonster();
    expect(screen.getByTestId("maze-ribbon").textContent).toBe(strings.treasureMazePlay.replay.ribbon);
    expect(screen.getByTestId("encounter-replay").textContent).toBe(t.replayBadge);
    expect(screen.queryByTestId("encounter-score")).toBeNull();
    expect(hp()).toBe(3);

    await answer("ua");
    expect(hp()).toBe(3); // sai: trái tim giữ nguyên
    await answer("oe");
    expect(hp()).toBe(2); // đúng: mất một trái tim
    expect(screen.getByTestId("encounter-replay")).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/\+10|−5|\d+ điểm/u);
    expect(server.balance).toBe(100);
  });

  it("tải lại giữa chạm trán chơi lại: nhãn vẫn còn, quay lại đúng câu và HP, không kích hoạt lại", async () => {
    server.replay = true;
    await meetFirstMonster();
    await answer("oe");
    await nextQuestion();
    expect(screen.getByTestId("encounter-step").textContent).toBe("Câu hỏi 2 / 3");
    cleanup();
    mount();
    await screen.findByTestId("encounter-question");
    expect(screen.getByTestId("encounter-step").textContent).toBe("Câu hỏi 2 / 3");
    expect(screen.getByTestId("encounter-replay")).toBeTruthy();
    expect(hp()).toBe(2);
    expect(server.log.filter((entry) => entry === "activate")).toHaveLength(1);
    expect(server.balance).toBe(100);
  });

  it("lượt tính điểm giữ nguyên: không có nhãn chơi lại, vẫn hiện điểm", async () => {
    await meetFirstMonster();
    expect(screen.queryByTestId("encounter-replay")).toBeNull();
    expect(screen.getByTestId("maze-ribbon").textContent).toBe(strings.treasureMazePlay.scoredRibbon);
    expect(screen.getByTestId("encounter-score")).toBeTruthy();
  });
});
