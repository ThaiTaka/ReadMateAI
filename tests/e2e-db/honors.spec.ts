import { execSync } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import { createClient } from "@supabase/supabase-js";
import { expect, test, type APIRequestContext, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { setLocalHonorsApproval } from "../../scripts/lib/test-fixtures";
import { generateLoginCode, hmacLoginCode, toPgBytea } from "../../src/features/login-codes/codes";

/**
 * R06.2 — giao diện vinh danh TOP 3 trên Supabase local. Cờ hệ thống vinh danh bật CHỈ trong lúc chạy (global-setup) và
 * trả về TẮT ở global-teardown; kịch bản "chưa phê duyệt" tự tắt rồi bật lại trong khối finally.
 * Điểm đến từ API chấm bài thật (không sửa CSDL để giả lập điểm). Toàn bộ học sinh là dữ liệu hư cấu.
 */

process.loadEnvFile?.(".env.local");
const PASSWORD = process.env.SEED_TEACHER_PASSWORD ?? "";
const PEPPER = process.env.LOGIN_CODE_PEPPER ?? "";
const DOMAIN = ["readmate", "test"].join(".");
const TEACHER_A = ["co.mai", DOMAIN].join("@");
const TEACHER_B = ["thay.binh", DOMAIN].join("@");
const CLASS_C = "5eed0000-0000-4000-8000-0000000000c1";
const SHOTS = "test-results/r06-screens";

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

type Member = { id: string; alias: string; backup: string };

async function newMember(
  cls: ClassRow,
  alias: string,
  options: { avatar?: string; display?: boolean } = {},
): Promise<Member> {
  const { avatar = "may", display = true } = options;
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
        leaderboard_alias_approved_by: cls.ownerId,
        leaderboard_alias_approved_at: now,
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
  return { id: student.id, alias, backup: code.backupCode };
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
type Question = { id: string; view: { content: { sample: string; options: Option[] } } };

/** Làm đúng `count` câu bằng API chấm thật của thiết bị đã liên kết (mỗi câu đúng +10). */
async function earnCorrect(request: APIRequestContext, count: number) {
  const opened = await request.post("/api/student/practice-sessions", { data: {} });
  expect(opened.status()).toBe(200);
  const session = (await opened.json()).data as { id: string; current: Question };
  let question: Question | null = session.current;
  for (let index = 0; index < count; index += 1) {
    expect(question, "hết câu trong buổi").not.toBeNull();
    const { sample, options } = question!.view.content;
    const attempt = await request.post(`/api/student/question-instances/${question!.id}/attempts`, {
      data: {
        clientAttemptId: randomUUID(),
        response: { kind: "choice", optionId: options.find((option) => option.text === sample)!.id },
      },
    });
    expect(attempt.status()).toBe(200);
    const next = await request.get(`/api/student/practice-sessions/${session.id}`);
    question = ((await next.json()).data as { current: Question | null }).current;
  }
}

async function earnFor(browser: Browser, member: Member, count: number) {
  const context: BrowserContext = await browser.newContext({ locale: "vi-VN" });
  const page = await context.newPage();
  await link(page, member.backup);
  await earnCorrect(context.request, count);
  await context.close();
}

const snapshotCount = async (classId: string) =>
  ((await must(admin.from("honor_snapshots").select("id").eq("class_id", classId))) as unknown[]).length;

const scores = async (classId: string) =>
  JSON.stringify(
    await must(admin.from("season_scores").select("student_id, balance, earned_total").eq("class_id", classId)),
  );

const seasons = async (classId: string) =>
  JSON.stringify(await must(admin.from("seasons").select("id, seq_no, status").eq("class_id", classId)));

const tiers = (page: Page) => page.getByTestId("honor-tier");
const revealedRanks = async (page: Page) =>
  (
    await tiers(page).evaluateAll((nodes) =>
      nodes
        .filter((node) => node.getAttribute("data-revealed") === "true")
        .map((node) => node.getAttribute("data-rank")),
    )
  )
    .map(Number)
    .sort();

test.beforeAll(() => {
  expect(PASSWORD, "Thiếu SEED_TEACHER_PASSWORD (.env.local — npm run db:env)").not.toBe("");
  expect(PEPPER, "Thiếu LOGIN_CODE_PEPPER (.env.local — npm run db:env)").not.toBe("");
});

test.describe("R06.2 — vinh danh TOP 3", () => {
  test("GV bật vinh danh → tạo ảnh chụp → phát 3 → 1 (đồng hạng, bỏ bậc 2) → Bỏ qua/Xem lại → lịch sử → lớp khác bị chặn → chưa phê duyệt thì khóa", async ({
    page,
    browser,
  }, testInfo) => {
    test.slow();
    test.setTimeout(420_000);
    const project = testInfo.project.name;
    const cls = await freshClass("VD");
    const may = await newMember(cls, "Mây", { avatar: "may" });
    const bong = await newMember(cls, "Bống", { avatar: "bong" });
    const na = await newMember(cls, "Na", { avatar: "na" });
    const ti = await newMember(cls, "Tí", { avatar: "ti" });
    const hidden = await newMember(cls, "Ẩn Danh", { avatar: "bin", display: false });
    // Bống 40, Na 40 (hạng 1 đồng hạng), Mây 20 (hạng 3), Tí 10 (hạng 4, không được vinh danh), bạn ẩn 50 (không đủ điều kiện).
    await earnFor(browser, bong, 4);
    await earnFor(browser, na, 4);
    await earnFor(browser, may, 2);
    await earnFor(browser, ti, 1);
    await earnFor(browser, hidden, 5);
    const scoresBefore = await scores(cls.id);
    const seasonsBefore = await seasons(cls.id);

    await login(page, TEACHER_A);
    await page.goto(`/teacher/classes/${cls.id}/leaderboard`);
    const create = page.getByRole("button", { name: "Vinh danh TOP 3" });

    // Lớp chưa bật vinh danh → nút khóa; chủ nhiệm bật trong phạm vi chính sách (cờ hệ thống đang bật ở local).
    await expect(create).toBeDisabled();
    await expect(page.getByText("Lớp chưa có lần vinh danh nào.")).toBeVisible();
    await page.getByLabel("Bật vinh danh cho lớp").check();
    await expect(page.getByText("Đã lưu cài đặt vinh danh.")).toBeVisible();
    await expect(create).toBeEnabled();
    await axeClean(page);
    await noHorizontalScroll(page);

    // Tạo ảnh chụp → mở trình chiếu.
    await create.click();
    await expect(page).toHaveURL(/\/teacher\/classes\/[0-9a-f-]+\/honors\/[0-9a-f-]+$/u, { timeout: 30_000 });
    const snapshotUrl = page.url();
    expect(await snapshotCount(cls.id)).toBe(1);

    const stage = page.getByTestId("honor-stage");
    await expect(stage).toHaveAttribute("data-phase", "ready");
    // Bậc 2 trống: chỉ có bậc 1 và 3 trên sân khấu, chưa bậc nào hiện.
    expect(await tiers(page).evaluateAll((nodes) => nodes.map((n) => n.getAttribute("data-rank")))).toEqual(["1", "3"]);
    expect(await revealedRanks(page)).toEqual([]);
    await shot(page, "honors-ready", project);

    // Bàn phím: Enter trên nút Bắt đầu → hạng 3 (Mây, 20 điểm).
    const start = page.getByRole("button", { name: "Bắt đầu" });
    await start.focus();
    await page.keyboard.press("Enter");
    expect(await revealedRanks(page)).toEqual([3]);
    await expect(page.getByTestId("honor-announce")).toContainText("Hạng 3: Mây, 20 điểm");
    await expect(tiers(page).filter({ visible: true })).toHaveCount(1);
    await expect(page.getByTestId("honor-halo")).toHaveCount(0);
    await shot(page, "honors-rank3", project);

    // Tiếp tục → bỏ qua bậc 2 → hạng 1 (Bống và Na cùng một bậc), hào quang + hoa giấy.
    await page.getByRole("button", { name: "Tiếp tục" }).click();
    expect(await revealedRanks(page)).toEqual([1, 3]);
    const top = page.locator('[data-testid="honor-tier"][data-rank="1"]');
    await expect(top.getByTestId("honor-entry")).toHaveCount(2);
    await expect(top).toContainText("Bống");
    await expect(top).toContainText("Na");
    await expect(top).toContainText("40 điểm");
    await expect(page.getByTestId("honor-halo")).toBeVisible();
    await expect(page.getByTestId("honor-confetti")).toBeVisible();
    await shot(page, "honors-rank1", project);

    // Bỏ qua → tổng kết; không bạn hạng 4 hay bạn ẩn; HTML không có mã định danh.
    await page.getByRole("button", { name: "Bỏ qua" }).click();
    await expect(stage).toHaveAttribute("data-phase", "summary");
    await expect(page.getByTestId("honor-summary-title")).toBeVisible();
    const shown = (await page.getByTestId("honor-entry").allInnerTexts()).join(" | ");
    expect(shown).not.toContain("Tí");
    expect(shown).not.toContain("Ẩn Danh");
    await expect(page.getByTestId("honor-entry")).toHaveCount(3);
    // HTML thô từ máy chủ (Next giữ trang trước ẩn trong DOM nên page.content() lẫn dữ liệu trang bảng điểm).
    const html = await (await page.request.get(page.url())).text();
    for (const id of [may.id, bong.id, na.id, ti.id, hidden.id]) expect(html).not.toContain(id);
    await noHorizontalScroll(page);
    await axeClean(page);
    await shot(page, "honors-summary", project);

    // Xem lại → phát từ đầu, không tạo ảnh chụp mới.
    await page.getByRole("button", { name: "Xem lại" }).click();
    await expect(stage).toHaveAttribute("data-phase", "ready");
    expect(await revealedRanks(page)).toEqual([]);
    expect(await snapshotCount(cls.id)).toBe(1);

    // Giảm chuyển động (hệ điều hành): không hoa giấy, hào quang tĩnh; Bỏ qua/Xem lại vẫn dùng được.
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.getByRole("button", { name: "Bắt đầu" }).click();
    await page.getByRole("button", { name: "Tiếp tục" }).click();
    await expect(page.locator('[data-motion="reduce"]').first()).toBeVisible();
    await expect(page.getByTestId("honor-confetti")).toBeHidden();
    expect(await page.getByTestId("honor-halo").evaluate((element) => getComputedStyle(element).animationName)).toBe(
      "none",
    );
    await page.getByRole("button", { name: "Bỏ qua" }).click();
    await expect(stage).toHaveAttribute("data-phase", "summary");
    await page.emulateMedia({ reducedMotion: "no-preference" });

    // Thoát → về trang bảng điểm; lịch sử có đúng một mục; Xem lại từ lịch sử mở cùng ảnh chụp, không tạo mới.
    await page.getByRole("link", { name: "Thoát trình chiếu" }).click();
    await expect(page).toHaveURL(new RegExp(`/teacher/classes/${cls.id}/leaderboard$`, "u"));
    const history = page.getByTestId("honor-history").getByRole("listitem");
    await expect(history).toHaveCount(1);
    await history.getByRole("link", { name: /Xem lại lần vinh danh mùa 1/u }).click();
    await expect(page).toHaveURL(snapshotUrl);
    await expect(page.getByTestId("honor-stage")).toHaveAttribute("data-phase", "ready");
    expect(await snapshotCount(cls.id)).toBe(1);

    // Điểm và mùa không đổi sau toàn bộ luồng.
    expect(await scores(cls.id)).toBe(scoresBefore);
    expect(await seasons(cls.id)).toBe(seasonsBefore);

    // GV lớp khác: không thấy ảnh chụp (không phân biệt "không tồn tại" với "không có quyền").
    const otherContext = await browser.newContext({ locale: "vi-VN" });
    const other = await otherContext.newPage();
    await login(other, TEACHER_B);
    await other.goto(snapshotUrl);
    await expect(other.getByRole("heading", { name: "Không tìm thấy trang" })).toBeVisible();
    await expect(other.getByText("Bống")).toHaveCount(0);
    await otherContext.close();

    // Cờ hệ thống tắt (chưa phê duyệt): khu vực khóa, nút khóa, trình chiếu cũ không mở được; bật lại trong finally.
    setLocalHonorsApproval(false);
    try {
      await page.goto(`/teacher/classes/${cls.id}/leaderboard`);
      await expect(page.getByText(/chưa được chấp thuận ở cấp hệ thống nên chưa dùng được/u)).toBeVisible();
      await expect(page.getByRole("button", { name: "Vinh danh TOP 3" })).toBeDisabled();
      await page.goto(snapshotUrl);
      await expect(page.getByRole("heading", { name: "Vinh danh chưa dùng được" })).toBeVisible();
      await expect(page.getByTestId("honor-stage")).toHaveCount(0);
      expect(await snapshotCount(cls.id)).toBe(1);
    } finally {
      setLocalHonorsApproval(true);
    }
  });

  test("lớp chưa có bạn nào đủ điều kiện: bấm vinh danh báo thân thiện và không tạo ảnh chụp", async ({
    page,
  }, testInfo) => {
    test.slow();
    const cls = await freshClass("VD-RONG");
    await newMember(cls, "Chưa Điểm");
    await must(admin.from("classes").update({ honors_enabled: true }).eq("id", cls.id).select("id"));
    await login(page, TEACHER_A);
    await page.goto(`/teacher/classes/${cls.id}/leaderboard`);
    await page.getByRole("button", { name: "Vinh danh TOP 3" }).click();
    await expect(
      page.getByRole("alert").filter({ hasText: "Chưa có bạn nào đủ điều kiện được vinh danh" }),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/leaderboard$/u);
    expect(await snapshotCount(cls.id)).toBe(0);
    await shot(page, "honors-empty", testInfo.project.name);
  });
});
