import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import type { MapTileKey } from "@/features/game-world/catalog";
import { artA11y, type ArtProps } from "./svg-ids";

/*
 * Ô mốc khám phá bản đồ (80×80) — cảnh nhỏ gần gũi Việt Nam: đồi hoa, ao sen, lũy tre, ruộng lúa, cầu gỗ,
 * đồi thả diều, làng đèn lồng, đài ngắm sao. Ô chưa khám phá phủ mây (FogTileArt). Bản phác thảo R02.
 */

const TILES: Readonly<Record<MapTileKey, ReactNode>> = {
  flower_meadow: (
    <>
      <rect width="80" height="80" fill="#cdf6ec" />
      <path d="M0 50q40-22 80 0v30H0z" fill="#6ddfbb" />
      <path d="M0 62q40-16 80 0v18H0z" fill="#32c69d" />
      {[
        [16, 58, "#ff8a6b"],
        [32, 52, "#ffd44d"],
        [50, 56, "#9f80fa"],
        [64, 62, "#ff8a6b"],
        [24, 70, "#fff"],
        [56, 70, "#ffd44d"],
      ].map(([x, y, color]) => (
        <g key={`${x}-${y}`}>
          <circle cx={x as number} cy={y as number} r="4.5" fill={color as string} />
          <circle cx={x as number} cy={y as number} r="1.6" fill="#c98a00" />
        </g>
      ))}
      <circle cx="62" cy="18" r="8" fill="#ffe38a" />
    </>
  ),
  lotus_pond: (
    <>
      <rect width="80" height="80" fill="#a7efd5" />
      <ellipse cx="40" cy="48" rx="34" ry="22" fill="#5aaef0" />
      <ellipse cx="40" cy="46" rx="30" ry="18" fill="#7cc6f5" />
      <ellipse cx="26" cy="52" rx="9" ry="4" fill="#12a07f" />
      <ellipse cx="54" cy="40" rx="8" ry="3.5" fill="#12a07f" />
      <g transform="translate(40 44)">
        <path d="M0 6c-8-2-10-10-6-14 2 4 4 6 6 8 2-2 4-4 6-8 4 4 2 12-6 14z" fill="#ff9fb5" />
        <path d="M0 6c-3-4-3-10 0-14 3 4 3 10 0 14z" fill="#ffc3d0" />
      </g>
    </>
  ),
  bamboo_grove: (
    <>
      <rect width="80" height="80" fill="#effcf9" />
      <path d="M0 64q40-10 80 0v16H0z" fill="#6ddfbb" />
      {[18, 30, 44, 58].map((x, index) => (
        <g key={x}>
          <rect x={x} y={14 + (index % 2) * 6} width="6" height={52 - (index % 2) * 6} rx="3" fill="#12a07f" />
          {[28, 42, 54].map((y) => (
            <rect key={y} x={x - 0.5} y={y} width="7" height="2" rx="1" fill="#0a6352" />
          ))}
        </g>
      ))}
      <g fill="#32c69d">
        <ellipse cx="14" cy="22" rx="9" ry="3.5" transform="rotate(-25 14 22)" />
        <ellipse cx="38" cy="16" rx="9" ry="3.5" transform="rotate(20 38 16)" />
        <ellipse cx="66" cy="22" rx="9" ry="3.5" transform="rotate(-20 66 22)" />
        <ellipse cx="52" cy="34" rx="8" ry="3" transform="rotate(25 52 34)" />
      </g>
    </>
  ),
  rice_field: (
    <>
      <rect width="80" height="80" fill="#fff9e6" />
      {[0, 1, 2, 3, 4].map((row) => (
        <path key={row} d={`M0 ${34 + row * 10}q40-6 80 0v8q-40-6-80 0z`} fill={row % 2 ? "#c4e86b" : "#9fd356"} />
      ))}
      {/* Nón lá */}
      <path d="M26 30l14-16 14 16z" fill="#f6e0a8" stroke="#c98a00" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M33 22h14M30 26h20" stroke="#e0b860" strokeWidth="1" />
      <circle cx="64" cy="14" r="7" fill="#ffd44d" />
    </>
  ),
  wooden_bridge: (
    <>
      <rect width="80" height="80" fill="#a7efd5" />
      <path d="M0 40q40-8 80 0v20q-40-8-80 0z" fill="#5aaef0" />
      <path d="M8 46q32-26 64 0" stroke="#8a5a34" strokeWidth="6" fill="none" strokeLinecap="round" />
      <path d="M8 46q32-26 64 0" stroke="#c58747" strokeWidth="3" strokeDasharray="3 3" fill="none" />
      <path d="M16 44v-10M40 34v-10M64 44v-10" stroke="#8a5a34" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M16 34q24-14 48 0" stroke="#8a5a34" strokeWidth="2" fill="none" />
    </>
  ),
  kite_hill: (
    <>
      <rect width="80" height="80" fill="#d9edff" />
      <path d="M0 62q30-30 80-6v24H0z" fill="#6ddfbb" />
      <path d="M50 14l10 10-10 14-10-14z" fill="#f2683f" />
      <path d="M50 14v24M40 24h20" stroke="#fff3ef" strokeWidth="1.5" />
      <path d="M50 38q-6 10-18 22" stroke="#465066" strokeWidth="1.2" fill="none" />
      <path d="M50 38q4 6 0 10q-4 4 0 8" stroke="#ffd44d" strokeWidth="2" fill="none" />
    </>
  ),
  lantern_village: (
    <>
      <rect width="80" height="80" fill="#3a2475" />
      <circle cx="62" cy="14" r="2" fill="#fff1bf" />
      <circle cx="20" cy="10" r="1.5" fill="#fff1bf" />
      <path d="M6 70V48l16-12 16 12v22zM42 70V52l14-10 14 10v18z" fill="#5932b6" />
      <path
        d="M2 50l20-16 20 16M38 54l18-14 18 14"
        stroke="#9f80fa"
        strokeWidth="3"
        fill="none"
        strokeLinejoin="round"
      />
      <path d="M8 26q32 10 64 0" stroke="#bfa9ff" strokeWidth="1.2" fill="none" />
      {[18, 40, 62].map((x) => (
        <g key={x}>
          <ellipse cx={x} cy={30 + (x === 40 ? 2 : 0)} rx="6" ry="7" fill="#f2683f" />
          <ellipse cx={x} cy={30 + (x === 40 ? 2 : 0)} rx="10" ry="11" fill="#ffd44d" opacity="0.25" />
        </g>
      ))}
      <rect x="18" y="58" width="8" height="12" fill="#ffd44d" />
      <rect x="52" y="60" width="8" height="10" fill="#ffd44d" />
    </>
  ),
  star_lookout: (
    <>
      <rect width="80" height="80" fill="#143a52" />
      {[
        [12, 14],
        [30, 8],
        [66, 20],
        [52, 10],
        [20, 34],
      ].map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="1.5" fill="#fff1bf" />
      ))}
      <path d="M58 30l3 6 6.6 1-4.8 4.6 1.2 6.6-6-3.2-6 3.2 1.2-6.6-4.8-4.6 6.6-1z" fill="#ffd44d" />
      <path d="M0 64q40-16 80 0v16H0z" fill="#0f695f" />
      <path d="M22 60l14-12" stroke="#c98a00" strokeWidth="5" strokeLinecap="round" />
      <path d="M26 66l6-10 6 10" stroke="#e6dcf7" strokeWidth="2" fill="none" />
    </>
  ),
};

/** Một ô mốc đã khám phá. */
export function MapTileArt({ tile, className, title }: ArtProps & { tile: MapTileKey }) {
  return (
    <svg viewBox="0 0 80 80" className={cn("block h-full w-full", className)} {...artA11y(title)}>
      {TILES[tile]}
    </svg>
  );
}

/** Ô mốc chưa khám phá: phủ mây mềm. */
export function FogTileArt({ className, title }: ArtProps) {
  return (
    <svg viewBox="0 0 80 80" className={cn("block h-full w-full", className)} {...artA11y(title)}>
      <rect width="80" height="80" fill="#e9e3f7" />
      <g fill="#fff" opacity="0.9">
        <ellipse cx="24" cy="50" rx="22" ry="12" />
        <ellipse cx="52" cy="44" rx="24" ry="14" />
        <ellipse cx="40" cy="30" rx="16" ry="10" />
      </g>
      <g fill="#bfa9ff" opacity="0.6">
        <circle cx="62" cy="20" r="2" />
        <circle cx="16" cy="24" r="1.6" />
      </g>
    </svg>
  );
}
