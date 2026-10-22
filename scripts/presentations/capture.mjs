// Chụp ảnh giao diện bản demo (dữ liệu minh họa hư cấu) cho bài trình chiếu. Chạy: node scripts/presentations/capture.mjs [cổng]
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const port = process.argv[2] ?? "3200";
const base = `http://localhost:${port}`;
const out = new URL("./assets/", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
const desktop = await browser.newContext({ viewport: { width: 1440, height: 810 }, deviceScaleFactor: 1 });
const mobile = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
});

async function shot(ctx, path, name, opts = {}) {
  const page = await ctx.newPage();
  await page.goto(base + path, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  if (opts.scrollTo) {
    await page.locator(opts.scrollTo).first().scrollIntoViewIfNeeded();
    await page.evaluate((s) => document.querySelector(s)?.scrollIntoView({ block: "start" }), opts.scrollTo);
    await page.waitForTimeout(500);
  }
  if (opts.click) {
    await page.locator(opts.click).first().click();
    await page.waitForTimeout(600);
  }
  await page.screenshot({ path: out + name + ".jpg", type: "jpeg", quality: 82, fullPage: opts.full ?? false });
  await page.close();
  console.log("ok", name);
}

await shot(desktop, "/", "home");
await shot(desktop, "/learn", "learn");
await shot(desktop, "/learn", "learn-full", { full: true });
await shot(desktop, "/demo", "demo-top");
await shot(desktop, "/demo", "demo-world", { scrollTo: "#xem-truoc-game-world" });
await shot(desktop, "/demo", "demo-full", { full: true });
await shot(desktop, "/demo/treasure-maze", "maze-desktop");
await shot(mobile, "/demo/treasure-maze", "maze-mobile");
await shot(mobile, "/demo", "demo-mobile");
await shot(mobile, "/demo", "practice-mobile", { scrollTo: "#luyen-tap" });
await shot(mobile, "/learn", "learn-mobile");
await browser.close();
