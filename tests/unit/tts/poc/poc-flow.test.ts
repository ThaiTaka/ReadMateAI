import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildTtsScriptCatalog } from "@/server/tts/catalog";
import { sha256Hex } from "@/server/tts/hash";
import { emptyManifest, pocManifestSchema, requestKeyOf } from "@/server/tts/poc/manifest";
import {
  COST_CONFIRM_ENV,
  decidePocMode,
  FPT_KEY_ENV,
  GOOGLE_KEY_ENV,
  parsePocArgs,
  VIETTEL_KEY_ENV,
  type PocCliOptions,
} from "@/server/tts/poc/options";
import { planPocRun, POC_MAX_CHARS_PER_RUN, POC_MAX_REQUESTS_PER_RUN } from "@/server/tts/poc/plan";
import { POC_MAX_CONSECUTIVE_FAILURES, runPocJobs } from "@/server/tts/poc/run";
import {
  ALL_POC_SENTENCES,
  POC_CATALOG_SENTENCES,
  POC_DIAGNOSTIC_SENTENCES,
  POC_SENTENCE_SETS,
} from "@/server/tts/poc/sentences";
import { servePocSample } from "@/server/tts/poc/serve";
import { createFsPocStore, readPocManifest } from "@/server/tts/poc/store";
import { DEFAULT_POC_VOICES, POC_VOICES, POC_VOICE_KEYS } from "@/server/tts/poc/voices";
import { TTS_VOICE_KEYS } from "@/server/tts/voice";
import type { TtsProvider } from "@/server/tts/types";
import { mp3, wav } from "../../audio-library/fixtures";

const base: PocCliOptions = {
  live: false,
  voices: ["viettel-hcm-minhquan"],
  set: "catalog",
  speed: "normal",
  format: "mp3",
  maxRequests: undefined,
};

describe("bộ câu nghe thử", () => {
  it("6 câu catalog khớp CHỮ trong danh mục 34 lời đọc và ≤ 60 ký tự", () => {
    const catalog = buildTtsScriptCatalog();
    expect(catalog.entries).toHaveLength(34);
    expect(POC_CATALOG_SENTENCES).toHaveLength(6);
    for (const sentence of POC_CATALOG_SENTENCES) {
      const entry = catalog.entries.find((candidate) => candidate.id === sentence.catalogId);
      expect(entry, sentence.id).toBeDefined();
      expect(sentence.text, sentence.id).toBe(entry!.text);
      expect(sentence.purpose).toBe(entry!.purpose);
    }
  });

  it("câu chẩn đoán KHÔNG nằm trong danh mục học liệu và không có catalogId", () => {
    const catalog = buildTtsScriptCatalog();
    for (const sentence of POC_DIAGNOSTIC_SENTENCES) {
      expect(sentence.catalogId).toBeNull();
      expect(sentence.kind).toBe("diagnostic");
      expect(catalog.entries.some((entry) => entry.text === sentence.text)).toBe(false);
    }
    expect(POC_DIAGNOSTIC_SENTENCES[0]!.text).toBe("bà, bá, mẹ, nhà");
  });

  it("id câu là duy nhất và không câu nào có dữ liệu giống thông tin cá nhân (đi qua cùng kiểm tra yêu cầu)", () => {
    expect(new Set(ALL_POC_SENTENCES.map((sentence) => sentence.id)).size).toBe(ALL_POC_SENTENCES.length);
    for (const sentence of ALL_POC_SENTENCES) expect(sentence.text).toBe(sentence.text.normalize("NFC"));
  });

  it("khóa giọng nghe thử tách khỏi khóa giọng sản xuất", () => {
    for (const key of POC_VOICE_KEYS) expect((TTS_VOICE_KEYS as readonly string[]).includes(key)).toBe(false);
    expect(POC_VOICES["viettel-hcm-minhquan"]).toMatchObject({
      provider: "viettel",
      providerVoice: "hcm-minhquan",
      gender: "male",
      region: "south",
    });
    expect(DEFAULT_POC_VOICES).toEqual(["viettel-hcm-minhquan"]);
    expect(POC_VOICES["fpt-banmai"]).toMatchObject({ providerVoice: "banmai", gender: "female", region: "north" });
    expect(POC_VOICES["fpt-lannhi"]).toMatchObject({ providerVoice: "lannhi", gender: "female", region: "south" });
    expect(POC_VOICES["google-neural2-a"].providerVoice).toBe("vi-VN-Neural2-A");
    expect(POC_VOICES["google-neural2-d"].gender).toBe("male");
  });
});

