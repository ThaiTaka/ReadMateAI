import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { buildDemoPracticeData, type DemoActivity } from "../../src/features/demo/practice-data.ts";
import type { ExerciseItem } from "../../src/features/exercises/items.ts";
import { runtimeOf } from "../../src/features/exercises/runtime-registry.ts";
import { expect, test } from "./fixtures";

/**
 * E2E bản chơi thử (GĐ4). Đáp án lấy từ chính bộ sinh: dữ liệu tái lập được nhờ seed, trùng với dữ liệu đã
 * build vào trang tĩnh. Mọi thao tác đi qua giao diện như người dùng thật (chạm/bấm, bàn phím).
 */

const data = buildDemoPracticeData();
const pathOf = (id: string) => {
  const path = data.paths.find((entry) => entry.id === id);
  if (!path) throw new Error(`thiếu lộ trình ${id}`);
  return path;
};
const PATH_NAMES = { "khoi-dong": "Khởi động", "vung-buoc": "Vững bước", "tang-toc": "Tăng tốc" } as const;

async function openPath(page: Page, id: keyof typeof PATH_NAMES) {
  await page.goto("/demo");
  await page
    .getByRole("button", { name: new RegExp(PATH_NAMES[id]) })
    .first()
    .click();
  await expect(page.getByRole("heading", { level: 3, name: PATH_NAMES[id] })).toBeVisible();
}

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");

/** Trả lời một câu qua giao diện: đúng (theo đáp án của bộ máy) hoặc cố ý sai. */
async function answer(page: Page, item: ExerciseItem, mode: "correct" | "wrong" | "wrong-last" = "correct") {
  const response = runtimeOf(item).correctResponse(item);
  const optionGroup = page.getByRole("group", { name: /để chọn$/u });
  switch (response.kind) {
    case "choice": {
      if (!("options" in item.content)) throw new Error("thiếu phương án");
      const options: ReadonlyArray<{ id: string; text?: string; picture?: unknown }> = item.content.options;
      const index =
        mode === "correct"
          ? options.findIndex((option) => option.id === response.optionId)
          : mode === "wrong"
            ? options.findIndex((option) => option.id !== response.optionId)
            : options.findLastIndex((option) => option.id !== response.optionId);
      const option = options[index];
      if (!option) throw new Error("không tìm thấy phương án");
      if (option.text !== undefined) {
        // Sau khi chấm, tên của thẻ đã chọn có thêm ", chưa đúng" (đọc cho trình đọc màn hình).
        const name = new RegExp(`^${escape(option.text)}\\s*(,|$)`, "u");
        await optionGroup.getByRole("button", { name }).click();
      } else {
        await optionGroup.getByRole("button", { name: `Hình ${index + 1}`, exact: true }).click();
      }
      return;
    }
    case "multi": {
      if (item.variant !== "find_with_unit") throw new Error("sai biến thể");
      for (const id of response.optionIds) {
        const text = item.content.options.find((option) => option.id === id)?.text ?? "";
        await optionGroup.getByRole("button", { name: text, exact: true }).click();
      }
      return;
    }
    case "build": {
      if (item.variant !== "picture_build") throw new Error("sai biến thể");
      const { onsets, rimes, tones } = item.content.tiles;
      const text = (tiles: ReadonlyArray<{ id: string; text: string }>, id: string | null) =>
        tiles.find((tile) => tile.id === id)?.text ?? "";
      await page
        .getByRole("group", { name: "Âm đầu" })
        .getByRole("button", { name: text(onsets, response.onset), exact: true })
        .click();
      await page
        .getByRole("group", { name: "Vần" })
        .getByRole("button", { name: text(rimes, response.rime), exact: true })
        .click();
      await page
        .getByRole("group", { name: "Dấu thanh" })
        .getByRole("button", { name: text(tones, response.tone), exact: true })
        .click();
      return;
    }
    case "match": {
      if (item.variant !== "match_pairs") throw new Error("sai biến thể");
      for (const [wordId, pictureId] of Object.entries(response.pairs)) {
        const word = item.content.words.find((entry) => entry.id === wordId)?.text ?? "";
        const pictureIndex = item.content.pictures.findIndex((entry) => entry.id === pictureId);
        await page
          .getByRole("group", { name: "Từ" })
          .getByRole("button", { name: new RegExp(`${escape(word)}$`, "u") })
          .click();
        await page
          .getByRole("group", { name: "Hình", exact: true })
          .getByRole("button", { name: new RegExp(`^Hình ${pictureIndex + 1}(,|$)`, "u") })
          .click();
      }
      return;
    }
    case "order": {
      if (item.variant !== "arrange_words") throw new Error("sai biến thể");
      const ids = mode === "correct" ? response.tokenIds : [...response.tokenIds].reverse();
      for (const id of ids) {
        const text = item.content.tokens.find((token) => token.id === id)?.text ?? "";
        await page.getByRole("group", { name: "Các từ" }).getByRole("button", { name: text, exact: true }).click();
      }
    }
  }
}

