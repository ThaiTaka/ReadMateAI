import { cn } from "@/lib/cn";
import type { GameKey } from "@/features/gamification/rules";
import { artA11y, useSvgIds, type ArtProps } from "./svg-ids";

/*
 * Bản đồ thế giới phiêu lưu (R02, bản phác thảo — chờ GV duyệt). Khung 800×480. Vị trí các khu vực dùng chung
 * với lớp ghim HTML phía trên (WORLD_MAP_SPOTS, đơn vị %) để hình và nhãn luôn khớp nhau ở mọi cỡ màn hình.
 */

export type WorldSpot = GameKey | "practice_station";

/** Tọa độ % (x theo chiều ngang, y theo chiều dọc) của tâm mỗi khu vực trên bản đồ. */
export const WORLD_MAP_SPOTS: Readonly<Record<WorldSpot, { x: number; y: number }>> = {
  practice_station: { x: 50, y: 80 },
  treasure_maze: { x: 20, y: 66 },
  wonder_forest: { x: 28, y: 30 },
  rhyme_castle: { x: 74, y: 24 },
  tone_island: { x: 80, y: 71 },
};

const px = (spot: WorldSpot) => ({ x: WORLD_MAP_SPOTS[spot].x * 8, y: WORLD_MAP_SPOTS[spot].y * 4.8 });

