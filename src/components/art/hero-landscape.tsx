import { cn } from "@/lib/cn";
import { artA11y, useSvgIds, type ArtProps } from "./svg-ids";

/*
 * Phông cảnh "thế giới kỳ diệu" cho trang chủ (R02, bản phác thảo): bình minh, đảo bay có lâu đài, đồi xanh,
 * lối mòn dẫn về chân trời. Nhân vật được đặt chồng bằng HTML để có hoạt cảnh riêng (xem trang chủ).
 */
export function HeroLandscape({ className, title }: ArtProps) {
  const id = useSvgIds(["sky", "sun", "hillA", "hillB", "hillC", "path", "isle", "roof"]);
  const sparkle = "M0-8 2-2 8 0 2 2 0 8-2 2-8 0-2-2z";
  return (
    <svg
      viewBox="0 0 600 500"
      preserveAspectRatio="xMidYMid slice"
      className={cn("block h-full w-full", className)}
      {...artA11y(title)}
    >
      <defs>
        <linearGradient id={id.sky} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#bfa9ff" />
          <stop offset="0.45" stopColor="#ece5ff" />
          <stop offset="0.75" stopColor="#fff1bf" />
          <stop offset="1" stopColor="#fff9e6" />
        </linearGradient>
        <radialGradient id={id.sun}>
          <stop offset="0" stopColor="#fff9e6" />
          <stop offset="0.35" stopColor="#ffe38a" stopOpacity="0.9" />
          <stop offset="1" stopColor="#ffe38a" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={id.hillA} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#9cebd9" />
          <stop offset="1" stopColor="#5fd6c0" />
        </linearGradient>
        <linearGradient id={id.hillB} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#6ddfbb" />
          <stop offset="1" stopColor="#14a290" />
        </linearGradient>
        <linearGradient id={id.hillC} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#32c69d" />
          <stop offset="1" stopColor="#0b7a63" />
        </linearGradient>
        <linearGradient id={id.path} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff1bf" />
          <stop offset="1" stopColor="#f2d595" />
        </linearGradient>
        <linearGradient id={id.isle} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#c58747" />
          <stop offset="1" stopColor="#8a5326" />
        </linearGradient>
        <linearGradient id={id.roof} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#9f80fa" />
          <stop offset="1" stopColor="#5932b6" />
        </linearGradient>
      </defs>

      <rect width="600" height="500" fill={`url(#${id.sky})`} />
      <circle cx="170" cy="210" r="150" fill={`url(#${id.sun})`} className="animate-glow" />
      <circle cx="170" cy="210" r="42" fill="#fff4cc" />

      {/* Sao lấp lánh */}
      {[
        [80, 60, 0.7, 0],
        [300, 40, 0.5, 1.2],
        [520, 70, 0.6, 2.2],
        [430, 150, 0.45, 0.6],
      ].map(([x, y, s, d]) => (
        <g key={`${x}-${y}`} transform={`translate(${x} ${y}) scale(${s})`}>
          <path
            d={sparkle}
            fill="#fff9e6"
            className="origin-fill origin-center animate-twinkle"
            style={{ animationDelay: `${d}s` }}
          />
        </g>
      ))}

      {/* Mây */}
      <g className="animate-drift" fill="#fff" opacity="0.9">
        <path d="M40 120c0-16 16-24 30-18 8-16 34-16 40 0 16-2 26 8 24 18z" />
        <path d="M330 100c0-12 12-18 22-14 6-12 26-12 30 0 12-2 20 6 18 14z" />
      </g>

      {/* Đảo bay có lâu đài */}
      <g transform="translate(440 120)">
        <g className="animate-float">
          <path d="M-70 40c10 40 40 64 70 70 30-6 60-30 70-70z" fill={`url(#${id.isle})`} />
          <path d="M-40 70l10 26M20 80l-6 24" stroke="#7a4520" strokeWidth="3" strokeLinecap="round" />
          <ellipse cx="0" cy="40" rx="72" ry="14" fill="#32c69d" />
          <rect x="-24" y="-6" width="48" height="44" fill="#fffdf7" />
          <rect x="-40" y="-16" width="18" height="54" fill="#f3eefc" />
          <rect x="22" y="-16" width="18" height="54" fill="#f3eefc" />
          <rect x="-9" y="-30" width="18" height="30" fill="#fffdf7" />
          <path d="M-44-16l13-26 13 26zM18-16l13-26 13 26zM-12-30l12-28 12 28z" fill={`url(#${id.roof})`} />
          <path d="M-6 38v-12a6 6 0 0 1 12 0v12z" fill="#a8682f" />
          <path d="M-35-2v-5a3.5 3.5 0 0 1 7 0v5zM27-2v-5a3.5 3.5 0 0 1 7 0v5z" fill="#ffd44d" />
          <path d="M0-58v-12l11 5-11 5" stroke="#465066" strokeWidth="1.5" fill="#f2683f" />
          <path d="M-60 52q-8 14 0 22M58 50q8 12 2 22" stroke="#0b7a63" strokeWidth="2" fill="none" />
        </g>
      </g>

      {/* Đồi lớp xa → gần */}
      <path d="M0 330q120-70 250-30t350-40v240H0z" fill={`url(#${id.hillA})`} />
      <path d="M0 370q160-60 320-10t280-30v170H0z" fill={`url(#${id.hillB})`} />
      {/* Ruộng bậc thang */}
      <g opacity="0.85">
        <path d="M380 360q60-16 130-6" stroke="#c4e86b" strokeWidth="8" strokeLinecap="round" fill="none" />
        <path d="M370 378q70-16 150-4" stroke="#9fd356" strokeWidth="8" strokeLinecap="round" fill="none" />
        <path d="M364 396q80-14 168 0" stroke="#c4e86b" strokeWidth="8" strokeLinecap="round" fill="none" />
      </g>
      {/* Cây xa */}
      {[
        [60, 330, 18],
        [96, 322, 14],
        [560, 300, 16],
        [530, 314, 12],
      ].map(([x, y, r]) => (
        <g key={`${x}-${y}`}>
          <rect
            x={(x ?? 0) - 3}
            y={(y ?? 0) + (r ?? 0) * 0.4}
            width="6"
            height={(r ?? 0) * 1.1}
            rx="2"
            fill="#7a5230"
          />
          <circle cx={x} cy={y} r={r} fill="#0b7a63" />
          <circle
            cx={(x ?? 0) - (r ?? 0) / 3}
            cy={(y ?? 0) - (r ?? 0) / 3}
            r={(r ?? 0) / 2.5}
            fill="#5fd6c0"
            opacity="0.6"
          />
        </g>
      ))}
      <path d="M0 420q150-50 300-10t300-20v110H0z" fill={`url(#${id.hillC})`} />
      {/* Lối mòn */}
      <path d="M250 500q20-60 60-90t80-60q-30 40-46 70t-24 80z" fill={`url(#${id.path})`} />
      <g fill="#e8cf96">
        <ellipse cx="300" cy="470" rx="10" ry="3.5" />
        <ellipse cx="330" cy="430" rx="8" ry="3" />
        <ellipse cx="360" cy="392" rx="6" ry="2.4" />
      </g>
      {/* Hoa phía trước */}
      {[
        [40, 470, "#ff8a6b"],
        [70, 482, "#ffd44d"],
        [520, 470, "#9f80fa"],
        [560, 482, "#ff8a6b"],
        [120, 488, "#fff"],
      ].map(([x, y, color]) => (
        <g key={`${x}-${y}`}>
          <circle cx={x as number} cy={y as number} r="6" fill={color as string} />
          <circle cx={x as number} cy={y as number} r="2" fill="#c98a00" />
        </g>
      ))}
    </svg>
  );
}
