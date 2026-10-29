import { describe, expect, it } from "vitest";
import {
  buildContestCatalog,
  contestAssetKey,
  spokenFromLabel,
  type ContestEntry,
  type RawLetter,
  type RawPhoneme,
} from "@/features/contest-audio/catalog";
import { checkEntry, prepareCatalog } from "@/features/contest-audio/checks";
import {
  CONTEST_LIFETIME_MAX_REQUESTS,
  CONTEST_RUN_DEFAULT_MAX_REQUESTS,
  CONTEST_RUN_HARD_MAX_REQUESTS,
  CONTEST_VOICE,
} from "@/features/contest-audio/config";
import { isContestPreviewEnvironment, isLocalSupabaseUrl } from "@/features/contest-audio/environment";
import { clampMaxRequests, planContestRun } from "@/features/contest-audio/plan";
import { buildContestReport, formatContestReport } from "@/features/contest-audio/report";
import { classifyRisk } from "@/features/contest-audio/risk";
import { evaluateDecoded } from "@/features/contest-audio/verify";
import { feedbackRefAllowed, isFeedbackRef } from "@/features/audio-playback/feedback-lines";
import { feedbackFor } from "@/features/exercises/core/feedback";
import { runContestJobs, type ContestRunDeps } from "@/server/contest-audio/generate";
import { LIBRARY_ENTRIES } from "@/server/tts-library/entries";
import type { TtsOutcome, TtsProvider, TtsRequest } from "@/server/tts/types";
import letters from "../../../content/kb/letters.json";
import phonemes from "../../../content/kb/phonemes.json";
import { wav } from "../audio-library/fixtures";

/**
 * Chế độ trình diễn âm thanh (docs/CONTEST_AUDIO.md): danh mục, rủi ro cách đọc, kế hoạch & hạn mức yêu cầu, bộ chạy (nhà cung cấp giả,
 * không mạng), kiểm tra kỹ thuật, cổng môi trường, báo cáo trung thực. Không tệp âm thanh thật, không dữ liệu học sinh.
 */

const catalog = buildContestCatalog({
  letters: (letters as { items: RawLetter[] }).items,
  phonemes: (phonemes as { items: RawPhoneme[] }).items,
  library: LIBRARY_ENTRIES.map((entry) => ({ id: entry.id, text: entry.text, attention: entry.attention })),
});
const byId = (id: string): ContestEntry => catalog.byId.get(id)!;

describe("danh mục lời đọc trình diễn", () => {
  it("102 mục = 29 tên chữ cái + 39 âm + 17 câu lệnh + 17 lời phản hồi; 89 yêu cầu riêng biệt", () => {
    const count = (kind: string) => catalog.entries.filter((entry) => entry.kind === kind).length;
    expect([count("letter"), count("phoneme"), count("instruction"), count("feedback")]).toEqual([29, 39, 17, 17]);
    expect(catalog.entries).toHaveLength(102);
    expect(new Set(catalog.entries.map((entry) => entry.assetKey)).size).toBe(89);
  });

  it("tên chữ cái ≠ âm của chữ: b → 'bê' (tên) và 'bờ' (âm) là hai mục KHÁC NHAU, hai tệp khác nhau", () => {
    expect(byId("letter:b").text).toBe("bê");
    expect(byId("phoneme:b").text).toBe("bờ");
    expect(byId("letter:b").assetKey).not.toBe(byId("phoneme:b").assetKey);
  });

  it("không bịa cách đọc: chữ đọc lấy nguyên văn nhãn của kho tri thức (chỉ đổi gạch nối thành dấu cách)", () => {
    expect(spokenFromLabel("e-lờ")).toBe("e lờ");
    expect(spokenFromLabel("ích-xì")).toBe("ích xì");
    expect(byId("letter:l").text).toBe("e lờ");
    expect(byId("phoneme:gh").text).toBe("gờ kép");
    for (const entry of catalog.entries) expect(entry.text).toBe(entry.text.normalize("NFC"));
  });

  it("khóa tệp trình diễn KHÁC khóa của thư viện giọng máy đã duyệt (cấu hình riêng → không bao giờ dùng chung tệp)", () => {
    expect(CONTEST_VOICE.configVersion.startsWith("contest-")).toBe(true);
    for (const line of LIBRARY_ENTRIES) {
      expect(byId(line.id).assetKey, line.id).not.toBe(line.assetKey);
      expect(byId(line.id).contentHash, line.id).not.toBe(line.contentHash);
    }
  });

  it("cùng chữ → cùng khóa tệp (một lần gọi): tên chữ 'a' và âm 'a'", () => {
    expect(byId("letter:a").assetKey).toBe(byId("phoneme:a").assetKey);
    expect(contestAssetKey("a ")).toBe(contestAssetKey("a"));
  });
});

