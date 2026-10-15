import { expect, test } from "./fixtures";

test.describe("điều hướng", () => {
  test("đi qua các trang bằng menu và liên kết", async ({ page, isMobile }) => {
    test.skip(isMobile, "Menu ngang chỉ hiển thị trên màn hình rộng — menu di động có kiểm thử riêng.");
    const mainNav = page.getByRole("navigation", { name: "Điều hướng chính" });

    await page.goto("/");
    await mainNav.getByRole("link", { name: "Bản demo" }).click();
    await expect(page).toHaveURL(/\/demo$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Chơi thử bài luyện đọc lớp 1");
    await expect(mainNav.getByRole("link", { name: "Bản demo" })).toHaveAttribute("aria-current", "page");

    await mainNav.getByRole("link", { name: "Liên kết thiết bị" }).click();
    await expect(page).toHaveURL(/\/join$/);

    await mainNav.getByRole("link", { name: "Học sinh" }).click();
    await expect(page).toHaveURL(/\/learn$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Chào con!");

    await page.getByRole("link", { name: "Trang chủ" }).click();
    await expect(page).toHaveURL(/\/$/);

    await page.getByRole("link", { name: "Khu vực giáo viên" }).click();
    await expect(page).toHaveURL(/\/teacher$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Bảng điều khiển giáo viên");

    await page.getByRole("link", { name: "ReadMate AI — về trang chủ" }).click();
    await expect(page).toHaveURL(/\/$/);
  });

  test("menu di động mở, điều hướng rồi tự đóng; phím Escape đóng menu", async ({ page, isMobile }) => {
    test.skip(!isMobile, "Chỉ áp dụng cho màn hình điện thoại.");
    await page.goto("/");

    const toggle = page.getByRole("button", { name: "Mở menu điều hướng" });
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await toggle.click();

    const menu = page.getByRole("navigation", { name: "Điều hướng chính" });
    await expect(menu).toBeVisible();
    await expect(page.getByRole("button", { name: "Đóng menu điều hướng" })).toHaveAttribute("aria-expanded", "true");

    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();

    await page.getByRole("button", { name: "Mở menu điều hướng" }).click();
    await menu.getByRole("link", { name: "Bản demo" }).click();
    await expect(page).toHaveURL(/\/demo$/);
    await expect(menu).toBeHidden();
  });

  test("liên kết bỏ qua điều hướng đưa focus tới nội dung chính", async ({ page, isMobile, browserName }) => {
    test.skip(isMobile, "Điều hướng bằng phím Tab dành cho bàn phím vật lý.");
    // Safari/WebKit mặc định không đưa liên kết vào thứ tự phím Tab (tùy chọn hệ thống "Tab highlights").
    test.skip(browserName === "webkit", "WebKit bỏ qua liên kết khi nhấn Tab theo mặc định của Safari.");
    await page.goto("/");

    await page.keyboard.press("Tab");
    const skipLink = page.getByRole("link", { name: "Bỏ qua, đến nội dung chính" });
    await expect(skipLink).toBeFocused();
    await expect(skipLink).toBeVisible();

    await page.keyboard.press("Enter");
    await expect(page.locator("#noi-dung-chinh")).toBeFocused();
  });

  test("chọn lộ trình ở /demo bằng bàn phím; focus chuyển tới tiêu đề bước tiếp theo", async ({ page }) => {
    await page.goto("/demo");
    const path = page.getByRole("button", { name: /Vững bước/ });
    await path.focus();
    await page.keyboard.press("Enter");
    const heading = page.getByRole("heading", { level: 3, name: "Vững bước" });
    await expect(heading).toBeVisible();
    await expect(heading).toBeFocused();
    await expect(page.getByRole("button", { name: /Bắt đầu buổi luyện/ })).toBeVisible();
  });
});
