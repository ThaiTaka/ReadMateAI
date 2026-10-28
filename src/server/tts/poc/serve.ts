import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { parseByteRange } from "../../audio-library/range.ts";
import { sha256Hex } from "../hash.ts";
import { POC_FILE_PATTERN } from "./manifest.ts";
import { readPocManifest } from "./store.ts";

/**
 * Phục vụ MỘT tệp nghe thử cho giáo viên (route `/api/teacher/tts-poc/[file]` đã xác thực GV trước khi gọi hàm này).
 * Tên tệp chỉ được nhận nếu khớp mẫu băm VÀ có trong sổ (chặn đi lệch thư mục); nội dung phải khớp sha256 trong sổ; không có
 * URL công khai/URL nhà cung cấp; phản hồi `no-store`, `nosniff`, sandbox, hỗ trợ Range (Safari cần).
 */
export async function servePocSample(params: {
  dir: string;
  file: string;
  rangeHeader: string | null;
}): Promise<Response> {
  const notFound = () => new Response(null, { status: 404, headers: { "Cache-Control": "private, no-store" } });
  const { dir, file, rangeHeader } = params;
  if (!POC_FILE_PATTERN.test(file)) return notFound();
  const { manifest } = await readPocManifest(dir);
  const sample = manifest.samples.find((entry) => entry.file === file);
  if (!sample) return notFound();
  let bytes: Uint8Array<ArrayBuffer>;
  try {
    bytes = new Uint8Array(await readFile(join(dir, file)));
  } catch {
    return notFound();
  }
  if (sha256Hex(bytes) !== sample.sha256) return notFound();

  const headers: Record<string, string> = {
    "Content-Type": sample.mime,
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'; sandbox",
    "Accept-Ranges": "bytes",
    "Content-Disposition": "inline",
  };
  if (rangeHeader) {
    const range = parseByteRange(rangeHeader, bytes.byteLength);
    if (!range) {
      return new Response(null, {
        status: 416,
        headers: { ...headers, "Content-Range": `bytes */${bytes.byteLength}` },
      });
    }
    const slice = bytes.subarray(range.start, range.end + 1);
    return new Response(slice, {
      status: 206,
      headers: {
        ...headers,
        "Content-Range": `bytes ${range.start}-${range.end}/${bytes.byteLength}`,
        "Content-Length": String(slice.byteLength),
      },
    });
  }
  return new Response(bytes, { status: 200, headers: { ...headers, "Content-Length": String(bytes.byteLength) } });
}
