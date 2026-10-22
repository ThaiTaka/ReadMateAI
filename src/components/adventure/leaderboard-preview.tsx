import type { DemoLeaderboardEntry } from "@/features/demo/adventure-data";
import { cn } from "@/lib/cn";
import { vi } from "@/strings/vi";
import { AvatarFrame } from "./avatar-frame";

type LeaderboardPreviewProps = {
  entries: readonly DemoLeaderboardEntry[];
  className?: string;
};

const RANK_STYLES = ["bg-sun-400 text-ink", "bg-jade-500 text-white", "bg-magic-500 text-white"] as const;

/**
 * Bảng xếp hạng MINH HỌA dạng thanh ngang (LEADERBOARD_SPEC). Tên hư cấu, dữ liệu cố định trong bộ nhớ.
 * Ngôn ngữ trung tính: không "thua", "kém", "cuối bảng"; không hiện nhóm năng lực. Bảng thật: R05, mặc định tắt.
 */
export function LeaderboardPreview({ entries, className }: LeaderboardPreviewProps) {
  const t = vi.demo.worldPreview;
  const sorted = [...entries].sort((a, b) => b.points - a.points);
  const top = sorted[0]?.points ?? 1;
  return (
    <ol className={cn("flex flex-col gap-3", className)}>
      {sorted.map((entry, index) => {
        const rank = index + 1;
        const width = Math.max(18, Math.round((entry.points / top) * 100));
        return (
          <li
            key={entry.alias}
            aria-label={t.leaderboardRow
              .replace("{rank}", String(rank))
              .replace("{name}", entry.alias)
              .replace("{points}", String(entry.points))}
            className={cn(
              "flex items-center gap-3 rounded-2xl p-2 pr-3",
              entry.isMe ? "bg-sun-50 ring-2 ring-sun-300" : "bg-surface ring-1 ring-line",
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                "flex size-9 shrink-0 items-center justify-center rounded-full text-base font-extrabold",
                RANK_STYLES[index] ?? "bg-surface-muted text-ink",
              )}
            >
              {rank}
            </span>
            <AvatarFrame avatar={entry.avatar} size="sm" ring={entry.isMe ? "sun" : "jade"} />
            <div aria-hidden="true" className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="flex items-center gap-2 font-extrabold text-ink">
                <span className="truncate">{entry.alias}</span>
                {entry.isMe ? (
                  <span className="rounded-full bg-sun-200 px-2 py-0.5 text-xs font-bold text-sun-800">{t.me}</span>
                ) : null}
              </span>
              <span className="h-3 w-full rounded-full bg-surface-muted">
                <span
                  className="block h-full rounded-full bg-linear-to-r from-jade-400 to-jade-600"
                  style={{ width: `${width}%` }}
                />
              </span>
            </div>
            <span aria-hidden="true" className="shrink-0 text-right text-lg font-extrabold tabular-nums text-ink">
              {entry.points}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
