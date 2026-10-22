import { vi } from "@/strings/vi";

/**
 * Danh mục an toàn mã quái vật → tên hiển thị + màu (R08.4). Tên và hình là bản phác thảo chờ GV duyệt ở R08.5; mã lạ
 * (không có trong danh mục) dùng tên chung — không bao giờ lấy lời thoại hay tên tùy ý từ CSDL/AI.
 */
const HUES: Readonly<Record<string, number>> = {
  "mon-bong-may": 0,
  "mon-cuc-bot": 150,
  "mon-sao-nho": 40,
  "mon-oc-sen": 95,
  "mon-ech-con": 120,
  "mon-ca-vang": 190,
  "mon-nam-tron": 300,
  "mon-den-long": 330,
  "mon-meo-ngu": 230,
  "mon-bun-xu": 260,
};

export function monsterName(monsterKey: string): string {
  return vi.monsters[monsterKey] ?? vi.monsterFallback;
}

/** Góc xoay màu (độ) của hình dùng chung — tránh vẽ mười bộ asset riêng. */
export function monsterHue(monsterKey: string): number {
  return HUES[monsterKey] ?? 0;
}
