// @vitest-environment node
import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { AUDIO_MAX_BYTES } from "@/features/audio-library/limits";
import { fail, ok, type Result } from "@/server/result";
import { processAudioUpload, type UploadDeps } from "@/server/audio-library/upload";
import { ascii, concat, m4a, wav, webm } from "./fixtures";

const SCHOOL = "11111111-1111-4111-8111-111111111111";
const ASSET = "22222222-2222-4222-8222-222222222222";

function makeDeps(over: Partial<UploadDeps> = {}) {
  let n = 0;
  const calls: string[] = [];
  const deps: UploadDeps = {
    schoolId: SCHOOL,
    newId: () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`,
    ensureAsset: vi.fn(async () => (calls.push("ensure"), ok(ASSET))),
    consentActive: vi.fn(async () => ok(true)),
    putObject: vi.fn(async () => (calls.push("put"), ok(null))),
    removeObject: vi.fn(async () => void calls.push("remove")),
    createVersion: vi.fn(async () => (calls.push("create"), ok({ versionNo: 1 }))),
    ...over,
  };
  return { deps, calls };
}

const fileOf = (bytes: Uint8Array, name = "ban-ghi.wav", type = "audio/wav") =>
  new File([bytes as BlobPart], name, { type });
const input = (file: unknown, unitText: unknown = "b") => ({ unitKind: "phoneme", unitText, file });

describe("tải bản ghi lên", () => {
  it("tệp hợp lệ → bản nháp: tải lên Storage rồi ghi metadata với khóa do máy chủ sinh", async () => {
    const { deps, calls } = makeDeps();
    const bytes = wav(1);
    const result = await processAudioUpload(deps, input(fileOf(bytes)));
    expect(result.ok).toBe(true);
    expect(calls).toEqual(["ensure", "put", "create"]);
    const put = vi.mocked(deps.putObject).mock.calls[0]!;
    expect(put[0]).toBe(`${SCHOOL}/${ASSET}/00000000-0000-4000-8000-000000000001.wav`);
    expect(put[2]).toBe("audio/wav");
    const created = vi.mocked(deps.createVersion).mock.calls[0]![0];
    expect(created).toMatchObject({
      assetId: ASSET,
      storageKey: put[0],
      mimeType: "audio/wav",
      sizeBytes: bytes.byteLength,
    });
    expect(created.contentHash).toBe(createHash("sha256").update(bytes).digest("hex"));
    expect(created.durationMs).toBeGreaterThan(900);
    expect(created.durationMs).toBeLessThan(1100);
  });

  it("khóa đối tượng chỉ gồm UUID — không dùng tên tệp, tên giáo viên hay nội dung do client gửi", async () => {
    const { deps } = makeDeps();
    await processAudioUpload(deps, input(fileOf(wav(1), "../../etc/Co-Lan-ghi-am.wav")));
    const key = vi.mocked(deps.putObject).mock.calls[0]![0];
    expect(key).toMatch(/^[0-9a-f-]{36}\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.wav$/u);
    expect(key).not.toMatch(/etc|Lan|\.\./u);
  });

  it("định dạng lấy theo NỘI DUNG, không theo tên/MIME khai báo: WebM khai là .mp3", async () => {
    const { deps } = makeDeps();
    const result = await processAudioUpload(deps, input(fileOf(webm({ seconds: 1 }), "x.mp3", "audio/mpeg")));
    expect(result.ok).toBe(true);
    expect(vi.mocked(deps.putObject).mock.calls[0]![2]).toBe("audio/webm");
    expect(vi.mocked(deps.putObject).mock.calls[0]![0]).toMatch(/\.webm$/u);
  });

  it("tệp rỗng bị từ chối, không chạm Storage hay CSDL", async () => {
    const { deps, calls } = makeDeps();
    expect(await processAudioUpload(deps, input(fileOf(new Uint8Array(0))))).toEqual(fail("AUDIO_EMPTY"));
    expect(calls).toEqual([]);
  });

  it("tệp quá lớn bị từ chối trước khi đọc nội dung", async () => {
    const { deps, calls } = makeDeps();
    const big = new File([new Uint8Array(AUDIO_MAX_BYTES + 1)], "to.wav", { type: "audio/wav" });
    expect(await processAudioUpload(deps, input(big))).toEqual(fail("AUDIO_TOO_LARGE"));
    expect(calls).toEqual([]);
  });

  it("MIME giả: văn bản/HTML/ảnh khai là audio/* bị từ chối", async () => {
    const { deps, calls } = makeDeps();
    for (const bytes of [
      ascii("<html><body>khong phai am thanh</body></html>"),
      concat(Uint8Array.of(0x89, 0x50, 0x4e, 0x47, 13, 10, 26, 10), new Uint8Array(100)),
    ]) {
      expect(await processAudioUpload(deps, input(fileOf(bytes, "a.mp3", "audio/mpeg")))).toEqual(
        fail("AUDIO_UNSUPPORTED"),
      );
    }
    expect(calls).toEqual([]);
  });

  it("đuôi hợp lệ nhưng nội dung sai (WAV hỏng) bị từ chối", async () => {
    const { deps, calls } = makeDeps();
    const broken = wav(1).slice(0, 44);
    expect(await processAudioUpload(deps, input(fileOf(broken)))).toEqual(fail("AUDIO_INVALID"));
    expect(calls).toEqual([]);
  });

  it("quá ngắn / quá dài / có hình ảnh", async () => {
    const { deps } = makeDeps();
    expect(await processAudioUpload(deps, input(fileOf(wav(0.1))))).toEqual(fail("AUDIO_TOO_SHORT"));
    expect(await processAudioUpload(deps, input(fileOf(wav(10.5, 8000))))).toEqual(fail("AUDIO_TOO_LONG"));
    expect(await processAudioUpload(deps, input(fileOf(m4a(1, { video: true }), "v.m4a", "audio/mp4")))).toEqual(
      fail("AUDIO_UNSUPPORTED"),
    );
  });

  it("chỉ nhận đơn vị trong danh mục P0 và trường hợp lệ", async () => {
    const { deps, calls } = makeDeps();
    for (const bad of [
      { unitKind: "phoneme", unitText: "zz", file: fileOf(wav(1)) },
      { unitKind: "phoneme", unitText: "y", file: fileOf(wav(1)) },
      { unitKind: "rime", unitText: "an", file: fileOf(wav(1)) },
      { unitKind: "phoneme", unitText: "b", file: "không phải tệp" },
      { unitKind: "phoneme", unitText: 42, file: fileOf(wav(1)) },
    ]) {
      expect(await processAudioUpload(deps, bad)).toEqual(fail("INVALID_INPUT"));
    }
    expect(calls).toEqual([]);
  });

  it("chưa đồng ý dùng giọng → không tải gì lên", async () => {
    const { deps, calls } = makeDeps({ consentActive: vi.fn(async () => ok(false)) });
    expect(await processAudioUpload(deps, input(fileOf(wav(1))))).toEqual(fail("VOICE_CONSENT_REQUIRED"));
    expect(calls).toEqual([]);
  });

  it("tính năng chưa bật (CSDL từ chối) → không tải gì lên", async () => {
    const { deps, calls } = makeDeps({ ensureAsset: vi.fn(async () => fail<string>("AUDIO_RECORDING_DISABLED")) });
    expect(await processAudioUpload(deps, input(fileOf(wav(1))))).toEqual(fail("AUDIO_RECORDING_DISABLED"));
    expect(calls).toEqual([]);
  });

  it("tải Storage lỗi → không ghi metadata (không có bản ghi trỏ vào tệp không tồn tại)", async () => {
    const { deps, calls } = makeDeps({ putObject: vi.fn(async () => fail<null>("STORAGE_UNAVAILABLE")) });
    expect(await processAudioUpload(deps, input(fileOf(wav(1))))).toEqual(fail("STORAGE_UNAVAILABLE"));
    expect(calls).not.toContain("create");
  });

  it("ghi metadata lỗi → gỡ tệp vừa tải, không để tệp mồ côi", async () => {
    const { deps } = makeDeps({ createVersion: vi.fn(async () => fail<{ versionNo: number }>("DUPLICATE_AUDIO")) });
    expect(await processAudioUpload(deps, input(fileOf(wav(1))))).toEqual(fail("DUPLICATE_AUDIO"));
    const key = vi.mocked(deps.putObject).mock.calls[0]![0];
    expect(deps.removeObject).toHaveBeenCalledExactlyOnceWith(key);
  });

  it("không ghi đè: mỗi lần tải dùng một khóa mới, khóa cũ không bị chạm", async () => {
    const { deps } = makeDeps();
    await processAudioUpload(deps, input(fileOf(wav(1))));
    await processAudioUpload(deps, input(fileOf(wav(1.2))));
    const keys = vi.mocked(deps.putObject).mock.calls.map((call) => call[0]);
    expect(new Set(keys).size).toBe(2);
    expect(deps.removeObject).not.toHaveBeenCalled();
  });

  it("luôn tạo bản nháp: không có đường tự gửi duyệt hay tự duyệt", async () => {
    const { deps } = makeDeps();
    const result: Result<unknown> = await processAudioUpload(deps, input(fileOf(wav(1))));
    expect(result.ok).toBe(true);
    // Giao diện của deps không có thao tác gửi duyệt/duyệt.
    expect(Object.keys(deps).sort()).toEqual(
      ["consentActive", "createVersion", "ensureAsset", "newId", "putObject", "removeObject", "schoolId"].sort(),
    );
  });
});
