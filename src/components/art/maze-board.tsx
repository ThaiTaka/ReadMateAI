import { cn } from "@/lib/cn";
import { parseDemoMaze, type MazeCell } from "@/features/demo/treasure-maze-data";
import { HeroKid } from "./characters";
import { TreasureChest } from "./treasure";
import { artA11y, useSvgIds, type ArtProps } from "./svg-ids";

/*
 * Bản đồ Mê cung kho báu 2D (R07.1, bản phác thảo — chờ GV duyệt): lưới ô vẽ bằng SVG, nhân vật và rương là
 * lớp HTML đặt theo phần trăm ô (để R07.2 nội suy vị trí bằng `transform`). Hoạt cảnh dùng lớp có sẵn
 * (`animate-*`) nên dừng theo giảm chuyển động. Chỉ vẽ — chưa có điều khiển, điểm hay trạng thái.
 */

const CELL = 40;

/** Số xác định theo tọa độ (không Math.random) để cây/đá/hoa đặt cố định giữa các lần render. */
const pick = (row: number, col: number, salt: number) => (row * 7 + col * 13 + salt * 5) % 11;

function Hedge({ x, y, shade }: { x: number; y: number; shade: number }) {
  return (
    <g>
      <rect x={x + 1} y={y + 5} width={CELL - 2} height={CELL - 4} rx="11" fill="#2f8f58" />
      <rect x={x + 1} y={y + 1} width={CELL - 2} height={CELL - 6} rx="11" fill={shade % 2 ? "#4fc276" : "#45b96d"} />
      <ellipse cx={x + 13} cy={y + 12} rx="8" ry="4.5" fill="#8fe3a6" opacity="0.7" />
      {shade % 3 === 0 && (
        <>
          <circle cx={x + 27} cy={y + 24} r="2.6" fill="#fff1bf" />
          <circle cx={x + 22} cy={y + 29} r="2.2" fill="#ff8a6b" />
        </>
      )}
    </g>
  );
}

function Tree({ x, y, delay }: { x: number; y: number; delay: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <ellipse cx="20" cy="36" rx="12" ry="3.5" fill="#0d283b" opacity="0.16" />
      <rect x="17" y="22" width="6" height="14" rx="2" fill="#8a5326" />
      <g className="origin-fill origin-bottom animate-sway" style={{ animationDelay: `${delay}s` }}>
        <circle cx="20" cy="16" r="14" fill="#2f8f58" />
        <circle cx="16" cy="12" r="9" fill="#4fc276" />
        <circle cx="25" cy="19" r="4" fill="#ff8a6b" opacity="0.9" />
      </g>
    </g>
  );
}

function Rock({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <ellipse cx="20" cy="33" rx="13" ry="3.5" fill="#0d283b" opacity="0.16" />
      <path d="M7 32c0-9 5-17 13-17s13 8 13 17z" fill="#a9b2c0" />
      <path d="M12 26c1-5 4-8 8-9" stroke="#e1e6ee" strokeWidth="3" strokeLinecap="round" fill="none" />
    </g>
  );
}

const FLOWER_SPOTS = [
  [11, 26, "#ff8a6b"],
  [20, 20, "#ffd44d"],
  [29, 27, "#9f80fa"],
  [20, 30, "#ffffff"],
] as const;

function Flowers({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <ellipse cx="20" cy="33" rx="13" ry="3.5" fill="#0d283b" opacity="0.14" />
      {FLOWER_SPOTS.map(([cx, cy, fill]) => (
        <g key={`${cx}-${cy}`}>
          <path d={`M${cx} ${cy}v8`} stroke="#2f8f58" strokeWidth="2" />
          <circle cx={cx} cy={cy} r="4.5" fill={fill} />
          <circle cx={cx} cy={cy} r="1.6" fill="#c98a00" />
        </g>
      ))}
    </g>
  );
}

