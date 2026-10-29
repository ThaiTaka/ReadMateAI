import { describe, expect, it, vi } from "vitest";
import { checkSynthesizedAudio } from "@/server/tts/audio-check";
import { createTtsProvider, CharBudget, synthesizeSpeech } from "@/server/tts/service";
import {
  createViettelProvider,
  VIETTEL_ENDPOINT,
  VIETTEL_MAX_CHARS,
  type ViettelDiagnostic,
} from "@/server/tts/viettel-provider";
import { mp3, wav } from "../../audio-library/fixtures";

const TOKEN = "token-viettel-gia-lap-khong-that-4821";
const request = {
  text: "Con làm tốt lắm!",
  purpose: "feedback",
  voiceKey: "viettel-hcm-minhquan",
  speed: "normal",
} as const;

type Step = (url: string, init: RequestInit) => Response | Promise<Response>;

/** fetch giả: ghi lại mọi lần gọi; không bao giờ chạm mạng thật. */
function fakeFetch(step: Step) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const impl = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, init: init ?? {} });
    return step(url, init ?? {});
  });
  return { impl: impl as unknown as typeof fetch, calls };
}

const audioResponse = (bytes: Uint8Array = mp3(20), type = "audio/mpeg") =>
  new Response(new Uint8Array(bytes), { headers: { "content-type": type } });

function run(provider: ReturnType<typeof createViettelProvider>, over: Record<string, unknown> = {}, timeoutMs = 5000) {
  return synthesizeSpeech({ provider, request: { ...request, ...over }, budget: new CharBudget(10000), timeoutMs });
}

