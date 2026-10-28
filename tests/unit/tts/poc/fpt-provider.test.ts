import { describe, expect, it, vi } from "vitest";
import { checkSynthesizedAudio } from "@/server/tts/audio-check";
import { checkFptAudioUrl, createFptProvider, FPT_ENDPOINT, type FptDiagnostic } from "@/server/tts/fpt-provider";
import { createGoogleProvider } from "@/server/tts/providers";
import { CharBudget, synthesizeSpeech } from "@/server/tts/service";
import { wav } from "../../audio-library/fixtures";

const SECRET = "khoa-fpt-gia-lap-khong-that-987";
const GOOD_URL = "https://s3-ap-southeast-1.amazonaws.com/text2speech-v4/2026/abc.mp3";
const request = { text: "Con làm tốt lắm!", purpose: "feedback", voiceKey: "fpt-banmai", speed: "slow" } as const;
// Ghép lúc chạy để mã nguồn không chứa chuỗi giống email (repo-hygiene).
const AT = String.fromCharCode(64);
const noSleep = async () => {};

type Step = (url: string, init: RequestInit) => Response | Promise<Response>;

/** fetch giả: bước 1 là POST tới FPT; các bước sau là các lần hỏi tệp. */
function fakeFetch(...steps: Step[]) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const impl = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, init: init ?? {} });
    const step = steps[Math.min(calls.length - 1, steps.length - 1)]!;
    return step(url, init ?? {});
  });
  return { impl: impl as unknown as typeof fetch, calls };
}

const accepted = () => Response.json({ error: 0, async: GOOD_URL, message: "ok", request_id: "r1" });
const audioFile = () => new Response(new Uint8Array(wav(1)), { headers: { "content-type": "audio/mpeg" } });

function run(provider: ReturnType<typeof createFptProvider>, over: Record<string, unknown> = {}) {
  return synthesizeSpeech({
    provider,
    request: { ...request, ...over },
    budget: new CharBudget(1000),
    timeoutMs: 5000,
  });
}

