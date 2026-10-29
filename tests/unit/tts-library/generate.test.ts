import { describe, expect, it, vi } from "vitest";
import { generateLine, mapTtsError, type GenerateDeps } from "@/server/tts-library/generate";
import { instructionEntryId, libraryEntry, LIBRARY_ENTRIES, type LibraryEntry } from "@/server/tts-library/entries";
import { LIBRARY_BULK_LIMIT, LIBRARY_CALL_CHAR_LIMIT, LIBRARY_VOICE } from "@/server/tts-library/voice";
import { fail, ok, type Result } from "@/server/result";
import type { TtsOutcome, TtsProvider, TtsRequest } from "@/server/tts/types";
import { wav } from "../audio-library/fixtures";

/**
 * Lõi tạo MỘT tệp giọng máy (R10.5): mọi điều kiện kiểm TRƯỚC khi gọi nhà cung cấp, chỉ gửi đúng chữ cố định, tệp kiểm theo nội dung, không
 * để tệp mồ côi, không bao giờ tự duyệt. Nhà cung cấp, Storage và CSDL đều là bản giả được tiêm vào — không mạng.
 */

const entry = (): LibraryEntry => libraryEntry(instructionEntryId("listen_letter"))!;

type Calls = {
  synthesize: TtsRequest[];
  put: Array<{ key: string; type: string; size: number }>;
  removed: string[];
  registered: Array<Parameters<GenerateDeps["register"]>[0]>;
};

function harness(over: Partial<GenerateDeps> & { outcome?: TtsOutcome } = {}) {
  const calls: Calls = { synthesize: [], put: [], removed: [], registered: [] };
  const outcome: TtsOutcome = over.outcome ?? { ok: true, data: { bytes: wav(1), mimeType: "audio/wav" } };
  const provider: TtsProvider = {
    id: "viettel",
    external: true,
    synthesize: async (request) => {
      calls.synthesize.push(request);
      return outcome;
    },
  };
  const deps: GenerateDeps = {
    schoolId: "11111111-1111-4111-8111-111111111111",
    provider,
    newId: () => "22222222-2222-4222-8222-222222222222",
    libraryEnabled: async () => ok(true),
    scriptApproved: async () => ok(true),
    liveVersionExists: async () => ok(false),
    putObject: async (key, bytes, type) => {
      calls.put.push({ key, type, size: bytes.byteLength });
      return ok(null);
    },
    removeObject: async (key) => void calls.removed.push(key),
    register: async (args) => {
      calls.registered.push(args);
      return ok({ versionNo: 1 });
    },
    ...over,
  };
  return { deps, calls };
}

describe("generateLine — điều kiện trước khi gọi nhà cung cấp", () => {
  it("thư viện chưa bật → TTS_LIBRARY_DISABLED, không gọi gì", async () => {
    const { deps, calls } = harness({ libraryEnabled: async () => ok(false) });
    expect(await generateLine(deps, entry())).toEqual(fail("TTS_LIBRARY_DISABLED"));
    expect(calls.synthesize).toHaveLength(0);
    expect(calls.put).toHaveLength(0);
  });

  it("lời đọc chưa được giáo viên duyệt → SCRIPT_NOT_APPROVED, KHÔNG gọi nhà cung cấp (không tốn chi phí)", async () => {
    const { deps, calls } = harness({ scriptApproved: async () => ok(false) });
    expect(await generateLine(deps, entry())).toEqual(fail("SCRIPT_NOT_APPROVED"));
    expect(calls.synthesize).toHaveLength(0);
  });

  it("đã có bản chờ duyệt/đang dùng cùng khóa tệp → ALREADY_GENERATED, không tạo trùng", async () => {
    const { deps, calls } = harness({ liveVersionExists: async () => ok(true) });
    expect(await generateLine(deps, entry())).toEqual(fail("ALREADY_GENERATED"));
    expect(calls.synthesize).toHaveLength(0);
  });

  it("chưa có nhà cung cấp (none) → NO_PROVIDER, không lưu gì", async () => {
    const { deps, calls } = harness();
    const none: TtsProvider = { id: "none", external: false, synthesize: vi.fn() };
    expect(await generateLine({ ...deps, provider: none }, entry())).toEqual(fail("NO_PROVIDER"));
    expect(none.synthesize).not.toHaveBeenCalled();
    expect(calls.put).toHaveLength(0);
  });

  it.each([
    ["cờ lỗi đọc", () => harness({ libraryEnabled: async () => fail("UNKNOWN") }), "UNKNOWN"],
    ["duyệt lỗi đọc", () => harness({ scriptApproved: async () => fail("UNKNOWN") }), "UNKNOWN"],
    ["tra bản sống lỗi đọc", () => harness({ liveVersionExists: async () => fail("UNKNOWN") }), "UNKNOWN"],
  ] as const)("%s → trả lỗi nguyên vẹn, không gọi nhà cung cấp", async (_name, make, code) => {
    const { deps, calls } = make();
    expect(await generateLine(deps, entry())).toEqual(fail(code));
    expect(calls.synthesize).toHaveLength(0);
  });
});

