import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MazePlayer } from "../../../src/features/game-engine/ui/maze-player";
import { HOLD_DELAY_MS, STEP_MS } from "../../../src/features/game-engine/ui/use-hold-move";
import type { Level } from "../../../src/features/game-engine/core";
import level1 from "../../../content/games/treasure-maze/levels/level-01.json";

/** R07.4 — điều khiển bản chơi thử: bàn phím, nút cảm ứng, giữ/thả, tạm dừng, chạm trán, rương. */

/** Hành lang 11×11: 6 điểm kích hoạt trên đường, điểm thứ 7 ở ngách (2,1); rương ở cuối hành lang. */
const CORRIDOR: Level = {
  id: "unit-corridor",
  rows: ["###########", "#S.......T#", "#.#########", ...Array.from({ length: 8 }, () => "###########")].map((row) =>
    row.padEnd(11, "#"),
  ),
  triggers: [
    { id: "c1", row: 1, col: 2 },
    { id: "c2", row: 1, col: 3 },
    { id: "c3", row: 1, col: 4 },
    { id: "c4", row: 1, col: 5 },
    { id: "c5", row: 1, col: 6 },
    { id: "c6", row: 1, col: 7 },
    { id: "c7", row: 2, col: 1 },
  ],
};

/** Hành lang dài không có điểm kích hoạt trên đường: thử giữ-để-đi mà không bị chạm trán chặn. */
const OPEN: Level = {
  id: "unit-open",
  rows: ["###########", "#S.......T#", ...Array.from({ length: 7 }, () => "#.#########"), "###########"],
  triggers: Array.from({ length: 7 }, (_, i) => ({ id: `o${i + 1}`, row: i + 2, col: 1 })),
};

const LEVEL_1: Level = { id: level1.id, rows: level1.rows, triggers: level1.triggers };

function setup(levels: readonly Level[] = [LEVEL_1]) {
  render(<MazePlayer levels={levels} names={levels.map((l) => l.id)} />);
}

const hero = () => screen.getByTestId("maze-hero");
const at = () => [Number(hero().dataset.row), Number(hero().dataset.col)];
const moves = () => Number(screen.getByTestId("maze-run").dataset.moves);
const status = () => screen.getByTestId("maze-status").textContent;
const padButton = (name: string) => screen.getByRole("button", { name });
const key = (code: string) => {
  fireEvent.keyDown(document.body, { code });
  fireEvent.keyUp(document.body, { code });
};
const advance = (ms: number) => act(() => void vi.advanceTimersByTime(ms));
const resolve = () => fireEvent.click(screen.getByRole("button", { name: "Tiếp tục bản chơi thử" }));

