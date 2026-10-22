"use client";

import Link from "next/link";
import type { Route } from "next";
import { LogOut, Play, RotateCcw, SkipForward, StepForward } from "lucide-react";
import { useEffect, useReducer, useRef } from "react";
import { MotionScope, MotionToggle } from "@/components/adventure/motion";
import { KidAvatar } from "@/components/art/avatars";
import { AVATAR_KEYS, type AvatarKey } from "@/features/avatars/catalog";
import type { HonorRank, HonorSnapshotDto, HonorTierDto } from "@/features/honors/honors";
import {
  INITIAL_PLAYBACK,
  currentTierRank,
  isTierRevealed,
  primaryLabel,
  reducePlayback,
  tierLayout,
  type PlaybackAction,
  type PlaybackState,
} from "@/features/honors/playback";
import { cn } from "@/lib/cn";
import { vi } from "@/strings/vi";

const t = vi.honors.stage;

const control =
  "inline-flex min-h-12 items-center gap-2 rounded-full border-2 border-white/40 bg-white/10 px-5 font-bold text-white hover:bg-white/20 focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-sun-300 disabled:opacity-50";

const avatarOf = (key: string): AvatarKey =>
  (AVATAR_KEYS as readonly string[]).includes(key) ? (key as AvatarKey) : "may";

/** Hình dáng từng bậc: vàng / bạc / đồng. Số hạng luôn in trên bục — không truyền tin chỉ bằng màu. */
const PODIUM = {
  1: {
    height: "h-40 sm:h-56",
    surface: "from-sun-200 via-sun-400 to-sun-600",
    ring: "from-sun-200 via-sun-400 to-sun-600",
    text: "text-sun-800",
  },
  2: {
    height: "h-28 sm:h-40",
    surface: "from-[#f1f5f9] via-[#cbd5e1] to-[#94a3b8]",
    ring: "from-[#f1f5f9] via-[#cbd5e1] to-[#94a3b8]",
    text: "text-[#334155]",
  },
  3: {
    height: "h-20 sm:h-28",
    surface: "from-[#f3c9a0] via-[#cd8a4e] to-[#9a5a26]",
    ring: "from-[#f3c9a0] via-[#cd8a4e] to-[#9a5a26]",
    text: "text-[#4a2a0c]",
  },
} as const satisfies Record<HonorRank, { height: string; surface: string; ring: string; text: string }>;

// Thứ tự trái → phải của bục danh dự: hạng 2, hạng 1 (giữa), hạng 3.
const STAGE_ORDER: readonly HonorRank[] = [2, 1, 3];

const CONFETTI = [
  { left: "6%", delay: "0s", color: "#ff8a6b" },
  { left: "14%", delay: "3.2s", color: "#5aaef0" },
  { left: "22%", delay: "1.4s", color: "#fdc126" },
  { left: "31%", delay: "5.5s", color: "#2ebea7" },
  { left: "40%", delay: "2.3s", color: "#9f80fa" },
  { left: "49%", delay: "6.8s", color: "#ff8a6b" },
  { left: "58%", delay: "0.8s", color: "#fdc126" },
  { left: "66%", delay: "4.1s", color: "#5aaef0" },
  { left: "74%", delay: "7.4s", color: "#2ebea7" },
  { left: "82%", delay: "2.9s", color: "#9f80fa" },
  { left: "90%", delay: "5s", color: "#fdc126" },
  { left: "96%", delay: "1.9s", color: "#ff8a6b" },
] as const;

const BACKDROP_STARS = [
  { left: "8%", top: "12%" },
  { left: "22%", top: "30%" },
  { left: "78%", top: "10%" },
  { left: "90%", top: "34%" },
  { left: "60%", top: "20%" },
] as const;

/** Hoa giấy rơi chậm. Ẩn hoàn toàn khi giảm chuyển động (CSS theo vùng MotionScope). */
function Confetti() {
  return (
    <div
      aria-hidden="true"
      data-testid="honor-confetti"
      className="pointer-events-none absolute inset-0 overflow-hidden [[data-motion=reduce]_&]:hidden"
    >
      {CONFETTI.map((piece) => (
        <span
          key={piece.left}
          className="absolute top-0 block h-4 w-2 animate-confetti rounded-xs opacity-90"
          style={{ left: piece.left, animationDelay: piece.delay, backgroundColor: piece.color }}
        />
      ))}
    </div>
  );
}

