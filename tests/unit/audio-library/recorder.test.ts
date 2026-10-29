import { describe, expect, it } from "vitest";
import {
  mapMediaError,
  pickRecorderMime,
  RECORDER_ERRORS,
  RECORDER_INITIAL,
  recorderReducer,
  type RecorderState,
} from "@/features/audio-library/recorder";
import { parseByteRange } from "@/server/audio-library/range";
import { vi } from "@/strings/vi";

describe("chọn định dạng MediaRecorder theo trình duyệt", () => {
  it("Chrome/Firefox: WebM Opus; Safari/iPhone: MP4 (không cố định WebM)", () => {
    expect(pickRecorderMime((m) => m === "audio/webm;codecs=opus" || m === "audio/webm")).toBe(
      "audio/webm;codecs=opus",
    );
    expect(pickRecorderMime((m) => m === "audio/mp4")).toBe("audio/mp4");
    expect(pickRecorderMime((m) => m.startsWith("audio/ogg"))).toBe("audio/ogg;codecs=opus");
  });

  it("không định dạng nào / không có API → null (chỉ còn cách tải tệp lên)", () => {
    expect(pickRecorderMime(() => false)).toBeNull();
    expect(pickRecorderMime(undefined)).toBeNull();
    expect(pickRecorderMime(null)).toBeNull();
  });

  it("isTypeSupported ném lỗi thì coi là không hỗ trợ, không làm hỏng trang", () => {
    expect(
      pickRecorderMime(() => {
        throw new Error("boom");
      }),
    ).toBeNull();
  });
});

describe("lỗi micro có hướng dẫn dễ hiểu", () => {
  it("ánh xạ tên lỗi của trình duyệt", () => {
    expect(mapMediaError("NotAllowedError")).toBe("MIC_DENIED");
    expect(mapMediaError("SecurityError")).toBe("MIC_DENIED");
    expect(mapMediaError("NotFoundError")).toBe("MIC_NOT_FOUND");
    expect(mapMediaError("NotReadableError")).toBe("MIC_BUSY");
    expect(mapMediaError("Gì đó lạ")).toBe("RECORD_FAILED");
    expect(mapMediaError(undefined)).toBe("RECORD_FAILED");
  });

  it("mỗi mã lỗi có câu tiếng Việt, không có thuật ngữ kỹ thuật", () => {
    for (const code of RECORDER_ERRORS) {
      const text = vi.audioStudio.recorder.errors[code];
      expect(text.length).toBeGreaterThan(20);
      expect(text).not.toMatch(/\b(500|RLS|exception|NotAllowedError|MediaRecorder)\b/iu);
    }
    expect(vi.audioStudio.recorder.errors.MIC_DENIED).toMatch(/cho phép micro/u);
    expect(vi.audioStudio.recorder.errors.MIC_DENIED).toMatch(/tải tệp/u);
  });

  it("mọi mã lỗi của thư viện âm thanh có câu tiếng Việt", () => {
    for (const code of [
      "AUDIO_RECORDING_DISABLED",
      "VOICE_CONSENT_REQUIRED",
      "AUDIO_EMPTY",
      "AUDIO_TOO_LARGE",
      "AUDIO_UNSUPPORTED",
      "AUDIO_INVALID",
      "AUDIO_TOO_SHORT",
      "AUDIO_TOO_LONG",
      "DUPLICATE_AUDIO",
      "PRONUNCIATION_UNCONFIRMED",
      "PRONUNCIATION_LOCKED",
      "LABEL_MISMATCH",
      "LISTEN_REQUIRED",
      "NOTE_REQUIRED",
      "STORAGE_UNAVAILABLE",
    ] as const) {
      expect(vi.errors[code]).toMatch(/\S{2,}/u);
      expect(vi.errors[code]).not.toMatch(/RLS|violation|\b5\d\d\b/iu);
    }
  });
});

describe("máy trạng thái ghi âm", () => {
  const run = (actions: Parameters<typeof recorderReducer>[1][], from: RecorderState = RECORDER_INITIAL) =>
    actions.reduce(recorderReducer, from);

  it("luồng bình thường: xin quyền → ghi → dừng → bản nghe thử (chưa gửi gì)", () => {
    const state = run([
      { type: "request" },
      { type: "started" },
      { type: "stopped", durationMs: 1500, sizeBytes: 4000 },
    ]);
    expect(state).toEqual({ phase: "recorded", durationMs: 1500, sizeBytes: 4000 });
  });

  it("từ chối quyền micro → lỗi có mã, không có bản ghi", () => {
    const state = run([{ type: "request" }, { type: "failed", code: "MIC_DENIED" }]);
    expect(state).toEqual({ phase: "error", code: "MIC_DENIED" });
  });

  it("bản ghi rỗng / quá ngắn → lỗi, không thành 'recorded'", () => {
    expect(
      run([{ type: "request" }, { type: "started" }, { type: "stopped", durationMs: 2000, sizeBytes: 0 }]),
    ).toEqual({
      phase: "error",
      code: "EMPTY_RECORDING",
    });
    expect(
      run([{ type: "request" }, { type: "started" }, { type: "stopped", durationMs: 100, sizeBytes: 500 }]),
    ).toEqual({
      phase: "error",
      code: "TOO_SHORT",
    });
  });

  it("thiết bị bị ngắt khi đang ghi → lỗi DEVICE_LOST, bỏ bản ghi dở", () => {
    const state = run([{ type: "request" }, { type: "started" }, { type: "failed", code: "DEVICE_LOST" }]);
    expect(state).toEqual({ phase: "error", code: "DEVICE_LOST" });
  });

  it("không chồng hai phiên ghi; 'stopped' bất ngờ bị bỏ qua", () => {
    const recording = run([{ type: "request" }, { type: "started" }]);
    expect(run([{ type: "request" }], recording)).toBe(recording);
    expect(run([{ type: "stopped", durationMs: 1000, sizeBytes: 100 }])).toEqual(RECORDER_INITIAL);
  });

  it("ghi lại: từ 'recorded' hoặc lỗi quay về ban đầu rồi xin quyền lại", () => {
    const recorded = run([
      { type: "request" },
      { type: "started" },
      { type: "stopped", durationMs: 900, sizeBytes: 100 },
    ]);
    expect(run([{ type: "reset" }], recorded)).toEqual(RECORDER_INITIAL);
    expect(run([{ type: "request" }], recorded)).toEqual({ phase: "requesting" });
  });
});

describe("Range cho thẻ <audio> (Safari bắt buộc)", () => {
  it("khoảng đầy đủ, mở đuôi, hậu tố", () => {
    expect(parseByteRange("bytes=0-99", 1000)).toEqual({ start: 0, end: 99 });
    expect(parseByteRange("bytes=500-", 1000)).toEqual({ start: 500, end: 999 });
    expect(parseByteRange("bytes=-100", 1000)).toEqual({ start: 900, end: 999 });
    expect(parseByteRange("bytes=0-0", 1000)).toEqual({ start: 0, end: 0 });
  });

  it("kẹp end vào cuối tệp; không thỏa mãn → null", () => {
    expect(parseByteRange("bytes=900-5000", 1000)).toEqual({ start: 900, end: 999 });
    for (const bad of [
      "bytes=2000-3000",
      "bytes=5-2",
      "bytes=-",
      "bytes=a-b",
      "items=0-1",
      "bytes=0-1,5-6",
      "bytes=-0",
    ]) {
      expect(parseByteRange(bad, 1000)).toBeNull();
    }
    expect(parseByteRange("bytes=0-1", 0)).toBeNull();
  });
});
