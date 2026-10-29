import { AUDIO_MAX_BYTES, AUDIO_MAX_DURATION_MS, AUDIO_MIN_DURATION_MS, type AudioMimeType } from "./limits.ts";

/**
 * Kiểm tra tệp âm thanh THEO NỘI DUNG (chữ ký tệp + cấu trúc container), không tin tên tệp hay MIME trình duyệt khai.
 * Hàm thuần trên byte: trả định dạng thật và thời lượng tính từ chính tệp (WAV, Ogg Opus/Vorbis, WebM Opus/Vorbis,
 * MP4/M4A AAC kể cả MP4 phân đoạn của Safari, MP3 lớp III). Từ chối: rỗng, quá lớn, không nhận ra, có hình ảnh, hỏng,
 * quá ngắn/dài. Không giải mã âm thanh nên KHÔNG phát hiện được tệp im lặng — GV nghe lại trước khi gửi duyệt.
 */

export type AudioRejection =
  "AUDIO_EMPTY" | "AUDIO_TOO_LARGE" | "AUDIO_UNSUPPORTED" | "AUDIO_INVALID" | "AUDIO_TOO_SHORT" | "AUDIO_TOO_LONG";

export type AudioInspection =
  { ok: true; mime: AudioMimeType; durationMs: number } | { ok: false; code: AudioRejection };

type Probe =
  { ok: true; mime: AudioMimeType; durationMs: number } | { ok: false; code: "AUDIO_UNSUPPORTED" | "AUDIO_INVALID" };

const invalid: Probe = { ok: false, code: "AUDIO_INVALID" };
const unsupported: Probe = { ok: false, code: "AUDIO_UNSUPPORTED" };

const at = (b: Uint8Array, i: number): number => b[i] ?? 0;
const u16le = (b: Uint8Array, o: number) => at(b, o) | (at(b, o + 1) << 8);
const u32le = (b: Uint8Array, o: number) =>
  (at(b, o) | (at(b, o + 1) << 8) | (at(b, o + 2) << 16) | (at(b, o + 3) << 24)) >>> 0;
const u32be = (b: Uint8Array, o: number) =>
  ((at(b, o) << 24) | (at(b, o + 1) << 16) | (at(b, o + 2) << 8) | at(b, o + 3)) >>> 0;
const u64be = (b: Uint8Array, o: number) => u32be(b, o) * 2 ** 32 + u32be(b, o + 4);
const ascii = (b: Uint8Array, o: number, n: number) => String.fromCharCode(...Array.from(b.subarray(o, o + n)));

export function inspectAudio(bytes: Uint8Array): AudioInspection {
  if (bytes.byteLength === 0) return { ok: false, code: "AUDIO_EMPTY" };
  if (bytes.byteLength > AUDIO_MAX_BYTES) return { ok: false, code: "AUDIO_TOO_LARGE" };
  const probe = probeContainer(bytes);
  if (!probe.ok) return probe;
  if (!Number.isFinite(probe.durationMs) || probe.durationMs <= 0) return { ok: false, code: "AUDIO_INVALID" };
  const durationMs = Math.round(probe.durationMs);
  if (durationMs < AUDIO_MIN_DURATION_MS) return { ok: false, code: "AUDIO_TOO_SHORT" };
  if (durationMs > AUDIO_MAX_DURATION_MS) return { ok: false, code: "AUDIO_TOO_LONG" };
  return { ok: true, mime: probe.mime, durationMs };
}

function probeContainer(b: Uint8Array): Probe {
  if (b.byteLength < 12) return unsupported;
  if (ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 4) === "WAVE") return probeWav(b);
  if (ascii(b, 0, 4) === "OggS") return probeOgg(b);
  if (u32be(b, 0) === 0x1a45dfa3) return probeWebm(b);
  if (ascii(b, 4, 4) === "ftyp") return probeMp4(b);
  if (ascii(b, 0, 3) === "ID3" || (at(b, 0) === 0xff && (at(b, 1) & 0xe0) === 0xe0)) return probeMp3(b);
  return unsupported;
}

