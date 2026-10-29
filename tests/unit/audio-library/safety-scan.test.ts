import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** Quét mã nguồn/migration: bảo đảm các ràng buộc an toàn của R10.2 không bị phá vô tình. */

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

const RECORDER_FILE = "src/app/teacher/(console)/audio/recorder.tsx";

describe("micro và ghi âm", () => {
  it("getUserMedia/MediaRecorder chỉ được gọi trong trình ghi âm của GV (một tệp duy nhất)", () => {
    const users = srcFiles.filter((file) => /getUserMedia\s*\(|new\s+MediaRecorder\s*\(/u.test(read(file)));
    expect(users).toEqual([RECORDER_FILE]);
  });

  it("không có Web Speech API / nhận dạng giọng nói", () => {
    const offenders = srcFiles.filter((file) =>
      /speechSynthesis|SpeechRecognition|webkitSpeechRecognition/u.test(read(file)),
    );
    expect(offenders).toEqual([]);
  });

  it("xin quyền micro chỉ trong hàm bấm nút: không nằm trong useEffect/useLayoutEffect, không tự khởi động", () => {
    const source = read(RECORDER_FILE);
    expect(source).toMatch(/const start = async \(\) =>/u);
    const effects = [...source.matchAll(/use(?:Layout)?Effect\(\s*\(\)\s*=>\s*\{([\s\S]*?)\n\s{2}\},\s*\[/gu)].map(
      (m) => m[1] ?? "",
    );
    for (const body of effects) expect(body).not.toMatch(/getUserMedia|\bstart\(|recorder\.start/u);
    expect(source).toMatch(/onClick=\{start\}/u);
  });

  it("mã học sinh không tham chiếu trang/route/hàm ghi âm của giáo viên", () => {
    const student = srcFiles.filter((file) =>
      /^src\/(app\/(learn|join|\(site\))|app\/api\/student|components\/kid|features\/(exercises|game-engine|game-runs|game-world|scored-practice)|server\/student-gateway)\//u.test(
        file,
      ),
    );
    expect(student.length).toBeGreaterThan(20);
    const offenders = student.filter((file) =>
      /audio-library|teacher\/audio|teacher-audio|MediaRecorder|getUserMedia/u.test(read(file)),
    );
    expect(offenders).toEqual([]);
  });
});

describe("không lộ khóa/đặc quyền xuống trình duyệt", () => {
  const clientFiles = srcFiles.filter((file) => /^['"]use client['"]/u.test(read(file).trimStart()));

  it("có Client Component để kiểm tra", () => {
    expect(clientFiles.some((file) => file.startsWith("src/app/teacher/(console)/audio/"))).toBe(true);
  });

  it("Client Component không import khóa admin, Storage máy chủ, TTS hay đọc biến môi trường", () => {
    // Ngoại lệ DUY NHẤT cho TTS: `@/server/tts-library/actions` ("use server" — trình duyệt chỉ nhận cuống RPC, như audio-library/actions).
    const offenders = clientFiles.filter((file) =>
      /createSupabaseAdminClient|server\/audio-library\/(storage|deps|queries|http|upload)|@\/server\/tts(?!-library\/actions["'])|process\.env|TTS_|SUPABASE_SECRET|service_role/u.test(
        read(file),
      ),
    );
    expect(offenders).toEqual([]);
    expect(read("src/server/tts-library/actions.ts").trimStart()).toMatch(/^["']use server["']/u);
  });

  it("các mô-đun máy chủ của thư viện âm thanh đều import 'server-only' (trừ lõi thuần được kiểm thử)", () => {
    const pure = new Set([
      "src/server/audio-library/range.ts",
      "src/server/audio-library/upload.ts",
      "src/server/audio-library/actions.ts",
    ]);
    for (const file of srcFiles.filter((f) => f.startsWith("src/server/audio-library/") && !pure.has(f))) {
      expect(read(file), file).toMatch(/^import "server-only";/mu);
    }
    expect(read("src/server/audio-library/actions.ts")).toMatch(/^"use server";/u);
  });

  it("khóa đối tượng Storage không bao giờ được chọn để gửi xuống giao diện", () => {
    const queries = read("src/server/audio-library/queries.ts");
    const selects = [...queries.matchAll(/\.select\(\s*"([^"]+)"/gu)].map((m) => m[1] ?? "");
    expect(selects.length).toBeGreaterThan(0);
    for (const columns of selects) expect(columns).not.toMatch(/storage_key|storage_bucket|content_hash/u);
  });

  it("phản hồi phát lại tệp không cache, không đoán định dạng, không công khai", () => {
    const route = read("src/app/api/teacher/audio/versions/[versionId]/audio/route.ts");
    expect(route).toContain('"Cache-Control": "private, no-store"');
    expect(route).toContain('"X-Content-Type-Options": "nosniff"');
    expect(route).not.toMatch(/createSignedUrl|getPublicUrl/u);
    expect(read("src/server/audio-library/storage.ts")).not.toMatch(/createSignedUrl|getPublicUrl/u);
  });
});

describe("không tác vụ tự động / không đường học sinh", () => {
  it("không có tác vụ nền, cron hay vòng lặp tự ghi âm trong thư viện âm thanh", () => {
    const files = srcFiles.filter((file) => /audio-library|teacher\/\(console\)\/audio/u.test(file));
    expect(files.length).toBeGreaterThan(10);
    for (const file of files)
      expect(read(file), file).not.toMatch(/setTimeout\([^)]*start|cron|schedule|navigator\.sendBeacon/iu);
    const vercel = read("vercel.json");
    expect(vercel).not.toMatch(/audio/iu);
  });

  it("các Route Handler và Server Action âm thanh đều xác thực GV trước (thiết bị học sinh bị từ chối)", () => {
    for (const file of [
      "src/app/api/teacher/audio/versions/route.ts",
      "src/app/api/teacher/audio/versions/[versionId]/audio/route.ts",
      "src/server/audio-library/actions.ts",
    ]) {
      expect(read(file), file).toContain("teacherOrFail");
    }
    const http = read("src/server/audio-library/http.ts");
    expect(http).toMatch(/STUDENT_DEVICE[\s\S]*FORBIDDEN/u);
  });

  it("route tải lên kiểm tra cùng nguồn và giới hạn tần suất", () => {
    const route = read("src/app/api/teacher/audio/versions/route.ts");
    expect(route).toContain("isSameOrigin");
    expect(route).toContain("RATE_LIMITS.audioUpload");
  });
});

describe("migration R10.2", () => {
  const sql = read("supabase/migrations/20261031090000_r10_teacher_audio.sql");

  it("cờ hệ thống mặc định TẮT và không migration nào bật", () => {
    expect(sql).toMatch(/\('teacher_audio_recording_approved',\s*false/u);
    expect(sql).not.toMatch(/update\s+private\.feature_flags/iu);
  });

  it("RLS bật cho cả ba bảng và không có policy ghi", () => {
    for (const table of ["audio_voice_consents", "audio_assets", "audio_asset_versions"]) {
      expect(sql).toContain(`alter table public.${table} enable row level security;`);
    }
    expect(sql).not.toMatch(/create policy[^;]*for (insert|update|delete|all)/iu);
    expect(sql).not.toMatch(/grant (insert|update|delete)[^;]*to authenticated/iu);
  });

  it("không có bảng nào lưu âm thanh trong CSDL (không bytea/base64)", () => {
    expect(sql).not.toMatch(/\bbytea\b|base64/iu);
  });

  it("mọi hàm teacher_* là security definer có search_path cố định và chỉ authenticated/service_role gọi", () => {
    const fns = [...sql.matchAll(/create or replace function (public\.teacher_\w+)\(([\s\S]*?)\$\$/gu)];
    expect(fns.length).toBe(11);
    for (const [whole, name] of fns) {
      expect(whole, name).toMatch(/security definer/u);
      expect(whole, name).toMatch(/set search_path = ''/u);
      expect(sql, name).toContain(`${name}(`);
    }
    expect(sql).toMatch(/revoke all on function[\s\S]*from public, anon, authenticated;/u);
  });

  it("chỉ MỘT chỗ đặt trạng thái 'approved': hàm duyệt; chèn thẳng 'approved' bị trigger chặn", () => {
    const setters = [...sql.matchAll(/set status = 'approved'/gu)];
    expect(setters).toHaveLength(1);
    const reviewStart = sql.indexOf("function public.teacher_review_audio_version");
    const reviewEnd = sql.indexOf("function public.teacher_revoke_audio_version");
    expect(sql.indexOf("set status = 'approved'")).toBeGreaterThan(reviewStart);
    expect(sql.indexOf("set status = 'approved'")).toBeLessThan(reviewEnd);
    expect(sql).toContain("AUDIO_VERSION_MUST_START_DRAFT");
  });

  it("duyệt đòi hỏi đã nghe, cách đọc được xác nhận, khớp bản ghi và còn đồng ý dùng giọng", () => {
    const review = sql.slice(
      sql.indexOf("function public.teacher_review_audio_version"),
      sql.indexOf("function public.teacher_revoke_audio_version"),
    );
    for (const code of [
      "LISTEN_REQUIRED",
      "PRONUNCIATION_UNCONFIRMED",
      "LABEL_MISMATCH",
      "VOICE_CONSENT_REQUIRED",
      "STATE_CONFLICT",
    ]) {
      expect(review).toContain(code);
    }
  });

  it("nội dung phiên bản bất biến, bản ghi không xóa được, chuyển trạng thái theo máy trạng thái", () => {
    expect(sql).toContain("AUDIO_VERSION_IMMUTABLE");
    expect(sql).toContain("AUDIO_RECORD_NO_DELETE");
    expect(sql).toContain("AUDIO_INVALID_TRANSITION");
    expect(sql).toMatch(/old\.status = 'approved' and new\.status in \('superseded', 'revoked'\)/u);
  });

  it("nhật ký audit chỉ ghi UUID/mã (không tên tệp, khóa lưu trữ, nhãn)", () => {
    const audits = [...sql.matchAll(/write_audit\(([\s\S]*?)\);/gu)].map((m) => m[1] ?? "");
    expect(audits.length).toBeGreaterThanOrEqual(8);
    for (const call of audits)
      expect(call).not.toMatch(/storage_key|spoken_label|confirmed_label|display_name|note|reason/u);
  });
});
