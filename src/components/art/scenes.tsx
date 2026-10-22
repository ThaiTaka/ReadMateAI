import type { ComponentType, ReactNode } from "react";
import { cn } from "@/lib/cn";
import type { GameKey } from "@/features/gamification/rules";
import { artA11y, useSvgIds, type ArtProps } from "./svg-ids";

/*
 * Bốn cảnh minh họa cho bốn mini-game của Game World (R02, bản phác thảo — chờ GV duyệt).
 * Tự vẽ bằng mã SVG; bối cảnh gần gũi (hàng rào cây, rừng, biển đảo, lâu đài cổ tích). Khung 320×200,
 * `preserveAspectRatio="xMidYMid slice"` để phủ kín khung ảnh của thẻ ở mọi tỉ lệ.
 */

const SPARKLE = "M0-6 1.5-1.5 6 0 1.5 1.5 0 6-1.5 1.5-6 0-1.5-1.5z";

type SceneProps = ArtProps & {
  /** Phủ sương mù: khu vực chưa đủ điểm (luôn kèm biểu tượng ổ khóa và chữ ở thẻ). */
  dimmed?: boolean;
  /**
   * Bật hoạt cảnh (mây trôi, lấp lánh…). Mặc định TẮT: một trang có thể hiện 4–8 cảnh cùng lúc; hoạt cảnh SVG
   * liên tục làm WebKit/Android vẽ lại toàn khung (đo ở E2E R02) — chỉ bật cho cảnh lớn đứng một mình.
   */
  animated?: boolean;
};

function Sparkle({
  x,
  y,
  scale = 1,
  color = "#fff1bf",
  delay = 0,
}: {
  x: number;
  y: number;
  scale?: number;
  color?: string;
  delay?: number;
}) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <path
        d={SPARKLE}
        fill={color}
        className="origin-fill origin-center animate-twinkle"
        style={delay ? { animationDelay: `${delay}s` } : undefined}
      />
    </g>
  );
}

