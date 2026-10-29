import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { setLocalGameRunFixtures } from "../../scripts/lib/test-fixtures";
import {
  admin,
  API_URL,
  axeClean,
  balanceOf,
  earnCorrect,
  freshClass,
  link,
  must,
  newMember,
  noHorizontalScroll,
  PASSWORD,
  PUBLISHABLE_KEY,
  resetRateLimits,
  runsOf,
  TEACHER_A,
  type ClassRow,
  type Member,
} from "./class-fixtures";

/**
 * R07.5b2 — Mê cung kho báu có xác thực trên Supabase LOCAL: ngưỡng 50 điểm, nội dung chưa có (production), lượt
 * fixture KHÔNG tính điểm, tự lưu, khôi phục, hai tab, mất mạng, reset mùa và các kiểm tra bảo mật ở tầng route.
 * Lượt fixture chỉ tạo được khi cờ LOCAL `game_run_fixtures_allowed` bật (mỗi kịch bản tự bật/tắt).
 */

const PAGE = "/learn/me/games/treasure-maze";
// Màn 1: xuất phát (1,1); hàng 1 là hành lang đi được tới cột 7.
const START_COL = 1;
const T = {
  needs: "maze-needs-points",
  preparing: "maze-preparing",
  run: "maze-run",
  status: "save-status",
};

type Learner = { cls: ClassRow; member: Member; page: Page };

async function learner(browser: Browser, points: number, label: string): Promise<Learner> {
  const cls = await freshClass(label);
  const member = await newMember(cls, "Bống");
  const context = await browser.newContext({ locale: "vi-VN" });
  const page = await context.newPage();
  await link(page, member.backup);
  if (points > 0) await earnCorrect(context.request, points / 10);
  return { cls, member, page };
}

const hero = (page: Page) => page.getByTestId("maze-hero");
const at = async (page: Page) => [
  Number(await hero(page).getAttribute("data-row")),
  Number(await hero(page).getAttribute("data-col")),
];
const state = (page: Page) => page.getByTestId(T.status).getAttribute("data-state");
const right = async (page: Page, times: number) => {
  for (let i = 0; i < times; i += 1) await page.keyboard.press("ArrowRight");
};
const dbPosition = async (studentId: string) => (await runsOf(studentId))[0]?.position;
const open = async (page: Page) => {
  await page.goto(PAGE);
  await expect(page.getByTestId(T.run)).toBeVisible({ timeout: 30_000 });
};

async function withFixtures<R>(work: () => Promise<R>): Promise<R> {
  setLocalGameRunFixtures(true);
  try {
    return await work();
  } finally {
    setLocalGameRunFixtures(false);
  }
}

test.describe.configure({ mode: "serial" });
test.beforeAll(() => {
  expect(PASSWORD, "Thiếu SEED_TEACHER_PASSWORD (.env.local — npm run db:env)").not.toBe("");
});
test.afterAll(() => setLocalGameRunFixtures(false));

test.describe("R07.5b2 — vào Mê cung", () => {
  test("dưới 50 điểm: yêu cầu luyện thêm, không gọi API lượt chơi, không tạo lượt", async ({ browser }) => {
    test.setTimeout(180_000);
    const { member, page } = await learner(browser, 40, "MZ-thap");
    const calls: string[] = [];
    page.on("request", (request) => {
      if (request.url().includes("/api/student/game-runs")) calls.push(request.method());
    });
    await page.goto(PAGE);
    const box = page.getByTestId(T.needs);
    await expect(box).toBeVisible();
    await expect(box).toContainText("50 điểm thưởng");
    await expect(box).toContainText("40");
    await expect(page.getByTestId(T.run)).toHaveCount(0);
    await axeClean(page);
    await noHorizontalScroll(page);
    expect(calls).toEqual([]);
    expect(await runsOf(member.id)).toEqual([]);
    await page.context().close();
  });

  test("đủ điểm nhưng production chưa có nội dung: thông báo chờ + liên kết bản thử, không tạo lượt", async ({
    browser,
  }) => {
    test.setTimeout(180_000);
    setLocalGameRunFixtures(false);
    const { member, page } = await learner(browser, 50, "MZ-prod");
    await page.goto(PAGE);
    const box = page.getByTestId(T.preparing);
    await expect(box).toBeVisible({ timeout: 30_000 });
    await expect(box).toContainText("Mê cung đang được chuẩn bị. Con có thể chơi bản thử nghiệm!");
    const demo = box.getByRole("link", { name: "Chơi bản thử nghiệm" });
    await expect(demo).toHaveAttribute("href", "/demo/treasure-maze");
    await expect(page.getByTestId(T.run)).toHaveCount(0);
    await expect(page.getByTestId("maze-ribbon")).toHaveCount(0);
    expect(await runsOf(member.id)).toEqual([]);
    await axeClean(page);
    await demo.click();
    await expect(page).toHaveURL(/\/demo\/treasure-maze$/u);
    await page.context().close();
  });
});

