import Link from "next/link";
import { MAIN_NAV } from "@/config/site";
import { vi } from "@/strings/vi";
import { Container } from "@/components/ui/container";
import { LogoWordmark } from "./logo";

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-line bg-surface">
      <Container className="flex flex-col gap-8 py-10 md:flex-row md:items-start md:justify-between">
        <div className="max-w-sm">
          <LogoWordmark />
          <p className="mt-3 leading-relaxed text-ink-soft">{vi.footer.tagline}</p>
          <p className="mt-2 text-sm text-ink-faint">{vi.footer.previewNote}</p>
        </div>
        <nav aria-label={vi.a11y.footerNav}>
          <p className="text-sm font-bold uppercase tracking-wider text-ink-faint">{vi.footer.linksTitle}</p>
          <ul className="mt-3 grid grid-cols-2 gap-x-8 gap-y-1">
            {MAIN_NAV.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="inline-flex min-h-11 items-center rounded-lg font-medium text-ink-soft underline-offset-4 hover:text-brand-700 hover:underline"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </Container>
      <div className="border-t border-line py-4 text-center text-sm text-ink-faint">
        © 2026 {vi.brand.name} · {vi.brand.slogan}
      </div>
    </footer>
  );
}
