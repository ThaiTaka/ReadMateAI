"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { AVATAR_OPTIONS } from "@/features/avatars/catalog";
import {
  hmacLoginCode,
  isUsablePepper,
  isWellFormedToken,
  normalizeBackupCode,
  toPgBytea,
  type LoginCodeKind,
} from "@/features/login-codes/codes";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { consumeRateLimit, RATE_LIMITS } from "@/server/rate-limit";
import { clientAddressForRateLimit } from "@/server/request-context";
import type { ErrorCode } from "@/server/result";
import { getDeviceSession } from "./session";

export type JoinState = { status: "idle" } | { status: "error"; code: ErrorCode };

const joinSchema = z.strictObject({
  kind: z.enum(["token", "backup"]),
  code: z.string().min(1).max(100),
});

/**
 * Liên kết thiết bị bằng thẻ học (ARCHITECTURE §8.2, docs/STUDENT_ACCESS.md):
 *   1. kiểm tra định dạng (không gọi mạng nếu sai) → 2. giới hạn tần suất (IP + toàn hệ thống)
 *   → 3. HMAC mã bằng pepper → 4. kiểm tra mã còn dùng được → 5. tạo phiên ẩn danh nếu chưa có
 *   → 6. liên kết trong MỘT hàm CSDL có khóa dòng (chống gửi đồng thời vượt số thiết bị).
 * Mọi trường hợp mã không dùng được trả cùng một lỗi CODE_INVALID — không tiết lộ mã sai, hết hạn hay bị thu hồi,
 * không tiết lộ bất kỳ thông tin học sinh nào. Không ghi log giá trị mã.
 */
export async function joinWithCode(_prev: JoinState, formData: FormData): Promise<JoinState> {
  const parsed = joinSchema.safeParse({ kind: formData.get("kind"), code: formData.get("code") });
  if (!parsed.success) return { status: "error", code: "CODE_INVALID" };

  const kind: LoginCodeKind = parsed.data.kind;
  const code = kind === "token" ? parsed.data.code.trim() : normalizeBackupCode(parsed.data.code);
  if (!code || (kind === "token" && !isWellFormedToken(code))) return { status: "error", code: "CODE_INVALID" };

  const pepper = process.env.LOGIN_CODE_PEPPER;
  const admin = createSupabaseAdminClient();
  const supabase = await createSupabaseServerClient();
  if (!admin || !supabase || !isUsablePepper(pepper)) return { status: "error", code: "NOT_CONFIGURED" };

  const [byAddress, global] = await Promise.all([
    consumeRateLimit(RATE_LIMITS.joinByAddress, await clientAddressForRateLimit()),
    consumeRateLimit(RATE_LIMITS.joinGlobal, "all"),
  ]);
  if (byAddress === "unavailable" || global === "unavailable") return { status: "error", code: "NOT_CONFIGURED" };
  if (byAddress === "limited" || global === "limited") return { status: "error", code: "RATE_LIMITED" };

  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims;
  // Trình duyệt đang đăng nhập GV: không thay phiên GV bằng phiên thiết bị học sinh.
  if (claims && claims.is_anonymous !== true) return { status: "error", code: "TEACHER_SESSION_ACTIVE" };

  const codeHmac = toPgBytea(hmacLoginCode(pepper, kind, code));
  const { data: usable } = await admin.rpc("gateway_check_login_code", { p_code_hmac: codeHmac, p_kind: kind });
  if (!usable) return { status: "error", code: "CODE_INVALID" };

  let authUserId = typeof claims?.sub === "string" ? claims.sub : null;
  if (!authUserId) {
    const { data: anon, error } = await supabase.auth.signInAnonymously();
    if (error || !anon.user) return { status: "error", code: error?.status === 429 ? "RATE_LIMITED" : "UNKNOWN" };
    authUserId = anon.user.id;
  }

  const { data: redeemed, error } = await admin.rpc("gateway_redeem_login_code", {
    p_code_hmac: codeHmac,
    p_kind: kind,
    p_auth_user_id: authUserId,
  });
  const outcome = redeemed?.[0]?.outcome;
  if (error || (outcome !== "linked" && outcome !== "already_linked")) return { status: "error", code: "CODE_INVALID" };

  redirect("/learn/me");
}

const preferencesSchema = z.strictObject({
  studentId: z.uuid(),
  avatarKey: z.enum(AVATAR_OPTIONS.map((option) => option.key) as [string, ...string[]]),
  motion: z.enum(["system", "reduce", "full"]),
  sound: z.enum(["on", "off"]),
});

export type PreferencesState = { status: "idle" } | { status: "saved" } | { status: "error"; code: ErrorCode };

/** Học sinh chọn avatar + cài đặt trợ năng. Ghi qua máy chủ (học sinh không ghi trực tiếp vào CSDL). */
export async function updateStudentPreferences(_prev: PreferencesState, formData: FormData): Promise<PreferencesState> {
  const parsed = preferencesSchema.safeParse({
    studentId: formData.get("studentId"),
    avatarKey: formData.get("avatarKey"),
    motion: formData.get("motion"),
    sound: formData.get("sound"),
  });
  if (!parsed.success) return { status: "error", code: "INVALID_INPUT" };

  const session = await getDeviceSession();
  if (session.state !== "linked") return { status: "error", code: "UNAUTHENTICATED" };
  // studentId chỉ là khóa tra cứu: phải thuộc các hồ sơ mà RLS cho thiết bị này thấy.
  if (!session.students.some((student) => student.id === parsed.data.studentId)) {
    return { status: "error", code: "FORBIDDEN" };
  }
  const admin = createSupabaseAdminClient();
  if (!admin) return { status: "error", code: "NOT_CONFIGURED" };
  const { data, error } = await admin.rpc("gateway_update_student_preferences", {
    p_auth_user_id: session.authUserId,
    p_student_id: parsed.data.studentId,
    p_avatar_key: parsed.data.avatarKey,
    p_motion: parsed.data.motion,
    p_sound: parsed.data.sound,
  });
  if (error || data !== true) return { status: "error", code: "FORBIDDEN" };
  refresh();
  return { status: "saved" };
}

/** Đăng xuất phiên thiết bị trên trình duyệt này (liên kết còn lại do GV thu hồi ở trang học sinh). */
export async function signOutDevice(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  if (supabase) await supabase.auth.signOut({ scope: "local" });
  redirect("/join");
}