describe("Viettel AI adapter (fetch giả — CHƯA kiểm chứng API thật)", () => {
  it("gửi đúng yêu cầu: POST JSON tới endpoint, token ở tiêu đề `token`, mã giọng hcm-minhquan, mp3, không theo chuyển hướng", async () => {
    const { impl, calls } = fakeFetch(() => audioResponse());
    const result = await run(createViettelProvider({ token: TOKEN, fetchImpl: impl }));
    expect(result.ok).toBe(true);

    const call = calls[0]!;
    expect(call.url).toBe(VIETTEL_ENDPOINT);
    expect(call.url).toBe("https://viettelai.vn/tts/speech_synthesis");
    expect(call.init.method).toBe("POST");
    expect(call.init.redirect).toBe("error");
    expect(call.init.headers).toMatchObject({ "Content-Type": "application/json", token: TOKEN });
    expect(JSON.parse(String(call.init.body))).toEqual({
      speed: 1,
      voice: "hcm-minhquan",
      text: request.text,
      tts_return_option: 3,
      without_filter: false,
    });
    expect(calls).toHaveLength(1);
  });

  it("token chỉ ở tiêu đề: không nằm trong URL hay thân yêu cầu", async () => {
    const { impl, calls } = fakeFetch(() => audioResponse());
    await run(createViettelProvider({ token: TOKEN, fetchImpl: impl }));
    const call = calls[0]!;
    expect(call.url).not.toContain(TOKEN);
    expect(String(call.init.body)).not.toContain(TOKEN);
    expect(Object.keys(call.init.headers as object).filter((name) => name.toLowerCase() !== "token")).not.toContain(
      TOKEN,
    );
    expect(JSON.parse(String(call.init.body))).not.toHaveProperty("token");
  });

  it("tốc độ: bình thường = 1, chậm vừa = 0,9 (một bước chậm hơn trong dải 0,8–1,2)", async () => {
    const speeds: unknown[] = [];
    const { impl } = fakeFetch((_url, init) => {
      speeds.push((JSON.parse(String(init.body)) as { speed: unknown }).speed);
      return audioResponse();
    });
    const provider = createViettelProvider({ token: TOKEN, fetchImpl: impl });
    await run(provider, { speed: "normal" });
    await run(provider, { speed: "slow" });
    expect(speeds).toEqual([1, 0.9]);
  });

  it("trả MP3 qua kiểm tra định dạng theo nội dung (checkSynthesizedAudio); byte WAV khai là MP3 bị từ chối", async () => {
    const { impl } = fakeFetch(() => audioResponse(mp3(20)));
    const result = await run(createViettelProvider({ token: TOKEN, fetchImpl: impl }));
    expect(result.ok && result.data.mimeType).toBe("audio/mpeg");
    if (!result.ok) return;
    const checked = checkSynthesizedAudio(result.data);
    expect(checked.ok && checked.audio.mime).toBe("audio/mpeg");

    const { impl: wavImpl } = fakeFetch(() => audioResponse(wav(1)));
    const mislabeled = await run(createViettelProvider({ token: TOKEN, fetchImpl: wavImpl }));
    expect(mislabeled.ok).toBe(true);
    if (!mislabeled.ok) return;
    expect(checkSynthesizedAudio(mislabeled.data)).toMatchObject({ ok: false });
  });

  it("không tin HTTP 200: JSON/HTML/văn bản, nhãn không phải âm thanh, thân rỗng → PROVIDER_ERROR với mã chẩn đoán cố định", async () => {
    const cases: Array<{ response: () => Response; reason: ViettelDiagnostic }> = [
      {
        response: () => Response.json({ vi_message: "het luot", en_message: TOKEN }),
        reason: "API_ERROR",
      },
      {
        response: () => new Response('{"en_message":"quota"}', { headers: { "content-type": "audio/mpeg" } }),
        reason: "API_ERROR",
      },
      {
        response: () => new Response("<html></html>", { headers: { "content-type": "audio/mpeg" } }),
        reason: "API_ERROR",
      },
      { response: () => new Response("x", { headers: { "content-type": "text/html" } }), reason: "BAD_RESPONSE" },
      {
        response: () => new Response(new Uint8Array(0), { headers: { "content-type": "audio/mpeg" } }),
        reason: "EMPTY_AUDIO",
      },
    ];
    for (const { response, reason } of cases) {
      const seen: Array<[ViettelDiagnostic, string | undefined]> = [];
      const { impl } = fakeFetch(response);
      const provider = createViettelProvider({
        token: TOKEN,
        fetchImpl: impl,
        onDiagnostic: (r, d) => seen.push([r, d]),
      });
      const result = await run(provider);
      expect(result, reason).toEqual({ ok: false, code: "PROVIDER_ERROR" });
      expect(seen[0]?.[0]).toBe(reason);
      expect(JSON.stringify([result, seen])).not.toContain(TOKEN);
    }
  });

  it("lỗi HTTP: 401/403 = token, 429 = hết lượt, 5xx = lỗi nhà cung cấp; thân lỗi không được đọc hay đưa vào chẩn đoán", async () => {
    const cases: Array<[number, ViettelDiagnostic]> = [
      [401, "HTTP_UNAUTHORIZED"],
      [403, "HTTP_UNAUTHORIZED"],
      [429, "HTTP_RATE_LIMITED"],
      [400, "HTTP_ERROR"],
      [500, "HTTP_ERROR"],
      [503, "HTTP_ERROR"],
    ];
    for (const [status, reason] of cases) {
      const seen: Array<[ViettelDiagnostic, string | undefined]> = [];
      const { impl } = fakeFetch(() => new Response(JSON.stringify({ en_message: `echo ${TOKEN}` }), { status }));
      const provider = createViettelProvider({
        token: TOKEN,
        fetchImpl: impl,
        onDiagnostic: (r, d) => seen.push([r, d]),
      });
      const result = await run(provider);
      expect(result, String(status)).toEqual({ ok: false, code: "PROVIDER_ERROR" });
      expect(seen).toEqual([[reason, String(status)]]);
      expect(JSON.stringify([result, seen])).not.toContain(TOKEN);
    }
  });

  it("lỗi mạng hoặc ngoại lệ chứa token → PROVIDER_ERROR, không lộ token", async () => {
    const impl = vi.fn(async () => {
      throw new Error(`ECONNRESET ${TOKEN}`);
    }) as unknown as typeof fetch;
    const result = await run(createViettelProvider({ token: TOKEN, fetchImpl: impl }));
    expect(result).toEqual({ ok: false, code: "PROVIDER_ERROR" });
    expect(JSON.stringify(result)).not.toContain(TOKEN);
  });

  it("hết thời gian chờ: yêu cầu treo bị hủy bằng tín hiệu → TIMEOUT", async () => {
    const impl = vi.fn(
      (_input: string | URL | Request, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(Object.assign(new Error("aborted"), { name: "AbortError" })),
          );
        }),
    ) as unknown as typeof fetch;
    const result = await run(createViettelProvider({ token: TOKEN, fetchImpl: impl }), {}, 20);
    expect(result).toEqual({ ok: false, code: "TIMEOUT" });
  });

  it("hết thời gian chờ giữa lúc đọc thân phản hồi → TIMEOUT", async () => {
    const impl = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new Uint8Array([0xff, 0xfb]));
          init?.signal?.addEventListener("abort", () =>
            controller.error(Object.assign(new Error("aborted"), { name: "AbortError" })),
          );
        },
      });
      return new Response(body, { headers: { "content-type": "audio/mpeg" } });
    }) as unknown as typeof fetch;
    const result = await run(createViettelProvider({ token: TOKEN, fetchImpl: impl }), {}, 20);
    expect(result).toEqual({ ok: false, code: "TIMEOUT" });
  });

  it("giới hạn dung lượng: khai báo content-length quá trần, hoặc thực tế quá trần, đều bị từ chối", async () => {
    for (const makeFile of [
      () =>
        new Response(new Uint8Array(10), { headers: { "content-type": "audio/mpeg", "content-length": "999999999" } }),
      () => new Response(new Uint8Array(5000), { headers: { "content-type": "audio/mpeg" } }),
    ]) {
      const seen: ViettelDiagnostic[] = [];
      const { impl } = fakeFetch(makeFile);
      const provider = createViettelProvider({
        token: TOKEN,
        fetchImpl: impl,
        maxAudioBytes: 4000,
        onDiagnostic: (reason) => seen.push(reason),
      });
      expect(await run(provider)).toEqual({ ok: false, code: "PROVIDER_ERROR" });
      expect(seen).toEqual(["AUDIO_TOO_LARGE"]);
    }
  });

  it("chặn yêu cầu không hợp lệ trước khi gọi mạng: chữ trống/quá dài, giọng của nhà khác, khóa giọng lạ", async () => {
    const { impl, calls } = fakeFetch(() => audioResponse());
    const provider = createViettelProvider({ token: TOKEN, fetchImpl: impl });
    expect(await run(provider, { text: "" })).toEqual({ ok: false, code: "INVALID_INPUT" });
    expect(await run(provider, { text: "a".repeat(VIETTEL_MAX_CHARS + 1) })).toEqual({
      ok: false,
      code: "INVALID_INPUT",
    });
    expect(await run(provider, { voiceKey: "fpt-banmai" })).toEqual({ ok: false, code: "INVALID_INPUT" });
    expect(await run(provider, { voiceKey: "google-neural2-d" })).toEqual({ ok: false, code: "INVALID_INPUT" });
    expect(await run(provider, { voiceKey: "vi-female-1" })).toEqual({ ok: false, code: "INVALID_INPUT" });
    expect(await run(provider, { voiceKey: "khong-co" })).toEqual({ ok: false, code: "INVALID_INPUT" });
    expect(calls).toHaveLength(0);
  });

  it("trần ký tự đúng (300) được nhận", async () => {
    const { impl, calls } = fakeFetch(() => audioResponse());
    const provider = createViettelProvider({ token: TOKEN, fetchImpl: impl });
    expect((await run(provider, { text: "a".repeat(VIETTEL_MAX_CHARS) })).ok).toBe(true);
    expect(calls).toHaveLength(1);
  });
});

describe("TTS_PROVIDER=viettel", () => {
  it("chỉ tạo adapter khi có token; thiếu token hoặc rỗng → none (không lỗi khởi động)", () => {
    expect(createTtsProvider({ TTS_PROVIDER: "viettel", TTS_VIETTEL_TOKEN: TOKEN }).id).toBe("viettel");
    expect(createTtsProvider({ TTS_PROVIDER: "viettel" }).id).toBe("none");
    expect(createTtsProvider({ TTS_PROVIDER: "viettel", TTS_VIETTEL_TOKEN: "   " }).id).toBe("none");
    // Token của Viettel không mở nhà cung cấp khác.
    expect(createTtsProvider({ TTS_PROVIDER: "fpt", TTS_VIETTEL_TOKEN: TOKEN }).id).toBe("none");
  });
});
