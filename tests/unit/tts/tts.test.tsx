import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { AudioSlot } from "@/components/kid/audio-slot";
import { moduleOf, VARIANTS } from "@/features/exercises/registry";
import { validateExerciseItem } from "@/features/exercises/validation";
import { createGoogleProvider, createMockProvider, noneProvider } from "@/server/tts/providers";
import { checkTtsRequest } from "@/server/tts/request";
import { CharBudget, createTtsProvider, planSlotSynthesis, synthesizeSpeech, ttsCacheKey } from "@/server/tts/service";
import type { TtsProvider, TtsRequest } from "@/server/tts/types";
import { clone, demoValidation, firstItem, kb } from "../exercises/helpers";

const good: TtsRequest = {
  text: "Con nhìn hình rồi chọn nhé.",
  purpose: "instruction",
  voiceKey: "vi-female-1",
  speed: "slow",
};
const budget = () => new CharBudget(1000);

describe("TtsProvider — mock và chế độ none", () => {
  it("mock provider tạo tệp giả và ghi nhận lời gọi", async () => {
    const mock = createMockProvider();
    const result = await synthesizeSpeech({ provider: mock, request: good, budget: budget() });
    expect(result.ok).toBe(true);
    expect(mock.calls).toHaveLength(1);
  });

  it("chế độ none không gọi mạng và trả NO_PROVIDER", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const result = await synthesizeSpeech({ provider: noneProvider, request: good, budget: budget() });
    expect(result).toEqual({ ok: false, code: "NO_PROVIDER" });
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("thiếu khóa API hoặc giá trị lạ → none, không ném lỗi", () => {
    expect(createTtsProvider({}).id).toBe("none");
    expect(createTtsProvider({ TTS_PROVIDER: "google" }).id).toBe("none");
    expect(createTtsProvider({ TTS_PROVIDER: "google", TTS_GOOGLE_API_KEY: "  " }).id).toBe("none");
    expect(createTtsProvider({ TTS_PROVIDER: "khong-biet" }).id).toBe("none");
    expect(createTtsProvider({ TTS_PROVIDER: "google", TTS_GOOGLE_API_KEY: "khoa-gia-lap-1234" }).id).toBe("google");
  });
});

describe("kiểm tra đầu vào", () => {
  it("từ chối đầu vào không hợp lệ", () => {
    for (const bad of [
      null,
      {},
      { ...good, text: "" },
      { ...good, text: "a".repeat(301) },
      { ...good, purpose: "phoneme" },
      { ...good, purpose: "rime" },
      { ...good, voiceKey: "giong-la" },
      { ...good, speed: "fast" },
    ]) {
      expect(checkTtsRequest(bad), JSON.stringify(bad)).toEqual({ ok: false, code: "INVALID_INPUT" });
    }
  });

  it("không nhận trường dữ liệu học sinh (strict) và từ chối chữ giống dữ liệu cá nhân", () => {
    expect(checkTtsRequest({ ...good, studentId: "x" }).ok).toBe(false);
    expect(checkTtsRequest({ ...good, alias: "Bé Na" }).ok).toBe(false);
    const email = ["me", "ex.vn"].join("@");
    const phone = "0" + "912345678";
    for (const text of [email, `Gọi ${phone}`, "https://vi.example", "AB12-CD34", "<speak>x</speak>"]) {
      expect(checkTtsRequest({ ...good, text }), text).toEqual({ ok: false, code: "PERSONAL_DATA_REJECTED" });
    }
  });

  it("chuẩn hóa NFC", () => {
    const nfd = "Con bá xin chào".normalize("NFD");
    const checked = checkTtsRequest({ ...good, text: nfd });
    expect(checked.ok && checked.data.text).toBe(nfd.normalize("NFC"));
  });

  it("đầu vào sai không bao giờ tới nhà cung cấp và không trừ hạn mức", async () => {
    const mock = createMockProvider();
    const limited = new CharBudget(100);
    expect(await synthesizeSpeech({ provider: mock, request: { ...good, text: "" }, budget: limited })).toEqual({
      ok: false,
      code: "INVALID_INPUT",
    });
    expect(mock.calls).toHaveLength(0);
    expect(limited.remaining).toBe(100);
  });
});

describe("lỗi, timeout và hạn mức", () => {
  it("lỗi nhà cung cấp, ngoại lệ → mã lỗi an toàn, không lộ nội dung", async () => {
    const failing = createMockProvider({ fail: "PROVIDER_ERROR" });
    expect(await synthesizeSpeech({ provider: failing, request: good, budget: budget() })).toEqual({
      ok: false,
      code: "PROVIDER_ERROR",
    });
    const throwing: TtsProvider = {
      id: "mock",
      external: false,
      synthesize: async () => {
        throw new Error("khoa-bi-mat-giong-that và nội dung " + good.text);
      },
    };
    const result = await synthesizeSpeech({ provider: throwing, request: good, budget: budget() });
    expect(result).toEqual({ ok: false, code: "PROVIDER_ERROR" });
    expect(JSON.stringify(result)).not.toContain("khoa-bi-mat");
  });

  it("timeout: nhà cung cấp treo bị hủy", async () => {
    const hanging: TtsProvider = {
      id: "google",
      external: true,
      synthesize: (_request, { signal }) =>
        new Promise((resolve) => signal.addEventListener("abort", () => resolve({ ok: false, code: "TIMEOUT" }))),
    };
    expect(await synthesizeSpeech({ provider: hanging, request: good, budget: budget(), timeoutMs: 20 })).toEqual({
      ok: false,
      code: "TIMEOUT",
    });
  });

  it("hạn mức ký tự của lô chặn chi phí phát sinh", async () => {
    const mock = createMockProvider();
    const tiny = new CharBudget(good.text.length);
    expect((await synthesizeSpeech({ provider: mock, request: good, budget: tiny })).ok).toBe(true);
    expect(await synthesizeSpeech({ provider: mock, request: good, budget: tiny })).toEqual({
      ok: false,
      code: "BUDGET_EXCEEDED",
    });
    expect(mock.calls).toHaveLength(1);
  });

  it("khóa dùng lại ổn định và đổi khi đổi giọng/nhà cung cấp", () => {
    expect(ttsCacheKey(good, "google")).toBe(ttsCacheKey({ ...good }, "google"));
    expect(ttsCacheKey(good, "google")).not.toBe(ttsCacheKey({ ...good, voiceKey: "vi-male-1" }, "google"));
    expect(ttsCacheKey(good, "google")).not.toBe(ttsCacheKey(good, "mock"));
  });
});

describe("adapter Google (fetch giả — chưa kiểm chứng API thật)", () => {
  const secret = "khoa-gia-lap-khong-that-123";

  it("gửi đúng hình dạng yêu cầu, khóa ở header, không có dữ liệu học sinh", async () => {
    const fetchMock = vi.fn(async () => Response.json({ audioContent: Buffer.from("abc").toString("base64") }));
    const provider = createGoogleProvider(secret, fetchMock as unknown as typeof fetch);
    const result = await synthesizeSpeech({ provider, request: good, budget: budget() });
    expect(result.ok && new TextDecoder().decode(result.data.bytes)).toBe("abc");
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://texttospeech.googleapis.com/v1/text:synthesize");
    expect(url).not.toContain(secret);
    expect((init.headers as Record<string, string>)["x-goog-api-key"]).toBe(secret);
    expect(init.redirect).toBe("error");
    const body = JSON.parse(String(init.body)) as Record<string, unknown>;
    expect(body).toEqual({
      input: { text: good.text },
      voice: { languageCode: "vi-VN", name: "vi-VN-Neural2-A" },
      audioConfig: { audioEncoding: "MP3", speakingRate: 0.8 },
    });
  });

  it("HTTP lỗi, phản hồi sai dạng, mạng lỗi → PROVIDER_ERROR; hủy → TIMEOUT; không lộ khóa", async () => {
    const cases: Array<() => Promise<Response>> = [
      async () => new Response("loi", { status: 500 }),
      async () => Response.json({ khac: 1 }),
      async () => Response.json({ audioContent: "" }),
      async () => {
        throw new Error(secret);
      },
    ];
    for (const makeResponse of cases) {
      const provider = createGoogleProvider(secret, makeResponse as unknown as typeof fetch);
      const result = await synthesizeSpeech({ provider, request: good, budget: budget() });
      expect(result).toEqual({ ok: false, code: "PROVIDER_ERROR" });
      expect(JSON.stringify(result)).not.toContain(secret);
    }
    const aborting = vi.fn(async () => {
      throw Object.assign(new Error("aborted"), { name: "AbortError" });
    });
    const provider = createGoogleProvider(secret, aborting as unknown as typeof fetch);
    expect(await synthesizeSpeech({ provider, request: good, budget: budget() })).toEqual({
      ok: false,
      code: "TIMEOUT",
    });
  });
});

describe("chính sách chống lộ đáp án áp lên TTS (AD-35)", () => {
  const planFor = (item: ReturnType<typeof firstItem>, role: "instruction" | "stimulus" | "model") => {
    const slot = item.audio[role];
    if (!slot) throw new Error(`thiếu khe ${role}`);
    const variant = VARIANTS[item.variant];
    return planSlotSynthesis({
      role,
      slot,
      policy: variant.audioPolicy,
      exposure: moduleOf(item).audioExposure(item, kb),
    });
  };

  it("âm đơn lẻ (nghe âm – chọn chữ) bắt buộc bản ghi GV, không dùng TTS", () => {
    const item = firstItem("listen_letter", "foundation");
    const stimulus = { spokenText: "bờ", assetId: null };
    const plan = planSlotSynthesis({
      role: "stimulus",
      slot: stimulus,
      policy: VARIANTS.listen_letter.audioPolicy,
      exposure: { forbidden: [] },
    });
    expect(plan).toEqual({ ok: false, code: "TEACHER_RECORDING_REQUIRED" });
    expect(item.audio.instruction.spokenText.length).toBeGreaterThan(0);
  });

  it("bài đọc từ: không được tạo âm thanh kích thích; câu lệnh chuẩn thì được", () => {
    const item = clone(firstItem("choose_picture"));
    item.audio.stimulus = { spokenText: item.content.word, assetId: null };
    expect(planFor(item, "stimulus")).toEqual({ ok: false, code: "AUDIO_ROLE_FORBIDDEN" });
    expect(planFor(item, "instruction")).toEqual({ ok: true, purpose: "instruction" });
  });

  it("câu lệnh đọc to từ cần đọc → chặn AUDIO_LEAKS_ANSWER; âm thanh mẫu sau chấm vẫn được", () => {
    const item = clone(firstItem("choose_picture"));
    item.audio.instruction = { spokenText: `Con hãy đọc ${item.content.word}`, assetId: null };
    expect(planFor(item, "instruction")).toEqual({ ok: false, code: "AUDIO_LEAKS_ANSWER" });
    expect(planFor(item, "model")).toEqual({ ok: true, purpose: "model" });
  });
});

describe("chưa duyệt thì không phát âm thanh thật", () => {
  it("AudioSlot luôn khóa, không có thẻ audio", () => {
    const { container } = render(<AudioSlot label="Nghe câu lệnh" />);
    expect(screen.getByRole("button")).toBeDisabled();
    expect(container.querySelector("audio")).toBeNull();
  });

  it("MISSING_AUDIO của bài nghe âm giữ nguyên; tạo TTS giả không thay đổi kết quả kiểm tra", async () => {
    const item = firstItem("listen_letter", "foundation");
    const before = validateExerciseItem(item, demoValidation("foundation"));
    expect(before.issues.map((entry) => entry.code)).toContain("MISSING_AUDIO");
    await synthesizeSpeech({ provider: createMockProvider(), request: good, budget: budget() });
    const after = validateExerciseItem(item, demoValidation("foundation"));
    expect(after.issues).toEqual(before.issues);
  });
});

describe("secret không tới trình duyệt", () => {
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.(ts|tsx)$/u.test(name)) files.push(full);
    }
  };
  walk(join(process.cwd(), "src"));
  const outside = files.filter((file) => !file.replaceAll("\\", "/").includes("/src/server/tts/"));

  it("mô-đun TTS khai báo server-only và chỉ nó đọc biến môi trường TTS", () => {
    expect(readFileSync(join(process.cwd(), "src/server/tts/service.ts"), "utf8")).toContain('import "server-only"');
    for (const file of outside) expect(readFileSync(file, "utf8"), file).not.toMatch(/TTS_GOOGLE_API_KEY/u);
  });

  it("không tệp 'use client' nào import mô-đun TTS", () => {
    for (const file of outside) {
      const text = readFileSync(file, "utf8");
      if (/^\s*["']use client["']/mu.test(text)) expect(text, file).not.toMatch(/server\/tts/u);
    }
  });

  it("không dùng Web Speech API", () => {
    for (const file of files)
      expect(readFileSync(file, "utf8"), file).not.toMatch(/speechSynthesis|SpeechSynthesisUtterance/u);
  });
});
