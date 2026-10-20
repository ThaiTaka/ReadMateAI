import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import HomePage from "@/app/(site)/page";
import DemoPage from "@/app/(site)/demo/page";
import LearnPage from "@/app/learn/page";
import TeacherPage from "@/app/teacher/(console)/page";
import { SiteFooter } from "@/components/layout/site-footer";
import { TeacherSidebar } from "@/components/layout/teacher-sidebar";
import { SUPPORT_POLICIES } from "@/features/exercises/core/support";
import { DEMO_SUPPORT_LEVELS } from "@/features/demo/demo-data";
import { SITE } from "@/config/site";
import { vi } from "@/strings/vi";
import packageJson from "../../package.json";

/**
 * Định hướng R01/R02: học sinh tự luyện TẠI NHÀ; giao diện không còn thông điệp "học ở nhà rồi làm phiếu ở lớp",
 * không còn "Thử như ở lớp", không còn khu vực phiếu học tập trong luồng học sinh (AD-51).
 */

/** Cụm từ của định hướng cũ — không được xuất hiện trong giao diện. */
const FORBIDDEN =
  /thử như ở lớp|phiếu ở lớp|phiếu học tập|phiếu tương đương|giống phiếu|tự thực hiện ở lớp|tự làm ở lớp|vận dụng ở lớp|ở lớp|tại lớp|trên lớp/iu;

function collectStrings(value: unknown, path: string): Array<[path: string, text: string]> {
  if (typeof value === "string") return [[path, value]];
  if (Array.isArray(value)) return value.flatMap((item, index) => collectStrings(item, `${path}[${index}]`));
  if (value !== null && typeof value === "object") {
    return Object.entries(value).flatMap(([key, item]) => collectStrings(item, `${path}.${key}`));
  }
  return [];
}

describe("câu chữ theo định hướng mới (R02)", () => {
  it("vi.ts không còn thông điệp lớp học/phiếu (trừ nhánh ngừng dùng practice.worksheet — AD-51, xóa ở R11)", () => {
    const offenders = collectStrings(vi, "vi").filter(
      ([path, text]) => !path.startsWith("vi.practice.worksheet") && FORBIDDEN.test(text),
    );
    expect(offenders).toEqual([]);
  });

  for (const [name, Page] of [
    ["/", HomePage],
    ["/learn", LearnPage],
    ["/demo", DemoPage],
    ["/teacher", TeacherPage],
  ] as const) {
    it(`trang ${name} không hiển thị thông điệp học sinh dùng website ở lớp hay phiếu học tập`, () => {
      const { container } = render(<Page />);
      expect(container.textContent ?? "").not.toMatch(FORBIDDEN);
    });
  }

  it("chân trang và sidebar giáo viên không còn mục phiếu học tập", () => {
    const { container } = render(
      <>
        <SiteFooter />
        <TeacherSidebar />
      </>,
    );
    expect(container.textContent ?? "").not.toMatch(FORBIDDEN);
  });

  it("H0 hiển thị 'Tự làm' ở chính sách, mô tả cho người lớn và ghi chú mức hỗ trợ; H1 không mô tả là giống phiếu", () => {
    expect(SUPPORT_POLICIES[0].name).toBe("Tự làm");
    expect(DEMO_SUPPORT_LEVELS.find((level) => level.code === "H0")?.name).toBe("Tự làm");
    expect(vi.practice.runner.levelNotes[0]).toMatch(/^Tự làm:/u);
    expect(vi.practice.runner.levelNotes[1]).not.toMatch(/phiếu/iu);
  });

  it("trang chủ, metadata, cấu hình site và package.json nói đúng định hướng học tại nhà + phiêu lưu", () => {
    expect(vi.home.meta.description).toMatch(/tại nhà/u);
    expect(vi.home.hero.description).toMatch(/tại nhà/u);
    expect(SITE.description).toMatch(/tại nhà/u);
    expect(SITE.description).toMatch(/phiêu lưu/u);
    expect(packageJson.description).toMatch(/tại nhà/u);
    expect(packageJson.description).not.toMatch(FORBIDDEN);
  });

  it("không dùng từ ngữ gây xấu hổ cho điểm thấp (GAMIFICATION_SPEC §10)", () => {
    const shaming = /thua cuộc|\bthua\b|kém nhất|cuối bảng|game over|bị phạt/iu;
    const offenders = collectStrings(vi, "vi").filter(([, text]) => shaming.test(text));
    expect(offenders).toEqual([]);
  });
});