describe("kế hoạch và giới hạn chi phí", () => {
  const plan = (over: Partial<Parameters<typeof planPocRun>[0]> = {}) =>
    planPocRun({
      voices: ["fpt-banmai", "fpt-lannhi"],
      set: "catalog",
      speed: "normal",
      format: "mp3",
      existingKeys: new Set(),
      ...over,
    });

  it("lần chạy mặc định (giọng nam miền Nam Viettel): 6 câu × 1 giọng = 6 lần gọi, trong hạn mức ký tự", () => {
    const result = plan({ voices: base.voices });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.jobs).toHaveLength(6);
    expect(result.jobs.every((job) => job.voice.provider === "viettel")).toBe(true);
    expect(result.chars).toBeLessThanOrEqual(POC_MAX_CHARS_PER_RUN);
  });

  it("đối chiếu hai giọng FPT.AI cũ vẫn đủ: 6 câu × 2 giọng = 12 lần gọi, trong hạn mức ký tự", () => {
    const result = plan();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.jobs).toHaveLength(12);
    expect(result.chars).toBeLessThanOrEqual(POC_MAX_CHARS_PER_RUN);
    expect(new Set(result.jobs.map((job) => job.requestKey)).size).toBe(12);
  });

  it("từ chối 3 giọng × 6 câu (18 > 12): không có đường chạy hàng loạt, và không thể nâng trần bằng tham số", () => {
    expect(plan({ voices: ["fpt-banmai", "fpt-lannhi", "fpt-thuminh"] })).toEqual({
      ok: false,
      code: "LIMIT_REQUESTS",
    });
    expect(plan({ voices: ["fpt-banmai", "fpt-lannhi", "fpt-thuminh"], maxRequests: 1000 })).toEqual({
      ok: false,
      code: "LIMIT_REQUESTS",
    });
    expect(POC_MAX_REQUESTS_PER_RUN).toBe(12);
  });

  it("có thể HẠ trần: --max-requests 5 từ chối kế hoạch 12", () => {
    expect(plan({ maxRequests: 5 })).toEqual({ ok: false, code: "LIMIT_REQUESTS" });
  });

  it("giọng trùng chỉ tính một; không giọng / giọng lạ bị từ chối", () => {
    const result = plan({ voices: ["fpt-banmai", "fpt-banmai"] });
    expect(result.ok && result.jobs).toHaveLength(6);
    expect(plan({ voices: [] })).toEqual({ ok: false, code: "NO_VOICES" });
    expect(plan({ voices: ["giong-la"] })).toEqual({ ok: false, code: "UNKNOWN_VOICE" });
  });

  it("chống trùng: yêu cầu đã có tệp (cùng khóa) chuyển sang `cached`, không gọi lại; đổi tốc độ/định dạng là yêu cầu mới", () => {
    const first = plan();
    if (!first.ok) throw new Error("kế hoạch lỗi");
    const existing = new Set(first.jobs.slice(0, 4).map((job) => job.requestKey));
    const again = plan({ existingKeys: existing });
    expect(again.ok && again.jobs).toHaveLength(8);
    expect(again.ok && again.cached).toHaveLength(4);
    const slow = plan({ speed: "slow", existingKeys: existing });
    expect(slow.ok && slow.cached).toHaveLength(0);
    const wavPlan = plan({ format: "wav", existingKeys: existing });
    expect(wavPlan.ok && wavPlan.cached).toHaveLength(0);
  });

  it("bộ chẩn đoán chỉ 1 câu × số giọng", () => {
    const result = plan({ set: "diagnostic" });
    expect(result.ok && result.jobs).toHaveLength(2);
    expect(POC_SENTENCE_SETS.diagnostic).toHaveLength(1);
  });

  it("khóa yêu cầu ổn định, chuẩn hóa NFC, đổi theo từng thành phần", () => {
    const k = (over = {}) =>
      requestKeyOf({ provider: "fpt", voiceKey: "fpt-banmai", speed: "slow", format: "mp3", text: "mẹ", ...over });
    expect(k()).toBe(k({ text: "mẹ" }));
    expect(k({ text: "mẹ".normalize("NFD") })).toBe(k());
    for (const over of [{ provider: "google" }, { voiceKey: "fpt-lannhi" }, { speed: "normal" }, { format: "wav" }]) {
      expect(k(over)).not.toBe(k());
    }
  });
});

