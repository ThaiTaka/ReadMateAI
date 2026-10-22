import { execSync } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { createClient } from "@supabase/supabase-js";
import { expect, test, type APIResponse, type Page } from "@playwright/test";
import { generateLoginCode, hmacLoginCode, toPgBytea } from "../../src/features/login-codes/codes";

/**
 * R04 — luồng điểm thưởng THẬT trên Supabase local với nội dung FIXTURE hư cấu (`npm run db:seed` cài "Lớp Thử Điểm"
 * có tiến độ đã xác nhận trên chuỗi bài kiểm thử). Mỗi lần chạy tạo học sinh hư cấu mới (điểm mùa bắt đầu từ 0),
 * liên kết thiết bị bằng mã dự phòng qua /join như phụ huynh, rồi làm bài QUA GIAO DIỆN. Đáp án visual_match = phương
 * án có chữ giống chữ mẫu — đọc từ dữ liệu câu mà trình duyệt nhận được (đúng như học sinh nhìn thấy).
 */

process.loadEnvFile?.(".env.local");
const PEPPER = process.env.LOGIN_CODE_PEPPER ?? "";
const CLASS_C = "5eed0000-0000-4000-8000-0000000000c1";

const status = JSON.parse(
  (() => {
    const raw = execSync("npx supabase status -o json", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    return raw.slice(raw.indexOf("{"));
  })(),
) as Record<string, string>;
const admin = createClient(status.API_URL!, status.SECRET_KEY!, { auth: { persistSession: false } });

type View = {
  type: string;
  variant: string;
  content: { sample: string; options: Array<{ id: string; text: string }> };
};
type Question = { id: string; view: View; status: string; reveal: unknown; position: number };
type Session = { id: string; current: Question | null; questions: Array<{ id: string; status: string }> };

async function must<T>(promise: PromiseLike<{ data: T; error: unknown }>): Promise<T> {
  const { data, error } = await promise;
  if (error) throw new Error(JSON.stringify(error));
  return data;
}

async function resetRateLimits() {
  await admin.from("rate_limit_buckets").delete().neq("key_hash", "");
}

/** Học sinh hư cấu mới trong Lớp Thử Điểm: nhóm developing, đồng ý learning_data (GIẢ), thẻ học có mã dự phòng. */
async function freshStudent(label: string): Promise<{ id: string; name: string; backup: string }> {
  const owner = (await must(
    admin.from("class_staff").select("staff_id").eq("class_id", CLASS_C).eq("role", "owner").single(),
  )) as { staff_id: string };
  // Biệt danh hư cấu, không trùng trong lớp: 6 chữ cái ngẫu nhiên (26^6 khả năng).
  const suffix = [...randomBytes(6)].map((byte) => String.fromCharCode(97 + (byte % 26))).join("");
  const name = `${label} ${suffix}`;
  const student = (await must(
    admin
      .from("students")
      .insert({ class_id: CLASS_C, display_name: name, avatar_key: "may", created_by: owner.staff_id })
      .select("id")
      .single(),
  )) as { id: string };
  await must(
    admin
      .from("student_band_assignments")
      .insert({ student_id: student.id, class_id: CLASS_C, band: "developing", set_by: owner.staff_id }),
  );
  await must(
    admin.from("guardian_consents").insert({
      student_id: student.id,
      class_id: CLASS_C,
      scope: "learning_data",
      notice_version: "kiem-thu-e2e",
      method: "paper_form",
      note: "Dữ liệu giả cho kiểm thử E2E",
      recorded_by: owner.staff_id,
    }),
  );
  const code = generateLoginCode();
  await must(
    admin.from("student_login_codes").insert({
      student_id: student.id,
      class_id: CLASS_C,
      token_hmac: toPgBytea(hmacLoginCode(PEPPER, "token", code.token)),
      backup_code_hmac: toPgBytea(hmacLoginCode(PEPPER, "backup", code.backupCode)),
      expires_at: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
      created_by: owner.staff_id,
    }),
  );
  return { id: student.id, name, backup: code.backupCode };
}

async function link(page: Page, backup: string) {
  await resetRateLimits();
  await page.goto("/join");
  await page.getByLabel("Mã dự phòng trên thẻ học").fill(backup);
  await page.getByRole("button", { name: "Liên kết thiết bị" }).click();
  await expect(page).toHaveURL(/\/learn\/me$/u, { timeout: 30_000 });
}

async function axeClean(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  const serious = results.violations.filter((v) => v.impact === "critical" || v.impact === "serious");
  expect(serious.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
}

async function noHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
}

const isSessionResponse = (response: APIResponse | import("@playwright/test").Response) =>
  /\/api\/student\/practice-sessions(\/[0-9a-f-]+)?$/u.test(response.url());

/** Đọc câu hiện tại từ phản hồi của gateway và soát KHÔNG có đáp án trong dữ liệu gửi tới trình duyệt. */
async function sessionFrom(response: import("@playwright/test").Response): Promise<Session> {
  const text = await response.text();
  expect(response.headers()["cache-control"]).toContain("no-store");
  expect(text).not.toMatch(/"answer"|"correctIds"|"distractorTags"|"pictureNames?"/u);
  const body = JSON.parse(text) as { ok: boolean; data: Session };
  expect(body.ok, text).toBe(true);
  if (body.data.current) expect(body.data.current.reveal).toBeNull();
  return body.data;
}

function answerOf(question: Question): { correct: string; wrong: string[] } {
  const options = question.view.content.options;
  return {
    correct: options.find((option) => option.text === question.view.content.sample)!.text,
    wrong: options.filter((option) => option.text !== question.view.content.sample).map((option) => option.text),
  };
}

/**
 * Chọn phương án theo VỊ TRÍ của nó trong câu (thẻ hiển thị theo đúng thứ tự phương án). Không khớp theo tên truy cập:
 * WebKit có thể so khớp bỏ dấu ("a" ~ "â") làm chọn nhầm.
 */
async function choose(page: Page, question: Question, text: string) {
  const index = question.view.content.options.findIndex((option) => option.text === text);
  expect(index).toBeGreaterThanOrEqual(0);
  const tile = page.getByRole("group", { name: /chữ/iu }).getByRole("button").nth(index);
  await expect(tile).toHaveText(text);
  await tile.click();
}

async function check(page: Page) {
  const attempt = page.waitForResponse((r) => r.url().includes("/attempts") && r.request().method() === "POST");
  await page.getByRole("button", { name: "Kiểm tra" }).click();
  const response = await attempt;
  expect(response.status()).toBe(200);
}

async function nextQuestion(page: Page): Promise<Question> {
  const waiting = page.waitForResponse((r) => isSessionResponse(r) && r.request().method() === "GET");
  await page.getByRole("button", { name: "Câu tiếp theo" }).click();
  const session = await sessionFrom(await waiting);
  return session.current!;
}

test.beforeAll(() => {
  expect(PEPPER, "Thiếu LOGIN_CODE_PEPPER (.env.local — npm run db:env)").not.toBe("");
});

test.describe("R04 — luyện có điểm, bản đồ, điều kiện mini-game", () => {
  test("thẻ học → luyện → +10 / −5 → tải lại giữ nguyên → mốc 30 → mở thẻ → 50 điểm → Mê cung đủ điều kiện", async ({
    page,
  }, testInfo) => {
    // Kịch bản dài (~20 bước chờ máy chủ, 3 lần axe) — WebKit trên runner CI cần hơn mức x3 mặc định của test.slow().
    test.setTimeout(180_000);
    const student = await freshStudent("Điểm");
    await link(page, student.backup);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(`Trang của ${student.name}`);
    await expect(page.getByTestId("score-balance")).toHaveText("0");
    await expect(page.getByText("Đã khám phá 0/8 ô")).toBeVisible();
    await expect(page.locator("#me-game-treasure_maze")).toContainText("Cần thêm 50 điểm");
    await noHorizontalScroll(page);
    await axeClean(page);

    // Bắt đầu buổi luyện (POST từ trình duyệt) — câu tới trình duyệt không kèm đáp án.
    const opened = page.waitForResponse((r) => isSessionResponse(r) && r.request().method() === "POST");
    await page.getByRole("link", { name: "Luyện Tiếng Việt" }).click();
    let question = (await sessionFrom(await opened)).current!;
    expect(await page.content()).not.toMatch(/"answer"/u);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Câu 1/8");

    // Câu 1: đúng → +10.
    await choose(page, question, answerOf(question).correct);
    await check(page);
    await expect(page.getByLabel("Cộng 10 điểm")).toBeVisible();
    await expect(page.getByText("Điểm của con: 10")).toBeVisible();
    await axeClean(page);
    question = await nextQuestion(page);

    // Câu 2: sai → −5 (màu trung tính, không đỏ), chưa đổi lựa chọn thì không kiểm tra lại được.
    const { correct, wrong } = answerOf(question);
    await choose(page, question, wrong[0]!);
    await check(page);
    const minus = page.getByLabel("Điểm thay đổi: trừ 5");
    await expect(minus).toBeVisible();
    const color = await minus.evaluate((element) => getComputedStyle(element).backgroundColor);
    expect(color).not.toMatch(/rgb\(2[0-5]\d, [0-9]{1,2}, [0-9]{1,2}\)/u);
    await expect(page.getByText("Điểm của con: 5")).toBeVisible();
    await expect(page.getByRole("button", { name: "Kiểm tra" })).toBeDisabled();

    // Tải lại: cùng câu 2, vẫn 5 điểm, còn 2 lượt (không sinh câu mới, không mất điểm).
    const reopened = page.waitForResponse((r) => isSessionResponse(r) && r.request().method() === "POST");
    await page.reload();
    const again = (await sessionFrom(await reopened)).current!;
    expect(again.id).toBe(question.id);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Câu 2/8");
    await expect(page.getByText("Điểm của con: 5")).toBeVisible();
    await expect(page.getByText("Còn 2 lượt thử")).toBeVisible();

    await choose(page, question, correct);
    await check(page);
    await expect(page.getByText("Điểm của con: 15")).toBeVisible();

    // Câu 3–6 đúng: 25, 35 (tích lũy 40 ≥ 30 → có lượt mở thẻ), 45, 55 (≥ 50 → Mê cung).
    for (const expected of [25, 35, 45, 55]) {
      question = await nextQuestion(page);
      await choose(page, question, answerOf(question).correct);
      await check(page);
      await expect(page.getByText(`Điểm của con: ${expected}`)).toBeVisible();
      if (expected === 35) await expect(page.getByText(/lượt khám phá ô bản đồ mới/u)).toBeVisible();
    }
    await expect(page.getByText("Đã khám phá khu vực mới: Mê cung kho báu!")).toBeVisible();
    await noHorizontalScroll(page);
    await page.screenshot({ path: testInfo.outputPath("scored-practice.png"), fullPage: true });

    // Về trang của con: điểm thật từ máy chủ; khám phá một thẻ kề Trạm luyện tập.
    await page.getByRole("link", { name: "Về trang của con" }).click();
    await expect(page.getByTestId("score-balance")).toHaveText("55");
    await expect(page.getByTestId("score-earned")).toHaveText("60");
    // Next 16 giữ trang trước (ẩn) khi điều hướng phía client → mọi selector giới hạn trong vùng bản đồ.
    const mapArea = page.locator("#ban-do");
    await expect(mapArea.getByText(/Con có 2 lượt khám phá/u)).toBeVisible();
    const revealed = page.waitForResponse((r) => r.url().endsWith("/api/student/map-tiles"));
    await mapArea.getByRole("button", { name: "Khám phá ô sương mù ở hàng 1, cột 2" }).click();
    expect((await revealed).status()).toBe(200);
    await expect(mapArea.getByText("Mây tan rồi! Con vừa khám phá Ao sen.")).toBeVisible();
    // Ô góc chưa kề vùng đã mở trước đó giờ đã kề Ao sen → mở được bằng lượt thứ hai.
    await mapArea.getByRole("button", { name: "Khám phá ô sương mù ở hàng 1, cột 1" }).click();
    await expect(mapArea.getByText("Mây tan rồi! Con vừa khám phá Đồi hoa.")).toBeVisible();
    await expect(mapArea.getByText("Đã khám phá 2/8 ô")).toBeVisible();
    await expect(mapArea.getByText("Luyện thêm để có lượt khám phá mới nhé.")).toBeVisible();

    // Tải lại: điểm và thẻ vẫn giữ; Mê cung đủ điều kiện nhưng mini-game chưa chơi được (không có route game).
    await page.reload();
    await expect(page.getByTestId("score-balance")).toHaveText("55");
    await expect(page.getByText("Đã khám phá 2/8 ô")).toBeVisible();
    await expect(page.getByRole("listitem", { name: "Ao sen — đã khám phá" })).toBeVisible();
    const maze = page.locator("#me-game-treasure_maze");
    await expect(maze).toContainText("Đủ điểm");
    await expect(maze).toContainText("Đã khám phá");
    await expect(page.locator("#me-game-wonder_forest")).toContainText("Cần thêm 65 điểm");
    await maze.getByRole("button", { name: /Xem chi tiết/u }).click();
    await expect(page.getByRole("dialog").getByRole("button", { name: "Mini-game đang phát triển" })).toBeDisabled();
    await page.keyboard.press("Escape");
    // Chỉ còn đúng một đường vào game có thật: Mê cung kho báu có xác thực (R07.5b2); ba game kia không có liên kết.
    expect(
      await page
        .locator('a[href*="/games"]')
        .evaluateAll((links) => links.map((a) => a.getAttribute("href")?.split("?")[0])),
    ).toEqual(["/learn/me/games/treasure-maze"]);
    await noHorizontalScroll(page);
    await axeClean(page);
    await page.screenshot({ path: testInfo.outputPath("learn-me-scored.png"), fullPage: true });

    // Điểm thật đã nằm trong sổ cái PostgreSQL và khớp số dư.
    const events = (await must(
      admin.from("point_events").select("applied_delta, nominal_delta").eq("student_id", student.id),
    )) as Array<{ applied_delta: number; nominal_delta: number }>;
    expect(events.reduce((sum, event) => sum + event.applied_delta, 0)).toBe(55);
    expect(events.filter((event) => event.nominal_delta === -5)).toHaveLength(1);
    expect(await page.evaluate(() => Object.keys(localStorage).length + Object.keys(sessionStorage).length)).toBe(0);
  });

  test("học sinh khác trên thiết bị khác: điểm 0, không thấy lịch sử/câu của bạn", async ({ page, browser }) => {
    test.slow();
    const first = await freshStudent("Một");
    await link(page, first.backup);
    const opened = page.waitForResponse((r) => isSessionResponse(r) && r.request().method() === "POST");
    await page.goto("/learn/me/practice");
    const question = (await sessionFrom(await opened)).current!;
    await choose(page, question, answerOf(question).correct);
    await check(page);
    await expect(page.getByText("Điểm của con: 10")).toBeVisible();

    const second = await freshStudent("Hai");
    const context = await browser.newContext({ locale: "vi-VN" });
    const other = await context.newPage();
    await link(other, second.backup);
    await expect(other.getByTestId("score-balance")).toHaveText("0");
    await expect(other.getByText(first.name)).toHaveCount(0);
    const peek = await other.request.get(`/api/student/question-instances/${question.id}`);
    expect(peek.status()).toBe(404);
    const steal = await other.request.post(`/api/student/question-instances/${question.id}/attempts`, {
      data: { clientAttemptId: randomUUID(), response: { kind: "choice", optionId: "o1" } },
    });
    expect(steal.status()).toBe(404);
    const home = await other.request.get(`/api/student/home?studentId=${first.id}`);
    expect(home.status()).toBe(403);
    await context.close();
  });

  test("request độc hại không tạo điểm: trường điểm/đúng sai/mã học sinh, xung đột khóa ý định, khác nguồn, thiết bị thu hồi", async ({
    page,
  }) => {
    test.slow();
    const student = await freshStudent("Gian");
    await link(page, student.backup);
    const opened = page.waitForResponse((r) => isSessionResponse(r) && r.request().method() === "POST");
    await page.goto("/learn/me/practice");
    const question = (await sessionFrom(await opened)).current!;
    const { correct, wrong } = answerOf(question);
    const optionId = (text: string) => question.view.content.options.find((option) => option.text === text)!.id;
    const url = `/api/student/question-instances/${question.id}/attempts`;
    const base = { clientAttemptId: randomUUID(), response: { kind: "choice", optionId: optionId(wrong[0]!) } };

    for (const extra of [
      { points: 999999 },
      { is_correct: true },
      { balance: 1000 },
      { student_id: randomUUID() },
      { class_id: CLASS_C },
    ]) {
      const response = await page.request.post(url, { data: { ...base, ...extra } });
      expect(response.status()).toBe(400);
      expect(await response.json()).toEqual({ ok: false, code: "INVALID_INPUT" });
    }
    const forged = await page.request.post(url, {
      data: { ...base, response: { ...base.response, correct: true } },
    });
    expect(forged.status()).toBe(400);
    const crossSite = await page.request.post(url, { data: base, headers: { Origin: "https://ke-gian.example" } });
    expect(crossSite.status()).toBe(403);

    // Lượt hợp lệ (sai) rồi gửi lại cùng mã với câu trả lời khác → xung đột, không thành lượt mới.
    const first = await page.request.post(url, { data: base });
    expect(first.status()).toBe(200);
    const replay = await page.request.post(url, { data: base });
    expect((await replay.json()).data.replayed).toBe(true);
    const conflict = await page.request.post(url, {
      data: { clientAttemptId: base.clientAttemptId, response: { kind: "choice", optionId: optionId(correct) } },
    });
    expect(conflict.status()).toBe(409);
    expect((await conflict.json()).code).toBe("IDEMPOTENCY_CONFLICT");
    const duplicate = await page.request.post(url, {
      data: { clientAttemptId: randomUUID(), response: base.response },
    });
    expect((await duplicate.json()).code).toBe("DUPLICATE_RESPONSE");
    const tile = await page.request.post("/api/student/map-tiles", { data: { tileKey: "lotus_pond" } });
    expect((await tile.json()).code).toBe("NO_TILE_AVAILABLE");

    // GV thu hồi thiết bị → request kế tiếp mất quyền ngay.
    await must(
      admin
        .from("student_devices")
        .update({ revoked_at: new Date().toISOString(), revoke_reason: "teacher" })
        .eq("student_id", student.id),
    );
    const revoked = await page.request.post(url, {
      data: { clientAttemptId: randomUUID(), response: { kind: "choice", optionId: optionId(correct) } },
    });
    expect(revoked.status()).toBe(401);

    const events = (await must(
      admin.from("point_events").select("applied_delta").eq("student_id", student.id),
    )) as Array<{
      applied_delta: number;
    }>;
    expect(events).toHaveLength(1);
    const scores = (await must(admin.from("season_scores").select("balance").eq("student_id", student.id))) as Array<{
      balance: number;
    }>;
    expect(scores[0]?.balance ?? 0).toBe(0);
  });

  test("giảm chuyển động: '+10' và mây tan không có hoạt cảnh; 360 px không cuộn ngang", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium-desktop", "Đo một lần trên chromium-desktop.");
    test.slow();
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 360, height: 800 });
    const student = await freshStudent("Chậm");
    await link(page, student.backup);
    await noHorizontalScroll(page);
    const opened = page.waitForResponse((r) => isSessionResponse(r) && r.request().method() === "POST");
    await page.getByRole("link", { name: "Luyện Tiếng Việt" }).click();
    const question = (await sessionFrom(await opened)).current!;
    await choose(page, question, answerOf(question).correct);
    await check(page);
    const chip = page.getByLabel("Cộng 10 điểm");
    await expect(chip).toBeVisible();
    expect(await chip.evaluate((element) => getComputedStyle(element).animationName)).toBe("none");
    await noHorizontalScroll(page);
    await axeClean(page);
  });
});
