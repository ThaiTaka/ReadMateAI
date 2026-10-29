import { describe, expect, it } from "vitest";
import { canAppearOnLeaderboard, consentStateFor, type ConsentRecord } from "@/features/consent/consent";
import {
  BACKUP_CODE_LENGTH,
  CROCKFORD_ALPHABET,
  formatBackupCode,
  generateLoginCode,
  hmacHex,
  hmacLoginCode,
  isUsablePepper,
  isWellFormedToken,
  normalizeBackupCode,
  TOKEN_LENGTH,
  toPgBytea,
} from "@/features/login-codes/codes";
import { checkDisplayName, checkLeaderboardAlias, nameKey, normalizeName } from "@/features/students/names";
import { readSupabasePublicEnv } from "@/lib/supabase/env";
import { mapDbError } from "@/server/result";

const PEPPER = "p".repeat(48);

describe("biệt danh và tên hiển thị (features/students/names)", () => {
  it("chuẩn hóa NFC, gộp khoảng trắng (kể cả khoảng trắng không ngắt), cắt hai đầu", () => {
    expect(normalizeName("  Su\u00A0\u00A0Su  ")).toBe("Su Su");
    expect(normalizeName("A\u0301nh")).toBe("Ánh");
  });

  it.each(["Bống", "Su Su", "Tí-Nị", "Bé 2", "Ánh"])("chấp nhận %s", (name) => {
    expect(checkDisplayName(name)).toEqual({ ok: true, value: name.normalize("NFC") });
  });

  it.each([
    ["", "EMPTY"],
    ["   ", "EMPTY"],
    ["a".repeat(31), "TOO_LONG"],
    ["Bin 😀", "INVALID_CHARACTERS"],
    ["Na\u200BNa", "INVALID_CHARACTERS"],
    ["<b>Bin</b>", "INVALID_CHARACTERS"],
    ["bin.example.com", "INVALID_CHARACTERS"],
    ["Nguyễn Văn An", "LOOKS_LIKE_FULL_NAME"],
  ])("từ chối %j (%s)", (name, issue) => {
    expect(checkDisplayName(name)).toEqual({ ok: false, issue });
  });

  it("tên hiển thị trên bảng tối đa 20 ký tự", () => {
    expect(checkLeaderboardAlias("Sao Sáng").ok).toBe(true);
    expect(checkLeaderboardAlias("a".repeat(21))).toEqual({ ok: false, issue: "TOO_LONG" });
  });

  it("khóa so trùng không phân biệt hoa thường, kể cả chữ có dấu", () => {
    expect(nameKey("ÁNH")).toBe(nameKey("ánh"));
  });
});

describe("thẻ học (features/login-codes/codes)", () => {
  it("sinh mã QR 43 ký tự base64url và mã dự phòng 8 ký tự Crockford, khác nhau mỗi lần", () => {
    const first = generateLoginCode();
    const second = generateLoginCode();
    expect(first.token).toHaveLength(TOKEN_LENGTH);
    expect(isWellFormedToken(first.token)).toBe(true);
    expect(first.backupCode).toHaveLength(BACKUP_CODE_LENGTH);
    for (const char of first.backupCode) expect(CROCKFORD_ALPHABET).toContain(char);
    expect(first.token).not.toBe(second.token);
  });

  it("mã dự phòng: định dạng in ABCD-EFGH; người dùng gõ thường/khoảng trắng/gạch/O/I/L vẫn nhận đúng", () => {
    expect(formatBackupCode("ABCD1234")).toBe("ABCD-1234");
    expect(normalizeBackupCode(" abcd-1234 ")).toBe("ABCD1234");
    expect(normalizeBackupCode("O0IL-1111")).toBe("00111111");
    expect(normalizeBackupCode("ABC")).toBeNull();
    expect(normalizeBackupCode("ABCD-123U")).toBeNull();
  });

  it("token sai định dạng bị từ chối trước khi gọi máy chủ", () => {
    expect(isWellFormedToken("abc")).toBe(false);
    expect(isWellFormedToken(`${"a".repeat(42)}!`)).toBe(false);
  });

  it("HMAC xác định, 32 byte, tách miền theo loại mã, phụ thuộc pepper", () => {
    const a = hmacLoginCode(PEPPER, "backup", "ABCD1234");
    expect(a).toHaveLength(32);
    expect(hmacLoginCode(PEPPER, "backup", "ABCD1234").equals(a)).toBe(true);
    expect(hmacLoginCode(PEPPER, "token", "ABCD1234").equals(a)).toBe(false);
    expect(hmacLoginCode("q".repeat(48), "backup", "ABCD1234").equals(a)).toBe(false);
    expect(toPgBytea(a)).toMatch(/^\\x[0-9a-f]{64}$/u);
    expect(hmacHex(PEPPER, "join.address", "1.2.3.4")).toMatch(/^[0-9a-f]{64}$/u);
  });

  it("pepper thiếu hoặc quá ngắn → không tính HMAC", () => {
    expect(isUsablePepper(undefined)).toBe(false);
    expect(isUsablePepper("ngan")).toBe(false);
    expect(() => hmacLoginCode("ngan", "token", "x")).toThrow("LOGIN_CODE_PEPPER_MISSING");
  });
});

