import { execSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { createClient } from "@supabase/supabase-js";
import { devices, expect, test, type Browser, type Page } from "@playwright/test";

/**
 * Luồng tài khoản thật trên Supabase local (dữ liệu giả của `npm run db:seed`):
 * GV đăng nhập → quản lý lớp → thêm học sinh → cấp thẻ học → thiết bị Android/iPhone quét QR hoặc nhập mã dự phòng
 * → trang của con → GV thu hồi → thiết bị mất quyền ngay. Kèm kiểm tra phân quyền, axe, cỡ màn hình và ảnh chụp.
 */

process.loadEnvFile?.(".env.local");
const PASSWORD = process.env.SEED_TEACHER_PASSWORD ?? "";
const DOMAIN = ["readmate", "test"].join(".");
const TEACHER_A = ["co.mai", DOMAIN].join("@");
const TEACHER_B = ["thay.binh", DOMAIN].join("@");
const CLASS_A = "5eed0000-0000-4000-8000-0000000000a1";
const CLASS_B = "5eed0000-0000-4000-8000-0000000000b1";

const status = JSON.parse(
  (() => {
    const raw = execSync("npx supabase status -o json", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    return raw.slice(raw.indexOf("{"));
  })(),
) as Record<string, string>;
const admin = createClient(status.API_URL!, status.SECRET_KEY!, { auth: { persistSession: false } });

async function resetRateLimits() {
  await admin.from("rate_limit_buckets").delete().neq("key_hash", "");
}

async function login(page: Page, email: string, password = PASSWORD, expectSuccess = true) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Mật khẩu").fill(password);
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  if (expectSuccess) await page.waitForURL(/\/teacher$/u);
}

/** Next.js có vùng thông báo điều hướng (role=alert) riêng — lọc theo nội dung. */
const alertWith = (page: Page, text: string | RegExp) => page.getByRole("alert").filter({ hasText: text });

async function noHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
}

async function axeClean(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  const serious = results.violations.filter(
    (violation) => violation.impact === "critical" || violation.impact === "serious",
  );
  expect(serious.map((violation) => `${violation.id}: ${violation.help}`)).toEqual([]);
}

async function deviceContext(browser: Browser, kind: "android" | "iphone") {
  return browser.newContext({ ...(kind === "android" ? devices["Pixel 7"] : devices["iPhone 13"]), locale: "vi-VN" });
}

test.beforeAll(async () => {
  expect(PASSWORD, "Thiếu SEED_TEACHER_PASSWORD (.env.local — npm run db:env)").not.toBe("");
  await resetRateLimits();
});

test.describe("xác thực giáo viên", () => {
  test("chưa đăng nhập vào /teacher → trang đăng nhập có lý do; không lộ dữ liệu", async ({ page }) => {
    await page.goto("/teacher/classes");
    await expect(page).toHaveURL(/\/login\?reason=required/u);
    await expect(page.getByRole("note")).toContainText("Vui lòng đăng nhập");
    await expect(page.getByText("Lớp Mây Hồng")).toHaveCount(0);
  });

  test("sai mật khẩu → thông báo chung, vẫn ở trang đăng nhập", async ({ page }) => {
    await login(page, TEACHER_A, `${PASSWORD}sai`, false);
    await expect(alertWith(page, "Email hoặc mật khẩu chưa đúng.")).toBeVisible();
    await expect(page).toHaveURL(/\/login/u);
  });

  test("đăng nhập đúng → chỉ thấy lớp của mình; lớp khác trả 404; đăng xuất xong không vào lại được", async ({
    page,
  }) => {
    await login(page, TEACHER_A);
    await expect(page).toHaveURL(/\/teacher$/u);
    await expect(page.getByText(/Xin chào, Cô Mai/u)).toBeVisible();
    await page.goto("/teacher/classes");
    await expect(page.getByRole("link", { name: /Lớp Mây Hồng/u })).toBeVisible();
    await expect(page.getByText("Lớp Nắng Vàng")).toHaveCount(0);
    // RLS không trả dòng → notFound(). Phần này được stream sau khung trang nên mã HTTP vẫn là 200 (hành vi của
    // Next khi streaming) — kiểm tra nội dung "Không tìm thấy trang" và không có dữ liệu lớp B.
    await page.goto(`/teacher/classes/${CLASS_B}`);
    await expect(page.getByRole("heading", { name: "Không tìm thấy trang" })).toBeVisible();
    await expect(page.getByText("Lớp Nắng Vàng")).toHaveCount(0);

    await page.goto("/teacher");
    await page.getByRole("button", { name: "Đăng xuất" }).first().click();
    await expect(page).toHaveURL(/\/login\?reason=signed_out/u);
    await page.goto("/teacher");
    await expect(page).toHaveURL(/\/login/u);
  });
});

