/**
 * Tệp âm thanh TỔNG HỢP cho kiểm thử (R10.2): dựng bằng mã, không chứa giọng người thật và không phải học liệu.
 * Chỉ đủ cấu trúc container để bộ kiểm tra theo nội dung (`inspectAudio`) nhận ra định dạng và tính thời lượng —
 * KHÔNG phải luồng Opus/AAC/MP3 giải mã được (không ai cần nghe chúng).
 */

const enc = new TextEncoder();
export const ascii = (text: string) => enc.encode(text);

export function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.byteLength, 0));
  let o = 0;
  for (const part of parts) {
    out.set(part, o);
    o += part.byteLength;
  }
  return out;
}

const u16le = (n: number) => Uint8Array.of(n & 255, (n >> 8) & 255);
const u32le = (n: number) => Uint8Array.of(n & 255, (n >> 8) & 255, (n >> 16) & 255, (n >>> 24) & 255);
const u32be = (n: number) => Uint8Array.of((n >>> 24) & 255, (n >> 16) & 255, (n >> 8) & 255, n & 255);

// ------------------------------------------------------------------ WAV: sóng sin 440 Hz, PCM 16-bit mono.
export function wav(seconds: number, sampleRate = 16000): Uint8Array {
  const samples = Math.round(seconds * sampleRate);
  const data = new Uint8Array(samples * 2);
  const view = new DataView(data.buffer);
  for (let i = 0; i < samples; i++)
    view.setInt16(i * 2, Math.round(Math.sin((2 * Math.PI * 440 * i) / sampleRate) * 8000), true);
  return concat(
    ascii("RIFF"),
    u32le(36 + data.byteLength),
    ascii("WAVE"),
    ascii("fmt "),
    u32le(16),
    u16le(1),
    u16le(1),
    u32le(sampleRate),
    u32le(sampleRate * 2),
    u16le(2),
    u16le(16),
    ascii("data"),
    u32le(data.byteLength),
    data,
  );
}

// ------------------------------------------------------------------ Ogg Opus
function oggPage(headerType: number, granule: number, serial: number, seq: number, payload: Uint8Array): Uint8Array {
  const segs: number[] = [];
  let left = payload.byteLength;
  while (left >= 255) {
    segs.push(255);
    left -= 255;
  }
  segs.push(left);
  const lo = granule % 2 ** 32;
  const hi = Math.floor(granule / 2 ** 32);
  return concat(
    ascii("OggS"),
    Uint8Array.of(0, headerType),
    u32le(lo),
    u32le(hi),
    u32le(serial),
    u32le(seq),
    u32le(0),
    Uint8Array.of(segs.length),
    Uint8Array.from(segs),
    payload,
  );
}

export function oggOpus(seconds: number, preSkip = 312): Uint8Array {
  const head = concat(ascii("OpusHead"), Uint8Array.of(1, 1), u16le(preSkip), u32le(48000), u16le(0), Uint8Array.of(0));
  const tags = concat(ascii("OpusTags"), u32le(0), u32le(0));
  return concat(
    oggPage(2, 0, 7, 0, head),
    oggPage(0, 0, 7, 1, tags),
    oggPage(4, Math.round(seconds * 48000) + preSkip, 7, 2, new Uint8Array(40)),
  );
}

export function oggFlac(): Uint8Array {
  return concat(
    oggPage(2, 0, 7, 0, concat(Uint8Array.of(0x7f), ascii("FLAC"), new Uint8Array(30))),
    oggPage(4, 4410, 7, 1, new Uint8Array(20)),
  );
}

// ------------------------------------------------------------------ WebM (Matroska/EBML) kiểu MediaRecorder của Chrome
function vintSize(n: number): Uint8Array {
  // Kích thước 4 byte, đủ cho dữ liệu thử.
  return Uint8Array.of(0x10 | ((n >>> 24) & 0x0f), (n >> 16) & 255, (n >> 8) & 255, n & 255);
}
const UNKNOWN_SIZE = Uint8Array.of(0x01, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff);
const el = (id: number[], body: Uint8Array) => concat(Uint8Array.from(id), vintSize(body.byteLength), body);
const uintEl = (id: number[], value: number) => el(id, Uint8Array.of(value & 255));

export type WebmOptions = {
  seconds: number;
  videoTrack?: boolean;
  codec?: string;
  docType?: string;
  withDuration?: boolean;
};

