import AxeBuilder from "@axe-core/playwright";
import type { Locator, Page } from "@playwright/test";
import { createGrid, findPath, type Direction } from "../../src/features/game-engine/core/index.ts";
import level1 from "../../content/games/treasure-maze/levels/level-01.json" with { type: "json" };
import level2 from "../../content/games/treasure-maze/levels/level-02.json" with { type: "json" };
import { expect, test } from "./fixtures";

/** R07.1 nguyên mẫu đồ họa + R07.4 điều khiển nhân vật: /demo/treasure-maze (dữ liệu minh họa, không lưu). */

const KEY: Record<Direction, string> = { up: "ArrowUp", down: "ArrowDown", left: "ArrowLeft", right: "ArrowRight" };

const hero = (page: Page) => page.getByTestId("maze-hero");
const pos = async (page: Page) => {
  const h = hero(page);
  return [Number(await h.getAttribute("data-row")), Number(await h.getAttribute("data-col"))] as const;
};
const moves = async (page: Page) => Number(await page.getByTestId("maze-run").getAttribute("data-moves"));
const demoButton = (page: Page) => page.getByRole("button", { name: "Tiếp tục bản chơi thử" });
const center = async (locator: Locator) => {
  await locator.scrollIntoViewIfNeeded();
  const box = (await locator.boundingBox())!;
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
};

async function openMaze(page: Page) {
  await page.goto("/demo/treasure-maze");
  await page.locator("[data-hydrated=true]").waitFor();
}

async function noHorizontalScroll(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}