test.describe("R07.5b2 — chơi, tự lưu, khôi phục (lượt fixture không tính điểm)", () => {
  test("nhãn 'Chơi thử', đi 5 bước tự lưu, tải lại giữ vị trí, lưu khi tạm dừng/ẩn trang, mobile + axe + giảm chuyển động", async ({
    browser,
  }) => {
    test.setTimeout(240_000);
    await withFixtures(async () => {
      const { member, page } = await learner(browser, 50, "MZ-luu");
      await page.setViewportSize({ width: 360, height: 740 });
      await open(page);
      await expect(page.getByTestId("maze-ribbon")).toHaveText("Chơi thử — không tính điểm");
      expect(await at(page)).toEqual([1, START_COL]);
      expect((await runsOf(member.id))[0]).toMatchObject({ scored: false, status: "in_progress" });
      await expect(page.getByRole("button", { name: "Tiếp tục bản chơi thử" })).toHaveCount(0);
      await noHorizontalScroll(page);
      await axeClean(page);

      // 5 bước → tự lưu (không cần chờ 3 giây).
      await right(page, 5);
      await expect.poll(() => dbPosition(member.id)).toEqual({ row: 1, col: START_COL + 5 });
      await expect.poll(() => state(page)).toBe("saved");

      // Tải lại: gọi tiếp tục lượt, vị trí và camera bám theo, không về điểm xuất phát.
      await page.reload();
      await expect(page.getByTestId(T.run)).toBeVisible({ timeout: 30_000 });
      expect(await at(page)).toEqual([1, START_COL + 5]);
      expect((await runsOf(member.id)).length).toBe(1);
      const boardBox = (await page.getByTestId("maze-board").boundingBox())!;
      const heroBox = (await hero(page).boundingBox())!;
      expect(heroBox.x).toBeGreaterThanOrEqual(boardBox.x - 1);
      expect(heroBox.x + heroBox.width).toBeLessThanOrEqual(boardBox.x + boardBox.width + 1);

      // Nút cảm ứng 1 bước (màn 390) + tạm dừng lưu ngay.
      await page.setViewportSize({ width: 390, height: 780 });
      await page.getByRole("button", { name: "Phải" }).click();
      await page.getByRole("button", { name: "Tạm dừng" }).click();
      await expect.poll(() => dbPosition(member.id)).toEqual({ row: 1, col: START_COL + 6 });
      await page.getByRole("button", { name: "Tiếp tục" }).click();
      await noHorizontalScroll(page);

      // Trang bị ẩn → cố gắng lưu bước còn chờ (không chờ 3 giây).
      await page.keyboard.press("ArrowDown"); // hết hành lang hàng 1 ở cột 7; đi xuống ô (2,7)
      await page.evaluate(() => {
        Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
        document.dispatchEvent(new Event("visibilitychange"));
      });
      await expect.poll(() => dbPosition(member.id)).toEqual({ row: 2, col: START_COL + 6 });

      // Giảm chuyển động theo hệ điều hành: chuyển tiếp camera gần như tức thì.
      await page.emulateMedia({ reducedMotion: "reduce" });
      const duration = await page
        .getByTestId("maze-world")
        .evaluate((element) => getComputedStyle(element).transitionDuration);
      expect(parseFloat(duration)).toBeLessThan(0.01);
      expect(await balanceOf(member.id)).toBe(50); // lưu vị trí không đổi điểm
      await page.context().close();
    });
  });

  test("hai tab cùng lưu: tab đến sau nhận STATE_CONFLICT, được giải thích rồi tải lại vị trí của tab kia", async ({
    browser,
  }) => {
    test.setTimeout(240_000);
    await withFixtures(async () => {
      const { member, page: tabA } = await learner(browser, 50, "MZ-2tab");
      await open(tabA);
      const tabB = await tabA.context().newPage();
      await open(tabB);
      await right(tabB, 5);
      await expect.poll(() => dbPosition(member.id)).toEqual({ row: 1, col: START_COL + 5 });

      await tabA.bringToFront();
      await right(tabA, 2);
      await tabA.getByRole("button", { name: "Tạm dừng" }).click();
      const conflict = tabA.getByTestId("maze-conflict");
      await expect(conflict).toBeVisible();
      await expect(conflict).toContainText("2 bước");
      await expect(tabA.getByTestId(T.run)).toHaveCount(0);
      await axeClean(tabA);
      // Không ghi đè dữ liệu của tab B.
      expect(await dbPosition(member.id)).toEqual({ row: 1, col: START_COL + 5 });

      await conflict.getByRole("button", { name: "Tải lại vị trí đã lưu" }).click();
      await expect(tabA.getByTestId(T.run)).toBeVisible();
      expect(await at(tabA)).toEqual([1, START_COL + 5]);
      await tabA.context().close();
    });
  });

  test("mất mạng: 'Chưa lưu được' (không báo đã lưu); có mạng + Thử lại → lưu đủ, không nhân đôi", async ({
    browser,
  }) => {
    test.setTimeout(240_000);
    await withFixtures(async () => {
      const { member, page } = await learner(browser, 50, "MZ-mang");
      await open(page);
      await page.context().setOffline(true);
      await right(page, 2);
      await page.getByRole("button", { name: "Tạm dừng" }).click();
      await expect(page.getByTestId(T.status)).toHaveAttribute("data-state", "unsaved");
      await expect(page.getByTestId(T.status)).toContainText("Chưa lưu được");
      await expect(page.getByTestId(T.status)).not.toContainText("Đã lưu");
      expect(await dbPosition(member.id)).toEqual({ row: 1, col: START_COL });

      // Bấm Thử lại khi vẫn mất mạng: vẫn báo chưa lưu, không giả vờ đã lưu.
      await page.getByRole("button", { name: "Thử lại", exact: true }).click();
      await expect(page.getByTestId(T.status)).toHaveAttribute("data-state", "unsaved");
      // Có mạng trở lại: tự thử lại (sự kiện online) bằng chính lô đã đóng băng.
      await page.context().setOffline(false);
      await expect(page.getByTestId(T.status)).toHaveAttribute("data-state", "saved");
      expect(await dbPosition(member.id)).toEqual({ row: 1, col: START_COL + 2 });
      expect((await runsOf(member.id))[0]!.state_version).toBe(2);
      await page.context().close();
    });
  });

  test("reset mùa: lượt cũ dừng, học sinh được hướng dẫn quay về; mùa mới 0 điểm nên không vào lại", async ({
    browser,
  }) => {
    test.setTimeout(240_000);
    await withFixtures(async () => {
      const { cls, member, page } = await learner(browser, 50, "MZ-mua");
      await open(page);
      const season = (await must(
        admin.from("seasons").select("id").eq("class_id", cls.id).eq("status", "active").single(),
      )) as { id: string };
      const teacher = createClient(API_URL, PUBLISHABLE_KEY, { auth: { persistSession: false } });
      const signedIn = await teacher.auth.signInWithPassword({ email: TEACHER_A, password: PASSWORD });
      expect(signedIn.error).toBeNull();
      const reset = await teacher.rpc("teacher_reset_season", {
        p_class_id: cls.id,
        p_request_id: randomUUID(),
        p_expected_season_id: season.id,
        p_confirmation: cls.name,
      });
      expect(reset.error).toBeNull();

      await page.keyboard.press("ArrowRight");
      await page.getByRole("button", { name: "Tạm dừng" }).click();
      const closed = page.getByTestId("maze-closed");
      await expect(closed).toBeVisible();
      await expect(closed).toContainText("quay về trang của con");
      await expect(closed.getByRole("link", { name: "Về trang của con" })).toHaveAttribute("href", "/learn/me");
      expect((await runsOf(member.id))[0]).toMatchObject({ status: "void_season_reset" });

      await page.goto(PAGE);
      await expect(page.getByTestId(T.needs)).toBeVisible();
      await page.context().close();
    });
  });
});