function Star({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={cn("size-6", className)}>
      <path
        d="M12 2l2.9 6.2 6.6.8-4.9 4.6 1.3 6.6L12 16.9 6.1 20.2l1.3-6.6L2.5 9l6.6-.8z"
        fill="#fdc126"
        stroke="#c98a00"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function HonorAvatar({ avatarKey, rank, compact }: { avatarKey: string; rank: HonorRank; compact: boolean }) {
  const size = compact ? "size-14 sm:size-16" : rank === 1 ? "size-24 sm:size-36 lg:size-40" : "size-20 sm:size-28";
  return (
    <span
      className={cn("relative block rounded-full bg-linear-to-br p-1 shadow-soft sm:p-1.5", PODIUM[rank].ring, size)}
    >
      <span className="block size-full overflow-hidden rounded-full bg-surface p-0.5">
        <KidAvatar avatar={avatarOf(avatarKey)} className="size-full" />
      </span>
    </span>
  );
}

function Tier({ tier, revealed, current }: { tier: HonorTierDto; revealed: boolean; current: boolean }) {
  const look = PODIUM[tier.rank];
  const grid = tierLayout(tier.entries.length) === "grid";
  const compact = grid || tier.entries.length > 2;
  return (
    <section
      data-testid="honor-tier"
      data-rank={tier.rank}
      data-revealed={revealed}
      data-current={current}
      aria-label={t.rankLabel.replace("{rank}", String(tier.rank))}
      aria-hidden={revealed ? undefined : true}
      // Bậc chưa hiện vẫn chiếm chỗ (bố cục không dịch chuyển) nhưng vô hình và không nhận focus.
      className={cn("flex min-w-0 flex-col items-center justify-end", revealed ? "animate-pop-in" : "invisible")}
      style={{ flex: `${Math.max(1, Math.min(tier.entries.length, 3))} 1 0%` }}
    >
      <div className="relative flex w-full flex-col items-center">
        {tier.rank === 1 && revealed ? (
          <div
            aria-hidden="true"
            data-testid="honor-halo"
            className="absolute top-1/2 left-1/2 size-[140%] max-w-[26rem] -translate-x-1/2 -translate-y-1/2 animate-glow rounded-full bg-[radial-gradient(circle,rgba(255,227,138,0.85)_0%,rgba(253,193,38,0.35)_45%,rgba(253,193,38,0)_70%)]"
          />
        ) : null}
        {tier.rank === 1 ? <Star className="relative mb-1 size-8 animate-bob sm:size-10" /> : null}
        <ul
          className={cn(
            "relative flex w-full list-none justify-center gap-x-2 gap-y-3 p-0",
            grid ? "grid grid-cols-3 sm:grid-cols-4" : "flex-wrap",
          )}
        >
          {tier.entries.map((entry, index) => (
            <li
              key={`${entry.alias}-${index}`}
              data-testid="honor-entry"
              className={cn(
                "flex min-w-0 flex-col items-center gap-1 text-center text-white",
                !compact && tier.rank === 1 ? "w-28 sm:w-44" : "w-24 sm:w-32",
              )}
            >
              <HonorAvatar avatarKey={entry.avatarKey} rank={tier.rank} compact={compact} />
              <span className="max-w-full text-base leading-tight font-extrabold break-words sm:text-2xl">
                {entry.alias}
              </span>
              <span className="text-sm leading-tight font-bold text-sun-200 sm:text-xl">
                {t.points.replace("{points}", String(entry.points))}
              </span>
            </li>
          ))}
        </ul>
      </div>
      <div
        className={cn(
          "mt-3 flex w-full items-start justify-center rounded-t-2xl bg-linear-to-b pt-2 shadow-soft",
          look.height,
          look.surface,
        )}
      >
        <span className={cn("text-3xl leading-tight font-extrabold sm:text-5xl", look.text)} aria-hidden="true">
          {tier.rank}
        </span>
      </div>
    </section>
  );
}

function announcement(snapshot: HonorSnapshotDto, rank: HonorRank | null, summary: boolean): string {
  if (summary) return t.summaryAnnounce;
  const tier = snapshot.tiers.find((candidate) => candidate.rank === rank);
  if (!tier) return "";
  const names = tier.entries.map((entry) => `${entry.alias}, ${t.points.replace("{points}", String(entry.points))}`);
  return t.announce.replace("{rank}", String(tier.rank)).replace("{names}", names.join("; "));
}

type Props = { snapshot: HonorSnapshotDto; exitHref: string };

/**
 * Sân khấu vinh danh toàn màn hình (R06.2). Chỉ dựng từ ảnh chụp đã lưu (`HonorSnapshotDto`): không tính lại hạng,
 * không gọi server, không tạo ảnh chụp mới — nên "Xem lại" và "Bỏ qua" không có tác dụng phụ nào lên điểm hay mùa.
 */
export function HonorStage({ snapshot, exitHref }: Props) {
  return (
    <MotionScope className="relative flex flex-1 flex-col overflow-hidden">
      <StageInner snapshot={snapshot} exitHref={exitHref} />
    </MotionScope>
  );
}

function StageInner({ snapshot, exitHref }: Props) {
  const order = snapshot.playbackOrder;
  const total = order.length;
  const [state, dispatch] = useReducer(
    (current: PlaybackState, action: PlaybackAction) => reducePlayback(current, action, total),
    INITIAL_PLAYBACK,
  );
  const replayRef = useRef<HTMLButtonElement>(null);
  const primaryRef = useRef<HTMLButtonElement>(null);

  // Next 16 giữ trang vừa rời ở trạng thái ẩn (kèm state) và dùng lại khi mở đúng URL này: dọn effect lúc bị ẩn là lúc
  // đặt lại về đầu, để mở lại từ lịch sử luôn bắt đầu từ HẠNG 3 thay vì dừng ở màn tổng kết cũ.
  useEffect(() => () => dispatch("replay"), []);

  // Nút chính biến mất ở màn tổng kết và quay lại khi xem lại → chuyển focus để bàn phím không "lạc".
  useEffect(() => {
    if (state.phase === "summary") replayRef.current?.focus();
    else if (state.phase === "ready" && document.activeElement === replayRef.current) primaryRef.current?.focus();
  }, [state.phase]);

  const current = currentTierRank(state, order);
  const label = primaryLabel(state, total);
  const summary = state.phase === "summary";
  const celebrating = (summary && total > 0) || current === 1;
  const stageTiers = STAGE_ORDER.flatMap((rank) => snapshot.tiers.filter((tier) => tier.rank === rank));

  return (
    <div
      data-testid="honor-stage"
      data-phase={state.phase}
      className="relative flex flex-1 flex-col bg-linear-to-b from-deep-900 via-deep-800 to-[#1f5d7a]"
    >
      {/* Nền thế giới kỳ diệu: sao nhỏ và hai quầng sáng tĩnh. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 -left-16 size-72 rounded-full bg-magic-400/20 blur-3xl" />
        <div className="absolute right-0 bottom-24 size-80 rounded-full bg-jade-400/15 blur-3xl" />
        {BACKDROP_STARS.map((star) => (
          <span key={star.left} className="absolute" style={{ left: star.left, top: star.top }}>
            <Star className="size-4 animate-twinkle opacity-80" />
          </span>
        ))}
      </div>
      {celebrating ? <Confetti /> : null}

      <div className="relative mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 px-4 py-5 sm:gap-6 sm:px-8 sm:py-8">
        <header className="flex flex-wrap items-end justify-between gap-4 text-white">
          <div>
            <p className="text-lg font-bold text-white/85 sm:text-2xl">
              {t.season.replace("{no}", String(snapshot.seasonNo))}
            </p>
            <h1 className="text-3xl leading-tight font-extrabold sm:text-5xl">
              {t.title.replace("{name}", snapshot.className)}
            </h1>
          </div>
          <MotionToggle tone="dark" />
        </header>

        <div aria-live="polite" className="sr-only" data-testid="honor-announce">
          {announcement(snapshot, current, summary)}
        </div>

        <div className="flex flex-1 flex-col justify-end">
          {summary ? (
            <h2
              className="mb-4 text-center text-2xl leading-tight font-extrabold text-sun-200 sm:text-4xl"
              data-testid="honor-summary-title"
            >
              {total > 0 ? t.summaryTitle : t.emptyShown}
            </h2>
          ) : null}
          {state.phase === "ready" ? (
            <p className="mb-4 text-center text-xl font-bold text-white sm:text-3xl" data-testid="honor-ready">
              {t.readyHint}
            </p>
          ) : null}
          <div role="group" aria-label={t.stageLabel} className="flex items-end justify-center gap-2 sm:gap-6">
            {stageTiers.map((tier) => (
              <Tier
                key={tier.rank}
                tier={tier}
                revealed={isTierRevealed(state, order, tier.rank)}
                current={current === tier.rank}
              />
            ))}
          </div>
        </div>

        <nav aria-label={t.controls} className="flex flex-wrap items-center justify-center gap-3">
          {summary ? null : (
            <button ref={primaryRef} type="button" className={control} onClick={() => dispatch("next")}>
              {label === "start" ? (
                <Play aria-hidden="true" className="size-5" />
              ) : (
                <StepForward aria-hidden="true" className="size-5" />
              )}
              {label === "start" ? t.start : label === "next" ? t.next : t.toSummary}
            </button>
          )}
          <button type="button" className={control} onClick={() => dispatch("skip")} disabled={summary}>
            <SkipForward aria-hidden="true" className="size-5" />
            {t.skip}
          </button>
          <button ref={replayRef} type="button" className={control} onClick={() => dispatch("replay")}>
            <RotateCcw aria-hidden="true" className="size-5" />
            {t.replay}
          </button>
          <Link href={exitHref as Route} className={control}>
            <LogOut aria-hidden="true" className="size-5" />
            {t.exit}
          </Link>
        </nav>
        <p className="text-center text-base text-white/75">{t.note}</p>
      </div>
    </div>
  );
}
