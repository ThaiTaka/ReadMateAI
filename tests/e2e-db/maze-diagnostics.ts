import { expect, type Locator, type Page, type Request, type TestInfo } from "@playwright/test";

/**
 * Chẩn đoán khi màn Mê cung không mở. Trên CI, WebKit mobile đôi khi kẹt ở "Đang mở mê cung…" (trace: sau tài liệu không có
 * yêu cầu API nào, kể cả POST bắt đầu lượt) mà không có lỗi nào — kể cả sau khi tải lại. Khi đó báo cáo phải nói được:
 * React đã khởi động/hydrate chưa, có yêu cầu nào (chunk, RSC) đã phát mà chưa kết thúc không, API nào đã được gọi và trả gì.
 */

export type Watch = { lines: string[]; pending: () => string[] };

export function watchPage(page: Page): Watch {
  const lines: string[] = [];
  const path = (url: string) => new URL(url).pathname;
  // Yêu cầu đã phát mà chưa kết thúc/thất bại: một chunk hay RSC bị treo sẽ chặn hydrate mà không có lỗi nào.
  const pending = new Map<Request, string>();
  page.on("request", (request) => {
    pending.set(request, `${request.method()} ${path(request.url())}`);
    if (path(request.url()).startsWith("/api/student/"))
      lines.push(`request: ${request.method()} ${path(request.url())}`);
  });
  page.on("requestfinished", (request) => pending.delete(request));
  page.on("requestfailed", (request) => {
    pending.delete(request);
    lines.push(`requestfailed: ${request.method()} ${path(request.url())} ${request.failure()?.errorText ?? ""}`);
  });
  page.on("response", (response) => {
    if (path(response.url()).startsWith("/api/student/")) {
      lines.push(`response ${response.status()}: ${response.request().method()} ${path(response.url())}`);
    }
  });
  page.on("console", (message) => lines.push(`console.${message.type()}: ${message.text().slice(0, 300)}`));
  page.on("pageerror", (error) => lines.push(`pageerror: ${error.message.slice(0, 300)}`));
  page.on("crash", () => lines.push("page crash"));
  return { lines, pending: () => [...pending.values()] };
}

/** Chờ `locator` hiện; nếu không, ném lỗi kèm báo cáo chẩn đoán (và đính kèm vào kết quả kiểm thử). */
export async function expectVisibleOrExplain(
  page: Page,
  locator: Locator,
  watch: Watch,
  testInfo: TestInfo,
  timeout: number,
) {
  try {
    await expect(locator).toBeVisible({ timeout });
  } catch (error) {
    const state = await page
      .evaluate(() => {
        const loading = document.querySelector('[data-testid="maze-loading"]');
        const hydratedKey = (el: Element) => Object.keys(el).some((key) => key.startsWith("__react"));
        const markers: Record<string, number> = {};
        const walker = document.createTreeWalker(document, NodeFilter.SHOW_COMMENT);
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
          const text = (node as Comment).data;
          if (text === "$" || text === "$?" || text === "$!") markers[text] = (markers[text] ?? 0) + 1;
        }
        return {
          readyState: document.readyState,
          visibility: document.visibilityState,
          online: navigator.onLine,
          loadingShown: loading !== null,
          loadingHydrated: loading ? hydratedKey(loading) : null,
          shellHydrated: Array.from(document.querySelectorAll("button, a")).some(hydratedKey),
          nextBootstrapped: typeof (window as unknown as { next?: unknown }).next !== "undefined",
          flightChunks: (self as unknown as { __next_f?: unknown[] }).__next_f?.length ?? null,
          suspenseMarkers: markers,
          scriptResources: performance.getEntriesByType("resource").filter((entry) => entry.name.endsWith(".js"))
            .length,
        };
      })
      .catch(() => ({ unavailable: true }));
    const report = [
      `url: ${new URL(page.url()).pathname}`,
      `state: ${JSON.stringify(state)}`,
      `pending requests: ${JSON.stringify(watch.pending().slice(0, 20))}`,
      ...watch.lines.slice(-60),
    ].join("\n");
    await testInfo.attach("maze-open-diagnostics", { body: report, contentType: "text/plain" });
    throw new Error(`${(error as Error).message}\n--- chẩn đoán mở mê cung ---\n${report}`);
  }
}
