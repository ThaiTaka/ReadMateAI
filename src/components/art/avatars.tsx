import { cn } from "@/lib/cn";
import type { AvatarKey } from "@/features/avatars/catalog";
import { artA11y, useSvgIds, type ArtProps } from "./svg-ids";

/*
 * Bộ avatar hình người hoạt hình (R02, BẢN PHÁC THẢO — chờ GV duyệt, RQ-M1). Avatar KHÔNG mô phỏng trẻ thật:
 * chỉ là nhân vật hoạt hình chọn sẵn (CLAUDE.md §6.1). Danh mục và trạng thái: src/features/avatars/catalog.ts.
 */

type HairStyle = "buns" | "curly" | "bob" | "cap" | "side_part";

type AvatarLook = {
  background: string;
  backgroundLight: string;
  skin: string;
  hair: string;
  shirt: string;
  style: HairStyle;
  accent: string;
  glasses?: boolean;
};

const LOOKS: Readonly<Record<AvatarKey, AvatarLook>> = {
  may: {
    background: "#ffe38a",
    backgroundLight: "#fff9e6",
    skin: "#f7cfae",
    hair: "#3a2a25",
    shirt: "#5aaef0",
    style: "buns",
    accent: "#fdc126",
  },
  bong: {
    background: "#9cebd9",
    backgroundLight: "#effcf9",
    skin: "#e2ad86",
    hair: "#1f1a1a",
    shirt: "#fdc126",
    style: "curly",
    accent: "#f2683f",
  },
  na: {
    background: "#ffc3b2",
    backgroundLight: "#fff3ef",
    skin: "#f3c39d",
    hair: "#5a3726",
    shirt: "#2ebea7",
    style: "bob",
    accent: "#9f80fa",
  },
  ti: {
    background: "#b5dcff",
    backgroundLight: "#eef7ff",
    skin: "#d9a179",
    hair: "#2b2220",
    shirt: "#f2683f",
    style: "cap",
    accent: "#0d8275",
  },
  bin: {
    background: "#dacfff",
    backgroundLight: "#f6f3ff",
    skin: "#f1c09a",
    hair: "#4a3428",
    shirt: "#32c69d",
    style: "side_part",
    accent: "#143a52",
    glasses: true,
  },
};

function Hair({ look, layer }: { look: AvatarLook; layer: "back" | "front" }) {
  const { hair, accent } = look;
  switch (look.style) {
    case "buns":
      return layer === "back" ? (
        <g fill={hair}>
          <circle cx="35" cy="34" r="12" />
          <circle cx="85" cy="34" r="12" />
        </g>
      ) : (
        <g>
          <path d="M32 60c-3-22 10-34 28-34s31 12 28 34c-6-10-14-15-24-16-6 6-16 8-26 6-3 3-5 6-6 10z" fill={hair} />
          <path d="M77 36l1.8 3.6 4 .6-2.9 2.8.7 4-3.6-1.9-3.6 1.9.7-4-2.9-2.8 4-.6z" fill={accent} />
        </g>
      );
    case "curly":
      return layer === "back" ? null : (
        <g fill={hair}>
          {[
            [34, 52, 9],
            [40, 40, 10],
            [52, 32, 11],
            [66, 31, 11],
            [79, 37, 10],
            [86, 49, 9],
            [31, 62, 6],
            [89, 61, 6],
            [46, 46, 8],
            [60, 42, 9],
            [74, 45, 8],
          ].map(([cx, cy, r]) => (
            <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={r} />
          ))}
        </g>
      );
    case "bob":
      return layer === "back" ? (
        <path d="M28 70c-4-30 8-46 32-46s36 16 32 46l-2 10c-4 2-8 0-9-4V60H39v16c-1 4-5 6-9 4z" fill={hair} />
      ) : (
        <g>
          <path d="M33 56c2-16 12-24 27-24s25 8 27 24c-14-6-40-6-54 0z" fill={hair} />
          <path d="M33 50c8-14 46-14 54 0" stroke={accent} strokeWidth="5" strokeLinecap="round" fill="none" />
        </g>
      );
    case "cap":
      return layer === "back" ? null : (
        <g>
          <path d="M33 62c-2-6-2-10 0-14h54c2 4 2 8 0 14l-4-8H37z" fill={hair} />
          <path d="M32 52c0-18 12-28 28-28s28 10 28 28z" fill={accent} />
          <path d="M58 52c16-4 32-2 44 4-4 6-22 6-44 2z" fill="#0f4440" />
          <circle cx="60" cy="38" r="5" fill="#ffd44d" />
        </g>
      );
    case "side_part":
      return layer === "back" ? null : (
        <path d="M31 60c-3-22 8-35 30-35 20 0 31 12 28 34-4-10-10-16-18-18-8 6-24 8-36 6-2 4-3 8-4 13z" fill={hair} />
      );
  }
}

