import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { basename, extname, join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Kiểm tra vệ sinh repo (repo GitHub đang PUBLIC — CLAUDE.md §6):
 * không secret, không dữ liệu cá nhân, văn bản NFC, .env được bỏ qua đúng cách.
 */

const ROOT = process.cwd();
const SKIP_DIRS = new Set([
  "node_modules",
  ".next",
  ".git",
  ".vercel",
  ".claude",
  "coverage",
  "test-results",
  "playwright-report",
  "blob-report",
]);
const TEXT_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".mts",
  ".mjs",
  ".cjs",
  ".js",
  ".json",
  ".md",
  ".css",
  ".yml",
  ".yaml",
  ".svg",
  ".txt",
]);
const TEXT_DOTFILES = new Set([".env.example", ".gitignore", ".gitattributes", ".prettierignore", ".nvmrc"]);

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) return SKIP_DIRS.has(entry.name) ? [] : walk(fullPath);
    return [fullPath];
  });
}

const toPosix = (path: string) => relative(ROOT, path).split(sep).join("/");
const textFiles = walk(ROOT)
  .filter((file) => TEXT_EXTENSIONS.has(extname(file)) || TEXT_DOTFILES.has(basename(file)))
  .map((file) => ({ path: toPosix(file), content: readFileSync(file, "utf8") }));
// content/ (kho tri thức, GĐ3) cũng không được chứa email/số điện thoại — xem thêm content:check.
const sourceFiles = textFiles.filter((file) => /^(src|tests|public|content|scripts)\//.test(file.path));
const THIS_FILE = "tests/unit/repo-hygiene.test.ts";

const SECRET_PATTERNS: Array<[label: string, pattern: RegExp]> = [
  ["Anthropic API key", /sk-ant-[A-Za-z0-9_-]{16,}/],
  ["OpenAI-style key", /\bsk-[A-Za-z0-9]{32,}/],
  ["Supabase secret key", /sb_secret_[A-Za-z0-9_-]{16,}/],
  ["Supabase publishable key hardcode", /sb_publishable_[A-Za-z0-9_-]{16,}/],
  ["JWT", /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/],
  ["GitHub token", /\bgh[pousr]_[A-Za-z0-9]{30,}/],
  ["AWS access key", /\bAKIA[0-9A-Z]{16}\b/],
  ["Google API key", /\bAIza[0-9A-Za-z_-]{35}\b/],
  ["Private key", /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
];

describe("vệ sinh repo", () => {
  it("quét được các tệp của dự án", () => {
    expect(textFiles.length).toBeGreaterThan(30);
    expect(textFiles.some((file) => file.path === "src/strings/vi.ts")).toBe(true);
  });

  it("không có API key, token hay khóa bí mật bị hardcode", () => {
    const findings = textFiles.flatMap((file) =>
      SECRET_PATTERNS.filter(([, pattern]) => pattern.test(file.content)).map(([label]) => `${file.path}: ${label}`),
    );
    expect(findings).toEqual([]);
  });

  it("không có email hay số điện thoại trong mã nguồn (không dữ liệu học sinh thật)", () => {
    const email = /[\w.+-]+@[\w-]+\.[a-z]{2,}/i;
    const vnPhone = /(?:\+84|\b0)(?:3|5|7|8|9)\d{8}\b/;
    const findings = sourceFiles
      .filter((file) => file.path !== THIS_FILE)
      .filter((file) => email.test(file.content) || vnPhone.test(file.content))
      .map((file) => file.path);
    expect(findings).toEqual([]);
  });

  it("mã nguồn giao diện không tải tài nguyên từ tên miền bên ngoài", () => {
    const allowed = ["http://www.w3.org/2000/svg"];
    const findings = textFiles
      // Adapter TTS chạy ở máy chủ (R10.1) nên được khai báo điểm cuối nhà cung cấp; giao diện thì không.
      .filter((file) => file.path.startsWith("src/") && !file.path.startsWith("src/server/tts/"))
      .flatMap((file) =>
        (file.content.match(/https?:\/\/[^\s"'`)]+/g) ?? [])
          .filter((url) => !allowed.includes(url))
          .map((url) => `${file.path}: ${url}`),
      );
    expect(findings).toEqual([]);
  });

  it("mọi tệp văn bản ở dạng Unicode NFC", () => {
    const findings = textFiles
      .filter((file) => file.content !== file.content.normalize("NFC"))
      .map((file) => file.path);
    expect(findings).toEqual([]);
  });
});

describe(".env.example", () => {
  const lines = readFileSync(join(ROOT, ".env.example"), "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));
  const entries = lines.map((line) => {
    const [key = "", ...rest] = line.split("=");
    return { key: key.trim(), value: rest.join("=").trim() };
  });

  it("khai báo các biến dự kiến cho Supabase và nhà cung cấp AI", () => {
    const keys = entries.map((entry) => entry.key);
    for (const key of [
      "NEXT_PUBLIC_SUPABASE_URL",
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      "SUPABASE_SECRET_KEY",
      "AI_PROVIDER",
      "AI_MODEL",
      "ANTHROPIC_API_KEY",
    ]) {
      expect(keys).toContain(key);
    }
  });

  it("không chứa giá trị bí mật nào", () => {
    const secretLike = entries.filter(
      (entry) => /KEY|SECRET|TOKEN|PEPPER|PASSWORD/.test(entry.key) && entry.value !== "",
    );
    expect(secretLike).toEqual([]);
  });

  it("không đặt secret dưới tiền tố NEXT_PUBLIC_ (sẽ lộ ra trình duyệt)", () => {
    const leaked = entries.filter(
      (entry) => entry.key.startsWith("NEXT_PUBLIC_") && /SECRET|PEPPER|PRIVATE|TOKEN|PASSWORD/.test(entry.key),
    );
    expect(leaked).toEqual([]);
  });
});

describe(".gitignore", () => {
  const isIgnored = (path: string) => {
    try {
      execFileSync("git", ["check-ignore", "-q", "--no-index", path], { cwd: ROOT, stdio: "ignore" });
      return true;
    } catch (error) {
      if ((error as { status?: number }).status === 1) return false;
      throw error;
    }
  };

  it.each([
    ".env",
    ".env.local",
    ".env.production",
    ".env.development.local",
    "node_modules/x.js",
    ".next/x",
    "test-results/x.png",
  ])("bỏ qua %s", (path) => {
    expect(isIgnored(path)).toBe(true);
  });

  it.each([".env.example", "src/app/layout.tsx", "package-lock.json"])("vẫn theo dõi %s", (path) => {
    expect(isIgnored(path)).toBe(false);
  });
});
