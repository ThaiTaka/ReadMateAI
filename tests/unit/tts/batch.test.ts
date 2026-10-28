import { afterEach, describe, expect, it, vi } from "vitest";
import { buildTtsScriptCatalog } from "@/server/tts/catalog";
import { checkSynthesizedAudio } from "@/server/tts/audio-check";
import { assetKeyOf, contentHashOf } from "@/server/tts/hash";
import { planTtsBatch, runTtsBatch, TTS_BATCH_MAX_JOBS } from "@/server/tts/batch";
import { createMockProvider, noneProvider } from "@/server/tts/providers";
import { ttsCacheKey } from "@/server/tts/service";
import { PROVISIONAL_VOICE } from "@/server/tts/voice";
import { wav } from "../audio-library/fixtures";
import { approve, syntheticWavProvider, TEST_VOICE, versionFor } from "./tts-helpers";

const catalog = buildTtsScriptCatalog({ voice: TEST_VOICE });
const [e1, e2, e3] = catalog.entries;
const entries = [e1!, e2!, e3!];
const base = { providerId: "mock", voice: TEST_VOICE, versions: [] as unknown[] };

afterEach(() => vi.restoreAllMocks());

describe("kế hoạch lô — chỉ lời đọc đã duyệt mới được sinh", () => {
  it("chưa có bản duyệt nào → không tác vụ nào, mọi mục bị bỏ qua vì SCRIPT_NOT_APPROVED", () => {
    const plan = planTtsBatch({ ...base, entries: catalog.entries, scriptReviews: [] });
    expect(plan.jobs).toEqual([]);
    expect(plan.skipped).toHaveLength(catalog.entries.length);
    expect(plan.skipped.every((s) => s.reason === "SCRIPT_NOT_APPROVED")).toBe(true);
  });

  it("bản duyệt bị từ chối, thiếu xác nhận cách đọc, hay lệch hash → vẫn không sinh", () => {
    const plan = planTtsBatch({
      ...base,
      entries,
      scriptReviews: [
        approve(e1!, { decision: "rejected" }),
        approve(e2!, { pronunciationConfirmed: false }),
        approve(e3!, { contentHash: "f".repeat(64) }),
      ],
    });
    expect(plan.jobs).toEqual([]);
  });

  it("mục được duyệt thành tác vụ; request chỉ có chữ, mục đích, giọng, tốc độ (không dữ liệu học sinh)", () => {
    const plan = planTtsBatch({ ...base, entries, scriptReviews: [approve(e1!)] });
    expect(plan.jobs).toHaveLength(1);
    const job = plan.jobs[0]!;
    expect(Object.keys(job.request).sort()).toEqual(["purpose", "speed", "text", "voiceKey"]);
    expect(job.request.text).toBe(e1!.text);
    expect(job.assetKey).toBe(
      assetKeyOf({ providerId: "mock", purpose: e1!.purpose, text: e1!.text, voice: TEST_VOICE }),
    );
  });

  it("mục bị hỏng (lược đồ sai, hash giả, lời đọc có dữ liệu cá nhân) bị loại, không tới nhà cung cấp", () => {
    const email = ["me", "ex.vn"].join("@");
    const badText = { ...e1!, text: `Gọi ${email}` };
    const forged = { ...e2!, text: `${e2!.text} thêm`, contentHash: e2!.contentHash };
    const malformed = { ...e3!, studentId: "x" } as unknown as typeof e3;
    const plan = planTtsBatch({
      ...base,
      entries: [badText, forged, malformed!],
      scriptReviews: [approve(badText), approve(forged), approve(e3!)],
    });
    expect(plan.jobs).toEqual([]);
    expect(plan.skipped.map((s) => s.reason)).toEqual([
      "CONTENT_HASH_MISMATCH",
      "CONTENT_HASH_MISMATCH",
      "INVALID_INPUT",
    ]);
  });

  it("mục chỉ có khe bị cấm ở mọi mức thì không sinh", () => {
    const forbidden = {
      ...e1!,
      usages: e1!.usages.map((u) => ({
        ...u,
        availability: { 3: "forbidden", 2: "forbidden", 1: "forbidden", 0: "forbidden" } as const,
      })),
    };
    const plan = planTtsBatch({ ...base, entries: [forbidden], scriptReviews: [approve(forbidden)] });
    expect(plan.skipped).toEqual([{ entryId: forbidden.id, reason: "NOT_SYNTHESIZABLE" }]);
  });
});

