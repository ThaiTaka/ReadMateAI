import { cn } from "@/lib/cn";
import { artA11y, useSvgIds, type ArtProps } from "./svg-ids";

/*
 * Nhân vật gốc của ReadMate AI — vẽ tay bằng mã SVG trong phiên R02 (không dựa trên nhân vật có bản quyền).
 * Trạng thái: BẢN PHÁC THẢO, chờ giáo viên duyệt mức độ phù hợp với trẻ 6–7 tuổi (RQ-M1).
 * Giấy phép và nguồn: content/media/licenses.json · docs/ASSET_MANIFEST.md.
 * Phong cách chung: 2D cartoon, khối tròn, ánh sáng mềm từ trên trái, viền không đen, bóng đổ mờ dưới chân.
 */

/** Nhân vật học sinh phiêu lưu ("Bạn nhỏ thám hiểm"): mũ thám hiểm, ba lô, cuộn bản đồ, tay vẫy chào. */
export function HeroKid({ className, title }: ArtProps) {
  const id = useSvgIds(["skin", "shirt", "pack", "cap", "shade"]);
  return (
    <svg viewBox="0 0 200 260" className={cn("h-auto w-full", className)} {...artA11y(title)}>
      <defs>
        <radialGradient id={id.skin} cx="40%" cy="35%" r="70%">
          <stop offset="0" stopColor="#ffe4cf" />
          <stop offset="1" stopColor="#efb98f" />
        </radialGradient>
        <linearGradient id={id.shirt} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffd44d" />
          <stop offset="1" stopColor="#f2a900" />
        </linearGradient>
        <linearGradient id={id.pack} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2ebea7" />
          <stop offset="1" stopColor="#0d8275" />
        </linearGradient>
        <linearGradient id={id.cap} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#5fd6c0" />
          <stop offset="1" stopColor="#0f695f" />
        </linearGradient>
        <linearGradient id={id.shade} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0.55" stopColor="#0d283b" stopOpacity="0" />
          <stop offset="1" stopColor="#0d283b" stopOpacity="0.14" />
        </linearGradient>
      </defs>

      <ellipse cx="100" cy="248" rx="54" ry="8" fill="#0d283b" opacity="0.14" />

      <g className="animate-bob">
        {/* Ba lô sau lưng */}
        <rect x="50" y="132" width="100" height="74" rx="26" fill={`url(#${id.pack})`} />
        <rect x="50" y="170" width="16" height="22" rx="7" fill="#0f695f" />
        <rect x="134" y="170" width="16" height="22" rx="7" fill="#0f695f" />

        {/* Chân và giày */}
        <rect x="79" y="194" width="18" height="40" rx="8" fill="#2f4b7c" />
        <rect x="103" y="194" width="18" height="40" rx="8" fill="#26406b" />
        <path d="M70 236c0-6 5-10 12-10h12c4 0 6 3 6 7v4c0 3-2 5-5 5H75c-3 0-5-3-5-6z" fill="#f2683f" />
        <path d="M100 237v-4c0-4 2-7 6-7h12c7 0 12 4 12 10 0 3-2 6-5 6h-20c-3 0-5-2-5-5z" fill="#cf4e27" />
        <path d="M74 238h22M104 238h22" stroke="#fff3ef" strokeWidth="2.5" strokeLinecap="round" opacity="0.8" />

        {/* Quần short */}
        <path d="M68 186h64l2 18c0 4-3 6-6 6h-22l-6-8-6 8H72c-3 0-6-2-6-6z" fill="#2f4b7c" />

        {/* Áo */}
        <path
          d="M66 142c0-10 7-16 16-17h36c9 1 16 7 16 17l2 46c0 4-3 6-6 6H70c-3 0-6-2-6-6z"
          fill={`url(#${id.shirt})`}
        />
        <path
          d="M66 142c0-10 7-16 16-17h36c9 1 16 7 16 17l2 46c0 4-3 6-6 6H70c-3 0-6-2-6-6z"
          fill={`url(#${id.shade})`}
        />
        {/* Ngôi sao trên ngực */}
        <path
          d="M100 150l3.6 7.4 8.1 1.2-5.9 5.7 1.4 8.1-7.2-3.8-7.2 3.8 1.4-8.1-5.9-5.7 8.1-1.2z"
          fill="#0d8275"
          opacity="0.9"
        />
        {/* Quai ba lô */}
        <rect x="73" y="128" width="9" height="56" rx="4.5" fill="#0f695f" />
        <rect x="118" y="128" width="9" height="56" rx="4.5" fill="#0f695f" />

        {/* Tay trái (người xem) cầm cuộn bản đồ */}
        <path d="M70 136c-8 3-14 18-16 40" stroke="#f2a900" strokeWidth="15" strokeLinecap="round" fill="none" />
        <circle cx="54" cy="182" r="8.5" fill={`url(#${id.skin})`} />
        <g transform="rotate(-24 50 190)">
          <rect x="30" y="184" width="40" height="13" rx="6.5" fill="#fff1d6" />
          <ellipse cx="31" cy="190.5" rx="4" ry="6.5" fill="#f5dcae" />
          <rect x="47" y="184" width="5" height="13" fill="#cf4e27" />
        </g>

        {/* Cổ, khăn quàng */}
        <rect x="91" y="112" width="18" height="16" rx="6" fill="#efb98f" />
        <path d="M78 128c8-6 36-6 44 0l-3 7c-12-4-26-4-38 0z" fill="#f2683f" />
        <path d="M112 132l8 22-9-3-4 8-3-24z" fill="#cf4e27" />

        {/* Đầu */}
        <circle cx="60" cy="90" r="9" fill="#efb98f" />
        <circle cx="140" cy="90" r="9" fill="#efb98f" />
        <circle cx="100" cy="86" r="41" fill={`url(#${id.skin})`} />

        {/* Tóc lộ dưới vành mũ */}
        <path
          d="M60 80c2 10 8 14 14 8 4 8 12 8 18 0 6 8 14 8 20 0 6 8 14 8 18 0 6 6 12 2 12-8l-2-6H62z"
          fill="#3a2a25"
        />
        <path d="M59 80c-1 8 0 16 3 20l4-14z" fill="#3a2a25" />
        <path d="M141 80c1 8 0 16-3 20l-4-14z" fill="#3a2a25" />

        {/* Mũ thám hiểm */}
        <path d="M60 76c0-26 18-42 40-42s40 16 40 42z" fill={`url(#${id.cap})`} />
        <path d="M70 52c8-10 18-14 30-14" stroke="#cdf6ec" strokeWidth="4" strokeLinecap="round" opacity="0.6" />
        <path d="M52 76c14-6 82-6 96 0 2 5-2 8-8 8-24-4-56-4-80 0-6 0-10-3-8-8z" fill="#0f4440" />
        <circle cx="100" cy="56" r="9" fill="#ffd44d" />
        <path d="M100 49.5l2 4.2 4.6.6-3.3 3.2.8 4.6-4.1-2.2-4.1 2.2.8-4.6-3.3-3.2 4.6-.6z" fill="#c98a00" />

        {/* Khuôn mặt */}
        <path d="M80 86q6-5 12 0M108 86q6-5 12 0" stroke="#3a2a25" strokeWidth="3" strokeLinecap="round" fill="none" />
        <ellipse cx="86" cy="97" rx="5.5" ry="7" fill="#1d2433" />
        <ellipse cx="114" cy="97" rx="5.5" ry="7" fill="#1d2433" />
        <circle cx="88" cy="94" r="2.2" fill="#fff" />
        <circle cx="116" cy="94" r="2.2" fill="#fff" />
        <ellipse cx="75" cy="108" rx="7.5" ry="4.5" fill="#ff8a6b" opacity="0.45" />
        <ellipse cx="125" cy="108" rx="7.5" ry="4.5" fill="#ff8a6b" opacity="0.45" />
        <path d="M98 104q2 2 4 0" stroke="#c98a6a" strokeWidth="2" strokeLinecap="round" fill="none" />
        <path d="M90 110q10 12 20 0q-10 4-20 0z" fill="#a43c1e" />
        <path d="M95 115q5 3 10 0q-5-2-10 0z" fill="#ff8a6b" />

        {/* Tay phải (người xem) vẫy chào */}
        <g className="origin-fill origin-[15%_92%] animate-wave">
          <path d="M131 138c10-4 20-18 26-36" stroke="#f2a900" strokeWidth="15" strokeLinecap="round" fill="none" />
          <circle cx="159" cy="97" r="9.5" fill={`url(#${id.skin})`} />
          <path d="M154 90q3-6 8-4" stroke="#e3a57c" strokeWidth="2" strokeLinecap="round" fill="none" />
        </g>
      </g>
    </svg>
  );
}

