import { expect, test, type Page } from "@playwright/test";
import { vi } from "../../src/strings/vi";
import { approvedRecording, freshTeacher, rpc, ttsLine, type TeacherWorld } from "./audio-fixtures";
import { axeClean, noHorizontalScroll, resetRateLimits } from "./class-fixtures";

/**
 * R10.5 — báo cáo độ phủ âm thanh ở /teacher/audio-coverage trên Supabase local + Storage local. Dữ liệu dựng bằng đúng các hàm teacher_*
 * (sóng sin tổng hợp, không giọng người thật, không gọi dịch vụ ngoài). Mỗi kịch bản dùng trường/giáo viên RIÊNG nên số đếm không lẫn.
 */

const t = vi.audioCoverage;

async function loginTeacher(page: Page, world: TeacherWorld) {
  await resetRateLimits();
  await page.goto("/login");
  await page.getByLabel("Email").fill(world.email);
  await page.getByLabel("Mật khẩu").fill(world.password);
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await page.waitForURL(/\/teacher$/u);
}

const stat = (page: Page, id: string) => page.getByTestId(`coverage-${id}`);
const numbers = async (page: Page, id: string) =>
  ((await stat(page, id).textContent()) ?? "").match(/\d+/gu)?.map(Number) ?? [];

test.describe("R10.5 — báo cáo độ phủ âm thanh", () => {
  test("chưa có gì: nói 'Chưa đủ', 0 / tổng ở mọi nhóm, nêu rõ vần/từ chưa theo dõi và lời phản hồi chưa nối vào màn hình học", async ({
    page,
  }) => {
    const world = await freshTeacher("cov0");
    await loginTeacher(page, world);
    await page.goto("/teacher/audio-coverage");
    await expect(page.getByRole("heading", { level: 1, name: t.title })).toBeVisible();

    await expect(page.getByTestId("coverage-verdict")).toHaveAttribute("data-complete", "no");
    await expect(page.getByTestId("coverage-verdict")).toContainText("Chưa đủ để nói “mọi chữ đều đọc được”");
    await expect(stat(page, "letters")).toHaveText("0 / 29 đã duyệt");
    await expect(stat(page, "instruction")).toHaveText("0 / 17 đã duyệt");
    await expect(stat(page, "feedback")).toHaveText("0 / 17 đã duyệt");
    expect((await numbers(page, "phonemes"))[0]).toBe(0);
    const study = await numbers(page, "study");
    expect(study[0]).toBe(0);
    expect(study[1]).toBeGreaterThan(29); // 29 tên chữ cái + các âm
    await expect(page.getByTestId("coverage-study")).toBeVisible();
    await expect(page.getByText(t.studyAllMapped)).toBeVisible(); // mọi nút nghe đã được nối đúng khe âm thanh

    await expect(page.locator('[data-testid="coverage-letters-list"] li')).toHaveCount(29);
    await expect(page.locator('[data-testid="coverage-instruction-list"] li')).toHaveCount(17);
    await expect(page.locator('[data-testid="coverage-feedback-list"] li')).toHaveCount(17);
    await expect(page.getByTestId("coverage-todo")).toContainText("Chưa có bản ghi đã duyệt");
    await expect(page.getByText(t.sections.feedback.notWired)).toBeVisible();
    await expect(page.getByTestId("coverage-untracked")).toContainText("Vần:");
    await expect(page.getByTestId("coverage-untracked")).toContainText("Tiếng, từ và câu");
    // Thanh bên có nhãn "Sắp có" cho các mục khu giáo viên chưa xây dựng — phần nội dung của trang này thì không.
    await expect(page.getByRole("main").getByText(/Sắp có|dự kiến/iu)).toHaveCount(0);

    // Mục này có trên thanh bên của giáo viên.
    const link = page
      .getByRole("navigation", { name: vi.a11y.teacherNav })
      .getByRole("link", { name: vi.teacher.sidebar.audioCoverage });
    await expect(link).toHaveCount(1);
    await expect(link).toHaveAttribute("href", "/teacher/audio-coverage");
  });

  test("chỉ tệp ĐÃ DUYỆT được tính; chờ duyệt thì không; trường khác không thấy số liệu của trường này", async ({
    page,
    browser,
  }) => {
    test.setTimeout(180_000);
    const world = await freshTeacher("cov1");
    await rpc(world.teacher, "teacher_grant_audio_consent", { p_notice_version: "v1" });
    await loginTeacher(page, world);
    await page.goto("/teacher/audio-coverage");
    const before = (await numbers(page, "study"))[0]!;

    await approvedRecording(world, "b", "bê", 0, "letter");
    await approvedRecording(world, "b", "bờ", 1, "phoneme");
    await ttsLine(world, "instruction:listen_letter"); // lời đọc + tệp đã duyệt → dùng được
    await ttsLine(world, "instruction:picture_onset", { stage: "pending" }); // tệp chờ duyệt → CHƯA tính
    await page.reload();

    await expect(stat(page, "letters")).toHaveText("1 / 29 đã duyệt");
    expect((await numbers(page, "phonemes"))[0]).toBe(1);
    await expect(stat(page, "instruction")).toHaveText("1 / 17 đã duyệt");
    expect((await numbers(page, "study"))[0]).toBe(before + 2); // nút nghe tên chữ b và âm b đã sẵn sàng
    await expect(page.locator('[data-unit="letter:b"][data-state="approved"]')).toHaveCount(1);
    await expect(page.locator('[data-line="instruction:listen_letter"][data-usable="yes"]')).toHaveCount(1);
    const pending = page.locator('[data-line="instruction:picture_onset"]');
    await expect(pending).toHaveAttribute("data-usable", "no");
    await expect(pending).toContainText(vi.ttsLibrary.audio.pending_review);
    await expect(page.getByTestId("coverage-verdict")).toHaveAttribute("data-complete", "no");

    // Giáo viên trường khác chỉ thấy số liệu của trường mình.
    const other = await freshTeacher("cov2");
    const context = await browser.newContext({ locale: "vi-VN" });
    const otherPage = await context.newPage();
    await loginTeacher(otherPage, other);
    await otherPage.goto("/teacher/audio-coverage");
    await expect(stat(otherPage, "letters")).toHaveText("0 / 29 đã duyệt");
    await expect(stat(otherPage, "instruction")).toHaveText("0 / 17 đã duyệt");
    await context.close();
  });

  test("màn hình hẹp 360 px: không tràn ngang, axe sạch", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium-desktop", "Đo bố cục một lần (chromium-desktop).");
    const world = await freshTeacher("cov3");
    await page.setViewportSize({ width: 360, height: 780 });
    await loginTeacher(page, world);
    await page.goto("/teacher/audio-coverage");
    await expect(page.getByRole("heading", { level: 1, name: t.title })).toBeVisible();
    await noHorizontalScroll(page);
    await axeClean(page);
  });
});