test.describe("/demo/treasure-maze (bản chơi thử, dữ liệu minh họa)", () => {
  test("có nhãn thử nghiệm, bảng hiển thị đủ, không lỗi JS, không cuộn ngang, hướng dẫn điều khiển", async ({
    page,
    pageErrors,
  }) => {
    await openMaze(page);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Mê cung kho báu");
    await expect(page.getByRole("note")).toContainText(/Bản thử nghiệm – Dữ liệu minh họa/iu);
    const board = page.getByTestId("maze-board");
    await expect(board).toBeVisible();
    const box = (await board.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(page.viewportSize()!.width);
    await noHorizontalScroll(page);
    await expect(page.getByRole("img", { name: "Bạn nhỏ thám hiểm" })).toBeVisible();
    await expect(page.getByRole("img", { name: "Rương kho báu" })).toBeVisible();
    await expect(page.getByText(/phím mũi tên hoặc W A S D/u)).toBeVisible();
    await expect(page.locator("main form")).toHaveCount(0);
    await expect(page.locator("main a[href^='http']")).toHaveCount(0);
    expect(pageErrors).toEqual([]);
  });

  test("360 và 390 px: không cuộn ngang, nút ≥ 64 px cách nhau ≥ 12 px, nhân vật trong khung, cụm điều khiển không bị che", async ({
    page,
  }) => {
    for (const width of [360, 390, 820]) {
      await page.setViewportSize({ width, height: 800 });
      await openMaze(page);
      await noHorizontalScroll(page);
      await page.getByTestId("maze-pad").scrollIntoViewIfNeeded();
      const boxes = [];
      for (const name of ["Lên", "Xuống", "Trái", "Phải"]) {
        const button = page.getByRole("button", { name, exact: true });
        const box = (await button.boundingBox())!;
        expect(box.width).toBeGreaterThanOrEqual(63.5);
        expect(box.height).toBeGreaterThanOrEqual(63.5);
        boxes.push(box);
      }
      const [up, down, left, right] = boxes as [
        (typeof boxes)[0],
        (typeof boxes)[0],
        (typeof boxes)[0],
        (typeof boxes)[0],
      ];
      expect(down.x - (left.x + left.width)).toBeGreaterThanOrEqual(11.5);
      expect(right.x - (down.x + down.width)).toBeGreaterThanOrEqual(11.5);
      expect(down.y - (up.y + up.height)).toBeGreaterThanOrEqual(11.5);

      const board = (await page.getByTestId("maze-board").boundingBox())!;
      const cell = (await hero(page).boundingBox())!;
      expect(cell.x).toBeGreaterThanOrEqual(board.x - 1);
      expect(cell.x + cell.width).toBeLessThanOrEqual(board.x + board.width + 1);
      expect(cell.y).toBeGreaterThanOrEqual(board.y - 1);
      expect(cell.y + cell.height).toBeLessThanOrEqual(board.y + board.height + 1);
      // Bảng không đè lên cụm điều khiển.
      expect(board.y + board.height).toBeLessThanOrEqual(up.y + 1);
    }
    await page.setViewportSize({ width: 360, height: 800 });
    await openMaze(page);
    // Điện thoại: camera phóng to (7 ô); mỗi ô rộng hơn nguyên mẫu R07.1 (~30 px).
    await expect(page.getByTestId("maze-board")).toHaveAttribute("data-view", "7");
    const cellWidth = (await hero(page).boundingBox())!.width;
    expect(cellWidth).toBeGreaterThan(40);
  });

  test("bàn phím: mũi tên và WASD đi đủ bốn hướng, nhân vật quay mặt, không xuyên tường", async ({ page }) => {
    await openMaze(page);
    await page.getByRole("button", { name: /Màn 3/u }).click();
    await expect(page.getByTestId("maze-run")).toHaveAttribute("data-level", "treasure-maze-03");
    await expect.poll(() => pos(page)).toEqual([1, 1]);
    await page.keyboard.press("ArrowRight");
    await expect.poll(() => pos(page)).toEqual([1, 2]);
    await expect(hero(page)).toHaveAttribute("data-facing", "right");
    await page.keyboard.press("KeyD");
    await expect.poll(() => pos(page)).toEqual([1, 3]);
    await page.keyboard.press("KeyA");
    await expect.poll(() => pos(page)).toEqual([1, 2]);
    await expect(hero(page)).toHaveAttribute("data-facing", "left");
    await page.keyboard.press("ArrowLeft");
    await expect.poll(() => pos(page)).toEqual([1, 1]);
    await page.keyboard.press("ArrowDown"); // (2,1) là tường
    await expect(page.getByTestId("maze-status")).toHaveText("Có tường phía trước!");
    expect(await pos(page)).toEqual([1, 1]);
    await page.keyboard.press("KeyW"); // (0,1) là biên
    expect(await pos(page)).toEqual([1, 1]);
    // Đủ bốn hướng: đi sang phải đến cuối hành lang rồi lên/xuống ở màn 2.
    await page.getByRole("button", { name: /Màn 2/u }).click();
    await expect(page.getByTestId("maze-run")).toHaveAttribute("data-level", "treasure-maze-02");
    for (const direction of ["right", "right", "down"] as const) await page.keyboard.press(KEY[direction]);
    await expect.poll(() => pos(page)).toEqual([2, 3]);
    await page.keyboard.press("KeyW");
    await expect.poll(() => pos(page)).toEqual([1, 3]);
    await expect(hero(page)).toHaveAttribute("data-facing", "up");
  });

  test("không bắt phím khi đang nhập vào ô văn bản ngoài khu vực game", async ({ page }) => {
    await openMaze(page);
    await page.evaluate(() => {
      const input = document.createElement("input");
      input.id = "outside-input";
      (document.querySelector("footer") ?? document.body).append(input);
    });
    await page.locator("#outside-input").focus();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("KeyD");
    expect(await moves(page)).toBe(0);
  });

  test("nút cảm ứng: chạm đi một ô; giữ đi liên tục có giới hạn tốc độ; thả dừng; mất focus/ẩn tab dừng", async ({
    page,
  }) => {
    await openMaze(page);
    await page.getByRole("button", { name: /Màn 3/u }).click();
    await expect(page.getByTestId("maze-run")).toHaveAttribute("data-level", "treasure-maze-03");
    const right = page.getByRole("button", { name: "Phải", exact: true });

    const at = await center(right);
    await page.mouse.move(at.x, at.y);
    await page.mouse.down();
    await page.mouse.up();
    await page.waitForTimeout(700);
    expect(await moves(page)).toBe(1);

    await page.mouse.down();
    await page.waitForTimeout(1000);
    const duringHold = await moves(page);
    // Giữ 1 s: 1 bước ngay + bước ở 350 ms + mỗi 200 ms nữa → khoảng 4–5; không "tăng tốc" quá 1 bước/200 ms.
    expect(duringHold).toBeGreaterThanOrEqual(3);
    expect(duringHold).toBeLessThanOrEqual(1 + 1 + Math.ceil((1000 - 350) / 200) + 1);
    await page.mouse.up();
    const afterRelease = await moves(page);
    await page.waitForTimeout(700);
    expect(await moves(page)).toBe(afterRelease);

    // Mất focus cửa sổ khi đang giữ → dừng ngay, không tự chạy mãi.
    await page.mouse.down();
    await page.evaluate(() => window.dispatchEvent(new Event("blur")));
    const stopped = await moves(page);
    await page.waitForTimeout(700);
    expect(await moves(page)).toBe(stopped);
    await page.mouse.up();

    // Phím giữ + ẩn tab.
    await page.getByRole("button", { name: /Màn 2/u }).click();
    await expect(page.getByTestId("maze-run")).toHaveAttribute("data-level", "treasure-maze-02");
    await page.keyboard.down("ArrowRight");
    await page.evaluate(() => {
      Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    const hidden = await moves(page);
    await page.waitForTimeout(700);
    expect(await moves(page)).toBe(hidden);
    await page.keyboard.up("ArrowRight");
  });

  test("giữ nút dừng khi gặp tường, báo một lần", async ({ page }) => {
    await openMaze(page);
    await page.getByRole("button", { name: /Màn 2/u }).click();
    await expect(page.getByTestId("maze-run")).toHaveAttribute("data-level", "treasure-maze-02");
    const at = await center(page.getByRole("button", { name: "Phải", exact: true }));
    await page.mouse.move(at.x, at.y);
    await page.mouse.down();
    await expect(page.getByTestId("maze-status")).toHaveText("Có tường phía trước!");
    await page.mouse.up();
    expect(await pos(page)).toEqual([1, 3]);
    expect(await moves(page)).toBe(2);
  });

  test("tạm dừng / tiếp tục", async ({ page }) => {
    await openMaze(page);
    await page.getByRole("button", { name: "Tạm dừng" }).click();
    await expect(page.getByTestId("maze-status")).toHaveText("Đã tạm dừng.");
    await expect(page.getByRole("button", { name: "Phải", exact: true })).toBeDisabled();
    await page.keyboard.press("ArrowRight");
    expect(await moves(page)).toBe(0);
    const overlay = page.getByTestId("pause-overlay");
    await expect(overlay).toBeVisible();
    await expect(page.getByRole("button", { name: "Chơi tiếp" })).toBeFocused();
    await expect(overlay.getByRole("link", { name: "Về bản đồ" })).toHaveAttribute("href", "/demo");
    await noHorizontalScroll(page);
    const board = (await page.getByTestId("maze-board").boundingBox())!;
    const card = (await overlay.locator("> div").boundingBox())!;
    expect(card.y).toBeGreaterThanOrEqual(board.y - 1);
    expect(card.y + card.height).toBeLessThanOrEqual(board.y + board.height + 1);
    await page.getByRole("button", { name: "Chơi tiếp" }).click();
    await expect(page.getByTestId("maze-status")).toHaveText("Tiếp tục khám phá!");
    await expect(overlay).toHaveCount(0);
    await page.keyboard.press("ArrowRight");
    await expect.poll(() => moves(page)).toBe(1);
    await page.getByRole("button", { name: "Tạm dừng" }).click();
    await page.keyboard.press("Escape");
    await expect(overlay).toHaveCount(0);
    await page.getByRole("button", { name: "Tạm dừng" }).click();
    await page.getByRole("link", { name: "Về bản đồ" }).click();
    await expect(page).toHaveURL(/\/demo$/u);
  });

  test("bước đi nội suy 160–220 ms", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await openMaze(page);
    const ms = await hero(page).evaluate(
      (element) => Number.parseFloat(getComputedStyle(element).transitionDuration) * 1000,
    );
    expect(ms).toBeGreaterThanOrEqual(160);
    expect(ms).toBeLessThanOrEqual(220);
  });

  test("thử thách → dừng; không kích hoạt lại; đủ 7 thử thách minh họa thì mở được rương", async ({ page }) => {
    await openMaze(page);
    const rows = level1.rows;
    const grid = createGrid(rows);
    const targets = [...level1.triggers, { row: 7, col: 1 }];
    const status = page.getByTestId("maze-status");

    // Rương chưa mở khi thiếu thử thách: đi thẳng tới rương qua con đường có điểm kích hoạt thì bị chặn ở thử thách đầu.
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    await expect(status).toHaveText("Con đã tìm thấy một thử thách!");
    expect(await pos(page)).toEqual([1, 4]);
    await page.keyboard.press("ArrowRight");
    expect(await pos(page)).toEqual([1, 4]);
    await expect(page.getByText("Thao tác minh họa", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Phải", exact: true })).toBeDisabled();
    await demoButton(page).click();
    await expect(page.getByText("Thử thách đã tìm: 1/7")).toBeVisible();
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("ArrowRight");
    await expect.poll(() => pos(page)).toEqual([1, 4]);
    await expect(demoButton(page)).toHaveCount(0);
    await expect(page.getByText("Thử thách đã tìm: 1/7")).toBeVisible();

    // Đi tới từng điểm kích hoạt còn lại và hoàn tất bằng nút minh họa.
    for (const target of targets.slice(0, 7)) {
      for (let guard = 0; guard < 60; guard += 1) {
        const [row, col] = await pos(page);
        if (row === target.row && col === target.col) break;
        const path = findPath(grid, { row, col }, target)!;
        const next = path[1]!;
        const direction: Direction =
          next.row < row ? "up" : next.row > row ? "down" : next.col < col ? "left" : "right";
        await page.keyboard.press(KEY[direction]);
        await expect.poll(() => pos(page)).toEqual([next.row, next.col]);
        if (await demoButton(page).isVisible()) await demoButton(page).click();
      }
    }
    await expect(page.getByText("Thử thách đã tìm: 7/7")).toBeVisible();
    // Về rương.
    for (let guard = 0; guard < 60; guard += 1) {
      const [row, col] = await pos(page);
      if (row === 7 && col === 1) break;
      const next = findPath(grid, { row, col }, { row: 7, col: 1 })![1]!;
      const direction: Direction = next.row < row ? "up" : next.row > row ? "down" : next.col < col ? "left" : "right";
      await page.keyboard.press(KEY[direction]);
      await expect.poll(() => pos(page)).toEqual([next.row, next.col]);
    }
    await expect(page.getByTestId("maze-run")).toHaveAttribute("data-completed", "true");
    await expect(status).toHaveText("Giỏi quá! Con đã mở được rương kho báu.");
  });

  test("rương chưa mở khi chưa đủ thử thách", async ({ page }) => {
    await openMaze(page);
    // Màn 2: đường ngắn nhất tới rương (1,5) chỉ qua 3/7 điểm kích hoạt.
    await page.getByRole("button", { name: /Màn 2/u }).click();
    await expect(page.getByTestId("maze-run")).toHaveAttribute("data-level", "treasure-maze-02");
    const grid = createGrid(level2.rows);
    const chest = { row: 1, col: 5 };
    for (let guard = 0; guard < 80; guard += 1) {
      const [row, col] = await pos(page);
      if (row === chest.row && col === chest.col) break;
      const next = findPath(grid, { row, col }, chest)![1]!;
      const direction: Direction = next.row < row ? "up" : next.row > row ? "down" : next.col < col ? "left" : "right";
      await page.keyboard.press(KEY[direction]);
      await expect.poll(() => pos(page)).toEqual([next.row, next.col]);
      if (await demoButton(page).isVisible()) await demoButton(page).click();
    }
    await expect(page.getByTestId("maze-status")).toHaveText("Hãy hoàn thành các thử thách trước nhé!");
    await expect(page.getByTestId("maze-run")).toHaveAttribute("data-completed", "false");
  });

  test("camera: nhân vật luôn trong khung khi đi xa; nút toàn cảnh hiện cả bản đồ", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await openMaze(page);
    await page.getByRole("button", { name: /Màn 3/u }).click();
    await expect(page.getByTestId("maze-run")).toHaveAttribute("data-level", "treasure-maze-03");
    const board = page.getByTestId("maze-board");
    await expect(board).toHaveAttribute("data-view", "7");
    for (let i = 0; i < 5; i += 1) await page.keyboard.press("ArrowRight");
    await expect.poll(() => pos(page)).toEqual([1, 6]);
    await expect
      .poll(async () => {
        const b = (await board.boundingBox())!;
        const h = (await hero(page).boundingBox())!;
        return h.x >= b.x - 1 && h.x + h.width <= b.x + b.width + 1;
      })
      .toBe(true);
    await page.getByRole("button", { name: "Xem toàn cảnh" }).click();
    await expect(board).toHaveAttribute("data-view", "13");
    await noHorizontalScroll(page);
    await page.getByRole("button", { name: "Phóng to theo bạn nhỏ" }).click();
    await expect(board).toHaveAttribute("data-view", "7");
  });

  test("axe: không vi phạm nghiêm trọng (ban đầu và khi có thử thách)", async ({ page }) => {
    await openMaze(page);
    const check = async () => {
      const results = await new AxeBuilder({ page }).analyze();
      return results.violations.filter((v) => v.impact === "critical" || v.impact === "serious").map((v) => v.id);
    };
    expect(await check()).toEqual([]);
    for (let i = 0; i < 3; i += 1) await page.keyboard.press("ArrowRight");
    await expect(demoButton(page)).toBeVisible();
    expect(await check()).toEqual([]);
  });

  test("giảm chuyển động: hệ điều hành và công tắc dừng hoạt cảnh và đổi vị trí tức thì", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await openMaze(page);
    await expect(page.locator("[data-motion]").first()).toHaveAttribute("data-motion", "reduce");
    const running = () =>
      page.evaluate(
        () =>
          document
            .getAnimations()
            .filter(
              (animation) =>
                animation.playState === "running" && animation.effect?.getComputedTiming().iterations !== 1,
            ).length,
      );
    expect(await running()).toBe(0);
    await page.keyboard.press("ArrowRight");
    const duration = await hero(page).evaluate((element) => getComputedStyle(element).transitionDuration);
    expect(Number.parseFloat(duration)).toBeLessThan(0.001);
    await page.keyboard.press("ArrowUp");
    expect(await running()).toBe(0);

    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.reload();
    await page.locator("[data-hydrated=true]").waitFor();
    await expect(page.locator("[data-motion]").first()).toHaveAttribute("data-motion", "full");
    expect(await running()).toBeGreaterThan(0);
    await page.getByRole("button", { name: /Giảm chuyển động/u }).click();
    await expect(page.locator("[data-motion]").first()).toHaveAttribute("data-motion", "reduce");
    expect(await running()).toBe(0);
  });
});