describe("FPT.AI adapter (fetch giả — CHƯA kiểm chứng API thật)", () => {
  it("gửi đúng yêu cầu theo tài liệu v5: tiêu đề api_key/voice/speed/format, thân là văn bản, khóa không nằm trong URL/thân", async () => {
    const { impl, calls } = fakeFetch(accepted, audioFile);
    const provider = createFptProvider({ apiKey: SECRET, fetchImpl: impl, sleep: noSleep });
    const result = await run(provider);
    expect(result.ok).toBe(true);

    const post = calls[0]!;
    expect(post.url).toBe(FPT_ENDPOINT);
    expect(post.url).toBe("https://api.fpt.ai/hmi/tts/v5");
    expect(post.init.method).toBe("POST");
    expect(post.init.redirect).toBe("error");
    expect(post.init.headers).toMatchObject({ api_key: SECRET, voice: "banmai", speed: "-1", format: "mp3" });
    expect(post.init.body).toBe(request.text);
    expect(post.url).not.toContain(SECRET);
    expect(String(post.init.body)).not.toContain(SECRET);
    // Không dùng callback_url (cần địa chỉ công khai).
    expect(Object.keys(post.init.headers as object)).not.toContain("callback_url");
  });

  it("ánh xạ giọng và tốc độ: lannhi, bình thường = 0, wav", async () => {
    const { impl, calls } = fakeFetch(accepted, () => new Response(new Uint8Array(wav(1))));
    const provider = createFptProvider({ apiKey: SECRET, fetchImpl: impl, sleep: noSleep, format: "wav" });
    const result = await run(provider, { voiceKey: "fpt-lannhi", speed: "normal" });
    expect(calls[0]!.init.headers).toMatchObject({ voice: "lannhi", speed: "0", format: "wav" });
    expect(result.ok && result.data.mimeType).toBe("audio/wav");
  });

  it("tệp trả về qua kiểm tra định dạng theo nội dung (checkSynthesizedAudio)", async () => {
    const { impl } = fakeFetch(accepted, () => new Response(new Uint8Array(wav(1))));
    const provider = createFptProvider({ apiKey: SECRET, fetchImpl: impl, sleep: noSleep, format: "wav" });
    const result = await run(provider);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const checked = checkSynthesizedAudio(result.data);
    expect(checked.ok && checked.audio.mime).toBe("audio/wav");
    // MP3 được khai báo nhưng byte là WAV → bị từ chối, không lọt qua.
    expect(checkSynthesizedAudio({ ...result.data, mimeType: "audio/mpeg" })).toMatchObject({ ok: false });
  });

  it("tệp chưa sẵn sàng (403/404/rỗng) → hỏi lại, rồi nhận khi có; mọi lần hỏi đều redirect=error và có chờ", async () => {
    const sleeps: number[] = [];
    const { impl, calls } = fakeFetch(
      accepted,
      () => new Response(null, { status: 404 }),
      () => new Response(null, { status: 403 }),
      () => new Response(new Uint8Array(0)),
      audioFile,
    );
    const provider = createFptProvider({
      apiKey: SECRET,
      fetchImpl: impl,
      sleep: async (ms) => {
        sleeps.push(ms);
      },
    });
    const result = await run(provider);
    expect(result.ok).toBe(true);
    expect(calls).toHaveLength(5);
    for (const call of calls) expect(call.init.redirect).toBe("error");
    expect(calls.slice(1).every((call) => call.url === GOOD_URL)).toBe(true);
    expect(sleeps).toEqual([2000, 3000, 4000, 5000]);
  });

  it("số lần hỏi có giới hạn: hết lượt → TIMEOUT, không hỏi vô hạn", async () => {
    const reasons: FptDiagnostic[] = [];
    const { impl, calls } = fakeFetch(accepted, () => new Response(null, { status: 404 }));
    const provider = createFptProvider({
      apiKey: SECRET,
      fetchImpl: impl,
      sleep: noSleep,
      maxPolls: 3,
      onDiagnostic: (reason) => reasons.push(reason),
    });
    expect(await run(provider)).toEqual({ ok: false, code: "TIMEOUT" });
    expect(calls).toHaveLength(1 + 3);
    expect(reasons).toEqual(["AUDIO_NOT_READY_IN_TIME"]);
  });

  it("hết thời gian chờ tổng (hủy giữa lúc chờ) → TIMEOUT", async () => {
    const { impl } = fakeFetch(accepted, () => new Response(null, { status: 404 }));
    const provider = createFptProvider({
      apiKey: SECRET,
      fetchImpl: impl,
      sleep: (_ms, signal) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })));
        }),
    });
    const result = await synthesizeSpeech({ provider, request, budget: new CharBudget(1000), timeoutMs: 20 });
    expect(result).toEqual({ ok: false, code: "TIMEOUT" });
  });

  it("lỗi API → PROVIDER_ERROR, không lộ khóa, chẩn đoán chỉ là mã cố định", async () => {
    const cases: Array<{ steps: Step[]; reason: FptDiagnostic }> = [
      { steps: [() => new Response("x", { status: 500 })], reason: "HTTP_ERROR" },
      { steps: [() => new Response("x", { status: 429 })], reason: "HTTP_RATE_LIMITED" },
      { steps: [() => Response.json({ error: 1, message: SECRET })], reason: "API_ERROR" },
      { steps: [() => Response.json("chuoi")], reason: "BAD_RESPONSE" },
      { steps: [() => Response.json({ error: 0, message: "thieu async" })], reason: "URL_REJECTED" },
      { steps: [accepted, () => new Response("x", { status: 500 })], reason: "HTTP_ERROR" },
      {
        steps: [accepted, () => new Response("<xml/>", { headers: { "content-type": "text/xml" } })],
        reason: "BAD_RESPONSE",
      },
    ];
    for (const { steps, reason } of cases) {
      const seen: Array<[FptDiagnostic, string | undefined]> = [];
      const { impl } = fakeFetch(...steps);
      const provider = createFptProvider({
        apiKey: SECRET,
        fetchImpl: impl,
        sleep: noSleep,
        onDiagnostic: (r, d) => seen.push([r, d]),
      });
      const result = await run(provider);
      expect(result).toEqual({ ok: false, code: "PROVIDER_ERROR" });
      expect(seen[0]?.[0]).toBe(reason);
      expect(JSON.stringify([result, seen])).not.toContain(SECRET);
    }
  });

  it("lỗi mạng hoặc ngoại lệ chứa khóa → PROVIDER_ERROR, không lộ khóa", async () => {
    const impl = vi.fn(async () => {
      throw new Error(SECRET);
    }) as unknown as typeof fetch;
    const provider = createFptProvider({ apiKey: SECRET, fetchImpl: impl, sleep: noSleep });
    const result = await run(provider);
    expect(result).toEqual({ ok: false, code: "PROVIDER_ERROR" });
    expect(JSON.stringify(result)).not.toContain(SECRET);
  });

  it("tệp quá lớn (khai báo hoặc thực tế) bị từ chối", async () => {
    for (const makeFile of [
      () => new Response(new Uint8Array(10), { headers: { "content-length": "999999999" } }),
      () => new Response(new Uint8Array(5000)),
    ]) {
      const { impl } = fakeFetch(accepted, makeFile);
      const provider = createFptProvider({ apiKey: SECRET, fetchImpl: impl, sleep: noSleep, maxAudioBytes: 4000 });
      expect(await run(provider)).toEqual({ ok: false, code: "PROVIDER_ERROR" });
    }
  });

  it("không tải liên kết nguy hiểm: không có lần GET thứ hai và chẩn đoán chỉ có tên miền", async () => {
    const dangerous = [
      "http://s3-ap-southeast-1.amazonaws.com/a.mp3",
      "https://127.0.0.1/a.mp3",
      "https://169.254.169.254/latest/meta-data",
      "https://localhost/a.mp3",
      "https://[::1]/a.mp3",
      "https://evil.example.com/a.mp3",
      `https://s3-ap-southeast-1.amazonaws.com${AT}evil.example.com/a.mp3`,
      `https://user:pass${AT}s3-ap-southeast-1.amazonaws.com/a.mp3`,
      "https://s3-ap-southeast-1.amazonaws.com:8443/a.mp3",
      "https://fpt.ai.evil.example.com/a.mp3",
      "file:///etc/passwd",
    ];
    for (const link of dangerous) {
      const seen: Array<[FptDiagnostic, string | undefined]> = [];
      const { impl, calls } = fakeFetch(() => Response.json({ error: 0, async: link }));
      const provider = createFptProvider({
        apiKey: SECRET,
        fetchImpl: impl,
        sleep: noSleep,
        onDiagnostic: (r, d) => seen.push([r, d]),
      });
      expect(await run(provider), link).toEqual({ ok: false, code: "PROVIDER_ERROR" });
      expect(calls, link).toHaveLength(1);
      expect(seen[0]?.[0]).toBe("URL_REJECTED");
      expect(JSON.stringify(seen)).not.toContain("pass");
    }
  });

  it("chặn yêu cầu không hợp lệ trước khi gọi mạng: chữ < 3 ký tự, giọng của nhà khác, khóa giọng lạ", async () => {
    const { impl, calls } = fakeFetch(accepted, audioFile);
    const provider = createFptProvider({ apiKey: SECRET, fetchImpl: impl, sleep: noSleep });
    expect(await run(provider, { text: "bà" })).toEqual({ ok: false, code: "INVALID_INPUT" });
    expect(await run(provider, { voiceKey: "google-neural2-a" })).toEqual({ ok: false, code: "INVALID_INPUT" });
    expect(await run(provider, { voiceKey: "vi-female-1" })).toEqual({ ok: false, code: "INVALID_INPUT" });
    expect(await run(provider, { voiceKey: "khong-co" })).toEqual({ ok: false, code: "INVALID_INPUT" });
    expect(calls).toHaveLength(0);
  });
});