/** Nhân vật hướng dẫn "Cú Bông": cú mèo đội mũ phép, đeo kính tròn, cầm đèn lồng soi đường. */
export function GuideOwl({ className, title }: ArtProps) {
  const id = useSvgIds(["body", "belly", "hat", "lamp", "glow"]);
  return (
    <svg viewBox="0 0 200 220" className={cn("h-auto w-full", className)} {...artA11y(title)}>
      <defs>
        <linearGradient id={id.body} x1="0.2" y1="0" x2="0.8" y2="1">
          <stop offset="0" stopColor="#5fd6c0" />
          <stop offset="0.55" stopColor="#14a290" />
          <stop offset="1" stopColor="#0f695f" />
        </linearGradient>
        <radialGradient id={id.belly} cx="50%" cy="40%" r="65%">
          <stop offset="0" stopColor="#fffdf7" />
          <stop offset="1" stopColor="#fbe9c4" />
        </radialGradient>
        <linearGradient id={id.hat} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#9f80fa" />
          <stop offset="1" stopColor="#5932b6" />
        </linearGradient>
        <linearGradient id={id.lamp} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff1bf" />
          <stop offset="1" stopColor="#fdc126" />
        </linearGradient>
        <radialGradient id={id.glow}>
          <stop offset="0" stopColor="#ffe38a" stopOpacity="0.9" />
          <stop offset="1" stopColor="#ffe38a" stopOpacity="0" />
        </radialGradient>
      </defs>

      <ellipse cx="96" cy="210" rx="46" ry="7" fill="#0d283b" opacity="0.14" />

      <g className="animate-float">
        {/* Tai lông */}
        <path d="M58 70 44 30l36 22z" fill="#0f695f" />
        <path d="M134 70l14-40-36 22z" fill="#0f695f" />

        {/* Thân */}
        <path d="M96 44c50 0 70 48 66 98-4 44-30 62-66 62s-62-18-66-62c-4-50 16-98 66-98z" fill={`url(#${id.body})`} />
        {/* Cánh trái */}
        <path d="M36 112c-14 16-14 46 4 62 6-18 10-40 6-62z" fill="#0f695f" />
        {/* Bụng có vảy lông */}
        <ellipse cx="96" cy="150" rx="42" ry="46" fill={`url(#${id.belly})`} />
        <path
          d="M74 136q6 6 12 0q6 6 12 0q6 6 12 0M68 154q6 6 12 0q6 6 12 0q6 6 12 0q6 6 12 0M74 172q6 6 12 0q6 6 12 0q6 6 12 0"
          stroke="#f2c86a"
          strokeWidth="2.5"
          strokeLinecap="round"
          fill="none"
        />

        {/* Mặt */}
        <circle cx="74" cy="96" r="27" fill="#e9fbf6" />
        <circle cx="118" cy="96" r="27" fill="#e9fbf6" />
        <circle cx="74" cy="98" r="11.5" fill="#1d2433" />
        <circle cx="118" cy="98" r="11.5" fill="#1d2433" />
        <circle cx="78" cy="93" r="4.2" fill="#fff" />
        <circle cx="122" cy="93" r="4.2" fill="#fff" />
        <circle cx="70" cy="102" r="1.8" fill="#fff" opacity="0.8" />
        <circle cx="114" cy="102" r="1.8" fill="#fff" opacity="0.8" />
        {/* Kính tròn */}
        <circle cx="74" cy="97" r="20" fill="none" stroke="#143a52" strokeWidth="4" />
        <circle cx="118" cy="97" r="20" fill="none" stroke="#143a52" strokeWidth="4" />
        <path d="M93 94q3-4 6 0" stroke="#143a52" strokeWidth="4" fill="none" strokeLinecap="round" />
        <ellipse cx="56" cy="118" rx="7" ry="4" fill="#ff8a6b" opacity="0.4" />
        <ellipse cx="136" cy="118" rx="7" ry="4" fill="#ff8a6b" opacity="0.4" />
        {/* Mỏ */}
        <path d="M96 110l-8 9q8 9 16 0z" fill="#fdc126" stroke="#c98a00" strokeWidth="1.5" strokeLinejoin="round" />

        {/* Mũ phép */}
        <path d="M66 54q30-58 42-50 8 6 22 46-32 12-64 4z" fill={`url(#${id.hat})`} />
        <path d="M64 52q34 10 68-2l2 8q-36 12-72 2z" fill="#ffd44d" />
        <path d="M98 28l1.6 3.4 3.7.5-2.7 2.6.7 3.7-3.3-1.8-3.3 1.8.7-3.7-2.7-2.6 3.7-.5z" fill="#fff1bf" />
        <circle cx="116" cy="40" r="2" fill="#fff1bf" />
        <circle cx="86" cy="44" r="1.6" fill="#fff1bf" />

        {/* Chân */}
        <path d="M80 200q-6 8 0 8 4-4 6 0 4-4 6 0 6 0 2-8z" fill="#f2a900" />
        <path d="M104 200q-6 8 0 8 4-4 6 0 4-4 6 0 6 0 2-8z" fill="#f2a900" />

        {/* Cánh phải cầm đèn lồng */}
        <path d="M156 112c16 4 26 18 24 34-10-4-18-10-24-18z" fill="#0f695f" />
        <g className="origin-fill origin-top animate-sway">
          <path d="M178 140v14" stroke="#143a52" strokeWidth="2.5" strokeLinecap="round" />
          <circle cx="178" cy="172" r="26" fill={`url(#${id.glow})`} className="animate-glow" />
          <rect
            x="166"
            y="154"
            width="24"
            height="30"
            rx="9"
            fill={`url(#${id.lamp})`}
            stroke="#c98a00"
            strokeWidth="2"
          />
          <rect x="170" y="150" width="16" height="6" rx="3" fill="#cf4e27" />
          <rect x="170" y="182" width="16" height="6" rx="3" fill="#cf4e27" />
          <path d="M178 160v18" stroke="#f2a900" strokeWidth="2" opacity="0.7" />
        </g>
      </g>
    </svg>
  );
}

