import Link from "next/link";
import { House } from "lucide-react";
import { LogoMark } from "@/components/layout/logo";
import { MAIN_CONTENT_ID } from "@/components/layout/skip-link";
import { StudentBottomNav } from "@/components/layout/student-bottom-nav";
import { Badge } from "@/components/ui/badge";
import { vi } from "@/strings/vi";

/**
 * Khung khu vực học sinh — ưu tiên điện thoại. Không script bên thứ ba, không liên kết ra ngoài,
 * không ô nhập văn bản tự do (CLAUDE.md §6). Chưa có tài khoản và chưa lưu thông tin học sinh.
 */
export default function LearnLayout({ children }: LayoutProps<"/learn">) {
  return (
    <div className="flex flex-1 flex-col bg-linear-to-b from-brand-50 via-canvas to-canvas">
      <header className="mx-auto flex w-full max-w-xl items-center justify-between gap-3 px-4 pt-4">
        <span className="flex items-center gap-2">
          <LogoMark className="size-10" />
          <Badge tone="sun">{vi.brand.previewBadge}</Badge>
        </span>
        <Link
          href="/"
          className="inline-flex min-h-touch items-center gap-2 rounded-full px-4 font-semibold text-ink-soft hover:bg-surface hover:text-ink"
        >
          <House aria-hidden="true" className="size-5" />
          {vi.learn.exit}
        </Link>
      </header>
      <main id={MAIN_CONTENT_ID} tabIndex={-1} className="mx-auto w-full max-w-xl flex-1 px-4 pb-32 pt-4 outline-none">
        {children}
      </main>
      <StudentBottomNav />
    </div>
  );
}
