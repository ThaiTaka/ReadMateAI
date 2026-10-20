import type { Metadata } from "next";
import Link from "next/link";
import { BookOpenCheck, Heart, KeyRound, Map as MapIcon } from "lucide-react";
import { AchievementBadge } from "@/components/adventure/achievement-badge";
import { AdventureLink } from "@/components/adventure/adventure-button";
import { AvatarFrame } from "@/components/adventure/avatar-frame";
import { GameWorldHeader } from "@/components/adventure/game-world-header";
import { GameWorldMap } from "@/components/adventure/game-world-map";
import { MilestoneTrail } from "@/components/adventure/milestone-trail";
import { PreviewRibbon } from "@/components/adventure/preview-ribbon";
import { ScoreBadge } from "@/components/adventure/score-badge";
import { WorldMapCard } from "@/components/adventure/world-map-card";
import { GuideOwl } from "@/components/art/characters";
import { Card } from "@/components/ui/card";
import { DEMO_ACHIEVEMENTS, DEMO_PLAYER } from "@/features/demo/adventure-data";
import { gameWorld } from "@/features/game-world/catalog";
import { MAP_TILE_STEP } from "@/features/gamification/rules";
import { gameUnlockStates, tilesAllowed } from "@/features/gamification/unlocks";
import { vi } from "@/strings/vi";

export const metadata: Metadata = {
  title: vi.learn.meta.title,
  description: vi.learn.meta.description,
};

/**
 * Student Adventure Dashboard (R02) — BẢN CHƠI THỬ với hồ sơ hư cấu "Mây". Không đọc/ghi dữ liệu học sinh,
 * không có thao tác nào làm thay đổi điểm. Mọi trò chơi là bản xem trước; "Luyện bài" dẫn tới bản chơi thử /demo.
 */