/** Quái vật thân thiện "Bé Mây Bông": thân như đám mây bông, mắt to, má hồng, không răng, không móng vuốt. */
export function FriendlyMonster({ className, title }: ArtProps) {
  const id = useSvgIds(["fluff", "belly"]);
  const sparkle = "M0-9 2.2-2.2 9 0 2.2 2.2 0 9-2.2 2.2-9 0-2.2-2.2z";
  return (
    <svg viewBox="0 0 200 200" className={cn("h-auto w-full", className)} {...artA11y(title)}>
      <defs>
        <radialGradient id={id.fluff} cx="45%" cy="38%" r="70%">
          <stop offset="0" stopColor="#fbf6ff" />
          <stop offset="0.6" stopColor="#e3d7ff" />
          <stop offset="1" stopColor="#bfa9ff" />
        </radialGradient>
        <radialGradient id={id.belly} cx="50%" cy="40%" r="60%">
          <stop offset="0" stopColor="#fff7fb" />
          <stop offset="1" stopColor="#ffe1ec" />
        </radialGradient>
      </defs>

      <ellipse cx="100" cy="190" rx="42" ry="6" fill="#3a2475" opacity="0.12" />

      <g className="animate-float">
        {/* Sừng tròn mềm */}
        <circle cx="76" cy="50" r="10" fill="#ffe38a" />
        <circle cx="126" cy="48" r="10" fill="#ffe38a" />
        <circle cx="73" cy="47" r="3" fill="#fff9e6" />
        <circle cx="123" cy="45" r="3" fill="#fff9e6" />

        {/* Tay nhỏ */}
        <ellipse cx="38" cy="128" rx="14" ry="10" transform="rotate(-30 38 128)" fill="#cbb6ff" />
        <ellipse cx="164" cy="126" rx="14" ry="10" transform="rotate(30 164 126)" fill="#cbb6ff" />

        {/* Thân mây */}
        <path
          d="M50 122c-20 0-24-30-4-36-6-26 22-42 42-30 6-22 42-20 46 2 22-10 44 12 32 34 20 8 14 40-8 40 4 24-24 38-44 28-12 16-42 12-46-4-22 4-34-18-18-34z"
          fill={`url(#${id.fluff})`}
        />
        <path d="M62 66q10-10 22-8" stroke="#fff" strokeWidth="5" strokeLinecap="round" opacity="0.7" fill="none" />
        <ellipse cx="102" cy="142" rx="30" ry="22" fill={`url(#${id.belly})`} />
        <path d="M102 132l2.8 5.8 6.4.9-4.6 4.5 1.1 6.3-5.7-3-5.7 3 1.1-6.3-4.6-4.5 6.4-.9z" fill="#fdc126" />

        {/* Mắt to lấp lánh */}
        <ellipse cx="82" cy="100" rx="13" ry="15" fill="#2a2350" />
        <ellipse cx="122" cy="100" rx="13" ry="15" fill="#2a2350" />
        <circle cx="86" cy="94" r="5.5" fill="#fff" />
        <circle cx="126" cy="94" r="5.5" fill="#fff" />
        <circle cx="78" cy="106" r="2.4" fill="#fff" opacity="0.85" />
        <circle cx="118" cy="106" r="2.4" fill="#fff" opacity="0.85" />
        <ellipse cx="64" cy="118" rx="8" ry="5" fill="#ff8aa8" opacity="0.55" />
        <ellipse cx="140" cy="118" rx="8" ry="5" fill="#ff8aa8" opacity="0.55" />
        {/* Miệng cười, không răng */}
        <path d="M93 120q9 10 18 0q-9 4-18 0z" fill="#7a3d7e" />
        <path d="M98 124q4 2.5 8 0q-4-1.5-8 0z" fill="#ff8aa8" />

        {/* Chân */}
        <ellipse cx="84" cy="170" rx="12" ry="7" fill="#cbb6ff" />
        <ellipse cx="120" cy="170" rx="12" ry="7" fill="#cbb6ff" />
      </g>

      {/* Lấp lánh xung quanh — vị trí ở <g>, hoạt cảnh ở <path> (CSS transform sẽ đè thuộc tính transform). */}
      <g transform="translate(28 60)">
        <path d={sparkle} fill="#ffd44d" className="origin-fill origin-center animate-twinkle" />
      </g>
      <g transform="translate(176 72) scale(0.7)">
        <path d={sparkle} fill="#9f80fa" className="origin-fill origin-center animate-twinkle [animation-delay:1s]" />
      </g>
      <g transform="translate(168 168) scale(0.6)">
        <path d={sparkle} fill="#5fd6c0" className="origin-fill origin-center animate-twinkle [animation-delay:2s]" />
      </g>
    </svg>
  );
}
