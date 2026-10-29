import { describe, expect, it } from "vitest";
import {
  assertAllFlags,
  FlagQueryError,
  parseFlagRows,
  stdoutOrThrow,
  type FlagQueryErrorCode,
} from "../../../scripts/lib/flag-query";

/** Khóa giả: bộ phân tích nhận danh sách mong đợi từ nơi gọi, nên không cần nhắc tên cờ thật ở đây. */
const KEYS = ["flag_a", "flag_b", "flag_c", "flag_d"] as const;
const rows = (enabled = false) => KEYS.map((key) => ({ key, enabled }));

const codeOf = (fn: () => unknown): FlagQueryErrorCode | undefined => {
  try {
    fn();
  } catch (error) {
    return error instanceof FlagQueryError ? error.code : undefined;
  }
  return undefined;
};

describe("parseFlagRows", () => {
  it("đọc mảng trần (`--agent no`, đầu ra thật của CLI 2.121) — đúng đầu ra làm hỏng mã cũ", () => {
    const stdout = JSON.stringify(rows(), null, 2) + "\n";
    // Mã cũ: cắt tại `{` đầu tiên (của hàng đầu) rồi phân tích → ném lỗi "non-whitespace character after JSON".
    expect(() => JSON.parse(stdout.slice(stdout.indexOf("{")))).toThrow(/after JSON/u);
    expect([...parseFlagRows(stdout, KEYS)]).toEqual(KEYS.map((key) => [key, false]));
  });

  it("đọc phong bì có metadata (`--agent yes`: boundary, rows, warning)", () => {
    const envelope = { boundary: "abc123", rows: rows(true), warning: "untrusted data <abc123>" };
    const flags = parseFlagRows(JSON.stringify(envelope, null, 2), KEYS);
    expect([...flags.values()]).toEqual([true, true, true, true]);
  });

  it("chịu được CRLF và khoảng trắng đầu/cuối, giữ nguyên giá trị từng cờ", () => {
    const mixed = [
      { key: "flag_a", enabled: true },
      { key: "flag_b", enabled: false },
      { key: "flag_c", enabled: true },
      { key: "flag_d", enabled: false },
    ];
    const stdout = `\r\n${JSON.stringify(mixed, null, 2).replaceAll("\n", "\r\n")}\r\n`;
    expect(Object.fromEntries(parseFlagRows(stdout, KEYS))).toEqual({
      flag_a: true,
      flag_b: false,
      flag_c: true,
      flag_d: false,
    });
  });

  it.each([
    ["rỗng", ""],
    ["có chữ thừa trước JSON (không cắt chuỗi để đoán)", `Connecting to local database...\n${JSON.stringify(rows())}`],
    ["JSON cụt", '[{"key":"flag_a","enabled":false'],
  ])("đầu ra %s → INVALID_JSON", (_name, stdout) => {
    expect(codeOf(() => parseFlagRows(stdout, KEYS))).toBe("INVALID_JSON");
  });

  it.each([
    ["số", "42"],
    ["null", "null"],
    ["đối tượng không có rows", JSON.stringify({ boundary: "x" })],
    ["rows không phải mảng", JSON.stringify({ rows: "no" })],
    ["enabled là chuỗi", JSON.stringify([{ key: "flag_a", enabled: "false" }])],
    ["thiếu enabled", JSON.stringify([{ key: "flag_a" }])],
    ["key không phải chuỗi", JSON.stringify([{ key: 1, enabled: false }])],
  ])("sai hình dạng (%s) → UNEXPECTED_SHAPE", (_name, stdout) => {
    expect(codeOf(() => parseFlagRows(stdout, KEYS))).toBe("UNEXPECTED_SHAPE");
  });

  it("thiếu cờ → MISSING_FLAGS nêu tên cờ thiếu, không mặc định TẮT", () => {
    const stdout = JSON.stringify(rows().slice(0, 3));
    expect(codeOf(() => parseFlagRows(stdout, KEYS))).toBe("MISSING_FLAGS");
    expect(() => parseFlagRows(stdout, KEYS)).toThrow(/flag_d/u);
    expect(codeOf(() => parseFlagRows("[]", KEYS))).toBe("MISSING_FLAGS");
  });

  it("cờ ngoài danh sách cố định → UNEXPECTED_KEYS; cờ lặp → DUPLICATE_KEYS", () => {
    expect(codeOf(() => parseFlagRows(JSON.stringify([...rows(), { key: "other", enabled: true }]), KEYS))).toBe(
      "UNEXPECTED_KEYS",
    );
    expect(codeOf(() => parseFlagRows(JSON.stringify([...rows(), { key: "flag_a", enabled: true }]), KEYS))).toBe(
      "DUPLICATE_KEYS",
    );
  });
});

describe("stdoutOrThrow (lỗi CLI)", () => {
  it("mã thoát 0 → trả stdout", () => {
    expect(stdoutOrThrow({ status: 0, stdout: "[]", stderr: "Connecting to local database...\n" })).toBe("[]");
  });

  it("mã thoát khác 0 → CLI_FAILED, nêu nguyên nhân và bỏ thông báo cập nhật phiên bản", () => {
    const stderr = [
      "Connecting to local database...",
      "failed to connect to postgres: connection refused",
      "A new version of Supabase CLI is available: v9.9.9 (currently installed v1.0.0)",
      "We recommend updating regularly for new features and bug fixes: https://example.invalid",
    ].join("\r\n");
    let caught: unknown;
    try {
      stdoutOrThrow({ status: 1, stdout: "", stderr });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(FlagQueryError);
    const message = (caught as FlagQueryError).message;
    expect((caught as FlagQueryError).code).toBe("CLI_FAILED");
    expect(message).toMatch(/mã 1/u);
    expect(message).toMatch(/connection refused/u);
    expect(message).not.toMatch(/new version|recommend/iu);
  });

  it("không chạy được tiến trình (error) hoặc bị tín hiệu (status null) → CLI_FAILED", () => {
    expect(
      codeOf(() => stdoutOrThrow({ status: null, stdout: "", stderr: "", error: new Error("spawn ENOENT") })),
    ).toBe("CLI_FAILED");
    expect(codeOf(() => stdoutOrThrow({ status: null, stdout: "", stderr: "" }))).toBe("CLI_FAILED");
  });
});

describe("assertAllFlags (xác minh sau cập nhật)", () => {
  it("đúng giá trị mong muốn → không ném", () => {
    expect(() => assertAllFlags(new Map(rows(true).map((r) => [r.key, r.enabled])), true)).not.toThrow();
    expect(() => assertAllFlags(new Map(rows(false).map((r) => [r.key, r.enabled])), false)).not.toThrow();
  });

  it("còn cờ sai giá trị → VERIFY_MISMATCH nêu tên cờ", () => {
    const flags = new Map<string, boolean>(rows(true).map((r) => [r.key, r.enabled]));
    flags.set("flag_c", false);
    expect(codeOf(() => assertAllFlags(flags, true))).toBe("VERIFY_MISMATCH");
    expect(() => assertAllFlags(flags, true)).toThrow(/flag_c/u);
  });
});
