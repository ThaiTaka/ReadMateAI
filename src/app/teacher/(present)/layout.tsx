import type { ReactNode } from "react";
import { MAIN_CONTENT_ID } from "@/components/layout/skip-link";

/**
 * Khung trình chiếu toàn màn hình của giáo viên: không thanh bên, không điều hướng khác — để chiếu lên máy chiếu mà
 * bàn phím không "lạc" vào menu phía sau. Quyền vẫn do từng trang kiểm tra (requireTeacher) và CSDL (RLS + hàm).
 */
export default function PresentLayout({ children }: { children: ReactNode }) {
  return (
    <main
      id={MAIN_CONTENT_ID}
      tabIndex={-1}
      className="flex min-h-dvh flex-1 flex-col bg-linear-to-b from-deep-900 to-deep-800 outline-none"
    >
      {children}
    </main>
  );
}