// ----------------------------------------------------------------------------------------------------------------
// WAV (RIFF/PCM)
// ----------------------------------------------------------------------------------------------------------------

function probeWav(b: Uint8Array): Probe {
  let byteRate = 0;
  let dataBytes = -1;
  let o = 12;
  while (o + 8 <= b.byteLength) {
    const id = ascii(b, o, 4);
    const size = u32le(b, o + 4);
    const body = o + 8;
    if (id === "fmt ") {
      if (size < 16 || body + 16 > b.byteLength) return invalid;
      const tag = u16le(b, body);
      const channels = u16le(b, body + 2);
      byteRate = u32le(b, body + 8);
      const bits = u16le(b, body + 14);
      // Chỉ PCM (1), float (3) hoặc WAVE_FORMAT_EXTENSIBLE (0xFFFE); kênh/độ sâu hợp lý.
      if (![1, 3, 0xfffe].includes(tag)) return unsupported;
      if (channels < 1 || channels > 2 || ![8, 16, 24, 32].includes(bits) || byteRate === 0) return invalid;
    } else if (id === "data") {
      // Kích thước 0 hoặc 0xFFFFFFFF xuất hiện khi trình ghi chưa chốt tiêu đề: lấy phần còn lại của tệp.
      const remaining = b.byteLength - body;
      dataBytes = size === 0 || size === 0xffffffff || size > remaining ? remaining : size;
      break;
    }
    o = body + size + (size % 2);
  }
  if (byteRate === 0 || dataBytes <= 0) return invalid;
  return { ok: true, mime: "audio/wav", durationMs: (dataBytes / byteRate) * 1000 };
}

// ----------------------------------------------------------------------------------------------------------------
// Ogg (Opus / Vorbis)
// ----------------------------------------------------------------------------------------------------------------

function probeOgg(b: Uint8Array): Probe {
  let o = 0;
  let serial: number | null = null;
  let codec: "opus" | "vorbis" | null = null;
  let preSkip = 0;
  let sampleRate = 0;
  let lastGranule = -1;
  while (o + 27 <= b.byteLength) {
    if (ascii(b, o, 4) !== "OggS" || at(b, o + 4) !== 0) return invalid;
    const segments = at(b, o + 26);
    if (o + 27 + segments > b.byteLength) return invalid;
    let payload = 0;
    for (let i = 0; i < segments; i++) payload += at(b, o + 27 + i);
    const dataStart = o + 27 + segments;
    const pageEnd = dataStart + payload;
    if (pageEnd > b.byteLength) return invalid;
    const pageSerial = u32le(b, o + 14);
    if (serial === null) serial = pageSerial;
    else if (serial !== pageSerial) return unsupported; // nhiều luồng / ghép chuỗi
    if (codec === null) {
      if (ascii(b, dataStart, 8) === "OpusHead") {
        codec = "opus";
        preSkip = u16le(b, dataStart + 10);
        sampleRate = 48000;
      } else if (at(b, dataStart) === 1 && ascii(b, dataStart + 1, 6) === "vorbis") {
        codec = "vorbis";
        sampleRate = u32le(b, dataStart + 12);
      } else {
        return unsupported;
      }
    }
    const lo = u32le(b, o + 6);
    const hi = u32le(b, o + 10);
    if (!(lo === 0xffffffff && hi === 0xffffffff)) lastGranule = hi * 2 ** 32 + lo;
    o = pageEnd;
  }
  if (o !== b.byteLength || codec === null || sampleRate <= 0 || lastGranule <= 0) return invalid;
  return { ok: true, mime: "audio/ogg", durationMs: ((lastGranule - preSkip) / sampleRate) * 1000 };
}

