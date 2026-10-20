import { test as base, expect } from "@playwright/test";

/** h1 của trang chủ từ R02: thương hiệu + thông điệp chính. */
export const SLOGAN = "ReadMate AI – Học Tiếng Việt, khám phá thế giới kỳ diệu";

/**
 * Các route công khai và tiêu đề h1 mong đợi (R02: /learn dùng hồ sơ minh họa hư cấu "Mây").
 * R03: /teacher cần đăng nhập → thay bằng /login; chuyển hướng /teacher → /login kiểm ở routes.spec.ts.
 * Luồng có tài khoản thật: tests/e2e-db (npm run test:e2e:db).
 */
export const ROUTES = [
  { path: "/", slug: "home", heading: SLOGAN },
  { path: "/demo", slug: "demo", heading: "Chơi thử bài luyện đọc lớp 1" },
  { path: "/login", slug: "login", heading: "Đăng nhập giáo viên" },
  { path: "/learn", slug: "learn", heading: "Chào Mây!" },
  { path: "/join", slug: "join", heading: "Liên kết thiết bị học tập" },
] as const;

type Fixtures = {
  /** Lỗi console (bao gồm vi phạm CSP) và lỗi JavaScript chưa bắt được trong lúc tải trang. */
  pageErrors: string[];
};

export const test = base.extend<Fixtures>({
  // Tham số thứ hai đặt tên "provide" (không phải "use") để quy tắc react-hooks không nhầm với hook React.
  pageErrors: async ({ page }, provide) => {
    const errors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(`console: ${message.text()}`);
    });
    page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
    await provide(errors);
  },
});

export { expect };
