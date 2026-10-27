import { beforeEach, describe, expect, it, vi } from "vitest";
import { wav } from "../audio-library/fixtures";

/**
 * R10.3a — Route Handler phát âm thanh cho học sinh: xác thực, cùng nguồn, giới hạn tần suất, Range, tiêu đề riêng tư.
 * Dịch vụ và gateway được giả lập; logic điều kiện phát được kiểm trên Supabase thật ở tests/db/student-audio-playback.test.ts.
 */

const QID = "5b1c3a52-7a43-4c43-9a3e-0d8f6a1d2e11";
const BYTES = wav(1);

const mocks = vi.hoisted(() => ({
  studentContext: vi.fn(),
  limitDevice: vi.fn(),
  loadPlayableAudio: vi.fn(),
  audioStatus: vi.fn(),
}));

vi.mock("@/server/student-gateway/context", async () => {
  const actual = await vi.importActual<typeof import("@/server/student-gateway/context")>(
    "@/server/student-gateway/context",
  );
  return { ...actual, studentContext: mocks.studentContext, limitDevice: mocks.limitDevice };
});
vi.mock("@/server/audio-playback/service", () => ({
  loadPlayableAudio: mocks.loadPlayableAudio,
  audioStatus: mocks.audioStatus,
}));

import { GET as streamGet } from "@/app/api/student/question-instances/[id]/audio/[role]/route";
import { GET as statusGet } from "@/app/api/student/question-instances/[id]/audio/route";

const context = { ok: true, data: { authUserId: "u", students: [], admin: {} } };
const call = (role: string, headers: Record<string, string> = {}, id = QID) =>
  streamGet(new Request(`http://localhost/api/student/question-instances/${id}/audio/${role}`, { headers }), {
    params: Promise.resolve({ id, role }),
  } as never);

beforeEach(() => {
  mocks.studentContext.mockReset().mockResolvedValue(context);
  mocks.limitDevice.mockReset().mockResolvedValue({ ok: true, data: true });
  mocks.loadPlayableAudio.mockReset().mockResolvedValue({ ok: true, data: { bytes: BYTES, mimeType: "audio/wav" } });
  mocks.audioStatus.mockReset().mockResolvedValue({ ok: true, data: { muted: false, slots: {} } });
});

describe("GET …/audio/[role]", () => {
  it("thành công: 200, tiêu đề riêng tư (không cache, nosniff, cùng nguồn, sandbox), Accept-Ranges, đúng kiểu", async () => {
    const response = await call("stimulus");
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("audio/wav");
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(response.headers.get("Cross-Origin-Resource-Policy")).toBe("same-origin");
    expect(response.headers.get("Content-Security-Policy")).toBe("default-src 'none'; sandbox");
    expect(response.headers.get("Accept-Ranges")).toBe("bytes");
    expect(response.headers.get("Content-Length")).toBe(String(BYTES.byteLength));
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(BYTES);
    expect(mocks.loadPlayableAudio).toHaveBeenCalledWith(context.data, QID, "stimulus");
  });

  it("Range (Safari): 206 đúng đoạn + Content-Range; Range sai → 416", async () => {
    const partial = await call("model", { range: "bytes=0-9" });
    expect(partial.status).toBe(206);
    expect(partial.headers.get("Content-Range")).toBe(`bytes 0-9/${BYTES.byteLength}`);
    expect(partial.headers.get("Content-Length")).toBe("10");
    expect(new Uint8Array(await partial.arrayBuffer())).toEqual(BYTES.slice(0, 10));
    const tail = await call("stimulus", { range: "bytes=-4" });
    expect(tail.status).toBe(206);
    const bad = await call("stimulus", { range: `bytes=${BYTES.byteLength + 5}-` });
    expect(bad.status).toBe(416);
    expect(bad.headers.get("Content-Range")).toBe(`bytes */${BYTES.byteLength}`);
  });

  it("khe lạ hoặc mã không phải UUID → 404 JSON, không gọi dịch vụ", async () => {
    for (const [role, id] of [
      ["instruction", QID],
      ["../x", QID],
      ["stimulus", "khong-phai-uuid"],
    ] as const) {
      const response = await call(role, {}, id);
      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({ ok: false, code: "NOT_FOUND" });
    }
    expect(mocks.loadPlayableAudio).not.toHaveBeenCalled();
  });

  it("yêu cầu khác nguồn (nhúng từ trang web khác) → 403, không dịch vụ", async () => {
    const response = await call("stimulus", { "sec-fetch-site": "cross-site" });
    expect(response.status).toBe(403);
    expect(mocks.loadPlayableAudio).not.toHaveBeenCalled();
    expect((await call("stimulus", { origin: "https://khac.example" })).status).toBe(403);
  });

  it("chưa đăng nhập / thiết bị chưa liên kết → 401 trước mọi thao tác khác", async () => {
    mocks.studentContext.mockResolvedValue({ ok: false, code: "UNAUTHENTICATED" });
    const response = await call("stimulus");
    expect(response.status).toBe(401);
    expect(mocks.loadPlayableAudio).not.toHaveBeenCalled();
  });

  it("vượt giới hạn tần suất → 429, không đọc tệp", async () => {
    mocks.limitDevice.mockResolvedValue({ ok: false, code: "RATE_LIMITED" });
    const response = await call("stimulus");
    expect(response.status).toBe(429);
    expect(mocks.loadPlayableAudio).not.toHaveBeenCalled();
  });

  it.each([
    ["AUDIO_PLAYBACK_DISABLED", 403],
    ["AUDIO_NOT_PERMITTED", 403],
    ["AUDIO_NOT_AVAILABLE", 404],
    ["NOT_FOUND", 404],
    ["FORBIDDEN", 403],
    ["STORAGE_UNAVAILABLE", 503],
  ])("dịch vụ trả %s → HTTP %i, JSON không cache, không có tệp", async (code, status) => {
    mocks.loadPlayableAudio.mockResolvedValue({ ok: false, code });
    const response = await call("stimulus");
    expect(response.status).toBe(status);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(response.headers.get("Content-Type")).toContain("application/json");
    expect(await response.json()).toEqual({ ok: false, code });
  });
});

describe("GET …/audio (trạng thái)", () => {
  const status = (id = QID) =>
    statusGet(new Request(`http://localhost/api/student/question-instances/${id}/audio`), {
      params: Promise.resolve({ id }),
    } as never);

  it("trả JSON nhỏ không cache; mã sai → 404; chưa đăng nhập → 401", async () => {
    mocks.audioStatus.mockResolvedValue({
      ok: true,
      data: { muted: false, slots: { stimulus: { mimeType: "audio/wav" } } },
    });
    const response = await status();
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(await response.json()).toEqual({
      ok: true,
      data: { muted: false, slots: { stimulus: { mimeType: "audio/wav" } } },
    });
    expect((await status("sai")).status).toBe(404);
    mocks.studentContext.mockResolvedValue({ ok: false, code: "UNAUTHENTICATED" });
    expect((await status()).status).toBe(401);
  });
});
