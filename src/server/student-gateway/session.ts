import "server-only";
import { connection } from "next/server";
import { cache } from "react";
import { createSupabaseServerClient, type AppSupabaseClient } from "@/lib/supabase/server";

/**
 * Phiên thiết bị học sinh (student gateway — AD-04). Danh tính = người dùng ẩn danh đã xác minh bằng
 * `getClaims()`; danh sách học sinh đọc bằng CHÍNH JWT của thiết bị → RLS (`private.my_student_ids()`) chỉ
 * trả hồ sơ có liên kết còn hiệu lực. Thu hồi thiết bị/tạm ngưng hồ sơ có hiệu lực ngay ở request kế tiếp.
 *
 * Chỉ trả các trường học sinh được thấy về chính mình — KHÔNG nhóm năng lực, mức hỗ trợ, đồng ý, thẻ học.
 */

export type LinkedStudent = {
  id: string;
  displayName: string;
  avatarKey: string;
  motionPreference: "system" | "reduce" | "full";
  soundPreference: "on" | "off";
  className: string;
};

export type DeviceSession =
  | { state: "not_configured" }
  | { state: "none" }
  | { state: "teacher" }
  | { state: "unlinked"; authUserId: string }
  | { state: "linked"; authUserId: string; students: LinkedStudent[]; supabase: AppSupabaseClient };

async function loadDeviceSession(): Promise<DeviceSession> {
  // Phiên luôn đọc theo request: supabase-js kiểm tra hạn token bằng Date.now(), không được nằm trong bản prerender
  // (kể cả runtime prefetch của Partial Prefetching) — connection() loại phần này khỏi mọi bản dựng trước.
  await connection();
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { state: "not_configured" };
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims || typeof claims.sub !== "string") return { state: "none" };
  if (claims.is_anonymous !== true) return { state: "teacher" };

  const { data: rows, error } = await supabase
    .from("students")
    .select("id, display_name, avatar_key, motion_preference, sound_preference, classes(name)")
    .order("display_name");
  if (error || !rows || rows.length === 0) return { state: "unlinked", authUserId: claims.sub };

  return {
    state: "linked",
    authUserId: claims.sub,
    supabase,
    students: rows.map((row) => ({
      id: row.id,
      displayName: row.display_name,
      avatarKey: row.avatar_key,
      motionPreference:
        row.motion_preference === "reduce" || row.motion_preference === "full" ? row.motion_preference : "system",
      soundPreference: row.sound_preference === "off" ? "off" : "on",
      className: row.classes?.name ?? "",
    })),
  };
}

export const getDeviceSession = cache(loadDeviceSession);
