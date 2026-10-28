"use client";

import { usePathname } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { vi } from "@/strings/vi";

/**
 * Nhãn "Bản xem trước" chỉ ở trang minh họa `/learn` (dữ liệu hư cấu). Khu vực học sinh có xác thực (`/learn/me…`,
 * `/learn/leaderboard`) là dữ liệu thật của em nên không gắn nhãn này.
 */
export function LearnPreviewBadge() {
  const pathname = usePathname();
  if (pathname !== "/learn") return null;
  return <Badge tone="sun">{vi.brand.previewBadge}</Badge>;
}
