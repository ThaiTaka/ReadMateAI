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

  // R03: /join nhận mã thật. Luồng thành công có CSDL nằm ở tests/e2e-db; ở đây kiểm cách mã được gửi.
  test("/join gửi mã qua POST (Server Action) — mã không nằm trong URL, không lưu ở bộ nhớ trình duyệt", async ({
    page,
  }) => {
    const urls: string[] = [];
    page.on("request", (request) => urls.push(request.url()));
    await page.goto("/join");
    await expect(page.locator("form")).toHaveCount(1);
    await page.getByLabel("Mã dự phòng trên thẻ học").fill("ZZZZ-9999");
    await page.getByRole("button", { name: /Liên kết thiết bị/ }).click();
    // Có hay không có máy chủ dữ liệu, kết quả đều là một thông báo chung, không chi tiết kỹ thuật.
    await expect(
      page.getByRole("alert").filter({ hasText: /Mã chưa đúng|chưa được cấu hình|quá nhiều lần/u }),
    ).toBeVisible();
    expect(urls.some((url) => url.includes("ZZZZ"))).toBe(false);
    expect(await page.evaluate(() => localStorage.length + sessionStorage.length)).toBe(0);
  });

  test("/join đọc mã QR ở fragment rồi xóa khỏi thanh địa chỉ, không gửi mã trong URL", async ({ page }) => {
    const urls: string[] = [];
    page.on("request", (request) => urls.push(request.url()));
    const token = "Q".repeat(43);
    await page.goto(`/join#c=${token}`);
    await expect(page.getByRole("alert").filter({ hasText: /Mã QR|chưa được cấu hình|quá nhiều lần/u })).toBeVisible();
    expect(page.url()).not.toContain(token);
    expect(urls.some((url) => url.includes(token))).toBe(false);
  });

  test("/learn không có ô nhập văn bản tự do", async ({ page }) => {
    await page.goto("/learn");
    await expect(page.locator("input, textarea, [contenteditable='true']")).toHaveCount(0);
  });
});
