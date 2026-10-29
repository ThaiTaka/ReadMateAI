import { expect, test, type Page } from "@playwright/test";
import { vi } from "../../src/strings/vi";
import { freshTeacher, ttsLine, type TeacherWorld } from "./audio-fixtures";
import { admin, axeClean, link, newMember, noHorizontalScroll, resetRateLimits, freshClass } from "./class-fixtures";

/**
 * R10.5 — giáo viên quản lý thư viện giọng máy ở /teacher/tts-script trên Supabase local + Storage local: duyệt lời đọc → (tạo âm thanh cần nhà
 * cung cấp) → NGHE → duyệt/từ chối/thu hồi tệp. Máy chủ E2E KHÔNG có TTS_PROVIDER nên không có yêu cầu nào tới dịch vụ giọng máy: nút Tạo âm thanh
 * khóa và nói rõ. Tệp dùng ở đây là SÓNG SIN TỔNG HỢP đã đi qua đúng các hàm teacher_*. Cờ thư viện chỉ bật trên local trong lúc chạy.
 */

const t = vi.ttsLibrary;
const LINE = "instruction:listen_letter";

async function loginTeacher(page: Page, world: TeacherWorld) {
  await resetRateLimits();
  await page.goto("/login");
  await page.getByLabel("Email").fill(world.email);
  await page.getByLabel("Mật khẩu").fill(world.password);
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await page.waitForURL(/\/teacher$/u);
}

const card = (page: Page, id = LINE) => page.locator(`article[data-line="${id}"]`);

async function openLibrary(page: Page) {
  await page.goto("/teacher/tts-script");
  await expect(page.getByRole("heading", { level: 1, name: t.title })).toBeVisible();
}

