import { ROUTES, expect, test } from "./fixtures";

test.describe("các route nền tảng", () => {
  for (const route of ROUTES) {
    test(`${route.path} trả về 200, có h1 đúng và không có lỗi JavaScript`, async ({ page, pageErrors }, testInfo) => {
      const response = await page.goto(route.path);
      expect(response?.status()).toBe(200);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(route.heading);
      await expect(page).toHaveTitle(/ReadMate AI/);
      await page.waitForLoadState("networkidle");
      expect(pageErrors).toEqual([]);

      // Lưu ảnh chụp toàn trang làm bằng chứng kiểm thử giao diện (test-results/, không commit).
      await page.screenshot({ path: testInfo.outputPath(`${route.slug}.png`), fullPage: true });
    });
  }

  test("đường dẫn không tồn tại trả về trang 404 tiếng Việt", async ({ page, pageErrors }) => {
    const response = await page.goto("/khong-ton-tai");
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Không tìm thấy trang");
    await expect(page.getByRole("link", { name: "Về trang chủ" })).toHaveAttribute("href", "/");
    // Chỉ chấp nhận lỗi "404" của chính tài liệu — không chấp nhận lỗi JavaScript.
    expect(pageErrors.filter((error) => !/404/.test(error))).toEqual([]);
  });
});
