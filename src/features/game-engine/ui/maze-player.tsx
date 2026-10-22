"use client";

import Link from "next/link";
import type { Route } from "next";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Maximize2, Minimize2, Pause, Play, RotateCcw } from "lucide-react";
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
  type RefObject,
} from "react";
import { MotionToggle } from "@/components/adventure/motion";
import { MazeBoard } from "@/components/art/maze-board";
import { cn } from "@/lib/cn";
import { vi } from "@/strings/vi";
import {
  ENCOUNTERS_PER_LEVEL,
  createInitialState,
  gameReducer,
  positionKey,
  parseLevel,
  revealedTriggers,
  type Direction,
  type GameAction,
  type GameEvent,
  type GameState,
  type Level,
  type ParsedLevel,
  type Position,
} from "../core/index.ts";
import { cameraOrigin, viewCells } from "./camera.ts";
import type { PositionSaver } from "./position-saver.ts";
import { useHoldMove } from "./use-hold-move.ts";

/*
 * Bản chơi thử Mê cung kho báu (R07.4): điều khiển nhân vật bằng lõi `gameReducer` (R07.2). Chỉ ở /demo,
 * không lưu, không điểm, không câu hỏi (R08). Nút "Tiếp tục bản chơi thử" chỉ GIẢ LẬP hoàn tất một thử thách.
 */

const t = vi.treasureMazeDemo;

const KEY_DIRECTIONS: Readonly<Record<string, Direction>> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  KeyW: "up",
  KeyS: "down",
  KeyA: "left",
  KeyD: "right",
};

const PAD: readonly { direction: Direction; label: string; Icon: typeof ArrowUp; cell: string }[] = [
  { direction: "up", label: t.moves.up, Icon: ArrowUp, cell: "col-start-2 row-start-1" },
  { direction: "left", label: t.moves.left, Icon: ArrowLeft, cell: "col-start-1 row-start-2" },
  { direction: "down", label: t.moves.down, Icon: ArrowDown, cell: "col-start-2 row-start-2" },
  { direction: "right", label: t.moves.right, Icon: ArrowRight, cell: "col-start-3 row-start-2" },
];

type PlayState = { game: GameState; bumps: number; trail: readonly Position[] };

/**
 * Lượt chơi có lưu (R07.5b2): bắt đầu từ vị trí máy chủ xác nhận và đẩy từng bước đi THỰC SỰ cho bộ tự lưu.
 * Không có `encounters`: chạm trán TẮT (client không phát hiện điểm kích hoạt, rương luôn khóa) — kiểu R07.5b2.
 * Có `encounters` (R08.4): bản đồ đóng gói dùng để DỪNG nhân vật ở điểm kích hoạt và hiện màn quái vật do `renderEncounter`
 * dựng; MÁY CHỦ vẫn là nơi quyết định chạm trán nào kích hoạt/đã xong/rương mở được. Lõi không đếm chạm trán đã xong.
 */
export type EncounterHost = {
  /** Điểm kích hoạt đã kết thúc (máy chủ báo, chỉ mã) — không dừng lại ở đó nữa. */
  readonly resolvedTriggerIds: readonly string[];
  /** Màn quái vật (lớp phủ). `dismiss` chỉ gỡ chặn di chuyển, không ghi nhận kết quả. */
  readonly renderEncounter: (ctx: { triggerId: string; dismiss: () => void }) => ReactNode;
  /** Vùng kho báu; `atTreasure` = nhân vật đang đứng ở ô rương. */
  readonly renderTreasure: (atTreasure: boolean) => ReactNode;
  /** Dòng tiến độ dưới bàn chơi ("Con đã gặp 3/7 bạn quái vật!"). */
  readonly progressText: string;
  /** Khóa điều khiển (đã mở rương xong). */
  readonly locked: boolean;
};

export type SavedBinding = {
  readonly initial: Position;
  readonly saver: PositionSaver;
  readonly encounters?: EncounterHost;
};

function messageFor(event: GameEvent): string {
  switch (event.type) {
    case "blocked":
      return t.messages.wall;
    case "paused":
      return t.messages.paused;
    case "resumed":
      return t.messages.resumed;
    case "encounter_triggered":
      return t.messages.encounter;
    case "treasure_locked":
      return t.messages.locked;
    case "treasure_opened":
      return t.messages.opened;
    case "rejected":
      if (event.reason === "paused") return t.messages.paused;
      return event.reason === "encounter_pending" ? t.messages.encounter : "";
    default:
      return "";
  }
}

