import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { wav } from "../audio-library/fixtures";

/**
 * R10.4 — Route Handler nghe chữ khi học: xác thực, cùng nguồn, giới hạn tần suất, Range, tiêu đề riêng tư, và việc
 * trình duyệt không chọn được tài nguyên ngoài danh mục. Dịch vụ được giả lập; điều kiện phát kiểm trên Supabase thật ở
 * tests/db/student-learning-audio.test.ts.
 */

const STUDENT = "5b1c3a52-7a43-4c43-9a3e-0d8f6a1d2e11";
const BYTES = wav(1);

const mocks = vi.hoisted(() => ({
  studentContext: vi.fn(),
  limitDevice: vi.fn(),
  loadLearningAudio: vi.fn(),
  learningAudioStatus: vi.fn(),
}));

vi.mock("@/server/student-gateway/context", async () => {
  const actual = await vi.importActual<typeof import("@/server/student-gateway/context")>(
    "@/server/student-gateway/context",
  );
  return { ...actual, studentContext: mocks.studentContext, limitDevice: mocks.limitDevice };
});
vi.mock("@/server/audio-playback/learning", () => ({
  loadLearningAudio: mocks.loadLearningAudio,
  learningAudioStatus: mocks.learningAudioStatus,
}));

import { GET as fileGet } from "@/app/api/student/learning-audio/[kind]/[unit]/route";
import { GET as statusGet } from "@/app/api/student/learning-audio/route";
import { STUDENT_RATE_LIMITS } from "@/server/student-gateway/context";

const context = { ok: true, data: { authUserId: "u", students: [], admin: {} } };
const file = (kind: string, unit: string, query = `?student=${STUDENT}`, headers: Record<string, string> = {}) =>
  fileGet(new Request(`http://localhost/api/student/learning-audio/${kind}/${unit}${query}`, { headers }), {
    params: Promise.resolve({ kind, unit }),
  } as never);
const status = (query = `?student=${STUDENT}`) =>
  statusGet(new Request(`http://localhost/api/student/learning-audio${query}`));

beforeEach(() => {
  mocks.studentContext.mockReset().mockResolvedValue(context);
  mocks.limitDevice.mockReset().mockResolvedValue({ ok: true, data: true });
  mocks.loadLearningAudio.mockReset().mockResolvedValue({ ok: true, data: { bytes: BYTES, mimeType: "audio/wav" } });
  mocks.learningAudioStatus.mockReset().mockResolvedValue({ ok: true, data: { muted: false, units: [] } });
});

describe("GET /api/student/learning-audio/[kind]/[unit]", () => {
  it("thành công: 200, tiêu đề riêng tư, Accept-Ranges; gọi dịch vụ với mã học sinh + loại + chữ đã giải mã", async () => {
    const response = await file("phoneme", "%C4%91"); // đ
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("audio/wav");
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(response.headers.get("Cross-Origin-Resource-Policy")).toBe("same-origin");
    expect(response.headers.get("Content-Security-Policy")).toBe("default-src 'none'; sandbox");
    expect(response.headers.get("Accept-Ranges")).toBe("bytes");
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(BYTES);
    expect(mocks.loadLearningAudio).toHaveBeenCalledWith(context.data, STUDENT, "phoneme", "đ");
  });

  it("Range (Safari): 206 đúng đoạn; Range sai → 416", async () => {
    const partial = await fileGet(
      new Request(`http://localhost/x?student=${STUDENT}`, { headers: { range: "bytes=0-9" } }),
      { params: Promise.resolve({ kind: "letter", unit: "b" }) } as never,
    );
    expect(partial.status).toBe(206);
    expect(partial.headers.get("Content-Range")).toBe(`bytes 0-9/${BYTES.byteLength}`);
    const bad = await fileGet(
      new Request(`http://localhost/x?student=${STUDENT}`, { headers: { range: `bytes=${BYTES.byteLength + 5}-` } }),
      { params: Promise.resolve({ kind: "letter", unit: "b" }) } as never,
    );
    expect(bad.status).toBe(416);
  });

  it("thiếu/sai mã học sinh hoặc chữ không giải mã được → 404, không gọi dịch vụ", async () => {
    for (const query of ["", "?student=khong-phai-uuid", "?student="]) {
      const response = await file("letter", "b", query);
      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({ ok: false, code: "NOT_FOUND" });
    }
    expect((await file("letter", "%E0%A4%A")).status).toBe(404);
    expect(mocks.loadLearningAudio).not.toHaveBeenCalled();
  });

  it("yêu cầu khác nguồn → 403, không dịch vụ", async () => {
    expect((await file("letter", "b", `?student=${STUDENT}`, { "sec-fetch-site": "cross-site" })).status).toBe(403);
    expect((await file("letter", "b", `?student=${STUDENT}`, { origin: "https://khac.example" })).status).toBe(403);
    expect(mocks.loadLearningAudio).not.toHaveBeenCalled();
  });

  it("chưa đăng nhập → 401; vượt tần suất (bucket riêng, không dùng chung với âm của câu) → 429; không đọc tệp", async () => {
    mocks.studentContext.mockResolvedValueOnce({ ok: false, code: "UNAUTHENTICATED" });
    expect((await file("letter", "b")).status).toBe(401);
    mocks.limitDevice.mockResolvedValueOnce({ ok: false, code: "RATE_LIMITED" });
    expect((await file("letter", "b")).status).toBe(429);
    expect(mocks.limitDevice).toHaveBeenLastCalledWith(context.data, STUDENT_RATE_LIMITS.learningAudio);
    expect(STUDENT_RATE_LIMITS.learningAudio.purpose).not.toBe(STUDENT_RATE_LIMITS.audio.purpose);
    expect(mocks.loadLearningAudio).not.toHaveBeenCalled();
  });

  it.each([
    ["AUDIO_PLAYBACK_DISABLED", 403],
    ["AUDIO_NOT_PERMITTED", 403],
    ["AUDIO_NOT_AVAILABLE", 404],
    ["FORBIDDEN", 403],
    ["NOT_FOUND", 404],
  ] as const)("dịch vụ trả %s → HTTP %i JSON, không rò tệp hay đường dẫn", async (code, httpStatus) => {
    mocks.loadLearningAudio.mockResolvedValue({ ok: false, code });
    const response = await file("letter", "b");
    expect(response.status).toBe(httpStatus);
    expect(await response.json()).toEqual({ ok: false, code });
  });
});

