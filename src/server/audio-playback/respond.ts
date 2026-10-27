import "server-only";
import { parseByteRange } from "@/server/audio-library/range";

/**
 * Phản hồi phát tệp âm thanh riêng tư cho học sinh: không lưu bộ nhớ đệm (mỗi lần nghe lại là một lần kiểm tra quyền mới
 * ở máy chủ nên thu hồi có hiệu lực ngay với yêu cầu MỚI), không đoán định dạng, sandbox, hỗ trợ `Range` (Safari/iOS yêu cầu
 * 206 để phát thẻ <audio>). Dữ liệu đã nằm trong bộ nhớ của trình duyệt từ trước thì máy chủ không thu hồi được.
 */
export function audioResponse(bytes: Uint8Array<ArrayBuffer>, mimeType: string, rangeHeader: string | null): Response {
  const headers: Record<string, string> = {
    "Content-Type": mimeType,
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'; sandbox",
    "Cross-Origin-Resource-Policy": "same-origin",
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
    const slice = bytes.slice(range.start, range.end + 1);
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
