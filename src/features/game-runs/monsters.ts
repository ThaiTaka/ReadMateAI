/**
 * Danh mục mã quái vật của Mê cung kho báu (R08.2). Chỉ là MÃ nội bộ — tên hiển thị, hình và lời thoại ở
 * `ui/encounter/monster-catalog.ts` (R08.4–R08.5, phải qua bộ soát lộ đáp án và GV xem phác thảo). Mã chỉ là số thứ tự trung tính:
 * từ R08.5 không mã nào chứa tiếng Việt có nghĩa, vì mã nằm trong thuộc tính HTML (`data-monster`) và dữ liệu trang. Mỗi lượt
 * chọn đúng 7 mã khác nhau từ danh mục này; CSDL chỉ kiểm hình dạng mã (ràng buộc unique theo lượt).
 */
export const MONSTER_KEYS = [
  "mon-01",
  "mon-02",
  "mon-03",
  "mon-04",
  "mon-05",
  "mon-06",
  "mon-07",
  "mon-08",
  "mon-09",
  "mon-10",
] as const;

export type MonsterKey = (typeof MONSTER_KEYS)[number];

/**
 * Mã cũ (R08.2–R08.4) có chứa tên tiếng Việt như "sao", "nho" — có thể là chữ/từ đang được hỏi. Lượt chơi đã tạo trước R08.5
 * vẫn giữ mã cũ trong CSDL, nên giao diện đổi sang mã mới qua bảng này; lượt mới không bao giờ phát mã cũ.
 */
export const LEGACY_MONSTER_KEYS: Readonly<Record<string, MonsterKey>> = {
  "mon-bong-may": "mon-01",
  "mon-cuc-bot": "mon-02",
  "mon-sao-nho": "mon-03",
  "mon-oc-sen": "mon-04",
  "mon-ech-con": "mon-05",
  "mon-ca-vang": "mon-06",
  "mon-nam-tron": "mon-07",
  "mon-den-long": "mon-08",
  "mon-meo-ngu": "mon-09",
  "mon-bun-xu": "mon-10",
};
