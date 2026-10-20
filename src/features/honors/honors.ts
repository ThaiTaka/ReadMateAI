import { z } from "zod";
import { rankScores, type RankableRow } from "@/features/gamification/ranking";

/**
 * Vinh danh TOP 3 (R06.1) — phần THUẦN: quy tắc chọn người được vinh danh và dựng DTO từ ảnh chụp đã lưu.
 * Quy tắc chọn trùng với hàm CSDL `teacher_create_honor_snapshot` (nơi quyết định thật, vì GV có thể gọi RPC trực tiếp);
 * kiểm thử tích hợp đối chiếu hai bên. DTO không bao giờ có student_id/class_id/nhóm năng lực.
 */

export const HONOR_RANK_LIMIT = 3;
export type HonorRank = 1 | 2 | 3;

export type HonorEntryDto = { rank: HonorRank; alias: string; avatarKey: string; points: number };
export type HonorTierDto = { rank: HonorRank; entries: HonorEntryDto[] };
export type HonorSnapshotDto = {
  id: string;
  seasonNo: number;
  className: string;
  createdAt: string;
  /** Chỉ các bậc CÓ người (hạng 1,1,3 → không có bậc 2), theo thứ tự hạng tăng dần. */
  tiers: HonorTierDto[];
  /** Thứ tự phát cho hoạt cảnh R06.2: TOP 3 → TOP 2 → TOP 1, bỏ bậc trống. */
  playbackOrder: HonorRank[];
};
export type HonorSnapshotSummary = { id: string; seasonNo: number; createdAt: string };

/** Hạng ≤ 3 và điểm > 0, theo Ranking Engine R05 (đồng hạng kiểu thi đấu 1,1,3). Đầu vào: hàng đã đủ điều kiện hiển thị. */
export function selectHonorees<T extends RankableRow>(rows: readonly T[]): Array<T & { rank: HonorRank }> {
  return rankScores(rows).filter(
    (row): row is T & { rank: HonorRank } => row.rank <= HONOR_RANK_LIMIT && row.points > 0,
  );
}

const snapshotSchema = z.object({
  id: z.uuid(),
  season_no: z.number().int().min(1),
  class_name: z.string().min(1),
  created_at: z.string().min(1),
  entries: z.array(
    z.object({
      rank: z.number().int().min(1).max(HONOR_RANK_LIMIT),
      alias: z.string().min(1).max(20),
      avatar_key: z.string().regex(/^[a-z][a-z0-9-]{0,39}$/u),
      points: z.number().int().min(1),
    }),
  ),
});

export function buildHonorSnapshot(raw: unknown): HonorSnapshotDto | null {
  const parsed = snapshotSchema.safeParse(raw);
  if (!parsed.success) return null;
  const { id, season_no, class_name, created_at, entries } = parsed.data;
  const tiers: HonorTierDto[] = ([1, 2, 3] as const).flatMap((rank) => {
    const inTier = entries
      .filter((entry) => entry.rank === rank)
      .map<HonorEntryDto>((entry) => ({
        rank,
        alias: entry.alias.normalize("NFC"),
        avatarKey: entry.avatar_key,
        points: entry.points,
      }));
    return inTier.length > 0 ? [{ rank, entries: inTier }] : [];
  });
  return {
    id,
    seasonNo: season_no,
    className: class_name,
    createdAt: created_at,
    tiers,
    playbackOrder: tiers.map((tier) => tier.rank).reverse(),
  };
}

const summariesSchema = z.array(
  z.object({ id: z.uuid(), season_no: z.number().int().min(1), created_at: z.string().min(1) }),
);

export function buildHonorSummaries(raw: unknown): HonorSnapshotSummary[] | null {
  const parsed = summariesSchema.safeParse(raw);
  if (!parsed.success) return null;
  return parsed.data.map((row) => ({ id: row.id, seasonNo: row.season_no, createdAt: row.created_at }));
}
