import { describe, expect, it } from "vitest";
import { isNFC } from "@/lib/vietnamese/normalize";
import { vi as strings } from "@/strings/vi";

function collectStrings(value: unknown, path: string): Array<[path: string, text: string]> {
  if (typeof value === "string") return [[path, value]];
  if (Array.isArray(value)) return value.flatMap((item, index) => collectStrings(item, `${path}[${index}]`));
  if (value !== null && typeof value === "object") {
    return Object.entries(value).flatMap(([key, item]) => collectStrings(item, `${path}.${key}`));
  }
  return [];
}

const allStrings = collectStrings(strings, "vi");

describe("chuỗi giao diện tiếng Việt (src/strings/vi.ts)", () => {
  it("có đầy đủ nội dung", () => {
    expect(allStrings.length).toBeGreaterThan(100);
  });

  it("mọi chuỗi ở dạng Unicode NFC, không rỗng, không thừa khoảng trắng đầu/cuối", () => {
    const offenders = allStrings.filter(([, text]) => !isNFC(text) || text.trim() !== text || text.length === 0);
    expect(offenders).toEqual([]);
  });

  it("không có chữ giữ chỗ", () => {
    const offenders = allStrings.filter(([, text]) => /lorem|ipsum|TODO|FIXME/i.test(text));
    expect(offenders).toEqual([]);
  });

  it("thông điệp thương hiệu đúng nguyên văn theo định hướng R02, dùng dấu gạch ngang (–)", () => {
    expect(strings.brand.slogan).toBe("Học Tiếng Việt, khám phá thế giới kỳ diệu");
    expect(strings.brand.tagline).toBe("Tự luyện mỗi ngày – Tích điểm, mở khóa và phiêu lưu cùng tri thức");
    expect(strings.brand.tagline).toContain(" – ");
  });

  it("tên thương hiệu là ReadMate AI", () => {
    expect(strings.brand.name).toBe("ReadMate AI");
  });

  it("các trạng thái chưa hoạt động được gọi tên trung thực", () => {
    expect(strings.status.inDevelopment).toBe("Chức năng đang phát triển");
    expect(strings.demo.notice.title).toContain("dữ liệu minh họa");
    expect(strings.demo.notice.items.join(" ")).toContain("chưa được giáo viên duyệt");
    expect(strings.demo.notice.items.join(" ")).toContain("Không tài khoản, không lưu kết quả, không gọi AI");
    expect(strings.demo.notice.items.join(" ")).toContain("Chưa có âm thanh");
    expect(strings.join.notice.text).toContain("chưa nhận, chưa kiểm tra và chưa lưu");
  });
});