beforeEach(() => {
  vi.useFakeTimers();
  window.matchMedia = vi.fn().mockReturnValue({
    matches: false,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }) as unknown as typeof window.matchMedia;
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("điều khiển bàn phím", () => {
  it("phím mũi tên và W A S D đi từng ô, nhân vật quay mặt theo hướng", () => {
    setup();
    expect(at()).toEqual([1, 1]);
    key("ArrowRight");
    key("KeyD");
    expect(at()).toEqual([1, 3]);
    expect(hero().dataset.facing).toBe("right");
    key("KeyA");
    expect(at()).toEqual([1, 2]);
    expect(hero().dataset.facing).toBe("left");
    key("ArrowLeft");
    key("ArrowDown"); // (2,1) là tường ở màn 1
    expect(at()).toEqual([1, 1]);
    expect(hero().dataset.facing).toBe("down");
    key("KeyW");
    expect(at()).toEqual([1, 1]);
  });

  it("key repeat không tăng tốc: giữ phím chỉ đi theo nhịp chung", () => {
    setup();
    fireEvent.keyDown(document.body, { code: "ArrowRight" });
    for (let i = 0; i < 20; i += 1) fireEvent.keyDown(document.body, { code: "ArrowRight", repeat: true });
    expect(moves()).toBe(1);
    advance(HOLD_DELAY_MS);
    expect(moves()).toBe(2);
    advance(STEP_MS);
    expect(moves()).toBe(3);
    fireEvent.keyUp(document.body, { code: "ArrowRight" });
    advance(STEP_MS * 5);
    expect(moves()).toBe(3);
  });

  it("không bắt phím khi đang nhập vào ô văn bản hoặc khi ngoài khu vực game", () => {
    setup();
    const input = document.createElement("input");
    const outside = document.createElement("button");
    document.body.append(input, outside);
    fireEvent.keyDown(input, { code: "KeyD" });
    fireEvent.keyDown(outside, { code: "ArrowRight" });
    expect(moves()).toBe(0);
    fireEvent.keyDown(document.body, { code: "ArrowRight", ctrlKey: true });
    expect(moves()).toBe(0);
    input.remove();
    outside.remove();
  });
});

describe("nút cảm ứng", () => {
  it("bốn nút có nhãn tiếng Việt, vùng chạm ≥ 64 px (4rem) và khoảng cách 12 px (gap-3)", () => {
    setup();
    for (const name of ["Lên", "Xuống", "Trái", "Phải"]) {
      expect(padButton(name).className).toContain("size-16");
    }
    expect(screen.getByTestId("maze-pad").className).toContain("gap-3");
  });

  it("chạm một lần đi một ô; giữ thì đi liên tục; thả là dừng ngay", () => {
    setup([OPEN]);
    const right = padButton("Phải");
    fireEvent.pointerDown(right);
    fireEvent.pointerUp(right);
    advance(HOLD_DELAY_MS * 3);
    expect(moves()).toBe(1);

    fireEvent.pointerDown(right);
    advance(HOLD_DELAY_MS + STEP_MS);
    expect(moves()).toBe(1 + 3);
    fireEvent.pointerUp(right);
    advance(STEP_MS * 10);
    expect(moves()).toBe(4);
  });

  it("pointercancel, mất focus cửa sổ và ẩn tab đều thả nút; gỡ component không để lại bộ hẹn giờ", () => {
    setup();
    const right = padButton("Phải");
    fireEvent.pointerDown(right);
    fireEvent.pointerCancel(right);
    advance(STEP_MS * 5);
    expect(moves()).toBe(1);

    fireEvent.pointerDown(padButton("Lên"));
    act(() => void window.dispatchEvent(new Event("blur")));
    const before = moves();
    advance(STEP_MS * 5);
    expect(moves()).toBe(before);

    fireEvent.keyDown(document.body, { code: "ArrowLeft" });
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
    act(() => void document.dispatchEvent(new Event("visibilitychange")));
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
    const afterHide = moves();
    advance(STEP_MS * 5);
    expect(moves()).toBe(afterHide);

    fireEvent.pointerDown(padButton("Phải"));
    cleanup();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("chạm liên tiếp nhiều nút chỉ dùng một bộ hẹn giờ", () => {
    setup();
    fireEvent.pointerDown(padButton("Phải"));
    fireEvent.pointerDown(padButton("Lên"));
    fireEvent.pointerDown(padButton("Trái"));
    expect(vi.getTimerCount()).toBe(1);
  });

  it("kích hoạt bằng bàn phím/trình đọc màn hình (click detail = 0) cũng đi một ô", () => {
    setup();
    fireEvent.click(padButton("Phải"), { detail: 0 });
    expect(at()).toEqual([1, 2]);
  });
});

describe("va tường, biên, tạm dừng", () => {
  it("gặp tường: báo một lần, dừng giữ-để-đi, không xuyên tường", () => {
    setup();
    fireEvent.pointerDown(padButton("Xuống"));
    expect(status()).toBe("Có tường phía trước!");
    advance(STEP_MS * 5);
    expect(at()).toEqual([1, 1]);
    expect(moves()).toBe(0);
    expect(screen.getByTestId("maze-hero").querySelector(".animate-bump")).not.toBeNull();
  });

  it("không ra ngoài bản đồ", () => {
    setup();
    key("ArrowUp");
    key("ArrowLeft");
    expect(at()).toEqual([1, 1]);
  });

  it("tạm dừng chặn đi và vô hiệu nút; tiếp tục đi được lại", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Tạm dừng" }));
    expect(status()).toBe("Đã tạm dừng.");
    key("ArrowRight");
    expect(moves()).toBe(0);
    expect(status()).toBe("Đã tạm dừng.");
    expect(padButton("Phải")).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Tiếp tục" }));
    expect(status()).toBe("Tiếp tục khám phá!");
    key("ArrowRight");
    expect(at()).toEqual([1, 2]);
  });

  it("tạm dừng khi đang giữ nút thì dừng hẳn", () => {
    setup();
    fireEvent.pointerDown(padButton("Phải"));
    fireEvent.click(screen.getByRole("button", { name: "Tạm dừng" }));
    const before = moves();
    advance(STEP_MS * 6);
    expect(moves()).toBe(before);
  });
});

describe("thử thách và rương (bản minh họa)", () => {
  it("gặp điểm kích hoạt thì dừng; chỉ nút minh họa mới mở tiếp; không kích hoạt lại", () => {
    setup();
    fireEvent.pointerDown(padButton("Phải"));
    advance(HOLD_DELAY_MS + STEP_MS * 6);
    fireEvent.pointerUp(padButton("Phải"));
    expect(at()).toEqual([1, 4]);
    expect(status()).toBe("Con đã tìm thấy một thử thách!");
    expect(padButton("Phải")).toBeDisabled();
    key("ArrowRight");
    expect(at()).toEqual([1, 4]);
    const panel = screen.getByRole("group", { name: "Thao tác minh họa" });
    expect(within(panel).getByText(/không cộng điểm/u)).toBeInTheDocument();
    expect(screen.getByText("Thử thách đã tìm: 0/7")).toBeInTheDocument();

    resolve();
    expect(screen.getByText("Thử thách đã tìm: 1/7")).toBeInTheDocument();
    key("ArrowLeft");
    key("ArrowRight");
    expect(at()).toEqual([1, 4]);
    expect(screen.queryByRole("group", { name: "Thao tác minh họa" })).toBeNull();
    expect(screen.getByText("Thử thách đã tìm: 1/7")).toBeInTheDocument();
  });

  it("không hiện sẵn điểm kích hoạt chưa bước vào", () => {
    setup();
    expect(document.querySelectorAll("[aria-hidden='true'] .rotate-45")).toHaveLength(0);
    key("ArrowRight");
    expect(document.querySelectorAll(".rotate-45")).toHaveLength(0);
  });

  it("rương không mở khi thiếu thử thách, mở sau đủ 7 thử thách minh họa", () => {
    setup([CORRIDOR]);
    for (let i = 0; i < 6; i += 1) {
      key("ArrowRight");
      resolve();
    }
    key("ArrowRight");
    key("ArrowRight");
    expect(at()).toEqual([1, 9]);
    expect(status()).toBe("Hãy hoàn thành các thử thách trước nhé!");
    expect(screen.getByTestId("maze-run").dataset.completed).toBe("false");

    for (let i = 0; i < 8; i += 1) key("ArrowLeft");
    key("ArrowDown");
    resolve();
    key("ArrowUp");
    for (let i = 0; i < 8; i += 1) key("ArrowRight");
    expect(screen.getByTestId("maze-run").dataset.completed).toBe("true");
    expect(status()).toBe("Giỏi quá! Con đã mở được rương kho báu.");
    expect(screen.getByRole("button", { name: "Chơi lại màn này" })).toBeInTheDocument();
  });

  it("chuyển màn khởi tạo lại trạng thái", () => {
    setup([LEVEL_1, CORRIDOR]);
    key("ArrowRight");
    expect(moves()).toBe(1);
    fireEvent.click(screen.getByRole("button", { name: /Màn 2/u }));
    expect(screen.getByTestId("maze-run").dataset.level).toBe("unit-corridor");
    expect(moves()).toBe(0);
    expect(at()).toEqual([1, 1]);
  });
});

describe("camera", () => {
  it("điện thoại: phóng to 7 ô quanh nhân vật; nút toàn cảnh xem cả bản đồ", () => {
    setup();
    const board = screen.getByTestId("maze-board");
    expect(board.dataset.view).toBe("7");
    const overview = screen.getByRole("button", { name: "Xem toàn cảnh" });
    fireEvent.click(overview);
    expect(board.dataset.view).toBe("9");
    expect(screen.getByRole("button", { name: "Phóng to theo bạn nhỏ" })).toHaveAttribute("aria-pressed", "true");
  });
});

describe("lớp phủ tạm dừng (R07.6)", () => {
  it("hiện hai lựa chọn, focus vào 'Chơi tiếp', Esc/nút tiếp tục đóng lớp phủ; không đổi vị trí", () => {
    setup();
    expect(screen.queryByTestId("pause-overlay")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Tạm dừng" }));
    const overlay = screen.getByTestId("pause-overlay");
    expect(within(overlay).getByRole("button", { name: "Chơi tiếp" })).toHaveFocus();
    expect(within(overlay).getByRole("link", { name: "Về bản đồ" })).toHaveAttribute("href", "/demo");
    expect(overlay).toHaveTextContent("Điểm thưởng của con vẫn nguyên");
    expect(moves()).toBe(0);
    fireEvent.keyDown(document.body, { code: "Escape" });
    expect(screen.queryByTestId("pause-overlay")).toBeNull();
    expect(screen.getByRole("button", { name: "Tạm dừng" })).toHaveFocus();
    fireEvent.click(screen.getByRole("button", { name: "Tạm dừng" }));
    fireEvent.click(screen.getByRole("button", { name: "Chơi tiếp" }));
    expect(screen.queryByTestId("pause-overlay")).toBeNull();
    key("ArrowRight");
    expect(at()).toEqual([1, 2]);
  });

  it("Tab quay vòng trong lớp phủ", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Tạm dừng" }));
    const overlay = screen.getByTestId("pause-overlay");
    screen.getByRole("link", { name: "Về bản đồ" }).focus();
    fireEvent.keyDown(overlay, { key: "Tab" });
    expect(screen.getByRole("button", { name: "Chơi tiếp" })).toHaveFocus();
    fireEvent.keyDown(overlay, { key: "Tab", shiftKey: true });
    expect(screen.getByRole("link", { name: "Về bản đồ" })).toHaveFocus();
  });
});
