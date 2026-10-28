import { describe, expect, it } from "vitest";
import { VARIANT_IDS } from "@/features/exercises/core/module";
import type { SupportLevel } from "@/types/learning";
import { buildTtsScriptCatalog } from "@/server/tts/catalog";
import { assetKeyOf } from "@/server/tts/hash";
import { decideTtsPlay, decideTtsPlayback, type TtsPlayContext } from "@/server/tts/playback";
import { scriptStatusOf } from "@/server/tts/script-review";
import { checkVersionUsable, findReusableVersion } from "@/server/tts/versions";
import { PROVISIONAL_VOICE } from "@/server/tts/voice";
import { approve, TEST_VOICE, VARIANTS, versionFor } from "./tts-helpers";

const LEVELS: SupportLevel[] = [3, 2, 1, 0];
const catalog = buildTtsScriptCatalog({ voice: TEST_VOICE });
const entry = catalog.entries.find((e) => e.id === "instruction:picture_onset")!;
const approvedScript = scriptStatusOf(entry, [approve(entry)]);

const usable = (over: Partial<Parameters<typeof checkVersionUsable>[0]> = {}) =>
  checkVersionUsable({ version: versionFor(entry), entry, scriptStatus: approvedScript, voice: TEST_VOICE, ...over });

describe("điều kiện dùng một phiên bản TTS", () => {
  it("chỉ phiên bản đã duyệt (nghe + cách đọc), lời đọc đã duyệt, khớp hash/khóa/giọng mới dùng được", () => {
    expect(approvedScript).toBe("approved");
    expect(usable()).toEqual({ ok: true });
  });

  it("tệp mock/nhà cung cấp kiểm thử không bao giờ được coi là đã duyệt, kể cả khi mọi trường khác đạt", () => {
    expect(usable({ version: versionFor(entry, { provider: "mock" }) })).toEqual({ ok: false, code: "TEST_ONLY" });
    expect(usable({ version: versionFor(entry, { provider: "none" }) })).toEqual({ ok: false, code: "TEST_ONLY" });
    expect(usable({ version: versionFor(entry, { testOnly: true }) })).toEqual({ ok: false, code: "TEST_ONLY" });
  });

  it("chưa duyệt, bị từ chối, bị thu hồi, đã bị thay thế → không dùng", () => {
    expect(usable({ version: versionFor(entry, { status: "pending_review" }) })).toEqual({
      ok: false,
      code: "NOT_APPROVED",
    });
    expect(usable({ version: versionFor(entry, { status: "rejected" }) })).toEqual({ ok: false, code: "NOT_APPROVED" });
    expect(usable({ version: versionFor(entry, { status: "revoked" }) })).toEqual({ ok: false, code: "REVOKED" });
    expect(usable({ version: versionFor(entry, { status: "superseded" }) })).toEqual({ ok: false, code: "SUPERSEDED" });
  });

  it("thiếu người duyệt, chưa nghe hoặc chưa xác nhận cách đọc → không dùng (không có trạng thái approved suông)", () => {
    for (const over of [
      { reviewedBy: null },
      { reviewedAt: null },
      { listened: false },
      { pronunciationConfirmed: false },
    ]) {
      expect(usable({ version: versionFor(entry, over) }), JSON.stringify(over)).toEqual({
        ok: false,
        code: "NOT_REVIEWED",
      });
    }
  });

  it("lời đọc chưa duyệt (hoặc bị từ chối) → không dùng dù tệp đã duyệt", () => {
    expect(usable({ scriptStatus: "pending_review" })).toEqual({ ok: false, code: "SCRIPT_NOT_APPROVED" });
    expect(usable({ scriptStatus: "rejected" })).toEqual({ ok: false, code: "SCRIPT_NOT_APPROVED" });
  });

  it("đổi chữ → tệp cũ không khớp nội dung đã duyệt", () => {
    const old = versionFor(entry);
    const text = `${entry.text} nhé`;
    const edited = { ...entry, text, contentHash: "9".repeat(64) };
    expect(checkVersionUsable({ version: old, entry: edited, scriptStatus: "approved", voice: TEST_VOICE })).toEqual({
      ok: false,
      code: "CONTENT_CHANGED",
    });
    // hash khớp nhưng chữ khác (dữ liệu giả mạo) → khóa tệp không khớp
    const forged = { ...entry, text };
    expect(checkVersionUsable({ version: old, entry: forged, scriptStatus: "approved", voice: TEST_VOICE })).toEqual({
      ok: false,
      code: "ASSET_MISMATCH",
    });
  });

  it("đổi giọng/tốc độ/phiên bản cấu hình → tệp cũ không dùng; giọng chưa chọn → không dùng", () => {
    const old = versionFor(entry);
    expect(usable({ version: old, voice: { ...TEST_VOICE, configVersion: "test-voice-2" } })).toEqual({
      ok: false,
      code: "VOICE_CHANGED",
    });
    expect(usable({ version: old, voice: { ...TEST_VOICE, speed: "normal" } })).toEqual({
      ok: false,
      code: "VOICE_CHANGED",
    });
    expect(usable({ voice: PROVISIONAL_VOICE })).toEqual({ ok: false, code: "VOICE_NOT_CHOSEN" });
    expect(usable({ version: versionFor(entry, { voice: PROVISIONAL_VOICE }), voice: PROVISIONAL_VOICE })).toEqual({
      ok: false,
      code: "VOICE_NOT_CHOSEN",
    });
  });

  it("bản ghi hỏng/trường lạ → INVALID_RECORD", () => {
    expect(usable({ version: { ...versionFor(entry), studentId: "x" } })).toEqual({
      ok: false,
      code: "INVALID_RECORD",
    });
    expect(
      usable({ version: { ...versionFor(entry), audio: { ...versionFor(entry).audio, inspected: false } } }),
    ).toEqual({ ok: false, code: "INVALID_RECORD" });
    expect(usable({ version: null })).toEqual({ ok: false, code: "INVALID_RECORD" });
  });
});