/** Sự kiện làm dừng việc giữ-để-đi: va tường/biên, tạm dừng, chạm trán, từ chối hành động, mở rương. */
const STOPPING: ReadonlySet<GameEvent["type"]> = new Set([
  "blocked",
  "paused",
  "encounter_triggered",
  "rejected",
  "treasure_opened",
]);

const DESKTOP_QUERY = "(min-width: 768px)";
function subscribeDesktop(onChange: () => void) {
  const media = window.matchMedia(DESKTOP_QUERY);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

const INTERACTIVE = "a[href],button,input,select,textarea,summary,[contenteditable],[tabindex]:not([tabindex='-1'])";

const noopSubscribe = () => () => undefined;

function isTypingTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/u.test(target.tagName))
  );
}

/** Lớp phủ tạm dừng: tự giữ trạng thái "đang lưu/chưa lưu" nên được dựng lại sạch mỗi lần tạm dừng. */
function PauseOverlay({ backHref, saved, onResume }: { backHref: Route; saved?: SavedBinding; onResume: () => void }) {
  const [leave, setLeave] = useState<"idle" | "saving" | "unsaved">("idle");
  const backRef = useRef<HTMLAnchorElement>(null);
  const continueRef = useRef<HTMLButtonElement>(null);
  const skipGuard = useRef(false);
  useEffect(() => {
    continueRef.current?.focus();
  }, []);
  return (
    <div
      role="dialog"
      aria-label={t.pauseOverlay.title}
      data-testid="pause-overlay"
      onKeyDown={(event) => {
        if (event.key !== "Tab") return;
        const items = Array.from(event.currentTarget.querySelectorAll<HTMLElement>("button,a[href]"));
        const first = items[0];
        const last = items.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }}
      className="absolute inset-0 z-10 flex items-center justify-center bg-ink/55 p-4"
    >
      <div className="animate-pop-in w-full max-w-xs rounded-3xl border-2 border-line bg-surface p-5 text-center">
        <h2 className="text-xl font-extrabold text-ink">
          {leave === "unsaved" ? t.pauseOverlay.unsavedTitle : t.pauseOverlay.title}
        </h2>
        <p className="mt-1 text-sm font-semibold text-ink-soft">
          {leave === "unsaved" ? t.pauseOverlay.unsavedText : t.pauseOverlay.text}
        </p>
        <div className="mt-4 flex flex-col gap-3">
          <button
            ref={continueRef}
            type="button"
            onClick={onResume}
            className="inline-flex min-h-16 items-center justify-center gap-2 rounded-2xl border-2 border-jade-600 bg-jade-600 px-5 text-lg font-extrabold text-white"
          >
            <Play aria-hidden="true" className="size-5" />
            {t.pauseOverlay.continue}
          </button>
          <Link
            ref={backRef}
            href={backHref}
            aria-disabled={leave === "saving"}
            onClick={(event) => {
              if (!saved || skipGuard.current || leave === "unsaved") return;
              event.preventDefault();
              if (leave === "saving") return;
              setLeave("saving");
              void saved.saver.flushAndWait(4000).then((ok) => {
                if (ok) {
                  skipGuard.current = true;
                  backRef.current?.click();
                } else setLeave("unsaved");
              });
            }}
            className="inline-flex min-h-16 items-center justify-center rounded-2xl border-2 border-line-strong bg-surface px-5 text-lg font-bold text-ink"
          >
            {leave === "saving"
              ? t.pauseOverlay.leaving
              : leave === "unsaved"
                ? t.pauseOverlay.leaveAnyway
                : t.pauseOverlay.toMap}
          </Link>
        </div>
      </div>
    </div>
  );
}

