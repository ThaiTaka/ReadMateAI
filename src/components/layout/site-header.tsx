import Link from "next/link";
import { MAIN_NAV } from "@/config/site";
import { vi } from "@/strings/vi";
import { ButtonLink } from "@/components/ui/button";
import { LogoWordmark } from "./logo";
import { MobileNav } from "./mobile-nav";
import { NavLink } from "./nav-link";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-line/80 bg-canvas/90 backdrop-blur supports-[backdrop-filter]:bg-canvas/75">
      <div className="relative mx-auto flex h-18 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link href="/" aria-label={vi.a11y.homeLink} className="rounded-xl">
          <LogoWordmark />
        </Link>

        <nav aria-label={vi.a11y.mainNav} className="hidden md:block">
          <ul className="flex items-center gap-1">
            {MAIN_NAV.map((item) => (
              <li key={item.href}>
                <NavLink
                  item={item}
                  className="inline-flex min-h-11 items-center rounded-full px-4 text-sm font-semibold text-ink-soft transition-colors hover:bg-surface-muted hover:text-ink"
                  activeClassName="bg-brand-50 text-brand-800"
                />
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex items-center gap-2">
          {/* Bọc ngoài để ẩn trên điện thoại (không truyền "hidden" vào nút — xem button.tsx). */}
          <span className="hidden sm:inline-flex">
            <ButtonLink href="/demo" size="sm">
              {vi.nav.ctaDemo}
            </ButtonLink>
          </span>
          <MobileNav items={MAIN_NAV} />
        </div>
      </div>
    </header>
  );
}