export default function LearnPage() {
  const t = vi.learn;
  const player = DEMO_PLAYER;
  const states = gameUnlockStates(player.balance);
  const earnedBadges = DEMO_ACHIEVEMENTS.filter((badge) => badge.earned).length;

  return (
    <div className="flex flex-col gap-10">
      <PreviewRibbon />
      {/* R03: trang có xác thực của học sinh (thiết bị đã liên kết thẻ học) tách khỏi bản minh họa này. */}
      <Link
        href="/learn/me"
        className="inline-flex min-h-touch-kid items-center gap-3 self-start rounded-full border-2 border-brand-200 bg-surface px-6 text-lg font-bold text-brand-800 hover:border-brand-600"
      >
        <KeyRound aria-hidden="true" className="size-6" />
        {vi.learnHome.linkedCta}
      </Link>

      {/* Đầu trang: avatar, lời chào, điểm, nút chính */}
      <section
        aria-labelledby="learn-greeting"
        className="relative overflow-hidden rounded-world bg-linear-to-br from-jade-600 via-jade-700 to-deep-800 p-5 text-white shadow-world sm:p-8"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 -right-16 size-72 rounded-full bg-[radial-gradient(circle,rgb(46_190_167/0.35),transparent_70%)]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-28 left-1/3 size-72 rounded-full bg-[radial-gradient(circle,rgb(132_88_242/0.35),transparent_70%)]"
        />
        <div className="relative grid gap-6 lg:grid-cols-[1.4fr_1fr] lg:items-center">
          <div className="flex flex-col gap-5">
            <div className="flex items-center gap-4">
              <AvatarFrame
                avatar={player.avatar}
                size="hero"
                ring="sun"
                label={t.avatarLabel.replace("{name}", player.displayName)}
              />
              <div className="min-w-0">
                <h1 id="learn-greeting" className="text-3xl font-extrabold leading-tight sm:text-4xl">
                  {t.greeting.replace("{name}", player.displayName)}
                </h1>
                <p className="mt-1 text-lg font-semibold text-jade-50">{t.greetingSub}</p>
              </div>
            </div>
            <dl className="grid grid-cols-3 gap-2 sm:gap-3">
              {[
                [t.stats.milestones, tilesAllowed(player.earnedTotal)],
                [t.stats.badges, earnedBadges],
                [t.stats.sessions, player.practiceSessions],
              ].map(([label, value]) => (
                <div key={label} className="rounded-2xl bg-white/12 px-3 py-2 ring-1 ring-white/20">
                  <dt className="text-xs font-bold text-jade-50 sm:text-sm">{label}</dt>
                  <dd className="text-2xl font-extrabold tabular-nums">{value}</dd>
                </div>
              ))}
            </dl>
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <AdventureLink href="/demo#luyen-tap" tone="sun">
                <BookOpenCheck aria-hidden="true" className="size-6" />
                {t.practiceCta}
              </AdventureLink>
              <AdventureLink href="/learn#game-world" tone="magic">
                <MapIcon aria-hidden="true" className="size-6" />
                {t.worldCta}
              </AdventureLink>
            </div>
          </div>
          <div className="flex flex-col gap-4">
            <ScoreBadge
              points={player.balance}
              earnedTotal={player.earnedTotal}
              illustrative
              size="lg"
              className="text-ink"
            />
            <div className="flex items-end gap-3">
              <div className="w-24 shrink-0 animate-bob sm:w-28 [&_svg_*]:animate-none!">
                <GuideOwl />
              </div>
              <p className="mb-6 rounded-2xl rounded-bl-sm bg-surface px-4 py-3 font-bold text-ink shadow-lift">
                {t.characters.guideLine}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Game World */}
      <section id="game-world" aria-labelledby="game-world-title" className="flex scroll-mt-6 flex-col gap-6">
        <GameWorldHeader
          id="game-world-title"
          eyebrow={vi.gameWorld.eyebrow}
          title={vi.gameWorld.title}
          description={vi.gameWorld.description.replace("{step}", String(MAP_TILE_STEP))}
        />
        <GameWorldMap states={states} />
        <ul className="grid gap-6 sm:grid-cols-2">
          {states.map((state) => (
            <WorldMapCard key={state.game} as="li" game={gameWorld(state.game)} state={state} />
          ))}
        </ul>
      </section>

      {/* Mốc khám phá */}
      <section aria-labelledby="milestones-title" className="flex flex-col gap-4">
        <GameWorldHeader
          id="milestones-title"
          eyebrow={vi.gameWorld.eyebrow}
          title={vi.gameWorld.milestones.title}
          description={vi.gameWorld.milestones.description.replace("{step}", String(MAP_TILE_STEP))}
        />
        <MilestoneTrail earnedTotal={player.earnedTotal} />
      </section>

      {/* Thành tích */}
      <section id="thanh-tich" aria-labelledby="achievements-title" className="flex scroll-mt-6 flex-col gap-4">
        <div>
          <h2 id="achievements-title" className="text-3xl font-extrabold text-ink">
            {t.achievements.title}
          </h2>
          <p className="mt-1 text-ink-soft">{t.achievements.text}</p>
        </div>
        <ul className="grid grid-cols-2 gap-x-4 gap-y-6 rounded-world border border-line bg-surface p-5 shadow-soft min-[520px]:grid-cols-3 lg:grid-cols-6">
          {DEMO_ACHIEVEMENTS.map((badge) => (
            <li key={badge.id}>
              <AchievementBadge
                title={badge.title}
                description={badge.description}
                icon={badge.icon}
                earned={badge.earned}
              />
            </li>
          ))}
        </ul>
      </section>

      {/* Góc phụ huynh */}
      <section aria-labelledby="learn-parents-title">
        <Card variant="tinted" className="flex gap-4 rounded-world">
          <Heart aria-hidden="true" className="mt-1 size-6 shrink-0 text-brand-700" />
          <div>
            <h2 id="learn-parents-title" className="text-lg font-bold text-ink">
              {t.parents.title}
            </h2>
            <p className="mt-1 leading-relaxed text-ink-soft">{t.parents.text}</p>
          </div>
        </Card>
      </section>
    </div>
  );
}