describe("đối số và chế độ chạy", () => {
  it("mặc định là chạy khô, giọng Viettel Minh Quân (nam, miền Nam), tốc độ bình thường", () => {
    const parsed = parsePocArgs([]);
    expect(parsed.ok && parsed.options).toEqual(base);
    expect(decidePocMode(base, {})).toEqual({ mode: "dry", reason: "NOT_LIVE" });
    // Có đủ khóa và xác nhận nhưng không có --live → vẫn chạy khô.
    expect(decidePocMode(base, { [FPT_KEY_ENV]: "k", [COST_CONFIRM_ENV]: "yes" }).mode).toBe("dry");
  });

  it("--live thiếu xác nhận chi phí → từ chối (kể cả khi có khóa)", () => {
    const live = { ...base, live: true };
    expect(decidePocMode(live, { [FPT_KEY_ENV]: "k" })).toEqual({ mode: "refused", reason: "COST_NOT_CONFIRMED" });
    expect(decidePocMode(live, { [FPT_KEY_ENV]: "k", [COST_CONFIRM_ENV]: "true" }).mode).toBe("refused");
    expect(decidePocMode(live, { [FPT_KEY_ENV]: "k", [COST_CONFIRM_ENV]: "1" }).mode).toBe("refused");
  });

  it("--live đã xác nhận nhưng thiếu khóa → no_keys (CHƯA THỬ API THẬT), không gọi mạng", () => {
    const live = { ...base, live: true };
    expect(decidePocMode(live, { [COST_CONFIRM_ENV]: "yes" })).toEqual({ mode: "no_keys", missing: ["viettel"] });
    // Khóa của nhà khác không mở giọng Viettel; token rỗng/sai dạng (khoảng trắng, quá ngắn, ký tự lạ) coi như chưa có.
    expect(decidePocMode(live, { [COST_CONFIRM_ENV]: "yes", [FPT_KEY_ENV]: "khoa-fpt-1234" }).mode).toBe("no_keys");
    for (const bad of [
      "   ",
      "ngan",
      "co khoang trang 12345",
      `ky-tu-la-${String.fromCharCode(233)}-12345`,
      "a".repeat(600),
    ]) {
      expect(decidePocMode(live, { [COST_CONFIRM_ENV]: "yes", [VIETTEL_KEY_ENV]: bad }).mode, bad).toBe("no_keys");
    }
    expect(decidePocMode(live, { [COST_CONFIRM_ENV]: "yes", [VIETTEL_KEY_ENV]: "token-gia-lap-12345" })).toMatchObject({
      mode: "live",
      voices: ["viettel-hcm-minhquan"],
    });
  });

  it("chỉ chạy các giọng có khóa; giọng thiếu khóa bị bỏ qua", () => {
    const mode = decidePocMode(
      { ...base, live: true, voices: ["fpt-banmai", "google-neural2-a"] },
      { [COST_CONFIRM_ENV]: "yes", [GOOGLE_KEY_ENV]: "g" },
    );
    expect(mode).toMatchObject({ mode: "live", voices: ["google-neural2-a"], skippedVoices: ["fpt-banmai"] });
  });

  it("đối số sai bị từ chối", () => {
    for (const argv of [
      ["--voices", "fpt-banmai,khong-co"],
      ["--speed", "fast"],
      ["--format", "ogg"],
      ["--set", "all"],
      ["--max-requests", "0"],
      ["--max-requests", "abc"],
      ["--tat-ca"],
      // Viettel chỉ lấy MP3: không âm thầm đổi định dạng (cả khi là giọng mặc định).
      ["--format", "wav"],
      ["--voices", "viettel-hcm-minhquan", "--format", "wav"],
    ]) {
      expect(parsePocArgs(argv).ok, argv.join(" ")).toBe(false);
    }
    const ok = parsePocArgs([
      "--live",
      "--voices",
      "fpt-banmai",
      "--speed",
      "slow",
      "--format",
      "wav",
      "--set",
      "diagnostic",
    ]);
    expect(ok.ok && ok.options).toMatchObject({ live: true, voices: ["fpt-banmai"], speed: "slow", format: "wav" });
  });
});

