import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { findPath, parseLevel, positionKey, type Position } from "../../src/features/game-engine/core";
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
} from "./class-fixtures";

/**
 * R08.6 — Chơi lại Mê cung KHÔNG tính điểm, qua giao diện trên Supabase LOCAL (dữ liệu giả, nội dung fixture).
 * Lượt tính điểm được hoàn thành nhanh bằng API (đúng đường học sinh dùng, không đường tắt CSDL); phần chơi lại đi bằng giao diện:
 * mời "Chơi lại cho vui" → nhãn không tính điểm → 7 quái vật → HP đúng/sai → tải lại → mất mạng rồi gửi lại → mở rương →
 * điểm, số dòng sổ cái và lượt tính điểm cũ không đổi.
 */

const PAGE = "/learn/me/games/treasure-maze";
const LEVEL = { id: level1.id, rows: level1.rows, triggers: level1.triggers };
const MAZE = parseLevel(LEVEL);

type Option = { id: string; text: string };
type Question = { id: string; view: { content: { sample: string; options: Option[] } } };
type EncounterState = {
  encounter: { current: Question | null; hpRemaining: number } | null;
  progress: { resolved: number; total: number };
};

const hero = (page: Page) => page.getByTestId("maze-hero");
const pos = async (page: Page): Promise<Position> => ({
  row: Number(await hero(page).getAttribute("data-row")),
  col: Number(await hero(page).getAttribute("data-col")),
});
const KEY: Record<string, string> = { "-1,0": "ArrowUp", "1,0": "ArrowDown", "0,-1": "ArrowLeft", "0,1": "ArrowRight" };
const same = (a: Position, b: Position) => a.row === b.row && a.col === b.col;

async function stepTo(page: Page, next: Position) {
  const before = await pos(page);
  await page.keyboard.press(KEY[`${next.row - before.row},${next.col - before.col}`]!);
  await expect.poll(async () => same(await pos(page), next), { timeout: 10_000 }).toBe(true);
}

async function api<T>(promise: Promise<{ status(): number; json(): Promise<unknown> }>): Promise<T> {
  const response = await promise;
  const body = (await response.json()) as { ok: boolean; data?: T; code?: string };
  expect(body.ok, `${response.status()} ${body.code ?? ""}`).toBe(true);
  return body.data as T;
}

/** Hoàn thành lượt TÍNH ĐIỂM bằng các API học sinh: 7 chạm trán toàn đúng rồi mở kho báu. */
async function completeScoredRun(request: APIRequestContext) {
  const start = await api<{ run: { id: string; stateVersion: number; position: Position } }>(
    request.post("/api/student/game-runs", { data: { gameKey: "treasure_maze", levelKey: LEVEL.id } }),
  );
  const runId = start.run.id;
  let version = start.run.stateVersion;
  let at: Position = start.run.position;
  const remaining = new Map(MAZE.triggers.map((trigger) => [positionKey(trigger), trigger]));

  async function walk(path: Position[]) {
    for (let i = 0; i < path.length; i += 64) {
      const chunk = path.slice(i, i + 64);
      const saved = await api<{ stateVersion: number }>(
        request.patch(`/api/student/game-runs/${runId}/position`, { data: { stateVersion: version, path: chunk } }),
      );
      version = saved.stateVersion;
    }
    at = path.at(-1) ?? at;
  }

  while (remaining.size > 0) {
    const target = [...remaining.values()]
      .map((trigger) => ({ trigger, path: findPath(MAZE.grid, at, trigger)! }))
      .sort((a, b) => a.path.length - b.path.length)[0]!;
    const steps = target.path.slice(1).map(({ row, col }) => ({ row, col }));
    const stop = steps.findIndex((step) => remaining.has(positionKey(step)));
    const upTo = steps.slice(0, stop + 1);
    await walk(upTo);
    remaining.delete(positionKey(at));
    await api(request.post(`/api/student/game-runs/${runId}/encounters/activate`, { data: {} }));
    for (;;) {
      const state = await api<EncounterState>(request.get(`/api/student/game-runs/${runId}/encounter`));
      const current = state.encounter?.current;
      if (!current) break;
      const { sample, options } = current.view.content;
      await api(
        request.post(`/api/student/question-instances/${current.id}/attempts`, {
          data: {
            clientAttemptId: crypto.randomUUID(),
            response: { kind: "choice", optionId: options.find((option) => option.text === sample)!.id },
          },
        }),
      );
    }
  }
  await walk(
    findPath(MAZE.grid, at, MAZE.treasure)!
      .slice(1)
      .map(({ row, col }) => ({ row, col })),
  );
  await api(request.post(`/api/student/game-runs/${runId}/treasure/open`, { data: {} }));
  return runId;
}

const ledgerCount = async (studentId: string) =>
  ((await must(admin.from("point_events").select("id").eq("student_id", studentId))) as unknown[]).length;
const runsOf = async (studentId: string) =>
  (await must(
    admin
      .from("game_runs")
      .select("id, scored, is_replay, status, started_at")
      .eq("student_id", studentId)
      .order("started_at"),
  )) as Array<{ id: string; scored: boolean; is_replay: boolean; status: string }>;