export function MazeRun({
  level,
  rootRef,
  onReplay,
  saved,
  backHref,
}: {
  level: Level;
  rootRef: RefObject<HTMLDivElement | null>;
  onReplay: () => void;
  saved?: SavedBinding;
  /** Đích của "Về bản đồ" ở lớp phủ tạm dừng. */
  backHref: Route;
}) {
  const hosted = saved?.encounters;
  const parsed: ParsedLevel = useMemo(
    () => (saved && !hosted ? { ...parseLevel(level), triggers: [] } : parseLevel(level)),
    [level, saved, hosted],
  );
  const reducer = useMemo(
    () =>
      (state: PlayState, action: GameAction): PlayState => {
        // Rương đã mở (máy chủ xác nhận): không đi tiếp nữa, kể cả bằng bàn phím.
        if (action.type === "MOVE" && hosted?.locked) return state;
        const game = gameReducer(parsed, state.game, action);
        const stepped = saved && game.moves > state.game.moves;
        return {
          game,
          bumps: game.lastEvent.type === "blocked" ? state.bumps + 1 : state.bumps,
          trail: stepped ? [...state.trail, game.position] : state.trail,
        };
      },
    [parsed, saved, hosted],
  );
  const [{ game, bumps, trail }, dispatch] = useReducer(reducer, parsed, (p): PlayState => {
    const initial = createInitialState(p);
    if (!saved) return { game: initial, bumps: 0, trail: [] };
    const host = saved.encounters;
    // Điểm đã dùng (máy chủ báo) coi như đã kích hoạt → không dừng lại nữa. Đang đứng ở điểm CHƯA dùng (đang diễn ra hoặc
    // chưa kích hoạt được) thì máy chủ cũng không cho rời đi → mở lại ngay cổng chạm trán.
    const used = host
      ? p.triggers.filter((trigger) => host.resolvedTriggerIds.includes(trigger.id)).map((x) => x.id)
      : [];
    const here = host
      ? p.triggers.find((trigger) => positionKey(trigger) === positionKey(saved.initial) && !used.includes(trigger.id))
      : undefined;
    return {
      game: {
        ...initial,
        position: saved.initial,
        triggered: here ? [...used.filter((id) => id !== here.id), here.id] : used,
        pendingEncounter: here?.id ?? null,
      },
      bumps: 0,
      trail: [],
    };
  });
  const pauseRef = useRef<HTMLButtonElement>(null);
  const hold = useHoldMove((direction) => dispatch({ type: "MOVE", direction }));

  const forwarded = useRef(0);
  // Layout effect: bước cuối phải vào hàng chờ lưu TRƯỚC khi các effect con (cổng chạm trán) hỏi "đã lưu hết chưa".
  useLayoutEffect(() => {
    if (!saved) return;
    while (forwarded.current < trail.length) saved.saver.push(trail[forwarded.current++]!);
  }, [trail, saved]);
  const paused = game.paused;
  useEffect(() => {
    if (saved && paused) saved.saver.flush();
  }, [paused, saved]);

  const wasPaused = useRef(false);
  useEffect(() => {
    // Thoát tạm dừng thì trả tiêu điểm về nút tạm dừng (lớp phủ tự lấy tiêu điểm khi hiện).
    if (!paused && wasPaused.current) pauseRef.current?.focus();
    wasPaused.current = paused;
  }, [paused]);

  useEffect(() => {
    if (STOPPING.has(game.lastEvent.type)) hold.releaseAll();
  }, [game.lastEvent, hold]);

  useEffect(() => {
    // Phím chỉ bị bỏ qua khi tiêu điểm đang ở một điều khiển tương tác NGOÀI khu vực game (liên kết, nút, ô nhập...);
    // vùng nền như <main> (Next đưa tiêu điểm về đó sau khi bấm nút) vẫn nhận phím.
    const inGameArea = (target: EventTarget | null) =>
      !(target instanceof Element) || !!rootRef.current?.contains(target) || target.closest(INTERACTIVE) === null;
    const down = (event: KeyboardEvent) => {
      // Màn quái vật là lớp phủ trong cây DOM của bàn chơi: phím trong đó không phải phím di chuyển.
      if (event.target instanceof Element && event.target.closest("[data-encounter-layer]")) return;
      if (event.code === "Escape" && paused && !isTypingTarget(event.target) && inGameArea(event.target)) {
        dispatch({ type: "RESUME" });
        return;
      }
      const direction = KEY_DIRECTIONS[event.code];
      if (!direction || event.ctrlKey || event.metaKey || event.altKey) return;
      if (isTypingTarget(event.target) || !inGameArea(event.target)) return;
      event.preventDefault();
      if (!event.repeat) hold.press(`key:${event.code}`, direction);
    };
    const up = (event: KeyboardEvent) => {
      if (KEY_DIRECTIONS[event.code]) hold.release(`key:${event.code}`);
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [hold, rootRef, paused]);

  const desktop = useSyncExternalStore(
    subscribeDesktop,
    () => window.matchMedia(DESKTOP_QUERY).matches,
    () => false,
  );
  const [overviewChoice, setOverviewChoice] = useState<boolean | null>(null);
  const overview = overviewChoice ?? desktop;

  const size = parsed.grid.rowCount;
  const view = viewCells(size, overview);
  const origin = cameraOrigin(size, view, game.position);
  // Chế độ có chạm trán: không đánh dấu điểm kích hoạt nào trên bản đồ (kể cả đã gặp) — không vẽ trước, không lộ.
  const found = saved ? [] : revealedTriggers(parsed, game);
  const locked = game.paused || game.pendingEncounter !== null || game.completed || hosted?.locked === true;
  const atTreasure = hosted !== undefined && positionKey(game.position) === positionKey(parsed.treasure);
  const pending = game.pendingEncounter;

  return (
    <div data-testid="maze-run" data-moves={game.moves} data-level={game.levelId} data-completed={game.completed}>
      <div
        data-testid="maze-board"
        data-view={view}
        className="relative mx-auto aspect-square w-full max-w-[34rem] overflow-hidden rounded-[2rem] shadow-world"
      >
        <div
          data-testid="maze-world"
          className="absolute top-0 left-0 transition-transform duration-200 ease-linear will-change-transform"
          style={{
            width: `${(size / view) * 100}%`,
            transform: `translate(${(-origin.x / size) * 100}%, ${(-origin.y / size) * 100}%)`,
          }}
        >
          <MazeBoard
            rows={level.rows}
            title={t.boardLabel}
            className="rounded-none shadow-none"
            hero={{ row: game.position.row, col: game.position.col, facing: game.facing, bumpKey: bumps }}
            foundMarkers={found}
          />
        </div>
        {paused && !game.completed && (
          <PauseOverlay backHref={backHref} saved={saved} onResume={() => dispatch({ type: "RESUME" })} />
        )}
      </div>

      <p
        aria-live="polite"
        data-testid="maze-status"
        className="mx-auto mt-3 min-h-7 max-w-[34rem] text-center text-lg font-bold text-ink"
      >
        {hosted && ["treasure_locked", "encounter_triggered"].includes(game.lastEvent.type)
          ? ""
          : messageFor(game.lastEvent)}
      </p>
      <p data-testid="maze-progress" className="mx-auto max-w-[34rem] text-center text-sm font-semibold text-ink-soft">
        {hosted
          ? hosted.progressText
          : saved
            ? vi.treasureMazePlay.lockedNote
            : t.found.replace("{n}", String(game.resolved.length)).replace("{total}", String(ENCOUNTERS_PER_LEVEL))}
      </p>

      {hosted ? hosted.renderTreasure(atTreasure) : null}
      {hosted && pending !== null
        ? hosted.renderEncounter({
            triggerId: pending,
            dismiss: () => dispatch({ type: "ENCOUNTER_DISMISSED", triggerId: pending }),
          })
        : null}

      {!saved && pending !== null && (
        <div
          role="group"
          aria-label={t.demoStep.title}
          className="mx-auto mt-3 max-w-[34rem] rounded-3xl border-2 border-dashed border-sun-400 bg-sun-50 p-4 text-center"
        >
          <p className="text-sm font-extrabold tracking-wide text-sun-800 uppercase">{t.demoStep.title}</p>
          <p className="mt-1 text-sm text-ink-soft">{t.demoStep.note}</p>
          <button
            type="button"
            onClick={() => dispatch({ type: "ENCOUNTER_RESOLVED", triggerId: pending, outcome: "defeated" })}
            className="mt-3 min-h-16 rounded-2xl border-2 border-sun-600 bg-sun-300 px-6 text-lg font-extrabold text-ink"
          >
            {t.demoStep.button}
          </button>
        </div>
      )}

      <div
        role="group"
        aria-label={t.moves.label}
        className="mx-auto mt-4 flex max-w-[34rem] flex-wrap items-center justify-center gap-x-8 gap-y-4"
      >
        <div className="grid grid-cols-[repeat(3,4rem)] grid-rows-[repeat(2,4rem)] gap-3" data-testid="maze-pad">
          {PAD.map(({ direction, label, Icon, cell }) => {
            const source = `pad:${direction}`;
            const stop = () => hold.release(source);
            return (
              <button
                key={direction}
                type="button"
                aria-label={label}
                disabled={locked}
                data-direction={direction}
                onPointerDown={(event) => {
                  event.preventDefault();
                  try {
                    event.currentTarget.setPointerCapture(event.pointerId);
                  } catch {
                    // Không bắt được con trỏ: window blur / pointerup vẫn thả.
                  }
                  hold.press(source, direction);
                }}
                onPointerUp={stop}
                onPointerCancel={stop}
                onLostPointerCapture={stop}
                onClick={(event) => {
                  // detail = 0: kích hoạt bằng bàn phím/trình đọc màn hình (chạm thật đã đi ở pointerdown).
                  if (event.detail === 0) {
                    hold.press(`click:${direction}`, direction);
                    hold.release(`click:${direction}`);
                  }
                }}
                onContextMenu={(event) => event.preventDefault()}
                className={cn(
                  cell,
                  "flex size-16 touch-none items-center justify-center rounded-2xl border-2 border-line-strong bg-surface text-ink shadow-press-plain select-none active:translate-y-0.5 disabled:opacity-50",
                )}
              >
                <Icon aria-hidden="true" className="size-8" />
              </button>
            );
          })}
        </div>
        <div className="flex flex-col gap-3">
          <button
            ref={pauseRef}
            type="button"
            disabled={game.completed}
            onClick={() => dispatch({ type: game.paused ? "RESUME" : "PAUSE" })}
            className="inline-flex min-h-16 items-center gap-2 rounded-2xl border-2 border-line-strong bg-surface px-5 text-base font-bold text-ink disabled:opacity-50"
          >
            {game.paused ? (
              <Play aria-hidden="true" className="size-5" />
            ) : (
              <Pause aria-hidden="true" className="size-5" />
            )}
            {game.paused ? t.resume : t.pause}
          </button>
          <button
            type="button"
            aria-pressed={overview}
            onClick={() => setOverviewChoice(!overview)}
            className="inline-flex min-h-16 items-center gap-2 rounded-2xl border-2 border-line-strong bg-surface px-5 text-base font-bold text-ink"
          >
            {overview ? (
              <Minimize2 aria-hidden="true" className="size-5" />
            ) : (
              <Maximize2 aria-hidden="true" className="size-5" />
            )}
            {overview ? t.overview.off : t.overview.on}
          </button>
          {game.completed && (
            <button
              type="button"
              onClick={onReplay}
              className="inline-flex min-h-16 items-center gap-2 rounded-2xl border-2 border-jade-600 bg-jade-50 px-5 text-base font-bold text-ink"
            >
              <RotateCcw aria-hidden="true" className="size-5" />
              {t.replay}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/** Chọn màn + chạy màn; đổi màn (hoặc chơi lại) dựng lại MazeRun nên trạng thái và bộ hẹn giờ được khởi tạo sạch. */
export function MazePlayer({ levels, names }: { levels: readonly Level[]; names: readonly string[] }) {
  const [index, setIndex] = useState(0);
  const [round, setRound] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  // Cho E2E biết handler đã gắn (nút chạm trước khi hydrate không làm gì).
  const hydrated = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
  const level = levels[index]!;
  return (
    <div ref={rootRef} data-hydrated={hydrated}>
      <div role="group" aria-label={t.levelsLabel} className="mb-4 flex flex-wrap gap-3">
        {levels.map((item, i) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={i === index}
            onClick={() => {
              setIndex(i);
              setRound(0);
            }}
            className={cn(
              "min-h-12 rounded-full border-2 px-5 text-base font-bold",
              i === index ? "border-jade-600 bg-jade-600 text-white" : "border-line bg-surface text-ink",
            )}
          >
            {t.level.replace("{n}", String(i + 1))}
            <span className="sr-only">{`: ${names[i] ?? ""}`}</span>
          </button>
        ))}
      </div>
      <MazeRun
        key={`${level.id}:${round}`}
        level={level}
        rootRef={rootRef}
        onReplay={() => setRound(round + 1)}
        backHref={"/demo" as Route}
      />
      <p className="mx-auto mt-4 max-w-[34rem] text-sm text-ink-soft">{t.help}</p>
      <div className="mt-4">
        <MotionToggle />
      </div>
    </div>
  );
}