test.describe("R07.5b2 — bảo mật tầng route", () => {
  test("API lượt chơi: thiết bị khác, hồ sơ lạ, trường lạ, khác nguồn, đường đi sai; không lộ lớp/học sinh/mùa; không đổi điểm", async ({
    browser,
    playwright,
  }) => {
    test.setTimeout(300_000);
    await withFixtures(async () => {
      const a = await learner(browser, 50, "MZ-api-a");
      const b = await learner(browser, 50, "MZ-api-b");
      const reqA = a.page.context().request;
      const reqB = b.page.context().request;
      const body = { studentId: a.member.id, gameKey: "treasure_maze", levelKey: "treasure-maze-01" };
      await resetRateLimits();

      const started = await reqA.post("/api/student/game-runs", { data: body });
      expect(started.status()).toBe(200);
      expect(started.headers()["cache-control"]).toContain("no-store");
      const text = await started.text();
      for (const leak of ["class_id", "classId", "student_id", "season", "points", "balance", "token", "backup"]) {
        expect(text.toLowerCase()).not.toContain(leak.toLowerCase());
      }
      const run = JSON.parse(text).data.run as { id: string; scored: boolean; stateVersion: number };
      expect(run.scored).toBe(false);

      // Không có phiên.
      const anonymous = await playwright.request.newContext({ baseURL: new URL(a.page.url()).origin });
      expect((await anonymous.post("/api/student/game-runs", { data: body })).status()).toBe(401);
      expect(
        (
          await anonymous.patch(`/api/student/game-runs/${run.id}/position`, {
            data: { studentId: a.member.id, stateVersion: 1, path: [] },
          })
        ).status(),
      ).toBe(401);
      await anonymous.dispose();

      // Hồ sơ của thiết bị khác.
      expect((await reqB.post("/api/student/game-runs", { data: body })).status()).toBe(403);
      const foreignRun = await reqB.patch(`/api/student/game-runs/${run.id}/position`, {
        data: { studentId: b.member.id, stateVersion: 1, path: [{ row: 1, col: 2 }] },
      });
      expect(foreignRun.status()).toBe(404);
      expect((await runsOf(a.member.id))[0]!.position).toEqual({ row: 1, col: 1 });

      // Trường lạ, sai kiểu nội dung, khác nguồn.
      for (const extra of [
        { scored: true },
        { points: 999 },
        { classId: a.cls.id },
        { seasonId: randomUUID() },
        { fixture: true },
      ]) {
        expect((await reqA.post("/api/student/game-runs", { data: { ...body, ...extra } })).status()).toBe(400);
      }
      expect(
        (await reqA.post("/api/student/game-runs", { data: "x", headers: { "Content-Type": "text/plain" } })).status(),
      ).toBe(400);
      expect(
        (
          await reqA.post("/api/student/game-runs", {
            data: body,
            headers: { Origin: "https://evil.example", "Sec-Fetch-Site": "cross-site" },
          })
        ).status(),
      ).toBe(403);

      // Đường đi: tường, nhảy ô, quá 64 bước, id không phải uuid, trường lạ.
      const patch = (path: unknown, extra: object = {}, runId: string = run.id) =>
        reqA.patch(`/api/student/game-runs/${runId}/position`, {
          data: { studentId: a.member.id, stateVersion: run.stateVersion, path, ...extra },
        });
      expect((await patch([{ row: 0, col: 1 }])).status()).toBe(400); // tường
      expect((await patch([{ row: 1, col: 3 }])).status()).toBe(400); // nhảy ô
      expect((await patch(Array(65).fill({ row: 1, col: 2 }))).status()).toBe(400);
      expect((await patch([{ row: 1, col: 2 }], { hp: 3 })).status()).toBe(400);
      expect((await patch([{ row: 1, col: 2 }], {}, "khong-phai-uuid")).status()).toBe(404);
      expect((await patch([{ row: 1, col: 2 }], { stateVersion: 99 })).status()).toBe(409);
      expect((await runsOf(a.member.id))[0]!.position).toEqual({ row: 1, col: 1 });

      // Đường đi hợp lệ xuyên qua điểm kích hoạt: chỉ đổi vị trí, không điểm, không hoàn tất, không chạm trán.
      const before = await balanceOf(a.member.id);
      const walk = Array.from({ length: 6 }, (_, i) => ({ row: 1, col: 2 + i }));
      const saved = await patch(walk);
      expect(saved.status()).toBe(200);
      const savedText = await saved.text();
      expect(savedText).not.toContain("class_id");
      expect((await runsOf(a.member.id))[0]).toMatchObject({
        position: { row: 1, col: 7 },
        status: "in_progress",
        scored: false,
      });
      expect(await balanceOf(a.member.id)).toBe(before);
      await a.page.context().close();
      await b.page.context().close();
    });
  });
});
