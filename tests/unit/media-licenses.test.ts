import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { AVATAR_OPTIONS } from "@/features/avatars/catalog";
import { validateMediaLicenses } from "@/features/media/license-validation";

/** Mọi asset phải có dòng giấy phép (CLAUDE.md §7.9, §9.4.7); asset tự vẽ R02 luôn chờ GV duyệt. */

const ROOT = process.cwd();
const raw = readFileSync(join(ROOT, "content/media/licenses.json"), "utf8");
const exists = (path: string) => existsSync(join(ROOT, path));
const { issues, assets } = validateMediaLicenses(raw, exists);

describe("content/media/licenses.json", () => {
  it("hợp lệ: không lỗi lược đồ, không trùng id, mọi đường dẫn tồn tại", () => {
    expect(issues.filter((issue) => issue.severity === "error")).toEqual([]);
    expect(assets.length).toBeGreaterThanOrEqual(20);
  });

  it("mọi tệp trong src/components/art có ít nhất một dòng giấy phép (trừ tệp tiện ích)", () => {
    const covered = new Set(assets.flatMap((asset) => asset.paths.map((path) => path.split("#")[0])));
    const artFiles = readdirSync(join(ROOT, "src/components/art"))
      .filter((name) => name.endsWith(".tsx"))
      .map((name) => `src/components/art/${name}`);
    expect(artFiles.length).toBeGreaterThanOrEqual(6);
    expect(artFiles.filter((file) => !covered.has(file))).toEqual([]);
  });

  it("đủ phạm vi R02: nhân vật học sinh, nhân vật hướng dẫn, quái vật, ≥ 4 avatar, kho báu, 4 cảnh game", () => {
    const ids = new Set(assets.map((asset) => asset.id));
    for (const id of [
      "art.character.hero-kid",
      "art.character.guide-owl",
      "art.character.friendly-monster",
      "art.icon.treasure-chest",
      "art.scene.treasure-maze",
      "art.scene.wonder-forest",
      "art.scene.tone-island",
      "art.scene.rhyme-castle",
    ]) {
      expect(ids.has(id)).toBe(true);
    }
    expect(assets.filter((asset) => asset.kind === "avatar").length).toBeGreaterThanOrEqual(4);
  });

  it("không asset học liệu nào được tự đặt 'approved'; asset tự vẽ R02 đều pending_review", () => {
    const artwork = assets.filter((asset) => ["character", "avatar", "scene", "icon"].includes(asset.kind));
    expect(artwork.every((asset) => asset.review.status === "pending_review")).toBe(true);
    expect(artwork.every((asset) => !asset.review.teacherReviewed && asset.review.reviewedBy === null)).toBe(true);
  });

  it("avatar trong danh mục trỏ tới dòng giấy phép có thật và đều chờ duyệt", () => {
    const ids = new Set(assets.map((asset) => asset.id));
    for (const option of AVATAR_OPTIONS) {
      expect(ids.has(option.licenseRef)).toBe(true);
      expect(option.status).toBe("pending_review");
    }
  });

  it("bộ kiểm tra chặn tự duyệt và đường dẫn không tồn tại", () => {
    const tampered = JSON.parse(raw) as { assets: Array<Record<string, unknown>> };
    const first = tampered.assets[0];
    if (!first) throw new Error("thiếu asset");
    first.review = { status: "approved", teacherReviewed: false, reviewedBy: null, reviewedAt: null, notes: "x" };
    first.paths = ["src/khong-ton-tai.tsx"];
    const result = validateMediaLicenses(JSON.stringify(tampered), exists);
    const codes = result.issues.map((issue) => issue.code);
    expect(codes).toContain("APPROVAL_WITHOUT_REVIEWER");
    expect(codes).toContain("MISSING_PATH");
  });

  it("phông chữ có giấy phép SIL OFL; không có tệp phông chữ nào được commit vào repo", () => {
    expect(assets.filter((asset) => asset.kind === "font").map((asset) => asset.license)).toEqual([
      "SIL Open Font License 1.1",
      "SIL Open Font License 1.1",
    ]);
    const fontFiles = (dir: string): string[] =>
      readdirSync(join(ROOT, dir), { withFileTypes: true }).flatMap((entry) =>
        entry.isDirectory()
          ? fontFiles(join(dir, entry.name))
          : /\.(ttf|otf|woff2?)$/iu.test(entry.name)
            ? [join(dir, entry.name)]
            : [],
      );
    expect([...fontFiles("src"), ...fontFiles("content")]).toEqual([]);
  });
});
