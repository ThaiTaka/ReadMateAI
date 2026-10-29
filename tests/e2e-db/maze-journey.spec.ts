import { expect, test, type Browser, type Page, type TestInfo } from "@playwright/test";
import {
  neighbors,
  parseLevel,
  positionKey,
  step,
  type Direction,
  type Position,
} from "../../src/features/game-engine/core";
import level1 from "../../content/games/treasure-maze/levels/level-01.json";
import {
  axeClean,
  balanceOf,
  earnCorrect,
  freshGameClass,
  link,
  newMember,
  noHorizontalScroll,
  PASSWORD,
  resetRateLimits,
  runsOf,
} from "./class-fixtures";
import { expectVisibleOrExplain, watchPage } from "./maze-diagnostics";

/**
 * Hành trình của học sinh: trang của con → "Vào mê cung" (nút thật trên thẻ trò chơi, không gõ thẳng địa chỉ) → đi bằng nút
 * cảm ứng, phím mũi tên và WASD → va tường → tạm dừng → tải lại giữ nguyên chỗ đứng → về trang của con thấy "Tiếp tục cuộc
 * phiêu lưu" → bấm lại vẫn là CÙNG MỘT lượt (không tạo lượt trùng). Chạy trên Supabase LOCAL, dữ liệu giả, nội dung fixture.
 * Phần chạm trán/rương nằm ở maze-encounters.spec.ts; kiểm tra "Chơi lại" ở maze-replay.spec.ts.
 */

const LEVEL = { id: level1.id, rows: level1.rows, triggers: level1.triggers };
const MAZE = parseLevel(LEVEL);
const TRIGGER_KEYS = new Set(MAZE.triggers.map(positionKey));

const DIRECTION_OF: Record<string, Direction> = { "-1,0": "up", "1,0": "down", "0,-1": "left", "0,1": "right" };
const PAD_LABEL: Record<Direction, string> = { up: "Lên", down: "Xuống", left: "Trái", right: "Phải" };
const ARROW: Record<Direction, string> = { up: "ArrowUp", down: "ArrowDown", left: "ArrowLeft", right: "ArrowRight" };
const WASD: Record<Direction, string> = { up: "KeyW", down: "KeyS", left: "KeyA", right: "KeyD" };

/**
 * Lộ trình đi bộ AN TOÀN từ ô xuất phát: tối đa `maxSteps` bước, chỉ qua ô thường (không điểm kích hoạt, không rương) nên
 * không gặp quái vật. Lấy ô xa nhất tìm được (BFS) để đi được nhiều bước, có cả khúc rẽ.
 */
function safeRoute(maxSteps: number): Position[] {
  const key = positionKey;
  const parent = new Map<string, Position | null>([[key(MAZE.start), null]]);
  const depth = new Map<string, number>([[key(MAZE.start), 0]]);
  const queue: Position[] = [MAZE.start];
  let best = MAZE.start;
  for (const current of queue) {
    const d = depth.get(key(current))!;
    if (d > depth.get(key(best))!) best = current;
    if (d === maxSteps) continue;
    for (const next of neighbors(MAZE.grid, current)) {
      if (parent.has(key(next)) || TRIGGER_KEYS.has(key(next)) || key(next) === key(MAZE.treasure)) continue;
      parent.set(key(next), current);
      depth.set(key(next), d + 1);
      queue.push(next);
    }
  }
  const route: Position[] = [];
  for (let at: Position | null = best; at; at = parent.get(key(at)) ?? null) route.unshift(at);
  return route.slice(1);
}

const hero = (page: Page) => page.getByTestId("maze-hero");
async function position(page: Page): Promise<Position> {
  return {
    row: Number(await hero(page).getAttribute("data-row")),
    col: Number(await hero(page).getAttribute("data-col")),
  };
}
const same = (a: Position, b: Position) => a.row === b.row && a.col === b.col;

async function newStudentContext(browser: Browser, testInfo: TestInfo) {
  return browser.newContext({
    locale: "vi-VN",
    ...(testInfo.project.use.viewport ? { viewport: testInfo.project.use.viewport } : {}),
    ...(testInfo.project.use.userAgent ? { userAgent: testInfo.project.use.userAgent } : {}),
    ...(testInfo.project.use.isMobile !== undefined ? { isMobile: testInfo.project.use.isMobile } : {}),
    ...(testInfo.project.use.hasTouch !== undefined ? { hasTouch: testInfo.project.use.hasTouch } : {}),
    ...(testInfo.project.use.deviceScaleFactor ? { deviceScaleFactor: testInfo.project.use.deviceScaleFactor } : {}),
  });
}

