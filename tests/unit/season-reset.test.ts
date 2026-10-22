import { beforeEach, describe, expect, it, vi as vitest } from "vitest";
import {
  confirmationMatches,
  normalizeClassName,
  resetSeasonInput,
  resetSeasonOutput,
} from "@/features/gamification/season-reset";
import { ERROR_CODES, mapDbError } from "@/server/result";
import { vi } from "@/strings/vi";

const ids = {
  classId: "5eed0000-0000-4000-8000-0000000000a1",
  requestId: "5eed0000-0000-4000-8000-0000000000b1",
  expectedSeasonId: "5eed0000-0000-4000-8000-0000000000c1",
};
const input = { ...ids, confirmation: "1A2" };

describe("hợp đồng reset mùa (zod)", () => {
  it("nhận đúng bộ tham số; thiếu/thừa/sai kiểu bị từ chối", () => {
    expect(resetSeasonInput.safeParse(input).success).toBe(true);
    expect(resetSeasonInput.safeParse({ ...input, expectedSeasonId: undefined }).success).toBe(false);
    expect(resetSeasonInput.safeParse({ ...input, requestId: "khong-phai-uuid" }).success).toBe(false);
    expect(resetSeasonInput.safeParse({ ...input, confirmation: "" }).success).toBe(false);
    expect(resetSeasonInput.safeParse({ ...input, studentId: ids.classId }).success).toBe(false);
  });

  it("đầu ra CSDL: mùa mới phải có seq_no ≥ 2", () => {
    expect(resetSeasonOutput.safeParse({ new_season_id: ids.classId, seq_no: 2, replayed: false }).success).toBe(true);
    expect(resetSeasonOutput.safeParse({ new_season_id: ids.classId, seq_no: 1, replayed: false }).success).toBe(false);
  });
});

describe("so khớp tên lớp", () => {
  it("bỏ khoảng trắng hai đầu, chuẩn hóa NFC, phân biệt hoa/thường", () => {
    expect(confirmationMatches("1A2", "1A2")).toBe(true);
    expect(confirmationMatches("  1A2 ", "1A2")).toBe(true);
    expect(confirmationMatches("1a2", "1A2")).toBe(false);
    expect(confirmationMatches("1A3", "1A2")).toBe(false);
    // "Hòa" dạng tổ hợp (o + dấu huyền U+0300, dựng lúc chạy) vẫn khớp "Hòa" dựng sẵn.
    const nfd = "Hoa".replace("o", "o" + String.fromCharCode(0x300));
    expect(nfd).not.toBe("Hòa");
    expect(confirmationMatches(nfd, "Hòa")).toBe(true);
    expect(confirmationMatches(nfd, "Hoa")).toBe(false);
  });

  it("tên lớp rỗng không bao giờ khớp", () => {
    expect(confirmationMatches("", "")).toBe(false);
    expect(confirmationMatches("   ", "  ")).toBe(false);
  });
});

describe("mã lỗi reset", () => {
  it("CONFIRMATION_MISMATCH và SEASON_MISMATCH có trong danh mục và có câu chữ tiếng Việt", () => {
    for (const code of ["CONFIRMATION_MISMATCH", "SEASON_MISMATCH"] as const) {
      expect(ERROR_CODES).toContain(code);
      expect(vi.errors[code].length).toBeGreaterThan(10);
      expect(mapDbError({ message: code })).toBe(code);
    }
  });

  it("vi phạm unique của season_resets (cùng requestId ở hai lớp) → IDEMPOTENCY_CONFLICT", () => {
    expect(
      mapDbError({ code: "23505", message: 'duplicate key value violates unique constraint "season_resets_pkey"' }),
    ).toBe("IDEMPOTENCY_CONFLICT");
  });
});

// ---- Server Action: mock phiên GV và client Supabase (không gọi mạng) -----------------------------------------------
const rpc = vitest.fn();
let membership: { staff_id: string; role: string; removed_at: string | null } | null;
let className = "1A2";
let sessionResult: { ok: true; data: unknown } | { ok: false; code: string };

vitest.mock("@/server/auth/teacher", () => ({ getTeacherSession: async () => sessionResult }));

const { resetSeason } = await import("@/server/teacher/season");

beforeEach(() => {
  rpc.mockReset();
  className = "1A2";
  membership = { staff_id: "gv-1", role: "owner", removed_at: null };
  sessionResult = {
    ok: true,
    data: {
      userId: "gv-1",
      supabase: {
        from: () => ({
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: membership ? { name: className, class_staff: [membership] } : null,
              }),
            }),
          }),
        }),
        rpc,
      },
    },
  };
});

describe("resetSeason (Server Action)", () => {
  it("đầu vào sai → INVALID_INPUT, không gọi CSDL", async () => {
    expect(await resetSeason({ ...input, classId: "x" })).toEqual({ ok: false, code: "INVALID_INPUT" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("chưa đăng nhập / thiết bị học sinh → mã lỗi ổn định, không gọi CSDL", async () => {
    sessionResult = { ok: false, code: "UNAUTHENTICATED" };
    expect(await resetSeason(input)).toEqual({ ok: false, code: "UNAUTHENTICATED" });
    sessionResult = { ok: false, code: "STUDENT_DEVICE" };
    expect(await resetSeason(input)).toEqual({ ok: false, code: "FORBIDDEN" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("co_teacher hoặc không thuộc lớp → FORBIDDEN, không gọi CSDL", async () => {
    membership = { staff_id: "gv-1", role: "co_teacher", removed_at: null };
    expect(await resetSeason(input)).toEqual({ ok: false, code: "FORBIDDEN" });
    membership = null;
    expect(await resetSeason(input)).toEqual({ ok: false, code: "FORBIDDEN" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("sai tên lớp → CONFIRMATION_MISMATCH, không gọi CSDL", async () => {
    expect(await resetSeason({ ...input, confirmation: "1A3" })).toEqual({ ok: false, code: "CONFIRMATION_MISMATCH" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("thành công: gọi CSDL đúng tham số và trả newSeasonId, seqNo", async () => {
    rpc.mockResolvedValue({ data: { new_season_id: ids.classId, seq_no: 3, replayed: false }, error: null });
    expect(await resetSeason({ ...input, confirmation: " 1A2 " })).toEqual({
      ok: true,
      data: { newSeasonId: ids.classId, seqNo: 3 },
    });
    expect(rpc).toHaveBeenCalledWith("teacher_reset_season", {
      p_class_id: ids.classId,
      p_request_id: ids.requestId,
      p_expected_season_id: ids.expectedSeasonId,
      p_confirmation: " 1A2 ",
    });
  });

  it("lỗi CSDL → mã ổn định; đầu ra lạ → UNKNOWN", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "SEASON_MISMATCH" } });
    expect(await resetSeason(input)).toEqual({ ok: false, code: "SEASON_MISMATCH" });
    rpc.mockResolvedValue({ data: { hello: 1 }, error: null });
    expect(await resetSeason(input)).toEqual({ ok: false, code: "UNKNOWN" });
  });
});