const hp = (page: Page) => page.getByTestId("encounter-hp");
const expectHp = (page: Page, value: number) => expect(hp(page)).toHaveAttribute("data-hp", String(value));

async function choose(page: Page, question: Question, text: string) {
  const index = question.view.content.options.findIndex((option) => option.text === text);
  expect(index).toBeGreaterThanOrEqual(0);
  const tile = page.getByRole("group", { name: /chữ/iu }).getByRole("button").nth(index);
  await expect(tile).toHaveText(text);
  await tile.click();
}

async function currentQuestion(page: Page, seen: Map<string, Question>): Promise<Question> {
  const view = page.getByTestId("encounter-question");
  await expect(view).toBeVisible();
  const id = (await view.getAttribute("data-question-id"))!;
  await expect.poll(() => seen.has(id), { timeout: 10_000 }).toBe(true);
  return seen.get(id)!;
}

async function check(page: Page) {
  const waiting = page.waitForResponse((r) => r.url().includes("/attempts") && r.request().method() === "POST");
  await page.getByRole("button", { name: "Kiểm tra" }).click();
  const response = await waiting;
  expect(response.status(), await response.text()).toBe(200);
  return ((await response.json()) as { data: { points: unknown; score: { balance: number } } }).data;
}

test.describe.configure({ mode: "serial" });
test.beforeAll(() => {
  expect(PASSWORD, "Thiếu SEED_TEACHER_PASSWORD (.env.local — npm run db:env)").not.toBe("");
});

