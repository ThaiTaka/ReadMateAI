import { KidAvatar } from "@/components/art/avatars";
import { AVATAR_OPTIONS, type AvatarKey } from "@/features/avatars/catalog";
import type { AvatarChoice } from "./avatar-picker";

/** Lựa chọn avatar cho AvatarPicker — hình dựng ở máy chủ (Server Component), chỉ HTML/SVG tới trình duyệt. */
export function avatarChoices(): AvatarChoice[] {
  return AVATAR_OPTIONS.map((option) => ({
    key: option.key,
    label: option.label,
    art: <KidAvatar avatar={option.key} className="size-full" />,
  }));
}

export function isAvatarKey(key: string): key is AvatarKey {
  return AVATAR_OPTIONS.some((option) => option.key === key);
}

/** Avatar không có trong bộ hiện tại (dữ liệu cũ) → avatar mặc định đầu tiên. */
export function safeAvatarKey(key: string): AvatarKey {
  return isAvatarKey(key) ? key : AVATAR_OPTIONS[0]!.key;
}