// ----------------------------------------------------------------------------------------------------------------
// WebM / Matroska (Opus / Vorbis). MediaRecorder của Chrome ghi phần tử kích thước "không biết" và không có Duration,
// nên duyệt phẳng qua các phần tử (đi vào phần tử cha, bỏ qua lá) và lấy mốc thời gian lớn nhất của các khối.
// ----------------------------------------------------------------------------------------------------------------

const EBML_DESCEND = new Set([0x1a45dfa3, 0x18538067, 0x1549a966, 0x1654ae6b, 0xae, 0x1f43b675, 0xa0]);

function readVintSize(b: Uint8Array, o: number): { len: number; value: number; unknown: boolean } | null {
  const first = at(b, o);
  if (first === 0) return null;
  const len = Math.clz32(first) - 23; // số byte = vị trí bit 1 đầu tiên (1–8)
  if (len < 1 || len > 8 || o + len > b.byteLength) return null;
  let value = first & (0xff >> len);
  let allOnes = value === 0xff >> len;
  for (let i = 1; i < len; i++) {
    const v = at(b, o + i);
    if (v !== 0xff) allOnes = false;
    value = value * 256 + v;
  }
  return { len, value, unknown: allOnes };
}

function readEbmlId(b: Uint8Array, o: number): { len: number; id: number } | null {
  const first = at(b, o);
  if (first === 0) return null;
  const len = Math.clz32(first) - 23;
  if (len < 1 || len > 4 || o + len > b.byteLength) return null;
  let id = 0;
  for (let i = 0; i < len; i++) id = id * 256 + at(b, o + i);
  return { len, id };
}

function ebmlUint(b: Uint8Array, o: number, n: number): number {
  let v = 0;
  for (let i = 0; i < n; i++) v = v * 256 + at(b, o + i);
  return v;
}

function probeWebm(b: Uint8Array): Probe {
  const view = new DataView(b.buffer, b.byteOffset, b.byteLength);
  let timecodeScale = 1_000_000;
  let infoDurationTicks = 0;
  let clusterTc = 0;
  let maxEndTicks = 0;
  let sawCluster = false;
  const tracks: { type?: number; codec?: string }[] = [];
  let docType = "";
  let pendingBlockStart = -1; // Block trong BlockGroup chờ BlockDuration
  let o = 0;
  let guard = 0;
  while (o < b.byteLength && guard++ < 2_000_000) {
    const id = readEbmlId(b, o);
    if (!id) return invalid;
    const size = readVintSize(b, o + id.len);
    if (!size) return invalid;
    const dataStart = o + id.len + size.len;
    if (EBML_DESCEND.has(id.id)) {
      if (id.id === 0x1f43b675) sawCluster = true;
      if (id.id === 0xae) tracks.push({});
      if (id.id === 0xa0) pendingBlockStart = -1;
      o = dataStart;
      continue;
    }
    if (size.unknown) return invalid; // chỉ phần tử cha mới được phép kích thước không biết
    const end = dataStart + size.value;
    if (end > b.byteLength) {
      // Bị cắt cụt: khối cuối dở dang thì bỏ, phần đã đọc vẫn dùng được.
      break;
    }
    const last = tracks[tracks.length - 1];
    switch (id.id) {
      case 0x4282:
        docType = ascii(b, dataStart, size.value);
        break;
      case 0x2ad7b1:
        timecodeScale = ebmlUint(b, dataStart, size.value) || timecodeScale;
        break;
      case 0x4489:
        if (size.value === 4) infoDurationTicks = view.getFloat32(dataStart);
        else if (size.value === 8) infoDurationTicks = view.getFloat64(dataStart);
        break;
      case 0x83:
        if (last) last.type = ebmlUint(b, dataStart, size.value);
        break;
      case 0x86:
        if (last) last.codec = ascii(b, dataStart, size.value);
        break;
      case 0xe7:
        clusterTc = ebmlUint(b, dataStart, size.value);
        break;
      case 0xa3:
      case 0xa1: {
        // Số hiệu luồng (vint) + dấu thời gian tương đối int16 có dấu.
        const track = readVintSize(b, dataStart);
        if (track && dataStart + track.len + 3 <= end) {
          const rel = view.getInt16(dataStart + track.len);
          const startTicks = clusterTc + rel;
          // Khung Opus mặc định 20 ms; BlockDuration (nếu có) cập nhật bên dưới.
          const frameTicks = (20 * 1_000_000) / timecodeScale;
          maxEndTicks = Math.max(maxEndTicks, startTicks + frameTicks);
          pendingBlockStart = id.id === 0xa1 ? startTicks : -1;
        }
        break;
      }
      case 0x9b:
        if (pendingBlockStart >= 0) {
          maxEndTicks = Math.max(maxEndTicks, pendingBlockStart + ebmlUint(b, dataStart, size.value));
        }
        break;
      default:
        break;
    }
    o = end;
  }
  if (docType !== "webm" && docType !== "matroska") return invalid;
  if (tracks.length === 0 || !sawCluster) return invalid;
  // Chỉ âm thanh: luồng hình (TrackType 1) hay codec lạ bị từ chối.
  for (const track of tracks) {
    if (track.type !== 2) return unsupported;
    if (track.codec !== "A_OPUS" && track.codec !== "A_VORBIS") return unsupported;
  }
  const durationTicks = Math.max(infoDurationTicks, maxEndTicks);
  return { ok: true, mime: "audio/webm", durationMs: (durationTicks * timecodeScale) / 1_000_000 };
}

