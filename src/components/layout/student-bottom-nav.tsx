import { BookOpen, ListChecks, Trophy } from "lucide-react";
import { vi } from "@/strings/vi";

const ITEMS = [
  { href: "#nhiem-vu", label: vi.learn.bottomNav.tasks, Icon: ListChecks },
  { href: "#bai-tap", label: vi.learn.bottomNav.exercise, Icon: BookOpen },
  { href: "#thanh-tich", label: vi.learn.bottomNav.achievements, Icon: Trophy },
] as const;

/** Điều hướng đáy màn hình cho học sinh: 3 mục lớn, mỗi mục cao ≥ 64px (PRD §5, P8). */
export function StudentBottomNav() {
  return (
    <nav
      aria-label={vi.a11y.studentNav}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] shadow-lift"
    >
      <ul className="mx-auto grid max-w-xl grid-cols-3">
        {ITEMS.map(({ href, label, Icon }) => (
          <li key={href}>
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