test.describe("R10.5 — thư viện giọng máy của giáo viên", () => {
  test("danh sách 34 lời đọc cố định; chưa kết nối nhà cung cấp thì nói thật và nút Tạo âm thanh khóa; duyệt và từ chối LỜI ĐỌC", async ({
    page,
  }) => {
    const world = await freshTeacher("ttsgv");
    await loginTeacher(page, world);
    await openLibrary(page);

    await expect(page.locator("article[data-line]")).toHaveCount(34);
    await expect(page.locator('article[data-line^="instruction:"]')).toHaveCount(17);
    await expect(page.locator('article[data-line^="feedback:"]')).toHaveCount(17);
    await expect(page.getByText(t.notices.noProviderTitle)).toBeVisible();
    await expect(page.getByText(t.notices.disabledTitle)).toHaveCount(0); // cờ thư viện đang bật (local)
    await expect(page.getByTestId("tts-stat-usable")).toHaveText("0");
    await expect(page.getByTestId("tts-generate-missing")).toBeDisabled();
    // Lời đọc chưa duyệt: chưa cho tạo âm thanh (không có nút), nhắc duyệt trước.
    await expect(card(page).getByText(t.audio.needScript)).toBeVisible();
    await expect(card(page).getByRole("button", { name: t.audio.generate })).toHaveCount(0);
    // Thư viện đã hoạt động nên các thẻ lời đọc không còn nhãn "Sắp có". (Phần xem trước lời đọc của từng tiếng/từ/câu bài tập ở dưới và thanh bên
    // vẫn ghi "Sắp có" vì những phần đó CHƯA xây dựng — nhãn đúng sự thật.)
    await expect(page.locator("article[data-line]").getByText(/Sắp có|dự kiến/iu)).toHaveCount(0);

    // Duyệt lời đọc cần tích xác nhận cách đọc.
    const approve = card(page).getByRole("button", { name: t.script.approve });
    await expect(approve).toBeDisabled();
    await card(page).getByLabel(t.script.confirm).check();
    await approve.click();
    await expect(card(page).getByText(t.script.approved, { exact: true }).first()).toBeVisible();
    const review = await admin
      .from("tts_script_reviews")
      .select("decision, pronunciation_confirmed, reviewed_by")
      .eq("school_id", world.schoolId)
      .eq("entry_id", LINE);
    expect(review.data).toEqual([
      { decision: "approved", pronunciation_confirmed: true, reviewed_by: world.teacherId },
    ]);

    // Đã duyệt lời đọc nhưng chưa có nhà cung cấp: nút Tạo âm thanh hiện ra nhưng KHÓA (không gửi gì đi đâu).
    const generate = card(page).getByRole("button", { name: t.audio.generate });
    await expect(generate).toBeVisible();
    await expect(generate).toBeDisabled();

    // Từ chối lời đọc khác cần ghi chú.
    const other = card(page, "instruction:picture_onset");
    await other.locator("summary").filter({ hasText: t.script.reject }).click(); // phần mở ghi chú (nút cùng tên đang khóa)
    const rejectButton = other.getByRole("button", { name: t.script.reject });
    await expect(rejectButton).toBeDisabled();
    await other.getByLabel(t.script.rejectNote).fill("Cần đổi cách xưng hô");
    await rejectButton.click();
    await expect(other.getByText(t.script.rejected, { exact: true }).first()).toBeVisible();
    const rejected = await admin
      .from("tts_script_reviews")
      .select("decision, note")
      .eq("school_id", world.schoolId)
      .eq("entry_id", "instruction:picture_onset");
    expect(rejected.data).toEqual([{ decision: "rejected", note: "Cần đổi cách xưng hô" }]);
  });

  test("tệp chờ duyệt: NGHE được (tệp riêng tư qua máy chủ), duyệt cần đã nghe + xác nhận cách đọc; dùng được → thu hồi", async ({
    page,
    browser,
  }) => {
    test.setTimeout(180_000);
    const world = await freshTeacher("ttsgv2");
    const line = await ttsLine(world, LINE, { stage: "pending" });
    await loginTeacher(page, world);
    await openLibrary(page);

    const player = card(page).locator("audio");
    await expect(player).toHaveCount(1);
    const src = (await player.getAttribute("src"))!;
    expect(src).toBe(`/api/teacher/tts-library/versions/${line.versionId}/audio`);
    await expect(player).toHaveAttribute("preload", "none"); // không tự tải/tự phát
    await expect(card(page).getByText(t.audio.pending_review, { exact: true }).first()).toBeVisible();

    // Tệp phát được cho giáo viên của trường: riêng tư, không đoán định dạng, hỗ trợ Range (Safari).
    const file = await page.request.get(src);
    expect(file.status()).toBe(200);
    expect(file.headers()["content-type"]).toBe("audio/wav");
    expect(file.headers()["cache-control"]).toBe("private, no-store");
    expect(file.headers()["x-content-type-options"]).toBe("nosniff");
    expect((await file.body()).byteLength).toBe(line.bytes.byteLength);
    const part = await page.request.get(src, { headers: { range: "bytes=0-9" } });
    expect(part.status()).toBe(206);
    // Giáo viên trường khác và học sinh KHÔNG nghe được tệp này (RLS + xác thực), không lộ khóa lưu trữ.
    const outsider = await freshTeacher("ttsgv3");
    const outsiderContext = await browser.newContext({ locale: "vi-VN" });
    const outsiderPage = await outsiderContext.newPage();
    await loginTeacher(outsiderPage, outsider);
    expect((await outsiderPage.request.get(src)).status()).toBe(404);
    await outsiderContext.close();
    const cls = await freshClass("TTS-hs");
    const member = await newMember(cls, "Em");
    const studentContext = await browser.newContext({ locale: "vi-VN" });
    const studentPage = await studentContext.newPage();
    await link(studentPage, member.backup);
    expect([401, 403]).toContain((await studentPage.request.get(src)).status());
    await studentContext.close();
    expect(await page.content()).not.toMatch(/tts-audio|storage_key|storageKey|\/storage\/v1/u);

    // Duyệt tệp: nút khóa cho tới khi tích cả hai ô.
    const approve = card(page).getByRole("button", { name: t.audio.approve });
    await expect(approve).toBeDisabled();
    await card(page).getByLabel(t.audio.listened).check();
    await expect(approve).toBeDisabled();
    await card(page).getByLabel(t.audio.pronunciation).check();
    await approve.click();
    await expect(card(page).getByText(t.audio.approved, { exact: true }).first()).toBeVisible();
    await expect(page.getByTestId("tts-stat-usable")).toHaveText("1");
    const row = await admin
      .from("tts_audio_versions")
      .select("status, review_listened, review_pronunciation_confirmed, reviewed_by")
      .eq("id", line.versionId)
      .single();
    expect(row.data).toEqual({
      status: "approved",
      review_listened: true,
      review_pronunciation_confirmed: true,
      reviewed_by: world.teacherId,
    });

    // Thu hồi cần lý do.
    await card(page).getByText(t.audio.revoke, { exact: true }).first().click();
    const revoke = card(page).getByRole("button", { name: t.audio.revoke }).last();
    await expect(revoke).toBeDisabled();
    await card(page).getByLabel(t.audio.revokeReason).fill("Phát âm chưa đúng");
    await revoke.click();
    await expect(card(page).getByText(t.audio.revoked, { exact: true }).first()).toBeVisible();
    await expect(page.getByTestId("tts-stat-usable")).toHaveText("0");
    const revoked = await admin
      .from("tts_audio_versions")
      .select("status, revoke_reason")
      .eq("id", line.versionId)
      .single();
    expect(revoked.data).toEqual({ status: "revoked", revoke_reason: "Phát âm chưa đúng" });
  });

  test("màn hình hẹp 360 px + bàn phím: không tràn ngang, nút ≥ 48 px, axe sạch", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium-desktop", "Đo bố cục một lần (chromium-desktop).");
    test.setTimeout(120_000);
    const world = await freshTeacher("ttsgv4");
    await ttsLine(world, LINE, { stage: "pending" });
    await page.setViewportSize({ width: 360, height: 780 });
    await loginTeacher(page, world);
    await openLibrary(page);
    await noHorizontalScroll(page);
    for (const button of await card(page).getByRole("button").all()) {
      if (!(await button.isVisible())) continue;
      expect((await button.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(47.5);
    }
    await axeClean(page);
  });
});
