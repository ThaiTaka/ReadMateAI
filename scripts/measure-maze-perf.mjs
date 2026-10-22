/*
 * Đo nguyên mẫu /demo/treasure-maze (R07.1) trên Chromium: nhịp khung hình (requestAnimationFrame), CPU,
 * giảm tốc CPU, JS tải về, số nút DOM, bố cục. Cần máy chủ production đang chạy (npm run build && npm run start).
 * Dùng: node scripts/measure-maze-perf.mjs [baseUrl]. Chỉ in số đo thật; không ước đoán.
 */
import { chromium } from "@playwright/test";
import { gzipSync } from "node:zlib";

const base = process.argv[2] ?? "http://127.0.0.1:3100";
const url = `${base}/demo/treasure-maze`;
const DURATION_MS = 5000;

async function frameStats(page) {
  return page.evaluate(
    (duration) =>
      new Promise((resolve) => {
        const deltas = [];
        let last = performance.now();
        const start = last;
        const tick = (now) => {
          deltas.push(now - last);
          last = now;
          if (now - start < duration) requestAnimationFrame(tick);
          else {
            const sorted = [...deltas].sort((a, b) => a - b);
            const pct = (p) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
            resolve({
              frames: deltas.length,
              fps: +((deltas.length * 1000) / (now - start)).toFixed(1),
              p50Ms: +pct(0.5).toFixed(1),
              p95Ms: +pct(0.95).toFixed(1),
              maxMs: +sorted[sorted.length - 1].toFixed(1),
              slowFramesOver33ms: deltas.filter((d) => d > 33.4).length,
            });
          }
        };
        requestAnimationFrame(tick);
      }),
    DURATION_MS,
  );
}

async function cpuSeconds(client) {
  const { metrics } = await client.send("Performance.getMetrics");
  const get = (name) => metrics.find((m) => m.name === name)?.value ?? 0;
  return {
    task: get("TaskDuration"),
    script: get("ScriptDuration"),
    layout: get("LayoutDuration"),
    style: get("RecalcStyleDuration"),
  };
}

const browser = await chromium.launch();
const report = { url, chromium: browser.version(), runs: [] };

for (const [label, throttle, reduced] of [
  ["bình thường", 1, "no-preference"],
  ["CPU chậm 4x", 4, "no-preference"],
  ["CPU chậm 6x", 6, "no-preference"],
  ["giảm chuyển động (đối chứng)", 1, "reduce"],
]) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: reduced });
  const page = await context.newPage();
  const client = await context.newCDPSession(page);
  await client.send("Performance.enable");
  await page.goto(url, { waitUntil: "networkidle" });
  await client.send("Emulation.setCPUThrottlingRate", { rate: throttle });
  await page.waitForTimeout(500);
  const before = await cpuSeconds(client);
  const frames = await frameStats(page);
  const after = await cpuSeconds(client);
  const seconds = DURATION_MS / 1000;
  report.runs.push({
    label,
    ...frames,
    mainThreadBusyPct: +(((after.task - before.task) / seconds) * 100).toFixed(1),
    scriptPct: +(((after.script - before.script) / seconds) * 100).toFixed(2),
    layoutPct: +(((after.layout - before.layout) / seconds) * 100).toFixed(2),
    stylePct: +(((after.style - before.style) / seconds) * 100).toFixed(2),
  });
  if (throttle === 1 && reduced === "no-preference") {
    const heap = (await client.send("Performance.getMetrics")).metrics.find((m) => m.name === "JSHeapUsedSize")?.value;
    report.jsHeapUsedMB = +(heap / 1048576).toFixed(1);
    report.domNodes = await page.evaluate(() => document.getElementsByTagName("*").length);
    report.svgNodes = await page.evaluate(() => document.querySelectorAll("svg *").length);
    report.runningAnimations = await page.evaluate(
      () => document.getAnimations().filter((a) => a.playState === "running").length,
    );
  }
  await context.close();
}

// JS tải về của route (gzip tự tính từ phản hồi, không dựa vào header)
{
  const context = await browser.newContext();
  const page = await context.newPage();
  const scripts = new Map();
  page.on("response", async (response) => {
    if (response.request().resourceType() === "script") {
      try {
        scripts.set(response.url(), gzipSync(await response.body()).length);
      } catch {}
    }
  });
  await page.goto(url, { waitUntil: "networkidle" });
  report.jsGzipKB = +([...scripts.values()].reduce((a, b) => a + b, 0) / 1024).toFixed(1);
  report.jsFiles = scripts.size;
  report.htmlKB = +((await (await page.request.get(url)).body()).length / 1024).toFixed(1);
  await context.close();
}

// Bố cục theo chiều rộng
report.layout = [];
for (const [name, width, height] of [
  ["360", 360, 740],
  ["390", 390, 844],
  ["tablet 820", 820, 1180],
  ["desktop 1280", 1280, 800],
]) {
  const context = await browser.newContext({ viewport: { width, height } });
  const page = await context.newPage();
  await page.goto(url, { waitUntil: "networkidle" });
  const box = await page.getByTestId("maze-board").boundingBox();
  report.layout.push({
    name,
    boardPx: Math.round(box.width),
    cellPx: +(box.width / 11).toFixed(1),
    horizontalScroll: await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth),
  });
  await context.close();
}

await browser.close();
console.log(JSON.stringify(report, null, 2));
