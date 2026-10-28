import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildTtsScriptCatalog } from "@/server/tts/catalog";
import { planTtsBatch, runTtsBatch } from "@/server/tts/batch";
import { approve, syntheticWavProvider, TEST_VOICE } from "./tts-helpers";

const root = process.cwd();
const norm = (path: string) => path.replaceAll("\\", "/");

function walk(dir: string, accept: RegExp, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, accept, out);
    else if (accept.test(name)) out.push(full);
  }
  return out;
}

const sourceFiles = walk(join(root, "src"), /\.(ts|tsx)$/u);
const ttsFiles = sourceFiles.filter((file) => norm(file).includes("/src/server/tts/"));
const outside = sourceFiles.filter((file) => !norm(file).includes("/src/server/tts/"));
const text = (file: string) => readFileSync(file, "utf8");

afterEach(() => vi.restoreAllMocks());

describe("R10.3b1 — không gọi dịch vụ ngoài, không dữ liệu học sinh, không đường phát", () => {
  it("toàn bộ luồng (danh mục → duyệt → kế hoạch → sinh → kiểm tra) chạy mà KHÔNG có yêu cầu mạng nào", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("không được gọi mạng"));
    const catalog = buildTtsScriptCatalog({ voice: TEST_VOICE });
    const plan = planTtsBatch({
      entries: catalog.entries,
      scriptReviews: catalog.entries.map((e) => approve(e)),
      versions: [],
      providerId: "mock",
      voice: TEST_VOICE,
      limits: { maxChars: 100000 },
    });
    const result = await runTtsBatch({ plan, provider: syntheticWavProvider("mock") });
    expect(result.candidates).toHaveLength(plan.jobs.length);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("địa chỉ dịch vụ ngoài chỉ xuất hiện trong adapter Google (providers.ts); không có Azure/FPT.AI", () => {
    for (const file of ttsFiles) {
      const body = text(file);
      expect(body, file).not.toMatch(/cognitiveservices|speech\.microsoft|tts\.speech|fpt\.ai|api\.fpt/iu);
      if (!norm(file).endsWith("/providers.ts")) expect(body, file).not.toMatch(/https?:\/\//u);
    }
    for (const file of outside)
      expect(text(file), file).not.toMatch(/texttospeech\.googleapis|cognitiveservices|fpt\.ai/iu);
  });

  it("mô-đun TTS không đọc process.env và không import dữ liệu học sinh, xác thực, điểm, game, bảng xếp hạng", () => {
    for (const file of ttsFiles) {
      const body = text(file);
      expect(body, file).not.toMatch(/process\.env/u);
      expect(body, file).not.toMatch(
        /from\s+["'][^"']*(student-gateway|server\/auth|supabase|features\/(students|login-codes|consent|gamification|game-|leaderboard|scored-practice|honors|season))/u,
      );
    }
  });

  it("không có route, tác vụ nền hay giao diện học sinh nào gọi lô/danh mục/phát TTS", () => {
    const allowedConsumers = new Set(
      ["page.tsx", "tts-script-list.tsx"].map((name) => norm(join(root, "src/app/teacher/(console)/tts-script", name))),
    );
    for (const file of outside) {
      const body = text(file);
      if (/server\/tts\/(batch|catalog|versions|playback|script-review|audio-check)/u.test(body)) {
        expect(allowedConsumers.has(norm(file)), `${relative(root, file)} import mô-đun TTS`).toBe(true);
      }
      if (/["']use client["']/u.test(body)) expect(body, file).not.toMatch(/server\/tts/u);
      expect(body, file).not.toMatch(/runTtsBatch|synthesizeSpeech/u);
    }
    expect(outside.filter((file) => /\/api\/.*tts/iu.test(norm(file)))).toEqual([]);
  });

  it("không có mã ứng dụng nào bật cờ phát TTS; cờ phát âm thanh và ghi âm vẫn TẮT trong mọi migration", () => {
    for (const file of sourceFiles) expect(text(file), file).not.toMatch(/flagEnabled:\s*true/u);
    const migrations = walk(join(root, "supabase/migrations"), /\.sql$/u)
      .map(text)
      .join("\n");
    expect(migrations).not.toMatch(/student_tts|tts_playback/iu);
    for (const flag of ["student_teacher_audio_playback_approved", "teacher_audio_recording_approved"]) {
      // mọi dòng đặt giá trị cờ trong migration phải là `false`
      const sets = migrations.match(new RegExp(`${flag}[^;]*?(true|false)`, "giu")) ?? [];
      for (const match of sets) expect(match.toLowerCase(), match).not.toMatch(/\btrue\b/u);
    }
  });

  it("cấu hình mẫu giữ TTS_PROVIDER=none và không chứa khóa", () => {
    const env = readFileSync(join(root, ".env.example"), "utf8");
    expect(env).toMatch(/^TTS_PROVIDER=none$/mu);
    expect(env).toMatch(/^TTS_GOOGLE_API_KEY=$/mu);
  });

  it("mô-đun danh mục không bị kéo vào mã trình duyệt (node:crypto chỉ ở máy chủ)", () => {
    for (const file of ttsFiles.filter((f) => /hash\.ts$/u.test(f))) expect(text(file)).toContain("node:crypto");
    for (const file of outside) {
      if (/["']use client["']/u.test(text(file))) expect(text(file), file).not.toMatch(/server\/tts\/hash/u);
    }
  });
});