describe("tái sử dụng tệp", () => {
  const twin = { ...entry, id: "instruction:ban-sao" };

  it("hai mục cùng khóa tệp dùng chung một tệp đã duyệt, miễn lời đọc của mục kia cũng đã duyệt", () => {
    const version = versionFor(entry);
    const found = findReusableVersion({
      versions: [version],
      entry: twin,
      scriptStatus: "approved",
      voice: TEST_VOICE,
      providerId: "google",
    });
    expect(found).toMatchObject({ ok: true, version: { versionId: version.versionId } });
    const notApproved = findReusableVersion({
      versions: [version],
      entry: twin,
      scriptStatus: "pending_review",
      voice: TEST_VOICE,
      providerId: "google",
    });
    expect(notApproved).toEqual({ ok: false, reasons: ["SCRIPT_NOT_APPROVED"] });
  });

  it("không tái sử dụng tệp đã thu hồi, bị thay, của nhà cung cấp/giọng khác hoặc chữ khác", () => {
    const params = { entry, scriptStatus: "approved" as const, voice: TEST_VOICE, providerId: "google" };
    expect(findReusableVersion({ ...params, versions: [versionFor(entry, { status: "revoked" })] })).toEqual({
      ok: false,
      reasons: ["REVOKED"],
    });
    expect(findReusableVersion({ ...params, versions: [versionFor(entry, { status: "superseded" })] })).toEqual({
      ok: false,
      reasons: ["SUPERSEDED"],
    });
    expect(findReusableVersion({ ...params, versions: [versionFor(entry, { provider: "mock" })] }).ok).toBe(false);
    expect(
      findReusableVersion({
        ...params,
        versions: [versionFor(entry, { voice: { ...TEST_VOICE, voiceKey: "vi-male-1" } })],
      }).ok,
    ).toBe(false);
    const other = catalog.entries.find((e) => e.id === "instruction:visual_match")!;
    expect(findReusableVersion({ ...params, versions: [versionFor(other)] }).ok).toBe(false);
  });

  it("có nhiều bản dùng được thì lấy bản duyệt mới nhất", () => {
    const older = versionFor(entry, { reviewedAt: "2026-10-01T00:00:00.000Z" });
    const newer = versionFor(entry, { reviewedAt: "2026-10-20T00:00:00.000Z" });
    const found = findReusableVersion({
      versions: [older, newer],
      entry,
      scriptStatus: "approved",
      voice: TEST_VOICE,
      providerId: "google",
    });
    expect(found.ok && found.version.versionId).toBe(newer.versionId);
    expect(assetKeyOf({ providerId: "google", purpose: entry.purpose, text: entry.text, voice: TEST_VOICE })).toBe(
      newer.assetKey,
    );
  });
});