describe("GET /api/student/learning-audio (trạng thái)", () => {
  it("trả danh sách chữ/âm nghe được (chỉ loại, chữ, định dạng); giới hạn đọc", async () => {
    mocks.learningAudioStatus.mockResolvedValue({
      ok: true,
      data: { muted: false, units: [{ kind: "letter", text: "b", mimeType: "audio/wav" }] },
    });
    const response = await status();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      data: { muted: false, units: [{ kind: "letter", text: "b", mimeType: "audio/wav" }] },
    });
    expect(mocks.limitDevice).toHaveBeenCalledWith(context.data, STUDENT_RATE_LIMITS.read);
    expect(mocks.learningAudioStatus).toHaveBeenCalledWith(context.data, STUDENT);
  });

  it("mã học sinh sai → INVALID_INPUT; chưa đăng nhập → 401; không gọi dịch vụ", async () => {
    expect((await status("?student=abc")).status).toBe(400);
    mocks.studentContext.mockResolvedValueOnce({ ok: false, code: "UNAUTHENTICATED" });
    expect((await status()).status).toBe(401);
    expect(mocks.learningAudioStatus).not.toHaveBeenCalled();
  });
});

describe("quét mã: trình duyệt không chọn được tài nguyên ngoài danh mục", () => {
  const read = (path: string) => readFileSync(path, "utf8");

  it("route chỉ nhận mã học sinh + loại + chữ: không mã tài nguyên/phiên bản/đường dẫn/cách đọc từ trình duyệt", () => {
    for (const path of [
      "src/app/api/student/learning-audio/route.ts",
      "src/app/api/student/learning-audio/[kind]/[unit]/route.ts",
    ]) {
      const source = read(path);
      expect(source, path).not.toMatch(
        /assetId|versionId|asset_id|version_id|storageKey|storage_key|label|request\.json|formData/u,
      );
      expect(source, path).not.toMatch(/createSignedUrl|getPublicUrl|speechSynthesis|TTS_|@\/server\/tts/u);
    }
  });

  it("dịch vụ tra danh mục bằng learningUnitInfo, gọi hàm CSDL ở MỖI lần, không lưu bộ nhớ đệm, không import Storage công khai", () => {
    const service = read("src/server/audio-playback/learning.ts");
    expect(service).toMatch(/^import "server-only";/mu);
    expect(service).toContain("learningUnitInfo(");
    expect(service).toContain('rpc("gateway_resolve_learning_audio"');
    expect(service).toContain('rpc("gateway_list_learning_audio"');
    expect(service).not.toMatch(
      /new Map\(|const cache|unstable_cache|use cache|cacheLife|revalidate|createSignedUrl|getPublicUrl/u,
    );
    expect(service).toMatch(/sha256/u);
  });

  it("migration R10.4: chỉ đọc, không bật cờ nào, không mở bảng hay Storage cho học sinh", () => {
    const sql = read("supabase/migrations/20261102090000_r10_4_learning_audio.sql");
    expect(sql).not.toMatch(
      /insert\s+into\s+private\.feature_flags|update\s+private\.feature_flags|enabled\s*=\s*true/iu,
    );
    expect(sql).not.toMatch(/create\s+policy|storage\.objects|grant\s+select|grant\s+all/iu);
    expect(sql).toMatch(
      /grant execute on function public\.gateway_resolve_learning_audio\(uuid, uuid, text, text, text, text\) to service_role/u,
    );
    expect(sql).toMatch(
      /grant execute on function public\.gateway_list_learning_audio\(uuid, uuid, jsonb\) to service_role/u,
    );
    expect(sql).toMatch(/unit_kind in \('letter', 'phoneme', 'rime'\)/u);
  });
});
