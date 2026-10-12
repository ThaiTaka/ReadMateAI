import Link from "next/link";
import type { Route } from "next";
import {
  ChartLine,
  ClipboardCheck,
  FileText,
  House,
  LayoutDashboard,
  Library,
  School,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { vi } from "@/strings/vi";
import { LogoMark } from "./logo";

type TeacherNavItem = {
  label: string;
  Icon: LucideIcon;
  /** Không có href = chức năng chưa có trang (hiển thị "Sắp có", không bấm được). */
  href?: Route;
};

const s = vi.teacher.sidebar;

const ITEMS: readonly TeacherNavItem[] = [
  { label: s.overview, Icon: LayoutDashboard, href: "/teacher#tong-quan" },
  { label: s.classes, Icon: School, href: "/teacher#lop-hoc" },
  { label: s.bank, Icon: Library, href: "/teacher#ngan-hang-bai-tap" },
  { label: s.progress, Icon: ChartLine, href: "/teacher#tien-bo" },
  { label: s.worksheets, Icon: FileText },
  { label: s.observations, Icon: ClipboardCheck },
];

const itemClass = "flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition-colors";

export function TeacherSidebar() {
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

      <nav aria-label={vi.a11y.teacherNav} className="px-4 pb-4 lg:flex-1 lg:px-4">
        <ul className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:gap-1 lg:overflow-visible">
          {ITEMS.map(({ label, Icon, href }) => (
            <li key={label} className="shrink-0">
              {href ? (
                <Link href={href} className={`${itemClass} text-ink-soft hover:bg-surface-muted hover:text-ink`}>
                  <Icon aria-hidden="true" className="size-5" />
                  {label}
                </Link>
              ) : (
                <span className={`${itemClass} cursor-not-allowed text-ink-faint`}>
                  <Icon aria-hidden="true" className="size-5" />
                  {label}
                  <Badge tone="neutral" className="ml-auto">
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