// ----------------------------------------------------------------------------------------------------------------
// MP4 / M4A (AAC), gồm MP4 phân đoạn (MediaRecorder của Safari: mvhd.duration = 0, thời lượng nằm trong các moof/trun).
// ----------------------------------------------------------------------------------------------------------------

type Mp4Box = { type: string; dataStart: number; end: number };

function mp4Boxes(b: Uint8Array, start: number, end: number): Mp4Box[] | null {
  const out: Mp4Box[] = [];
  let o = start;
  while (o + 8 <= end) {
    let size = u32be(b, o);
    const type = ascii(b, o + 4, 4);
    let header = 8;
    if (size === 1) {
      if (o + 16 > end) return null;
      size = u64be(b, o + 8);
      header = 16;
    } else if (size === 0) {
      size = end - o;
    }
    if (size < header) return null;
    // Hộp cuối (mdat) có thể bị cắt cụt: thu gọn về hết dữ liệu thay vì từ chối.
    const boxEnd = Math.min(o + size, end);
    out.push({ type, dataStart: o + header, end: boxEnd });
    o += size;
  }
  return out;
}

function probeMp4(b: Uint8Array): Probe {
  const top = mp4Boxes(b, 0, b.byteLength);
  if (!top || top[0]?.type !== "ftyp") return invalid;
  const moov = top.find((box) => box.type === "moov");
  if (!moov) return invalid;
  const moovChildren = mp4Boxes(b, moov.dataStart, moov.end);
  if (!moovChildren) return invalid;

  let movieTimescale = 0;
  let movieDuration = 0;
  const mvhd = moovChildren.find((box) => box.type === "mvhd");
  if (mvhd) {
    const version = at(b, mvhd.dataStart);
    if (version === 1) {
      movieTimescale = u32be(b, mvhd.dataStart + 20);
      movieDuration = u64be(b, mvhd.dataStart + 24);
    } else {
      movieTimescale = u32be(b, mvhd.dataStart + 12);
      movieDuration = u32be(b, mvhd.dataStart + 16);
    }
  }

  // Luồng: chỉ chấp nhận đúng âm thanh AAC (mp4a); có luồng hình/khác → từ chối.
  const trackTimescale = new Map<number, number>();
  const trackDefaultDuration = new Map<number, number>();
  let audioTracks = 0;
  for (const trak of moovChildren.filter((box) => box.type === "trak")) {
    const trakChildren = mp4Boxes(b, trak.dataStart, trak.end) ?? [];
    const tkhd = trakChildren.find((box) => box.type === "tkhd");
    const mdia = trakChildren.find((box) => box.type === "mdia");
    if (!tkhd || !mdia) return invalid;
    const trackId = at(b, tkhd.dataStart) === 1 ? u32be(b, tkhd.dataStart + 20) : u32be(b, tkhd.dataStart + 12);
    const mdiaChildren = mp4Boxes(b, mdia.dataStart, mdia.end) ?? [];
    const hdlr = mdiaChildren.find((box) => box.type === "hdlr");
    const mdhd = mdiaChildren.find((box) => box.type === "mdhd");
    if (!hdlr || !mdhd) return invalid;
    if (ascii(b, hdlr.dataStart + 8, 4) !== "soun") return unsupported;
    audioTracks++;
    trackTimescale.set(
      trackId,
      at(b, mdhd.dataStart) === 1 ? u32be(b, mdhd.dataStart + 20) : u32be(b, mdhd.dataStart + 12),
    );
    const minf = mp4Boxes(b, mdia.dataStart, mdia.end)?.find((box) => box.type === "minf");
    const stbl = minf ? mp4Boxes(b, minf.dataStart, minf.end)?.find((box) => box.type === "stbl") : undefined;
    const stsd = stbl ? mp4Boxes(b, stbl.dataStart, stbl.end)?.find((box) => box.type === "stsd") : undefined;
    if (stsd) {
      const entry = mp4Boxes(b, stsd.dataStart + 8, stsd.end)?.[0];
      if (!entry || entry.type !== "mp4a") return unsupported;
    }
  }
  if (audioTracks !== 1) return audioTracks === 0 ? invalid : unsupported;

  if (movieDuration > 0 && movieTimescale > 0) {
    return { ok: true, mime: "audio/mp4", durationMs: (movieDuration / movieTimescale) * 1000 };
  }

  // MP4 phân đoạn: mehd (nếu có) hoặc cộng thời lượng mẫu trong các moof.
  const mvex = moovChildren.find((box) => box.type === "mvex");
  const mvexChildren = mvex ? (mp4Boxes(b, mvex.dataStart, mvex.end) ?? []) : [];
  const mehd = mvexChildren.find((box) => box.type === "mehd");
  if (mehd && movieTimescale > 0) {
    const ticks = at(b, mehd.dataStart) === 1 ? u64be(b, mehd.dataStart + 4) : u32be(b, mehd.dataStart + 4);
    if (ticks > 0) return { ok: true, mime: "audio/mp4", durationMs: (ticks / movieTimescale) * 1000 };
  }
  for (const trex of mvexChildren.filter((box) => box.type === "trex")) {
    trackDefaultDuration.set(u32be(b, trex.dataStart + 4), u32be(b, trex.dataStart + 12));
  }
  let seconds = 0;
  for (const moof of top.filter((box) => box.type === "moof")) {
    for (const traf of (mp4Boxes(b, moof.dataStart, moof.end) ?? []).filter((box) => box.type === "traf")) {
      const kids = mp4Boxes(b, traf.dataStart, traf.end) ?? [];
      const tfhd = kids.find((box) => box.type === "tfhd");
      if (!tfhd) return invalid;
      const tfFlags = u32be(b, tfhd.dataStart) & 0xffffff;
      const trackId = u32be(b, tfhd.dataStart + 4);
      let p = tfhd.dataStart + 8;
      if (tfFlags & 0x1) p += 8;
      if (tfFlags & 0x2) p += 4;
      const defaultDuration = tfFlags & 0x8 ? u32be(b, p) : (trackDefaultDuration.get(trackId) ?? 0);
      const timescale = trackTimescale.get(trackId) ?? 0;
      if (timescale <= 0) return invalid;
      for (const trun of kids.filter((box) => box.type === "trun")) {
        const flags = u32be(b, trun.dataStart) & 0xffffff;
        const count = u32be(b, trun.dataStart + 4);
        let q = trun.dataStart + 8;
        if (flags & 0x1) q += 4;
        if (flags & 0x4) q += 4;
        const perSample =
          (flags & 0x100 ? 4 : 0) + (flags & 0x200 ? 4 : 0) + (flags & 0x400 ? 4 : 0) + (flags & 0x800 ? 4 : 0);
        if (q + count * perSample > trun.end) return invalid;
        let ticks = 0;
        for (let i = 0; i < count; i++) {
          ticks += flags & 0x100 ? u32be(b, q + i * perSample) : defaultDuration;
        }
        seconds += ticks / timescale;
      }
    }
  }
  return { ok: true, mime: "audio/mp4", durationMs: seconds * 1000 };
}