describe("generateLine — yêu cầu gửi đi", () => {
  it("chỉ gửi {chữ cố định, mục đích, giọng, tốc độ}; đúng một lần gọi; không có trường nào khác", async () => {
    const { deps, calls } = harness();
    const line = entry();
    const result = await generateLine(deps, line);
    expect(result.ok).toBe(true);
    expect(calls.synthesize).toHaveLength(1);
    expect(calls.synthesize[0]).toEqual({
      text: line.text,
      purpose: line.purpose,
      voiceKey: LIBRARY_VOICE.voiceKey,
      speed: LIBRARY_VOICE.speed,
    });
    expect(Object.keys(calls.synthesize[0]!).sort()).toEqual(["purpose", "speed", "text", "voiceKey"]);
  });

  it("MỌI lời đọc trong thư viện: không chứa dữ liệu học sinh (không số, không email, không tên riêng ghép sẵn) và vừa hạn mức một lần gọi", () => {
    for (const line of LIBRARY_ENTRIES) {
      expect(line.text.length, line.id).toBeGreaterThan(0);
      expect(line.text.length, line.id).toBeLessThanOrEqual(LIBRARY_CALL_CHAR_LIMIT);
      expect(line.text, line.id).not.toMatch(/\d|@|https?:|\{|\}|<|>/u);
      expect(line.text, line.id).toBe(line.text.normalize("NFC"));
    }
  });

  it("hạn mức một lần bấm 'tạo các lời còn thiếu' có trần cố định", () => {
    expect(LIBRARY_BULK_LIMIT).toBeGreaterThan(0);
    expect(LIBRARY_BULK_LIMIT).toBeLessThanOrEqual(10);
  });
});

describe("generateLine — kết quả", () => {
  it("thành công: lưu với khóa do máy chủ sinh từ UUID, đăng ký ở trạng thái chờ duyệt, báo thời lượng đo từ tệp", async () => {
    const { deps, calls } = harness();
    const result = await generateLine(deps, entry());
    expect(result).toEqual(ok({ versionId: "22222222-2222-4222-8222-222222222222", versionNo: 1, durationMs: 1000 }));
    expect(calls.put).toHaveLength(1);
    expect(calls.put[0]).toMatchObject({
      key: "11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222.wav",
      type: "audio/wav",
    });
    expect(calls.registered).toHaveLength(1);
    expect(calls.registered[0]).toMatchObject({
      versionId: "22222222-2222-4222-8222-222222222222",
      storageKey: calls.put[0]!.key,
      mimeType: "audio/wav",
      sizeBytes: calls.put[0]!.size,
      durationMs: 1000,
    });
    expect(calls.registered[0]!.contentSha256).toMatch(/^[0-9a-f]{64}$/u);
    expect(calls.removed).toHaveLength(0);
  });

  it("đăng ký lỗi → gỡ tệp vừa lưu (không để tệp mồ côi) và trả lỗi", async () => {
    const { deps, calls } = harness({ register: async () => fail("STATE_CONFLICT") });
    expect(await generateLine(deps, entry())).toEqual(fail("STATE_CONFLICT"));
    expect(calls.put).toHaveLength(1);
    expect(calls.removed).toEqual([calls.put[0]!.key]);
  });

  it("lưu lỗi → không đăng ký, không gỡ gì", async () => {
    const { deps, calls } = harness({ putObject: async () => fail("UNKNOWN") as Result<null> });
    expect(await generateLine(deps, entry())).toEqual(fail("UNKNOWN"));
    expect(calls.registered).toHaveLength(0);
    expect(calls.removed).toHaveLength(0);
  });

  it("tệp giả/hỏng bị loại theo NỘI DUNG (không tin loại tệp nhà cung cấp khai): không lưu, không đăng ký", async () => {
    const { deps, calls } = harness({
      outcome: { ok: true, data: { bytes: new TextEncoder().encode("khong phai am thanh"), mimeType: "audio/mpeg" } },
    });
    expect(await generateLine(deps, entry())).toEqual(fail("AUDIO_INVALID"));
    expect(calls.put).toHaveLength(0);
    expect(calls.registered).toHaveLength(0);
  });

  it("tệp rỗng bị loại", async () => {
    const { deps, calls } = harness({
      outcome: { ok: true, data: { bytes: new Uint8Array(), mimeType: "audio/wav" } },
    });
    expect(await generateLine(deps, entry())).toEqual(fail("AUDIO_INVALID"));
    expect(calls.put).toHaveLength(0);
  });

  it.each([
    ["TIMEOUT", "PROVIDER_ERROR"],
    ["PROVIDER_ERROR", "PROVIDER_ERROR"],
    ["BUDGET_EXCEEDED", "BUDGET_EXCEEDED"],
    ["NO_PROVIDER", "NO_PROVIDER"],
    ["PERSONAL_DATA_REJECTED", "INVALID_INPUT"],
    ["AUDIO_LEAKS_ANSWER", "INVALID_INPUT"],
  ] as const)(
    "lỗi nhà cung cấp %s → %s; chỉ MỘT lần gọi, không thử lại tự động, không lưu gì",
    async (provided, mapped) => {
      expect(mapTtsError(provided)).toBe(mapped);
      const { deps, calls } = harness({ outcome: { ok: false, code: provided } });
      expect(await generateLine(deps, entry())).toEqual(fail(mapped));
      expect(calls.synthesize.length).toBeLessThanOrEqual(1);
      expect(calls.put).toHaveLength(0);
      expect(calls.registered).toHaveLength(0);
    },
  );
});
