import { createHmac, randomBytes, randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { inject } from "vitest";
import { generateLoginCode, hmacLoginCode, toPgBytea, type LoginCodeKind } from "../../src/features/login-codes/codes";
import type { Database } from "../../src/lib/supabase/database.types";

/**
 * Trợ giúp kiểm thử tích hợp: tạo GV/thiết bị THẬT trên Supabase local (Auth + PostgREST) và một "thế giới"
 * 2 lớp × 2 GV × 3 học sinh, thiết bị chưa liên kết / đã liên kết / đã thu hồi. Dữ liệu giả, tên ngẫu nhiên để
 * không đụng dữ liệu seed. Email ghép lúc chạy (tên miền dành riêng .test).
 */

export type Db = SupabaseClient<Database>;
export const local = inject("supabase");
const NO_PERSIST = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };

export const admin: Db = createClient<Database>(local.url, local.secretKey, NO_PERSIST);
export const publicClient = (): Db => createClient<Database>(local.url, local.publishableKey, NO_PERSIST);
export const PEPPER = randomBytes(48).toString("base64url");
export const suffix = () => randomUUID().slice(0, 8);
export const testEmail = (label: string) => [`${label}-${suffix()}`, ["readmate", "test"].join(".")].join("@");
export const strongPassword = () => `Rm${randomBytes(12).toString("base64url")}7x`;

export type Actor = { client: Db; id: string };

export async function newSchool(): Promise<string> {
  const { data, error } = await admin
    .from("schools")
    .insert({ name: `Trường thử ${suffix()}` })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

export async function newTeacher(schoolId: string, label = "gv"): Promise<Actor & { email: string; password: string }> {
  const email = testEmail(label);
  const password = strongPassword();
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error || !created.data.user) throw created.error ?? new Error("createUser");
  const id = created.data.user.id;
  const profile = await admin
    .from("staff_profiles")
    .insert({ id, school_id: schoolId, display_name: `GV thử ${suffix()}` });
  if (profile.error) throw profile.error;
  const client = publicClient();
  const signIn = await client.auth.signInWithPassword({ email, password });
  if (signIn.error) throw signIn.error;
  return { client, id, email, password };
}

export async function newDevice(): Promise<Actor> {
  const client = publicClient();
  const { data, error } = await client.auth.signInAnonymously();
  if (error || !data.user) throw error ?? new Error("signInAnonymously");
  return { client, id: data.user.id };
}

/** Chờ một lời gọi Supabase, ném lỗi nếu có; trả `data` (null với hàm trả void). */
export async function rpcOk<T>(promise: PromiseLike<{ data: T | null; error: unknown }>): Promise<NonNullable<T>> {
  const { data, error } = await promise;
  if (error) throw new Error(JSON.stringify(error));
  return data as NonNullable<T>;
}

export type IssuedTestCode = { codeId: string; token: string; backup: string };

/** Cấp thẻ học bằng JWT của GV (như Server Action), HMAC bằng pepper của bộ kiểm thử. */
export async function issueCode(
  teacher: Db,
  studentId: string,
  options: { maxDevices?: number; days?: number } = {},
): Promise<IssuedTestCode> {
  const code = generateLoginCode();
  const codeId = await rpcOk(
    teacher.rpc("teacher_issue_login_code", {
      p_student_id: studentId,
      p_token_hmac: toPgBytea(hmacLoginCode(PEPPER, "token", code.token)),
      p_backup_code_hmac: toPgBytea(hmacLoginCode(PEPPER, "backup", code.backupCode)),
      p_expires_at: new Date(Date.now() + (options.days ?? 7) * 24 * 3600 * 1000).toISOString(),
      p_max_devices: options.maxDevices ?? 3,
    }),
  );
  return { codeId, token: code.token, backup: code.backupCode };
}

/** Liên kết thiết bị như student gateway (service_role), sau khi máy chủ đã xác minh phiên ẩn danh. */
export async function redeem(kind: LoginCodeKind, code: string, authUserId: string) {
  const { data, error } = await admin.rpc("gateway_redeem_login_code", {
    p_code_hmac: toPgBytea(hmacLoginCode(PEPPER, kind, code)),
    p_kind: kind,
    p_auth_user_id: authUserId,
  });
  if (error) throw new Error(JSON.stringify(error));
  return data[0] ?? { outcome: "invalid", student_id: null, device_id: null };
}

export type World = {
  schoolId: string;
  teacherA: Actor;
  teacherB: Actor;
  classA: string;
  classB: string;
  studentsA: string[];
  studentsB: string[];
  /** Thiết bị đã liên kết với học sinh A1. */
  deviceA1: Actor;
  /** Thiết bị đã liên kết với học sinh B1. */
  deviceB1: Actor;
  /** Thiết bị đã liên kết với A2 rồi bị GV thu hồi. */
  revokedDevice: Actor;
  /** Người dùng ẩn danh chưa liên kết. */
  unlinkedDevice: Actor;
};

const NAMES_A = ["Bống", "Su Su", "Tí Nị"];
const NAMES_B = ["Bin", "Na Na", "Cốm"];

export async function buildWorld(): Promise<World> {
  const schoolId = await newSchool();
  const teacherA = await newTeacher(schoolId, "gv-a");
  const teacherB = await newTeacher(schoolId, "gv-b");
  const classA = await rpcOk(
    teacherA.client.rpc("teacher_create_class", { p_name: `Lớp A ${suffix()}`, p_school_year: "2026-2027" }),
  );
  const classB = await rpcOk(
    teacherB.client.rpc("teacher_create_class", { p_name: `Lớp B ${suffix()}`, p_school_year: "2026-2027" }),
  );
  const createStudents = async (teacher: Db, classId: string, names: string[]) => {
    const ids: string[] = [];
    for (const [index, name] of names.entries()) {
      ids.push(
        await rpcOk(
          teacher.rpc("teacher_create_student", {
            p_class_id: classId,
            p_display_name: name,
            p_student_number: index + 1,
            p_avatar_key: "may",
          }),
        ),
      );
    }
    return ids;
  };
  const studentsA = await createStudents(teacherA.client, classA, NAMES_A);
  const studentsB = await createStudents(teacherB.client, classB, NAMES_B);

  const deviceA1 = await newDevice();
  const codeA1 = await issueCode(teacherA.client, studentsA[0]!);
  await redeem("backup", codeA1.backup, deviceA1.id);

  const deviceB1 = await newDevice();
  const codeB1 = await issueCode(teacherB.client, studentsB[0]!);
  await redeem("token", codeB1.token, deviceB1.id);

  const revokedDevice = await newDevice();
  const codeA2 = await issueCode(teacherA.client, studentsA[1]!);
  const linked = await redeem("backup", codeA2.backup, revokedDevice.id);
  await rpcOk(teacherA.client.rpc("teacher_revoke_device", { p_device_id: linked.device_id! }));

  const unlinkedDevice = await newDevice();
  return {
    schoolId,
    teacherA,
    teacherB,
    classA,
    classB,
    studentsA,
    studentsB,
    deviceA1,
    deviceB1,
    revokedDevice,
    unlinkedDevice,
  };
}

/** JWT HS256 tự ký (chỉ để thử token hết hạn/giả mạo trên Supabase local). */
export function signJwt(payload: Record<string, unknown>, secret: string): string {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const body = `${encode({ alg: "HS256", typ: "JWT" })}.${encode(payload)}`;
  return `${body}.${createHmac("sha256", secret).update(body).digest("base64url")}`;
}
