// Chụp bàn mê cung trên máy tính (toàn bộ bàn). Chạy: node scripts/presentations/capture-board.mjs [cổng]
import { chromium } from "playwright";
const base = `http://localhost:${process.argv[2] ?? "3200"}`;
const out = new URL("./assets/", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: 1440, height: 1500 } })).newPage();
await p.goto(base + "/demo/treasure-maze", { waitUntil: "networkidle" });
await p.addStyleTag({ content: "header{display:none!important}" });
await p.waitForTimeout(800);
for (let i = 0; i < 3; i++) {
  await p.keyboard.press("ArrowDown");
  await p.waitForTimeout(250);
}
await p.keyboard.press("ArrowRight");
await p.waitForTimeout(500);
await p.screenshot({
  path: out + "maze-wide.jpg",
  type: "jpeg",
  quality: 82,
  clip: { x: 160, y: 20, width: 1120, height: 1300 },
});
await b.close();