// ----------------------------------------------------------------------------------------------------------------
// MP3 (MPEG-1/2/2.5 lớp III): đi theo chuỗi khung liên tiếp.
// ----------------------------------------------------------------------------------------------------------------

const MP3_BITRATES_V1 = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320];
const MP3_BITRATES_V2 = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160];
const MP3_RATES: Record<number, number[]> = {
  3: [44100, 48000, 32000],
  2: [22050, 24000, 16000],
  0: [11025, 12000, 8000],
};

function probeMp3(b: Uint8Array): Probe {
  let o = 0;
  if (ascii(b, 0, 3) === "ID3") {
    o = 10 + (((at(b, 6) & 0x7f) << 21) | ((at(b, 7) & 0x7f) << 14) | ((at(b, 8) & 0x7f) << 7) | (at(b, 9) & 0x7f));
    if (at(b, 5) & 0x10) o += 10;
  }
  const audioStart = o;
  let frames = 0;
  let samples = 0;
  let sampleRate = 0;
  while (o + 4 <= b.byteLength) {
    const b1 = at(b, o + 1);
    const b2 = at(b, o + 2);
    if (at(b, o) !== 0xff || (b1 & 0xe0) !== 0xe0) break;
    const version = (b1 >> 3) & 3;
    const layer = (b1 >> 1) & 3;
    const bitrateIdx = b2 >> 4;
    const rateIdx = (b2 >> 2) & 3;
    if (version === 1 || layer === 0 || bitrateIdx === 0 || bitrateIdx === 15 || rateIdx === 3) break;
    if (layer !== 1) return unsupported; // chỉ lớp III
    const rate = MP3_RATES[version]?.[rateIdx];
    const kbps = (version === 3 ? MP3_BITRATES_V1 : MP3_BITRATES_V2)[bitrateIdx];
    if (!rate || !kbps) break;
    const padding = (b2 >> 1) & 1;
    const length = Math.floor(((version === 3 ? 144 : 72) * kbps * 1000) / rate) + padding;
    if (length < 4 || o + length > b.byteLength) break;
    sampleRate = rate;
    samples += version === 3 ? 1152 : 576;
    frames++;
    o += length;
  }
  // Ít nhất 3 khung liên tiếp và phần lớn tệp là khung hợp lệ (loại tệp ngẫu nhiên tình cờ có 0xFFE…).
  if (frames < 3 || sampleRate === 0) return invalid;
  const tail = b.byteLength - o;
  const trailerOk = tail === 0 || ascii(b, o, 3) === "TAG" || ascii(b, o, 8) === "APETAGEX" || tail < 4096;
  if (!trailerOk || o - audioStart < (b.byteLength - audioStart) * 0.5) return invalid;
  return { ok: true, mime: "audio/mpeg", durationMs: (samples / sampleRate) * 1000 };
}
