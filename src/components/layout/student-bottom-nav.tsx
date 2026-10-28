"use client";

import { BookOpenCheck, Gamepad2, Map as MapIcon, Trophy } from "lucide-react";
import { usePathname } from "next/navigation";
import { vi } from "@/strings/vi";

type NavItem = { href: string; label: string; Icon: typeof MapIcon };

/** Bản minh họa (/learn): lối tắt trong trang + bản chơi thử. */
const DEMO_ITEMS: readonly NavItem[] = [
  { href: "#game-world", label: vi.learn.bottomNav.map, Icon: MapIcon },
  { href: "/demo#luyen-tap", label: vi.learn.bottomNav.practice, Icon: BookOpenCheck },
  { href: "#thanh-tich", label: vi.learn.bottomNav.achievements, Icon: Trophy },
];

/**
 * Trang có xác thực (/learn/me…): hai khu vực độc lập — Học tập và Thi đấu — cùng bản đồ và bảng điểm. Không đọc tham số
 * URL (useSearchParams buộc bọc Suspense và thay DOM lúc hydrate); thiết bị có nhiều hồ sơ sẽ được hỏi chọn hồ sơ khi mở liên kết.
 */
const LINKED_ITEMS: readonly NavItem[] = [
  { href: "/learn/me#hoc-tap", label: vi.learn.bottomNav.learnZone, Icon: BookOpenCheck },
  { href: "/learn/me#thi-dau", label: vi.learn.bottomNav.competeZone, Icon: Gamepad2 },
  { href: "/learn/me#ban-do", label: vi.learn.bottomNav.map, Icon: MapIcon },
  { href: "/learn/leaderboard", label: vi.learn.bottomNav.leaderboard, Icon: Trophy },
];

/**
 * Điều hướng đáy màn hình cho học sinh trên điện thoại: 3 mục lớn, mỗi mục cao ≥ 64px (PRD §5, P8).
 * Từ máy tính bảng trở lên các lối đi này đã nằm sẵn trong trang nên thanh được ẩn.
 */
export function StudentBottomNav() {
  const pathname = usePathname();
  const linked = pathname === "/learn/me" || pathname.startsWith("/learn/me/") || pathname === "/learn/leaderboard";
  const items = linked ? LINKED_ITEMS : DEMO_ITEMS;
  return (
    <nav
      aria-label={vi.a11y.studentNav}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] shadow-lift md:hidden"
    >
      <ul className={`mx-auto grid max-w-xl ${items.length === 4 ? "grid-cols-4" : "grid-cols-3"}`}>
        {items.map(({ href, label, Icon }) => (
          <li key={label}>
            <a
              href={href}
              className="flex min-h-touch-kid flex-col items-center justify-center gap-1 rounded-2xl text-sm font-bold text-ink-soft hover:bg-surface-muted hover:text-ink"
            >
              <Icon aria-hidden="true" className="size-6" />
              {label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
