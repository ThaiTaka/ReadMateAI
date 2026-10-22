import { expect, test, type Locator, type Page, type Response } from "@playwright/test";
import { findPath, parseLevel, positionKey, type Position } from "../../src/features/game-engine/core";
import { MONSTER_KEYS } from "../../src/features/game-runs/monsters";
import level1 from "../../content/games/treasure-maze/levels/level-01.json";
import {
  admin,
  axeClean,
  balanceOf,
  earnCorrect,
  freshGameClass,
  link,
  must,
  newMember,
  noHorizontalScroll,
  PASSWORD,
  resetRateLimits,
  runsOf,
} from "./class-fixtures";

/**
 * R08.4 — Mê cung có chạm trán, TOÀN TRÌNH qua giao diện trên Supabase LOCAL (dữ liệu giả, nội dung fixture):
 * đi tới từng điểm kích hoạt (lưu vị trí trước, rồi mới kích hoạt), gặp quái vật, ba trái tim, +10/−5 do máy chủ, hoạt cảnh
 * defeated/undefeated, tải lại giữa chạm trán, hai tab, quay lại mê cung, 7/7 rồi mở rương (không cộng điểm).
 * Câu hỏi lấy từ chính phản hồi của máy chủ và thao tác như người dùng; không có đường tắt vào CSDL ngoài kiểm tra kết quả.
 */

const PAGE = "/learn/me/games/treasure-maze";
const LEVEL = { id: level1.id, rows: level1.rows, triggers: level1.triggers };
const MAZE = parseLevel(LEVEL);
const SECRETS = /"answer"|"correctIds"|"distractorTags"|"pictureNames?"|"row"|"col"|"triggerKey"|"trigger_key"/u;

type Option = { id: string; text: string };
type Question = { id: string; view: { content: { sample: string; options: Option[] } } };

class Tracker {
  questions = new Map<string, Question>();
  deltas: number[] = [];
  requests: string[] = [];
  activateBodies: string[] = [];
  constructor(page: Page) {
    page.on("request", (request) => {
      const url = new URL(request.url());
      if (url.pathname.startsWith("/api/student/")) this.requests.push(`${request.method()} ${url.pathname}`);
    });
    page.on("response", (response) => void this.read(response));
  }
  private async read(response: Response) {
    const url = new URL(response.url());
    if (!url.pathname.startsWith("/api/student/")) return;
    try {
      const text = await response.text();
      const body = JSON.parse(text) as { ok: boolean; data?: Record<string, unknown> };
      if (!body.ok || !body.data) return;
      if (url.pathname.endsWith("/encounters/activate")) {
        this.activateBodies.push(text);
        const state = body.data.state as { encounter: { current: Question | null } | null };
        this.remember(state.encounter?.current);
      } else if (url.pathname.endsWith("/encounter")) {
        const encounter = body.data.encounter as { current: Question | null } | null;
        this.remember(encounter?.current);
      } else if (url.pathname.endsWith("/attempts")) {
        const points = body.data.points as { appliedDelta: number } | null;
        if (points && !body.data.replayed) this.deltas.push(points.appliedDelta);
      }
    } catch {
      // Trang đang điều hướng: bỏ qua.
    }
  }
  private remember(question: Question | null | undefined) {
    if (question) this.questions.set(question.id, question);
  }
  get total() {
    return this.deltas.reduce((sum, value) => sum + value, 0);
  }
}

const hero = (page: Page) => page.getByTestId("maze-hero");
const pos = async (page: Page): Promise<Position> => ({
  row: Number(await hero(page).getAttribute("data-row")),
  col: Number(await hero(page).getAttribute("data-col")),
});
const KEY: Record<string, string> = { "-1,0": "ArrowUp", "1,0": "ArrowDown", "0,-1": "ArrowLeft", "0,1": "ArrowRight" };
const keyFor = (from: Position, to: Position) => KEY[`${to.row - from.row},${to.col - from.col}`]!;
const same = (a: Position, b: Position) => a.row === b.row && a.col === b.col;

