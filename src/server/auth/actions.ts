"use server";

import type { Route } from "next";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { consumeRateLimit, RATE_LIMITS } from "@/server/rate-limit";
import { clientAddressForRateLimit } from "@/server/request-context";
import type { ErrorCode } from "@/server/result";

export type SignInState = { status: "idle" } | { status: "error"; code: ErrorCode };

const signInSchema = z.strictObject({
  email: z.email().max(254),
  password: z.string().min(1).max(200),
  next: z.string().max(300).optional(),
});

/** Chỉ cho chuyển tiếp trong khu vực GV (chặn chuyển hướng mở ra ngoài). */
function safeNext(next: string | undefined): Route {
  if (next && /^\/teacher(?:[/?#]|$)/u.test(next) && !next.startsWith("//")) return next as Route;
  return "/teacher";
}

/**
 * Đăng nhập GV bằng email/mật khẩu (Supabase Auth đặt cookie phiên httpOnly qua Server Action).
 * Thông báo lỗi chung "email hoặc mật khẩu chưa đúng" — không tiết lộ email có tồn tại hay không.
 * Đăng nhập thành công nhưng không có hồ sơ GV đang hoạt động → đăng xuất ngay.
 */
export async function signInTeacher(_prev: SignInState, formData: FormData): Promise<SignInState> {
  const parsed = signInSchema.safeParse({
    email: String(formData.get("email") ?? "")
      .trim()
      .toLowerCase(),
    password: String(formData.get("password") ?? ""),
    next: formData.get("next") ? String(formData.get("next")) : undefined,
  });
  if (!parsed.success) return { status: "error", code: "INVALID_CREDENTIALS" };

  const supabase = await createSupabaseServerClient();
  if (!supabase) return { status: "error", code: "NOT_CONFIGURED" };

  const [byAddress, byAccount] = await Promise.all([
    consumeRateLimit(RATE_LIMITS.loginByAddress, await clientAddressForRateLimit()),
    consumeRateLimit(RATE_LIMITS.loginByAccount, parsed.data.email),
  ]);
  if (byAddress === "unavailable" || byAccount === "unavailable") return { status: "error", code: "NOT_CONFIGURED" };
  if (byAddress === "limited" || byAccount === "limited") return { status: "error", code: "RATE_LIMITED" };

  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });
  if (error || !data.user) return { status: "error", code: "INVALID_CREDENTIALS" };

  const { data: profile } = await supabase
    .from("staff_profiles")
    .select("id, is_active")
    .eq("id", data.user.id)
    .maybeSingle();
  if (!profile || !profile.is_active) {
    await supabase.auth.signOut();
    return { status: "error", code: "NOT_STAFF" };
  }

  redirect(safeNext(parsed.data.next));
}

/** Đăng xuất: thu hồi phiên ở Supabase (phạm vi thiết bị này) và xóa cookie. */
export async function signOutTeacher(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  if (supabase) await supabase.auth.signOut({ scope: "local" });
  redirect("/login?reason=signed_out");
}
