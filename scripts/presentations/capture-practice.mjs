// Chụp các bước làm bài trên điện thoại ở /demo (dữ liệu minh họa). Chạy: node scripts/presentations/capture-practice.mjs [cổng]
import { chromium } from "playwright";

const base = `http://localhost:${process.argv[2] ?? "3200"}`;
const out = new URL("./assets/", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const b = await chromium.launch();
const ctx = await b.newContext({
  viewport: { width: 390, height: 780 },
  isMobile: true,
  hasTouch: true,
  deviceScaleFactor: 2,
});

async function open() {
  const p = await ctx.newPage();
  await p.goto(base + "/demo", { waitUntil: "networkidle" });
  await p.addStyleTag({ content: "header{display:none!important} nextjs-portal{display:none!important}" });
  await p.waitForTimeout(500);
  await p.locator("#luyen-tap button").nth(1).click();
  await p.getByRole("button", { name: "Bắt đầu buổi luyện" }).click();
  await p.getByRole("button", { name: /^Bắt đầu/ }).click();
  await p.waitForTimeout(600);
  await p.evaluate(() => {
    const el = [...document.querySelectorAll("#luyen-tap *")].find((e) => e.textContent.trim() === "Câu 1 / 7");
    window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 30);
  });
  await p.waitForTimeout(300);
  return p;
}
const snap = (p, n) => p.screenshot({ path: out + n + ".jpg", type: "jpeg", quality: 82 });

let p = await open();
await snap(p, "ex-1-question");
await p.getByRole("button", { name: "ang", exact: true }).click();
await p.waitForTimeout(400);
await snap(p, "ex-2-selected");
await p.getByRole("button", { name: /Kiểm tra/ }).click();
await p.waitForTimeout(700);
await snap(p, "ex-3-correct");
await p.close();

p = await open();
await p.getByRole("button", { name: "an", exact: true }).click();
await p.getByRole("button", { name: /Kiểm tra/ }).click();
await p.waitForTimeout(700);
await snap(p, "ex-4-wrong");
await b.close();
