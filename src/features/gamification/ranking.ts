/**
 * Ranking Engine (R05) — HÀM THUẦN, không phụ thuộc giao diện hay CSDL (LEADERBOARD_SPEC §3–§4).
 * Dùng chung cho bảng của học sinh, màn hình giáo viên, trình chiếu và (R06) vinh danh / thứ hạng cuối mùa.
 *
 *  - Điểm xếp hạng = điểm HIỆN TẠI (`season_scores.balance`), không phải điểm tích lũy.
 *  - Đồng hạng kiểu thi đấu: 1, 2, 2, 4 (không phải 1, 2, 2, 3).
 *  - Thứ tự HIỂN THỊ trong nhóm đồng hạng: đạt mức điểm sớm hơn trước → tên (NFC, so sánh tiếng Việt) → khóa hàng.
 *    Đó chỉ là thứ tự đọc; số hạng không đổi và không có tiêu chí phụ nào phân thắng thua.
 *  - Không bao giờ bịa điểm cho dữ liệu thiếu: học sinh chưa có bản ghi điểm mùa có 0 điểm thật (chưa có sự kiện nào).
 */

export type LeaderboardView = "top10_and_me" | "full";

/** Hàng đã đủ điều kiện hiển thị, sẵn sàng xếp hạng. `key` là khóa mờ (không phải mã học sinh). */
export type RankableRow = {
  key: string;
  alias: string;
  avatarKey: string;
  points: number;
  /** Thời điểm điểm hiện tại được xác lập (giờ của CSDL, ISO 8601); null = chưa có sự kiện điểm. */
  reachedAt: string | null;
  isMe: boolean;
};

export type RankedRow = RankableRow & { rank: number };

/** Số hạng tối đa hiển thị ở chế độ "TOP 10 + Con" và trần cứng khi nhiều bạn đồng hạng (không cắt giữa nhóm đồng hạng). */
export const TOP_RANK_LIMIT = 10;
export const TOP_ROWS_HARD_CAP = 30;

const collator = new Intl.Collator("vi", { sensitivity: "variant", numeric: false });

export function compareAlias(a: string, b: string): number {
  return collator.compare(a.normalize("NFC"), b.normalize("NFC"));
}

