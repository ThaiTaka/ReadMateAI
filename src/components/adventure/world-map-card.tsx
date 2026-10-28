import type { Route } from "next";
import { CircleCheck, Info, Lock, Play, Sparkles, Star } from "lucide-react";
import { FriendlyMonster } from "@/components/art/characters";
import { GAME_SCENES } from "@/components/art/scenes";
import type { GameWorldInfo } from "@/features/game-world/catalog";
import type { GameUnlockState } from "@/features/gamification/unlocks";
import { cn } from "@/lib/cn";
import { vi } from "@/strings/vi";
import { AdventureLink } from "./adventure-button";
import { AdventureDialog } from "./adventure-dialog";
import { GameCard, LockedGameCard } from "./game-card";
import { HeartIndicator } from "./heart-indicator";

/**
 * Đường vào bản chơi THẬT của học sinh đã liên kết thẻ học (chỉ truyền khi `live`). Do trang chủ của học sinh tính từ
 * tình trạng lượt chơi thật; thẻ chỉ hiển thị, không tự quyết định gì — ngưỡng điểm và mùa vẫn do CSDL kiểm khi mở bàn chơi.
 */
export type GameEntry =
  | { kind: "play"; href: Route; label: string; note?: string }
  | { kind: "blocked"; note: string; href?: Route; hrefLabel?: string };

type WorldMapCardProps = {
  game: GameWorldInfo;
  state: GameUnlockState;
  /** Tiền tố id để nhiều bản đồ trên cùng trang không trùng id. */
  idPrefix?: string;
  /** Bản thu gọn (lưới nhỏ): bỏ mô tả dài. */
  compact?: boolean;
  as?: "article" | "li";
  /** Dữ liệu THẬT của học sinh đã liên kết (R04+). Không `live` = trang xem trước với dữ liệu minh họa. */
  live?: boolean;
  /** Lần đầu điểm hiện tại đạt ngưỡng trong mùa đã được ghi (dấu "Đã khám phá" — không phải quyền vào chơi). */
  discovered?: boolean;
  /** Chỉ khi `live`: nút vào chơi thật hoặc lý do chưa vào được. Game chưa phát hành không có đường vào. */
  entry?: GameEntry | null;
};

function StatusChip({ eligible }: { eligible: boolean }) {
  return eligible ? (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-jade-600 px-3 py-1 text-sm font-extrabold text-white shadow-soft">
      <CircleCheck aria-hidden="true" className="size-4" />
      {vi.gameWorld.eligible}
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-surface px-3 py-1 text-sm font-extrabold text-magic-800 shadow-soft">
      <Lock aria-hidden="true" className="size-4" />
      {vi.gameWorld.locked}
    </span>
  );
}

/**
 * Thẻ một vùng trò chơi trên Game World: cảnh riêng, tên, ngưỡng điểm, trạng thái khóa/đủ điểm và nút "Xem chi tiết"
 * mở bảng thông tin thật.
 *
 * Nút vào chơi chỉ tồn tại khi đích đến có thật:
 * - học sinh đã liên kết (`live`) + game đã phát hành → `entry` (Vào mê cung / Tiếp tục cuộc phiêu lưu / Chơi lại);
 * - trang xem trước + game có bản thử → "Chơi bản thử (không tính điểm)" tới `demoPath`;
 * - game chưa phát hành → không có nút, chỉ ghi "Chưa phát hành" (không nút giả, không liên kết tới trang chưa có).
 */
