import Link from "next/link";
import type { Route } from "next";
import type { ReactNode } from "react";
import {
  CalendarRange,
  ClipboardCheck,
  Crown,
  House,
  LayoutDashboard,
  Library,
  School,
  Settings,
  Trophy,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { vi } from "@/strings/vi";
import { LogoMark } from "./logo";

type TeacherNavItem = {
  label: string;
  Icon: LucideIcon;
  /** Mỗi mục dẫn tới phần giới thiệu trên trang tổng quan; không có href = chưa có gì để xem. */
  href?: Route;
  /** Chức năng chưa xây dựng: hiện nhãn "Sắp có" cạnh tên mục. */
  comingSoon?: boolean;
};

const s = vi.teacher.sidebar;

/**
 * Menu R02 (REDESIGN_TASKS 2.8): bỏ "Phiếu học tập"; thêm Bảng điểm, Vinh danh, Mùa thi đua — "Sắp có".
 * R03: Lớp học và Học sinh đã hoạt động (/teacher/classes).
 */
const ITEMS: readonly TeacherNavItem[] = [
  { label: s.overview, Icon: LayoutDashboard, href: "/teacher#tong-quan" },
  { label: s.classes, Icon: School, href: "/teacher/classes" },
  { label: s.students, Icon: Users, href: "/teacher/classes" },
  { label: s.bank, Icon: Library, href: "/teacher#ngan-hang-bai-tap", comingSoon: true },
  { label: s.review, Icon: ClipboardCheck, href: "/teacher#duyet-hoc-lieu", comingSoon: true },
  { label: s.scoreboard, Icon: Trophy, href: "/teacher/classes" },
  { label: s.honors, Icon: Crown, href: "/teacher#vinh-danh", comingSoon: true },
  { label: s.seasons, Icon: CalendarRange, href: "/teacher#mua-thi-dua", comingSoon: true },
  { label: s.settings, Icon: Settings, href: "/teacher#cai-dat", comingSoon: true },
];

const itemClass = "flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition-colors";

/** `account`: tên GV + nút đăng xuất (Server Component đọc phiên, bọc Suspense ở layout). */
export function TeacherSidebar({ account }: { account?: ReactNode }) {
  return (
    <aside className="border-b border-line bg-surface lg:sticky lg:top-0 lg:flex lg:h-dvh lg:w-72 lg:shrink-0 lg:flex-col lg:border-b-0 lg:border-r">
      <div className="flex items-center justify-between gap-3 px-4 py-4 lg:flex-col lg:items-start lg:px-6 lg:py-6">
        <Link href="/" aria-label={vi.a11y.homeLink} className="flex items-center gap-3 rounded-xl">
          <LogoMark />
          <span className="flex flex-col whitespace-nowrap">
            <span className="font-extrabold leading-tight text-ink">{vi.brand.name}</span>
            <span className="text-xs font-semibold text-ink-faint">{vi.teacher.areaLabel}</span>
          </span>
        </Link>
        <Badge tone="sun">{vi.brand.previewBadge}</Badge>
      </div>
      {account ? <div className="px-4 pb-4 lg:px-6">{account}</div> : null}

      <nav aria-label={vi.a11y.teacherNav} className="px-4 pb-4 lg:flex-1 lg:px-4">
        <ul className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:gap-1 lg:overflow-visible">
          {ITEMS.map(({ label, Icon, href, comingSoon }) => (
            <li key={label} className="shrink-0">
              {href ? (
                <Link href={href} className={`${itemClass} text-ink-soft hover:bg-surface-muted hover:text-ink`}>
                  <Icon aria-hidden="true" className="size-5" />
                  {label}
                  {comingSoon ? (
                    <Badge tone="neutral" className="ml-auto shrink-0 whitespace-nowrap">
                      {vi.status.comingSoon}
                    </Badge>
                  ) : null}
                </Link>
              ) : (
                <span className={`${itemClass} cursor-not-allowed text-ink-faint`}>
                  <Icon aria-hidden="true" className="size-5" />
                  {label}
                  <Badge tone="neutral" className="ml-auto shrink-0 whitespace-nowrap">
                    {vi.status.comingSoon}
                  </Badge>
                </span>
              )}
            </li>
          ))}
        </ul>
      </nav>

      <div className="hidden border-t border-line px-4 py-4 lg:block">
        <Link href="/" className={`${itemClass} text-ink-soft hover:bg-surface-muted hover:text-ink`}>
          <House aria-hidden="true" className="size-5" />
          {s.backHome}
        </Link>
      </div>
    </aside>
  );
}
