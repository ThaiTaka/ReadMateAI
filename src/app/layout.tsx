import type { Metadata, Viewport } from "next";
import { SkipLink } from "@/components/layout/skip-link";
import { SITE } from "@/config/site";
import { vi } from "@/strings/vi";
import { andika, beVietnamPro } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: `${vi.brand.name} — ${vi.home.meta.title}`,
    template: `%s · ${vi.brand.name}`,
  },
  description: SITE.description,
  applicationName: SITE.name,
  // Bản xem trước: chưa cho công cụ tìm kiếm lập chỉ mục (xem docs/ARCHITECTURE.md §19).
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: SITE.themeColor,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="vi" className={`${beVietnamPro.variable} ${andika.variable}`}>
      <body className="flex min-h-dvh flex-col">
        <SkipLink />
        {children}
      </body>
    </html>
  );
}
