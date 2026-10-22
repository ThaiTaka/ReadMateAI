/**
 * Danh mục mã quái vật của Mê cung kho báu (R08.2). Chỉ là MÃ nội bộ — tên hiển thị, hình và lời thoại thuộc R08.4–R08.5
 * (phải qua bộ soát lộ đáp án và GV xem phác thảo). Mã không mang nội dung học tập, nên không thể làm lộ đáp án.
 * Mỗi lượt chọn đúng 7 mã khác nhau từ danh mục này; CSDL chỉ kiểm hình dạng mã (ràng buộc unique theo lượt).
 */
export const MONSTER_KEYS = [
  "mon-bong-may",
  "mon-cuc-bot",
  "mon-sao-nho",
  "mon-oc-sen",
  "mon-ech-con",
  "mon-ca-vang",
  "mon-nam-tron",
  "mon-den-long",
  "mon-meo-ngu",
  "mon-bun-xu",
] as const;

export type MonsterKey = (typeof MONSTER_KEYS)[number];
