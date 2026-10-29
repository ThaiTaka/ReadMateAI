import { cn } from "@/lib/cn";
import { artA11y, useSvgIds, type ArtProps } from "./svg-ids";

/*
 * Biểu tượng phần thưởng gốc (R02, bản phác thảo — chờ GV duyệt). Không phần thưởng may rủi: rương kho báu
 * chỉ là hình minh họa đích đến của Mê cung, không "mở hộp quà ngẫu nhiên" (GAME_DESIGN §2, §8).
 */

/** Rương kho báu mở hé, ánh vàng tỏa nhẹ. */
export function TreasureChest({ className, title }: ArtProps) {
  const id = useSvgIds(["glow", "wood", "lid", "gold"]);
  const sparkle = "M0-7 1.7-1.7 7 0 1.7 1.7 0 7-1.7 1.7-7 0-1.7-1.7z";
  return (
    <svg viewBox="0 0 140 120" className={cn("h-auto w-full", className)} {...artA11y(title)}>
      <defs>
        <radialGradient id={id.glow}>
          <stop offset="0" stopColor="#ffe38a" stopOpacity="0.95" />
          <stop offset="1" stopColor="#ffe38a" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={id.wood} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#c58747" />
          <stop offset="1" stopColor="#8a5326" />
        </linearGradient>
        <linearGradient id={id.lid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#d99a58" />
          <stop offset="1" stopColor="#a8682f" />
        </linearGradient>
        <linearGradient id={id.gold} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffe38a" />
          <stop offset="1" stopColor="#f2a900" />
        </linearGradient>
      </defs>
      <ellipse cx="70" cy="62" rx="62" ry="44" fill={`url(#${id.glow})`} className="animate-glow" />
      <ellipse cx="70" cy="112" rx="50" ry="6" fill="#0d283b" opacity="0.16" />
      {/* Nắp mở */}
      <path d="M22 54c0-22 20-34 48-34s48 12 48 34z" fill={`url(#${id.lid})`} />
      <path d="M30 46c4-12 18-20 40-20" stroke="#f1c58a" strokeWidth="4" strokeLinecap="round" fill="none" />
      <rect x="62" y="20" width="16" height="34" fill={`url(#${id.gold})`} />
      {/* Lòng rương + vàng, đá quý */}
      <path d="M24 56h92l-4 8H28z" fill="#5a3416" />
      <g>
        <circle cx="46" cy="56" r="8" fill={`url(#${id.gold})`} stroke="#c98a00" strokeWidth="1.5" />
        <circle cx="60" cy="52" r="8" fill={`url(#${id.gold})`} stroke="#c98a00" strokeWidth="1.5" />
        <circle cx="80" cy="53" r="8" fill={`url(#${id.gold})`} stroke="#c98a00" strokeWidth="1.5" />
        <circle cx="94" cy="57" r="8" fill={`url(#${id.gold})`} stroke="#c98a00" strokeWidth="1.5" />
        <path d="M68 40l8 8-8 10-8-10z" fill="#2ebea7" stroke="#0f695f" strokeWidth="1.5" />
        <path d="M86 44l6 6-6 7-6-7z" fill="#9f80fa" stroke="#5932b6" strokeWidth="1.5" />
        <path d="M44 46l5 5-5 6-5-6z" fill="#ff8a6b" stroke="#a43c1e" strokeWidth="1.5" />
      </g>
      {/* Thân rương */}
      <rect x="20" y="60" width="100" height="48" rx="8" fill={`url(#${id.wood})`} />
      <path d="M22 76h96M22 92h96" stroke="#7a4520" strokeWidth="2" opacity="0.5" />
      <rect x="32" y="60" width="9" height="48" fill={`url(#${id.gold})`} />
      <rect x="99" y="60" width="9" height="48" fill={`url(#${id.gold})`} />
      <rect x="58" y="66" width="24" height="26" rx="5" fill={`url(#${id.gold})`} stroke="#c98a00" strokeWidth="2" />
      <circle cx="70" cy="76" r="3.5" fill="#5a3416" />
      <path d="M70 78v7" stroke="#5a3416" strokeWidth="3" strokeLinecap="round" />
      <g transform="translate(22 28)">
        <path d={sparkle} fill="#fff1bf" className="origin-fill origin-center animate-twinkle" />
      </g>
      <g transform="translate(118 30)">
        <path d={sparkle} fill="#fff1bf" className="origin-fill origin-center animate-twinkle [animation-delay:1.4s]" />
      </g>
    </svg>
  );
}

/** Bục vinh danh ba bậc (TOP 3) — dùng để giới thiệu tính năng vinh danh (dự kiến R06). */
export function HonorPodium({ className, title }: ArtProps) {
  const id = useSvgIds(["first", "second", "third"]);
  return (
    <svg viewBox="0 0 240 170" className={cn("h-auto w-full", className)} {...artA11y(title)}>
      <defs>
        <linearGradient id={id.first} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffe38a" />
          <stop offset="1" stopColor="#f2a900" />
        </linearGradient>
        <linearGradient id={id.second} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#9cebd9" />
          <stop offset="1" stopColor="#14a290" />
        </linearGradient>
        <linearGradient id={id.third} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#dacfff" />
          <stop offset="1" stopColor="#8458f2" />
        </linearGradient>
      </defs>
      <ellipse cx="120" cy="162" rx="104" ry="7" fill="#0d283b" opacity="0.12" />
      {/* Bậc 2 — trái */}
      <rect x="22" y="92" width="64" height="68" rx="10" fill={`url(#${id.second})`} />
      <rect x="22" y="92" width="64" height="12" rx="6" fill="#cdf6ec" opacity="0.7" />
      <text x="54" y="140" textAnchor="middle" fontSize="30" fontWeight="800" fill="#0f4440">
        2
      </text>
      {/* Bậc 1 — giữa */}
      <rect x="88" y="62" width="64" height="98" rx="10" fill={`url(#${id.first})`} />
      <rect x="88" y="62" width="64" height="12" rx="6" fill="#fff9e6" opacity="0.8" />
      <text x="120" y="122" textAnchor="middle" fontSize="36" fontWeight="800" fill="#6e4a00">
        1
      </text>
      {/* Bậc 3 — phải */}
      <rect x="154" y="110" width="64" height="50" rx="10" fill={`url(#${id.third})`} />
      <rect x="154" y="110" width="64" height="12" rx="6" fill="#f6f3ff" opacity="0.7" />
      <text x="186" y="148" textAnchor="middle" fontSize="28" fontWeight="800" fill="#3a2475">
        3
      </text>
      {/* Vương miện và sao */}
      <path d="M100 48l6-22 14 14 14-14 6 22z" fill="#fdc126" stroke="#c98a00" strokeWidth="2" strokeLinejoin="round" />
      <circle cx="120" cy="40" r="3.5" fill="#ff8a6b" />
      <path d="M54 66l3 6 6.6 1-4.8 4.6 1.2 6.6-6-3.2-6 3.2 1.2-6.6-4.8-4.6 6.6-1z" fill="#2ebea7" />
      <path d="M186 84l3 6 6.6 1-4.8 4.6 1.2 6.6-6-3.2-6 3.2 1.2-6.6-4.8-4.6 6.6-1z" fill="#9f80fa" />
      <g fill="#ff8a6b">
        <rect x="36" y="30" width="6" height="10" rx="2" transform="rotate(20 39 35)" />
        <rect x="196" y="44" width="6" height="10" rx="2" transform="rotate(-25 199 49)" />
      </g>
      <g fill="#5aaef0">
        <rect x="70" y="20" width="6" height="10" rx="2" transform="rotate(-30 73 25)" />
        <rect x="166" y="22" width="6" height="10" rx="2" transform="rotate(35 169 27)" />
      </g>
    </svg>
  );
}