describe("rủi ro cách đọc (không đoán — chỉ đánh dấu)", () => {
  it("k, q, gi, gh, ng, ngh, i/y, ă, â đều cần kiểm chứng", () => {
    for (const id of [
      "letter:k",
      "letter:q",
      "letter:y",
      "letter:i",
      "letter:ă",
      "letter:â",
      "phoneme:k",
      "phoneme:gi",
      "phoneme:gh",
      "phoneme:ng",
      "phoneme:ngh",
      "phoneme:qu",
      "phoneme:i",
      "phoneme:y",
      "phoneme:ă",
      "phoneme:â",
    ]) {
      expect(byId(id).riskClass, id).toBe("needs_verification");
    }
  });

  it("lời đọc một ký tự (a, e, ê, o…) cũng bị đánh dấu: bộ tổng hợp có thể đọc như tên chữ nước ngoài", () => {
    expect(classifyRisk({ kind: "letter", unit: "a", spoken: "a" }).reasons).toContain("single_character");
    expect(classifyRisk({ kind: "phoneme", unit: "ê", spoken: "ê" }).riskClass).toBe("needs_verification");
  });

  it("tên chữ/âm thông thường là standard; câu lệnh và lời phản hồi là standard (nhưng giữ cờ xưng hô)", () => {
    for (const id of ["letter:b", "letter:c", "phoneme:b", "phoneme:ch", "phoneme:th", "instruction:listen_letter"]) {
      expect(byId(id).riskClass, id).toBe("standard");
    }
    expect(byId("instruction:listen_letter").attention).toContain("ADDRESSING_UNDECIDED");
  });
});

describe("bước prepare", () => {
  it("danh mục thật qua kiểm tra tĩnh: 0 vấn đề", () => {
    const report = prepareCatalog(catalog.entries);
    expect(report.issues).toEqual([]);
    expect(report.total).toBe(102);
    expect(report.distinctRequests).toBe(89);
  });

  it("bắt dấu hiệu lộ đáp án (chữ đứng riêng, chữ trong nháy, chữ số), dữ liệu cá nhân, quá dài, không NFC", () => {
    const make = (text: string, kind: ContestEntry["kind"] = "instruction"): ContestEntry => ({
      ...byId("instruction:listen_letter"),
      id: `${kind}:test`,
      kind,
      text,
    });
    const codes = (entry: ContestEntry) => checkEntry(entry).map((issue) => issue.code);
    expect(codes(make("Con chọn chữ b nhé"))).toContain("POSSIBLE_ANSWER_LEAK");
    expect(codes(make('Con chọn "bò" nhé'))).toContain("POSSIBLE_ANSWER_LEAK");
    expect(codes(make("Con chọn câu 3 nhé"))).toContain("POSSIBLE_ANSWER_LEAK");
    expect(codes(make("Gọi " + "ban" + "@" + "nhà.vn"))).toContain("REJECTED_BY_GATE");
    expect(codes(make("a".repeat(301)))).toEqual(expect.arrayContaining(["BAD_LENGTH"]));
    expect(codes(make("e" + String.fromCharCode(0x301)))).toContain("NOT_NFC");
    // Âm của chữ ở Học tập không có câu hỏi → không áp luật lộ đáp án.
    expect(codes(make("b", "letter"))).toEqual([]);
  });
});

