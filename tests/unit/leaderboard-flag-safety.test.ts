import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Cờ hệ thống bảng xếp hạng không có đường nào để ứng dụng đổi: không route, Server Action hay mã `src/` nào ghi vào
 * `private.feature_flags`; script kiểm thử chỉ chạy `supabase db query --local`.
 */
function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

describe("cờ hệ thống bảng xếp hạng", () => {
  it("không có mã trong src/ nào đọc hay ghi private.feature_flags (chỉ CSDL tự kiểm tra)", () => {
    const offenders = walk("src")
      .filter((file) => /\.(ts|tsx)$/u.test(file) && !file.endsWith("database.types.ts"))
      .filter((file) => /feature_flags/u.test(readFileSync(file, "utf8")));
    expect(offenders).toEqual([]);
  });

  it("không có biến môi trường NEXT_PUBLIC_ hay tham số API nào điều khiển cờ", () => {
    const sources = walk("src")
      .filter((file) => /\.(ts|tsx)$/u.test(file))
      .map((file) => readFileSync(file, "utf8"))
      .join("\n");
    expect(sources).not.toMatch(/process.env.[A-Z_]*LEADERBOARD/u);
    expect(sources).not.toMatch(/NEXT_PUBLIC_[A-Z_]*LEADERBOARD/u);
  });

  it("script bật cờ khi kiểm thử chỉ nhắm CSDL local", () => {
    const script = readFileSync("scripts/lib/test-fixtures.ts", "utf8");
    const body = script.slice(script.indexOf("setLocalLeaderboardApproval"));
    expect(body).toContain("supabase db query --local");
    expect(body).not.toMatch(/--db-url|--linked|DATABASE_URL/u);
  });

  it("migration R05 không bật cờ, và không migration nào đặt cờ hệ thống thành true", () => {
    const migrations = walk("supabase/migrations")
      .map((file) => readFileSync(file, "utf8"))
      .join("\n");
    expect(migrations).not.toMatch(/update\s+private\.feature_flags\s+set\s+enabled\s*=\s*true/iu);
    expect(migrations).toMatch(/\('leaderboard_feature_approved',\s*false/u);
  });
});