async function stepTo(page: Page, next: Position) {
  const before = await pos(page);
  await page.keyboard.press(keyFor(before, next));
  await expect.poll(async () => same(await pos(page), next), { timeout: 10_000 }).toBe(true);
}

/** Câu hiện tại (theo `data-question-id` của màn) cùng nội dung lấy từ phản hồi của máy chủ. */
async function currentQuestion(page: Page, tracker: Tracker): Promise<Question> {
  const view = page.getByTestId("encounter-question");
  await expect(view).toBeVisible();
  const id = (await view.getAttribute("data-question-id"))!;
  await expect.poll(() => tracker.questions.has(id), { timeout: 10_000 }).toBe(true);
  return tracker.questions.get(id)!;
}

async function choose(page: Page, question: Question, text: string) {
  const index = question.view.content.options.findIndex((option) => option.text === text);
  expect(index).toBeGreaterThanOrEqual(0);
  const tile = page.getByRole("group", { name: /chữ/iu }).getByRole("button").nth(index);
  await expect(tile).toHaveText(text);
  await tile.click();
}

type Attempt = {
  question: { status: string };
  score: { balance: number };
  encounter: { status: string; hpRemaining: number };
};

async function check(page: Page): Promise<Attempt> {
  const waiting = page.waitForResponse((r) => r.url().includes("/attempts") && r.request().method() === "POST");
  await page.getByRole("button", { name: "Kiểm tra" }).click();
  const response = await waiting;
  expect(response.status(), await response.text()).toBe(200);
  const body = (await response.json()) as { ok: boolean; data: Attempt };
  expect(body.ok).toBe(true);
  return body.data;
}

const hp = async (page: Page) => Number(await page.getByTestId("encounter-hp").getAttribute("data-hp"));
const scoreOf = async (page: Page) => Number(await page.getByTestId("encounter-score").getAttribute("data-score"));
const expectHp = (page: Page, value: number) =>
  expect(page.getByTestId("encounter-hp")).toHaveAttribute("data-hp", String(value));
const expectScore = (page: Page, value: number) =>
  expect(page.getByTestId("encounter-score")).toHaveAttribute("data-score", String(value));
const correctOf = (q: Question) => q.view.content.sample;
const wrongOf = (q: Question) =>
  q.view.content.options.map((o) => o.text).filter((text) => text !== q.view.content.sample);

type Plan = "correct" | "wrong-then-correct" | "exhaust";

/** Trả lời một câu theo kế hoạch; mọi con số (điểm, trái tim) đọc từ giao diện và đối chiếu với phản hồi của máy chủ. */
async function answerQuestion(page: Page, question: Question, plan: Plan) {
  const hearts = await hp(page);
  const before = await scoreOf(page);
  const wrongs = wrongOf(question);
  if (plan === "wrong-then-correct") {
    await choose(page, question, wrongs[0]!);
    const wrong = await check(page);
    expect(wrong.question.status).toBe("open");
    await expectHp(page, hearts); // sai: trái tim giữ nguyên
    await expectScore(page, before - 5); // sai: −5 do máy chủ trả
    expect(wrong.score.balance).toBe(before - 5);
    await expect(page.getByText(/thua|thất bại/iu)).toHaveCount(0);
    await choose(page, question, correctOf(question));
  } else if (plan === "exhaust") {
    for (let attempt = 0; ; attempt += 1) {
      await choose(page, question, wrongs[attempt % wrongs.length]!);
      const result = await check(page);
      await expectHp(page, hearts);
      await expectScore(page, result.score.balance);
      if (result.question.status !== "open") {
        expect(result.question.status).toBe("exhausted");
        return;
      }
      expect(attempt).toBeLessThan(4);
    }
  } else {
    await choose(page, question, correctOf(question));
  }
  const result = await check(page);
  expect(result.question.status).toBe("correct");
  await expectHp(page, hearts - 1); // đúng: quái vật mất một trái tim (số máy chủ trả)
  await expectScore(page, result.score.balance);
  expect(result.score.balance).toBeGreaterThan(plan === "wrong-then-correct" ? before - 5 : before);
}