test("R08.6 chơi lại không tính điểm: mời chơi lại, 7 quái vật, HP đúng/sai, tải lại, mất mạng, rương; điểm không đổi", async ({
  browser,
}, testInfo) => {
  test.setTimeout(600_000);
  const cls = await freshGameClass("MZ-replay");
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
  const scoredRunId = await completeScoredRun(context.request);
  const balance = await balanceOf(member.id);
  const events = await ledgerCount(member.id);
  const [firstRun] = await runsOf(member.id);
  expect(firstRun).toMatchObject({ id: scoredRunId, scored: true, is_replay: false, status: "completed" });

  const seen = new Map<string, Question>();
  page.on("response", (response) => {
    const url = new URL(response.url());
    if (!url.pathname.startsWith("/api/student/") || response.request().method() === "PATCH") return;
    void response
      .json()
      .then((body: { ok: boolean; data?: { state?: EncounterState; encounter?: EncounterState["encounter"] } }) => {
        const encounter = body.data?.state?.encounter ?? body.data?.encounter;
        if (encounter?.current) seen.set(encounter.current.id, encounter.current);
      })
      .catch(() => undefined);
  });

  await resetRateLimits();
  // Lượt tính điểm đã xong: chỉ còn lời mời chơi lại, nói rõ điểm không đổi; chưa dựng bàn chơi.
  const offer = page.getByTestId("maze-replay-offer");
  await page.goto(PAGE);
  // Trên CI, WebKit mobile thỉnh thoảng không tải script của trang ở lần mở đầu (trace: sau tài liệu không có yêu cầu nào, kể cả
  // POST bắt đầu lượt; lỗi chập chờn cũng gặp ở E2E R08.4 trên cb3a357). Mở lại một lần, không nới thời gian chờ của các bước sau.
  const shown = await offer.waitFor({ state: "visible", timeout: 15_000 }).then(
    () => true,
    () => false,
  );
  if (!shown) await page.reload();
  await expect(offer).toBeVisible({ timeout: 30_000 });
  await expect(offer).toContainText("Lần này con vẫn được gặp các bạn quái vật và làm câu hỏi");
  await expect(offer).toContainText("điểm thưởng sẽ không thay đổi nhé!");
  await expect(page.getByTestId("maze-run")).toHaveCount(0);
  await axeClean(page);
  await noHorizontalScroll(page);
  await page.getByRole("button", { name: "Chơi lại cho vui" }).click();

  await expect(page.getByTestId("maze-run")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("maze-ribbon")).toHaveText("Chơi lại — không tính điểm");
  await expect(page.getByTestId("maze-progress")).toHaveText("Con đã gặp 0/7 bạn quái vật!");
  const rows = await runsOf(member.id);
  expect(rows).toHaveLength(2);
  expect(rows[1]).toMatchObject({ scored: false, is_replay: true, status: "in_progress" });

  const remaining = new Map(MAZE.triggers.map((trigger) => [positionKey(trigger), trigger]));
  let done = 0;

  async function playEncounter(index: number) {
    await expect(page.getByTestId("encounter-question")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("encounter-replay")).toHaveText("Chơi lại — không tính điểm");
    await expect(page.getByTestId("encounter-score")).toHaveCount(0);
    await expectHp(page, 3);
    for (let n = 0; n < 3; n += 1) {
      await expect(page.getByTestId("encounter-step")).toHaveText(`Câu hỏi ${n + 1} / 3`);
      const question = await currentQuestion(page, seen);
      const { sample, options } = question.view.content;
      const wrong = options.map((o) => o.text).find((text) => text !== sample)!;
      if (index === 0 && n === 0) {
        // Sai: trái tim giữ nguyên, không có "−5"; rồi đúng: mất một trái tim, không có "+10".
        await choose(page, question, wrong);
        const first = await check(page);
        expect(first.points).toBeNull();
        expect(first.score.balance).toBe(balance);
        await expectHp(page, 3);
        await expect(page.getByText(/−5|\+10/u)).toHaveCount(0);
        await choose(page, question, sample);
        await check(page);
        await expectHp(page, 2);
      } else if (index === 1 && n === 1) {
        // Mất mạng lúc nộp: giữ đáp án, "Gửi lại" dùng đúng lượt cũ; HP chỉ giảm một lần.
        const heartsBefore = Number(await hp(page).getAttribute("data-hp"));
        await choose(page, question, sample);
        await context.setOffline(true);
        await page.getByRole("button", { name: "Kiểm tra" }).click();
        await expect(page.getByRole("alert").filter({ hasText: "Chưa kết nối được" })).toBeVisible();
        await context.setOffline(false);
        const waiting = page.waitForResponse((r) => r.url().includes("/attempts") && r.request().method() === "POST");
        await page.getByRole("button", { name: "Gửi lại" }).click();
        expect((await waiting).status()).toBe(200);
        await expectHp(page, heartsBefore - 1);
      } else {
        await choose(page, question, sample);
        await check(page);
      }
      if (n === 2) break;
      await page.getByRole("button", { name: "Câu tiếp theo" }).click();
      if (index === 0 && n === 0) {
        // Tải lại giữa chạm trán: quay lại câu 2, HP 2, vẫn là chơi lại, không kích hoạt lại.
        await expect(page.getByTestId("encounter-step")).toHaveText("Câu hỏi 2 / 3");
        await page.reload();
        await expect(page.getByTestId("encounter-question")).toBeVisible({ timeout: 30_000 });
        await expect(page.getByTestId("encounter-step")).toHaveText("Câu hỏi 2 / 3");
        await expectHp(page, 2);
        await expect(page.getByTestId("maze-ribbon")).toHaveText("Chơi lại — không tính điểm");
        await expect(page.getByTestId("encounter-replay")).toBeVisible();
      }
    }
    await page.getByRole("button", { name: "Xem kết quả" }).click();
    const result = page.getByTestId("encounter-result");
    await expect(result).toHaveAttribute("data-outcome", "defeated");
    await expect(result).not.toContainText(/thua|thất bại|−5/iu);
    await expect(page.getByTestId("encounter-progress")).toHaveText(`Con đã gặp ${index + 1}/7 bạn quái vật!`, {
      timeout: 15_000,
    });
    if (index === 0) await axeClean(page);
    await page.getByRole("button", { name: "Về mê cung" }).click();
    await expect(page.getByTestId("encounter-screen")).toHaveCount(0);
    await expect(page.getByTestId("maze-progress")).toHaveText(`Con đã gặp ${index + 1}/7 bạn quái vật!`);
  }

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
  // Mỗi chạm trán đều không đổi điểm; CSDL vẫn nguyên số dòng sổ cái.
  expect(await balanceOf(member.id)).toBe(balance);
  expect(await ledgerCount(member.id)).toBe(events);

  // Rương: chỉ mở khi đủ 7/7 và đứng ở ô rương; không cộng điểm; hiện lời chúc của lượt chơi lại.
  for (const next of findPath(MAZE.grid, await pos(page), MAZE.treasure)!.slice(1)) await stepTo(page, next);
  const opened = page.getByTestId("treasure-opened");
  await expect(opened).toBeVisible({ timeout: 30_000 });
  await expect(opened).toContainText("Con đã khám phá Mê cung thêm một lần nữa!");
  await expect(opened).toContainText("Điểm thưởng của con vẫn giữ nguyên.");
  await expect(opened).not.toContainText("Mở rương không cộng thêm điểm");
  await expect(page.getByRole("button", { name: "Chơi lại lần nữa" })).toBeVisible();
  await axeClean(page);
  await noHorizontalScroll(page);
  expect(await balanceOf(member.id)).toBe(balance);
  expect(await ledgerCount(member.id)).toBe(events);

  // Lượt tính điểm cũ nguyên vẹn; lượt chơi lại đã hoàn thành; không có lượt đang dở.
  const after = await runsOf(member.id);
  expect(after).toHaveLength(2);
  expect(after[0]).toMatchObject({ id: scoredRunId, scored: true, is_replay: false, status: "completed" });
  expect(after[1]).toMatchObject({ scored: false, is_replay: true, status: "completed" });

  // Chơi lại tiếp: lượt MỚI, vẫn không tính điểm.
  await page.getByRole("button", { name: "Chơi lại lần nữa" }).click();
  await expect(page.getByTestId("maze-ribbon")).toHaveText("Chơi lại — không tính điểm", { timeout: 30_000 });
  const third = await runsOf(member.id);
  expect(third).toHaveLength(3);
  expect(third[2]).toMatchObject({ scored: false, is_replay: true, status: "in_progress" });
  expect(await balanceOf(member.id)).toBe(balance);
  await context.close();
});
