import { describe, expect, it } from "vitest";
import { VARIANTS } from "@/features/exercises/runtime-registry";
import { deriveLineState, type LineKey, type ReviewRow, type VersionRow } from "@/features/tts-library/state";
import { instructionEntryId, libraryEntry, LIBRARY_ENTRIES } from "@/server/tts-library/entries";
import { LIBRARY_PROVIDER_ID, LIBRARY_VOICE } from "@/server/tts-library/voice";
import { assetKeyOf } from "@/server/tts/hash";
import { checkTtsRequest } from "@/server/tts/request";

/** Thư viện giọng máy (R10.5): danh mục lời đọc cố định và bảng chân trị trạng thái của từng lời đọc. */

const line: LineKey = { id: "instruction:listen_letter", contentHash: "h".repeat(64), assetKey: "k".repeat(64) };

const review = (over: Partial<ReviewRow> = {}): ReviewRow => ({
  entryId: line.id,
  contentHash: line.contentHash,
  decision: "approved",
  pronunciationConfirmed: true,
  ...over,
});

const version = (over: Partial<VersionRow> = {}): VersionRow => ({
  id: "ver-1",
  entryId: line.id,
  contentHash: line.contentHash,
  assetKey: line.assetKey,
  versionNo: 1,
  status: "approved",
  testOnly: false,
  durationMs: 1000,
  reviewNote: null,
  revokeReason: null,
  generatedAt: "2026-10-29T00:00:00Z",
  ...over,
});

describe("trạng thái của một lời đọc", () => {
  it("chưa có gì: lời đọc chờ duyệt, chưa có âm thanh, chưa dùng được", () => {
    expect(deriveLineState(line, [], [])).toMatchObject({
      scriptStatus: "pending",
      audioStatus: "missing",
      usable: false,
      staleApproved: false,
      currentVersion: null,
    });
  });

  it("lời đọc chỉ 'đã duyệt' khi quyết định là duyệt VÀ đã xác nhận cách đọc", () => {
    expect(deriveLineState(line, [review()], []).scriptStatus).toBe("approved");
    expect(deriveLineState(line, [review({ pronunciationConfirmed: false })], []).scriptStatus).toBe("pending");
    expect(
      deriveLineState(line, [review({ decision: "rejected", pronunciationConfirmed: false })], []).scriptStatus,
    ).toBe("rejected");
  });

  it("bản duyệt của chữ cũ (băm khác) không còn áp dụng", () => {
    expect(deriveLineState(line, [review({ contentHash: "x".repeat(64) })], []).scriptStatus).toBe("pending");
  });

  it("dùng được khi lời đọc đã duyệt VÀ tệp đã duyệt khớp cấu hình hiện hành", () => {
    const state = deriveLineState(line, [review()], [version()]);
    expect(state).toMatchObject({ usable: true, audioStatus: "approved", staleApproved: false });
    expect(state.currentVersion?.id).toBe("ver-1");
  });

  it("tệp đã duyệt nhưng lời đọc chưa duyệt (hoặc ngược lại) → chưa dùng được", () => {
    expect(deriveLineState(line, [], [version()]).usable).toBe(false);
    expect(deriveLineState(line, [review()], []).usable).toBe(false);
    expect(deriveLineState(line, [review({ decision: "rejected" })], [version()]).usable).toBe(false);
  });

  it("tệp chờ duyệt → âm thanh chờ nghe và duyệt, chưa dùng được", () => {
    const state = deriveLineState(line, [review()], [version({ status: "pending_review" })]);
    expect(state).toMatchObject({ audioStatus: "pending_review", usable: false });
    expect(state.currentVersion?.status).toBe("pending_review");
  });

  it("bản đã duyệt luôn thắng bản chờ duyệt cùng cấu hình", () => {
    const state = deriveLineState(
      line,
      [review()],
      [
        version({ id: "a", status: "pending_review", versionNo: 3 }),
        version({ id: "b", status: "approved", versionNo: 2 }),
      ],
    );
    expect(state.currentVersion?.id).toBe("b");
    expect(state.usable).toBe(true);
  });

  it.each(["rejected", "revoked"] as const)(
    "bản mới nhất bị %s và không còn bản nào sống → trạng thái đúng như vậy",
    (status) => {
      const state = deriveLineState(line, [review()], [version({ status })]);
      expect(state).toMatchObject({ audioStatus: status, usable: false, currentVersion: null });
    },
  );

  it("đổi giọng/chữ (khóa tệp khác): bản đã duyệt cũ không còn dùng, được đánh dấu lỗi thời, âm thanh coi như chưa có", () => {
    const state = deriveLineState(line, [review()], [version({ assetKey: "z".repeat(64) })]);
    expect(state).toMatchObject({ audioStatus: "missing", usable: false, staleApproved: true });
    const stale = deriveLineState(line, [review()], [version({ contentHash: "z".repeat(64) })]);
    expect(stale).toMatchObject({ audioStatus: "missing", usable: false, staleApproved: true });
  });

  it("tệp kiểm thử (test_only) bị bỏ qua hoàn toàn", () => {
    const state = deriveLineState(line, [review()], [version({ testOnly: true })]);
    expect(state).toMatchObject({ audioStatus: "missing", usable: false, staleApproved: false, currentVersion: null });
  });

  it("chỉ xét đúng lời đọc của mình", () => {
    const state = deriveLineState(
      line,
      [review({ entryId: "instruction:other" })],
      [version({ entryId: "instruction:other" })],
    );
    expect(state).toMatchObject({ scriptStatus: "pending", audioStatus: "missing", usable: false });
  });
});

