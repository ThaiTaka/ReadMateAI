"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { AVATAR_OPTIONS } from "@/features/avatars/catalog";
import { CONSENT_METHODS, CONSENT_NOTICES, CONSENT_SCOPES } from "@/features/consent/consent";
import {
  formatBackupCode,
  generateLoginCode,
  hmacLoginCode,
  isUsablePepper,
  toPgBytea,
} from "@/features/login-codes/codes";
import { checkDisplayName, checkLeaderboardAlias, normalizeName } from "@/features/students/names";
import { getTeacherSession, type TeacherSession } from "@/server/auth/teacher";
import { siteOrigin } from "@/server/request-context";
import { mapDbError, type ErrorCode } from "@/server/result";
import { qrRows } from "./qr";

/**
 * Server Actions của giáo viên. Mỗi action: xác thực (DAL) → zod → gọi hàm CSDL `teacher_*` bằng JWT của GV
 * (hàm tự kiểm tra quyền lần nữa và ghi audit_logs trong cùng giao dịch) → kết quả có kiểu.
 * Tham số bind (classId, studentId…) cũng đến từ client nên luôn được kiểm tra định dạng; quyền do CSDL quyết định.
 */

export type ActionState = { status: "idle" } | { status: "ok" } | { status: "error"; code: ErrorCode };
const failed = (code: ErrorCode): ActionState => ({ status: "error", code });

const uuid = z.uuid();
const field = (formData: FormData, name: string) => {
  const value = formData.get(name);
  return typeof value === "string" ? value : undefined;
};

async function teacher(): Promise<{ ok: true; session: TeacherSession } | { ok: false; code: ErrorCode }> {
  const result = await getTeacherSession();
  if (result.ok) return { ok: true, session: result.data };
  if (result.code === "STUDENT_DEVICE" || result.code === "NOT_STAFF") return { ok: false, code: "FORBIDDEN" };
  return { ok: false, code: result.code };
}

async function run(
  invoke: (session: TeacherSession) => PromiseLike<{ error: { code?: string; message?: string } | null }>,
): Promise<ActionState> {
  const auth = await teacher();
  if (!auth.ok) return failed(auth.code);
  const { error } = await invoke(auth.session);
  if (error) return failed(mapDbError(error));
  refresh();
  return { status: "ok" };
}

// ---------------------------------------------------------------------------------------------------------------
// Lớp học
// ---------------------------------------------------------------------------------------------------------------

const classNameSchema = z
  .string()
  .transform(normalizeName)
  .pipe(
    z
      .string()
      .min(1)
      .max(40)
      .regex(/^[\p{L}\p{N}][\p{L}\p{M}\p{N} .-]*$/u),
  );
const schoolYearSchema = z
  .string()
  .regex(/^\d{4}-\d{4}$/u)
  .refine((value) => Number(value.slice(5)) === Number(value.slice(0, 4)) + 1);

export async function createClass(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = z
    .strictObject({ name: classNameSchema, schoolYear: schoolYearSchema })
    .safeParse({ name: field(formData, "name"), schoolYear: field(formData, "schoolYear") });
  if (!parsed.success) return failed("INVALID_INPUT");
  const auth = await teacher();
  if (!auth.ok) return failed(auth.code);
  const { data, error } = await auth.session.supabase.rpc("teacher_create_class", {
    p_name: parsed.data.name,
    p_school_year: parsed.data.schoolYear,
  });
  if (error || !data) return failed(mapDbError(error));
  redirect(`/teacher/classes/${data}`);
}

export async function renameClass(classId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = z
    .strictObject({ classId: uuid, name: classNameSchema })
    .safeParse({ classId, name: field(formData, "name") });
  if (!parsed.success) return failed("INVALID_INPUT");
  return run((session) =>
    session.supabase.rpc("teacher_rename_class", { p_class_id: parsed.data.classId, p_name: parsed.data.name }),
  );
}

const optionalUuid = z.union([z.literal("").transform(() => null), uuid]);

export async function setClassCurriculum(
  classId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = z
    .strictObject({ classId: uuid, seriesId: optionalUuid, lessonId: optionalUuid })
    .safeParse({ classId, seriesId: field(formData, "seriesId") ?? "", lessonId: field(formData, "lessonId") ?? "" });
  if (!parsed.success) return failed("INVALID_INPUT");
  return run((session) =>
    session.supabase.rpc("teacher_set_class_curriculum", {
      p_class_id: parsed.data.classId,
      // Các hàm CSDL nhận null cho "chưa chọn"; kiểu sinh tự động khai báo string nên ép kiểu tường minh.
      p_series_id: parsed.data.seriesId as string,
      p_lesson_id: (parsed.data.seriesId ? parsed.data.lessonId : null) as string,
    }),
  );
}

export async function confirmClassCurriculum(classId: string): Promise<ActionState> {
  if (!uuid.safeParse(classId).success) return failed("INVALID_INPUT");
  return run((session) => session.supabase.rpc("teacher_confirm_class_curriculum", { p_class_id: classId }));
}

