import { ROUTES, expect, test } from "./fixtures";

const EMAIL = /[\w.+-]+@[\w-]+\.[a-z]{2,}/i;
const VN_PHONE = /(?:\+84|\b0)(?:3|5|7|8|9)\d{8}\b/;
const SECRET = /sk-ant-[A-Za-z0-9_-]{16,}|sb_secret_[A-Za-z0-9_-]{16,}|eyJ[A-Za-z0-9_-]{10,}\.eyJ/;

test.describe("quyền riêng tư và an toàn", () => {
  for (const route of ROUTES) {
    test(`${route.path}: chỉ tải tài nguyên cùng nguồn và không gửi dữ liệu đi`, async ({ page }) => {
      const requests: { url: string; method: string }[] = [];
      page.on("request", (request) => requests.push({ url: request.url(), method: request.method() }));

      await page.goto(route.path);
      await page.waitForLoadState("networkidle");

      const origin = new URL(page.url()).origin;
      const external = requests.filter(
        (request) => !request.url.startsWith(origin) && !request.url.startsWith("data:"),
      );
      expect(external).toEqual([]);
      expect(requests.filter((request) => request.method !== "GET")).toEqual([]);
    });

    test(`${route.path}: không hiển thị email, số điện thoại hay khóa bí mật`, async ({ page }) => {
      await page.goto(route.path);
      const html = await page.content();
      const text = await page.evaluate(() => document.body.innerText);
      expect(text).not.toMatch(EMAIL);
      expect(text).not.toMatch(VN_PHONE);
      expect(html).not.toMatch(SECRET);
    });
  }

  test("/join không có cách nào gửi mã đi", async ({ page }) => {
    await page.goto("/join");
    await expect(page.locator("form")).toHaveCount(0);
    await expect(page.getByLabel("Mã dự phòng trên thẻ học")).toBeDisabled();
    await expect(page.getByRole("button", { name: /Liên kết thiết bị/ })).toBeDisabled();
  });

  test("/learn không có ô nhập văn bản tự do", async ({ page }) => {
    await page.goto("/learn");
    await expect(page.locator("input, textarea, [contenteditable='true']")).toHaveCount(0);
  });
});
