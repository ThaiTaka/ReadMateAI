import { ROUTES, expect, test } from "./fixtures";

/** Header được kiểm tra trên bản production (next start) mà Playwright khởi chạy. */
test.describe("header bảo mật trong production", () => {
  test.beforeEach(({ browserName, isMobile }) => {
    test.skip(browserName !== "chromium" || isMobile, "Kiểm tra ở tầng HTTP — chạy một lần là đủ.");
  });

  for (const route of ROUTES) {
    test(`${route.path} trả về đủ header bảo mật`, async ({ request }) => {
      const response = await request.get(route.path);
      expect(response.status()).toBe(200);
      const headers = response.headers();

      const csp = headers["content-security-policy"] ?? "";
      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain("frame-ancestors 'none'");
      expect(csp).toContain("object-src 'none'");
      expect(csp).not.toContain("'unsafe-eval'");

      expect(headers["x-content-type-options"]).toBe("nosniff");
      expect(headers["x-frame-options"]).toBe("DENY");
      expect(headers["permissions-policy"]).toContain("camera=()");
      expect(headers["permissions-policy"]).toContain("microphone=()");
      expect(headers["permissions-policy"]).toContain("geolocation=()");
      expect(headers["referrer-policy"]).toBe(
        route.path === "/join" ? "no-referrer" : "strict-origin-when-cross-origin",
      );
      expect(headers["x-powered-by"]).toBeUndefined();
    });
  }

  test("tài nguyên tĩnh cũng có header bảo mật", async ({ request }) => {
    const response = await request.get("/icon.svg");
    expect(response.status()).toBe(200);
    expect(response.headers()["x-content-type-options"]).toBe("nosniff");
    expect(response.headers()["content-security-policy"]).toContain("default-src 'self'");
  });
});
