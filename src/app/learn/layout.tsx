import Link from "next/link";
import { House } from "lucide-react";
import { MotionScope, MotionToggle } from "@/components/adventure/motion";
import { LogoWordmark } from "@/components/layout/logo";
import { MAIN_CONTENT_ID } from "@/components/layout/skip-link";
import { StudentBottomNav } from "@/components/layout/student-bottom-nav";
import { Badge } from "@/components/ui/badge";
import { vi } from "@/strings/vi";

/**
 * Khung khu vực học sinh — ưu tiên điện thoại, mở rộng thành bảng điều khiển trên máy tính bảng/máy tính.
 * Không script bên thứ ba, không liên kết ra ngoài, không ô nhập văn bản tự do (CLAUDE.md §6). Chưa có tài khoản
 * và chưa lưu thông tin học sinh: trang dùng dữ liệu minh họa hư cấu (R02).
 */
export default function LearnLayout({ children }: LayoutProps<"/learn">) {
  return (
    <MotionScope className="flex flex-1 flex-col bg-linear-to-b from-jade-50 via-canvas to-canvas">
      <header className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-4 pt-4 sm:px-6">
        <span className="flex items-center gap-3">
          <Link href="/" aria-label={vi.a11y.homeLink} className="rounded-xl">
            <LogoWordmark />
          </Link>
          {/* Điện thoại hẹp: nhãn bản chơi thử đã có ở dải ghi chú đầu trang. */}
          <span className="hidden sm:inline-flex">
            <Badge tone="sun">{vi.brand.previewBadge}</Badge>
          </span>
        </span>
        {/* Điện thoại: logo + Trang chủ ở dòng đầu, công tắc giảm chuyển động xuống dòng dưới; màn rộng: một dòng. */}
        <Link
          href="/"
          className="order-2 ml-auto inline-flex min-h-12 items-center gap-2 rounded-full px-4 font-semibold text-ink-soft hover:bg-surface hover:text-ink sm:order-3 sm:ml-0"
        >
          <House aria-hidden="true" className="size-5" />
          {vi.learn.exit}
        </Link>
        <span className="order-3 sm:order-2 sm:ml-auto">
          <MotionToggle />
        </span>
      </header>
      <main
        id={MAIN_CONTENT_ID}
        tabIndex={-1}
        className="mx-auto w-full max-w-6xl flex-1 px-4 pt-4 pb-32 outline-none sm:px-6 md:pb-16"
      >
        {children}
      </main>
      <StudentBottomNav />
    </MotionScope>
  );
}