test.describe("thẻ học → thiết bị → thu hồi", () => {
  test.describe.configure({ mode: "serial" });

  test("GV thêm học sinh, cấp thẻ; Android và iPhone quét QR / nhập mã dự phòng; GV thu hồi thiết bị", async ({
    page,
    browser,
  }, testInfo) => {
    test.slow();
    await resetRateLimits();
    // 8 chữ cái ngẫu nhiên (26^8): 4 ký tự cũ (≈2.400 khả năng) đụng tên học sinh của các lần chạy trước → chọn nhầm hồ sơ cũ.
    const name = `Hạt ${[...randomBytes(8)].map((byte) => String.fromCharCode(97 + (byte % 26))).join("")}`;
    await login(page, TEACHER_A);
    await page.goto(`/teacher/classes/${CLASS_A}/students`);
    await page.getByLabel("Biệt danh", { exact: true }).fill(name);
    await page.getByRole("button", { name: "Thêm học sinh" }).click();
    await page.getByRole("link", { name: new RegExp(name, "u") }).click();
    await expect(page.getByRole("heading", { level: 1 })).toContainText(name);

    await page.getByRole("button", { name: "Cấp thẻ học mới" }).click();
    const issued = page.getByRole("region", { name: /Thẻ học mới/u });
    await expect(issued).toBeVisible();
    await expect(
      issued.getByRole("img", { name: new RegExp(`Mã QR liên kết thiết bị của ${name}`, "u") }),
    ).toBeVisible();
    const joinUrl = (await issued.getByText(/\/join#c=/u).textContent())?.trim() ?? "";
    const backup = (await issued.locator("dd.font-reading").textContent())?.trim() ?? "";
    expect(joinUrl).toMatch(/\/join#c=[A-Za-z0-9_-]{43}$/u);
    expect(backup).toMatch(/^[0-9A-Z]{4}-[0-9A-Z]{4}$/u);
    await page.screenshot({ path: testInfo.outputPath("teacher-student-issued-code.png"), fullPage: true });

    // Android: "quét QR" = mở đúng liên kết trên thẻ (mã nằm ở fragment, không gửi lên máy chủ trong URL).
    const android = await deviceContext(browser, "android");
    const phone = await android.newPage();
    const requested: string[] = [];
    phone.on("request", (request) => requested.push(request.url()));
    await phone.goto(joinUrl);
    await expect(phone).toHaveURL(/\/learn\/me$/u, { timeout: 30_000 });
    await expect(phone.getByRole("heading", { level: 1 })).toContainText(`Trang của ${name}`);
    expect(requested.some((url) => url.includes(joinUrl.split("#c=")[1]!))).toBe(false);
    await noHorizontalScroll(phone);
    await axeClean(phone);
    await phone.screenshot({ path: testInfo.outputPath("android-learn-me.png"), fullPage: true });

    // Học sinh chọn avatar + giảm chuyển động → lưu ở máy chủ.
    await phone.getByText("Bạn tóc xoăn").click();
    await phone.getByLabel("Giảm chuyển động").check();
    await phone.getByRole("button", { name: "Lưu" }).click();
    await expect(phone.getByRole("status").filter({ hasText: "Đã lưu!" })).toBeVisible();
    await expect(async () => {
      const row = await admin
        .from("students")
        .select("avatar_key, motion_preference")
        .eq("display_name", name)
        .single();
      expect(row.data).toEqual({ avatar_key: "bong", motion_preference: "reduce" });
    }).toPass();
    expect(await phone.evaluate(() => Object.keys(localStorage).length + Object.keys(sessionStorage).length)).toBe(0);

    // iPhone: nhập mã dự phòng (gõ thường, không gạch nối vẫn nhận).
    const iphone = await deviceContext(browser, "iphone");
    const iPage = await iphone.newPage();
    await iPage.goto("/join");
    await iPage.getByLabel("Mã dự phòng trên thẻ học").fill(backup.replace("-", "").toLowerCase());
    await iPage.getByRole("button", { name: "Liên kết thiết bị" }).click();
    await expect(iPage).toHaveURL(/\/learn\/me$/u, { timeout: 30_000 });
    await expect(iPage.getByRole("heading", { level: 1 })).toContainText(name);
    await iPage.screenshot({ path: testInfo.outputPath("iphone-learn-me.png"), fullPage: true });

    // Thiết bị học sinh vào khu vực GV → về trang đăng nhập.
    await iPage.goto("/teacher");
    await expect(iPage).toHaveURL(/\/login\?reason=student_device/u);

    // GV thu hồi cả hai thiết bị → tải lại là mất quyền ngay.
    await page.reload();
    // Chờ trang hydrate xong: bấm nút Server Action trước khi hydrate trên máy chậm/điện thoại bị bỏ qua (flaky ở chromium-mobile).
    await page.waitForLoadState("networkidle");
    for (let index = 0; index < 2; index += 1) {
      await page.getByRole("button", { name: "Thu hồi thiết bị" }).first().click();
      await expect(page.getByRole("button", { name: "Thu hồi thiết bị" })).toHaveCount(1 - index);
    }
    await phone.reload();
    await expect(phone.getByRole("heading", { name: "Thiết bị này chưa liên kết thẻ học" })).toBeVisible();
    await iPage.goto("/learn/me");
    await expect(iPage.getByRole("heading", { name: "Thiết bị này chưa liên kết thẻ học" })).toBeVisible();

    await android.close();
    await iphone.close();
  });

  test("mã sai → một thông báo chung, không lộ thông tin học sinh", async ({ page }) => {
    await resetRateLimits();
    await page.goto("/join");
    await page.getByLabel("Mã dự phòng trên thẻ học").fill("ZZZZ-9999");
    await page.getByRole("button", { name: "Liên kết thiết bị" }).click();
    await expect(alertWith(page, "Mã chưa đúng hoặc đã hết hạn")).toBeVisible();
    await expect(page.getByText(/Bống|Su Su|Lớp Mây Hồng/u)).toHaveCount(0);
    await page.goto("/learn/me");
    await expect(page.getByRole("heading", { name: "Thiết bị này chưa liên kết thẻ học" })).toBeVisible();
  });

  test("mã QR không hợp lệ trên thẻ → gợi ý nhập mã dự phòng", async ({ page }) => {
    await resetRateLimits();
    await page.goto(`/join#c=${"A".repeat(43)}`);
    await expect(alertWith(page, "Mã QR trên thẻ không dùng được")).toBeVisible();
    expect(page.url()).not.toContain("#c=");
  });
});

test.describe("đồng ý, tên hiển thị, tiến độ chương trình", () => {
  test("ghi nhận và rút đồng ý ba trạng thái; tiến độ lớp hiện 'Chưa xác nhận'", async ({ page }) => {
    await resetRateLimits();
    // Đưa hồ sơ GIẢ "Tí Nị" về trạng thái chưa có đồng ý (Supabase local) để test chạy lặp lại được.
    await admin.from("guardian_consents").delete().eq("student_id", "5eed0000-0000-4000-8000-00000000a003");
    await login(page, TEACHER_A);
    await page.goto(`/teacher/classes/${CLASS_A}`);
    await expect(page.getByText("Chưa xác nhận").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Xác nhận tiến độ" })).toBeDisabled();
    await expect(page.getByText(/Bảng xếp hạng trong lớp/u)).toBeVisible();

    await page.goto(`/teacher/classes/${CLASS_A}/students`);
    await page.getByRole("link", { name: /Tí Nị/u }).click();
    const leaderboard = page.getByRole("region", { name: /Hiển thị trên bảng xếp hạng lớp/u });
    await expect(leaderboard.getByText("Chưa xác nhận")).toBeVisible();
    await leaderboard.getByRole("button", { name: "Ghi nhận đồng ý" }).click();
    // Thiếu ô xác nhận đã nhận phiếu → trình duyệt chặn gửi (required); bản ghi không được tạo.
    await expect(leaderboard.getByText("Chưa xác nhận")).toBeVisible();
    await leaderboard.getByLabel(/Tôi xác nhận đã nhận phiếu đồng ý hợp lệ/u).check();
    await leaderboard.getByRole("button", { name: "Ghi nhận đồng ý" }).click();
    await expect(leaderboard.getByText("Đã xác nhận hợp lệ")).toBeVisible();
    await leaderboard.getByLabel(/phụ huynh đã đề nghị rút lại/u).check();
    await leaderboard.getByRole("button", { name: "Rút lại đồng ý" }).click();
    await expect(leaderboard.getByText("Đã rút lại")).toBeVisible();
    await axeClean(page);
  });
});

test.describe("bố cục khu vực GV và thiết bị ở 6 cỡ màn hình", () => {
  for (const width of [360, 375, 390, 768, 1024, 1440]) {
    test(`${width}px: đăng nhập, liên kết thiết bị, lớp học, học sinh không cuộn ngang`, async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== "chromium-desktop", "Đo bố cục một lần (chromium-desktop).");
      await resetRateLimits();
      await page.setViewportSize({ width, height: 900 });
      for (const path of ["/login", "/join", "/learn/me"]) {
        await page.goto(path);
        await noHorizontalScroll(page);
      }
      await login(page, TEACHER_A);
      await expect(page).toHaveURL(/\/teacher$/u);
      for (const path of [
        "/teacher/classes",
        `/teacher/classes/${CLASS_A}`,
        `/teacher/classes/${CLASS_A}/students`,
        `/teacher/classes/${CLASS_A}/students/5eed0000-0000-4000-8000-00000000a001`,
      ]) {
        await page.goto(path);
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        await noHorizontalScroll(page);
        if (width === 390 || width === 1440) {
          await page.screenshot({
            path: testInfo.outputPath(`${width}${path.replaceAll("/", "_")}.png`),
            fullPage: true,
          });
        }
      }
      await axeClean(page);
    });
  }
});

test("GV lớp B không thấy học sinh lớp A kể cả khi biết đường dẫn (hiện trang không tìm thấy)", async ({ page }) => {
  await resetRateLimits();
  await login(page, TEACHER_B);
  await expect(page).toHaveURL(/\/teacher$/u);
  await page.goto(`/teacher/classes/${CLASS_A}/students/5eed0000-0000-4000-8000-00000000a001`);
  await expect(page.getByRole("heading", { name: "Không tìm thấy trang" })).toBeVisible();
  await expect(page.getByText("Bống")).toHaveCount(0);
});