function timeOf(value: string | null): number | null {
  if (value === null) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** So sánh THỨ TỰ HIỂN THỊ (không phải thứ hạng). Tổng thứ tự → kết quả ổn định giữa các lần tải. */
export function compareDisplayOrder(a: RankableRow, b: RankableRow): number {
  if (a.points !== b.points) return b.points - a.points;
  const timeA = timeOf(a.reachedAt);
  const timeB = timeOf(b.reachedAt);
  if (timeA !== timeB) {
    if (timeA === null) return 1;
    if (timeB === null) return -1;
    return timeA - timeB;
  }
  const byAlias = compareAlias(a.alias, b.alias);
  if (byAlias !== 0) return byAlias;
  return a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
}

/**
 * Xếp hạng kiểu thi đấu: hạng = 1 + số người có điểm CAO HƠN. Đầu vào không bị sửa.
 * Ví dụ 250, 200, 200, 160, 100 → hạng 1, 2, 2, 4, 5.
 */
export function rankScores<T extends RankableRow>(rows: readonly T[]): Array<T & { rank: number }> {
  const sorted = [...rows].sort(compareDisplayOrder);
  let rank = 0;
  return sorted.map((row, index) => {
    const previous = sorted[index - 1];
    if (!previous || previous.points !== row.points) rank = index + 1;
    return { ...row, rank };
  });
}

/** Chiều dài thanh (%) tỉ lệ tuyến tính với điểm; 0 điểm → 0 (thanh rỗng, không có độ dài tối thiểu giả). */
export function calculateBarWidth(points: number, maxPoints: number): number {
  if (!Number.isFinite(points) || !Number.isFinite(maxPoints) || maxPoints <= 0 || points <= 0) return 0;
  const percent = (Math.min(points, maxPoints) / maxPoints) * 100;
  return Math.round(percent * 100) / 100;
}

export function maxPointsOf(rows: ReadonlyArray<{ points: number }>): number {
  return rows.reduce((max, row) => Math.max(max, row.points), 0);
}

/** TOP: mọi hàng có hạng ≤ limit (không cắt giữa nhóm đồng hạng), tối đa `hardCap` hàng. */
export function getTopRankedStudents<T extends RankedRow>(
  ranked: readonly T[],
  limit: number = TOP_RANK_LIMIT,
  hardCap: number = TOP_ROWS_HARD_CAP,
): T[] {
  return ranked.filter((row) => row.rank <= limit).slice(0, hardCap);
}

export type VisibleRows<T extends RankedRow> = {
  rows: T[];
  /** Hàng của chính học sinh khi em đủ điều kiện hiển thị nhưng nằm ngoài phần đầu bảng. */
  myRow: T | null;
};

/**
 * Chọn các hàng gửi cho học sinh theo kiểu hiển thị của lớp. Không để lộ học sinh bị ẩn: dữ liệu vào đã chỉ gồm
 * học sinh đủ điều kiện, và kết quả không mang số lượng/tổng của phần còn lại.
 */
export function selectVisibleRows<T extends RankedRow>(ranked: readonly T[], view: LeaderboardView): VisibleRows<T> {
  if (view === "full") return { rows: [...ranked], myRow: null };
  const rows = getTopRankedStudents(ranked);
  const mine = ranked.find((row) => row.isMe) ?? null;
  const listed = mine !== null && rows.some((row) => row.key === mine.key);
  return { rows, myRow: mine !== null && !listed ? mine : null };
}

// ---------------------------------------------------------------------------------------------------------------
// Điều kiện xuất hiện trên bảng (PRIVACY_AND_SECURITY §5) — bản TypeScript dùng cho màn hình GV và kiểm thử.
// Đường học sinh/trình chiếu lọc bằng CSDL (`private.leaderboard_rows`); kiểm thử tích hợp đối chiếu hai bên.
// ---------------------------------------------------------------------------------------------------------------

export type LeaderboardCandidate = {
  status: "active" | "paused" | "archived";
  alias: string | null;
  aliasApproved: boolean;
  learningDataConsent: boolean;
  leaderboardConsent: boolean;
  points: number;
  reachedAt: string | null;
  avatarKey: string;
  key: string;
};

export const ELIGIBILITY_BLOCKERS = [
  "STUDENT_INACTIVE",
  "NO_LEARNING_CONSENT",
  "NO_LEADERBOARD_CONSENT",
  "NO_APPROVED_ALIAS",
] as const;
export type EligibilityBlocker = (typeof ELIGIBILITY_BLOCKERS)[number];

export function eligibilityBlockers(candidate: LeaderboardCandidate): EligibilityBlocker[] {
  const blockers: EligibilityBlocker[] = [];
  if (candidate.status !== "active") blockers.push("STUDENT_INACTIVE");
  if (!candidate.learningDataConsent) blockers.push("NO_LEARNING_CONSENT");
  if (!candidate.leaderboardConsent) blockers.push("NO_LEADERBOARD_CONSENT");
  if (!candidate.alias || candidate.alias.trim() === "" || !candidate.aliasApproved) blockers.push("NO_APPROVED_ALIAS");
  return blockers;
}

/**
 * Chuẩn hóa ứng viên → hàng xếp hạng được: chỉ giữ học sinh đủ điều kiện, tên NFC, điểm là số nguyên ≥ 0.
 * Không dùng họ tên thật thay cho tên hiển thị thiếu; không bịa điểm.
 */
export function normalizeLeaderboardRows(
  candidates: readonly LeaderboardCandidate[],
  viewerKey: string | null = null,
): RankableRow[] {
  const rows: RankableRow[] = [];
  for (const candidate of candidates) {
    if (eligibilityBlockers(candidate).length > 0) continue;
    if (!Number.isInteger(candidate.points) || candidate.points < 0) continue;
    rows.push({
      key: candidate.key,
      alias: (candidate.alias ?? "").normalize("NFC").trim(),
      avatarKey: candidate.avatarKey,
      points: candidate.points,
      reachedAt: candidate.reachedAt,
      isMe: viewerKey !== null && candidate.key === viewerKey,
    });
  }
  return rows;
}
