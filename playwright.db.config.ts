import { defineConfig, devices } from "@playwright/test";

const PORT = 3200;
const BASE_URL = `http://127.0.0.1:${PORT}`;

/**
 * E2E CÓ CƠ SỞ DỮ LIỆU (R03): luồng thật GV đăng nhập → học sinh → thẻ học → thiết bị liên kết → thu hồi.
 * Điều kiện: Supabase local đang chạy (`npm run db:start`), `.env.local` do `npm run db:env` tạo và dữ liệu giả
 * đã nạp (`npm run db:seed`). Bản build production dùng `.env.local` (chỉ trỏ tới Supabase local).
 * Chạy: npm run test:e2e:db
 */
export default defineConfig({
  testDir: "./tests/e2e-db",
  outputDir: "./test-results/db",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report/db" }]],
  globalSetup: "./tests/e2e-db/global-setup.ts",
  globalTeardown: "./tests/e2e-db/global-teardown.ts",
  use: {
    baseURL: BASE_URL,
    locale: "vi-VN",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "chromium-desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "chromium-mobile", use: { ...devices["Pixel 7"] } },
    { name: "webkit-mobile", use: { ...devices["iPhone 13"] } },
    // R05: máy tính bảng — chỉ chạy bảng xếp hạng (bố cục).
    { name: "webkit-ipad", use: { ...devices["iPad (gen 7)"] }, testMatch: /leaderboard.spec.ts/u },
  ],
  webServer: {
    command: `npm run build && npm run start -- --hostname 127.0.0.1 --port ${PORT}`,
    url: BASE_URL,
    timeout: 240_000,
    // Mặc định luôn dựng bản build mới (CI). Đặt E2E_REUSE_SERVER=1 khi đã tự chạy `npm run start` ở cổng 3200 để
    // lặp nhiều lần mà không build lại (dùng khi chẩn đoán lỗi chập chờn).
    reuseExistingServer: process.env.E2E_REUSE_SERVER === "1",
    stdout: "ignore",
    stderr: "pipe",
    env: { NEXT_TELEMETRY_DISABLED: "1", NEXT_PUBLIC_SITE_URL: BASE_URL },
  },
});
