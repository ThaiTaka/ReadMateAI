import type { Route } from "next";
import { vi } from "@/strings/vi";

export type NavItem = {
  href: Route;
  label: string;
};

/** Các route nền tảng của Giai đoạn 2 (docs/ARCHITECTURE.md §6.1). */
export const MAIN_NAV: readonly NavItem[] = [
  { href: "/", label: vi.nav.home },
  { href: "/demo", label: vi.nav.demo },
  { href: "/teacher", label: vi.nav.teacher },
  { href: "/learn", label: vi.nav.learn },
  { href: "/join", label: vi.nav.join },
];

export const SITE = {
  name: vi.brand.name,
  description: vi.brand.description,
  themeColor: "#0b7a63",
} as const;
