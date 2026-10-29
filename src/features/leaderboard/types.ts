/**
 * DTO của bảng xếp hạng (LEADERBOARD_SPEC §10) — an toàn để gửi tới trình duyệt học sinh.
 * KHÔNG có: student_id, class_id, auth_user_id, điểm tích lũy, tổng đã trừ, nhóm năng lực, mức hỗ trợ, đồng ý,
 * thời điểm đạt điểm, số học sinh bị ẩn. `rowKey` là khóa mờ băm từ mùa + tên hiển thị (không phải mã học sinh).
 */

import type { LeaderboardView } from "@/features/gamification/ranking";

export type LeaderboardRowDto = {
  rowKey: string;
  rank: number;
  alias: string;
  avatarKey: string;
  points: number;
  isMe: boolean;
};

export type LeaderboardDto =
  | {
      status: "ok";
      view: LeaderboardView;
      seasonNo: number;
      /** Điểm cao nhất của bảng — mẫu số của thanh điểm (hàng hạng 1 luôn nằm trong dữ liệu gửi đi). */
      maxPoints: number;
      rows: LeaderboardRowDto[];
      /** Hàng của chính học sinh khi em nằm ngoài phần đầu bảng (chỉ ở kiểu TOP 10 + Con). */
      myRow: LeaderboardRowDto | null;
      /** Chính học sinh này có hàng trên bảng không (tình trạng của riêng em, không nói gì về bạn khác). */
      viewerListed: boolean;
      generatedAt: string;
    }
  | { status: "disabled" }
  | { status: "no_season" };

/** Dữ liệu trình chiếu của giáo viên: chỉ học sinh đủ điều kiện, không mã định danh. */
export type PresentationDto = {
  className: string;
  seasonNo: number;
  maxPoints: number;
  rows: Array<Omit<LeaderboardRowDto, "isMe">>;
  generatedAt: string;
};

export type TeacherBoardStudent = {
  studentId: string;
  displayName: string;
  alias: string | null;
  aliasApproved: boolean;
  avatarKey: string;
  status: "active" | "paused";
  learningConsent: boolean;
  leaderboardConsent: boolean;
  balance: number;
  earnedTotal: number;
  eligible: boolean;
};

export type TeacherBoardOverview = {
  featureApproved: boolean;
  enabled: boolean;
  studentView: LeaderboardView;
  seasonNo: number | null;
  /** Xếp hạng nội bộ (điểm hiện tại) của mọi học sinh chưa lưu trữ — chỉ GV thấy. */
  ranked: Array<TeacherBoardStudent & { rank: number }>;
};