async function check(page: Page) {
  await page.getByRole("button", { name: /Kiểm tra/ }).click();
}

async function proceed(page: Page) {
  const next = page.getByRole("button", { name: /Câu tiếp/ });
  if (await next.isVisible()) await next.click();
  else await page.getByRole("button", { name: /Xem kết quả/ }).click();
}

async function runActivity(page: Page, activity: DemoActivity) {
  await page.getByRole("button", { name: `Làm thử: ${activity.title}` }).click();
  await page.getByRole("button", { name: /^Bắt đầu$/u }).click();
  for (const item of activity.items) {
    await answer(page, item);
    await check(page);
    await expect(page.getByRole("status").last()).toContainText(/Đúng rồi!|Con làm tốt lắm!|Chính xác!/u);
    await proceed(page);
  }
  await expect(page.getByRole("heading", { name: "Con đã hoàn thành buổi luyện!" })).toBeVisible();
}

test.describe("bản chơi thử /demo — luyện tập tương tác", () => {
  // WebKit của Playwright trên Windows vẽ bằng CPU (không tăng tốc GPU): luồng nhiều câu chạy chậm gấp ~2 lần
  // Chromium (đo ở R02: 25–32 s) → nới thời gian chờ cho WebKit, không bỏ bước kiểm tra nào.
  test.beforeEach(({ browserName }) => {
    test.slow(browserName === "webkit", "WebKit trên Windows không tăng tốc GPU");
  });

  for (const id of ["khoi-dong", "vung-buoc", "tang-toc"] as const) {
    test(`lộ trình ${PATH_NAMES[id]}: buổi luyện mẫu chạy trọn vẹn tới màn kết quả`, async ({ page, pageErrors }) => {
      await openPath(page, id);
      await page.getByRole("button", { name: /Bắt đầu buổi luyện/ }).click();
      for (const block of pathOf(id).session) {
        await expect(page.getByRole("heading", { level: 3, name: block.title })).toBeVisible();
        await page.getByRole("button", { name: /^Bắt đầu$/u }).click();
        for (const item of block.items) {
          await answer(page, item);
          await check(page);
          await expect(page.getByRole("status").last()).toContainText(/Đúng rồi!|Con làm tốt lắm!|Chính xác!/u);
          await proceed(page);
        }
      }
      await expect(page.getByRole("heading", { name: "Con đã hoàn thành buổi luyện!" })).toBeVisible();
      const total = pathOf(id).session.reduce((sum, block) => sum + block.items.length, 0);
      await expect(page.getByText("Số câu đã làm xong").locator("xpath=following-sibling::dd")).toHaveText(
        `${total} / ${total}`,
      );
      // R02 (AD-51): không còn chỉ số "ghi nhận ở lớp" hay phiếu tương đương; có lời nhắc điểm minh họa + về Game World.
      await expect(page.getByText(/ở lớp|phiếu/u)).toHaveCount(0);
      await expect(page.getByRole("complementary", { name: "Điểm thưởng ở bản chính thức" })).toContainText(
        "không tính và không lưu điểm",
      );
      await expect(page.getByRole("link", { name: /Về Game World/ }).first()).toHaveAttribute(
        "href",
        "/learn#game-world",
      );
      expect(pageErrors).toEqual([]);
    });
  }

  test("sáu dạng bài đều thao tác và chấm được (lộ trình Vững bước, một biến thể mỗi dạng)", async ({
    page,
    pageErrors,
    isMobile,
  }) => {
    test.skip(isMobile, "Đủ sáu dạng chạy trên desktop; điện thoại đã chạy buổi luyện mẫu của ba lộ trình.");
    test.setTimeout(120_000);
    const path = pathOf("vung-buoc");
    const picks = [
      "letter_sound",
      "build_syllable",
      "identify_unit",
      "fill_blank",
      "word_picture",
      "sentence_reading",
    ].map((type) => path.activities.find((activity) => activity.type === type && activity.status === "ready"));
    for (const activity of picks) {
      if (!activity) throw new Error("thiếu dạng bài");
      await openPath(page, "vung-buoc");
      await runActivity(page, activity);
    }
    expect(pageErrors).toEqual([]);
  });

  test("Kiểm tra bị khóa khi chưa chọn; sai → Thử lại → đúng; điều hướng câu trước/câu tiếp/chấm tiến độ", async ({
    page,
  }) => {
    await openPath(page, "vung-buoc");
    const activity = pathOf("vung-buoc").activities.find((entry) => entry.variant === "missing_onset");
    if (!activity) throw new Error("thiếu bài");
    await page.getByRole("button", { name: `Làm thử: ${activity.title}` }).click();
    await page.getByRole("button", { name: /^Bắt đầu$/u }).click();
    const [first, second] = activity.items;
    if (!first || !second) throw new Error("thiếu câu");

    await expect(page.getByRole("button", { name: /Kiểm tra/ })).toBeDisabled();
    await answer(page, first, "wrong");
    await check(page);
    await expect(page.getByRole("status").last()).toContainText("Chưa đúng rồi");
    await expect(page.getByRole("button", { name: /Kiểm tra/ })).toBeDisabled();
    await page.getByRole("button", { name: /Thử lại/ }).click();
    await answer(page, first);
    await check(page);
    await expect(page.getByRole("status").last()).toContainText(/Đúng rồi!|Con làm tốt lắm!|Chính xác!/u);

    await page.getByRole("button", { name: /Câu tiếp/ }).click();
    await expect(page.getByText("Câu 2 / 4", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: /Câu trước/ }).click();
    await expect(page.getByText("Câu 1 / 4", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: /Câu 2/ }).click();
    await expect(page.getByText("Câu 2 / 4", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Câu 4$/u })).toBeDisabled();
  });

  test("H3: hết 3 lượt thì hiện đáp án; có phần Cô làm mẫu trước khi bắt đầu", async ({ page }) => {
    await openPath(page, "khoi-dong");
    const activity = pathOf("khoi-dong").activities.find((entry) => entry.variant === "picture_onset");
    if (!activity?.items[0]) throw new Error("thiếu bài");
    await page.getByRole("button", { name: `Làm thử: ${activity.title}` }).click();
    await expect(page.getByRole("region", { name: "Cô làm mẫu" })).toBeVisible();
    await page.getByRole("button", { name: /^Bắt đầu$/u }).click();
    // Chọn phương án sai cuối cùng: gợi ý H3 (tự hiện sau lần sai) chỉ loại bớt phương án sai đầu tiên.
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await answer(page, activity.items[0], "wrong-last");
      await check(page);
    }
    const status = page.getByRole("status").last();
    await expect(status).toContainText("Mình cùng xem đáp án nhé");
    await expect(page.getByRole("button", { name: /Câu tiếp/ })).toBeVisible();
  });

  test("bàn phím: chọn phương án và bấm Kiểm tra không cần chuột", async ({ page, isMobile }) => {
    test.skip(isMobile, "Thao tác bàn phím dành cho thiết bị có bàn phím.");
    await openPath(page, "vung-buoc");
    const activity = pathOf("vung-buoc").activities.find((entry) => entry.variant === "which_tone");
    const item = activity?.items[0];
    if (!activity || !item || item.variant !== "which_tone") throw new Error("thiếu bài");
    await page.getByRole("button", { name: `Làm thử: ${activity.title}` }).focus();
    await page.keyboard.press("Enter");
    await page.getByRole("button", { name: /^Bắt đầu$/u }).focus();
    await page.keyboard.press("Enter");
    const text = item.content.options.find((option) => option.id === item.answer.optionId)?.text ?? "";
    const option = page.getByRole("group", { name: /để chọn$/u }).getByRole("button", { name: text, exact: true });
    await option.focus();
    await page.keyboard.press("Space");
    await expect(option).toHaveAttribute("aria-pressed", "true");
    const checkButton = page.getByRole("button", { name: /Kiểm tra/ });
    await checkButton.focus();
    await expect(checkButton).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("status").last()).toContainText(/Đúng rồi!|Con làm tốt lắm!|Chính xác!/u);
  });

  test("bài đọc từ và đọc câu: không có nút nghe từ/câu; tranh có nhãn trung tính; không có thẻ audio", async ({
    page,
  }) => {
    await openPath(page, "tang-toc");
    for (const variant of ["choose_picture", "sentence_picture"] as const) {
      const activity = pathOf("tang-toc").activities.find((entry) => entry.variant === variant);
      const item = activity?.items[0];
      if (!activity || !item) throw new Error("thiếu bài");
      await page.getByRole("button", { name: `Làm thử: ${activity.title}` }).click();
      await page.getByRole("button", { name: /^Bắt đầu$/u }).click();
      await expect(page.getByText(/Nghe từ|Nghe câu:/u)).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Hình 1", exact: true })).toBeVisible();
      await answer(page, item);
      await check(page);
      // Sau khi chấm: tên tranh mới hiện.
      await expect(page.getByRole("button", { name: /^Hình: /u }).first()).toBeVisible();
      await page.getByRole("button", { name: /Thoát bài/ }).click();
    }
    await expect(page.locator("audio, video")).toHaveCount(0);
  });

  test("nút âm thanh đều bị khóa và ghi 'Chưa có âm thanh'; bài nghe âm chỉ xem được giao diện", async ({ page }) => {
    await openPath(page, "khoi-dong");
    const activity = pathOf("khoi-dong").activities.find((entry) => entry.variant === "listen_letter");
    if (!activity) throw new Error("thiếu bài");
    await page.getByRole("button", { name: `Làm thử: ${activity.title}` }).click();
    await expect(
      page.getByRole("note").filter({ hasText: "chưa có nên chỉ xem được giao diện" }).first(),
    ).toBeVisible();
    await page.getByRole("button", { name: /^Bắt đầu$/u }).click();
    const audio = page.getByRole("button", { name: /Chưa có âm thanh/ });
    expect(await audio.count()).toBeGreaterThan(0);
    for (const button of await audio.all()) await expect(button).toBeDisabled();
    // Vẫn chọn được phương án (xem cơ chế), nhưng không kiểm tra được vì thiếu âm thanh bắt buộc.
    const first = page
      .getByRole("group", { name: /để chọn$/u })
      .getByRole("button")
      .first();
    await first.click();
    await expect(first).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("button", { name: /Kiểm tra/ })).toBeDisabled();
    await expect(page.getByRole("button", { name: /Câu tiếp/ })).toBeVisible();
  });

  test("không gửi dữ liệu: cả buổi luyện không có request ghi, không có tài nguyên ngoài, không tải âm thanh", async ({
    page,
  }) => {
    const requests: Array<{ url: string; method: string; type: string; body: string | null }> = [];
    page.on("request", (request) =>
      requests.push({
        url: request.url(),
        method: request.method(),
        type: request.resourceType(),
        body: request.postData(),
      }),
    );
    await openPath(page, "tang-toc");
    const before = requests.length;
    await page.getByRole("button", { name: /Bắt đầu buổi luyện/ }).click();
    for (const block of pathOf("tang-toc").session) {
      await page.getByRole("button", { name: /^Bắt đầu$/u }).click();
      for (const item of block.items) {
        await answer(page, item);
        await check(page);
        await proceed(page);
      }
    }
    await expect(page.getByRole("heading", { name: "Con đã hoàn thành buổi luyện!" })).toBeVisible();
    const origin = new URL(page.url()).origin;
    expect(requests.filter((request) => request.method !== "GET")).toEqual([]);
    expect(requests.filter((request) => !request.url.startsWith(origin) && !request.url.startsWith("data:"))).toEqual(
      [],
    );
    expect(requests.filter((request) => request.type === "media")).toEqual([]);
    expect(requests.filter((request) => request.body !== null)).toEqual([]);
    // Làm bài hoàn toàn trong trình duyệt. Sau khi trang tải, chỉ được phép có request GET không có dữ liệu do
    // Next.js tự tải trước các trang được liên kết (prefetch) — không request nào chứa câu trả lời hay kết quả.
    // R03: prefetch /teacher của khách bị proxy chuyển sang /login (GET, không dữ liệu).
    // R07/R08: /demo có liên kết tới bản xem trước mê cung (/demo/treasure-maze), nên Next cũng tải trước trang đó khi liên kết vào khung nhìn
    // (GET, chỉ ?_rsc, không dữ liệu) — lúc có lúc không tùy thời điểm cuộn, nên trước đây test chập chờn.
    const appPaths = new Set(["/", "/demo", "/demo/treasure-maze", "/learn", "/teacher", "/join", "/login"]);
    const later = requests.slice(before).filter((request) => request.type === "fetch" || request.type === "xhr");
    expect(
      later.filter((request) => {
        const url = new URL(request.url);
        // Chuyển hướng /teacher → /login chỉ mang lý do + đường quay lại (không có dữ liệu bài làm).
        const allowed = url.pathname === "/login" ? ["_rsc", "reason", "next"] : ["_rsc"];
        const onlyRscParam = [...url.searchParams.keys()].every((key) => allowed.includes(key));
        return !(appPaths.has(url.pathname) || url.pathname.startsWith("/_next/")) || !onlyRscParam;
      }),
    ).toEqual([]);
    const storage = await page.evaluate(() => ({
      local: window.localStorage.length,
      session: window.sessionStorage.length,
    }));
    expect(storage).toEqual({ local: 0, session: 0 });
  });

  test("trợ năng (axe): không có lỗi mức nghiêm trọng ở các màn của bản chơi thử", async ({ page }) => {
    // Bốn lượt quét axe trên trang /demo nặng: khi cả bộ E2E chạy song song có thể vượt 30 s (R04 — chỉ tăng thời gian chờ).
    test.slow();
    const serious = async () => {
      const results = await new AxeBuilder({ page }).analyze();
      return results.violations
        .filter((violation) => violation.impact === "critical" || violation.impact === "serious")
        .map((violation) => `${violation.id}: ${violation.nodes.map((node) => node.target.join(" ")).join(" | ")}`);
    };
    await page.goto("/demo");
    expect(await serious()).toEqual([]);
    await page
      .getByRole("button", { name: /Vững bước/ })
      .first()
      .click();
    expect(await serious()).toEqual([]);
    const activity = pathOf("vung-buoc").activities.find((entry) => entry.variant === "picture_build");
    if (!activity?.items[0]) throw new Error("thiếu bài");
    await page.getByRole("button", { name: `Làm thử: ${activity.title}` }).click();
    await page.getByRole("button", { name: /^Bắt đầu$/u }).click();
    expect(await serious()).toEqual([]);
    await answer(page, activity.items[0]);
    await check(page);
    expect(await serious()).toEqual([]);
  });
});

test.describe("bản chơi thử trên màn hình 360px", () => {
  test.use({ viewport: { width: 360, height: 740 } });

  test("không cuộn ngang; thẻ chọn và nút Kiểm tra cao tối thiểu 64px", async ({ page }) => {
    await openPath(page, "khoi-dong");
    const activity = pathOf("khoi-dong").activities.find((entry) => entry.variant === "picture_build");
    if (!activity?.items[0]) throw new Error("thiếu bài");
    await page.getByRole("button", { name: `Làm thử: ${activity.title}` }).click();
    await page.getByRole("button", { name: /^Bắt đầu$/u }).click();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    for (const name of ["Âm đầu", "Vần", "Dấu thanh"]) {
      for (const tile of await page.getByRole("group", { name }).getByRole("button").all()) {
        const box = await tile.boundingBox();
        expect(box?.height ?? 0).toBeGreaterThanOrEqual(64);
        expect(box?.width ?? 0).toBeGreaterThanOrEqual(64);
      }
    }
    const checkBox = await page.getByRole("button", { name: /Kiểm tra/ }).boundingBox();
    expect(checkBox?.height ?? 0).toBeGreaterThanOrEqual(64);
    await answer(page, activity.items[0]);
    await check(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  });
});