describe("kế hoạch gọi nhà cung cấp và hạn mức", () => {
  const all = catalog.entries;
  it("mỗi khóa tệp chỉ một yêu cầu; tệp đã có thì KHÔNG gọi lại", () => {
    const first = planContestRun({ entries: all, haveKeys: new Set(), lifetimeUsed: 0, maxRequests: 120 });
    expect(first.jobs).toHaveLength(89);
    const sharedJob = first.jobs.find((job) => job.entryIds.length > 1);
    expect(sharedJob?.entryIds.length).toBeGreaterThan(1);
    const have = new Set(first.jobs.map((job) => job.assetKey));
    const again = planContestRun({ entries: all, haveKeys: have, lifetimeUsed: 0 });
    expect(again.jobs).toEqual([]);
    expect(again.reusedKeys).toHaveLength(89);
  });

  it("mặc định tối đa 40 yêu cầu mỗi lần chạy; phần còn lại được hoãn, không bỏ qua âm thầm", () => {
    const plan = planContestRun({ entries: all, haveKeys: new Set(), lifetimeUsed: 0 });
    expect(plan.jobs).toHaveLength(CONTEST_RUN_DEFAULT_MAX_REQUESTS);
    expect(plan.deferred).toHaveLength(89 - CONTEST_RUN_DEFAULT_MAX_REQUESTS);
    expect(plan.blockedBy).toBe("RUN_CAP");
  });

  it("trần cứng mỗi lần chạy và hạn mức tổng suốt đời", () => {
    expect(clampMaxRequests(9999)).toBe(CONTEST_RUN_HARD_MAX_REQUESTS);
    expect(clampMaxRequests(0)).toBe(CONTEST_RUN_DEFAULT_MAX_REQUESTS);
    expect(clampMaxRequests(undefined)).toBe(CONTEST_RUN_DEFAULT_MAX_REQUESTS);
    const nearCap = planContestRun({
      entries: all,
      haveKeys: new Set(),
      lifetimeUsed: CONTEST_LIFETIME_MAX_REQUESTS - 5,
      maxRequests: 100,
    });
    expect(nearCap.jobs).toHaveLength(5);
    expect(nearCap.blockedBy).toBe("LIFETIME_CAP");
    const spent = planContestRun({ entries: all, haveKeys: new Set(), lifetimeUsed: CONTEST_LIFETIME_MAX_REQUESTS });
    expect(spent.jobs).toEqual([]);
  });

  it("khi hạn mức không đủ cho tất cả: mục an toàn trước mục cần kiểm chứng; câu lệnh, phản hồi, tên chữ cái rồi âm", () => {
    const plan = planContestRun({ entries: all, haveKeys: new Set(), lifetimeUsed: 0, maxRequests: 120 });
    const kinds = plan.jobs.map((job) => catalog.byId.get(job.entryIds[0]!)!);
    expect(kinds.slice(0, 17).every((entry) => entry.kind === "instruction")).toBe(true);
    expect(kinds.slice(17, 34).every((entry) => entry.kind === "feedback")).toBe(true);
    const firstRisky = plan.jobs.findIndex((job) =>
      job.entryIds.every((id) => catalog.byId.get(id)!.riskClass === "needs_verification"),
    );
    const lastSafe = plan.jobs
      .map((job) => job.entryIds.some((id) => catalog.byId.get(id)!.riskClass === "standard"))
      .lastIndexOf(true);
    expect(firstRisky).toBeGreaterThan(lastSafe);
  });

  it("khóa từng bị nhà cung cấp trả lỗi KHÔNG tự gọi lại, trừ khi yêu cầu rõ", () => {
    const failed = new Set([byId("letter:b").assetKey]);
    const plan = planContestRun({
      entries: all,
      haveKeys: new Set(),
      lifetimeUsed: 0,
      maxRequests: 120,
      failedKeys: failed,
    });
    expect(plan.jobs.some((job) => job.assetKey === byId("letter:b").assetKey)).toBe(false);
    expect(plan.previouslyFailed.map((job) => job.entryIds)).toEqual([["letter:b"]]);
    const retry = planContestRun({
      entries: all,
      haveKeys: new Set(),
      lifetimeUsed: 0,
      maxRequests: 120,
      failedKeys: failed,
      retryFailed: true,
    });
    expect(retry.jobs.some((job) => job.assetKey === byId("letter:b").assetKey)).toBe(true);
  });
});

