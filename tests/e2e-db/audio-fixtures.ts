import { createHash, randomBytes, randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { wav } from "../unit/audio-library/fixtures";
import { admin, API_URL, PUBLISHABLE_KEY } from "./class-fixtures";

/**
 * Dữ liệu dựng chung cho E2E âm thanh (R10.2/R10.3a): mỗi lần gọi `freshTeacher` tạo một TRƯỜNG + giáo viên hư cấu riêng,
 * nên các kịch bản (và các lần chạy lại trên cùng CSDL local) không bao giờ dùng chung asset/phiên bản âm thanh. Bản ghi
 * là SÓNG SIN TỔNG HỢP, không giọng người thật.
 */

export type TeacherWorld = {
  teacher: SupabaseClient;
  teacherId: string;
  schoolId: string;
  email: string;
  password: string;
};

/** Chèn không trả hàng (không `.select()`): chỉ cần biết có lỗi hay không. */
export async function exec(promise: PromiseLike<{ error: unknown }>): Promise<void> {
  const { error } = await promise;
  if (error) throw new Error(JSON.stringify(error));
}

/** `must` của class-fixtures trả cả null; ở đây hàng luôn tồn tại (vừa chèn/đọc theo khóa). */
export async function mustRow<T>(promise: PromiseLike<{ data: T; error: unknown }>): Promise<NonNullable<T>> {
  const { data, error } = await promise;
  if (error || data === null || data === undefined) throw new Error(JSON.stringify(error ?? "không có dữ liệu"));
  return data as NonNullable<T>;
}

export async function rpc(client: SupabaseClient, fn: string, args: Record<string, unknown>) {
  const { data, error } = await client.rpc(fn, args);
  if (error) throw new Error(`${fn}: ${JSON.stringify(error)}`);
  return data;
}

/** Trường + giáo viên mới (đã đăng nhập bằng JWT riêng để gọi các hàm `teacher_*`). */
export async function freshTeacher(prefix: string): Promise<TeacherWorld> {
  const hex = randomBytes(4).toString("hex");
  const schoolId = (
    await mustRow(
      admin
        .from("schools")
        .insert({ name: `Trường ${prefix} ${hex}` })
        .select("id")
        .single(),
    )
  ).id;
  const email = [`gv-${prefix}-${hex}`, ["readmate", "test"].join(".")].join("@");
  const password = `Rm${randomBytes(12).toString("base64url")}7x`;
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error || !created.data.user) throw created.error ?? new Error("createUser");
  const teacherId = created.data.user.id;
  await exec(
    admin.from("staff_profiles").insert({ id: teacherId, school_id: schoolId, display_name: `GV ${prefix} ${hex}` }),
  );
  const teacher = createClient(API_URL, PUBLISHABLE_KEY, { auth: { persistSession: false } });
  const signIn = await teacher.auth.signInWithPassword({ email, password });
  if (signIn.error) throw signIn.error;
  return { teacher, teacherId, schoolId, email, password };
}

/** Bản ghi TỔNG HỢP đã duyệt qua đúng hàm teacher_* (JWT giáo viên) + tệp thật trong Storage riêng tư. */
export async function approvedRecording(
  world: Pick<TeacherWorld, "teacher" | "schoolId">,
  unit: string,
  label: string,
  index: number,
): Promise<string> {
  const bytes = Buffer.from(wav(0.5 + index * 0.1, 8000));
  const assetId = (await rpc(world.teacher, "teacher_ensure_audio_asset", {
    p_unit_kind: "phoneme",
    p_unit_text: unit,
    p_proposed_label: label,
  })) as string;
  await rpc(world.teacher, "teacher_confirm_audio_pronunciation", { p_asset_id: assetId, p_label: label });
  const versionId = randomUUID();
  const key = `${world.schoolId}/${assetId}/${versionId}.wav`;
  const up = await admin.storage.from("teacher-audio").upload(key, bytes, { contentType: "audio/wav", upsert: false });
  if (up.error) throw up.error;
  await rpc(world.teacher, "teacher_create_audio_version", {
    p_asset_id: assetId,
    p_version_id: versionId,
    p_storage_key: key,
    p_content_hash: createHash("sha256").update(bytes).digest("hex"),
    p_mime_type: "audio/wav",
    p_size_bytes: bytes.byteLength,
    p_duration_ms: 1000,
  });
  await rpc(world.teacher, "teacher_submit_audio_version", { p_version_id: versionId });
  await rpc(world.teacher, "teacher_review_audio_version", {
    p_version_id: versionId,
    p_decision: "approve",
    p_note: "",
    p_listened: true,
  });
  return versionId;
}
