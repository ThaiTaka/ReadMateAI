import { execSync } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import { createClient } from "@supabase/supabase-js";
import { expect, test, type APIRequestContext, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { generateLoginCode, hmacLoginCode, toPgBytea } from "../../src/features/login-codes/codes";

/**
 * R05 — bảng xếp hạng THẬT trên Supabase local (cờ hệ thống bật CHỈ cho lần chạy này — xem global-setup/teardown).
 * Mỗi lần chạy dựng một lớp hư cấu mới (học sinh hư cấu, điểm bắt đầu từ 0). Điểm của các bạn đến từ API chấm bài THẬT
 * (/api/student/practice-sessions + /attempts) bằng thiết bị đã liên kết qua /join — không sửa CSDL để giả lập điểm.
 * Kèm ảnh chụp ở test-results/r05-screens/ (xem bằng mắt: thanh điểm, avatar, TOP 3, điện thoại 360 px, trình chiếu).
 */

process.loadEnvFile?.(".env.local");
const PASSWORD = process.env.SEED_TEACHER_PASSWORD ?? "";
const PEPPER = process.env.LOGIN_CODE_PEPPER ?? "";
const DOMAIN = ["readmate", "test"].join(".");
const TEACHER_A = ["co.mai", DOMAIN].join("@");
const TEACHER_B = ["thay.binh", DOMAIN].join("@");
const CLASS_C = "5eed0000-0000-4000-8000-0000000000c1";
const SHOTS = "test-results/r05-screens";

const status = JSON.parse(
  (() => {
    const raw = execSync("npx supabase status -o json", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    return raw.slice(raw.indexOf("{"));
  })(),
) as Record<string, string>;
const admin = createClient(status.API_URL!, status.SECRET_KEY!, { auth: { persistSession: false } });

async function must<T>(promise: PromiseLike<{ data: T; error: unknown }>): Promise<T> {
  const { data, error } = await promise;
  if (error) throw new Error(JSON.stringify(error));
  return data;
}

const resetRateLimits = () => admin.from("rate_limit_buckets").delete().neq("key_hash", "");

type ClassRow = { id: string; name: string; ownerId: string };

/** Lớp hư cấu mới (do Cô Mai chủ nhiệm), tiến độ đã xác nhận trên chuỗi bài kiểm thử như Lớp Thử Điểm. */
async function freshClass(label: string): Promise<ClassRow> {
  const reference = (await must(
    admin
      .from("classes")
      .select("school_id, curriculum_series_id, current_lesson_id, created_by")
      .eq("id", CLASS_C)
      .single(),
  )) as { school_id: string; curriculum_series_id: string; current_lesson_id: string; created_by: string };
  const name = `${label} ${randomBytes(3).toString("hex")}`;
  const created = (await must(
    admin
      .from("classes")
      .insert({
        school_id: reference.school_id,
        name,
        school_year: "2026-2027",
        created_by: reference.created_by,
        curriculum_series_id: reference.curriculum_series_id,
        current_lesson_id: reference.current_lesson_id,
        curriculum_status: "confirmed",
        curriculum_confirmed_by: reference.created_by,
        curriculum_confirmed_at: new Date().toISOString(),
      })
      .select("id")
      .single(),
  )) as { id: string };
  await must(
    admin
      .from("class_staff")
      .insert({ class_id: created.id, staff_id: reference.created_by, role: "owner", added_by: reference.created_by }),
  );
  return { id: created.id, name, ownerId: reference.created_by };
}

type Member = { id: string; name: string; alias: string; backup: string };

async function newMember(
  cls: ClassRow,
  alias: string,
  options: { avatar?: string; display?: boolean; approved?: boolean } = {},
): Promise<Member> {
  const { avatar = "may", display = true, approved = true } = options;
  const name = `${alias} ${[...randomBytes(5)].map((byte) => String.fromCharCode(97 + (byte % 26))).join("")}`;
  const now = new Date().toISOString();
  const student = (await must(
    admin
      .from("students")
      .insert({
        class_id: cls.id,
        display_name: name,
        avatar_key: avatar,
        leaderboard_alias: alias,
        leaderboard_alias_approved_by: approved ? cls.ownerId : null,
        leaderboard_alias_approved_at: approved ? now : null,
        created_by: cls.ownerId,
      })
      .select("id")
      .single(),
  )) as { id: string };
  await must(
    admin
      .from("student_band_assignments")
      .insert({ student_id: student.id, class_id: cls.id, band: "developing", set_by: cls.ownerId }),
  );
  for (const scope of display ? (["learning_data", "leaderboard_display"] as const) : (["learning_data"] as const)) {
    await must(
      admin.from("guardian_consents").insert({
        student_id: student.id,
        class_id: cls.id,
        scope,
        notice_version: "kiem-thu-e2e",
        method: "paper_form",
        note: "Dữ liệu giả cho kiểm thử E2E",
        recorded_by: cls.ownerId,
      }),
    );
  }
  const code = generateLoginCode();
  await must(
    admin.from("student_login_codes").insert({
      student_id: student.id,
      class_id: cls.id,
      token_hmac: toPgBytea(hmacLoginCode(PEPPER, "token", code.token)),
      backup_code_hmac: toPgBytea(hmacLoginCode(PEPPER, "backup", code.backupCode)),
      expires_at: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
      created_by: cls.ownerId,
    }),
  );
  return { id: student.id, name, alias, backup: code.backupCode };
}

async function link(page: Page, backup: string) {
  await resetRateLimits();
  await page.goto("/join");
  await page.getByLabel("Mã dự phòng trên thẻ học").fill(backup);
  await page.getByRole("button", { name: "Liên kết thiết bị" }).click();
  await expect(page).toHaveURL(/\/learn\/me$/u, { timeout: 30_000 });
}

async function login(page: Page, email: string) {
  await resetRateLimits();
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Mật khẩu").fill(PASSWORD);
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await page.waitForURL(/\/teacher$/u);
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

async function shot(page: Page, name: string, projectName: string) {
  mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: `${SHOTS}/${projectName}-${name}.png`, fullPage: true });
}

type Option = { id: string; text: string };
type Question = {
  id: string;
  view: { content: { sample: string; options: Option[] } };
};

const optionsOf = (question: Question) => {
  const { sample, options } = question.view.content;
  return {
    correct: options.find((option) => option.text === sample)!.id,
    wrong: options.find((option) => option.text !== sample)!.id,
  };
};

/** Làm bài bằng API chấm thật của thiết bị đã liên kết. "wrong" giữ câu mở; "correct" sang câu kế. */
async function earn(request: APIRequestContext, outcomes: Array<"correct" | "wrong">) {
  const opened = await request.post("/api/student/practice-sessions", { data: {} });
  expect(opened.status()).toBe(200);
  const session = (await opened.json()).data as { id: string; current: Question };
  let question: Question | null = session.current;
  for (const outcome of outcomes) {
    expect(question, "hết câu trong buổi").not.toBeNull();
    const pick = optionsOf(question!);
    const attempt = await request.post(`/api/student/question-instances/${question!.id}/attempts`, {
      data: {
        clientAttemptId: randomUUID(),
        response: { kind: "choice", optionId: outcome === "correct" ? pick.correct : pick.wrong },
      },
    });
    expect(attempt.status()).toBe(200);
    if (outcome === "correct") {
      const next = await request.get(`/api/student/practice-sessions/${session.id}`);
      question = ((await next.json()).data as { current: Question | null }).current;
    }
  }
}

type Device = { context: BrowserContext; page: Page };

async function device(browser: Browser, backup: string): Promise<Device> {
  const context = await browser.newContext({ locale: "vi-VN" });
  const page = await context.newPage();
  await link(page, backup);
  return { context, page };
}

const FORBIDDEN_KEYS = ["student_id", "studentId", "class_id", "classId", "auth_user_id", "earned", "deducted", "band"];

// Next 16 giữ trang trước (ẩn) khi điều hướng phía client → chỉ đếm hàng đang hiển thị.
const rowsOf = (page: Page) => page.getByTestId("leaderboard-row").filter({ visible: true });
const ranksOf = async (page: Page) =>
  (await rowsOf(page).evaluateAll((rows) => rows.map((row) => row.getAttribute("data-rank")))).map(Number);
const textOfRows = async (page: Page) => (await rowsOf(page).allInnerTexts()).join("\n");

test.beforeAll(() => {
  expect(PASSWORD, "Thiếu SEED_TEACHER_PASSWORD (.env.local — npm run db:env)").not.toBe("");
  expect(PEPPER, "Thiếu LOGIN_CODE_PEPPER (.env.local — npm run db:env)").not.toBe("");
});

test.describe("R05 — bảng xếp hạng lớp", () => {
  test("tắt mặc định → GV bật → bảng thật cập nhật khi điểm đổi → đồng hạng, thanh điểm, hàng của con → GV tắt", async ({
    page,
    browser,
  }, testInfo) => {
    test.slow();
    test.setTimeout(420_000);
    const project = testInfo.project.name;
    const isNarrow = (testInfo.project.use.viewport?.width ?? 1280) < 600;
    const cls = await freshClass("BXH");
    const may = await newMember(cls, "Mây", { avatar: "may" });
    const bong = await newMember(cls, "Bống", { avatar: "bong" });
    const na = await newMember(cls, "Na", { avatar: "na" });
    const ti = await newMember(cls, "Tí", { avatar: "ti" });
    const an = await newMember(cls, "Ẩn Danh", { avatar: "bin", display: false });

    // Mây: trang của con → bảng đang TẮT (mặc định) — không có dữ liệu bảng trong phản hồi.
    await link(page, may.backup);
    const disabledResponse = page.waitForResponse((r) => r.url().includes("/api/student/leaderboard"));
    await page.goto("/learn/leaderboard");
    const disabledBody = await (await disabledResponse).text();
    expect(disabledBody).toContain('"status":"disabled"');
    for (const alias of ["Mây", "Bống", "Na", "Tí", "Ẩn Danh"]) expect(disabledBody).not.toContain(alias);
    await expect(page.getByTestId("leaderboard-disabled")).toContainText(
      "Bảng điểm của lớp hiện chưa được mở. Con vẫn có thể tiếp tục luyện tập và tích điểm nhé!",
    );
    await expect(rowsOf(page)).toHaveCount(0);
    await noHorizontalScroll(page);
    await axeClean(page);
    await shot(page, "student-disabled", project);

    // Điểm đến từ API chấm bài thật: Bống 40, Na 40 (sau Bống), Tí 10, Mây 20 rồi −5 (= 15). Bạn ẩn cũng tích điểm.
    const bongDevice = await device(browser, bong.backup);
    await earn(bongDevice.context.request, ["correct", "correct", "correct", "correct"]);
    const naDevice = await device(browser, na.backup);
    await earn(naDevice.context.request, ["correct", "correct", "correct", "correct"]);
    const tiDevice = await device(browser, ti.backup);
    await earn(tiDevice.context.request, ["correct"]);
    const anDevice = await device(browser, an.backup);
    await earn(anDevice.context.request, ["correct", "correct", "correct", "correct", "correct"]);
    await earn(page.request, ["correct", "correct", "wrong"]);
    const mayScore = (await must(admin.from("season_scores").select("balance").eq("student_id", may.id))) as Array<{
      balance: number;
    }>;
    expect(mayScore[0]?.balance).toBe(15);

    // GV (Cô Mai) mở trang bảng điểm của lớp, bật bảng (kiểu mặc định: TOP 10 + con).
    const teacherContext = await browser.newContext({ locale: "vi-VN" });
    const teacher = await teacherContext.newPage();
    await login(teacher, TEACHER_A);
    await teacher.goto(`/teacher/classes/${cls.id}/leaderboard`);
    await expect(teacher.getByRole("heading", { level: 1 })).toContainText(cls.name);
    await expect(teacher.getByText("Đang tắt").first()).toBeVisible();
    const enable = teacher.getByLabel("Bật bảng điểm cho học sinh của lớp");
    await expect(enable).toBeEnabled();
    await expect(teacher.getByLabel("Kiểu hiển thị cho học sinh")).toHaveValue("top10_and_me");
    await expect(teacher.getByRole("button", { name: "Mở chế độ trình chiếu" })).toBeDisabled();
    // Vinh danh còn khóa (lớp chưa bật); reset mùa dành cho chủ nhiệm nên bật sẵn.
    await expect(teacher.getByRole("button", { name: "Vinh danh TOP 3" })).toBeDisabled();
    await expect(teacher.getByRole("button", { name: "BẮT ĐẦU MÙA MỚI", exact: true })).toBeEnabled();
    await enable.check();
    await teacher.getByRole("button", { name: "Lưu cài đặt" }).click();
    await expect(teacher.getByText("Đã lưu cài đặt bảng điểm.")).toBeVisible();
    await teacher.reload();
    await expect(teacher.getByText("Đang bật").first()).toBeVisible();

    // Bảng nội bộ của GV: có cả bạn chưa hiện trên bảng, kèm lý do.
    const internal = teacher.getByRole("table");
    await expect(internal).toContainText(an.name);
    await expect(internal.getByRole("row", { name: new RegExp(an.name, "u") })).toContainText(
      "chưa có đồng ý hiển thị trên bảng",
    );
    await expect(internal.getByRole("row", { name: new RegExp(may.name, "u") })).toContainText("Có trên bảng");
    await noHorizontalScroll(teacher);
    await axeClean(teacher);
    await shot(teacher, "teacher-leaderboard", project);

    // Vùng cuộn ngang của bảng số: có nhãn, nhận focus bằng bàn phím (vòng focus nhìn thấy) và cuộn được bằng phím mũi tên.
    const scroller = teacher.getByRole("group", { name: /Bảng chi tiết từng học sinh/u });
    await expect(scroller).toHaveAttribute("tabindex", "0");
    if (isNarrow) {
      await scroller.focus();
      await expect(scroller).toBeFocused();
      expect(await scroller.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);
      await teacher.keyboard.press("ArrowRight");
      await expect.poll(() => scroller.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
      await noHorizontalScroll(teacher); // chỉ vùng bảng cuộn, không phải cả trang
    }

    // Học sinh Mây: bảng thật — hạng 1,1,3,4; bạn ẩn không có; hàng của Mây nổi bật.
    await page.goto("/learn/leaderboard");
    await expect(page.getByTestId("leaderboard-ready")).toBeVisible();
    await expect(rowsOf(page)).toHaveCount(4);
    expect(await ranksOf(page)).toEqual([1, 1, 3, 4]);
    const text = await textOfRows(page);
    expect(text).not.toContain("Ẩn Danh");
    expect(text.indexOf("Bống")).toBeLessThan(text.indexOf("Na")); // cùng 40 điểm: Bống đạt trước
    const mine = page.locator('[data-testid="leaderboard-row"][data-me="true"]');
    await expect(mine).toHaveCount(1);
    await expect(mine).toContainText("Mây");
    await expect(mine).toContainText("Con");
    await expect(page.getByText("Hạng 3, Mây (con), 15 điểm")).toBeAttached();
    await expect(page.getByText("Hạng 1, Bống, 40 điểm")).toBeAttached();
    await expect(page.getByText("Hạng 1, Na, 40 điểm")).toBeAttached();
    await expect(page.getByTestId("my-points")).toContainText("15");

    // Thanh điểm: tỉ lệ đúng với điểm (40/40 = 100%, 15/40 = 37,5%, 10/40 = 25%).
    await expect
      .poll(async () =>
        (
          await page
            .getByTestId("score-bar")
            .evaluateAll((bars) => bars.map((bar) => bar.firstElementChild?.getAttribute("data-width")))
        ).map(Number),
      )
      .toEqual([100, 100, 37.5, 25]);
    // Đo chiều rộng thật so với đường nền; poll vì hoạt cảnh thanh có thể chậm trên CI tải nặng.
    const measure = () =>
      page.getByTestId("score-bar").evaluateAll((bars) =>
        bars.map((bar) => {
          const fill = bar.firstElementChild as HTMLElement;
          return Math.round((fill.getBoundingClientRect().width / bar.getBoundingClientRect().width) * 1000) / 10;
        }),
      );
    await expect.poll(async () => (await measure())[0], { timeout: 10_000 }).toBeGreaterThan(95);
    await page.waitForTimeout(900);
    const widths = await measure();
    expect(widths[0]).toBeGreaterThan(95);
    expect(widths[2]).toBeGreaterThan(34);
    expect(widths[2]).toBeLessThan(41);
    expect(widths[3]).toBeGreaterThan(22);
    expect(widths[3]).toBeLessThan(28);

    // Phản hồi API: không khóa cấm, không lưu đệm, có hàng của con; chỉ 4 hàng đủ điều kiện.
    const api = await page.request.get("/api/student/leaderboard");
    expect(api.status()).toBe(200);
    expect(api.headers()["cache-control"]).toContain("no-store");
    const apiText = await api.text();
    for (const key of FORBIDDEN_KEYS) expect(apiText).not.toContain(key);
    expect(apiText).not.toContain("Ẩn Danh");
    expect((JSON.parse(apiText).data.rows as unknown[]).length).toBe(4);
    // HTML do máy chủ trả về (không phải DOM sau khi chạy) không chứa dữ liệu bảng: bảng chỉ tải qua API.
    expect(await (await page.request.get("/learn/leaderboard")).text()).not.toContain("Bống");
    expect(await page.evaluate(() => Object.keys(localStorage).length + Object.keys(sessionStorage).length)).toBe(0);
    await noHorizontalScroll(page);
    await axeClean(page);
    await shot(page, "student-leaderboard", project);

    // Điểm đổi: Tí đạt 40 (qua API chấm thật) và Mây đúng thêm trên GIAO DIỆN → bảng cập nhật khi bấm "Cập nhật bảng".
    await earn(tiDevice.context.request, ["correct", "correct", "correct"]);
    await page.getByRole("button", { name: "Cập nhật bảng" }).click();
    await expect.poll(() => ranksOf(page)).toEqual([1, 1, 1, 4]);
    await expect(page.getByText("Hạng 4, Mây (con), 15 điểm")).toBeAttached();

    const opened = page.waitForResponse(
      (r) => r.url().endsWith("/api/student/practice-sessions") && r.request().method() === "POST",
    );
    await page.goto("/learn/me/practice");
    const session = (await (await opened).json()).data as { current: Question };
    const pick = optionsOf(session.current);
    const index = session.current.view.content.options.findIndex((option) => option.id === pick.correct);
    await page.getByRole("group", { name: /chữ/iu }).getByRole("button").nth(index).click();
    const attempt = page.waitForResponse((r) => r.url().includes("/attempts") && r.request().method() === "POST");
    await page.getByRole("button", { name: "Kiểm tra" }).click();
    expect((await attempt).status()).toBe(200);
    await expect(page.getByText("Điểm của con: 25")).toBeVisible();
    await page.goto("/learn/leaderboard");
    await expect(page.getByText("Hạng 4, Mây (con), 25 điểm")).toBeAttached();
    await shot(page, "student-leaderboard-ties", project);

    // Trình chiếu của GV: toàn màn hình, chỉ bạn đủ điều kiện, không có bạn ẩn.
    await teacher.goto(`/teacher/classes/${cls.id}/leaderboard`);
    await teacher.getByRole("link", { name: "Mở chế độ trình chiếu" }).click();
    await expect(teacher).toHaveURL(/\/leaderboard\/present$/u);
    await expect(teacher.getByRole("heading", { level: 1 })).toContainText(`Bảng điểm của lớp ${cls.name}`);
    await expect(rowsOf(teacher)).toHaveCount(4);
    expect(await textOfRows(teacher)).not.toContain("Ẩn Danh");
    await expect(teacher.getByRole("navigation")).toHaveCount(0); // không thanh bên của khu vực GV
    expect(
      await (await teacherContext.request.get(`/teacher/classes/${cls.id}/leaderboard/present`)).text(),
    ).not.toContain(an.name);
    await noHorizontalScroll(teacher);
    await axeClean(teacher);
    await teacher.waitForTimeout(900);
    await shot(teacher, "teacher-presentation", project);
    await teacher.getByRole("link", { name: "Thoát trình chiếu" }).click();
    await expect(teacher).toHaveURL(/\/leaderboard$/u);

    // GV tắt bảng khi học sinh đang mở trang → lần làm mới kế tiếp không còn hàng nào; điểm vẫn nguyên.
    await page.goto("/learn/leaderboard");
    await expect(rowsOf(page)).toHaveCount(4);
    await teacher.getByLabel("Bật bảng điểm cho học sinh của lớp").uncheck();
    await teacher.getByRole("button", { name: "Lưu cài đặt" }).click();
    await expect(teacher.getByText("Đã lưu cài đặt bảng điểm.")).toBeVisible();
    await page.getByRole("button", { name: "Cập nhật bảng" }).click();
    await expect(page.getByTestId("leaderboard-disabled")).toBeVisible();
    await expect(rowsOf(page)).toHaveCount(0);
    expect(await (await page.request.get("/learn/leaderboard")).text()).not.toContain("Bống");
    await expect(page.getByText("Hạng 1, Bống")).toHaveCount(0);
    await shot(page, "student-disabled-after-off", project);
    const kept = (await must(admin.from("season_scores").select("balance").eq("student_id", may.id))) as Array<{
      balance: number;
    }>;
    expect(kept[0]?.balance).toBe(25);

    await teacherContext.close();
    await bongDevice.context.close();
    await naDevice.context.close();
    await tiDevice.context.close();
    await anDevice.context.close();
  });

  test("cách ly lớp và quyền: khách 401, hồ sơ lớp khác 403, GV lớp khác không thấy gì, học sinh không thể bật bảng", async ({
    page,
    browser,
  }) => {
    test.slow();
    const cls = await freshClass("BXH-CL");
    const other = await freshClass("BXH-KH");
    const me = await newMember(cls, "Chỉ Lớp Này");
    const stranger = await newMember(other, "Lớp Khác");
    await must(admin.from("classes").update({ leaderboard_enabled: true }).in("id", [cls.id, other.id]).select("id"));

    const guest = await browser.newContext();
    const guestResponse = await guest.request.get("/api/student/leaderboard");
    expect(guestResponse.status()).toBe(401);
    expect(await guestResponse.text()).not.toContain("Chỉ Lớp Này");
    await guest.close();

    await link(page, me.backup);
    const own = await page.request.get("/api/student/leaderboard");
    expect(own.status()).toBe(200);
    const ownText = await own.text();
    expect(ownText).toContain("Chỉ Lớp Này");
    expect(ownText).not.toContain("Lớp Khác");
    const foreign = await page.request.get(`/api/student/leaderboard?studentId=${stranger.id}`);
    expect(foreign.status()).toBe(403);
    expect(await foreign.text()).not.toContain("Lớp Khác");
    // Không có tham số nào để chọn lớp/mùa/điểm: tham số lạ bị từ chối.
    const smuggled = await page.request.get(`/api/student/leaderboard?classId=${other.id}`);
    expect(smuggled.status()).toBe(400);
    const post = await page.request.post("/api/student/leaderboard", { data: { points: 999 } });
    expect(post.status()).toBe(405);

    // Học sinh không vào được trang bảng của GV; GV lớp khác thấy "Không tìm thấy" và không có dữ liệu lớp.
    await page.goto(`/teacher/classes/${cls.id}/leaderboard`);
    await expect(page).toHaveURL(/\/login\?reason=student_device/u);

    const teacherB = await browser.newContext({ locale: "vi-VN" });
    const pageB = await teacherB.newPage();
    await login(pageB, TEACHER_B);
    await pageB.goto(`/teacher/classes/${cls.id}/leaderboard`);
    await expect(pageB.getByRole("heading", { name: "Không tìm thấy trang" })).toBeVisible();
    await expect(pageB.getByText("Chỉ Lớp Này")).toHaveCount(0);
    await pageB.goto(`/teacher/classes/${cls.id}/leaderboard/present`);
    await expect(pageB.getByRole("heading", { name: "Không tìm thấy trang" })).toBeVisible();
    await teacherB.close();
  });

  test("trạng thái đặc biệt: lớp chưa có ai trên bảng, tất cả 0 điểm, mất mạng rồi thử lại, giảm chuyển động, bàn phím", async ({
    page,
    context,
  }, testInfo) => {
    test.slow();
    const project = testInfo.project.name;
    const cls = await freshClass("BXH-TT");
    await must(admin.from("classes").update({ leaderboard_enabled: true }).eq("id", cls.id).select("id"));
    // Bạn duy nhất trong lớp chưa đủ điều kiện hiển thị (chưa có đồng ý hiển thị): bảng trống nhưng vẫn học bình thường.
    const solo = await newMember(cls, "Chưa Hiện", { display: false });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await link(page, solo.backup);
    await page.goto("/learn/leaderboard");
    await expect(page.getByTestId("leaderboard-empty")).toBeVisible();
    await expect(page.getByText("Tên của con chưa hiện trên bảng của lớp.")).toBeVisible();
    await expect(page.getByTestId("my-points")).toContainText("0");
    await noHorizontalScroll(page);
    await axeClean(page);
    await shot(page, "student-empty", project);

    // Thêm hai bạn 0 điểm: tất cả thanh rỗng, đồng hạng nhất, không chia cho 0.
    await newMember(cls, "Sao");
    await newMember(cls, "Nắng");
    await page.getByRole("button", { name: "Cập nhật bảng" }).click();
    await expect(rowsOf(page)).toHaveCount(2);
    expect(await ranksOf(page)).toEqual([1, 1]);
    await expect(page.getByText(/cùng xuất phát từ 0 điểm/u)).toBeVisible();
    const widths = await page
      .getByTestId("score-bar")
      .evaluateAll((bars) => bars.map((bar) => (bar.firstElementChild as HTMLElement).getBoundingClientRect().width));
    expect(widths.every((width) => width === 0)).toBe(true);
    // Giảm chuyển động: thanh không có chuyển tiếp dài; avatar không có hoạt cảnh liên tục.
    const transition = await page
      .getByTestId("score-bar")
      .first()
      .evaluate((bar) => getComputedStyle(bar.firstElementChild as HTMLElement).transitionDuration);
    expect(parseFloat(transition)).toBeLessThan(0.05);
    const animated = await page.evaluate(
      () =>
        [...document.querySelectorAll('[data-testid="leaderboard-row"] *')].filter(
          (element) =>
            getComputedStyle(element).animationName !== "none" &&
            parseFloat(getComputedStyle(element).animationDuration) > 0.05,
        ).length,
    );
    expect(animated).toBe(0);

    // Bàn phím: Tab tới nút "Cập nhật bảng" và có vòng focus nhìn thấy (:focus-visible chỉ bật với bàn phím).
    const refresh = page.getByRole("button", { name: "Cập nhật bảng" });
    for (let step = 0; step < 20; step += 1) {
      await page.keyboard.press("Tab");
      if (await refresh.evaluate((element) => element === document.activeElement)) break;
    }
    await expect(refresh).toBeFocused();
    expect(await refresh.evaluate((element) => getComputedStyle(element).outlineStyle)).not.toBe("none");

    // Mất mạng: thông báo thân thiện + nút "Thử lại"; có mạng lại bấm thử lại là bảng quay về.
    await context.setOffline(true);
    await page.getByRole("button", { name: "Cập nhật bảng" }).click();
    await expect(page.getByTestId("leaderboard-error")).toBeVisible();
    await expect(page.getByTestId("leaderboard-error")).toContainText(/Máy đang không có mạng|mạng đang chập chờn/u);
    await shot(page, "student-offline", project);
    await context.setOffline(false);
    await page.getByRole("button", { name: "Thử lại" }).click();
    await expect(rowsOf(page)).toHaveCount(2);
  });

  test("mọi cỡ màn hình 360 → 1440 px: không cuộn ngang, tên dài không vỡ bố cục, vùng chạm đủ lớn, axe sạch", async ({
    page,
    browser,
  }, testInfo) => {
    test.slow();
    test.setTimeout(420_000);
    const project = testInfo.project.name;
    const isPhone = (testInfo.project.use.viewport?.width ?? 1280) < 600;
    const cls = await freshClass("BXH-RW");
    await must(
      admin
        .from("classes")
        .update({ leaderboard_enabled: true, leaderboard_student_view: "full" })
        .eq("id", cls.id)
        .select("id"),
    );
    const me = await newMember(cls, "Tên Rất Dài Hai Mươi", { avatar: "xoai" });
    const names = ["Mây", "Bống", "Na", "Tí", "Bin", "Su", "Cốm"];
    const avatars = ["sao", "nang", "bien", "gio", "lua", "tre", "sen"];
    const members: Member[] = [];
    for (const [index, name] of names.entries()) members.push(await newMember(cls, name, { avatar: avatars[index]! }));
    const devices: Device[] = [];
    for (const [index, plan] of ([4, 3, 3] as const).entries()) {
      const entry = await device(browser, members[index]!.backup);
      devices.push(entry);
      await earn(
        entry.context.request,
        Array.from({ length: plan }, () => "correct" as const),
      );
    }
    await link(page, me.backup);
    await earn(page.request, ["correct", "correct"]);

    const widths = isPhone ? [null] : [360, 375, 390, 768, 1024, 1440];
    for (const width of widths) {
      if (width) await page.setViewportSize({ width, height: width < 700 ? 800 : 900 });
      await page.goto("/learn/leaderboard");
      await expect(rowsOf(page)).toHaveCount(8);
      await expect(page.getByText("Hạng 1, Mây, 40 điểm")).toBeAttached();
      await noHorizontalScroll(page);
      const overflowing = await rowsOf(page).evaluateAll(
        (rows) => rows.filter((row) => (row as HTMLElement).scrollWidth > (row as HTMLElement).clientWidth + 1).length,
      );
      expect(overflowing).toBe(0);
      // Thanh điểm không che tên: thanh nằm sau tên (dòng dưới ở điện thoại, bên phải ở màn rộng).
      const overlap = await rowsOf(page).evaluateAll(
        (rows) =>
          rows.filter((row) => {
            const name = row.querySelector("span.truncate")?.getBoundingClientRect();
            const bar = row.querySelector('[data-testid="score-bar"]')?.getBoundingClientRect();
            if (!name || !bar) return false;
            const intersects =
              name.left < bar.right && bar.left < name.right && name.top < bar.bottom && bar.top < name.bottom;
            return intersects;
          }).length,
      );
      expect(overlap).toBe(0);
      const refresh = await page
        .getByRole("button", { name: "Cập nhật bảng" })
        .evaluate((b) => b.getBoundingClientRect().height);
      expect(refresh).toBeGreaterThanOrEqual(40);
      await axeClean(page);
      if (!width || [360, 390, 768, 1440].includes(width)) await shot(page, `student-${width ?? "device"}`, project);
    }
    for (const entry of devices) await entry.context.close();
  });
});
