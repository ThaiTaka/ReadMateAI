import { test as base, expect } from "@playwright/test";

export const SLOGAN = "Mỗi em một nhịp đọc – Mỗi ngày một tiến bộ";

/** Các route nền tảng của Giai đoạn 2 và tiêu đề h1 mong đợi. */
export const ROUTES = [
  { path: "/", slug: "home", heading: SLOGAN },
  { path: "/demo", slug: "demo", heading: "Chơi thử bài luyện đọc lớp 1" },
  { path: "/teacher", slug: "teacher", heading: "Bảng điều khiển giáo viên" },
  { path: "/learn", slug: "learn", heading: "Chào con!" },
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
