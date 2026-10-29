import type { Route } from "next";
import { vi } from "@/strings/vi";

export type NavItem = {
  href: Route;
  label: string;
};

/** Các route chính (docs/ARCHITECTURE.md §6.1; R02: /learn là Game World của học sinh). */
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
  tagline: vi.brand.tagline,
  keywords: ["Tiếng Việt lớp 1", "luyện đọc", "tự luyện tại nhà", "học qua trò chơi", "ReadMate AI"],
  themeColor: "#0d8275",
} as const;
