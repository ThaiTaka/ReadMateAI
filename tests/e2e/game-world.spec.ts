import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";

/**
 * E2E R02 — Student Adventure Dashboard (/learn), Game World, giảm chuyển động, trợ năng và bố cục.
 * Mọi dữ liệu là minh họa hư cấu; kiểm tra rằng không có thao tác nào ghi/gửi dữ liệu và không có game giả.
 */

const GAMES = [
  { name: "Mê cung kho báu", eligible: true },
  { name: "Rừng chữ kỳ diệu", eligible: true },
  { name: "Đảo dấu thanh", eligible: false },
  { name: "Lâu đài ghép vần", eligible: false },
] as const;

async function seriousViolations(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  return results.violations
    .filter((violation) => violation.impact === "critical" || violation.impact === "serious")
    .map((violation) => `${violation.id}: ${violation.nodes.map((node) => node.target.join(" ")).join(" | ")}`);
}

test.describe("Game World trên /learn (dữ liệu minh họa)", () => {
  test("nhãn bản chơi thử, hồ sơ hư cấu, đủ 4 khu vực với trạng thái đúng theo 135 điểm", async ({
    page,
    pageErrors,
  }) => {
    await page.goto("/learn");
    await expect(page.getByRole("note").first()).toContainText(/Bản chơi thử – Dữ liệu minh họa/iu);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Chào Mây!");
    await expect(page.getByText("135 điểm thưởng").first()).toBeAttached();
    const world = page.getByRole("region", { name: "Bản đồ thế giới phiêu lưu" });
    for (const game of GAMES) {
      const card = world.getByRole("listitem", { name: game.name });
      await expect(card).toBeVisible();
      await expect(card.getByText(game.eligible ? "Đủ điểm" : "Chưa đủ điểm").first()).toBeVisible();
    }
    await expect(world.getByText("Cần thêm 65 điểm").first()).toBeVisible();
    await expect(world.getByText("Cần thêm 165 điểm").first()).toBeVisible();
    // Không có liên kết tới trang game chưa tồn tại.
    await expect(page.locator("a[href*='/games']")).toHaveCount(0);
    expect(pageErrors).toEqual([]);
  });

  test("Xem chi tiết mở bảng thông tin thật; Vào chơi bị khóa và ghi Sắp có; Esc đóng, focus trở lại nút", async ({
    page,
  }) => {
    await page.goto("/learn");
    for (const game of GAMES) {
      const trigger = page.getByRole("button", { name: `Xem chi tiết: ${game.name}` });
      await trigger.click();
      const dialog = page.getByRole("dialog", { name: game.name });
      await expect(dialog).toBeVisible();
      const play = dialog.getByRole("button", { name: /Vào chơi – Sắp có/ });
      await expect(play).toBeDisabled();
      await expect(dialog.getByText(/Trò chơi đang được xây dựng/)).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(dialog).toBeHidden();
      await expect(trigger).toBeFocused();
    }
  });

  test("bàn phím: Tab tới nút Xem chi tiết có vòng focus rõ; Enter mở, nút Đóng đóng", async ({
    page,
    isMobile,
    browserName,
  }) => {
    test.skip(isMobile, "Điều hướng bằng phím dành cho thiết bị có bàn phím.");
    test.skip(browserName === "webkit", "Safari mặc định không đưa nút/liên kết vào thứ tự Tab.");
    await page.goto("/learn");
    const trigger = page.getByRole("button", { name: "Xem chi tiết: Mê cung kho báu" });
    await trigger.focus();
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Tab");
    await expect(trigger).toBeFocused();
    const outline = await trigger.evaluate((element) => getComputedStyle(element).outlineStyle);
    expect(outline).not.toBe("none");
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog", { name: "Mê cung kho báu" });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Đóng" }).press("Enter");
    await expect(dialog).toBeHidden();
  });

  test("công tắc Giảm chuyển động dừng hoạt cảnh; tùy chọn hệ điều hành được tôn trọng", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto("/learn");
    const animated = page.locator(".animate-bob").first();
    await expect(animated).toBeAttached();
    expect(await animated.evaluate((element) => getComputedStyle(element).animationName)).not.toBe("none");
    const toggle = page.getByRole("button", { name: /Giảm chuyển động/ });
    await expect(toggle).toHaveAttribute("aria-pressed", "false");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-pressed", "true");
    expect(await animated.evaluate((element) => getComputedStyle(element).animationName)).toBe("none");

    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/learn");
    await expect(page.getByRole("button", { name: /Giảm chuyển động/ })).toHaveAttribute("aria-pressed", "true");
    expect(
      await page
        .locator(".animate-bob")
        .first()
        .evaluate((element) => getComputedStyle(element).animationName),
    ).toBe("none");
  });

  test("không ghi, không gửi: mở mọi bảng thông tin và bật/tắt công tắc không tạo request ghi, không dùng bộ nhớ trình duyệt", async ({
    page,
  }) => {
    const requests: Array<{ method: string; url: string; body: string | null }> = [];
    page.on("request", (request) =>
      requests.push({ method: request.method(), url: request.url(), body: request.postData() }),
    );
    await page.goto("/learn");
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: /Giảm chuyển động/ }).click();
    for (const game of GAMES) {
      await page.getByRole("button", { name: `Xem chi tiết: ${game.name}` }).click();
      await page.keyboard.press("Escape");
    }
    const origin = new URL(page.url()).origin;
    expect(requests.filter((request) => request.method !== "GET" || request.body !== null)).toEqual([]);
    expect(requests.filter((request) => !request.url.startsWith(origin) && !request.url.startsWith("data:"))).toEqual(
      [],
    );
    const storage = await page.evaluate(() => ({
      local: window.localStorage.length,
      session: window.sessionStorage.length,
      cookie: document.cookie,
    }));
    expect(storage).toEqual({ local: 0, session: 0, cookie: "" });
  });

  test("điện thoại: thanh điều hướng đáy đưa tới bản đồ và thành tích", async ({ page, isMobile, viewport }) => {
    test.skip(!isMobile || (viewport?.width ?? 0) >= 768, "Thanh điều hướng đáy chỉ hiện trên điện thoại (< 768px).");
    await page.goto("/learn");
    const nav = page.getByRole("navigation", { name: "Điều hướng khu vực học sinh" });
    await nav.getByRole("link", { name: "Bản đồ" }).click();
    await expect(page).toHaveURL(/#game-world$/u);
    await expect(page.getByRole("heading", { name: "Bản đồ thế giới phiêu lưu" })).toBeInViewport();
    await nav.getByRole("link", { name: "Thành tích" }).click();
    await expect(page.getByRole("heading", { name: "Thành tích của con" })).toBeInViewport();
    await expect(nav.getByRole("link", { name: "Luyện bài" })).toHaveAttribute("href", "/demo#luyen-tap");
  });
});

