"use client";

import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Maximize2, Minimize2, Pause, Play, RotateCcw } from "lucide-react";
import { useEffect, useMemo, useReducer, useRef, useState, useSyncExternalStore, type RefObject } from "react";
import { MotionToggle } from "@/components/adventure/motion";
import { MazeBoard } from "@/components/art/maze-board";
import { cn } from "@/lib/cn";
import { vi } from "@/strings/vi";
import {
  ENCOUNTERS_PER_LEVEL,
  createInitialState,
  gameReducer,
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
 * Chạm trán TẮT ở chế độ này: chưa có `game_encounters` (R08), nên client không tự đánh dấu thử thách nào đã xong và
 * rương luôn khóa. Lưu vị trí KHÔNG xác thực thử thách — R08 phải chặn việc đi qua điểm kích hoạt chưa giải quyết ở máy chủ.
 */
export type SavedBinding = { readonly initial: Position; readonly saver: PositionSaver };

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

export function MazeRun({
  level,
  rootRef,
  onReplay,
  saved,
}: {
  level: Level;
  rootRef: RefObject<HTMLDivElement | null>;
  onReplay: () => void;
  saved?: SavedBinding;
}) {
  const parsed: ParsedLevel = useMemo(
    () => (saved ? { ...parseLevel(level), triggers: [] } : parseLevel(level)),
    [level, saved],
  );
  const reducer = useMemo(
    () =>
      (state: PlayState, action: GameAction): PlayState => {
        const game = gameReducer(parsed, state.game, action);
        const stepped = saved && game.moves > state.game.moves;
        return {
          game,
          bumps: game.lastEvent.type === "blocked" ? state.bumps + 1 : state.bumps,
          trail: stepped ? [...state.trail, game.position] : state.trail,
        };
      },
    [parsed, saved],
  );
  const [{ game, bumps, trail }, dispatch] = useReducer(reducer, parsed, (p): PlayState => {
    const initial = createInitialState(p);
    return { game: saved ? { ...initial, position: saved.initial } : initial, bumps: 0, trail: [] };
  });
  const hold = useHoldMove((direction) => dispatch({ type: "MOVE", direction }));

  const forwarded = useRef(0);
  useEffect(() => {
    if (!saved) return;
    while (forwarded.current < trail.length) saved.saver.push(trail[forwarded.current++]!);
  }, [trail, saved]);
  const paused = game.paused;
  useEffect(() => {
    if (saved && paused) saved.saver.flush();
  }, [paused, saved]);

  useEffect(() => {
    if (STOPPING.has(game.lastEvent.type)) hold.releaseAll();
  }, [game.lastEvent, hold]);

  useEffect(() => {
    // Phím chỉ bị bỏ qua khi tiêu điểm đang ở một điều khiển tương tác NGOÀI khu vực game (liên kết, nút, ô nhập...);
    // vùng nền như <main> (Next đưa tiêu điểm về đó sau khi bấm nút) vẫn nhận phím.
    const inGameArea = (target: EventTarget | null) =>
      !(target instanceof Element) || !!rootRef.current?.contains(target) || target.closest(INTERACTIVE) === null;
    const down = (event: KeyboardEvent) => {
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
  }, [hold, rootRef]);

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
  const found = revealedTriggers(parsed, game);
  const locked = game.paused || game.pendingEncounter !== null || game.completed;
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
      </div>

      <p
        aria-live="polite"
        data-testid="maze-status"
        className="mx-auto mt-3 min-h-7 max-w-[34rem] text-center text-lg font-bold text-ink"
      >
        {messageFor(game.lastEvent)}
      </p>
      <p className="mx-auto max-w-[34rem] text-center text-sm font-semibold text-ink-soft">
        {saved
          ? vi.treasureMazePlay.lockedNote
          : t.found.replace("{n}", String(game.resolved.length)).replace("{total}", String(ENCOUNTERS_PER_LEVEL))}
      </p>

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
      <MazeRun key={`${level.id}:${round}`} level={level} rootRef={rootRef} onReplay={() => setRound(round + 1)} />
      <p className="mx-auto mt-4 max-w-[34rem] text-sm text-ink-soft">{t.help}</p>
      <div className="mt-4">
        <MotionToggle />
      </div>
    </div>
  );
}
