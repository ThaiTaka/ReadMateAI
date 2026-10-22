import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  DEMO_ACHIEVEMENTS,
  DEMO_DATA_IS_FICTIONAL,
  DEMO_LEADERBOARD,
  DEMO_PLAYER,
} from "@/features/demo/adventure-data";
import { GAME_WORLDS, MAP_TILES } from "@/features/game-world/catalog";
import { GAME_MIN_BALANCE } from "@/features/gamification/rules";

const ROOT = process.cwd();

function sourceFiles(dir: string): Array<{ path: string; text: string }> {
  return readdirSync(join(ROOT, dir), { withFileTypes: true, recursive: true })
    .filter((entry) => entry.isFile() && /\.(ts|tsx)$/u.test(entry.name))
    .map((entry) => {
      const path = join(entry.parentPath, entry.name);
      // Bỏ chú thích: chỉ soát mã chạy thật (chú thích được phép nhắc "không localStorage"…).
      const text = readFileSync(path, "utf8")
        .replace(/\/\*[\s\S]*?\*\//gu, "")
        .replace(/^\s*\/\/.*$/gmu, "");
      return { path, text };
    });
}

describe("dữ liệu minh họa Game World (R02)", () => {
  it("được đánh dấu hư cấu; hồ sơ demo là Mây, 135 điểm", () => {
    expect(DEMO_DATA_IS_FICTIONAL).toBe(true);
    expect(DEMO_PLAYER).toMatchObject({ displayName: "Mây", balance: 135, earnedTotal: 135 });
  });

  it("không có trường thông tin cá nhân (họ tên, ngày sinh, điện thoại, email, ảnh, địa chỉ, id học sinh)", () => {
    const serialized = JSON.stringify({ DEMO_PLAYER, DEMO_ACHIEVEMENTS, DEMO_LEADERBOARD });
    expect(serialized).not.toMatch(
      /"(full_?name|first_?name|last_?name|student_?id|class_?id|birth\w*|dob|phone\w*|email|address|photo\w*)"\s*:/iu,
    );
  });

  it("bảng xếp hạng minh họa chỉ dùng tên giả ngắn, avatar có sẵn, điểm — không nhóm năng lực", () => {
    for (const entry of DEMO_LEADERBOARD) {
      expect(Object.keys(entry).sort()).toEqual(["alias", "avatar", "isMe", "points"]);
    }
    expect(JSON.stringify(DEMO_LEADERBOARD)).not.toMatch(/band|foundation|developing|extending|Nhóm|lộ trình/iu);
  });

  it("không có huy hiệu chuỗi ngày liên tiếp hay phần thưởng may rủi (§9.4.5)", () => {
    expect(JSON.stringify(DEMO_ACHIEVEMENTS)).not.toMatch(/liên tiếp|chuỗi ngày|may mắn|ngẫu nhiên|hộp quà/iu);
  });

  it("đủ bốn trò chơi theo thứ tự ngưỡng 50 → 120 → 200 → 300, đều có kế hoạch giai đoạn", () => {
    expect(GAME_WORLDS.map((game) => [game.name, game.minBalance])).toEqual([
      ["Mê cung kho báu", 50],
      ["Rừng chữ kỳ diệu", 120],
      ["Đảo dấu thanh", 200],
      ["Lâu đài ghép vần", 300],
    ]);
    for (const game of GAME_WORLDS) {
      expect(game.minBalance).toBe(GAME_MIN_BALANCE[game.key]);
      expect(game.plannedPhase).toMatch(/^R0[7-9]/u);
    }
    expect(MAP_TILES).toHaveLength(8);
  });
});

describe("Game World không lưu, không gửi, không thanh toán (quét mã nguồn)", () => {
  const files = [
    ...sourceFiles("src/components/adventure"),
    ...sourceFiles("src/components/art"),
    ...sourceFiles("src/features/game-world"),
    ...sourceFiles("src/features/gamification"),
    ...sourceFiles("src/features/demo"),
    ...sourceFiles("src/app/learn"),
  ];

  it("không localStorage/sessionStorage/IndexedDB/cookie, không fetch/XHR/sendBeacon/WebSocket, không Server Action", () => {
    const pattern =
      /localStorage|sessionStorage|indexedDB|document\.cookie|\bfetch\(|XMLHttpRequest|sendBeacon|WebSocket|"use server"/u;
    expect(files.filter((file) => pattern.test(file.text)).map((file) => file.path)).toEqual([]);
  });

  it("không có thanh toán/mua bán, không liên kết ra ngoài, không route game chưa tồn tại", () => {
    const payment = /payment|checkout|stripe|paypal|thanh toán|mua ngay|nạp tiền/iu;
    const external = /href=["'`]https?:/u;
    // Route game có thật duy nhất: Mê cung kho báu có xác thực (R07.5b2); mọi đường dẫn game khác vẫn bị cấm.
    const gameRoute = /\/learn\/games|\/games\/(?!treasure-maze\b)/u;
    expect(files.filter((file) => payment.test(file.text)).map((file) => file.path)).toEqual([]);
    expect(files.filter((file) => external.test(file.text)).map((file) => file.path)).toEqual([]);
    expect(files.filter((file) => gameRoute.test(file.text)).map((file) => file.path)).toEqual([]);
  });

  it("không dùng Math.random/Date.now trong dữ liệu và luật (hàm thuần, tái lập)", () => {
    const impure = /Math\.random|Date\.now/u;
    expect(files.filter((file) => impure.test(file.text)).map((file) => file.path)).toEqual([]);
  });
});