async function nextQuestion(page: Page) {
  await page.getByRole("button", { name: "Câu tiếp theo" }).click();
}

async function expectTouchTargets(...locators: Locator[]) {
  for (const locator of locators) {
    const box = await locator.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(63.5);
  }
}

test.describe.configure({ mode: "serial" });
test.beforeAll(() => {
  expect(PASSWORD, "Thiếu SEED_TEACHER_PASSWORD (.env.local — npm run db:env)").not.toBe("");
});

test("R08.4 toàn trình: 7 chạm trán qua giao diện, tải lại giữa chạm trán, hai tab, rương mở sau 7/7", async ({
  browser,
}, testInfo) => {
  test.setTimeout(600_000);
  const cls = await freshGameClass("MZ-encounters");
  // Nhóm 1 → mức hỗ trợ H1 (2 lượt/câu): với 3 phương án, hết lượt mà chưa đúng chỉ xảy ra khi số lượt ≤ 2.
  const member = await newMember(cls, "Bống", "extending");
  const context = await browser.newContext({
    locale: "vi-VN",
    ...(testInfo.project.use.viewport ? { viewport: testInfo.project.use.viewport } : {}),
    ...(testInfo.project.use.userAgent ? { userAgent: testInfo.project.use.userAgent } : {}),
    ...(testInfo.project.use.isMobile !== undefined ? { isMobile: testInfo.project.use.isMobile } : {}),
    ...(testInfo.project.use.hasTouch !== undefined ? { hasTouch: testInfo.project.use.hasTouch } : {}),
    ...(testInfo.project.use.deviceScaleFactor ? { deviceScaleFactor: testInfo.project.use.deviceScaleFactor } : {}),
  });
  const page = await context.newPage();
  await link(page, member.backup);
  await earnCorrect(context.request, 5);
  expect(await balanceOf(member.id)).toBe(50);

  const tracker = new Tracker(page);
  await resetRateLimits();
  await page.goto(PAGE);
  await expect(page.getByTestId("maze-run")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("maze-ribbon")).toHaveText("Lượt chơi có điểm");
  // Bản đồ chưa vẽ trước quái vật nào, chưa có màn quái vật.
  await expect(page.getByTestId("monster-view")).toHaveCount(0);
  await expect(page.getByTestId("encounter-screen")).toHaveCount(0);
  await expect(page.getByTestId("maze-progress")).toHaveText("Con đã gặp 0/7 bạn quái vật!");

  const remaining = new Map(MAZE.triggers.map((trigger) => [positionKey(trigger), trigger]));
  const monsters = new Set<string>();
  const outcomes: string[] = [];
  let reduced = false;

  async function playEncounter(index: number) {
    const dialog = page.getByTestId("encounter-screen");
    await expect(page.getByTestId("encounter-question")).toBeVisible({ timeout: 30_000 });
    await expect(dialog).toHaveAttribute("role", "dialog");
    const monster = (await page.getByTestId("monster-view").getAttribute("data-monster"))!;
    expect(MONSTER_KEYS as readonly string[]).toContain(monster);
    monsters.add(monster);
    await expectHp(page, 3);
    await expect(page.getByText("Bạn quái vật còn 3 trong 3 trái tim.")).toBeVisible();

    if (index === 0) {
      // Vị trí đã được LƯU trước khi kích hoạt: CSDL đang ở đúng ô kích hoạt; yêu cầu lưu đi trước yêu cầu kích hoạt.
      const here = await pos(page);
      expect((await runsOf(member.id))[0]!.position).toEqual(here);
      const activate = tracker.requests.findIndex((r) => r.endsWith("/encounters/activate"));
      expect(activate).toBeGreaterThan(0);
      expect(tracker.requests.slice(0, activate).some((r) => r.startsWith("PATCH") && r.endsWith("/position"))).toBe(
        true,
      );
      // Không lộ đáp án/tọa độ/mã điểm kích hoạt trong phản hồi kích hoạt.
      expect(tracker.activateBodies[0]).not.toMatch(SECRETS);
      // Trợ năng, bố cục và cỡ vùng chạm.
      await axeClean(page);
      await noHorizontalScroll(page);
      const q = await currentQuestion(page, tracker);
      const tiles = page.getByRole("group", { name: /chữ/iu }).getByRole("button");
      await expectTouchTargets(tiles.first(), dialog.getByRole("button", { name: "Tạm dừng" }));
      await choose(page, q, correctOf(q));
      await expectTouchTargets(page.getByRole("button", { name: "Kiểm tra" }));
      // Phím mũi tên trong màn quái vật không làm nhân vật đi.
      await page.keyboard.press("ArrowRight");
      await page.keyboard.press("ArrowLeft");
      expect(await pos(page)).toEqual(here);
    }

    for (let n = 0; n < 3; n += 1) {
      await expect(page.getByTestId("encounter-step")).toHaveText(`Câu hỏi ${n + 1} / 3`);
      const question = await currentQuestion(page, tracker);
      const plan: Plan = index === 0 && n === 0 ? "wrong-then-correct" : index === 1 && n > 0 ? "exhaust" : "correct";
      await answerQuestion(page, question, plan);
      if (n === 2) break;
      await expect(page.getByRole("button", { name: "Câu tiếp theo" })).toBeVisible();
      const scoreBefore = await scoreOf(page);
      await nextQuestion(page);
      if (index === 1 && n === 0) {
        // Tải lại giữa chạm trán: câu 2, HP và điểm được khôi phục từ máy chủ, không kích hoạt lại; hai tab cùng thấy.
        await expect(page.getByTestId("encounter-step")).toHaveText("Câu hỏi 2 / 3");
        const activateCalls = tracker.requests.filter((r) => r.endsWith("/encounters/activate")).length;
        await page.reload();
        await expect(page.getByTestId("encounter-question")).toBeVisible({ timeout: 30_000 });
        await expect(page.getByTestId("encounter-step")).toHaveText("Câu hỏi 2 / 3");
        await expectHp(page, 2);
        await expectScore(page, scoreBefore);
        expect(tracker.requests.filter((r) => r.endsWith("/encounters/activate")).length).toBe(activateCalls);
        const second = await context.newPage();
        await second.goto(PAGE);
        await expect(second.getByTestId("encounter-step")).toHaveText("Câu hỏi 2 / 3", { timeout: 30_000 });
        expect(Number(await second.getByTestId("encounter-hp").getAttribute("data-hp"))).toBe(2);
        await second.close();
      }
    }

    const outcome = index === 1 ? "undefeated" : "defeated";
    outcomes.push(outcome);
    if (index === 1 && !reduced) {
      await page.emulateMedia({ reducedMotion: "reduce" });
      reduced = true;
    }
    await page.getByRole("button", { name: "Xem kết quả" }).click();
    const result = page.getByTestId("encounter-result");
    await expect(result).toHaveAttribute("data-outcome", outcome);
    await expect(page.getByTestId("monster-view")).toHaveAttribute("data-mood", outcome);
    if (outcome === "defeated") {
      await expect(page.getByText("Giỏi quá! Bạn ấy biến thành những ngôi sao!")).toBeVisible();
      expect(await page.getByTestId("monster-star").count()).toBeGreaterThan(0);
    } else {
      await expect(page.getByText("Hẹn gặp lại nhé!")).toBeVisible();
      await expect(page.getByTestId("monster-zzz")).toBeVisible();
    }
    await expect(result).not.toContainText(/thua|thất bại/iu);
    await expect(page.getByTestId("encounter-progress")).toHaveText(`Con đã gặp ${index + 1}/7 bạn quái vật!`, {
      timeout: 15_000,
    });
    const wrapper = page.getByTestId("monster-view").locator("> div").first();
    const duration = await wrapper.evaluate((element) => getComputedStyle(element).animationDuration);
    if (reduced) expect(parseFloat(duration)).toBeLessThan(0.01);
    else expect(parseFloat(duration)).toBeGreaterThan(1);
    await axeClean(page);
    await page.getByRole("button", { name: "Về mê cung" }).click();
    await expect(page.getByTestId("encounter-screen")).toHaveCount(0);
    await expect(page.getByTestId("maze-progress")).toHaveText(`Con đã gặp ${index + 1}/7 bạn quái vật!`);
  }

  // Đi tới các điểm kích hoạt gần nhất; mỗi lần dừng ở một điểm CHƯA dùng thì phải hiện màn quái vật.
  let done = 0;
  while (remaining.size > 0) {
    const from = await pos(page);
    const target = [...remaining.values()]
      .map((trigger) => ({ trigger, path: findPath(MAZE.grid, from, trigger)! }))
      .sort((a, b) => a.path.length - b.path.length)[0]!;
    for (const next of target.path.slice(1)) {
      const isTrigger = remaining.has(positionKey(next));
      await stepTo(page, next);
      if (isTrigger) {
        remaining.delete(positionKey(next));
        await playEncounter(done);
        done += 1;
        break;
      }
    }
  }
  expect(done).toBe(7);
  expect(monsters.size).toBe(7);

  // Điểm trong CSDL khớp tổng các lượt máy chủ báo; trình duyệt không tự cộng trừ.
  const balance = await balanceOf(member.id);
  expect(balance).toBe(50 + tracker.total);
  const encounters = await must(
    admin
      .from("game_encounters")
      .select("status, hp_remaining")
      .eq("run_id", (await runsOf(member.id))[0]!.id),
  );
  const statuses = (encounters as Array<{ status: string }>).map((row) => row.status).sort();
  expect(statuses.filter((s) => s === "defeated")).toHaveLength(6);
  expect(statuses.filter((s) => s === "undefeated")).toHaveLength(1);

  // Rương: chỉ mở khi đứng ở ô rương và máy chủ xác nhận đủ 7/7; không cộng điểm.
  const toTreasure = findPath(MAZE.grid, await pos(page), MAZE.treasure)!;
  for (const next of toTreasure.slice(1)) await stepTo(page, next);
  const opened = page.getByTestId("treasure-opened");
  await expect(opened).toBeVisible({ timeout: 30_000 });
  await expect(opened).toContainText("Con đã khám phá xong Mê cung kho báu!");
  await expect(opened).toContainText("6 bạn biến thành sao");
  await expect(opened).toContainText("1 bạn bay đi ngủ");
  await expect(opened).toContainText("Mở rương không cộng thêm điểm");
  expect(await balanceOf(member.id)).toBe(balance);
  const run = (await runsOf(member.id))[0]!;
  expect(run.status).toBe("completed");
  expect(run.position).toEqual(MAZE.treasure);
  await axeClean(page);
  await noHorizontalScroll(page);

  // Điều khiển bị khóa sau khi mở rương; gọi lại API chỉ trả kết quả cũ, không tạo thêm gì.
  await page.keyboard.press("ArrowRight");
  expect(await pos(page)).toEqual(MAZE.treasure);
  const again = await context.request.post(`/api/student/game-runs/${run.id}/treasure/open`, { data: {} });
  const againBody = (await again.json()) as { ok: boolean; data: { outcome: string } };
  expect(againBody.ok).toBe(true);
  expect(againBody.data.outcome).toBe("replayed");
  expect(await balanceOf(member.id)).toBe(balance);
  await context.close();
});
