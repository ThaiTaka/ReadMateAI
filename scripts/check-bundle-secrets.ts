/**
 * npm run check:bundle — sau `npm run build`: quét mọi tệp trình duyệt tải về (.next/static) để chắc chắn
 * không có khóa secret (ARCHITECTURE §8.4, REDESIGN_TASKS 3.9).
 *
 * - Mẫu chung: `sb_secret_…`, khóa JWT `service_role`, khóa riêng PEM.
 * - Giá trị thật đang có trong môi trường build (SUPABASE_SECRET_KEY, LOGIN_CODE_PEPPER, SEED_TEACHER_PASSWORD…)
 *   nếu được đặt — đọc từ process.env/.env.local, KHÔNG in giá trị ra màn hình.
 * Thoát mã 1 khi phát hiện.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const STATIC_DIR = join(process.cwd(), ".next", "static");
if (!existsSync(STATIC_DIR)) {
  console.error("Chưa có .next/static — chạy `npm run build` trước.");
  process.exit(1);
}

const PATTERNS: Array<[string, RegExp]> = [
  ["khóa secret Supabase", /sb_secret_[A-Za-z0-9_-]{8,}/u],
  ["JWT service_role", /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]*c2VydmljZV9yb2xl/u],
  ["khóa riêng PEM", /-----BEGIN [A-Z ]*PRIVATE KEY-----/u],
];
const SECRET_VARS = [
  "SUPABASE_SECRET_KEY",
  "LOGIN_CODE_PEPPER",
  "SEED_TEACHER_PASSWORD",
  "CRON_SECRET",
  "TURNSTILE_SECRET_KEY",
  "ANTHROPIC_API_KEY",
  "TTS_GOOGLE_API_KEY",
];
const secretValues = SECRET_VARS.map((name) => [name, process.env[name]?.trim() ?? ""] as const).filter(
  ([, value]) => value.length >= 8,
);

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

const findings: string[] = [];
const files = walk(STATIC_DIR);
for (const file of files) {
  const content = readFileSync(file, "latin1");
  for (const [label, pattern] of PATTERNS)
    if (pattern.test(content)) findings.push(`${relative(process.cwd(), file)}: ${label}`);
  for (const [name, value] of secretValues)
    if (content.includes(value)) findings.push(`${relative(process.cwd(), file)}: giá trị của ${name}`);
}

if (findings.length > 0) {
  console.error(`PHÁT HIỆN secret trong bundle trình duyệt:\n  ${findings.join("\n  ")}`);
  process.exit(1);
}
console.log(
  `Bundle trình duyệt sạch: ${files.length} tệp, ${PATTERNS.length} mẫu + ${secretValues.length} giá trị secret của môi trường đã kiểm.`,
);
