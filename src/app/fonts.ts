import { Andika, Be_Vietnam_Pro } from "next/font/google";

/**
 * Font được next/font tải về lúc build và phục vụ từ chính tên miền của ứng dụng:
 * trình duyệt của học sinh không gửi yêu cầu nào tới Google (docs: Fonts).
 * Cả hai font dùng giấy phép SIL Open Font License và có subset "vietnamese".
 */

/** Font giao diện — thiết kế riêng cho tiếng Việt. */
export const beVietnamPro = Be_Vietnam_Pro({
  subsets: ["vietnamese", "latin"],
  weight: ["400", "600", "700", "800"],
  display: "swap",
  variable: "--font-be-vietnam-pro",
});

/** Font học liệu đọc — chữ a, g một tầng, thiết kế cho người mới học đọc (SIL). */
export const andika = Andika({
  subsets: ["vietnamese", "latin"],
  weight: ["400", "700"],
  display: "swap",
  variable: "--font-andika",
});