describe("bộ chạy gọi nhà cung cấp (nhà cung cấp giả)", () => {
  function harness(outcomes: TtsOutcome[] | TtsOutcome, over: Partial<ContestRunDeps> = {}) {
    const requests: TtsRequest[] = [];
    const log: string[] = [];
    const saved = new Map<string, Uint8Array>();
    let index = 0;
    const provider: TtsProvider = {
      id: "viettel",
      external: true,
      synthesize: async (request) => {
        log.push(`send:${request.text}`);
        requests.push(request);
        const outcome = Array.isArray(outcomes) ? (outcomes[index++] ?? outcomes.at(-1)!) : outcomes;
        return outcome;
      },
    };
    const deps: ContestRunDeps = {
      provider,
      timeoutMs: 1000,
      saveBytes: async (key, bytes) => void saved.set(key, bytes),
      recordRequest: async (key) => void log.push(`ledger:${key.slice(0, 4)}`),
      recordOutcome: async (key, ok) => void log.push(`outcome:${key.slice(0, 4)}:${ok}`),
      shouldStop: () => false,
      sleep: async () => undefined,
      gapMs: 0,
      ...over,
    };
    return { requests, log, saved, deps };
  }
  const job = (n: number) => ({
    assetKey: `${String(n).padStart(4, "0")}${"a".repeat(60)}`,
    text: `bờ ${n}`,
    entryIds: [`letter:${n}`],
    priority: 0,
  });
  const good: TtsOutcome = { ok: true, data: { bytes: wav(1), mimeType: "audio/wav" } };

  it("chỉ gửi {chữ cố định, mục đích, giọng, tốc độ}; ghi sổ NGAY TRƯỚC khi gửi", async () => {
    const h = harness(good);
    await runContestJobs([job(1)], h.deps);
    expect(h.requests).toEqual([{ text: "bờ 1", purpose: "word", voiceKey: "vi-male-1", speed: "slow" }]);
    expect(h.log.findIndex((line) => line.startsWith("ledger:"))).toBeLessThan(
      h.log.findIndex((line) => line.startsWith("send:")),
    );
  });

  it("tệp hợp lệ được lưu; byte giả (như của mock) bị loại, không lưu", async () => {
    const ok = harness(good);
    expect((await runContestJobs([job(1)], ok.deps))[0]?.status).toBe("saved");
    expect(ok.saved.size).toBe(1);
    const fake = harness({
      ok: true,
      data: { bytes: new TextEncoder().encode("MOCK-TTS giả"), mimeType: "audio/mpeg" },
    });
    const results = await runContestJobs([job(1)], fake.deps);
    expect(results[0]).toMatchObject({ status: "failed", code: "AUDIO_REJECTED" });
    expect(fake.saved.size).toBe(0);
  });

  it("không bao giờ gửi hai lần cùng một khóa trong một lần chạy", async () => {
    const h = harness(good);
    await runContestJobs([job(1), job(1), job(2)], h.deps);
    expect(h.requests).toHaveLength(2);
  });

  it("dừng sau 3 lần lỗi liên tiếp: phần còn lại KHÔNG được gửi", async () => {
    const h = harness({ ok: false, code: "PROVIDER_ERROR" });
    const results = await runContestJobs([1, 2, 3, 4, 5, 6].map(job), h.deps);
    expect(h.requests).toHaveLength(3);
    expect(results.filter((item) => item.status === "skipped_stopped")).toHaveLength(3);
  });

  it("một lần thành công đặt lại bộ đếm lỗi liên tiếp", async () => {
    const h = harness([
      { ok: false, code: "PROVIDER_ERROR" },
      { ok: false, code: "PROVIDER_ERROR" },
      good,
      { ok: false, code: "PROVIDER_ERROR" },
      good,
    ]);
    await runContestJobs([1, 2, 3, 4, 5].map(job), h.deps);
    expect(h.requests).toHaveLength(5);
  });

  it("khóa sai / hết hạn mức do nhà cung cấp báo (shouldStop) → dừng ngay", async () => {
    let stop = false;
    const h = harness(good, { shouldStop: () => stop, recordRequest: async () => void (stop = true) });
    const results = await runContestJobs([1, 2, 3].map(job), h.deps);
    expect(h.requests).toHaveLength(1);
    expect(results.map((item) => item.status)).toEqual(["saved", "skipped_stopped", "skipped_stopped"]);
  });

  it("ghi sổ lỗi → KHÔNG gửi (không bao giờ gửi mà không ghi sổ)", async () => {
    const h = harness(good, {
      recordRequest: async () => {
        throw new Error("hết hạn mức");
      },
    });
    await expect(runContestJobs([job(1)], h.deps)).rejects.toThrow("hết hạn mức");
    expect(h.requests).toHaveLength(0);
  });

  it("kết quả mỗi yêu cầu được ghi lại (đã lưu / lỗi)", async () => {
    const h = harness([good, { ok: false, code: "TIMEOUT" }]);
    await runContestJobs([job(1), job(2)], h.deps);
    expect(h.log.filter((line) => line.startsWith("outcome:"))).toEqual(["outcome:0001:true", "outcome:0002:false"]);
  });
});

