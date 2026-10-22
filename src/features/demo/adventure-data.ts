import type { AvatarKey } from "../avatars/catalog.ts";

/**
 * Dữ liệu minh họa HOÀN TOÀN HƯ CẤU cho trang học sinh (/learn) và phần xem trước Game World ở /demo (R02).
 * Không phải học sinh thật, không đọc/ghi CSDL, không lưu localStorage, không gửi request (CLAUDE.md §9.4.8).
 * Điểm ở đây là con số cố định để xem giao diện — không có cách nào để cộng/trừ hay sửa điểm từ giao diện.
 *
 * Giả định của bản minh họa: chưa có lượt trừ điểm nào, nên điểm hiện tại (dùng xét vào game) bằng điểm tích lũy
 * trong mùa (dùng cho mốc bản đồ). Ở bản thật hai đại lượng có thể khác nhau (GAMIFICATION_SPEC §2, RQ-G1).
 */

export { DEMO_DATA_IS_FICTIONAL } from "./demo-data.ts";

export type DemoPlayer = {
  /** Tên hiển thị hư cấu (không phải biệt danh của học sinh thật). */
  displayName: string;
  avatar: AvatarKey;
  /** Điểm hiện tại trong mùa (xét điều kiện vào game). */
  balance: number;
  /** Điểm tích lũy trong mùa (xét mốc khám phá bản đồ). */
  earnedTotal: number;
  practiceSessions: number;
};

export const DEMO_PLAYER: DemoPlayer = {
  displayName: "Mây",
  avatar: "may",
  balance: 135,
  earnedTotal: 135,
  practiceSessions: 6,
};

export type DemoAchievementIcon = "footprints" | "map" | "puzzle" | "book" | "treasure" | "star";

export type DemoAchievement = {
  id: string;
  title: string;
  description: string;
  icon: DemoAchievementIcon;
  earned: boolean;
};

/** Huy hiệu minh họa: ghi nhận chặng đã đi — không có chuỗi ngày liên tiếp hay phần thưởng may rủi (§9.4.5). */
export const DEMO_ACHIEVEMENTS: readonly DemoAchievement[] = [
  {
    id: "first-steps",
    title: "Bước chân đầu tiên",
    description: "Hoàn thành buổi luyện đầu tiên",
    icon: "footprints",
    earned: true,
  },
  {
    id: "explorer",
    title: "Nhà thám hiểm nhỏ",
    description: "Khám phá 3 mốc bản đồ",
    icon: "map",
    earned: true,
  },
  {
    id: "builder",
    title: "Thợ ghép tiếng",
    description: "Hoàn thành 3 bài ghép tiếng",
    icon: "puzzle",
    earned: true,
  },
  {
    id: "reader",
    title: "Bạn của sách",
    description: "Hoàn thành 10 buổi luyện",
    icon: "book",
    earned: false,
  },
  {
    id: "treasure",
    title: "Người tìm kho báu",
    description: "Mở rương báu ở Mê cung (trò chơi sắp có)",
    icon: "treasure",
    earned: false,
  },
  {
    id: "star",
    title: "Ngôi sao tự làm",
    description: "Hoàn thành một thử thách Tự làm",
    icon: "star",
    earned: false,
  },
];

export type DemoLeaderboardEntry = {
  /** Tên hư cấu. */
  alias: string;
  avatar: AvatarKey;
  points: number;
  /** Dòng của người đang xem (bản minh họa: "Mây"). */
  isMe: boolean;
};

/** Bảng xếp hạng minh họa: tên hư cấu, không phải học sinh thật, không lưu (LEADERBOARD_SPEC — dự kiến R05). */
export const DEMO_LEADERBOARD: readonly DemoLeaderboardEntry[] = [
  { alias: "Bống", avatar: "bong", points: 180, isMe: false },
  { alias: "Mây", avatar: "may", points: 135, isMe: true },
  { alias: "Na", avatar: "na", points: 120, isMe: false },
  { alias: "Tí", avatar: "ti", points: 95, isMe: false },
  { alias: "Bin", avatar: "bin", points: 70, isMe: false },
];