describe("danh mục lời đọc cố định", () => {
  it("34 lời đọc: 17 câu lệnh + 17 phản hồi; mã duy nhất; luôn bắt đầu chờ duyệt", () => {
    expect(LIBRARY_ENTRIES).toHaveLength(34);
    expect(new Set(LIBRARY_ENTRIES.map((entry) => entry.id)).size).toBe(34);
    expect(LIBRARY_ENTRIES.filter((entry) => entry.purpose === "instruction")).toHaveLength(17);
    expect(LIBRARY_ENTRIES.filter((entry) => entry.purpose === "feedback")).toHaveLength(17);
    expect(LIBRARY_ENTRIES.every((entry) => entry.reviewStatus === "pending_review")).toBe(true);
  });

  it("mọi biến thể bài tập đều có đúng một lời đọc câu lệnh (không biến thể nào bị bỏ sót)", () => {
    const variants = Object.keys(VARIANTS);
    for (const variant of variants) {
      expect(libraryEntry(instructionEntryId(variant)), variant).toBeDefined();
    }
    expect(LIBRARY_ENTRIES.filter((entry) => entry.purpose === "instruction")).toHaveLength(variants.length);
  });

  it("mọi lời đọc qua bộ kiểm tra yêu cầu của cổng TTS (không dữ liệu cá nhân, đúng mục đích, đúng độ dài)", () => {
    for (const entry of LIBRARY_ENTRIES) {
      const checked = checkTtsRequest({
        text: entry.text,
        purpose: entry.purpose,
        voiceKey: LIBRARY_VOICE.voiceKey,
        speed: LIBRARY_VOICE.speed,
      });
      expect(checked.ok, entry.id).toBe(true);
    }
  });

  it("khóa tệp phụ thuộc nhà cung cấp, mục đích, giọng, tốc độ, phiên bản cấu hình và chữ: đổi một thứ là khóa khác", () => {
    const entry = LIBRARY_ENTRIES[0]!;
    const base = { providerId: LIBRARY_PROVIDER_ID, purpose: entry.purpose, text: entry.text, voice: LIBRARY_VOICE };
    expect(assetKeyOf(base)).toBe(entry.assetKey);
    expect(assetKeyOf({ ...base, voice: { ...LIBRARY_VOICE, configVersion: "viettel-minhquan-0.9-v2" } })).not.toBe(
      entry.assetKey,
    );
    expect(assetKeyOf({ ...base, voice: { ...LIBRARY_VOICE, speed: "normal" } })).not.toBe(entry.assetKey);
    expect(assetKeyOf({ ...base, voice: { ...LIBRARY_VOICE, voiceKey: "vi-female-1" } })).not.toBe(entry.assetKey);
    expect(assetKeyOf({ ...base, text: `${entry.text} Nhé.` })).not.toBe(entry.assetKey);
    // Khoảng trắng đầu/cuối được chuẩn hóa nên không làm đổi khóa.
    expect(assetKeyOf({ ...base, text: ` ${entry.text} ` })).toBe(entry.assetKey);
    expect(assetKeyOf({ ...base, providerId: "fpt" as never })).not.toBe(entry.assetKey);
  });

  it("giọng thư viện là giọng thử đã chọn (nam miền Nam, tốc độ chậm) và KHÔNG phải cấu hình tạm", () => {
    expect(LIBRARY_PROVIDER_ID).toBe("viettel");
    expect(LIBRARY_VOICE).toEqual({ voiceKey: "vi-male-1", speed: "slow", configVersion: "viettel-minhquan-0.9-v1" });
    expect(LIBRARY_VOICE.configVersion).not.toMatch(/provisional/u);
  });
});
