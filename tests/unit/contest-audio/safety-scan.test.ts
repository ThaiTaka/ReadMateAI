import { execSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Quét mã nguồn / migration: các ràng buộc an toàn của CHẾ ĐỘ TRÌNH DIỄN âm thanh (docs/CONTEST_AUDIO.md) không bị phá vô tình.
 */

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}
const norm = (path: string) => path.replaceAll("\\", "/");
const read = (file: string) => readFileSync(file, "utf8");
/** Mã không kèm chú thích: tài liệu trong chú thích được phép nhắc tên bảng/bucket/hàm để giải thích. */
const code = (file: string) =>
  read(file)
    .replace(/\/\*[\s\S]*?\*\//gu, "")
    .replace(/(^|[^:])\/\/.*$/gmu, "$1");
const src = walk("src")
  .map(norm)
  .filter((file) => /\.(ts|tsx)$/u.test(file) && !file.endsWith("database.types.ts"));
const MIGRATION = "supabase/migrations/20261104090000_contest_audio_preview.sql";

const contestFiles = [
  ...src.filter(
    (file) => file.startsWith("src/server/contest-audio/") || file.startsWith("src/features/contest-audio/"),
  ),
  "scripts/contest-audio.ts",
  "scripts/lib/contest-audio.ts",
];

describe("gọi nhà cung cấp chỉ ở một nơi", () => {
  it("chỉ src/server/contest-audio/generate.ts gọi nhà cung cấp; chỉ script contest-audio import nó", () => {
    for (const file of contestFiles) {
      if (file === "src/server/contest-audio/generate.ts") continue;
      // Script được TẠO nhà cung cấp (đọc token) để đưa vào bộ chạy, nhưng chính nó không gọi synthesize.
      const forbidden =
        file === "scripts/contest-audio.ts"
          ? /\.synthesize\(|synthesizeSpeech/u
          : /\.synthesize\(|createViettelProvider|synthesizeSpeech|createTtsProvider/u;
      expect(code(file), file).not.toMatch(forbidden);
    }
    expect(code("src/server/contest-audio/generate.ts")).toContain("deps.provider.synthesize(");
    const importers = src.filter((file) => /contest-audio\/generate["']/u.test(read(file)));
    expect(importers).toEqual([]);
    expect(read("scripts/contest-audio.ts")).toContain("src/server/contest-audio/generate.ts");
  });

  it("đường phát cho học sinh không gọi nhà cung cấp, không đọc token, không dùng giọng của trình duyệt", () => {
    const student = src.filter(
      (file) =>
        file.startsWith("src/server/audio-playback/") ||
        file.startsWith("src/app/api/student/") ||
        file.startsWith("src/components/kid/") ||
        file.startsWith("src/features/scored-practice/ui/") ||
        file === "src/server/tts-library/playback.ts" ||
        (file.startsWith("src/server/contest-audio/") && file !== "src/server/contest-audio/generate.ts"),
    );
    expect(student.length).toBeGreaterThan(12);
    for (const file of student) {
      expect(code(file), file).not.toMatch(
        /TTS_VIETTEL_TOKEN|viettelai\.vn|\.synthesize\(|createViettelProvider|speechSynthesis|SpeechSynthesisUtterance|createSignedUrl|getPublicUrl/u,
      );
    }
  });

  it("mã trình duyệt không nhập mô-đun máy chủ của chế độ trình diễn", () => {
    for (const file of src) {
      const body = read(file);
      if (/["']use client["']/u.test(body)) {
        expect(body, file).not.toMatch(/server\/contest-audio|scripts\/lib\/contest-audio/u);
      }
    }
  });
});

describe("không giả tạo phê duyệt, không trộn miền dữ liệu", () => {
  it("mã trình diễn không đụng bảng/hàm của bản ghi giáo viên hay giọng máy đã duyệt và không đặt trạng thái 'approved'", () => {
    for (const file of contestFiles) {
      const body = code(file);
      expect(body, file).not.toMatch(
        /from\(["'](audio_assets|audio_asset_versions|tts_audio_versions|tts_script_reviews)["']\)|teacher_(review|register|confirm|create|submit|revoke)_|reviewed_by|review_listened|teacher_recording/u,
      );
      expect(body, file).not.toMatch(/["']approved["']|status:\s*["']approved/u);
    }
  });

  it("hàm phát/đăng ký của trình diễn chỉ đi qua gateway_*contest_audio và bucket riêng contest-audio", () => {
    expect(read("src/server/contest-audio/playback.ts")).toMatch(/rpc\("gateway_resolve_contest_audio"/u);
    expect(read("src/server/contest-audio/playback.ts")).toMatch(/rpc\("gateway_list_contest_audio"/u);
    expect(read("src/server/contest-audio/storage.ts")).toContain("CONTEST_BUCKET");
    for (const file of contestFiles) expect(code(file), file).not.toMatch(/["'`](teacher-audio|tts-audio)["'`]/u);
  });

  it("migration: cả hai cờ chèn với giá trị false, không bật cờ nào, bảng không có cột duyệt", () => {
    const sql = read(MIGRATION);
    expect(sql).toMatch(/\('contest_audio_preview_enabled', false,/u);
    expect(sql).toMatch(/\('contest_audio_play_unverified', false,/u);
    expect(sql).not.toMatch(
      /update\s+private\.feature_flags|set\s+enabled\s*=\s*true|contest_audio_allowed\s*=\s*true/iu,
    );
    expect(sql).toMatch(/contest_audio_allowed boolean not null default false/u);
    const table = /create table public\.contest_audio_assets \(([\s\S]*?)\n\);/u.exec(sql)?.[1] ?? "";
    expect(table.length).toBeGreaterThan(500);
    const columns = table
      .split("\n")
      .map((line) => /^\s{2}([a-z_]+)\s/u.exec(line)?.[1])
      .filter((name): name is string => Boolean(name) && !["check", "primary", "unique"].includes(name as string));
    expect(columns.length).toBeGreaterThan(20);
    expect(columns.filter((name) => /review|approv|listen|status|teacher|staff|consent|confirm/u.test(name))).toEqual(
      [],
    );
  });

  it("nguồn gốc cố định trong migration và cấu hình", () => {
    const sql = read(MIGRATION);
    expect(sql).toContain("origin = 'ai_generated'");
    expect(sql).toContain("purpose = 'contest_preview'");
    expect(sql).toContain("technical_check = 'technical_check_passed'");
    expect(read("src/features/contest-audio/config.ts")).toMatch(/CONTEST_ORIGIN = "ai_generated"/u);
  });
});

describe("chỉ máy local; token không lộ", () => {
  it("mọi chỗ script tạo client quản trị đều đi qua localEnvOrThrow()", () => {
    const lib = read("scripts/lib/contest-audio.ts");
    const adminCalls = lib.split("adminClient(").length - 1;
    const guarded = lib.split("adminClient(localEnvOrThrow())").length - 1;
    expect(adminCalls).toBeGreaterThanOrEqual(6);
    expect(guarded).toBe(adminCalls);
    expect(lib).toMatch(/isLocalUrl\(env\.apiUrl\)/u);
    expect(read("scripts/contest-audio.ts")).toContain("localEnvOrThrow()");
  });

  it("phía ứng dụng chỉ hỏi CSDL/Storage khi isContestPreviewEnvironment() đúng", () => {
    const playback = read("src/server/contest-audio/playback.ts");
    expect(playback.match(/isContestPreviewEnvironment\(process\.env\)/gu)?.length).toBeGreaterThanOrEqual(2);
    expect(read("src/app/teacher/(console)/audio-coverage/page.tsx")).toContain(
      "isContestPreviewEnvironment(process.env)",
    );
  });

  it("không dòng nào của script in token: biến token không xuất hiện trong lệnh in / console / thông báo lỗi", () => {
    for (const file of [
      "scripts/contest-audio.ts",
      "scripts/lib/contest-audio.ts",
      "src/server/contest-audio/generate.ts",
    ]) {
      const lines = code(file).split("\n");
      lines.forEach((line, index) => {
        if (!/token/iu.test(line)) return;
        expect(line, `${file}:${index + 1}`).not.toMatch(/\b(out|err|console\.\w+)\(.*\btoken\b(?!:)/u);
        expect(line, `${file}:${index + 1}`).not.toMatch(/\$\{[^}]*token[^}]*\}/iu);
      });
    }
    // Biến môi trường của token không có tiền tố NEXT_PUBLIC_ (không bao giờ xuống trình duyệt).
    expect(read("scripts/contest-audio.ts")).not.toContain("NEXT_PUBLIC_TTS");
  });
});

describe("không đưa tệp âm thanh hay dữ liệu cá nhân vào repo", () => {
  it(".contest-audio/ được .gitignore và không có tệp âm thanh nào được theo dõi", () => {
    expect(read(".gitignore")).toMatch(/^\.contest-audio\/$/mu);
    const tracked = execSync("git ls-files", { encoding: "utf8" }).split("\n").filter(Boolean);
    expect(tracked.filter((file) => /\.(mp3|wav|ogg|m4a|webm|flac)$/iu.test(file))).toEqual([]);
    expect(tracked.filter((file) => file.startsWith(".contest-audio/") || file.startsWith(".tts-poc/"))).toEqual([]);
  });
});