describe("kiểm tra kỹ thuật sau giải mã", () => {
  const good = { durationMs: 700, sampleRate: 48000, peak: 0.8, rms: 0.1, voicedRatio: 0.35 };
  it("tệp bình thường qua", () => {
    expect(evaluateDecoded(good)).toEqual({ ok: true, problems: [], warnings: [] });
  });
  it("phát hiện tệp im lặng, quá nhỏ, quá ngắn/dài, gần như toàn im lặng, số đo hỏng", () => {
    expect(evaluateDecoded({ ...good, peak: 0.001, rms: 0.0001, voicedRatio: 0 }).problems).toContain("SILENT");
    expect(evaluateDecoded({ ...good, peak: 0.1, rms: 0.001 }).problems).toContain("TOO_QUIET");
    expect(evaluateDecoded({ ...good, durationMs: 100 }).problems).toContain("TOO_SHORT");
    expect(evaluateDecoded({ ...good, durationMs: 20_000 }).problems).toContain("TOO_LONG");
    expect(evaluateDecoded({ ...good, voicedRatio: 0.01 }).problems).toContain("MOSTLY_SILENCE");
    expect(evaluateDecoded({ ...good, peak: Number.NaN }).problems).toEqual(["BAD_STATS"]);
  });
  it("biên độ chạm trần chỉ là cảnh báo, không loại tệp", () => {
    expect(evaluateDecoded({ ...good, peak: 1 })).toEqual({ ok: true, problems: [], warnings: ["CLIPPING"] });
  });
});

