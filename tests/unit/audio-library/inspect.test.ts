import { describe, expect, it } from "vitest";
import { inspectAudio } from "@/features/audio-library/inspect";
import { AUDIO_MAX_BYTES } from "@/features/audio-library/limits";
import { ascii, concat, fragmentedM4a, m4a, mp3, oggFlac, oggOpus, wav, webm } from "./fixtures";

const near = (actual: number, expected: number, tolerance = 40) => Math.abs(actual - expected) <= tolerance;

describe("inspectAudio — nhận định dạng và thời lượng theo NỘI DUNG", () => {
  it("WAV PCM", () => {
    const result = inspectAudio(wav(1.5));
    expect(result).toMatchObject({ ok: true, mime: "audio/wav" });
    expect(result.ok && near(result.durationMs, 1500)).toBe(true);
  });

  it("WAV chưa chốt tiêu đề (data = 0xFFFFFFFF) lấy phần còn lại của tệp", () => {
    const bytes = wav(1);
    new DataView(bytes.buffer, bytes.byteOffset).setUint32(40, 0xffffffff, true);
    const result = inspectAudio(bytes);
    expect(result.ok && near(result.durationMs, 1000)).toBe(true);
  });

  it("Ogg Opus: thời lượng từ granule trừ pre-skip", () => {
    const result = inspectAudio(oggOpus(2));
    expect(result).toMatchObject({ ok: true, mime: "audio/ogg" });
    expect(result.ok && near(result.durationMs, 2000, 5)).toBe(true);
  });

  it("WebM Opus kiểu Chrome (kích thước 'không biết', không có Duration): tính từ các khối", () => {
    const result = inspectAudio(webm({ seconds: 1.2 }));
    expect(result).toMatchObject({ ok: true, mime: "audio/webm" });
    expect(result.ok && near(result.durationMs, 1200)).toBe(true);
  });

  it("WebM có phần tử Duration vẫn lấy giá trị lớn hơn trong hai nguồn (không tin mỗi Duration)", () => {
    const result = inspectAudio(webm({ seconds: 2, withDuration: true }));
    expect(result.ok && near(result.durationMs, 2000)).toBe(true);
  });

  it("M4A (mvhd)", () => {
    const result = inspectAudio(m4a(1.75));
    expect(result).toMatchObject({ ok: true, mime: "audio/mp4" });
    expect(result.ok && near(result.durationMs, 1750)).toBe(true);
  });

  it("MP4 phân đoạn kiểu Safari (mvhd.duration = 0): cộng thời lượng mẫu trong moof/trun", () => {
    const result = inspectAudio(fragmentedM4a(50));
    expect(result).toMatchObject({ ok: true, mime: "audio/mp4" });
    expect(result.ok && near(result.durationMs, (50 * 1024 * 1000) / 44100, 5)).toBe(true);
  });

  it("MP3 lớp III (có và không có thẻ ID3)", () => {
    for (const id3 of [false, true]) {
      const result = inspectAudio(mp3(40, { id3 }));
      expect(result).toMatchObject({ ok: true, mime: "audio/mpeg" });
      expect(result.ok && near(result.durationMs, (40 * 1152 * 1000) / 44100, 5)).toBe(true);
    }
  });
});

describe("inspectAudio — từ chối", () => {
  it("tệp rỗng", () => {
    expect(inspectAudio(new Uint8Array(0))).toEqual({ ok: false, code: "AUDIO_EMPTY" });
  });

  it("tệp quá lớn (kiểm tra trước khi phân tích)", () => {
    expect(inspectAudio(new Uint8Array(AUDIO_MAX_BYTES + 1))).toEqual({ ok: false, code: "AUDIO_TOO_LARGE" });
  });

  it("dữ liệu ngẫu nhiên / văn bản / HTML đặt tên .mp3 → không nhận ra", () => {
    for (const bytes of [
      ascii("Day khong phai am thanh, chi la van ban dai hon muoi hai byte."),
      ascii("<html><body>x</body></html>"),
    ]) {
      expect(inspectAudio(bytes)).toEqual({ ok: false, code: "AUDIO_UNSUPPORTED" });
    }
    const noise = Uint8Array.from({ length: 4096 }, (_, i) => (i * 131 + 17) % 251);
    expect(inspectAudio(noise).ok).toBe(false);
  });

  it("ảnh PNG/JPEG/PDF đổi đuôi .wav → không nhận ra", () => {
    const png = concat(Uint8Array.of(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a), new Uint8Array(64));
    const jpeg = concat(Uint8Array.of(0xff, 0xd8, 0xff, 0xe0), new Uint8Array(64));
    const pdf = concat(ascii("%PDF-1.7\n"), new Uint8Array(64));
    for (const bytes of [png, jpeg, pdf]) expect(inspectAudio(bytes)).toEqual({ ok: false, code: "AUDIO_UNSUPPORTED" });
  });

  it("MP3 giả: chỉ có vài byte 0xFFFB ở đầu", () => {
    const fake = concat(Uint8Array.of(0xff, 0xfb, 0x90, 0x00), new Uint8Array(2000));
    expect(inspectAudio(fake).ok).toBe(false);
  });

  it("WAV có tiêu đề nhưng không có dữ liệu → hỏng", () => {
    const bytes = wav(1).slice(0, 44);
    expect(inspectAudio(bytes)).toEqual({ ok: false, code: "AUDIO_INVALID" });
  });

  it("quá ngắn (< 0,3 giây) và quá dài (> 10 giây)", () => {
    expect(inspectAudio(wav(0.1))).toEqual({ ok: false, code: "AUDIO_TOO_SHORT" });
    expect(inspectAudio(wav(10.5, 8000))).toEqual({ ok: false, code: "AUDIO_TOO_LONG" });
    expect(inspectAudio(wav(10, 8000)).ok).toBe(true);
  });

  it("WebM/MP4 có luồng hình bị từ chối (chỉ âm thanh)", () => {
    expect(inspectAudio(webm({ seconds: 1, videoTrack: true }))).toEqual({ ok: false, code: "AUDIO_UNSUPPORTED" });
    expect(inspectAudio(m4a(1, { video: true }))).toEqual({ ok: false, code: "AUDIO_UNSUPPORTED" });
  });

  it("WebM codec lạ, Ogg FLAC → không hỗ trợ", () => {
    expect(inspectAudio(webm({ seconds: 1, codec: "A_AAC" }))).toEqual({ ok: false, code: "AUDIO_UNSUPPORTED" });
    expect(inspectAudio(oggFlac())).toEqual({ ok: false, code: "AUDIO_UNSUPPORTED" });
  });

  it("Ogg có rác ở cuối tệp → hỏng", () => {
    expect(inspectAudio(concat(oggOpus(1), new Uint8Array(10)))).toEqual({ ok: false, code: "AUDIO_INVALID" });
  });

  it("không bao giờ ném lỗi với đầu vào bị cắt cụt ở mọi độ dài", () => {
    for (const source of [wav(1), oggOpus(1), webm({ seconds: 0.5 }), m4a(1), fragmentedM4a(20), mp3(10)]) {
      for (let cut = 0; cut < source.byteLength; cut += Math.max(1, Math.floor(source.byteLength / 60))) {
        expect(() => inspectAudio(source.slice(0, cut))).not.toThrow();
      }
    }
  });
});