/** Đi một bước tới ô kề, luân phiên ba cách điều khiển thật của học sinh: nút trên màn hình, phím mũi tên, W-A-S-D. */
async function walk(page: Page, to: Position, how: "pad" | "arrow" | "wasd") {
  const from = await position(page);
  const direction = DIRECTION_OF[`${to.row - from.row},${to.col - from.col}`];
  expect(direction, `ô ${positionKey(to)} không kề ô ${positionKey(from)}`).toBeDefined();
  if (how === "pad") {
    await page.getByTestId("maze-pad").getByRole("button", { name: PAD_LABEL[direction!] }).click();
  } else {
    await page.keyboard.press(how === "arrow" ? ARROW[direction!] : WASD[direction!]);
  }
  await expect.poll(async () => same(await position(page), to), { timeout: 10_000 }).toBe(true);
}

test.describe.configure({ mode: "serial" });
test.beforeAll(() => {
  expect(PASSWORD, "Thiếu SEED_TEACHER_PASSWORD (.env.local — npm run db:env)").not.toBe("");
});

test("hành trình: trang của con → Vào mê cung → đi bằng nút/phím → tải lại giữ chỗ → Tiếp tục đúng một lượt", async ({
  browser,
}, testInfo) => {
  test.setTimeout(300_000);
  const cls = await freshGameClass("MZ-journey");
  const member = await newMember(cls, "Mầm", "extending");
  const context = await newStudentContext(browser, testInfo);
  const page = await context.newPage();
  await link(page, member.backup);

  // Chưa đủ điểm: hai khu vực rõ ràng, điều kiện vào game hiển thị, KHÔNG có nút vào chơi (không nút giả).
  const card = page.locator("#me-game-treasure_maze");
  await expect(page.locator('[data-zone="learn"]')).toBeVisible();
  await expect(page.locator('[data-zone="compete"]')).toBeVisible();
  await expect(card).toContainText("Cần thêm 50 điểm");
  await expect(page.getByTestId("me-game-treasure_maze-play")).toHaveCount(0);
  await expect(page.getByText(/Sắp có|Mini-game đang|đang được xây dựng/u)).toHaveCount(0);
  expect(await runsOf(member.id)).toHaveLength(0);

  // 5 câu đúng bằng API chấm bài thật → 50 điểm (đủ ngưỡng vào Mê cung).
  await earnCorrect(context.request, 5);
  expect(await balanceOf(member.id)).toBe(50);
  await page.reload();
  const play = page.getByTestId("me-game-treasure_maze-play");
  // Nội dung Suspense đã vào DOM nhưng chỉ được React "mở" sau một nhịp: chờ HIỂN THỊ rồi mới đo kích thước.
  await expect(play).toBeVisible();
  await expect(play).toHaveText("Vào mê cung");
  await expect(play).toHaveAttribute("href", "/learn/me/games/treasure-maze");
  await expect(card).toContainText("Cần 50 điểm thưởng");
  const playBox = await play.boundingBox();
  expect(playBox?.height ?? 0).toBeGreaterThanOrEqual(63.5);
  await noHorizontalScroll(page);
  await axeClean(page);

  // Vào mê cung bằng nút thật — bấm đúp (trẻ nhỏ hay bấm hai lần) vẫn chỉ có MỘT lượt chơi.
  await resetRateLimits();
  const watched = watchPage(page);
  await play.dblclick();
  await expect(page).toHaveURL(/\/learn\/me\/games\/treasure-maze/u);
  await expectVisibleOrExplain(page, page.getByTestId("maze-run"), watched, testInfo, 30_000);
  await expect(page.getByTestId("maze-ribbon")).toHaveText("Lượt chơi có điểm");
  await expect(page.getByTestId("maze-loading")).toHaveCount(0);
  const runs = await runsOf(member.id);
  expect(runs).toHaveLength(1);
  expect(runs[0]).toMatchObject({ status: "in_progress", scored: true });
  expect(runs[0]!.position).toEqual(MAZE.start);
  expect(await position(page)).toEqual(MAZE.start);

  // Điều khiển: đi bộ một đoạn không qua điểm kích hoạt nào (chuyện quái vật ở maze-encounters.spec.ts).
  const route = safeRoute(8);
  // Màn 1 đặt điểm kích hoạt ngay trong hành lang gần ô xuất phát nên đoạn an toàn ngắn: đủ để thử nút và phím W-A-S-D.
  expect(route.length, "cần ít nhất 2 bước đi an toàn từ ô xuất phát").toBeGreaterThanOrEqual(2);
  const methods = ["pad", "wasd"] as const;
  for (const [index, cell] of route.entries()) await walk(page, cell, methods[index % methods.length]!);
  const standing = route.at(-1)!;

  // Va tường: giữ nguyên chỗ đứng và báo nhẹ nhàng (không phạt, không rung).
  const blocked = (["up", "right", "down", "left"] as const).find(
    (direction) => step(MAZE.grid, standing, direction).kind === "blocked",
  );
  if (blocked) {
    await page.keyboard.press(ARROW[blocked]);
    await expect(page.getByTestId("maze-status")).toHaveText("Có tường phía trước!");
    expect(await position(page)).toEqual(standing);
  }

  // Lưu tự động: CSDL giữ đúng chỗ đứng (máy chủ kiểm từng bước), trạng thái lưu hiển thị "Đã lưu".
  await expect(page.getByTestId("save-status")).toHaveAttribute("data-state", "saved", { timeout: 15_000 });
  await expect.poll(async () => (await runsOf(member.id))[0]!.position, { timeout: 15_000 }).toEqual(standing);

  // Tạm dừng: nhân vật không đi được, Esc tiếp tục.
  await page.getByRole("button", { name: "Tạm dừng" }).click();
  await expect(page.getByTestId("pause-overlay")).toBeVisible();
  const open = (["up", "right", "down", "left"] as const).find(
    (direction) => step(MAZE.grid, standing, direction).kind === "moved",
  )!;
  await page.keyboard.press(ARROW[open]);
  expect(await position(page)).toEqual(standing);
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("pause-overlay")).toHaveCount(0);

  // Tải lại: cùng lượt, cùng chỗ đứng, không kẹt ở "Đang mở mê cung…".
  const reloaded = watchPage(page);
  await page.reload();
  await expectVisibleOrExplain(page, page.getByTestId("maze-run"), reloaded, testInfo, 30_000);
  await expect(page.getByTestId("maze-loading")).toHaveCount(0);
  await expect.poll(() => position(page)).toEqual(standing);
  expect(await runsOf(member.id)).toHaveLength(1);
  await expect(page.getByTestId("save-status")).toHaveAttribute("data-state", "saved");

  // Màn hình hẹp: nút điều khiển ≥ 64 px, không tràn ngang, trợ năng sạch.
  for (const direction of ["up", "down", "left", "right"] as const) {
    const box = await page.getByTestId("maze-pad").getByRole("button", { name: PAD_LABEL[direction] }).boundingBox();
    expect(box?.width ?? 0).toBeGreaterThanOrEqual(63.5);
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(63.5);
  }
  await noHorizontalScroll(page);
  await axeClean(page);

  // Về trang của con (qua lớp phủ tạm dừng): thẻ trò chơi nay nói "Tiếp tục cuộc phiêu lưu" và dẫn vào ĐÚNG lượt dở.
  await page.getByRole("button", { name: "Tạm dừng" }).click();
  await page.getByRole("link", { name: "Về bản đồ" }).click();
  await expect(page).toHaveURL(/\/learn\/me$/u);
  const resume = page.getByTestId("me-game-treasure_maze-play");
  await expect(resume).toBeVisible();
  await expect(resume).toHaveText("Tiếp tục cuộc phiêu lưu");
  await expect(page.locator("#me-game-treasure_maze")).toContainText("Con đang đi dở");
  await resume.click();
  await expectVisibleOrExplain(page, page.getByTestId("maze-run"), watchPage(page), testInfo, 30_000);
  await expect.poll(() => position(page)).toEqual(standing);
  const after = await runsOf(member.id);
  expect(after).toHaveLength(1);
  expect(after[0]!.id).toBe(runs[0]!.id);

  // Chưa tính điểm gì thêm: đi bộ không đổi điểm thưởng.
  expect(await balanceOf(member.id)).toBe(50);
  await context.close();
});
