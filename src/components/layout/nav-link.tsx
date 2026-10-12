"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { NavItem } from "@/config/site";
import { cn } from "@/lib/cn";

type NavLinkProps = {
  item: NavItem;
  className?: string;
  activeClassName?: string;
  onNavigate?: () => void;
};

/** Liên kết điều hướng tự đánh dấu trang hiện tại bằng aria-current (không chỉ bằng màu). */
export function NavLink({ item, className, activeClassName, onNavigate }: NavLinkProps) {
  const pathname = usePathname();
  const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

  return (
    <Link
      href={item.href}
      aria-current={isActive ? "page" : undefined}
      onClick={onNavigate}
      className={cn(className, isActive && activeClassName)}
    >
      {item.label}
    </Link>
  );
}
