import { ROUTES, expect, test } from "./fixtures";

test.describe("màn hình điện thoại 360px", () => {
  test.use({ viewport: { width: 360, height: 740 } });

  for (const route of ROUTES) {
    test(`${route.path} không bị cuộn ngang`, async ({ page }, testInfo) => {
      await page.goto(route.path);
      await page.waitForLoadState("networkidle");
      const overflow = await page.evaluate(() => ({
        documentWidth: document.documentElement.scrollWidth,
        bodyWidth: document.body.scrollWidth,
        viewportWidth: window.innerWidth,
      }));
      expect(overflow.documentWidth).toBeLessThanOrEqual(overflow.viewportWidth);
      expect(overflow.bodyWidth).toBeLessThanOrEqual(overflow.viewportWidth);
      await page.screenshot({ path: testInfo.outputPath(`${route.slug}-360.png`), fullPage: true });
    });
  }

  test("vùng chạm ở khu vực học sinh cao tối thiểu 64px", async ({ page }) => {
    await page.goto("/learn");
    const bottomNavLinks = page.getByRole("navigation", { name: "Điều hướng khu vực học sinh" }).getByRole("link");
    await expect(bottomNavLinks).toHaveCount(3);
    for (const link of await bottomNavLinks.all()) {
      const box = await link.boundingBox();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(64);
    }
    // R02: nút chính của trang học sinh và nút "Xem chi tiết" trên thẻ khu vực đều ≥ 64px.
    for (const name of [/Luyện bài/, /Khám phá Game World/]) {
      const box = await page.getByRole("main").getByRole("link", { name }).boundingBox();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(64);
    }
    for (const button of await page.getByRole("button", { name: /^Xem chi tiết:/u }).all()) {
      const box = await button.boundingBox();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(64);
    }
  });
});
