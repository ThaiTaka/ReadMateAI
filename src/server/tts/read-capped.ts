/**
 * Đọc thân phản hồi có TRẦN dung lượng (dùng chung cho adapter nhà cung cấp): từ chối ngay khi `content-length` khai báo quá
 * trần, và hủy luồng khi số byte thực nhận vượt trần — không tin tiêu đề mà nhà cung cấp tự khai.
 */
export async function readCapped(response: Response, limit: number): Promise<Uint8Array | "TOO_LARGE"> {
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > limit) return "TOO_LARGE";
  if (!response.body) {
    const buffer = new Uint8Array(await response.arrayBuffer());
    return buffer.byteLength > limit ? "TOO_LARGE" : buffer;
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > limit) {
      await reader.cancel();
      return "TOO_LARGE";
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}
