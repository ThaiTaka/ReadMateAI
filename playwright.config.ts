import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
const BASE_URL = `http://127.0.0.1:${PORT}`;

/**
 * E2E chạy trên bản production vừa build (khuyến nghị của tài liệu Next.js) để kiểm tra đúng
 * hành vi thật: trang tĩnh, header bảo mật, CSP. Chạy bằng: npm run test:e2e
 */
export default defineConfig({
  testDir: "./tests/e2e",
  outputDir: "./test-results",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  use: {
    baseURL: BASE_URL,
    locale: "vi-VN",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "chromium-desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "chromium-mobile", use: { ...devices["Pixel 7"] } },
    { name: "webkit-desktop", use: { ...devices["Desktop Safari"] } },
    { name: "webkit-mobile", use: { ...devices["iPhone 13"] } },
    // Máy tính bảng (TASKS 4.8, R02): chỉ chạy các spec của bản chơi thử, Game World và bố cục, để không nhân đôi thời gian E2E.
    {
      name: "webkit-tablet",
      use: { ...devices["iPad (gen 7)"] },
      testMatch: /(demo-practice|responsive|game-world|treasure-maze-demo)\.spec\.ts/,
    },
  ],
  webServer: {
    command: `npm run build && npm run start -- --hostname 127.0.0.1 --port ${PORT}`,
    url: BASE_URL,
    timeout: 240_000,
    // Mặc định luôn dựng bản build mới (CI). E2E_REUSE_SERVER=1: dùng máy chủ đã tự chạy ở cổng 3100 để lặp không build lại.
    reuseExistingServer: process.env.E2E_REUSE_SERVER === "1",
    stdout: "ignore",
    stderr: "pipe",
    env: { NEXT_TELEMETRY_DISABLED: "1" },
  },
});