function Cloud({ x, y, scale = 1, opacity = 0.9 }: { x: number; y: number; scale?: number; opacity?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`} opacity={opacity}>
      <path d="M0 14c0-8 7-12 13-10 3-7 15-8 19 0 7-2 13 3 12 10z" fill="#fff" />
    </g>
  );
}

function Fog({ id }: { id: string }) {
  return (
    <g>
      <rect width="320" height="200" fill={`url(#${id})`} />
      <g fill="#f4f1fb" opacity="0.9">
        <ellipse cx="60" cy="150" rx="70" ry="26" />
        <ellipse cx="170" cy="168" rx="90" ry="28" />
        <ellipse cx="280" cy="140" rx="60" ry="24" />
        <ellipse cx="120" cy="60" rx="64" ry="18" opacity="0.7" />
        <ellipse cx="250" cy="70" rx="56" ry="16" opacity="0.7" />
      </g>
    </g>
  );
}

function SceneFrame({
  className,
  title,
  dimmed,
  animated = false,
  children,
  fogId,
}: SceneProps & { children: ReactNode; fogId: string }) {
  return (
    <svg
      viewBox="0 0 320 200"
      preserveAspectRatio="xMidYMid slice"
      className={cn("block h-full w-full", animated ? "" : "[&_*]:animate-none!", className)}
      {...artA11y(title)}
    >
      <defs>
        <linearGradient id={fogId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#e9e3f7" stopOpacity="0.55" />
          <stop offset="1" stopColor="#d8d0ee" stopOpacity="0.8" />
        </linearGradient>
      </defs>
      <g>{children}</g>
      {dimmed ? <Fog id={fogId} /> : null}
    </svg>
  );
}

/** Mê cung kho báu: mê cung hàng rào cây nhìn từ trên cao, rương kho báu ở giữa. */
export function MazeScene(props: SceneProps) {
  const id = useSvgIds(["sky", "grass", "fog"]);
  // [x, y, w, h] của mặt trên các bức tường cây; mặt trước (tối hơn) vẽ thêm bên dưới để có chiều sâu.
  const walls: Array<[number, number, number, number]> = [
    [40, 70, 240, 10],
    [40, 70, 10, 118],
    [270, 70, 10, 118],
    [40, 178, 46, 10],
    [118, 178, 162, 10],
    [70, 100, 74, 10],
    [70, 100, 10, 52],
    [100, 132, 64, 10],
    [174, 70, 10, 48],
    [204, 100, 46, 10],
    [204, 100, 10, 50],
    [154, 132, 10, 30],
    [236, 132, 10, 46],
    [100, 152, 10, 26],
  ];
  return (
    <SceneFrame {...props} fogId={id.fog}>
      <defs>
        <linearGradient id={id.sky} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#b5dcff" />
          <stop offset="1" stopColor="#effcf9" />
        </linearGradient>
        <linearGradient id={id.grass} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#6ddfbb" />
          <stop offset="1" stopColor="#12a07f" />
        </linearGradient>
      </defs>
      <rect width="320" height="200" fill={`url(#${id.sky})`} />
      <circle cx="270" cy="28" r="14" fill="#ffe38a" />
      <g className="animate-drift">
        <Cloud x={40} y={14} scale={1.2} />
        <Cloud x={180} y={24} scale={0.9} opacity={0.8} />
      </g>
      <path d="M0 64q80-14 160 0t160 0v136H0z" fill={`url(#${id.grass})`} />
      {/* Cây hai bên */}
      {[
        [18, 120],
        [302, 112],
        [14, 176],
        [306, 172],
      ].map(([x, y]) => (
        <g key={`${x}-${y}`}>
          <rect x={(x ?? 0) - 3} y={(y ?? 0) + 4} width="6" height="14" rx="2" fill="#8a5a34" />
          <circle cx={x} cy={y} r="13" fill="#0b7a63" />
          <circle cx={(x ?? 0) - 4} cy={(y ?? 0) - 4} r="6" fill="#32c69d" opacity="0.6" />
        </g>
      ))}
      {/* Nền lối đi */}
      <rect x="44" y="74" width="232" height="110" rx="10" fill="#f6e5bd" />
      <rect x="44" y="74" width="232" height="110" rx="10" fill="#e8cf96" opacity="0.35" />
      {/* Lối chân đi tới kho báu */}
      <path
        d="M102 186V164h-10v-30h74v-14h28v28h28"
        stroke="#f2a900"
        strokeWidth="3"
        strokeDasharray="2 7"
        strokeLinecap="round"
        fill="none"
      />
      {/* Tường cây: mặt trước rồi mặt trên */}
      {walls.map(([x, y, w, h]) => (
        <rect key={`f${x}-${y}-${w}`} x={x} y={y + h - 2} width={w} height="8" rx="3" fill="#0a6352" />
      ))}
      {walls.map(([x, y, w, h]) => (
        <g key={`t${x}-${y}-${w}`}>
          <rect x={x} y={y} width={w} height={h} rx="4" fill="#32c69d" />
          <rect x={x + 2} y={y + 2} width={Math.max(0, w - 4)} height="2.5" rx="1.25" fill="#a7efd5" opacity="0.8" />
        </g>
      ))}
      {/* Cờ ở lối vào */}
      <path d="M96 188v-22" stroke="#465066" strokeWidth="2" strokeLinecap="round" />
      <path d="M96 166l14 5-14 5z" fill="#f2683f" />
      {/* Rương kho báu */}
      <g transform="translate(212 138)">
        <circle cx="12" cy="6" r="18" fill="#ffe38a" opacity="0.6" className="animate-glow" />
        <rect x="0" y="4" width="24" height="14" rx="3" fill="#a8682f" />
        <path d="M0 6c0-6 5-9 12-9s12 3 12 9z" fill="#c58747" />
        <rect x="10" y="-3" width="4" height="21" fill="#fdc126" />
        <rect x="9" y="8" width="6" height="6" rx="1.5" fill="#fdc126" stroke="#c98a00" strokeWidth="1" />
      </g>
      <Sparkle x={206} y={128} />
      <Sparkle x={240} y={134} scale={0.8} delay={1.2} />
      <Sparkle x={226} y={122} scale={0.6} delay={2.1} />
    </SceneFrame>
  );
}

/** Rừng chữ kỳ diệu: cây cổ thụ có tán "lá chữ" phát sáng, lối mòn, nấm, đom đóm. */
export function ForestScene(props: SceneProps) {
  const id = useSvgIds(["sky", "glow", "path", "fog"]);
  const letters: Array<[number, number, string]> = [
    [142, 52, "a"],
    [176, 40, "b"],
    [200, 64, "ô"],
    [160, 78, "m"],
    [124, 76, "e"],
  ];
  return (
    <SceneFrame {...props} fogId={id.fog}>
      <defs>
        <linearGradient id={id.sky} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#cdf6ec" />
          <stop offset="1" stopColor="#a7efd5" />
        </linearGradient>
        <radialGradient id={id.glow}>
          <stop offset="0" stopColor="#fff1bf" stopOpacity="0.9" />
          <stop offset="1" stopColor="#fff1bf" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={id.path} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff1bf" />
          <stop offset="1" stopColor="#f6e0a8" />
        </linearGradient>
      </defs>
      <rect width="320" height="200" fill={`url(#${id.sky})`} />
      <circle cx="168" cy="70" r="80" fill={`url(#${id.glow})`} className="animate-glow" />
      {/* Hàng cây xa */}
      <g fill="#5fd6c0" opacity="0.8">
        {[10, 46, 82, 236, 272, 306].map((x) => (
          <path key={x} d={`M${x} 140l18-70 18 70z`} />
        ))}
      </g>
      <path d="M0 130q60-20 120-6t200-8v84H0z" fill="#2ebea7" />
      {/* Cây giữa hai bên */}
      {[
        [40, 110, 30],
        [284, 106, 28],
        [86, 128, 20],
        [244, 128, 22],
      ].map(([x, y, r]) => (
        <g key={`${x}-${y}`}>
          <rect x={(x ?? 0) - 4} y={y} width="8" height={(r ?? 0) * 1.6} rx="3" fill="#7a5230" />
          <circle cx={x} cy={y} r={r} fill="#0b7a63" />
          <circle
            cx={(x ?? 0) - (r ?? 0) / 3}
            cy={(y ?? 0) - (r ?? 0) / 3}
            r={(r ?? 0) / 2.4}
            fill="#32c69d"
            opacity="0.55"
          />
        </g>
      ))}
      {/* Cây cổ thụ */}
      <path d="M150 180c6-24 6-60 2-90h28c-4 30-4 66 2 90 8 4 18 6 22 12h-76c4-6 14-8 22-12z" fill="#8a5a34" />
      <path d="M162 100c0 30 0 56 4 80" stroke="#6b4426" strokeWidth="3" opacity="0.6" fill="none" />
      <g>
        <circle cx="166" cy="62" r="54" fill="#12a07f" />
        <circle cx="128" cy="72" r="30" fill="#0b7a63" />
        <circle cx="206" cy="70" r="32" fill="#0b7a63" />
        <circle cx="150" cy="42" r="26" fill="#32c69d" opacity="0.7" />
      </g>
      {letters.map(([x, y, letter], index) => (
        <g key={letter}>
          <circle
            cx={x}
            cy={y}
            r="11"
            fill="#fff9e6"
            className="animate-glow"
            style={{ animationDelay: `${index * 0.6}s` }}
          />
          <text
            x={x}
            y={y + 5}
            textAnchor="middle"
            fontSize="15"
            fontWeight="700"
            fill="#0b4f42"
            style={{ fontFamily: "var(--font-reading)" }}
          >
            {letter}
          </text>
        </g>
      ))}
      {/* Lối mòn */}
      <path d="M120 200q20-30 44-34 16-2 26 6 18 12 10 28z" fill={`url(#${id.path})`} />
      <g fill="#e8cf96">
        <ellipse cx="150" cy="190" rx="6" ry="2.5" />
        <ellipse cx="168" cy="178" rx="5" ry="2" />
        <ellipse cx="186" cy="188" rx="5" ry="2" />
      </g>
      {/* Nấm và bụi cây phía trước */}
      <g>
        <rect x="58" y="176" width="6" height="10" rx="2" fill="#fff9e6" />
        <path d="M50 178c0-8 6-12 11-12s11 4 11 12z" fill="#f2683f" />
        <circle cx="56" cy="172" r="1.6" fill="#fff" />
        <circle cx="64" cy="170" r="1.6" fill="#fff" />
        <rect x="258" y="178" width="5" height="8" rx="2" fill="#fff9e6" />
        <path d="M252 180c0-6 4-9 8-9s8 3 8 9z" fill="#9f80fa" />
      </g>
      <path d="M0 200q20-26 50-14 20-18 40 0v14z" fill="#0a6352" />
      <path d="M230 200q20-22 46-12 20-14 44 2v10z" fill="#0a6352" />
      {/* Đom đóm */}
      <Sparkle x={96} y={96} scale={0.7} color="#ffe38a" />
      <Sparkle x={240} y={88} scale={0.6} color="#ffe38a" delay={1} />
      <Sparkle x={210} y={150} scale={0.5} color="#ffe38a" delay={2} />
      <Sparkle x={112} y={150} scale={0.5} color="#ffe38a" delay={1.6} />
    </SceneFrame>
  );
}

/** Ký hiệu năm dấu thanh (vẽ bằng nét, không dùng ký tự tổ hợp): sắc, huyền, hỏi, ngã, nặng. */
const TONE_GLYPHS: readonly string[] = [
  "M-4 4L4-4",
  "M-4-4L4 4",
  "M-3-4q6-3 5 2-1 2-2 3v2",
  "M-5 1q2.5-5 5-1t5-1",
  "M0 0h.01",
];

/** Đảo dấu thanh: biển xanh, các đảo nhỏ có cây dừa, phao nổi mang năm dấu thanh, thuyền buồm. */
export function IslandScene(props: SceneProps) {
  const id = useSvgIds(["sky", "sea", "fog"]);
  const buoys: Array<[number, number]> = [
    [44, 128],
    [96, 168],
    [168, 182],
    [250, 176],
    [292, 136],
  ];
  return (
    <SceneFrame {...props} fogId={id.fog}>
      <defs>
        <linearGradient id={id.sky} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#b5dcff" />
          <stop offset="1" stopColor="#fff9e6" />
        </linearGradient>
        <linearGradient id={id.sea} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#5aaef0" />
          <stop offset="1" stopColor="#1f72bd" />
        </linearGradient>
      </defs>
      <rect width="320" height="200" fill={`url(#${id.sky})`} />
      <circle cx="250" cy="74" r="20" fill="#ffd44d" />
      <circle cx="250" cy="74" r="28" fill="#ffe38a" opacity="0.4" />
      <g className="animate-drift">
        <Cloud x={30} y={22} scale={1.3} />
        <Cloud x={150} y={12} />
      </g>
      <path d="M0 92h320v108H0z" fill={`url(#${id.sea})`} />
      <g stroke="#fff" strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.55" className="animate-drift">
        <path d="M20 112q6-4 12 0t12 0" />
        <path d="M200 108q6-4 12 0t12 0" />
        <path d="M130 150q6-4 12 0t12 0" />
        <path d="M260 150q6-4 12 0t12 0" />
      </g>
      {/* Đảo chính */}
      <ellipse cx="128" cy="124" rx="74" ry="16" fill="#f6e5bd" />
      <ellipse cx="128" cy="118" rx="58" ry="12" fill="#32c69d" />
      {[
        [104, 116, -8],
        [146, 114, 6],
      ].map(([x, y, lean]) => (
        <g key={`${x}`}>
          <path
            d={`M${x} ${y}q${lean} -24 ${(lean ?? 0) * 1.6} -46`}
            stroke="#8a5a34"
            strokeWidth="5"
            strokeLinecap="round"
            fill="none"
          />
          <g transform={`translate(${(x ?? 0) + (lean ?? 0) * 1.6} ${(y ?? 0) - 46})`} fill="#0b7a63">
            <path d="M0 0q-20-6-28 6 14-4 28-6z" />
            <path d="M0 0q20-6 28 6-14-4-28-6z" />
            <path d="M0 0q-12-14-24-12 12 2 24 12z" />
            <path d="M0 0q12-14 24-12-12 2-24 12z" />
            <path d="M0 0q-4 18-16 22 8-10 16-22z" fill="#12a07f" />
          </g>
        </g>
      ))}
      {/* Đảo nhỏ có chòi */}
      <ellipse cx="252" cy="112" rx="34" ry="8" fill="#f6e5bd" />
      <ellipse cx="252" cy="108" rx="24" ry="5" fill="#2ebea7" />
      <rect x="244" y="94" width="16" height="12" fill="#c58747" />
      <path d="M240 96l12-10 12 10z" fill="#cf4e27" />
      {/* Thuyền buồm */}
      <g className="animate-bob" style={{ animationDelay: "0.6s" }}>
        <path d="M188 150h40l-6 10h-28z" fill="#f2683f" />
        <path d="M207 148v-34l18 30z" fill="#fff9e6" />
        <path d="M205 148v-26l-14 24z" fill="#ffd44d" />
      </g>
      {/* Phao dấu thanh */}
      {buoys.map(([x, y], index) => (
        <g key={`${x}-${y}`} transform={`translate(${x} ${y})`}>
          <g className="animate-bob" style={{ animationDelay: `${index * 0.5}s` }}>
            <ellipse cx="0" cy="12" rx="13" ry="3" fill="#164a78" opacity="0.35" />
            <circle r="12" fill="#fff" stroke="#1a5b96" strokeWidth="2.5" />
            <path
              d={TONE_GLYPHS[index] ?? ""}
              stroke="#143a52"
              strokeWidth={index === 4 ? 5 : 2.6}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </g>
        </g>
      ))}
      <g stroke="#465066" strokeWidth="1.6" strokeLinecap="round" fill="none">
        <path d="M80 44q4-4 8 0 4-4 8 0" />
        <path d="M108 56q3-3 6 0 3-3 6 0" />
      </g>
    </SceneFrame>
  );
}

/** Lâu đài ghép vần: lâu đài cổ tích mái tím trên đồi, khối chữ bay quanh, trời sao. */
export function CastleScene(props: SceneProps) {
  const id = useSvgIds(["sky", "roof", "wall", "fog"]);
  const blocks: Array<[number, number, string, string]> = [
    [34, 70, "b", "#ffd44d"],
    [64, 104, "a", "#5fd6c0"],
    [262, 86, "n", "#ff8a6b"],
  ];
  return (
    <SceneFrame {...props} fogId={id.fog}>
      <defs>
        <linearGradient id={id.sky} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#bfa9ff" />
          <stop offset="0.6" stopColor="#ece5ff" />
          <stop offset="1" stopColor="#fff9e6" />
        </linearGradient>
        <linearGradient id={id.roof} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#9f80fa" />
          <stop offset="1" stopColor="#5932b6" />
        </linearGradient>
        <linearGradient id={id.wall} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fffdf7" />
          <stop offset="1" stopColor="#e6dcf7" />
        </linearGradient>
      </defs>
      <rect width="320" height="200" fill={`url(#${id.sky})`} />
      <path d="M276 30a14 14 0 1 0 10 24 11 11 0 1 1-10-24z" fill="#fff1bf" />
      <Sparkle x={40} y={24} scale={0.6} />
      <Sparkle x={120} y={16} scale={0.5} delay={1.1} />
      <Sparkle x={220} y={22} scale={0.55} delay={2} />
      <path d="M0 150q80-40 160-30t160 10v70H0z" fill="#9cebd9" />
      <path d="M60 200q40-70 100-72t100 72z" fill="#2ebea7" />
      {/* Lâu đài */}
      <g>
        <rect x="118" y="78" width="84" height="60" fill={`url(#${id.wall})`} />
        <path d="M118 78h84v-8h-10v4h-8v-4h-10v4h-8v-4h-10v4h-8v-4h-10v4h-8v-4h-12z" fill="#ece5ff" />
        <rect x="98" y="66" width="28" height="74" fill={`url(#${id.wall})`} />
        <rect x="194" y="66" width="28" height="74" fill={`url(#${id.wall})`} />
        <rect x="146" y="44" width="28" height="50" fill={`url(#${id.wall})`} />
        <path d="M94 68l18-36 18 36z" fill={`url(#${id.roof})`} />
        <path d="M190 68l18-36 18 36z" fill={`url(#${id.roof})`} />
        <path d="M142 46l18-40 18 40z" fill={`url(#${id.roof})`} />
        <path
          d="M112 32v-10l10 4-10 4M208 32v-10l10 4-10 4M160 6v-10l10 4-10 4"
          stroke="#465066"
          strokeWidth="1.5"
          fill="#f2683f"
        />
        {/* Cửa sổ sáng ấm */}
        {[
          [106, 84],
          [202, 84],
          [154, 58],
          [130, 96],
          [180, 96],
        ].map(([x, y]) => (
          <path
            key={`${x}-${y}`}
            d={`M${x} ${(y ?? 0) + 14}v-8a6 6 0 0 1 12 0v8z`}
            fill="#ffd44d"
            stroke="#5932b6"
            strokeWidth="1.5"
          />
        ))}
        {/* Cổng */}
        <path d="M148 138v-18a12 12 0 0 1 24 0v18z" fill="#a8682f" stroke="#5a3416" strokeWidth="2" />
        <circle cx="166" cy="128" r="1.8" fill="#fdc126" />
      </g>
      {/* Đường lên cổng */}
      <path d="M152 140q-6 20 -30 34t-20 26h40q0-16 14-30t20-30z" fill="#f6e5bd" />
      {/* Khối chữ bay */}
      {blocks.map(([x, y, letter, color], index) => (
        <g key={letter} transform={`translate(${x} ${y})`}>
          <g className="animate-float" style={{ animationDelay: `${index * 0.9}s` }}>
            <path d="M0 6l6-6h22l-6 6z" fill="#fff" opacity="0.7" />
            <path d="M22 6l6-6v22l-6 6z" fill="#465066" opacity="0.25" />
            <rect x="0" y="6" width="22" height="22" rx="4" fill={color} />
            <text
              x="11"
              y="23"
              textAnchor="middle"
              fontSize="16"
              fontWeight="700"
              fill="#143a52"
              style={{ fontFamily: "var(--font-reading)" }}
            >
              {letter}
            </text>
          </g>
        </g>
      ))}
      <path d="M0 200q30-26 60-10 20-14 40 10z" fill="#0d8275" />
      <path d="M240 200q30-24 50-12 18-10 30 0v12z" fill="#0d8275" />
    </SceneFrame>
  );
}

export const GAME_SCENES: Readonly<Record<GameKey, ComponentType<SceneProps>>> = {
  treasure_maze: MazeScene,
  wonder_forest: ForestScene,
  tone_island: IslandScene,
  rhyme_castle: CastleScene,
};