describe("checkFptAudioUrl", () => {
  it("chấp nhận liên kết S3 ap-southeast-1 và tên miền fpt.ai qua https, không cổng/tài khoản", () => {
    for (const ok of [
      GOOD_URL,
      "https://s3.ap-southeast-1.amazonaws.com/b/a.mp3",
      "https://bucket-1.s3-ap-southeast-1.amazonaws.com/a.mp3",
      "https://cdn.fpt.ai/a.mp3",
    ]) {
      expect(checkFptAudioUrl(ok), ok).not.toBeNull();
    }
  });

  it("từ chối kiểu không phải chuỗi, quá dài, không phân tích được", () => {
    expect(checkFptAudioUrl(undefined)).toBeNull();
    expect(checkFptAudioUrl(42)).toBeNull();
    expect(checkFptAudioUrl("")).toBeNull();
    expect(checkFptAudioUrl("khong-phai-url")).toBeNull();
    expect(checkFptAudioUrl(`https://cdn.fpt.ai/${"a".repeat(3000)}`)).toBeNull();
    expect(checkFptAudioUrl("https://s3-us-east-1.amazonaws.com/a.mp3")).toBeNull();
  });
});

describe("adapter Google với khóa giọng nghe thử (fetch giả)", () => {
  it("google-neural2-a/d ánh xạ Neural2-A/D; wav dùng LINEAR16 và nhãn audio/wav; khóa ở header", async () => {
    for (const [voiceKey, name] of [
      ["google-neural2-a", "vi-VN-Neural2-A"],
      ["google-neural2-d", "vi-VN-Neural2-D"],
    ] as const) {
      const fetchMock = vi.fn(async () => Response.json({ audioContent: Buffer.from(wav(1)).toString("base64") }));
      const provider = createGoogleProvider(SECRET, fetchMock as unknown as typeof fetch, "wav");
      const result = await synthesizeSpeech({
        provider,
        request: { ...request, voiceKey, speed: "normal" },
        budget: new CharBudget(1000),
      });
      expect(result.ok && result.data.mimeType).toBe("audio/wav");
      const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
      expect(JSON.parse(String(init.body))).toMatchObject({
        voice: { languageCode: "vi-VN", name },
        audioConfig: { audioEncoding: "LINEAR16", speakingRate: 1 },
      });
      expect((init.headers as Record<string, string>)["x-goog-api-key"]).toBe(SECRET);
    }
  });
});