function PathTile({ cell }: { cell: MazeCell }) {
  const x = cell.col * CELL;
  const y = cell.row * CELL;
  const n = pick(cell.row, cell.col, 1);
  return (
    <g>
      <rect x={x} y={y} width={CELL} height={CELL} fill={(cell.row + cell.col) % 2 ? "#f7e2ad" : "#f4d99a"} />
      {n % 3 === 0 && <ellipse cx={x + 12 + (n % 5) * 3} cy={y + 14} rx="3.5" ry="2.4" fill="#e2c07a" />}
      {n % 4 === 1 && <ellipse cx={x + 28} cy={y + 29} rx="3" ry="2" fill="#e2c07a" />}
    </g>
  );
}

function BorderDecor({ cell }: { cell: MazeCell }) {
  const x = cell.col * CELL;
  const y = cell.row * CELL;
  const n = pick(cell.row, cell.col, 2);
  if (n % 4 === 0) return <Tree x={x} y={y} delay={(n % 5) * 0.7} />;
  if (n % 4 === 1) return <Rock x={x} y={y} />;
  if (n % 4 === 2) return <Flowers x={x} y={y} />;
  return <Hedge x={x} y={y} shade={n} />;
}

export function MazeBoard({ rows, className, title }: ArtProps & { rows?: readonly string[] }) {
  const grid = parseDemoMaze(rows);
  const size = grid.length;
  const id = useSvgIds(["grass", "vignette"]);
  const last = size - 1;
  const cells = grid.flat();
  const percent = (n: number) => `${(n / size) * 100}%`;
  const start = cells.find((cell) => cell.kind === "start");
  const treasure = cells.find((cell) => cell.kind === "treasure");
  const side = size * CELL;

  return (
    <div
      role={title ? "group" : undefined}
      aria-label={title}
      className={cn("relative aspect-square w-full overflow-hidden rounded-[2rem] shadow-world", className)}
    >
      <svg viewBox={`0 0 ${side} ${side}`} className="absolute inset-0 size-full" {...artA11y(undefined)}>
        <defs>
          <linearGradient id={id.grass} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#c9f3b0" />
            <stop offset="1" stopColor="#9fe38c" />
          </linearGradient>
          <radialGradient id={id.vignette} cx="0.5" cy="0.5" r="0.75">
            <stop offset="0.65" stopColor="#0d283b" stopOpacity="0" />
            <stop offset="1" stopColor="#0d283b" stopOpacity="0.2" />
          </radialGradient>
        </defs>
        <rect width={side} height={side} fill={`url(#${id.grass})`} />
        {cells.map((cell) => (cell.kind === "wall" ? null : <PathTile key={`p${cell.row}-${cell.col}`} cell={cell} />))}
        {cells.map((cell) => {
          if (cell.kind !== "wall") return null;
          const border = cell.row === 0 || cell.col === 0 || cell.row === last || cell.col === last;
          return border ? (
            <BorderDecor key={`w${cell.row}-${cell.col}`} cell={cell} />
          ) : (
            <Hedge
              key={`w${cell.row}-${cell.col}`}
              x={cell.col * CELL}
              y={cell.row * CELL}
              shade={pick(cell.row, cell.col, 3)}
            />
          );
        })}
        {/* Bóng bụi cây đổ xuống đường đi phía dưới */}
        {cells.map((cell) =>
          cell.kind !== "wall" && grid[cell.row - 1]?.[cell.col]?.kind === "wall" ? (
            <rect
              key={`s${cell.row}-${cell.col}`}
              x={cell.col * CELL}
              y={cell.row * CELL}
              width={CELL}
              height="6"
              fill="#b88a3c"
              opacity="0.22"
            />
          ) : null,
        )}
        <rect width={side} height={side} fill={`url(#${id.vignette})`} />
      </svg>
      {treasure && (
        <div
          className="pointer-events-none absolute"
          style={{ left: percent(treasure.col - 0.1), top: percent(treasure.row - 0.15), width: percent(1.2) }}
        >
          <TreasureChest title="Rương kho báu" />
        </div>
      )}
      {start && (
        <div
          className="pointer-events-none absolute"
          style={{ left: percent(start.col - 0.1), top: percent(start.row - 0.5), width: percent(1.2) }}
        >
          <div className="animate-bob">
            <HeroKid title="Bạn nhỏ thám hiểm" />
          </div>
        </div>
      )}
    </div>
  );
}
