import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Level } from "../../../src/features/game-engine/core";
import { SavedMaze } from "../../../src/features/game-engine/ui/saved-maze";
import { vi as strings } from "../../../src/strings/vi";
import level1 from "../../../content/games/treasure-maze/levels/level-01.json";

/** R07.5b2 — màn Mê cung có lưu: mở lượt, khôi phục, tự lưu, xung đột, chờ nội dung. fetch giả lập tại biên mạng. */

const LEVEL: Level = { id: level1.id, rows: level1.rows, triggers: level1.triggers };
const STUDENT = "5b1c3a52-7a43-4c43-9a3e-0d8f6a1d2e11";
const RUN = "6c2d4b63-8b54-4d54-8b4f-1e9a7b2e3f22";
const PAUSE = strings.treasureMazeDemo.pause;

type Reply = { status?: number; body: unknown } | Error;
let replies: Reply[];
let requests: { url: string; method: string; body: unknown }[];

function run(row: number, col: number, version: number, scored = false, replay = false) {
  return {
    ok: true,
    data: {
      outcome: "resumed",
      run: {
        id: RUN,
        levelKey: LEVEL.id,
        levelVersion: "v",
        position: { row, col },
        stateVersion: version,
        status: "in_progress",
        scored,
        replay,
      },
    },
  };
}

const saved = (row: number, col: number, version: number, outcome = "saved") => ({
  body: { ok: true, data: { outcome, position: { row, col }, stateVersion: version } },
});
const failure = (status: number, code: string) => ({ status, body: { ok: false, code } });

beforeEach(() => {
  window.matchMedia = vi.fn().mockReturnValue({
    matches: false,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }) as unknown as typeof window.matchMedia;
  replies = [];
  requests = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      // R08.4: sau khi mở lượt, màn nạp trạng thái chạm trán của máy chủ; lượt cũ của R07 không có chạm trán (total 0).
      if (url.endsWith("/encounter") && (init?.method ?? "GET") === "GET") {
        return {
          status: 200,
          json: async () => ({
            ok: true,
            data: { runId: RUN, encounter: null, progress: { resolved: 0, total: 0 }, resolvedTriggerKeys: [] },
          }),
        } as Response;
      }
      requests.push({ url, method: init?.method ?? "GET", body: init?.body ? JSON.parse(String(init.body)) : null });
      const reply = replies.shift();
      if (!reply) throw new Error("hết phản hồi giả lập");
      if (reply instanceof Error) throw reply;
      return { status: reply.status ?? 200, json: async () => reply.body } as Response;
    }),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const mount = () =>
  render(<SavedMaze studentId={STUDENT} multipleProfiles={false} levelKey={LEVEL.id} level={LEVEL} />);
const hero = () => screen.getByTestId("maze-hero");
const stepRight = () => {
  fireEvent.keyDown(window, { code: "ArrowRight" });
  fireEvent.keyUp(window, { code: "ArrowRight" });
};
const pause = async () => {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: PAUSE }));
  });
};
// Màn hiện ra sau một cập nhật ngoài act (kết quả fetch): chờ hiệu ứng (gắn phím) chạy xong rồi mới thao tác.
const ready = async () => {
  await screen.findByTestId("maze-run");
  await act(async () => undefined);
};
const statusState = () => screen.getByTestId("save-status").getAttribute("data-state");

