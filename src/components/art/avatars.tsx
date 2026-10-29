import { cn } from "@/lib/cn";
import type { AvatarKey } from "@/features/avatars/catalog";
import { artA11y, useSvgIds, type ArtProps } from "./svg-ids";

/*
 * Bộ avatar hình người hoạt hình (R02, BẢN PHÁC THẢO — chờ GV duyệt, RQ-M1). Avatar KHÔNG mô phỏng trẻ thật:
 * chỉ là nhân vật hoạt hình chọn sẵn (CLAUDE.md §6.1). Danh mục và trạng thái: src/features/avatars/catalog.ts.
 */

type HairStyle =
  | "buns"
  | "curly"
  | "bob"
  | "cap"
  | "side_part"
  | "spiky"
  | "ponytail"
  | "puffs"
  | "long"
  | "bowl"
  | "topknot"
  | "braids"
  | "beanie";

type AvatarLook = {
  background: string;
  backgroundLight: string;
  skin: string;
  hair: string;
  shirt: string;
  style: HairStyle;
  accent: string;
  glasses?: "round" | "square";
  freckles?: boolean;
  headband?: boolean;
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
    glasses: "round",
  },
  sao: {
    background: "#ffd2a8",
    backgroundLight: "#fff3e6",
    skin: "#d9a179",
    hair: "#2b2220",
    shirt: "#e8553a",
    style: "spiky",
    accent: "#fdc126",
    freckles: true,
  },
  nang: {
    background: "#ffd1e0",
    backgroundLight: "#fff0f5",
    skin: "#f7cfae",
    hair: "#6b3b22",
    shirt: "#ff8fb1",
    style: "ponytail",
    accent: "#fdc126",
  },
  bien: {
    background: "#a8e0f5",
    backgroundLight: "#eefaff",
    skin: "#c98f66",
    hair: "#1f1a1a",
    shirt: "#2f86d6",
    style: "puffs",
    accent: "#fdc126",
  },
  gio: {
    background: "#e1d4ff",
    backgroundLight: "#f6f1ff",
    skin: "#f9d9bd",
    hair: "#3a2a25",
    shirt: "#a98bf0",
    style: "long",
    accent: "#ff8fb1",
  },
  lua: {
    background: "#fdeaa0",
    backgroundLight: "#fff9e0",
    skin: "#f1c09a",
    hair: "#1f1a1a",
    shirt: "#f6c026",
    style: "bowl",
    accent: "#0d8275",
  },
  tre: {
    background: "#c2f0cf",
    backgroundLight: "#effcf3",
    skin: "#a8704c",
    hair: "#1f1a1a",
    shirt: "#3aa86b",
    style: "topknot",
    accent: "#f2683f",
  },
  xoai: {
    background: "#ffd9b0",
    backgroundLight: "#fff4e6",
    skin: "#8d5a3b",
    hair: "#1a1414",
    shirt: "#f58d2f",
    style: "braids",
    accent: "#9f80fa",
  },
  sen: {
    background: "#ffc9dc",
    backgroundLight: "#fff0f6",
    skin: "#f3c39d",
    hair: "#5a3726",
    shirt: "#f7b6d0",
    style: "beanie",
    accent: "#ff6f9f",
  },
  cam: {
    background: "#ffe0c7",
    backgroundLight: "#fff6ee",
    skin: "#e2ad86",
    hair: "#3a2a25",
    shirt: "#d9722e",
    style: "side_part",
    accent: "#143a52",
    glasses: "square",
  },
  dua: {
    background: "#bfe8d6",
    backgroundLight: "#effbf6",
    skin: "#f1c09a",
    hair: "#2b2220",
    shirt: "#34b6a0",
    style: "cap",
    accent: "#e04a3f",
  },
  oi: {
    background: "#d9f2b8",
    backgroundLight: "#f6fde8",
    skin: "#c98f66",
    hair: "#2a1d18",
    shirt: "#6cc24a",
    style: "curly",
    accent: "#f58d2f",
    headband: true,
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
    case "spiky":
      return layer === "back" ? null : (
        <path d="M31 58l2-16 8 6 4-18 9 14 6-20 6 20 9-14 4 18 8-6 2 16c-9-10-21-14-29-14s-20 4-29 14z" fill={hair} />
      );
    case "ponytail":
      return layer === "back" ? (
        <path d="M82 40c22 2 26 28 12 44 2-16-2-26-12-32z" fill={hair} />
      ) : (
        <g>
          <path d="M31 60c-3-22 8-35 29-35s32 13 29 35c-5-10-12-15-20-17-9 5-25 7-36 4-1 4-2 9-2 13z" fill={hair} />
          <circle cx="84" cy="44" r="5" fill={accent} />
        </g>
      );
    case "puffs":
      return layer === "back" ? (
        <g fill={hair}>
          <circle cx="34" cy="30" r="13" />
          <circle cx="86" cy="30" r="13" />
        </g>
      ) : (
        <g>
          <path d="M32 58c-2-18 10-30 28-30s30 12 28 30c-10-8-20-12-28-12s-18 4-28 12z" fill={hair} />
          <circle cx="36" cy="40" r="3.5" fill={accent} />
          <circle cx="84" cy="40" r="3.5" fill={accent} />
        </g>
      );
    case "long":
      return layer === "back" ? (
        <path d="M27 72c-6-34 6-50 33-50s39 16 33 50l-3 22c-5 2-9-1-10-6V62H40v26c-1 5-5 8-10 6z" fill={hair} />
      ) : (
        <g>
          <path d="M33 58c2-16 13-25 27-25s25 9 27 25c-10-5-20-10-27-10s-17 5-27 10z" fill={hair} />
          <path d="M44 38l2 4 4 .6-3 2.8.7 4-3.7-2-3.7 2 .7-4-3-2.8 4-.6z" fill={accent} />
        </g>
      );
    case "bowl":
      return layer === "back" ? null : (
        <path d="M30 64c-4-26 8-39 30-39s34 13 30 39h-5c0-6-1-11-3-14-11 3-35 3-46 0-2 3-3 8-3 14z" fill={hair} />
      );
    case "topknot":
      return layer === "back" ? (
        <circle cx="60" cy="22" r="10" fill={hair} />
      ) : (
        <g>
          <path d="M32 58c-1-18 10-30 28-30s29 12 28 30c-8-8-18-11-28-11s-20 3-28 11z" fill={hair} />
          <rect x="52" y="27" width="16" height="4" rx="2" fill={accent} />
        </g>
      );
    case "braids":
      return layer === "back" ? (
        <g fill={hair}>
          <ellipse cx="29" cy="86" rx="6" ry="15" />
          <ellipse cx="91" cy="86" rx="6" ry="15" />
          <circle cx="29" cy="98" r="3.4" fill={accent} />
          <circle cx="91" cy="98" r="3.4" fill={accent} />
        </g>
      ) : (
        <path d="M32 60c-2-20 9-33 28-33s30 13 28 33c-6-9-16-13-28-13s-22 4-28 13z" fill={hair} />
      );
    case "beanie":
      return layer === "back" ? null : (
        <g>
          <path d="M31 54c0-18 12-30 29-30s29 12 29 30z" fill={accent} />
          <rect x="29" y="48" width="62" height="10" rx="5" fill={hair} />
          <circle cx="60" cy="22" r="6.5" fill="#fff" />
        </g>
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
        {look.headband ? (
          <path d="M32 53c10-8 46-8 56 0" stroke={look.accent} strokeWidth="5" strokeLinecap="round" fill="none" />
        ) : null}
        {look.glasses === "round" ? (
          <g fill="none" stroke={look.accent} strokeWidth="2.6">
            <circle cx="50" cy="63" r="8" />
            <circle cx="70" cy="63" r="8" />
            <path d="M58 62q2-2 4 0" />
          </g>
        ) : null}
        {look.glasses === "square" ? (
          <g fill="none" stroke={look.accent} strokeWidth="2.6" strokeLinejoin="round">
            <rect x="41" y="55" width="16" height="15" rx="4" />
            <rect x="63" y="55" width="16" height="15" rx="4" />
            <path d="M57 61h6" />
          </g>
        ) : null}
        {look.freckles ? (
          <g fill="#a85a3a" opacity="0.55">
            <circle cx="42" cy="69" r="1.2" />
            <circle cx="46" cy="72" r="1.2" />
            <circle cx="49" cy="69" r="1.2" />
            <circle cx="71" cy="69" r="1.2" />
            <circle cx="74" cy="72" r="1.2" />
            <circle cx="78" cy="69" r="1.2" />
          </g>
        ) : null}
        <ellipse cx="43" cy="71" rx="5" ry="3" fill="#ff8a6b" opacity="0.4" />
        <ellipse cx="77" cy="71" rx="5" ry="3" fill="#ff8a6b" opacity="0.4" />
        <path d="M53 73q7 7 14 0" stroke="#a43c1e" strokeWidth="2.6" strokeLinecap="round" fill="none" />
      </g>
    </svg>
  );
}
