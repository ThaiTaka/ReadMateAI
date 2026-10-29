import { createHash } from "node:crypto";
import { z } from "zod";
import {
  maxPointsOf,
  rankScores,
  selectVisibleRows,
  type RankableRow,
  type RankedRow,
} from "@/features/gamification/ranking";
import type { LeaderboardDto, LeaderboardRowDto, PresentationDto, TeacherBoardOverview } from "./types";

/**
 * Dựng DTO từ kết quả hàm CSDL (zod ở ranh giới JSON). Hàm thuần, chỉ chạy ở máy chủ/kiểm thử (dùng node:crypto + zod):
 * mọi hàng sang trình duyệt đều đi qua đây nên không thể mang theo trường ngoài DTO.
 */

const aliasSchema = z.string().min(1).max(20);
const avatarSchema = z.string().regex(/^[a-z][a-z0-9-]{0,39}$/u);
const pointsSchema = z.number().int().min(0);
const timeSchema = z.string().nullable();

export const gatewayBoardSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("disabled") }),
  z.object({ status: z.literal("no_season") }),
  z.object({
    status: z.literal("ok"),
    view: z.enum(["top10_and_me", "full"]),
    season_no: z.number().int().min(1),
    viewer_listed: z.boolean(),
    rows: z.array(
      z.object({
        alias: aliasSchema,
        avatar_key: avatarSchema,
        points: pointsSchema,
        reached_at: timeSchema,
        is_me: z.boolean(),
      }),
    ),
  }),
]);

/** Khóa hàng mờ theo mùa: băm một chiều của (số mùa, tên hiển thị) — tên hiển thị vốn đã công khai trong lớp. */
export function opaqueRowKey(seasonNo: number, alias: string): string {
  return createHash("sha256")
    .update(`lb|${seasonNo}|${alias.normalize("NFC").toLowerCase()}`, "utf8")
    .digest("hex")
    .slice(0, 16);
}

function toRowDto(row: RankedRow): LeaderboardRowDto {
  return {
    rowKey: row.key,
    rank: row.rank,
    alias: row.alias,
    avatarKey: row.avatarKey,
    points: row.points,
    isMe: row.isMe,
  };
}

export function buildStudentLeaderboard(raw: unknown, now: Date): LeaderboardDto | null {
  const parsed = gatewayBoardSchema.safeParse(raw);
  if (!parsed.success) return null;
  const board = parsed.data;
  if (board.status !== "ok") return { status: board.status };
  const ranked = rankScores(
    board.rows.map<RankableRow>((row) => ({
      key: opaqueRowKey(board.season_no, row.alias),
      alias: row.alias.normalize("NFC"),
      avatarKey: row.avatar_key,
      points: row.points,
      reachedAt: row.reached_at,
      isMe: row.is_me,
    })),
  );
  const visible = selectVisibleRows(ranked, board.view);
  return {
    status: "ok",
    view: board.view,
    seasonNo: board.season_no,
    maxPoints: maxPointsOf(ranked),
    rows: visible.rows.map(toRowDto),
    myRow: visible.myRow ? toRowDto(visible.myRow) : null,
    viewerListed: board.viewer_listed,
    generatedAt: now.toISOString(),
  };
}

const presentationSchema = z.object({
  season_no: z.number().int().min(1),
  class_name: z.string().min(1).max(40),
  rows: z.array(
    z.object({ alias: aliasSchema, avatar_key: avatarSchema, points: pointsSchema, reached_at: timeSchema }),
  ),
});

export function buildPresentation(raw: unknown, now: Date): PresentationDto | null {
  const parsed = presentationSchema.safeParse(raw);
  if (!parsed.success) return null;
  const board = parsed.data;
  const ranked = rankScores(
    board.rows.map<RankableRow>((row) => ({
      key: opaqueRowKey(board.season_no, row.alias),
      alias: row.alias.normalize("NFC"),
      avatarKey: row.avatar_key,
      points: row.points,
      reachedAt: row.reached_at,
      isMe: false,
    })),
  );
  return {
    className: board.class_name,
    seasonNo: board.season_no,
    maxPoints: maxPointsOf(ranked),
    rows: ranked.map((row) => ({
      rowKey: row.key,
      rank: row.rank,
      alias: row.alias,
      avatarKey: row.avatarKey,
      points: row.points,
    })),
    generatedAt: now.toISOString(),
  };
}

const overviewSchema = z.object({
  feature_approved: z.boolean(),
  enabled: z.boolean(),
  student_view: z.enum(["top10_and_me", "full"]),
  season_no: z.number().int().min(1).nullable(),
  students: z.array(
    z.object({
      student_id: z.uuid(),
      display_name: z.string(),
      alias: z.string().nullable(),
      alias_approved: z.boolean(),
      avatar_key: avatarSchema,
      status: z.enum(["active", "paused"]),
      learning_consent: z.boolean(),
      leaderboard_consent: z.boolean(),
      balance: pointsSchema,
      earned_total: pointsSchema,
      reached_at: timeSchema,
      eligible: z.boolean(),
    }),
  ),
});

export function buildTeacherOverview(raw: unknown): TeacherBoardOverview | null {
  const parsed = overviewSchema.safeParse(raw);
  if (!parsed.success) return null;
  const board = parsed.data;
  const ranked = rankScores(
    board.students.map((student) => ({
      key: student.student_id,
      alias: student.display_name,
      avatarKey: student.avatar_key,
      points: student.balance,
      reachedAt: student.reached_at,
      isMe: false,
      detail: student,
    })),
  );
  return {
    featureApproved: board.feature_approved,
    enabled: board.enabled,
    studentView: board.student_view,
    seasonNo: board.season_no,
    ranked: ranked.map((row) => ({
      studentId: row.detail.student_id,
      displayName: row.detail.display_name,
      alias: row.detail.alias,
      aliasApproved: row.detail.alias_approved,
      avatarKey: row.detail.avatar_key,
      status: row.detail.status,
      learningConsent: row.detail.learning_consent,
      leaderboardConsent: row.detail.leaderboard_consent,
      balance: row.detail.balance,
      earnedTotal: row.detail.earned_total,
      // CSDL là nguồn sự thật về điều kiện; bản TypeScript (eligibilityBlockers) chỉ cho biết LÝ DO còn thiếu.
      eligible: row.detail.eligible,
      rank: row.rank,
    })),
  };
}