describe("SavedMaze", () => {
  it("INSUFFICIENT_CONTENT: thông báo chờ + liên kết bản thử nghiệm, không dựng bàn chơi", async () => {
    replies = [failure(409, "INSUFFICIENT_CONTENT")];
    mount();
    expect(await screen.findByText(strings.treasureMazePlay.preparing)).toBeTruthy();
    expect(screen.getByRole("link", { name: strings.treasureMazePlay.demoCta }).getAttribute("href")).toBe(
      "/demo/treasure-maze",
    );
    expect(screen.queryByTestId("maze-run")).toBeNull();
    expect(screen.queryByTestId("maze-ribbon")).toBeNull();
  });

  it("R08.6: lượt tính điểm đã xong (RUN_NOT_ACTIVE) → mời 'Chơi lại cho vui' kèm lời nói rõ không đổi điểm; chưa dựng bàn chơi", async () => {
    replies = [failure(409, "RUN_NOT_ACTIVE")];
    mount();
    const offer = await screen.findByTestId("maze-replay-offer");
    expect(offer.textContent).toContain(strings.treasureMazePlay.replay.offerTitle);
    expect(offer.textContent).toContain(strings.treasureMazePlay.replay.offerText);
    expect(offer.textContent).toContain("điểm thưởng sẽ không thay đổi");
    expect(screen.getByRole("button", { name: strings.treasureMazePlay.replay.cta })).toBeTruthy();
    expect(screen.queryByTestId("maze-run")).toBeNull();
    expect(Object.keys(requests[0]!.body as object).sort()).toEqual(["gameKey", "levelKey", "studentId"]);
  });

  it("R08.6: bấm 'Chơi lại cho vui' chỉ gửi ý định replay (không điểm/mùa/lớp/scored); nhãn cố định 'Chơi lại — không tính điểm'", async () => {
    replies = [failure(409, "RUN_NOT_ACTIVE"), { body: run(1, 1, 1, false, true) }];
    mount();
    fireEvent.click(await screen.findByTestId("replay-start"));
    await ready();
    expect(requests).toHaveLength(2);
    expect(requests[1]).toMatchObject({ url: "/api/student/game-runs", method: "POST" });
    expect(Object.keys(requests[1]!.body as object).sort()).toEqual(["gameKey", "levelKey", "replay", "studentId"]);
    expect((requests[1]!.body as { replay: boolean }).replay).toBe(true);
    expect(screen.getByTestId("maze-ribbon").textContent).toBe(strings.treasureMazePlay.replay.ribbon);
    expect(screen.getByTestId("saved-maze").getAttribute("data-replay")).toBe("true");
    expect(screen.getByTestId("saved-maze").getAttribute("data-scored")).toBe("false");
    expect(document.body.textContent).not.toMatch(/\+10|−5/u);
  });

  it("R08.6: máy chủ từ chối chơi lại (REPLAY_NOT_AVAILABLE) → thông báo, không dựng bàn chơi, không nút thử lại vô ích", async () => {
    replies = [failure(409, "RUN_NOT_ACTIVE"), failure(409, "REPLAY_NOT_AVAILABLE")];
    mount();
    fireEvent.click(await screen.findByTestId("replay-start"));
    expect(await screen.findByText(strings.errors.REPLAY_NOT_AVAILABLE)).toBeTruthy();
    expect(screen.queryByRole("button", { name: strings.treasureMazePlay.retryLoad })).toBeNull();
    expect(screen.queryByTestId("maze-run")).toBeNull();
    expect((requests[1]!.body as { replay?: boolean }).replay).toBe(true);
  });

  it("chỉ gửi studentId + gameKey + levelKey (không điểm/mùa/lớp/scored)", async () => {
    replies = [{ body: run(1, 1, 1) }];
    mount();
    await ready();
    expect(requests[0]).toMatchObject({ url: "/api/student/game-runs", method: "POST" });
    expect(Object.keys(requests[0]!.body as object).sort()).toEqual(["gameKey", "levelKey", "studentId"]);
  });

  it("lượt không tính điểm: nhãn 'Chơi thử — không tính điểm'; khôi phục đúng vị trí máy chủ", async () => {
    replies = [{ body: run(1, 3, 4) }];
    mount();
    await ready();
    expect(screen.getByTestId("maze-ribbon").textContent).toBe(strings.treasureMazePlay.tryRibbon);
    expect(hero().getAttribute("data-row")).toBe("1");
    expect(hero().getAttribute("data-col")).toBe("3");
    expect(statusState()).toBe("saved");
  });

  it("không có nút 'Tiếp tục bản chơi thử'; điểm kích hoạt không chặn và rương luôn khóa", async () => {
    replies = [{ body: run(1, 3, 1) }];
    mount();
    await ready();
    expect(screen.queryByRole("button", { name: "Tiếp tục bản chơi thử" })).toBeNull();
    stepRight();
    expect(hero().getAttribute("data-col")).toBe("4"); // (1,4) là điểm kích hoạt tm01-t1
    expect(screen.getByText(strings.treasureMazePlay.lockedNote)).toBeTruthy();
  });

  it("đi hai bước rồi tạm dừng: lưu ngay đúng bước + stateVersion, sau đó 'Đã lưu'", async () => {
    replies = [{ body: run(1, 1, 5) }, saved(1, 3, 6)];
    mount();
    await ready();
    stepRight();
    stepRight();
    await pause();
    expect(requests[1]).toMatchObject({
      url: `/api/student/game-runs/${RUN}/position`,
      method: "PATCH",
      body: {
        studentId: STUDENT,
        stateVersion: 5,
        path: [
          { row: 1, col: 2 },
          { row: 1, col: 3 },
        ],
      },
    });
    await act(async () => undefined);
    expect(statusState()).toBe("saved");
  });

  it("mất mạng: 'Chưa lưu được' + Thử lại; thử lại gửi lại CHÍNH lô cũ", async () => {
    replies = [{ body: run(1, 1, 2) }, new TypeError("Failed to fetch"), saved(1, 2, 3, "replayed")];
    mount();
    await ready();
    stepRight();
    await pause();
    await act(async () => undefined);
    expect(statusState()).toBe("unsaved");
    expect(screen.getByText(strings.treasureMazePlay.save.unsavedHint)).toBeTruthy();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: strings.treasureMazePlay.save.retry }));
    });
    await act(async () => undefined);
    expect(requests[2]!.body).toEqual(requests[1]!.body);
    expect(statusState()).toBe("saved");
  });

  it("STATE_CONFLICT: giải thích số bước chưa lưu, ngừng ghi, 'Tải lại' mở lại từ máy chủ", async () => {
    replies = [{ body: run(1, 1, 2) }, failure(409, "STATE_CONFLICT"), { body: run(1, 6, 9) }];
    mount();
    await ready();
    stepRight();
    stepRight();
    await pause();
    const panel = await screen.findByTestId("maze-conflict");
    expect(panel.textContent).toContain("2 bước");
    expect(screen.queryByTestId("maze-run")).toBeNull();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: strings.treasureMazePlay.conflict.action }));
    });
    await ready();
    expect(hero().getAttribute("data-col")).toBe("6");
    expect(requests).toHaveLength(3); // 2 bước bị bỏ không được gửi lại
  });

  it("SEASON_CLOSED khi lưu: dừng chơi, hướng dẫn quay về trang học sinh", async () => {
    replies = [{ body: run(1, 1, 2) }, failure(409, "SEASON_CLOSED")];
    mount();
    await ready();
    stepRight();
    await pause();
    expect(await screen.findByTestId("maze-closed")).toBeTruthy();
    expect(screen.getByRole("link", { name: strings.treasureMazePlay.back }).getAttribute("href")).toBe("/learn/me");
  });

  it("INSUFFICIENT_POINTS khi mở: thông báo cần thêm điểm", async () => {
    replies = [failure(409, "INSUFFICIENT_POINTS")];
    mount();
    expect(await screen.findByText(strings.errors.INSUFFICIENT_POINTS)).toBeTruthy();
  });

  it("hết phiên khi lưu: không báo đã lưu", async () => {
    replies = [{ body: run(1, 1, 2) }, failure(401, "UNAUTHENTICATED")];
    mount();
    await ready();
    stepRight();
    await pause();
    expect(await screen.findByTestId("maze-signed-out")).toBeTruthy();
    expect(screen.queryByText(strings.treasureMazePlay.save.saved)).toBeNull();
  });

  it("'Về bản đồ' khi lưu thất bại: cảnh báo, không hứa đã lưu, cho phép vẫn về", async () => {
    replies = [{ body: run(1, 1, 2) }, new TypeError("Failed to fetch"), new TypeError("Failed to fetch")];
    mount();
    await ready();
    stepRight();
    await pause();
    await act(async () => undefined);
    await act(async () => {
      fireEvent.click(screen.getByRole("link", { name: strings.treasureMazeDemo.pauseOverlay.toMap }));
    });
    await act(async () => undefined);
    const overlay = screen.getByTestId("pause-overlay");
    expect(overlay.textContent).toContain(strings.treasureMazeDemo.pauseOverlay.unsavedTitle);
    expect(screen.queryByText(strings.treasureMazePlay.save.saved)).toBeNull();
    expect(
      screen.getByRole("link", { name: strings.treasureMazeDemo.pauseOverlay.leaveAnyway }).getAttribute("href"),
    ).toBe("/learn/me");
  });

  it("'Về bản đồ' khi đã lưu xong: đi thẳng sau khi máy chủ xác nhận", async () => {
    replies = [{ body: run(1, 1, 2) }, saved(1, 2, 3)];
    mount();
    await ready();
    stepRight();
    await pause();
    await act(async () => undefined);
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click");
    await act(async () => {
      fireEvent.click(screen.getByRole("link", { name: strings.treasureMazeDemo.pauseOverlay.toMap }));
    });
    await act(async () => undefined);
    expect(requests).toHaveLength(2); // bước đã được lưu khi tạm dừng, không gửi lại
    expect(click).toHaveBeenCalled();
    click.mockRestore();
  });
});
