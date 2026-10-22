// Chụp Mê cung trên điện thoại (có 4 nút mũi tên) và sau khi đi vài bước. Chạy: node scripts/presentations/capture-maze.mjs [cổng]
import { chromium } from "playwright";
const base = `http://localhost:${process.argv[2] ?? "3200"}`;
const out = new URL("./assets/", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const b = await chromium.launch();
const ctx = await b.newContext({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  deviceScaleFactor: 2,
});
const p = await ctx.newPage();
await p.goto(base + "/demo/treasure-maze", { waitUntil: "networkidle" });
await p.addStyleTag({ content: "header{display:none!important} nextjs-portal{display:none!important}" });
await p.waitForTimeout(600);
await p.evaluate(() => window.scrollTo(0, 260));
await p.waitForTimeout(300);
await p.screenshot({ path: out + "maze-mobile-pad.jpg", type: "jpeg", quality: 82 });
console.log(
  (await p.locator("button").allInnerTexts()).map((t) => t.slice(0, 30)),
  await p.locator("button[aria-label]").evaluateAll((e) => e.map((x) => x.ariaLabel)),
);
await b.close();