describe("đồng ý hai phạm vi (features/consent)", () => {
  const record = (scope: ConsentRecord["scope"], status: ConsentRecord["status"], at: string): ConsentRecord => ({
    scope,
    status,
    recordedAt: at,
    withdrawnAt: status === "withdrawn" ? at : null,
    noticeVersion: "nhap-2026-10",
  });

  it("không có bản ghi = chưa xác nhận (không bao giờ mặc định đồng ý)", () => {
    expect(consentStateFor([], "learning_data")).toEqual({ state: "none" });
    expect(canAppearOnLeaderboard([])).toBe(false);
  });

  it("phân biệt đã xác nhận / đã rút lại; ghi nhận lại sau khi rút → đã xác nhận", () => {
    const withdrawn = record("learning_data", "withdrawn", "2026-10-01");
    expect(consentStateFor([withdrawn], "learning_data").state).toBe("withdrawn");
    const again = record("learning_data", "granted", "2026-10-05");
    expect(consentStateFor([withdrawn, again], "learning_data").state).toBe("granted");
  });

  it("hai phạm vi độc lập; bảng xếp hạng cần cả hai", () => {
    const learning = record("learning_data", "granted", "2026-10-01");
    expect(consentStateFor([learning], "leaderboard_display").state).toBe("none");
    expect(canAppearOnLeaderboard([learning])).toBe(false);
    expect(canAppearOnLeaderboard([learning, record("leaderboard_display", "granted", "2026-10-02")])).toBe(true);
  });
});

describe("cấu hình Supabase (lib/supabase/env)", () => {
  it("chỉ nhận khóa publishable kiểu mới; khóa JWT anon cũ bị từ chối", () => {
    expect(readSupabasePublicEnv({})).toBeNull();
    expect(
      readSupabasePublicEnv({
        NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "eyJhbGciOi.legacy",
      }),
    ).toBeNull();
    expect(
      readSupabasePublicEnv({
        NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321/",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_x",
      }),
    ).toEqual({ url: "http://127.0.0.1:54321", publishableKey: "sb_publishable_x" });
  });
});

describe("ánh xạ lỗi CSDL (server/result)", () => {
  it.each([
    [{ message: "FORBIDDEN", code: "42501" }, "FORBIDDEN"],
    [{ message: "permission denied for table students", code: "42501" }, "FORBIDDEN"],
    [{ message: "CONSENT_NOT_ACTIVE", code: "22023" }, "CONSENT_NOT_ACTIVE"],
    [
      { message: 'duplicate key value violates unique constraint "students_display_name_per_class"', code: "23505" },
      "DUPLICATE_NAME",
    ],
    [
      { message: 'duplicate key value violates unique constraint "students_alias_per_class"', code: "23505" },
      "DUPLICATE_ALIAS",
    ],
    [{ message: "new row violates check constraint", code: "23514" }, "INVALID_INPUT"],
    [{ message: "lỗi lạ có chi tiết nội bộ", code: "XX000" }, "UNKNOWN"],
  ])("%j → %s (không chuyển nguyên văn lỗi cho người dùng)", (error, code) => {
    expect(mapDbError(error)).toBe(code);
  });
});

describe("cookie phiên (lib/supabase/cookie-options)", () => {
  it("chỉ bỏ cờ Secure khi trang chạy rõ ràng trên http localhost; mọi trường hợp khác giữ Secure", async () => {
    const { isLocalHttpSite } = await import("@/lib/supabase/cookie-options");
    expect(isLocalHttpSite("http://127.0.0.1:3000")).toBe(true);
    expect(isLocalHttpSite("http://localhost")).toBe(true);
    expect(isLocalHttpSite(undefined)).toBe(false);
    expect(isLocalHttpSite("https://readmate.example")).toBe(false);
    expect(isLocalHttpSite("http://127.0.0.1.evil.example")).toBe(false);
  });
});