/** Avatar tròn (đầu + vai) theo khóa trong danh mục avatar. */
export function KidAvatar({ avatar, className, title }: ArtProps & { avatar: AvatarKey }) {
  const look = LOOKS[avatar];
  const id = useSvgIds(["clip", "bg", "skin"]);
  return (
    <svg viewBox="0 0 120 120" className={cn("h-auto w-full", className)} {...artA11y(title)}>
      <defs>
        <clipPath id={id.clip}>
          <circle cx="60" cy="60" r="60" />
        </clipPath>
        <radialGradient id={id.bg} cx="35%" cy="25%" r="80%">
          <stop offset="0" stopColor={look.backgroundLight} />
          <stop offset="1" stopColor={look.background} />
        </radialGradient>
        <radialGradient id={id.skin} cx="40%" cy="35%" r="70%">
          <stop offset="0" stopColor="#fff" stopOpacity="0.35" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <g clipPath={`url(#${id.clip})`}>
        <rect width="120" height="120" fill={`url(#${id.bg})`} />
        <circle cx="96" cy="26" r="10" fill="#fff" opacity="0.35" />
        <Hair look={look} layer="back" />
        <path d="M14 124c2-22 20-34 46-34s44 12 46 34z" fill={look.shirt} />
        <path d="M44 92q16 10 32 0" stroke="#fff" strokeWidth="4" strokeLinecap="round" opacity="0.5" fill="none" />
        <rect x="52" y="78" width="16" height="16" rx="6" fill={look.skin} />
        <circle cx="32" cy="62" r="5.5" fill={look.skin} />
        <circle cx="88" cy="62" r="5.5" fill={look.skin} />
        <circle cx="60" cy="58" r="28" fill={look.skin} />
        <circle cx="60" cy="58" r="28" fill={`url(#${id.skin})`} />
        <Hair look={look} layer="front" />
        <ellipse cx="50" cy="63" rx="3.4" ry="4.2" fill="#1d2433" />
        <ellipse cx="70" cy="63" rx="3.4" ry="4.2" fill="#1d2433" />
        <circle cx="51.4" cy="61.4" r="1.3" fill="#fff" />
        <circle cx="71.4" cy="61.4" r="1.3" fill="#fff" />
        {look.glasses ? (
          <g fill="none" stroke={look.accent} strokeWidth="2.6">
            <circle cx="50" cy="63" r="8" />
            <circle cx="70" cy="63" r="8" />
            <path d="M58 62q2-2 4 0" />
          </g>
        ) : null}
        <ellipse cx="43" cy="71" rx="5" ry="3" fill="#ff8a6b" opacity="0.4" />
        <ellipse cx="77" cy="71" rx="5" ry="3" fill="#ff8a6b" opacity="0.4" />
        <path d="M53 73q7 7 14 0" stroke="#a43c1e" strokeWidth="2.6" strokeLinecap="round" fill="none" />
      </g>
    </svg>
  );
}