export function webm({
  seconds,
  videoTrack = false,
  codec = "A_OPUS",
  docType = "webm",
  withDuration = false,
}: WebmOptions): Uint8Array {
  const header = el([0x1a, 0x45, 0xdf, 0xa3], el([0x42, 0x82], ascii(docType)));
  const infoParts = [el([0x2a, 0xd7, 0xb1], u32be(1_000_000))];
  if (withDuration) {
    const f = new DataView(new ArrayBuffer(8));
    f.setFloat64(0, seconds * 1000);
    infoParts.push(el([0x44, 0x89], new Uint8Array(f.buffer)));
  }
  const info = el([0x15, 0x49, 0xa9, 0x66], concat(...infoParts));
  const audioTrack = el([0xae], concat(uintEl([0x83], 2), el([0x86], ascii(codec))));
  const tracks = el(
    [0x16, 0x54, 0xae, 0x6b],
    videoTrack ? concat(audioTrack, el([0xae], concat(uintEl([0x83], 1), el([0x86], ascii("V_VP8"))))) : audioTrack,
  );
  // Mỗi khối Opus 20 ms: SimpleBlock = số hiệu luồng (0x81) + dấu thời gian tương đối int16 + cờ + dữ liệu.
  const blocks: Uint8Array[] = [];
  const count = Math.round(seconds / 0.02);
  for (let i = 0; i < count; i++) {
    const rel = i * 20;
    blocks.push(el([0xa3], concat(Uint8Array.of(0x81, (rel >> 8) & 255, rel & 255, 0x80), new Uint8Array(8))));
  }
  // Segment và Cluster kích thước "không biết" như Chrome ghi trực tiếp.
  const cluster = concat(Uint8Array.from([0x1f, 0x43, 0xb6, 0x75]), UNKNOWN_SIZE, uintEl([0xe7], 0), ...blocks);
  return concat(header, Uint8Array.from([0x18, 0x53, 0x80, 0x67]), UNKNOWN_SIZE, info, tracks, cluster);
}

// ------------------------------------------------------------------ MP4 / M4A
function box(type: string, ...body: Uint8Array[]): Uint8Array {
  const payload = concat(...body);
  return concat(u32be(8 + payload.byteLength), ascii(type), payload);
}
const fullBox = (type: string, version: number, flags: number, ...body: Uint8Array[]) =>
  box(type, Uint8Array.of(version, (flags >> 16) & 255, (flags >> 8) & 255, flags & 255), ...body);

function trak(handler: "soun" | "vide", timescale: number, trackId = 1, sampleEntry = "mp4a"): Uint8Array {
  const tkhd = fullBox("tkhd", 0, 7, u32be(0), u32be(0), u32be(trackId), new Uint8Array(68));
  const mdhd = fullBox("mdhd", 0, 0, u32be(0), u32be(0), u32be(timescale), u32be(0), new Uint8Array(4));
  const hdlr = fullBox("hdlr", 0, 0, u32be(0), ascii(handler), new Uint8Array(12), Uint8Array.of(0));
  const stsd = fullBox("stsd", 0, 0, u32be(1), box(sampleEntry, new Uint8Array(28)));
  const minf = box("minf", box("stbl", stsd));
  return box("trak", tkhd, box("mdia", mdhd, hdlr, minf));
}
const ftyp = () => box("ftyp", ascii("M4A "), u32be(0), ascii("M4A "), ascii("isom"));
const mvhd = (timescale: number, duration: number) =>
  fullBox("mvhd", 0, 0, u32be(0), u32be(0), u32be(timescale), u32be(duration), new Uint8Array(80));

export function m4a(seconds: number, options: { video?: boolean } = {}): Uint8Array {
  const moov = box(
    "moov",
    mvhd(1000, Math.round(seconds * 1000)),
    trak("soun", 44100, 1),
    ...(options.video ? [trak("vide", 90000, 2, "avc1")] : []),
  );
  return concat(ftyp(), moov, box("mdat", new Uint8Array(64)));
}

/** MP4 phân đoạn như MediaRecorder của Safari: mvhd.duration = 0, thời lượng nằm trong các moof/trun. */
export function fragmentedM4a(sampleCount: number, samplesPerFrame = 1024, timescale = 44100): Uint8Array {
  const trex = fullBox("trex", 0, 0, u32be(1), u32be(1), u32be(samplesPerFrame), u32be(0), u32be(0));
  const moov = box("moov", mvhd(1000, 0), trak("soun", timescale, 1), box("mvex", trex));
  // trun: cờ 0x200 (có kích thước mẫu) → thời lượng mẫu lấy từ mặc định của trex.
  const trun = fullBox("trun", 0, 0x200, u32be(sampleCount), ...Array.from({ length: sampleCount }, () => u32be(100)));
  const tfhd = fullBox("tfhd", 0, 0x20000, u32be(1));
  const moof = box("moof", box("traf", tfhd, trun));
  return concat(ftyp(), moov, moof, box("mdat", new Uint8Array(32)));
}

// ------------------------------------------------------------------ MP3: MPEG-1 lớp III, 128 kbps, 44,1 kHz
export function mp3(frames: number, options: { id3?: boolean } = {}): Uint8Array {
  const FRAME = 417;
  const body = Array.from({ length: frames }, () => {
    const f = new Uint8Array(FRAME);
    f.set([0xff, 0xfb, 0x90, 0x00]);
    return f;
  });
  const id3 = options.id3
    ? concat(ascii("ID3"), Uint8Array.of(3, 0, 0, 0, 0, 0, 10), new Uint8Array(10))
    : new Uint8Array(0);
  return concat(id3, ...body);
}
