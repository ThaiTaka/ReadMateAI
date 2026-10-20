/**
 * Bộ avatar có sẵn (R02 — bản phác thảo). Avatar là nhân vật hoạt hình chọn sẵn, KHÔNG phải ảnh hay hình
 * mô phỏng trẻ thật (CLAUDE.md §6.1). Mọi avatar đều `pending_review` cho tới khi giáo viên duyệt (RQ-M1);
 * không mục nào được tự đặt `approved`. Giấy phép: content/media/licenses.json (`licenseRef`).
 * R05 sẽ seed danh mục này vào bảng `avatar_options`.
 */

export type AvatarKey = "may" | "bong" | "na" | "ti" | "bin";

export type AvatarOption = {
  key: AvatarKey;
  kind: "human";
  /** Tên gọi của nhân vật hoạt hình (không phải tên học sinh). */
  label: string;
  description: string;
  status: "pending_review";
  licenseRef: string;
};

export const AVATAR_OPTIONS: readonly AvatarOption[] = [
  {
    key: "may",
    kind: "human",
    label: "Bạn tóc búi",
    description: "Tóc búi hai bên, kẹp ngôi sao, áo xanh da trời",
    status: "pending_review",
    licenseRef: "art.avatar.may",
  },
  {
    key: "bong",
    kind: "human",
    label: "Bạn tóc xoăn",
    description: "Tóc xoăn, áo vàng nắng",
    status: "pending_review",
    licenseRef: "art.avatar.bong",
  },
  {
    key: "na",
    kind: "human",
    label: "Bạn tóc ngắn",
    description: "Tóc ngắn ngang vai, cài băng đô tím",
    status: "pending_review",
    licenseRef: "art.avatar.na",
  },
  {
    key: "ti",
    kind: "human",
    label: "Bạn đội mũ",
    description: "Đội mũ lưỡi trai xanh ngọc, áo cam",
    status: "pending_review",
    licenseRef: "art.avatar.ti",
  },
  {
    key: "bin",
    kind: "human",
    label: "Bạn đeo kính",
    description: "Đeo kính tròn, áo xanh lá",
    status: "pending_review",
    licenseRef: "art.avatar.bin",
  },
];