// ---------------------------------------------------------------------------------------------------------------
// Học sinh
// ---------------------------------------------------------------------------------------------------------------

const avatarKeySchema = z.enum(AVATAR_OPTIONS.map((option) => option.key) as [string, ...string[]]);
const studentNumberSchema = z.union([z.literal("").transform(() => null), z.coerce.number().int().min(1).max(99)]);

function studentFields(formData: FormData) {
  return z
    .strictObject({
      displayName: z.string(),
      studentNumber: studentNumberSchema,
      avatarKey: avatarKeySchema,
    })
    .safeParse({
      displayName: field(formData, "displayName") ?? "",
      studentNumber: field(formData, "studentNumber") ?? "",
      avatarKey: field(formData, "avatarKey"),
    });
}

export async function createStudent(classId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = studentFields(formData);
  if (!parsed.success || !uuid.safeParse(classId).success) return failed("INVALID_INPUT");
  const name = checkDisplayName(parsed.data.displayName);
  if (!name.ok) return failed("INVALID_INPUT");
  return run((session) =>
    session.supabase.rpc("teacher_create_student", {
      p_class_id: classId,
      p_display_name: name.value,
      p_student_number: parsed.data.studentNumber as number,
      p_avatar_key: parsed.data.avatarKey,
    }),
  );
}

export async function updateStudent(studentId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = studentFields(formData);
  if (!parsed.success || !uuid.safeParse(studentId).success) return failed("INVALID_INPUT");
  const name = checkDisplayName(parsed.data.displayName);
  if (!name.ok) return failed("INVALID_INPUT");
  return run((session) =>
    session.supabase.rpc("teacher_update_student", {
      p_student_id: studentId,
      p_display_name: name.value,
      p_student_number: parsed.data.studentNumber as number,
      p_avatar_key: parsed.data.avatarKey,
    }),
  );
}

export async function setStudentStatus(
  studentId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = z
    .strictObject({ studentId: uuid, status: z.enum(["active", "paused", "archived"]) })
    .safeParse({ studentId, status: field(formData, "status") });
  if (!parsed.success) return failed("INVALID_INPUT");
  return run((session) =>
    session.supabase.rpc("teacher_set_student_status", {
      p_student_id: parsed.data.studentId,
      p_status: parsed.data.status,
    }),
  );
}

export async function setLeaderboardAlias(
  studentId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!uuid.safeParse(studentId).success) return failed("INVALID_INPUT");
  const raw = field(formData, "alias") ?? "";
  let alias: string | null = null;
  if (normalizeName(raw) !== "") {
    const checked = checkLeaderboardAlias(raw);
    if (!checked.ok) return failed("INVALID_INPUT");
    alias = checked.value;
  }
  return run((session) =>
    session.supabase.rpc("teacher_set_leaderboard_alias", { p_student_id: studentId, p_alias: alias as string }),
  );
}

export async function approveLeaderboardAlias(studentId: string): Promise<ActionState> {
  if (!uuid.safeParse(studentId).success) return failed("INVALID_INPUT");
  return run((session) => session.supabase.rpc("teacher_approve_leaderboard_alias", { p_student_id: studentId }));
}

export async function assignBand(studentId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = z
    .strictObject({
      studentId: uuid,
      band: z.enum(["none", "foundation", "developing", "extending"]),
      reason: z.string().transform(normalizeName).pipe(z.string().max(200)),
    })
    .safeParse({ studentId, band: field(formData, "band"), reason: field(formData, "reason") ?? "" });
  if (!parsed.success) return failed("INVALID_INPUT");
  return run((session) =>
    session.supabase.rpc("teacher_assign_band", {
      p_student_id: parsed.data.studentId,
      p_band: (parsed.data.band === "none" ? null : parsed.data.band) as string,
      p_reason: (parsed.data.reason || null) as string,
    }),
  );
}

// ---------------------------------------------------------------------------------------------------------------
// Thẻ học và thiết bị
// ---------------------------------------------------------------------------------------------------------------

export type IssuedCode = {
  joinUrl: string;
  backupCode: string;
  qr: string[];
  expiresAt: string;
  maxDevices: number;
};
export type IssueCodeState =
  { status: "idle" } | { status: "issued"; code: IssuedCode } | { status: "error"; code: ErrorCode };

/**
 * Cấp thẻ học mới (thu hồi thẻ cũ). Mã gốc chỉ tồn tại trong phản hồi này để GV in/ghi lại — CSDL chỉ giữ HMAC,
 * máy chủ không ghi log mã. Hết hạn sau `validDays` ngày; liên kết tối đa `maxDevices` thiết bị (bố, mẹ, máy tính bảng).
 */
