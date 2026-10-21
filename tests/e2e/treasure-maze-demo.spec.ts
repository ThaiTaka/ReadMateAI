import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "./fixtures";

/** R07.1 — nguyên mẫu đồ họa /demo/treasure-maze: nhãn thử nghiệm, bố cục không cuộn ngang, trợ năng, giảm chuyển động. */

test.describe("/demo/treasure-maze (nguyên mẫu, dữ liệu minh họa)", () => {
  test("có nhãn thử nghiệm, bảng vuông hiển thị đủ, không lỗi JS, không cuộn ngang", async ({ page, pageErrors }) => {
    await page.goto("/demo/treasure-maze");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Mê cung kho báu");
    await expect(page.getByRole("note")).toContainText(/Bản thử nghiệm – Dữ liệu minh họa/iu);
    const board = page.getByTestId("maze-board");
    await expect(board).toBeVisible();
    const box = (await board.boundingBox())!;
    const viewport = page.viewportSize()!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
    expect(
      Math.abs(box.width - (await page.getByTestId("maze-board").locator("> div").boundingBox())!.width),
    ).toBeLessThan(2);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await expect(page.getByRole("img", { name: "Bạn nhỏ thám hiểm" })).toBeVisible();
    await expect(page.getByRole("img", { name: "Rương kho báu" })).toBeVisible();
    expect(pageErrors).toEqual([]);
  });

  test("không có biểu mẫu, nút điều khiển hay liên kết ra ngoài (chưa có game thật)", async ({ page }) => {
    await page.goto("/demo/treasure-maze");
    await expect(page.locator("main form")).toHaveCount(0);
    await expect(page.locator("main a[href^='http']")).toHaveCount(0);
  });

  test("axe: không vi phạm nghiêm trọng", async ({ page }) => {
    await page.goto("/demo/treasure-maze");
    const results = await new AxeBuilder({ page }).analyze();
    const serious = results.violations.filter((v) => v.impact === "critical" || v.impact === "serious");
    expect(serious.map((v) => v.id)).toEqual([]);
  });

  test("giảm chuyển động (hệ điều hành) và công tắc trong trang đều dừng mọi hoạt cảnh", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/demo/treasure-maze");
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

    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.reload();
    await expect(page.locator("[data-motion]").first()).toHaveAttribute("data-motion", "full");
    expect(await running()).toBeGreaterThan(0);
    await page.getByRole("button", { name: /Giảm chuyển động/u }).click();
    await expect(page.locator("[data-motion]").first()).toHaveAttribute("data-motion", "reduce");
    expect(await running()).toBe(0);
  });
});
