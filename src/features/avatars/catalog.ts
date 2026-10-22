/**
 * Bộ avatar có sẵn (R02 phác thảo 5 mẫu; R05 mở rộng lên 16). Avatar là nhân vật hoạt hình chọn sẵn, KHÔNG phải
 * ảnh hay hình mô phỏng trẻ thật (CLAUDE.md §6.1). Không gắn giới tính hay nhóm năng lực. Mọi avatar đều
 * `pending_review` cho tới khi giáo viên duyệt (RQ-M1); không mục nào được tự đặt `approved`.
 * Giấy phép: content/media/licenses.json (`licenseRef`). Hình vẽ: src/components/art/avatars.tsx.
 * Khóa lưu trong CSDL là `students.avatar_key` (chỉ kiểm định dạng); danh mục này là nguồn hợp lệ ở tầng ứng dụng.
 */

export const AVATAR_KEYS = [
  "may",
  "bong",
  "na",
  "ti",
  "bin",
  "sao",
  "nang",
  "bien",
  "gio",
  "lua",
  "tre",
  "xoai",
  "sen",
  "cam",
  "dua",
  "oi",
] as const;

export type AvatarKey = (typeof AVATAR_KEYS)[number];

export type AvatarOption = {
  key: AvatarKey;
  kind: "human";
  /** Tên gọi của nhân vật hoạt hình (không phải tên học sinh). */
  label: string;
  description: string;
  status: "pending_review";
  licenseRef: string;
};

const option = (key: AvatarKey, label: string, description: string): AvatarOption => ({
  key,
  kind: "human",
  label,
  description,
  status: "pending_review",
  licenseRef: `art.avatar.${key}`,
});

export const AVATAR_OPTIONS: readonly AvatarOption[] = [
  option("may", "Bạn tóc búi", "Tóc búi hai bên, kẹp ngôi sao, áo xanh da trời"),
  option("bong", "Bạn tóc xoăn", "Tóc xoăn, áo vàng nắng"),
  option("na", "Bạn tóc ngắn", "Tóc ngắn ngang vai, cài băng đô tím"),
  option("ti", "Bạn đội mũ", "Đội mũ lưỡi trai xanh ngọc, áo cam"),
  option("bin", "Bạn đeo kính", "Đeo kính tròn, áo xanh lá"),
  option("sao", "Bạn tóc dựng", "Tóc dựng gai nhỏ, áo đỏ cam, tàn nhang"),
  option("nang", "Bạn tóc đuôi ngựa", "Buộc đuôi ngựa, nơ vàng, áo hồng"),
  option("bien", "Bạn hai búi bông", "Hai búi tròn trên đầu, áo xanh biển"),
  option("gio", "Bạn tóc dài", "Tóc dài thẳng, áo tím nhạt"),
  option("lua", "Bạn tóc úp", "Tóc úp gọn gàng, áo vàng lúa"),
  option("tre", "Bạn búi đỉnh đầu", "Búi tóc trên đỉnh đầu, áo xanh tre"),
  option("xoai", "Bạn tết tóc", "Hai bím tóc tết, áo cam xoài"),
  option("sen", "Bạn mũ len", "Đội mũ len hồng, áo hồng nhạt"),
  option("cam", "Bạn kính vuông", "Kính vuông, tóc rẽ ngôi, áo cam đất"),
  option("dua", "Bạn mũ lưỡi trai đỏ", "Mũ lưỡi trai đỏ, áo xanh dừa"),
  option("oi", "Bạn tóc bồng", "Tóc xoăn bồng, băng đô cam, áo xanh ổi"),
];
