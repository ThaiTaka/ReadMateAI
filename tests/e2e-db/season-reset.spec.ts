import { execSync } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { createClient } from "@supabase/supabase-js";
import { expect, test, type APIRequestContext, type Browser, type Page } from "@playwright/test";
import { generateLoginCode, hmacLoginCode, toPgBytea } from "../../src/features/login-codes/codes";

/**
 * R06.4 — giao diện reset điểm hai bước trên Supabase local. Lớp, học sinh, điểm đều là dữ liệu giả dựng riêng cho
 * từng kịch bản; điểm đến từ API chấm bài thật. Không đụng cờ hệ thống nào.
 */

process.loadEnvFile?.(".env.local");
const PASSWORD = process.env.SEED_TEACHER_PASSWORD ?? "";
const PEPPER = process.env.LOGIN_CODE_PEPPER ?? "";
const DOMAIN = ["readmate", "test"].join(".");
const TEACHER_A = ["co.mai", DOMAIN].join("@");
const TEACHER_B = ["thay.binh", DOMAIN].join("@");
const CLASS_C = "5eed0000-0000-4000-8000-0000000000c1";

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

async function addCoTeacher(cls: ClassRow, email: string) {
  // Không dùng listUsers: bảng người dùng có rất nhiều tài khoản ẩn danh của học sinh giả.
  const anon = createClient(status.API_URL!, status.PUBLISHABLE_KEY!, { auth: { persistSession: false } });
  const signedIn = await anon.auth.signInWithPassword({ email, password: PASSWORD });
  const user = signedIn.data.user;
  if (!user) throw new Error("Thiếu tài khoản GV giả — chạy npm run db:seed");
  await must(
    admin
      .from("class_staff")
      .insert({ class_id: cls.id, staff_id: user.id, role: "co_teacher", added_by: cls.ownerId }),
  );
}

type Member = { id: string; backup: string };