export function WorldMapCard({
  game,
  state,
  idPrefix = "game",
  compact = false,
  as = "article",
  live = false,
  discovered = false,
  entry = null,
}: WorldMapCardProps) {
  const t = vi.gameWorld;
  const Scene = GAME_SCENES[game.key];
  const titleId = `${idPrefix}-${game.key}-title`;
  const Card = state.eligible ? GameCard : LockedGameCard;
  const playable = game.release === "playable";
  const demoHref = !live && playable && game.demoPath ? (game.demoPath as Route) : null;

  const progressText = !playable
    ? t.unreleasedNote
    : state.eligible
      ? t.eligibleNote
      : t.needMore.replace("{n}", String(state.missing));

  const chip = !playable ? t.unreleased : live ? t.playable : t.preview;
  const liveEntry = live && playable ? entry : null;
  /** Nút vào chơi; `testId` chỉ gắn cho bản ở thẻ (bản trong bảng thông tin không trùng id). */
  const entryButton = (testId?: string) =>
    liveEntry?.kind === "play" ? (
      <AdventureLink href={liveEntry.href} tone="sun" className="w-full sm:w-auto" data-testid={testId}>
        <Play aria-hidden="true" className="size-6" />
        {liveEntry.label}
      </AdventureLink>
    ) : demoHref ? (
      <AdventureLink href={demoHref} tone="plain" size="md" className="w-full sm:w-auto">
        <Play aria-hidden="true" className="size-5" />
        {t.demoPlay}
      </AdventureLink>
    ) : null;
  const blockedLink = () =>
    liveEntry?.kind === "blocked" && liveEntry.href && liveEntry.hrefLabel ? (
      <AdventureLink href={liveEntry.href} tone="plain" size="md" className="w-full sm:w-auto">
        {liveEntry.hrefLabel}
      </AdventureLink>
    ) : null;
  const entryNote = liveEntry ? liveEntry.note : demoHref ? t.demoNote : !playable ? t.unreleasedNote : null;

  return (
    <Card
      as={as}
      id={`${idPrefix}-${game.key}`}
      titleId={titleId}
      title={game.name}
      tagline={game.tagline}
      accentRing={game.accent.ring}
      art={<Scene dimmed={!state.eligible} />}
      status={
        <>
          <StatusChip eligible={state.eligible} />
          {discovered ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-sun-100 px-3 py-1 text-xs font-extrabold text-sun-900">
              <Sparkles aria-hidden="true" className="size-3.5" />
              {t.discovered}
            </span>
          ) : null}
          <span className="inline-flex items-center rounded-full bg-deep-800/80 px-3 py-1 text-xs font-bold text-white">
            {chip}
          </span>
        </>
      }
      actions={
        <>
          {entryButton(`${idPrefix}-${game.key}-play`)}
          {blockedLink()}
          <AdventureDialog
            title={game.name}
            triggerLabel={
              <>
                <Info aria-hidden="true" className="size-5" />
                {t.details}
              </>
            }
            triggerAriaLabel={t.detailsFor.replace("{name}", game.name)}
            triggerTone={state.eligible ? "jade" : "plain"}
            triggerClassName="w-full sm:w-auto"
          >
            <div className="flex flex-col gap-5">
              <div className="overflow-hidden rounded-2xl ring-1 ring-line">
                <div className="aspect-[16/9]">
                  <Scene />
                </div>
              </div>
              <p className="leading-relaxed text-ink">{game.description}</p>
              <div className="flex flex-wrap items-center gap-2">
                <StatusChip eligible={state.eligible} />
                <span className={cn("rounded-full px-3 py-1 text-sm font-bold", game.accent.chip)}>
                  {t.threshold.replace("{n}", String(game.minBalance))}
                </span>
              </div>
              <p className="text-sm font-semibold text-ink-soft">{progressText}</p>
              <section aria-label={t.skillsTitle}>
                <h3 className="font-extrabold text-ink">{t.skillsTitle}</h3>
                <ul className="mt-2 flex flex-wrap gap-2">
                  {game.skills.map((skill) => (
                    <li
                      key={skill}
                      className="rounded-full bg-lagoon-50 px-3 py-1 text-sm font-semibold text-lagoon-800"
                    >
                      {skill}
                    </li>
                  ))}
                </ul>
              </section>
              <section aria-label={t.howTitle}>
                <h3 className="font-extrabold text-ink">{t.howTitle}</h3>
                <p className="mt-1 text-ink-soft">{game.howToPlay}</p>
              </section>
              <div className="flex items-center gap-4 rounded-2xl bg-magic-50 p-4">
                <div className="w-20 shrink-0">
                  <FriendlyMonster />
                </div>
                <div className="flex flex-col gap-2">
                  <p className="font-semibold text-ink">{t.monsterLine}</p>
                  <HeartIndicator remaining={3} />
                </div>
              </div>
              <section aria-label={t.rulesTitle}>
                <h3 className="font-extrabold text-ink">{t.rulesTitle}</h3>
                <ul className="mt-2 space-y-1.5">
                  {t.rules.map((rule) => (
                    <li key={rule} className="flex items-start gap-2 text-ink-soft">
                      <Star aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-sun-600" />
                      {rule}
                    </li>
                  ))}
                </ul>
              </section>
              <div className="flex flex-col gap-2 rounded-2xl border-2 border-dashed border-line-strong p-4">
                {entryButton()}
                {blockedLink()}
                {entryNote ? <p className="text-sm text-ink-soft">{entryNote}</p> : null}
              </div>
            </div>
          </AdventureDialog>
        </>
      }
    >
      <p className="flex flex-wrap items-center gap-2">
        <span className={cn("rounded-full px-3 py-1 text-sm font-extrabold", game.accent.chip)}>
          {t.threshold.replace("{n}", String(game.minBalance))}
        </span>
        <span className={cn("text-sm font-bold", state.eligible ? "text-jade-700" : "text-magic-700")}>
          {state.eligible ? t.eligible : t.needMore.replace("{n}", String(state.missing))}
        </span>
      </p>
      {liveEntry?.note ? <p className="text-sm font-semibold text-ink-soft">{liveEntry.note}</p> : null}
      {compact ? null : <p className="leading-relaxed text-ink-soft">{game.description}</p>}
    </Card>
  );
}
