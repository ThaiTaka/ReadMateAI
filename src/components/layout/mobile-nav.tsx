"use client";

import { Menu, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useId, useState } from "react";
import type { NavItem } from "@/config/site";
import { vi } from "@/strings/vi";
import { NavLink } from "./nav-link";

type MobileNavProps = {
  items: readonly NavItem[];
};

/**
 * Menu điều hướng cho màn hình nhỏ.
 * Trạng thái mở gắn với đường dẫn hiện tại nên menu tự đóng khi chuyển trang
 * (header nằm trong layout dùng chung, không bị unmount khi điều hướng).
 */
export function MobileNav({ items }: MobileNavProps) {
  const pathname = usePathname();
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenOn(null);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <div className="md:hidden">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={open ? vi.a11y.closeMenu : vi.a11y.openMenu}
        onClick={() => setOpenOn(open ? null : pathname)}
        className="inline-flex size-touch items-center justify-center rounded-full text-ink hover:bg-surface-muted"
      >
        {open ? <X aria-hidden="true" className="size-6" /> : <Menu aria-hidden="true" className="size-6" />}
      </button>

      <nav
        id={panelId}
        aria-label={vi.a11y.mainNav}
        hidden={!open}
        className="absolute inset-x-0 top-full border-b border-line bg-surface shadow-lift"
      >
        <ul className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-3">
          {items.map((item) => (
            <li key={item.href}>
              <NavLink
                item={item}
                onNavigate={() => setOpenOn(null)}
                className="flex min-h-touch items-center rounded-xl px-4 text-base font-semibold text-ink-soft hover:bg-surface-muted hover:text-ink"
                activeClassName="bg-brand-50 text-brand-800"
              />
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