describe("chống trùng và định danh phiên bản", () => {
  it("hai mục cùng mục đích + chữ + giọng dùng chung MỘT tác vụ", () => {
    const twin = { ...e1!, id: "instruction:ban-sao" };
    const plan = planTtsBatch({ ...base, entries: [e1!, twin], scriptReviews: [approve(e1!), approve(twin)] });
    expect(plan.jobs).toHaveLength(1);
    expect(plan.jobs[0]!.entryIds).toEqual([e1!.id, twin.id]);
    expect(plan.totalChars).toBe(e1!.text.length);
  });

  it("đã có phiên bản cùng khóa → bỏ qua (ALREADY_GENERATED); thu hồi/từ chối thì chặn hẳn", () => {
    const reviews = [approve(e1!), approve(e2!), approve(e3!)];
    const pending = versionFor(e1!, { provider: "google", status: "pending_review" });
    const revoked = versionFor(e2!, { provider: "google", status: "revoked" });
    const rejected = versionFor(e3!, { provider: "google", status: "rejected" });
    const plan = planTtsBatch({
      ...base,
      providerId: "google",
      entries,
      scriptReviews: reviews,
      versions: [pending, revoked, rejected],
    });
    expect(plan.jobs).toEqual([]);
    expect(plan.skipped.map((s) => s.reason)).toEqual(["ALREADY_GENERATED", "REVOKED_BLOCKED", "PREVIOUSLY_REJECTED"]);
  });

  it("khóa đổi khi đổi nhà cung cấp, mã giọng, tốc độ, phiên bản cấu hình giọng hoặc chữ", () => {
    const ref = { providerId: "google", purpose: e1!.purpose, text: e1!.text, voice: TEST_VOICE };
    const key = assetKeyOf(ref);
    expect(assetKeyOf({ ...ref })).toBe(key);
    expect(assetKeyOf({ ...ref, providerId: "mock" })).not.toBe(key);
    expect(assetKeyOf({ ...ref, voice: { ...TEST_VOICE, voiceKey: "vi-male-1" } })).not.toBe(key);
    expect(assetKeyOf({ ...ref, voice: { ...TEST_VOICE, speed: "normal" } })).not.toBe(key);
    expect(assetKeyOf({ ...ref, voice: { ...TEST_VOICE, configVersion: "test-voice-2" } })).not.toBe(key);
    expect(assetKeyOf({ ...ref, text: `${ref.text} nhé` })).not.toBe(key);
    expect(assetKeyOf({ ...ref, purpose: "feedback" })).not.toBe(key);
    expect(assetKeyOf({ ...ref, text: ref.text.normalize("NFD") })).toBe(key); // NFC hóa trước khi băm
    expect(
      ttsCacheKey(
        { text: ref.text, purpose: ref.purpose, voiceKey: "vi-female-1", speed: "slow" },
        "google",
        "test-voice-1",
      ),
    ).toBe(key);
  });

  it("đổi chữ → hash mới, khóa tệp mới: tạo tác vụ MỚI, tệp cũ không bị sửa hay dùng lại", () => {
    const oldVersion = versionFor(e1!, { provider: "google" });
    const text = `${e1!.text} nhé`;
    const edited = { ...e1!, text, contentHash: contentHashOf({ purpose: e1!.purpose, text }) };
    expect(edited.contentHash).not.toBe(e1!.contentHash);
    const plan = planTtsBatch({
      ...base,
      providerId: "google",
      entries: [edited],
      scriptReviews: [approve(e1!), approve(edited)],
      versions: [oldVersion],
    });
    expect(plan.jobs).toHaveLength(1);
    expect(plan.jobs[0]!.assetKey).not.toBe(oldVersion.assetKey);
    // bản duyệt cũ không áp dụng cho chữ mới
    const noReview = planTtsBatch({
      ...base,
      providerId: "google",
      entries: [edited],
      scriptReviews: [approve(e1!)],
      versions: [oldVersion],
    });
    expect(noReview.skipped).toEqual([{ entryId: edited.id, reason: "SCRIPT_NOT_APPROVED" }]);
  });

  it("giới hạn số tác vụ và số ký tự của lô", () => {
    const many = catalog.entries.slice(0, 10);
    const reviews = many.map((e) => approve(e));
    const limitedJobs = planTtsBatch({ ...base, entries: many, scriptReviews: reviews, limits: { maxJobs: 3 } });
    expect(limitedJobs.jobs).toHaveLength(3);
    expect(limitedJobs.skipped.every((s) => s.reason === "OVER_JOB_LIMIT")).toBe(true);
    const limitedChars = planTtsBatch({ ...base, entries: many, scriptReviews: reviews, limits: { maxChars: 40 } });
    expect(limitedChars.totalChars).toBeLessThanOrEqual(40);
    expect(limitedChars.skipped.some((s) => s.reason === "OVER_CHAR_BUDGET")).toBe(true);
    expect(TTS_BATCH_MAX_JOBS).toBeLessThanOrEqual(50);
    const all = planTtsBatch({
      ...base,
      entries: catalog.entries,
      scriptReviews: catalog.entries.map((e) => approve(e)),
      limits: { maxChars: 100000, maxJobs: 1000 },
    });
    expect(all.jobs).toHaveLength(catalog.entries.length);
  });
});

