import { ROUTES, SLOGAN, expect, test } from "./fixtures";

test.describe("tiếng Việt có dấu", () => {
  test("thông điệp hiển thị đúng nguyên văn, trang khai báo lang=vi", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("lang", "vi");
    const heading = await page.getByRole("heading", { level: 1 }).textContent();
    expect(heading).toBe(SLOGAN);
    expect(heading).toBe(heading?.normalize("NFC"));
  });

  for (const route of ROUTES) {
    test(`${route.path}: toàn bộ chữ hiển thị ở dạng Unicode NFC`, async ({ page }) => {
      await page.goto(route.path);
      const isNfc = await page.evaluate(() => {
        const text = document.body.innerText;
        return text.length > 0 && text === text.normalize("NFC");
      });
      expect(isNfc).toBe(true);
    });
  }

  test("font giao diện và font học liệu được nạp từ chính máy chủ", async ({ page }) => {
    const fontRequests: string[] = [];
    page.on("request", (request) => {
      if (request.resourceType() === "font") fontRequests.push(request.url());
    });
    await page.goto("/");
    await page.evaluate(() => document.fonts.ready);
    const loadedFamilies = await page.evaluate(() =>
      [...document.fonts].filter((font) => font.status === "loaded").map((font) => font.family),
    );
    expect(loadedFamilies.join(" ")).toMatch(/Be Vietnam Pro/);
    expect(loadedFamilies.join(" ")).toMatch(/Andika/);
    expect(fontRequests.length).toBeGreaterThan(0);
    for (const url of fontRequests) expect(new URL(url).host).toBe(new URL(page.url()).host);
  });
});