describe("điều kiện phát cho học sinh (AD-35, dùng lại decideBefore/AfterGrading)", () => {
  const ctx = (variant: keyof typeof VARIANTS, over: Partial<TtsPlayContext>): TtsPlayContext => ({
    policy: VARIANTS[variant].audioPolicy,
    role: "instruction",
    supportLevel: 3,
    graded: false,
    muted: false,
    flagEnabled: true,
    hintTracking: false,
    ...over,
  });

  it("cờ phát tắt → không phát bất kỳ khe nào ở bất kỳ mức nào", () => {
    for (const id of VARIANT_IDS)
      for (const role of ["instruction", "stimulus", "options", "model", "feedback"] as const)
        for (const level of LEVELS)
          for (const graded of [false, true])
            expect(decideTtsPlayback(ctx(id, { role, supportLevel: level, graded, flagEnabled: false }))).toEqual({
              ok: false,
              reason: "FLAG_OFF",
            });
  });

  it("học sinh tắt âm thanh → không phát", () => {
    expect(decideTtsPlayback(ctx("picture_onset", { muted: true }))).toEqual({ ok: false, reason: "MUTED" });
  });

  it("âm đơn lẻ luôn cần bản ghi giáo viên, không đi qua TTS", () => {
    for (const level of LEVELS)
      expect(decideTtsPlayback(ctx("listen_letter", { role: "stimulus", supportLevel: level }))).toEqual({
        ok: false,
        reason: "TEACHER_RECORDING_REQUIRED",
      });
  });

  it("bài đọc từ/câu: không phát kích thích hay phương án ở MỌI mức, trước hay sau khi chấm", () => {
    const readers = VARIANT_IDS.filter((id) => VARIANTS[id].audioPolicy.objectiveKind === "reading");
    expect(readers.length).toBeGreaterThan(0);
    for (const id of readers)
      for (const role of ["stimulus", "options"] as const)
        for (const level of LEVELS)
          for (const graded of [false, true])
            expect(
              decideTtsPlayback(ctx(id, { role, supportLevel: level, graded })),
              `${id} ${role} H${level}`,
            ).toEqual({ ok: false, reason: "NOT_PERMITTED" });
  });

  it("đọc mẫu và phản hồi chỉ sau khi câu đã chấm", () => {
    expect(decideTtsPlayback(ctx("choose_picture", { role: "model" }))).toEqual({ ok: false, reason: "NOT_GRADED" });
    expect(decideTtsPlayback(ctx("choose_picture", { role: "feedback" }))).toEqual({ ok: false, reason: "NOT_GRADED" });
    expect(decideTtsPlayback(ctx("choose_picture", { role: "model", graded: true }))).toEqual({ ok: true });
    expect(decideTtsPlayback(ctx("choose_picture", { role: "feedback", graded: true }))).toEqual({ ok: true });
  });

  it("gợi ý bằng âm thanh bị KHÓA khi chưa có cơ chế ghi nhận; chỉ mở khi có hintTracking", () => {
    // câu lệnh ở H1 là "hint" theo chính sách
    expect(decideTtsPlayback(ctx("picture_onset", { supportLevel: 1 }))).toEqual({
      ok: false,
      reason: "HINT_TRACKING_UNAVAILABLE",
    });
    expect(decideTtsPlayback(ctx("picture_onset", { supportLevel: 1, hintTracking: true }))).toEqual({ ok: true });
    expect(decideTtsPlayback(ctx("picture_onset", { supportLevel: 0 }))).toEqual({
      ok: false,
      reason: "NOT_PERMITTED",
    });
    expect(decideTtsPlayback(ctx("picture_onset", { supportLevel: 3 }))).toEqual({ ok: true });
  });

  it("quyết định cuối cần CẢ chính sách LẪN tệp đã duyệt", () => {
    const base = { ...ctx("picture_onset", {}), entry, scriptStatus: approvedScript, voice: TEST_VOICE };
    expect(decideTtsPlay({ ...base, version: versionFor(entry) }).ok).toBe(true);
    expect(decideTtsPlay({ ...base, version: versionFor(entry, { status: "pending_review" }) })).toEqual({
      ok: false,
      reason: "NOT_APPROVED",
    });
    expect(decideTtsPlay({ ...base, version: versionFor(entry, { provider: "mock" }) })).toEqual({
      ok: false,
      reason: "TEST_ONLY",
    });
    expect(decideTtsPlay({ ...base, supportLevel: 0, version: versionFor(entry) })).toEqual({
      ok: false,
      reason: "NOT_PERMITTED",
    });
    expect(decideTtsPlay({ ...base, flagEnabled: false, version: versionFor(entry) })).toEqual({
      ok: false,
      reason: "FLAG_OFF",
    });
  });
});