describe("chạy lô — không nhà cung cấp, mock, giọng chưa chọn", () => {
  const planOf = (providerId: string, voice = TEST_VOICE) =>
    planTtsBatch({ entries, scriptReviews: entries.map((e) => approve(e)), versions: [], providerId, voice });

  it("không có nhà cung cấp → NO_PROVIDER cho mọi tác vụ, KHÔNG gọi mạng", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const result = await runTtsBatch({ plan: planOf("none"), provider: noneProvider });
    expect(result.candidates).toEqual([]);
    expect(result.failures.map((f) => f.code)).toEqual(["NO_PROVIDER", "NO_PROVIDER", "NO_PROVIDER"]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("byte của mock không phải âm thanh: bị bộ kiểm tra kỹ thuật từ chối, không thành ứng viên", async () => {
    const mock = createMockProvider();
    const result = await runTtsBatch({ plan: planOf("mock"), provider: mock });
    expect(mock.calls).toHaveLength(3);
    expect(result.candidates).toEqual([]);
    expect(result.failures.every((f) => f.code === "AUDIO_REJECTED")).toBe(true);
    const direct = checkSynthesizedAudio({
      bytes: new TextEncoder().encode("MOCK-TTS:vi-female-1:20"),
      mimeType: "audio/mpeg",
    });
    expect(direct.ok).toBe(false);
  });

  it("WAV tổng hợp hợp lệ → ứng viên pending_review, gắn nhãn kiểm thử, KHÔNG BAO GIỜ approved", async () => {
    const provider = syntheticWavProvider("mock");
    const result = await runTtsBatch({ plan: planOf("mock"), provider });
    expect(provider.calls).toBe(3);
    expect(result.candidates).toHaveLength(3);
    for (const candidate of result.candidates) {
      expect(candidate.status).toBe("pending_review");
      expect(candidate.testOnly).toBe(true);
      expect(candidate.audio).toMatchObject({ mime: "audio/wav", inspected: true });
    }
  });

  it("MIME khai báo lệch với định dạng thật bị từ chối", () => {
    const result = checkSynthesizedAudio({ bytes: wav(1), mimeType: "audio/mpeg" });
    expect(result).toEqual({ ok: false, code: "AUDIO_MIME_MISMATCH" });
  });

  it("giọng chưa chọn (provisional) → không chạy, trừ khi chạy khô có cờ rõ ràng; nhà cung cấp lệch kế hoạch bị từ chối", async () => {
    const provider = syntheticWavProvider("mock");
    const provisional = planTtsBatch({
      entries,
      scriptReviews: entries.map((e) => approve(e)),
      versions: [],
      providerId: "mock",
      voice: PROVISIONAL_VOICE,
    });
    expect(
      (await runTtsBatch({ plan: provisional, provider })).failures.every((f) => f.code === "VOICE_NOT_CHOSEN"),
    ).toBe(true);
    expect(provider.calls).toBe(0);
    const mismatch = await runTtsBatch({ plan: planOf("google"), provider });
    expect(mismatch.failures.every((f) => f.code === "INVALID_INPUT")).toBe(true);
    expect(provider.calls).toBe(0);
  });

  it("hạn mức ký tự của lô chặn chi phí; lỗi nhà cung cấp không làm lộ nội dung", async () => {
    const plan = { ...planOf("mock"), limits: { maxJobs: 10, maxChars: entries[0]!.text.length } };
    const provider = syntheticWavProvider("mock");
    const result = await runTtsBatch({ plan, provider });
    expect(result.candidates).toHaveLength(1);
    expect(result.failures.map((f) => f.code)).toEqual(["BUDGET_EXCEEDED", "BUDGET_EXCEEDED"]);
    const failing = createMockProvider({ fail: "PROVIDER_ERROR" });
    const failed = await runTtsBatch({ plan: planOf("mock"), provider: failing });
    expect(JSON.stringify(failed)).not.toContain(entries[0]!.text);
  });
});
