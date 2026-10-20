import { Crown, Medal } from "lucide-react";
import { AvatarFrame } from "@/components/adventure/avatar-frame";
import { safeAvatarKey } from "@/components/forms/avatar-choices";
import { cn } from "@/lib/cn";
import { vi } from "@/strings/vi";
import { ScoreBar } from "./score-bar";

/**
 * Bảng điểm dạng thanh ngang (kiểu bảng xếp hạng thể thao — chỉ ý tưởng bố cục, không dùng tên/logo/màu của bên nào).
 * Dùng chung cho học sinh, giáo viên, trình chiếu và bản chơi thử. Hàng của bảng đã được xếp hạng bởi `ranking.ts`.
 *
 * Quy tắc trình bày (LEADERBOARD_SPEC §4–§5): mọi thanh cùng một màu; TOP 3 có huy hiệu hình + chữ "Hạng n" (không chỉ
 * màu); hàng của chính học sinh có viền nổi bật và nhãn "Con"; không biểu tượng/màu cảnh báo cho điểm thấp hay đổi hạng.
 */

export type BoardRow = {
  rowKey: string;
  rank: number;
  alias: string;
  avatarKey: string;
  points: number;
  isMe?: boolean;
};

const t = vi.leaderboard.board;

const fill = (template: string, values: Record<string, string | number>) =>
  Object.entries(values).reduce((text, [key, value]) => text.replace(`{${key}}`, String(value)), template);

export function rowLabel(row: BoardRow): string {
  return fill(row.isMe ? t.rowMe : t.row, { rank: row.rank, name: row.alias, points: row.points });
}

const RANK_CHIP: Record<number, string> = {
  1: "bg-sun-300 text-ink ring-sun-100",
  2: "bg-[#dfe5ee] text-ink ring-white",
  3: "bg-[#f0b48c] text-ink ring-[#ffe2cf]",
};

/** Huy hiệu hạng vàng/bạc/đồng chỉ dành cho hạng 1–3 CÓ điểm: cả lớp cùng 0 điểm thì không ai được "vương miện". */
function RankBadge({ rank, size, earned }: { rank: number; size: "md" | "xl"; earned: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full font-extrabold tabular-nums ring-2",
        size === "xl" ? "size-14 text-3xl sm:size-16" : "size-9 text-lg sm:size-11 sm:text-xl",
        (earned ? RANK_CHIP[rank] : undefined) ?? "bg-white/15 text-white ring-white/20",
      )}
    >
      {rank}
    </span>
  );
}

function TopMark({ rank, size, earned }: { rank: number; size: "md" | "xl"; earned: boolean }) {
  if (rank > 3 || !earned) return null;
  const Icon = rank === 1 ? Crown : Medal;
  return (
    <span
      aria-hidden="true"
      className={cn(
        "animate-pop-in flex items-center justify-center rounded-full ring-2 ring-white",
        RANK_CHIP[rank],
        size === "xl" ? "size-9" : "size-6",
      )}
    >
      <Icon className={size === "xl" ? "size-5" : "size-3.5"} />
    </span>
  );
}

type LeaderboardRowViewProps = {
  row: BoardRow;
  maxPoints: number;
  size?: "md" | "xl";
};

export function LeaderboardRowView({ row, maxPoints, size = "md" }: LeaderboardRowViewProps) {
  const xl = size === "xl";
  return (
    <li
      data-testid="leaderboard-row"
      data-rank={row.rank}
      data-me={row.isMe ? "true" : undefined}
      className={cn(
        "flex items-center gap-3 rounded-3xl border p-2.5 pr-3.5 shadow-[0_6px_0_rgb(13_40_59/0.25)] sm:gap-4 sm:p-3 sm:pr-5",
        row.isMe ? "border-sun-300 bg-white/20 ring-2 ring-sun-300" : "border-white/15 bg-white/10",
        xl && "gap-5 p-4 pr-6 sm:gap-6 sm:p-5 sm:pr-8",
      )}
    >
      <span className="sr-only">{rowLabel(row)}</span>
      <RankBadge rank={row.rank} size={size} earned={row.points > 0} />
      <AvatarFrame
        avatar={safeAvatarKey(row.avatarKey)}
        size={xl ? "lg" : "sm"}
        ring={row.isMe ? "sun" : "jade"}
        badge={<TopMark rank={row.rank} size={size} earned={row.points > 0} />}
        className={cn(row.rank === 1 && row.points > 0 && "animate-bob")}
      />
      <div aria-hidden="true" className="flex min-w-0 flex-1 flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-4">
        <span
          className={cn(
            "flex min-w-0 items-center gap-2 font-extrabold text-white sm:w-44 sm:shrink-0",
            xl ? "text-2xl sm:w-64 sm:text-4xl" : "text-lg sm:text-xl",
          )}
        >
          <span className="truncate">{row.alias}</span>
          {row.isMe ? (
            <span className="shrink-0 rounded-full bg-sun-200 px-2.5 py-0.5 text-xs font-bold text-sun-800 sm:text-sm">
              {t.me}
            </span>
          ) : null}
        </span>
        <ScoreBar points={row.points} maxPoints={maxPoints} size={size} className="sm:flex-1" />
      </div>
      <span
        aria-hidden="true"
        className={cn(
          "shrink-0 text-right font-extrabold text-white tabular-nums",
          xl ? "min-w-24 text-4xl sm:min-w-32 sm:text-6xl" : "min-w-12 text-2xl sm:min-w-16 sm:text-3xl",
        )}
      >
        {row.points}
      </span>
    </li>
  );
}

type LeaderboardBoardProps = {
  rows: readonly BoardRow[];
  maxPoints: number;
  myRow?: BoardRow | null;
  size?: "md" | "xl";
  className?: string;
};

/** Danh sách hàng; `myRow` (nếu có) là hàng của chính học sinh nằm ngoài phần đầu bảng, tách riêng bên dưới. */
export function LeaderboardBoard({ rows, maxPoints, myRow = null, size = "md", className }: LeaderboardBoardProps) {
  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <ol aria-label={t.list} className={cn("flex flex-col", size === "xl" ? "gap-4" : "gap-3")}>
        {rows.map((row) => (
          <LeaderboardRowView key={row.rowKey} row={row} maxPoints={maxPoints} size={size} />
        ))}
      </ol>
      {myRow ? (
        <div className="flex flex-col gap-2">
          <p aria-hidden="true" className="px-2 text-sm font-bold text-white/80">
            {t.listMeNote}
          </p>
          <ol aria-label={t.listMe}>
            <LeaderboardRowView row={{ ...myRow, isMe: true }} maxPoints={maxPoints} size={size} />
          </ol>
        </div>
      ) : null}
    </div>
  );
}

/** Khung nền của bảng: sắc xanh đêm có chiều sâu, ánh sáng dịu — chữ trắng đạt tương phản cao. */
export function BoardPanel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-world bg-linear-to-b from-deep-800 via-deep-900 to-jade-900 p-4 text-white shadow-world sm:p-6",
        className,
      )}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 -right-16 size-72 rounded-full bg-[radial-gradient(circle,rgb(95_214_192/0.28),transparent_70%)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-28 -left-20 size-80 rounded-full bg-[radial-gradient(circle,rgb(253_193_38/0.16),transparent_70%)]"
      />
      <div className="relative">{children}</div>
    </section>
  );
}