test.describe("trợ năng (axe) các trang thiết kế lại", () => {
  test.beforeEach(({ browserName }) => {
    test.slow(browserName === "webkit", "axe trên trang nhiều SVG chạy chậm ở WebKit (Windows, không GPU)");
  });

  for (const path of ["/", "/learn", "/teacher"] as const) {
    test(`${path}: không có lỗi critical/serious`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      expect(await seriousViolations(page)).toEqual([]);
    });
  }

  test("/learn với bảng thông tin đang mở và /demo phần xem trước Game World", async ({ page }) => {
    await page.goto("/learn");
    await page.getByRole("button", { name: "Xem chi tiết: Đảo dấu thanh" }).click();
    await expect(page.getByRole("dialog", { name: "Đảo dấu thanh" })).toBeVisible();
    expect(await seriousViolations(page)).toEqual([]);
    await page.goto("/demo#xem-truoc-game-world");
    await page.getByRole("button", { name: /Giảm chuyển động/ }).click();
    expect(await seriousViolations(page)).toEqual([]);
  });
});

const WIDTHS = [360, 375, 390, 768, 1024, 1440] as const;
const PAGES = [
  { path: "/", slug: "home" },
  { path: "/learn", slug: "learn" },
  { path: "/demo", slug: "demo" },
  { path: "/teacher", slug: "teacher" },
] as const;

test.describe("bố cục ở 6 cỡ màn hình (360 → 1440)", () => {
  test.beforeEach(({ isMobile }, testInfo) => {
    // Viewport đặt tay ở từng test; chạy trên hai trình duyệt desktop để không nhân bản theo mọi cấu hình máy.
    test.skip(isMobile || testInfo.project.name === "webkit-tablet", "Chỉ chạy ở cấu hình desktop.");
  });

  for (const width of WIDTHS) {
    test(`${width}px: không cuộn ngang, chữ không quá nhỏ, nút học sinh ≥ 64px`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: width < 768 ? 800 : 900 });
      for (const target of PAGES) {
        await page.goto(target.path);
        await page.waitForLoadState("networkidle");
        const metrics = await page.evaluate(() => {
          const texts = [
            ...document.querySelectorAll("main p, main li, main h1, main h2, main h3, main button, main a"),
          ]
            .filter((element) => (element as HTMLElement).offsetParent !== null && element.textContent?.trim())
            .map((element) => Number.parseFloat(getComputedStyle(element).fontSize));
          return {
            overflow: document.documentElement.scrollWidth - window.innerWidth,
            minFont: Math.min(...texts),
          };
        });
        expect(metrics.overflow, `${target.path} cuộn ngang ở ${width}px`).toBeLessThanOrEqual(0);
        expect(metrics.minFont, `${target.path} có chữ < 12px ở ${width}px`).toBeGreaterThanOrEqual(12);
        if (target.path === "/learn") {
          for (const button of await page.getByRole("button", { name: /^Xem chi tiết:/u }).all()) {
            expect((await button.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(64);
          }
        }
        if (testInfo.project.name === "chromium-desktop") {
          await page.screenshot({ path: testInfo.outputPath(`${target.slug}-${width}.png`), fullPage: true });
        }
      }
    });
  }
});