describe("cổng môi trường: chỉ máy local", () => {
  it("Supabase local → được phép; Cloud / Vercel / tắt tường minh → không", () => {
    expect(isLocalSupabaseUrl("http://127.0.0.1:54321")).toBe(true);
    expect(isLocalSupabaseUrl("http://localhost:54321/")).toBe(true);
    expect(isLocalSupabaseUrl("https://abcdefgh.supabase.co")).toBe(false);
    expect(isLocalSupabaseUrl("http://127.0.0.1.evil.example")).toBe(false);
    expect(isLocalSupabaseUrl(undefined)).toBe(false);
    const local = { NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321" };
    expect(isContestPreviewEnvironment(local)).toBe(true);
    expect(isContestPreviewEnvironment({ ...local, VERCEL: "1" })).toBe(false);
    expect(isContestPreviewEnvironment({ ...local, VERCEL_ENV: "preview" })).toBe(false);
    expect(isContestPreviewEnvironment({ ...local, CONTEST_AUDIO_PREVIEW: "off" })).toBe(false);
    expect(isContestPreviewEnvironment({ NEXT_PUBLIC_SUPABASE_URL: "https://abcdefgh.supabase.co" })).toBe(false);
    expect(isContestPreviewEnvironment({})).toBe(false);
  });
});

describe("báo cáo trung thực", () => {
  const entries = catalog.entries;
  const keys = new Set(entries.map((entry) => entry.assetKey));
  const verifiedAll = Object.fromEntries([...keys].map((key) => [key, { ok: true, problems: [] }]));
  const base = {
    entries,
    cachedKeys: keys,
    verify: verifiedAll,
    registeredSchools: new Map(entries.map((entry) => [entry.id, 1])),
    schoolCount: 1,
    requestsUsed: 89,
    modeEnabled: true,
    gateEnabled: true,
    playUnverified: false,
  };

  it("đủ tệp kỹ thuật: mục rủi ro vẫn bị GIỮ, không tính là phát được; không tuyên bố đã duyệt", () => {
    const report = buildContestReport(base);
    expect(report.technicallyComplete).toBe(true);
    expect(report.playableNow).toHaveLength(102 - report.needsVerification.length);
    expect(report.needsVerification.every((item) => item.held)).toBe(true);
    const text = formatContestReport(report).join("\n");
    expect(text).toMatch(/KHÔNG có nghĩa là cách đọc đã được kiểm chứng/u);
    expect(text).not.toMatch(/mọi chữ đều đọc được|đã duyệt xong|giáo viên đã duyệt tất cả/iu);
  });

  it("cho phép phát mục rủi ro → vẫn liệt kê chúng là 'cần kiểm chứng'", () => {
    const report = buildContestReport({ ...base, playUnverified: true });
    expect(report.playableNow).toHaveLength(102);
    expect(report.needsVerification.every((item) => !item.held)).toBe(true);
    expect(report.needsVerification.length).toBeGreaterThan(0);
  });

  it("thiếu tệp / tệp không qua kiểm tra / chưa đăng ký được nêu tên; không báo hoàn thành", () => {
    const missingKey = byId("letter:b").assetKey;
    const failKey = byId("letter:c").assetKey;
    const report = buildContestReport({
      ...base,
      cachedKeys: new Set([...keys].filter((key) => key !== missingKey)),
      verify: { ...verifiedAll, [failKey]: { ok: false, problems: ["SILENT"] } },
      registeredSchools: new Map(),
    });
    expect(report.missing).toContain("letter:b");
    expect(report.verifyFailed.map((item) => item.id)).toContain("letter:c");
    expect(report.unregistered.length).toBeGreaterThan(0);
    expect(report.technicallyComplete).toBe(false);
    expect(report.playableNow).toEqual([]);
    expect(formatContestReport(report).join("\n")).toMatch(/Chưa đủ tệp cho cả danh mục/u);
  });

  it("chế độ tắt → không mục nào phát được dù đã có tệp", () => {
    expect(buildContestReport({ ...base, modeEnabled: false }).playableNow).toEqual([]);
    expect(buildContestReport({ ...base, gateEnabled: false }).playableNow).toEqual([]);
  });
});

describe("lời phản hồi bằng giọng nói", () => {
  it("mã dòng khớp trạng thái thật của câu; không xin lời khen cho câu chưa đúng", () => {
    expect(feedbackRefAllowed("correct_title_2", { status: "correct", attemptsUsed: 1 })).toBe(true);
    expect(feedbackRefAllowed("correct_title_2", { status: "open", attemptsUsed: 1 })).toBe(false);
    expect(feedbackRefAllowed("correct_title_2", { status: "exhausted", attemptsUsed: 3 })).toBe(false);
    expect(feedbackRefAllowed("retry.tone", { status: "open", attemptsUsed: 1 })).toBe(true);
    expect(feedbackRefAllowed("retry.tone", { status: "open", attemptsUsed: 0 })).toBe(false);
    expect(feedbackRefAllowed("retry.tone", { status: "correct", attemptsUsed: 1 })).toBe(false);
    expect(feedbackRefAllowed("reveal_title", { status: "exhausted", attemptsUsed: 3 })).toBe(true);
    expect(feedbackRefAllowed("reveal_title", { status: "open", attemptsUsed: 1 })).toBe(false);
    expect(feedbackRefAllowed("void_title", { status: "void", attemptsUsed: 0 })).toBe(false);
  });

  it("mã dòng lạ bị từ chối ngay ở ranh giới", () => {
    for (const bad of ["", "../x", "correct_title_", "retry.", "retry.TONE", "instruction:listen_letter", "a b"]) {
      expect(isFeedbackRef(bad), bad).toBe(false);
    }
    expect(isFeedbackRef("retry.generic")).toBe(true);
  });

  it("mỗi dòng phản hồi giao diện có thể hiện đều có mục trong danh mục giọng nói (không dòng 'mồ côi')", () => {
    const grade = (errorTags: string[]) => ({ correct: false, errorTags }) as never;
    const refs = new Set<string>();
    for (const variant of [
      "visual_match",
      "listen_letter",
      "picture_build",
      "missing_onset",
      "which_rime",
      "which_tone",
      "choose_picture",
    ]) {
      for (let position = 0; position < 3; position++) {
        refs.add(
          feedbackFor({
            variant,
            grade: { correct: true, errorTags: [] } as never,
            attemptNo: 1,
            maxAttempts: 3,
            position,
            reveal: null as never,
          }).audioRef,
        );
      }
      refs.add(
        feedbackFor({ variant, grade: grade([]), attemptNo: 1, maxAttempts: 3, position: 0, reveal: null as never })
          .audioRef,
      );
      refs.add(
        feedbackFor({ variant, grade: grade([]), attemptNo: 3, maxAttempts: 3, position: 0, reveal: null as never })
          .audioRef,
      );
    }
    for (const ref of refs) {
      expect(isFeedbackRef(ref), ref).toBe(true);
      expect(byId(`feedback:${ref}`), ref).toBeDefined();
      expect(
        LIBRARY_ENTRIES.some((entry) => entry.id === `feedback:${ref}`),
        ref,
      ).toBe(true);
    }
  });
});