export async function issueLoginCode(
  studentId: string,
  _prev: IssueCodeState,
  formData: FormData,
): Promise<IssueCodeState> {
  const parsed = z
    .strictObject({
      studentId: uuid,
      validDays: z.coerce.number().int().min(1).max(30),
      maxDevices: z.coerce.number().int().min(1).max(5),
    })
    .safeParse({ studentId, validDays: field(formData, "validDays"), maxDevices: field(formData, "maxDevices") });
  if (!parsed.success) return { status: "error", code: "INVALID_INPUT" };
  const pepper = process.env.LOGIN_CODE_PEPPER;
  if (!isUsablePepper(pepper)) return { status: "error", code: "NOT_CONFIGURED" };
  const auth = await teacher();
  if (!auth.ok) return { status: "error", code: auth.code };

  const generated = generateLoginCode();
  const expiresAt = new Date(Date.now() + parsed.data.validDays * 24 * 60 * 60 * 1000).toISOString();
  const { error } = await auth.session.supabase.rpc("teacher_issue_login_code", {
    p_student_id: parsed.data.studentId,
    p_token_hmac: toPgBytea(hmacLoginCode(pepper, "token", generated.token)),
    p_backup_code_hmac: toPgBytea(hmacLoginCode(pepper, "backup", generated.backupCode)),
    p_expires_at: expiresAt,
    p_max_devices: parsed.data.maxDevices,
  });
  if (error) return { status: "error", code: mapDbError(error) };

  const joinUrl = `${await siteOrigin()}/join#c=${generated.token}`;
  refresh();
  return {
    status: "issued",
    code: {
      joinUrl,
      backupCode: formatBackupCode(generated.backupCode),
      qr: qrRows(joinUrl),
      expiresAt,
      maxDevices: parsed.data.maxDevices,
    },
  };
}

export async function revokeLoginCode(codeId: string): Promise<ActionState> {
  if (!uuid.safeParse(codeId).success) return failed("INVALID_INPUT");
  return run((session) => session.supabase.rpc("teacher_revoke_login_code", { p_code_id: codeId }));
}

export async function revokeDevice(deviceId: string): Promise<ActionState> {
  if (!uuid.safeParse(deviceId).success) return failed("INVALID_INPUT");
  return run((session) => session.supabase.rpc("teacher_revoke_device", { p_device_id: deviceId }));
}

// ---------------------------------------------------------------------------------------------------------------
// Đồng ý
// ---------------------------------------------------------------------------------------------------------------

const scopeSchema = z.enum(CONSENT_SCOPES);

export async function recordConsent(studentId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = z
    .strictObject({
      studentId: uuid,
      scope: scopeSchema,
      noticeVersion: z.enum(CONSENT_NOTICES.map((notice) => notice.version) as [string, ...string[]]),
      method: z.enum(CONSENT_METHODS),
      note: z.string().transform(normalizeName).pipe(z.string().max(200)),
      attested: z.literal("yes"),
    })
    .safeParse({
      studentId,
      scope: field(formData, "scope"),
      noticeVersion: field(formData, "noticeVersion"),
      method: field(formData, "method"),
      note: field(formData, "note") ?? "",
      attested: field(formData, "attested"),
    });
  if (!parsed.success) {
    return failed(field(formData, "attested") !== "yes" ? "ATTESTATION_REQUIRED" : "INVALID_INPUT");
  }
  return run((session) =>
    session.supabase.rpc("teacher_record_consent", {
      p_student_id: parsed.data.studentId,
      p_scope: parsed.data.scope,
      p_notice_version: parsed.data.noticeVersion,
      p_method: parsed.data.method,
      p_note: (parsed.data.note || null) as string,
      p_attested: true,
    }),
  );
}

export async function withdrawConsent(studentId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = z
    .strictObject({ studentId: uuid, scope: scopeSchema, confirm: z.literal("yes") })
    .safeParse({ studentId, scope: field(formData, "scope"), confirm: field(formData, "confirm") });
  if (!parsed.success) return failed("INVALID_INPUT");
  return run((session) =>
    session.supabase.rpc("teacher_withdraw_consent", {
      p_student_id: parsed.data.studentId,
      p_scope: parsed.data.scope,
    }),
  );
}

// ---------------------------------------------------------------------------------------------------------------
// Bảng xếp hạng (R05)
// ---------------------------------------------------------------------------------------------------------------

/**
 * Bật/tắt bảng điểm của lớp và chọn kiểu hiển thị cho học sinh. Trình duyệt KHÔNG ghi trực tiếp vào `classes`:
 * hàm CSDL `teacher_set_leaderboard_settings` (chỉ GV chủ nhiệm) tự kiểm tra quyền, trigger chặn bật khi cờ hệ thống
 * `leaderboard_feature_approved` chưa được chấp thuận (LEADERBOARD_NOT_APPROVED) và ghi nhật ký cùng giao dịch.
 */
export async function saveLeaderboardSettings(
  classId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = z
    .strictObject({ classId: uuid, enabled: z.boolean(), view: z.enum(["top10_and_me", "full"]) })
    .safeParse({ classId, enabled: field(formData, "enabled") === "on", view: field(formData, "view") });
  if (!parsed.success) return failed("INVALID_INPUT");
  return run((session) =>
    session.supabase.rpc("teacher_set_leaderboard_settings", {
      p_class_id: parsed.data.classId,
      p_enabled: parsed.data.enabled,
      p_student_view: parsed.data.view,
    }),
  );
}
