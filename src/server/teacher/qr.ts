import "server-only";
import qrcode from "qrcode-generator";

/**
 * Ma trận QR của liên kết thẻ học, dựng ở máy chủ (thư viện qrcode-generator, MIT, không phụ thuộc) và trả về
 * dạng chuỗi "0/1" theo hàng để giao diện vẽ bằng SVG — không cần thư viện QR ở trình duyệt, không dùng
 * dangerouslySetInnerHTML. Mức sửa lỗi M: in trên giấy vẫn quét được khi hơi mờ.
 */
export function qrRows(text: string): string[] {
  const qr = qrcode(0, "M");
  qr.addData(text, "Byte");
  qr.make();
  const size = qr.getModuleCount();
  return Array.from({ length: size }, (_, row) =>
    Array.from({ length: size }, (_, col) => (qr.isDark(row, col) ? "1" : "0")).join(""),
  );
}