async function newMember(cls: ClassRow, alias: string): Promise<Member> {
  const name = `${alias} ${[...randomBytes(5)].map((byte) => String.fromCharCode(97 + (byte % 26))).join("")}`;
  const now = new Date().toISOString();
  const student = (await must(
    admin
      .from("students")
      .insert({
        class_id: cls.id,
        display_name: name,
        avatar_key: "may",
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
  for (const scope of ["learning_data", "leaderboard_display"] as const) {
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
  return { id: student.id, backup: code.backupCode };
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

type Option = { id: string; text: string };
type Question = { id: string; view: { content: { sample: string; options: Option[] } } };

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
  const context = await browser.newContext({ locale: "vi-VN" });
  const page = await context.newPage();
  await link(page, member.backup);
  await earnCorrect(context.request, count);
  await context.close();
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

type SeasonRow = { id: string; seq_no: number; status: string };
const seasonsOf = async (classId: string) =>
  (
    (await must(
      admin.from("seasons").select("id, seq_no, status").eq("class_id", classId).order("seq_no"),
    )) as SeasonRow[]
  ).map((row) => ({ ...row }));
const countBy = async (table: string, column: string, value: string) => {
  const { count: total, error } = await admin.from(table).select("*", { count: "exact", head: true }).eq(column, value);
  if (error) throw new Error(JSON.stringify(error));
  return total ?? 0;
};
const count = (table: string, classId: string) => countBy(table, "class_id", classId);

const OPEN = "BẮT ĐẦU MÙA MỚI";
const CONFIRM = "XÁC NHẬN BẮT ĐẦU MÙA MỚI";

test.beforeAll(() => {
  expect(PASSWORD, "Thiếu SEED_TEACHER_PASSWORD (.env.local — npm run db:env)").not.toBe("");
  expect(PEPPER, "Thiếu LOGIN_CODE_PEPPER (.env.local — npm run db:env)").not.toBe("");
});

test.describe("R06.4 — giao diện reset điểm", () => {
  test("chủ nhiệm: Esc/Hủy không đổi dữ liệu → sai tên không bật nút → bấm đúp chỉ tạo một mùa → điểm về 0, lịch sử giữ nguyên", async ({
    page,
    browser,
  }) => {
    test.slow();
    test.setTimeout(300_000);
    const cls = await freshClass("RS");
    const bong = await newMember(cls, "Bống");
    await earnFor(browser, bong, 3);
    const attemptsBefore = await count("item_attempts", cls.id);
    const eventsBefore = await count("point_events", cls.id);
    expect(eventsBefore).toBeGreaterThan(0);
    const [first] = await seasonsOf(cls.id);
    const oldScore = (await must(
      admin.from("season_scores").select("balance").eq("student_id", bong.id).eq("season_id", first!.id),
    )) as Array<{ balance: number }>;
    expect(oldScore[0]?.balance).toBe(30);

    await login(page, TEACHER_A);
    await page.goto(`/teacher/classes/${cls.id}/leaderboard`);
    const opener = page.getByRole("button", { name: OPEN, exact: true });
    await expect(opener).toBeEnabled();

    // Bàn phím: mở → Esc → focus trở lại nút mở; dữ liệu không đổi.
    await opener.focus();
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("Điểm của cả lớp trở về 0.");
    await expect(dialog).toContainText("Thao tác này không thể hoàn tác.");
    await expect(dialog).toContainText("Không ảnh hưởng lớp khác.");
    await axeClean(page);
    await noHorizontalScroll(page);
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(opener).toBeFocused();
    expect(await seasonsOf(cls.id)).toHaveLength(1);

    // Bước 1 → Hủy; bước 2 → Quay lại → Hủy: không gọi máy chủ.
    await opener.click();
    await dialog.getByRole("button", { name: "Hủy" }).click();
    await expect(dialog).toBeHidden();
    await opener.click();
    await dialog.getByRole("button", { name: "Tiếp tục" }).click();
    await expect(dialog.getByRole("heading", { name: "Xác nhận tên lớp" })).toBeVisible();
    await expect(dialog).toContainText(cls.name);
    const confirm = dialog.getByRole("button", { name: CONFIRM, exact: true });
    await expect(confirm).toBeDisabled();
    await dialog.getByRole("button", { name: "Quay lại" }).click();
    await expect(dialog.getByRole("button", { name: "Tiếp tục" })).toBeVisible();
    await dialog.getByRole("button", { name: "Tiếp tục" }).click();

    // Sai tên lớp (khác hoa/thường) → nút vẫn khóa.
    const input = dialog.getByLabel("Gõ lại tên lớp");
    await input.fill(cls.name.toLowerCase());
    await expect(confirm).toBeDisabled();
    await axeClean(page);
    await noHorizontalScroll(page);
    expect(await seasonsOf(cls.id)).toHaveLength(1);

    // Đúng tên → bấm đúp: chỉ một mùa mới.
    await input.fill(cls.name);
    await expect(confirm).toBeEnabled();
    await confirm.dblclick();
    await expect(dialog).toBeHidden({ timeout: 30_000 });
    await expect(page.getByText("Đã bắt đầu mùa 2. Điểm của lớp đã trở về 0.")).toBeVisible();

    const seasons = await seasonsOf(cls.id);
    expect(seasons.map((row) => [row.seq_no, row.status])).toEqual([
      [1, "closed"],
      [2, "active"],
    ]);
    expect(await count("season_resets", cls.id)).toBe(1);

    // Mùa mới: điểm 0, bản đồ che lại; mùa cũ và lịch sử học tập giữ nguyên.
    const current = (await must(
      admin
        .from("season_scores")
        .select("balance, earned_total")
        .eq("student_id", bong.id)
        .eq("season_id", seasons[1]!.id),
    )) as Array<{ balance: number; earned_total: number }>;
    expect(current.every((row) => row.balance === 0 && row.earned_total === 0)).toBe(true);
    expect(await countBy("map_tile_reveals", "season_id", seasons[1]!.id)).toBe(0);
    const kept = (await must(
      admin.from("season_scores").select("balance").eq("student_id", bong.id).eq("season_id", first!.id),
    )) as Array<{ balance: number }>;
    expect(kept[0]?.balance).toBe(30);
    expect(await count("item_attempts", cls.id)).toBe(attemptsBefore);
    expect(await count("point_events", cls.id)).toBe(eventsBefore);

    // Tải lại: trang dùng mùa mới (bảng nội bộ của GV hiện 0 điểm).
    await page.reload();
    await expect(page.getByText("Mùa 2").first()).toBeVisible();
    await expect(page.getByTestId("leaderboard-row").first()).toContainText("0");
    expect(await seasonsOf(cls.id)).toHaveLength(2);
  });

  test("tab cũ gặp SEASON_MISMATCH: không tạo mùa thứ ba, yêu cầu tải lại thông tin", async ({ browser }) => {
    test.slow();
    const cls = await freshClass("RT");
    const contextA = await browser.newContext({ locale: "vi-VN" });
    const contextB = await browser.newContext({ locale: "vi-VN" });
    const stale = await contextA.newPage();
    const fresh = await contextB.newPage();
    await login(stale, TEACHER_A);
    await login(fresh, TEACHER_A);
    for (const page of [stale, fresh]) await page.goto(`/teacher/classes/${cls.id}/leaderboard`);

    // Tab cũ mở sẵn bước 2 và gõ đúng tên.
    await stale.getByRole("button", { name: OPEN, exact: true }).click();
    const staleDialog = stale.getByRole("dialog");
    await staleDialog.getByRole("button", { name: "Tiếp tục" }).click();
    await staleDialog.getByLabel("Gõ lại tên lớp").fill(cls.name);

    // Tab mới reset trước.
    await fresh.getByRole("button", { name: OPEN, exact: true }).click();
    const freshDialog = fresh.getByRole("dialog");
    await freshDialog.getByRole("button", { name: "Tiếp tục" }).click();
    await freshDialog.getByLabel("Gõ lại tên lớp").fill(cls.name);
    await freshDialog.getByRole("button", { name: CONFIRM, exact: true }).click();
    await expect(freshDialog).toBeHidden({ timeout: 30_000 });
    expect(await seasonsOf(cls.id)).toHaveLength(2);

    await staleDialog.getByRole("button", { name: CONFIRM, exact: true }).click();
    await expect(staleDialog.getByRole("alert")).toContainText("Mùa thi đua đã thay đổi");
    await expect(staleDialog.getByRole("button", { name: CONFIRM, exact: true })).toHaveCount(0);
    expect(await seasonsOf(cls.id)).toHaveLength(2);

    await staleDialog.getByRole("button", { name: "Tải lại thông tin" }).click();
    await expect(staleDialog).toBeHidden();
    await expect(stale.getByText("Mùa 2").first()).toBeVisible();
    await contextA.close();
    await contextB.close();
  });

  test("co-teacher không thấy nút dùng được và không reset được; lớp khác không bị ảnh hưởng", async ({ page }) => {
    const cls = await freshClass("RC");
    const other = await freshClass("RO");
    await addCoTeacher(cls, TEACHER_B);
    await login(page, TEACHER_B);
    await page.goto(`/teacher/classes/${cls.id}/leaderboard`);
    await expect(page.getByRole("button", { name: OPEN, exact: true })).toBeDisabled();
    await expect(page.getByText("Chỉ giáo viên chủ nhiệm được bắt đầu mùa mới.")).toBeVisible();
    expect(await seasonsOf(cls.id)).toHaveLength(1);
    expect(await seasonsOf(other.id)).toHaveLength(1);
  });
});
