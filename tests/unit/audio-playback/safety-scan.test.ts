import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** Quét mã nguồn/migration: bảo đảm các ràng buộc an toàn của R10.3a không bị phá vô tình. */

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}
const norm = (path: string) => path.replaceAll("\\", "/");
const srcFiles = walk("src")
  .map(norm)
  .filter((file) => /\.(ts|tsx)$/u.test(file) && !file.endsWith("database.types.ts"));
const read = (file: string) => readFileSync(file, "utf8");
const MIGRATION = "supabase/migrations/20261101090000_r10_3a_student_audio_playback.sql";

describe("máy chủ phát âm thanh", () => {
  it("mọi mô-đun máy chủ của phát âm thanh đều import 'server-only'", () => {
    const files = srcFiles.filter((file) => file.startsWith("src/server/audio-playback/"));
    expect(files.length).toBeGreaterThanOrEqual(3);
    for (const file of files) expect(read(file), file).toMatch(/^import "server-only";/mu);
  });

  it("không URL công khai/URL ký, không Web Speech API, không GỌI nhà cung cấp TTS trong đường phát (chỉ ĐỌC tệp giọng máy đã duyệt)", () => {
    const files = srcFiles.filter(
      (file) =>
        file.startsWith("src/server/audio-playback/") ||
        file.startsWith("src/features/audio-playback/") ||
        file.startsWith("src/app/api/student/question-instances/[id]/audio") ||
        file === "src/components/kid/audio-slot.tsx" ||
        file === "src/components/kid/exclusive-audio.ts" ||
        file === "src/features/scored-practice/ui/question-audio.tsx",
    );
    expect(files.length).toBeGreaterThan(8);
    for (const file of files) {
      expect(read(file), file).not.toMatch(
        /createSignedUrl|getPublicUrl|speechSynthesis|SpeechSynthesisUtterance|@\/server\/tts\/|synthesizeSpeech|createTtsProvider|libraryProvider|tts-library\/(provider|generate|actions)|TTS_/u,
      );
    }
    // R10.5: cầu nối DUY NHẤT từ đường phát tới thư viện giọng máy là playback.ts (chỉ đọc tệp đã duyệt); không import khác.
    const bridges = files.filter((file) => /from "@\/server\/tts-library\//u.test(read(file)));
    expect(bridges).toEqual(["src/server/audio-playback/service.ts"]);
    expect(read("src/server/audio-playback/service.ts")).toMatch(/from "@\/server\/tts-library\/playback"/u);
    const playback = read("src/server/tts-library/playback.ts");
    expect(playback).not.toMatch(
      /synthesizeSpeech|createTtsProvider|libraryProvider|from "\.\/provider"|from "\.\/generate"|TTS_[A-Z]+/u,
    );
    expect(playback).toContain('rpc("gateway_resolve_tts_line"');
  });

  it("khóa đối tượng chỉ ở máy chủ: trạng thái trả về chỉ có định dạng; route không nhắc storage", () => {
    const service = read("src/server/audio-playback/service.ts");
    expect(service).toMatch(/slots\[role\] = \{ mimeType: resolved\.data\.mimeType \}/u);
    for (const file of srcFiles.filter((f) => f.startsWith("src/app/api/student/question-instances/[id]/audio"))) {
      expect(read(file), file).not.toMatch(/storageKey|storage_key|teacher-audio|audio_assets|audio_asset_versions/u);
    }
    // Phản hồi phát tệp: không cache, không đoán định dạng.
    const respond = read("src/server/audio-playback/respond.ts");
    expect(respond).toContain('"Cache-Control": "private, no-store"');
    expect(respond).toContain('"X-Content-Type-Options": "nosniff"');
  });

  it("âm thanh được suy ra từ câu: route không nhận mã tài nguyên/phiên bản/đường dẫn từ trình duyệt", () => {
    const stream = read("src/app/api/student/question-instances/[id]/audio/[role]/route.ts");
    // Ngoại lệ DUY NHẤT: mã dòng lời phản hồi (`?line=`), được máy chủ đối chiếu với trạng thái thật của câu (feedback-lines.ts).
    const withoutLine = stream.replace(/new URL\(request\.url\)\.searchParams\.get\("line"\)/gu, "");
    expect(withoutLine).not.toMatch(/searchParams|request\.json|formData|assetId|versionId|asset_id|version_id/u);
    const service = read("src/server/audio-playback/service.ts");
    expect(service).not.toMatch(/searchParams|assetId:|versionId:/u);
  });

  it("mọi lần phát gọi lại hàm CSDL kiểm tra quyền (không lưu kết quả giữa các yêu cầu)", () => {
    const resolve = read("src/server/audio-playback/resolve.ts");
    expect(resolve).toContain('rpc("gateway_resolve_teacher_audio"');
    expect(resolve).not.toMatch(/new Map\(|const cache|unstable_cache|use cache|cacheLife|revalidate/u);
    for (const file of srcFiles.filter((f) => f.startsWith("src/server/audio-playback/"))) {
      expect(read(file), file).not.toMatch(/use cache|unstable_cache|cacheLife/u);
    }
  });
});

describe("giao diện học sinh", () => {
  it("thành phần giao diện không import mô-đun máy chủ phát âm thanh, kho âm thanh hay khóa đặc quyền", () => {
    const clientFiles = ["src/components/kid/audio-slot.tsx", "src/features/scored-practice/ui/question-audio.tsx"];
    for (const file of clientFiles) {
      expect(read(file), file).toMatch(/^"use client";/u);
      expect(read(file), file).not.toMatch(
        /@\/server\/|audio-library|createSupabaseAdminClient|process\.env|SUPABASE_SECRET|service_role/u,
      );
    }
  });

  it("lõi dùng ở trình duyệt (roles, support) không phụ thuộc gì → không kéo kho tri thức vào bundle", () => {
    for (const file of ["src/features/audio-playback/roles.ts", "src/features/audio-playback/support.ts"]) {
      expect(read(file), file).not.toMatch(/^import /mu);
    }
    expect(read("src/features/audio-playback/bindings.ts")).toMatch(/p0-catalog/u);
  });

  it("chỉ bắt đầu phát trong hàm xử lý chạm: không play() trong useEffect, không autoplay", () => {
    const slot = read("src/components/kid/audio-slot.tsx");
    expect(slot).not.toMatch(/autoPlay|autoplay/u);
    const effects = [...slot.matchAll(/useEffect\(([\s\S]*?)\n  \);|useEffect\(([\s\S]*?)\}, \[/gu)].map((m) => m[0]);
    for (const body of effects) expect(body).not.toMatch(/\.play\(|new Audio/u);
    expect(slot).toMatch(/const press = \(\) =>/u);
    expect(slot.match(/\.play\(/gu)).toHaveLength(1);
  });
});

describe("migration R10.3a", () => {
  const sql = read(MIGRATION);

  it("cờ phát cho học sinh mặc định TẮT và không có đường bật trong mã ứng dụng", () => {
    expect(sql).toMatch(/'student_teacher_audio_playback_approved',\s*false/u);
    for (const file of srcFiles) expect(read(file), file).not.toContain("student_teacher_audio_playback_approved");
    const scripts = walk("scripts").map(norm);
    const setters = scripts.filter((file) => read(file).includes("student_teacher_audio_playback_approved"));
    // Hai nơi duy nhất được đổi cờ này: hàm của kiểm thử và công cụ dev `npm run audio:local-flags` — công cụ đó chỉ nói chuyện với CSDL local
    // (`supabase db query --local`), từ chối khi URL không phải local, và chỉ đổi bốn cờ âm thanh cố định (không nhận tên cờ từ dòng lệnh).
    expect(setters).toEqual(["scripts/lib/test-fixtures.ts", "scripts/local-audio-flags.ts"]);
    const tool = read("scripts/local-audio-flags.ts");
    expect(tool).toMatch(/isLocalUrl\(apiUrl\)/u);
    expect(tool).toMatch(/db query --local/u);
    expect(tool).not.toMatch(/process\.argv|positionals\[1\]|values\.flag/u);
  });

  it("không mở quyền bảng âm thanh hay Storage cho anon/authenticated; hàm chỉ service_role", () => {
    expect(sql).not.toMatch(/grant\s+select/iu);
    expect(sql).not.toMatch(/create\s+policy|alter\s+table|storage\.objects/iu);
    expect(sql).toMatch(
      /revoke all on function public\.gateway_resolve_teacher_audio[\s\S]*from public, anon, authenticated/u,
    );
    expect(sql).toMatch(/grant execute on function public\.gateway_resolve_teacher_audio[\s\S]*to service_role/u);
    expect(sql).toMatch(/security definer\s+set search_path = ''/u);
  });

  it("hàm chỉ đọc: không câu lệnh ghi vào bảng, không tự duyệt", () => {
    const body = sql.slice(sql.indexOf("create or replace function public.gateway_resolve_teacher_audio"));
    expect(body).not.toMatch(/\b(insert\s+into|update\s+public|delete\s+from|set\s+status)\b/iu);
    expect(body).not.toMatch(/status\s*=\s*'approved'[^)]*then/iu);
  });

  it("kiểm tra đủ điều kiện: cờ, thiết bị, đồng ý học sinh, trường, approved + đang dùng, cách đọc, đồng ý người ghi", () => {
    for (const needle of [
      "feature_enabled('student_teacher_audio_playback_approved')",
      "require_linked_device",
      "consent_active(v_qi.student_id, 'learning_data')",
      "a.school_id = v_school_id",
      "v_asset.active_version_id",
      "v_ver.status <> 'approved'",
      "review_listened",
      "v_asset.confirmed_label <> v_ver.spoken_label",
      "p_expected_label",
      "c.status = 'granted'",
    ]) {
      expect(sql, needle).toContain(needle);
    }
  });
});