function FogCluster({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`} fill="#f4f1fb">
      <ellipse cx="0" cy="6" rx="84" ry="40" opacity="0.92" />
      <ellipse cx="-50" cy="-10" rx="44" ry="30" opacity="0.92" />
      <ellipse cx="40" cy="-18" rx="52" ry="32" opacity="0.92" />
      <ellipse cx="10" cy="-36" rx="34" ry="22" opacity="0.85" />
      <ellipse cx="-30" cy="-30" rx="18" ry="6" fill="#fff" opacity="0.9" />
    </g>
  );
}

function Tree({ x, y, r = 14, tone = "#0b7a63" }: { x: number; y: number; r?: number; tone?: string }) {
  return (
    <g>
      <rect x={x - 2.5} y={y + r * 0.5} width="5" height={r * 0.9} rx="2" fill="#7a5230" />
      <circle cx={x} cy={y} r={r} fill={tone} />
      <circle cx={x - r / 3} cy={y - r / 3} r={r / 2.6} fill="#32c69d" opacity="0.55" />
    </g>
  );
}

/**
 * Bản đồ thế giới; `fogged` = các khu vực chưa đủ điểm (phủ mây). `animated` mặc định TẮT: hoạt cảnh bên trong một SVG
 * lớn buộc trình duyệt vẽ lại cả bản đồ mỗi khung (đo R02: WebKit 36 ms/khung) — chỉ bật khi bản đồ nhỏ, đứng riêng.
 */
export function WorldMapScene({
  className,
  title,
  fogged = [],
  animated = false,
}: ArtProps & { fogged?: readonly GameKey[]; animated?: boolean }) {
  const id = useSvgIds(["sea", "land", "grass", "roof", "wall", "glow"]);
  const station = px("practice_station");
  const maze = px("treasure_maze");
  const forest = px("wonder_forest");
  const castle = px("rhyme_castle");
  const island = px("tone_island");
  const sparkle = "M0-8 2-2 8 0 2 2 0 8-2 2-8 0-2-2z";

  return (
    <svg
      viewBox="0 0 800 480"
      preserveAspectRatio="xMidYMid slice"
      className={cn("block h-full w-full", animated ? "" : "[&_*]:animate-none!", className)}
      {...artA11y(title)}
    >
      <defs>
        <radialGradient id={id.sea} cx="50%" cy="45%" r="75%">
          <stop offset="0" stopColor="#7cc6f5" />
          <stop offset="1" stopColor="#2f8fdc" />
        </radialGradient>
        <linearGradient id={id.land} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff1d0" />
          <stop offset="1" stopColor="#f2d595" />
        </linearGradient>
        <linearGradient id={id.grass} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#a7efd5" />
          <stop offset="0.5" stopColor="#6ddfbb" />
          <stop offset="1" stopColor="#32c69d" />
        </linearGradient>
        <linearGradient id={id.roof} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#9f80fa" />
          <stop offset="1" stopColor="#5932b6" />
        </linearGradient>
        <linearGradient id={id.wall} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fffdf7" />
          <stop offset="1" stopColor="#e6dcf7" />
        </linearGradient>
        <radialGradient id={id.glow}>
          <stop offset="0" stopColor="#fff1bf" stopOpacity="0.95" />
          <stop offset="1" stopColor="#fff1bf" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Biển */}
      <rect width="800" height="480" fill={`url(#${id.sea})`} />
      <g stroke="#e6f4ff" strokeWidth="3" strokeLinecap="round" fill="none" opacity="0.6">
        <path d="M30 60q10-8 20 0t20 0" />
        <path d="M720 40q10-8 20 0t20 0" />
        <path d="M740 300q10-8 20 0t20 0" />
        <path d="M520 450q10-8 20 0t20 0" />
        <path d="M40 200q10-8 20 0t20 0" />
      </g>

      {/* Đất liền: viền cát + đồng cỏ */}
      <path
        d="M90 120c30-60 170-80 270-60 100-30 240-20 330 20 60 30 50 110 10 140-40 30-140 20-180 70-30 40 0 110-50 140-70 40-210 20-290 0-80-20-130-70-120-140 6-60 0-120 30-170z"
        fill={`url(#${id.land})`}
      />
      <path
        d="M104 126c28-52 160-70 256-52 98-28 230-18 316 20 50 26 42 96 6 124-38 28-136 20-176 66-28 36 0 102-48 128-66 36-200 18-276-2-74-18-118-62-108-126 6-56 2-112 30-158z"
        fill={`url(#${id.grass})`}
      />

      {/* Núi phía bắc */}
      <g>
        <path d="M360 150l50-90 50 90z" fill="#5fd6c0" />
        <path d="M410 60l16 28-10-4-6 8-6-8-10 4z" fill="#fff" />
        <path d="M420 156l44-76 44 76z" fill="#2ebea7" />
        <path d="M464 80l13 22-8-3-5 6-5-6-8 3z" fill="#fff" />
      </g>
      {/* Sông */}
      <path
        d="M470 150c30 20 60 30 100 50s80 20 120 24"
        stroke="#7cc6f5"
        strokeWidth="12"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M470 150c30 20 60 30 100 50s80 20 120 24"
        stroke="#d9edff"
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
        opacity="0.7"
      />

      {/* Ruộng lúa và ao sen */}
      <g transform="translate(300 250) rotate(-8)">
        {[0, 1, 2, 3].map((row) => (
          <rect key={row} x="0" y={row * 12} width="70" height="9" rx="4" fill={row % 2 ? "#c4e86b" : "#9fd356"} />
        ))}
      </g>
      <g>
        <ellipse cx="300" cy="370" rx="34" ry="16" fill="#7cc6f5" />
        <circle cx="290" cy="368" r="5" fill="#ffc3b2" />
        <circle cx="308" cy="374" r="4" fill="#ffc3b2" />
        <ellipse cx="318" cy="364" rx="6" ry="3" fill="#32c69d" />
      </g>
      {/* Lũy tre */}
      <g stroke="#0b7a63" strokeWidth="4" strokeLinecap="round">
        <path d="M96 236v-36M106 238v-44M116 236v-34" />
      </g>
      <g fill="#32c69d">
        <ellipse cx="94" cy="200" rx="8" ry="4" transform="rotate(-30 94 200)" />
        <ellipse cx="110" cy="192" rx="9" ry="4" transform="rotate(25 110 192)" />
        <ellipse cx="120" cy="202" rx="8" ry="4" transform="rotate(-20 120 202)" />
      </g>

      {/* Đường phiêu lưu (nét đứt) */}
      <path
        d={`M${station.x} ${station.y}C330 400 230 380 ${maze.x} ${maze.y}C120 280 150 220 ${forest.x} ${forest.y}C270 110 340 120 390 170C430 210 520 170 ${castle.x} ${castle.y}C650 160 610 230 560 270C540 300 590 330 ${island.x} ${island.y}`}
        stroke="#fff9e6"
        strokeWidth="9"
        strokeLinecap="round"
        fill="none"
        opacity="0.9"
      />
      <path
        d={`M${station.x} ${station.y}C330 400 230 380 ${maze.x} ${maze.y}C120 280 150 220 ${forest.x} ${forest.y}C270 110 340 120 390 170C430 210 520 170 ${castle.x} ${castle.y}C650 160 610 230 560 270C540 300 590 330 ${island.x} ${island.y}`}
        stroke="#e8a83a"
        strokeWidth="3.5"
        strokeDasharray="2 12"
        strokeLinecap="round"
        fill="none"
      />

      {/* Rừng chữ */}
      <g>
        <circle cx={forest.x} cy={forest.y} r="60" fill={`url(#${id.glow})`} className="animate-glow" />
        <Tree x={forest.x - 44} y={forest.y + 6} r={18} />
        <Tree x={forest.x + 42} y={forest.y + 10} r={17} />
        <Tree x={forest.x - 22} y={forest.y - 26} r={16} tone="#12a07f" />
        <Tree x={forest.x + 20} y={forest.y - 28} r={18} tone="#12a07f" />
        <Tree x={forest.x} y={forest.y} r={24} />
        <circle cx={forest.x - 6} cy={forest.y - 6} r="6" fill="#fff9e6" />
        <circle cx={forest.x + 10} cy={forest.y + 6} r="5" fill="#fff9e6" />
      </g>

      {/* Mê cung */}
      <g transform={`translate(${maze.x - 50} ${maze.y - 36})`}>
        <rect width="100" height="72" rx="10" fill="#f6e5bd" />
        <g fill="#0b7a63">
          <rect x="0" y="0" width="100" height="8" rx="4" />
          <rect x="0" y="0" width="8" height="72" rx="4" />
          <rect x="92" y="0" width="8" height="72" rx="4" />
          <rect x="0" y="64" width="36" height="8" rx="4" />
          <rect x="56" y="64" width="44" height="8" rx="4" />
          <rect x="22" y="20" width="40" height="7" rx="3.5" />
          <rect x="22" y="20" width="7" height="30" rx="3.5" />
          <rect x="44" y="40" width="40" height="7" rx="3.5" />
          <rect x="72" y="14" width="7" height="26" rx="3.5" />
        </g>
        <rect x="58" y="50" width="16" height="10" rx="2" fill="#c58747" />
        <rect x="64" y="50" width="4" height="10" fill="#fdc126" />
      </g>

      {/* Lâu đài */}
      <g transform={`translate(${castle.x} ${castle.y})`}>
        <ellipse cx="0" cy="44" rx="78" ry="18" fill="#2ebea7" />
        <rect x="-34" y="-6" width="68" height="46" fill={`url(#${id.wall})`} />
        <rect x="-50" y="-16" width="20" height="56" fill={`url(#${id.wall})`} />
        <rect x="30" y="-16" width="20" height="56" fill={`url(#${id.wall})`} />
        <rect x="-11" y="-34" width="22" height="40" fill={`url(#${id.wall})`} />
        <path d="M-54-16l14-28 14 28zM26-16l14-28 14 28zM-15-34l15-32 15 32z" fill={`url(#${id.roof})`} />
        <path d="M-8 40v-14a8 8 0 0 1 16 0v14z" fill="#a8682f" />
        <path d="M-44-2v-6a4 4 0 0 1 8 0v6zM36-2v-6a4 4 0 0 1 8 0v6zM-4-14v-6a4 4 0 0 1 8 0v6z" fill="#ffd44d" />
        <path d="M0-66v-12l12 5-12 5" stroke="#465066" strokeWidth="1.6" fill="#f2683f" />
      </g>

      {/* Đảo dấu thanh (tách khỏi đất liền) + cầu gỗ */}
      <g>
        <path d="M528 292l52 22" stroke="#8a5a34" strokeWidth="12" strokeLinecap="round" />
        <path d="M528 292l52 22" stroke="#c58747" strokeWidth="7" strokeDasharray="4 4" />
        <ellipse cx={island.x} cy={island.y + 8} rx="96" ry="52" fill="#f6e5bd" />
        <ellipse cx={island.x} cy={island.y} rx="80" ry="40" fill="#6ddfbb" />
        <path
          d={`M${island.x - 30} ${island.y + 4}q-6-30 6-50`}
          stroke="#8a5a34"
          strokeWidth="5"
          strokeLinecap="round"
          fill="none"
        />
        <g transform={`translate(${island.x - 24} ${island.y - 46})`} fill="#0b7a63">
          <path d="M0 0q-22-6-30 6 15-4 30-6zM0 0q22-6 30 6-15-4-30-6zM0 0q-12-16-26-12 14 2 26 12zM0 0q12-16 26-12-14 2-26 12z" />
        </g>
        {[-20, 6, 32].map((dx, index) => (
          <g key={dx} transform={`translate(${island.x + dx + 10} ${island.y + 14})`}>
            <circle r="9" fill="#fff" stroke="#1a5b96" strokeWidth="2" />
            <path
              d={["M-3 3L3-3", "M-4 1q2-4 4-1t4-1", "M0 0h.01"][index] ?? ""}
              stroke="#143a52"
              strokeWidth={index === 2 ? 4.5 : 2.2}
              strokeLinecap="round"
              fill="none"
            />
          </g>
        ))}
      </g>

      {/* Trạm luyện tập */}
      <g transform={`translate(${station.x} ${station.y})`}>
        <ellipse cx="0" cy="22" rx="44" ry="10" fill="#0b7a63" opacity="0.25" />
        <rect x="-26" y="-8" width="52" height="30" rx="4" fill="#fff9e6" />
        <path d="M-34-6l34-26 34 26z" fill="#f2683f" />
        <path d="M-34-6l34-26 34 26" stroke="#cf4e27" strokeWidth="3" fill="none" strokeLinejoin="round" />
        <rect x="-8" y="4" width="16" height="18" rx="3" fill="#2f8fdc" />
        <rect x="-20" y="0" width="8" height="8" rx="1.5" fill="#ffd44d" />
        <rect x="12" y="0" width="8" height="8" rx="1.5" fill="#ffd44d" />
        <path d="M30-30v-22" stroke="#465066" strokeWidth="2.5" />
        <path d="M30-52l16 6-16 6z" fill="#fdc126" />
      </g>

      {/* Cây rải rác */}
      <Tree x={200} y={420} r={12} />
      <Tree x={520} y={400} r={11} />
      <Tree x={660} y={250} r={10} tone="#12a07f" />
      <Tree x={150} y={110} r={11} tone="#12a07f" />
      <Tree x={330} y={90} r={10} />

      {/* La bàn */}
      <g transform="translate(64 420)">
        <circle r="26" fill="#fff9e6" stroke="#c98a00" strokeWidth="3" />
        <path d="M0-20l6 20-6 20-6-20z" fill="#f2683f" />
        <path d="M0 20l6-20h-12z" fill="#465066" />
        <circle r="3" fill="#fff9e6" />
      </g>

      {/* Mây trôi */}
      <g className="animate-drift" fill="#fff" opacity="0.85">
        <path d="M600 40c0-12 12-18 22-14 6-12 26-12 30 0 12-2 20 6 18 14z" />
        <path d="M200 30c0-10 10-14 18-11 5-10 21-10 24 0 10-2 16 5 14 11z" />
      </g>

      {/* Sương mù trên khu vực chưa đủ điểm */}
      {fogged.map((game) => {
        const spot = px(game);
        return <FogCluster key={game} x={spot.x} y={spot.y} />;
      })}

      {/* Lấp lánh */}
      <g transform={`translate(${forest.x + 50} ${forest.y - 40})`}>
        <path d={sparkle} fill="#fff1bf" className="origin-fill origin-center animate-twinkle" />
      </g>
      <g transform={`translate(${station.x - 60} ${station.y - 30})`}>
        <path d={sparkle} fill="#fff1bf" className="origin-fill origin-center animate-twinkle [animation-delay:1.5s]" />
      </g>
    </svg>
  );
}