describe("chạy, lưu và phục vụ tệp", () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "tts-poc-"));
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  const SECRET = "khoa-gia-lap-khong-that-555";
  const fakeProvider = (
    id: "fpt" | "google",
    makeAudio: (call: number) => Uint8Array | "FAIL",
  ): TtsProvider & { calls: number } => {
    const state = { calls: 0 };
    return {
      id,
      external: true,
      get calls() {
        return state.calls;
      },
      synthesize: async () => {
        state.calls += 1;
        const audio = makeAudio(state.calls);
        return audio === "FAIL"
          ? { ok: false, code: "PROVIDER_ERROR" }
          : { ok: true, data: { bytes: audio, mimeType: audio === undefined ? "audio/mpeg" : "audio/wav" } };
      },
    };
  };

  const jobsFor = (voices: string[], set: "catalog" | "diagnostic" = "catalog") => {
    const result = planPocRun({ voices, set, speed: "normal", format: "wav", existingKeys: new Set() });
    if (!result.ok) throw new Error(result.code);
    return result.jobs;
  };

  const baseRun = (providers: Parameters<typeof runPocJobs>[0]["providers"], jobs = jobsFor(["fpt-banmai"])) => {
    let tick = 0;
    return runPocJobs({
      jobs,
      providers,
      store: createFsPocStore(dir),
      clock: () => (tick += 1500),
      nowIso: () => "2026-10-28T09:00:00.000Z",
      timeoutMs: 1000,
    });
  };

  it("lưu từng tệp + sổ hợp lệ; sổ không chứa khóa, không trường học sinh", async () => {
    const provider = fakeProvider("fpt", (call) => wav(1 + call * 0.1));
    const results = await baseRun({ fpt: provider });
    expect(results.every((result) => result.status === "saved")).toBe(true);
    expect(provider.calls).toBe(6);

    const { manifest, problem } = await readPocManifest(dir);
    expect(problem).toBe("NONE");
    expect(manifest.samples).toHaveLength(6);
    expect(pocManifestSchema.safeParse(manifest).success).toBe(true);
    const sample = manifest.samples[0]!;
    expect(sample).toMatchObject({ provider: "fpt", providerVoice: "banmai", format: "wav", latencyMs: 1500 });
    expect(sample.file).toBe(`${sample.sha256}.wav`);
    expect((await readdir(dir)).sort()).toHaveLength(7); // 6 tệp + manifest.json
    const raw = await readFile(join(dir, "manifest.json"), "utf8");
    expect(raw).not.toMatch(/api[_-]?key|secret|studentId|student_id/iu);
    expect(raw).not.toContain(SECRET);
  });

  it("chống trùng tệp: hai yêu cầu cho cùng byte chỉ ghi một tệp (tên theo sha256)", async () => {
    const same = wav(1);
    const results = await baseRun({ fpt: fakeProvider("fpt", () => same) });
    expect(results.every((result) => result.status === "saved")).toBe(true);
    const { manifest } = await readPocManifest(dir);
    expect(manifest.samples).toHaveLength(6);
    expect(new Set(manifest.samples.map((entry) => entry.file)).size).toBe(1);
    expect(await readdir(dir)).toHaveLength(2);
  });

  it("không retry: lỗi nhà cung cấp tính một lần gọi; sau 2 lỗi liên tiếp dừng gọi nhà cung cấp đó", async () => {
    const provider = fakeProvider("fpt", () => "FAIL");
    const results = await baseRun({ fpt: provider });
    expect(provider.calls).toBe(POC_MAX_CONSECUTIVE_FAILURES);
    expect(results.map((result) => result.status)).toEqual([
      "failed",
      "failed",
      "skipped_provider_stopped",
      "skipped_provider_stopped",
      "skipped_provider_stopped",
      "skipped_provider_stopped",
    ]);
    expect(results[0]).toMatchObject({ code: "PROVIDER_ERROR" });
    expect((await readPocManifest(dir)).manifest).toEqual(emptyManifest());
  });

  it("tệp không phải âm thanh thật (byte giả của mock) bị từ chối, không được lưu", async () => {
    const fake = fakeProvider("fpt", () => new TextEncoder().encode("MOCK-TTS:vi-female-1:10"));
    const results = await baseRun({ fpt: fake }, jobsFor(["fpt-banmai"], "diagnostic"));
    expect(results[0]).toMatchObject({ status: "failed", code: "AUDIO_REJECTED" });
    expect((await readdir(dir)).length).toBe(0);
  });

  it("nhà cung cấp không được cấu hình (thiếu khóa) → bỏ qua, không lỗi, không ghi", async () => {
    const results = await baseRun({}, jobsFor(["fpt-banmai"], "diagnostic"));
    expect(results.map((result) => result.status)).toEqual(["skipped_no_provider"]);
  });

  it("sổ hỏng: không ghi đè", async () => {
    await writeFile(join(dir, "manifest.json"), "{khong-phai-json", "utf8");
    expect((await readPocManifest(dir)).problem).toBe("INVALID");
    await expect(
      baseRun({ fpt: fakeProvider("fpt", () => wav(1)) }, jobsFor(["fpt-banmai"], "diagnostic")),
    ).rejects.toThrow();
    expect(await readFile(join(dir, "manifest.json"), "utf8")).toBe("{khong-phai-json");
  });

  describe("phục vụ cho giáo viên (servePocSample)", () => {
    const seed = async () => {
      const audio = wav(1);
      await baseRun({ fpt: fakeProvider("fpt", () => audio) }, jobsFor(["fpt-banmai"], "diagnostic"));
      const { manifest } = await readPocManifest(dir);
      return { audio, sample: manifest.samples[0]! };
    };

    it("trả đúng byte với tiêu đề an toàn, không lưu bộ nhớ đệm", async () => {
      const { audio, sample } = await seed();
      const response = await servePocSample({ dir, file: sample.file, rangeHeader: null });
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toBe("audio/wav");
      expect(response.headers.get("cache-control")).toBe("private, no-store");
      expect(response.headers.get("x-content-type-options")).toBe("nosniff");
      expect(response.headers.get("content-security-policy")).toContain("sandbox");
      expect(new Uint8Array(await response.arrayBuffer())).toEqual(audio);
    });

    it("hỗ trợ Range (Safari)", async () => {
      const { audio, sample } = await seed();
      const part = await servePocSample({ dir, file: sample.file, rangeHeader: "bytes=0-9" });
      expect(part.status).toBe(206);
      expect(part.headers.get("content-range")).toBe(`bytes 0-9/${audio.byteLength}`);
      expect((await part.arrayBuffer()).byteLength).toBe(10);
      const bad = await servePocSample({ dir, file: sample.file, rangeHeader: "bytes=999999999-" });
      expect(bad.status).toBe(416);
    });

    it("từ chối tên tệp lạ, đi lệch thư mục, tệp không có trong sổ, nội dung bị sửa", async () => {
      const { sample } = await seed();
      const names = [
        "../manifest.json",
        "..%2Fmanifest.json",
        "manifest.json",
        `${"0".repeat(64)}.wav`, // đúng mẫu nhưng không có trong sổ
        `${sample.sha256}.mp3`, // sai đuôi
        "",
      ];
      for (const file of names) expect((await servePocSample({ dir, file, rangeHeader: null })).status, file).toBe(404);
      await writeFile(join(dir, sample.file), mp3(3));
      expect((await servePocSample({ dir, file: sample.file, rangeHeader: null })).status).toBe(404);
    });

    it("thư mục chưa có → 404 / sổ rỗng, không lỗi", async () => {
      const missing = join(dir, "khong-ton-tai");
      expect(await readPocManifest(missing)).toEqual({ manifest: emptyManifest(), problem: "MISSING" });
      expect((await servePocSample({ dir: missing, file: `${sha256Hex("x")}.mp3`, rangeHeader: null })).status).toBe(
        404,
      );
    });
  });
});
