import "server-only";
import { CONSENT_SCOPES, type ConsentRecord, type ConsentScope } from "@/features/consent/consent";
import type { TeacherSession } from "@/server/auth/teacher";

/**
 * Truy vấn đọc cho khu vực GV — luôn bằng client mang JWT của GV (RLS lọc theo lớp mình phụ trách).
 * Không truy vấn nào dùng khóa secret. Không tìm thấy (hoặc không có quyền — RLS trả rỗng) → null.
 */

export type ClassSummary = {
  id: string;
  name: string;
  schoolYear: string;
  status: string;
  role: "owner" | "co_teacher";
  studentCount: number;
  activeSeasonNo: number | null;
};

export async function listMyClasses(session: TeacherSession): Promise<ClassSummary[]> {
  const { data } = await session.supabase
    .from("classes")
    .select(
      "id, name, school_year, status, class_staff(staff_id, role, removed_at), students(id), seasons(seq_no, status)",
    )
    .order("school_year", { ascending: false })
    .order("name");
  return (data ?? []).flatMap((row) => {
    const membership = row.class_staff.find((cs) => cs.staff_id === session.userId && cs.removed_at === null);
    if (!membership) return [];
    return [
      {
        id: row.id,
        name: row.name,
        schoolYear: row.school_year,
        status: row.status,
        role: membership.role === "owner" ? "owner" : "co_teacher",
        studentCount: row.students.length,
        activeSeasonNo: row.seasons.find((season) => season.status === "active")?.seq_no ?? null,
      } satisfies ClassSummary,
    ];
  });
}

export type ClassDetail = ClassSummary & {
  leaderboardEnabled: boolean;
  honorsEnabled: boolean;
  curriculumStatus: "unconfirmed" | "confirmed";
  curriculumSeriesId: string | null;
  currentLessonId: string | null;
  season: { seqNo: number; status: string; rulesVersion: string; startedAt: string } | null;
};

export async function getClassDetail(session: TeacherSession, classId: string): Promise<ClassDetail | null> {
  const { data: row } = await session.supabase
    .from("classes")
    .select(
      "id, name, school_year, status, leaderboard_enabled, honors_enabled, curriculum_status, curriculum_series_id, current_lesson_id, class_staff(staff_id, role, removed_at), students(id), seasons(seq_no, status, rules_version, started_at)",
    )
    .eq("id", classId)
    .maybeSingle();
  if (!row) return null;
  const membership = row.class_staff.find((cs) => cs.staff_id === session.userId && cs.removed_at === null);
  if (!membership) return null;
  const active = row.seasons.find((season) => season.status === "active") ?? null;
  return {
    id: row.id,
    name: row.name,
    schoolYear: row.school_year,
    status: row.status,
    role: membership.role === "owner" ? "owner" : "co_teacher",
    studentCount: row.students.length,
    activeSeasonNo: active?.seq_no ?? null,
    leaderboardEnabled: row.leaderboard_enabled,
    honorsEnabled: row.honors_enabled,
    curriculumStatus: row.curriculum_status === "confirmed" ? "confirmed" : "unconfirmed",
    curriculumSeriesId: row.curriculum_series_id,
    currentLessonId: row.current_lesson_id,
    season: active
      ? {
          seqNo: active.seq_no,
          status: active.status,
          rulesVersion: active.rules_version,
          startedAt: active.started_at,
        }
      : null,
  };
}

export type SeriesOption = {
  id: string;
  key: string;
  title: string;
  seriesKind: string;
  reviewStatus: string;
  lessons: Array<{ id: string; ordinal: number; code: string; title: string; introduces: string[] }>;
};

export async function listCurriculumSeries(session: TeacherSession): Promise<SeriesOption[]> {
  const { data } = await session.supabase
    .from("curriculum_series")
    .select("id, key, title, series_kind, review_status, curriculum_lessons(id, ordinal, code, title, introduces)")
    .neq("review_status", "retired")
    .order("key");
  return (data ?? []).map((row) => ({
    id: row.id,
    key: row.key,
    title: row.title,
    seriesKind: row.series_kind,
    reviewStatus: row.review_status,
    lessons: [...row.curriculum_lessons].sort((a, b) => a.ordinal - b.ordinal),
  }));
}

export type AuditEntry = { id: number; occurredAt: string; action: string; actorKind: string; targetType: string };

/** Nhật ký của lớp — RLS chỉ cho GV chủ nhiệm (owner) đọc. */
export async function listClassAudit(session: TeacherSession, classId: string, limit = 20): Promise<AuditEntry[]> {
  const { data } = await session.supabase
    .from("audit_logs")
    .select("id, occurred_at, action, actor_kind, target_type")
    .eq("class_id", classId)
    .order("occurred_at", { ascending: false })
    .limit(limit);
  return (data ?? []).map((row) => ({
    id: row.id,
    occurredAt: row.occurred_at,
    action: row.action,
    actorKind: row.actor_kind,
    targetType: row.target_type,
  }));
}

export type StudentRow = {
  id: string;
  studentNumber: number | null;
  displayName: string;
  avatarKey: string;
  status: string;
  band: string | null;
  aliasState: "none" | "pending" | "approved";
  consents: Record<ConsentScope, "none" | "granted" | "withdrawn">;
  activeDevices: number;
  hasActiveCode: boolean;
};

function consentSummary(records: ConsentRecord[]): StudentRow["consents"] {
  return Object.fromEntries(
    CONSENT_SCOPES.map((scope) => {
      const forScope = records.filter((record) => record.scope === scope);
      if (forScope.some((record) => record.status === "granted")) return [scope, "granted"];
      return [scope, forScope.length > 0 ? "withdrawn" : "none"];
    }),
  ) as StudentRow["consents"];
}

export async function listClassStudents(session: TeacherSession, classId: string): Promise<StudentRow[]> {
  const { data } = await session.supabase
    .from("students")
    .select(
      "id, student_number, display_name, avatar_key, status, leaderboard_alias, leaderboard_alias_approved_at, student_band_assignments(band, valid_to), guardian_consents(scope, status, recorded_at, withdrawn_at, notice_version), student_devices(id, revoked_at), student_login_codes(id, revoked_at, expires_at)",
    )
    .eq("class_id", classId)
    .order("student_number", { ascending: true, nullsFirst: false })
    .order("display_name");
  const now = Date.now();
  return (data ?? []).map((row) => ({
    id: row.id,
    studentNumber: row.student_number,
    displayName: row.display_name,
    avatarKey: row.avatar_key,
    status: row.status,
    band: row.student_band_assignments.find((assignment) => assignment.valid_to === null)?.band ?? null,
    aliasState: !row.leaderboard_alias ? "none" : row.leaderboard_alias_approved_at ? "approved" : "pending",
    consents: consentSummary(row.guardian_consents.map(toConsentRecord)),
    activeDevices: row.student_devices.filter((device) => device.revoked_at === null).length,
    hasActiveCode: row.student_login_codes.some(
      (code) => code.revoked_at === null && new Date(code.expires_at).getTime() > now,
    ),
  }));
}

function toConsentRecord(row: {
  scope: string;
  status: string;
  recorded_at: string;
  withdrawn_at: string | null;
  notice_version: string;
}): ConsentRecord {
  return {
    scope: row.scope === "leaderboard_display" ? "leaderboard_display" : "learning_data",
    status: row.status === "withdrawn" ? "withdrawn" : "granted",
    recordedAt: row.recorded_at,
    withdrawnAt: row.withdrawn_at,
    noticeVersion: row.notice_version,
  };
}

export type StudentDetail = {
  id: string;
  classId: string;
  className: string;
  studentNumber: number | null;
  displayName: string;
  avatarKey: string;
  status: string;
  leaderboardAlias: string | null;
  aliasApprovedAt: string | null;
  band: string | null;
  consents: ConsentRecord[];
  devices: Array<{
    id: string;
    linkedAt: string;
    lastSeenAt: string | null;
    revokedAt: string | null;
    revokeReason: string | null;
  }>;
  codes: Array<{
    id: string;
    createdAt: string;
    expiresAt: string;
    revokedAt: string | null;
    revokeReason: string | null;
    devicesLinked: number;
    maxDevices: number;
    /** Hết hạn tại thời điểm đọc — chỉ để gắn nhãn; CSDL mới quyết định mã còn dùng được hay không. */
    expired: boolean;
  }>;
};

export async function getStudentDetail(
  session: TeacherSession,
  classId: string,
  studentId: string,
): Promise<StudentDetail | null> {
  const { data: row } = await session.supabase
    .from("students")
    .select(
      "id, class_id, student_number, display_name, avatar_key, status, leaderboard_alias, leaderboard_alias_approved_at, classes(name), student_band_assignments(band, valid_to), guardian_consents(scope, status, recorded_at, withdrawn_at, notice_version), student_devices(id, linked_at, last_seen_at, revoked_at, revoke_reason), student_login_codes(id, created_at, expires_at, revoked_at, revoke_reason, devices_linked, max_devices)",
    )
    .eq("id", studentId)
    .eq("class_id", classId)
    .maybeSingle();
  if (!row) return null;
  const now = Date.now();
  return {
    id: row.id,
    classId: row.class_id,
    className: row.classes?.name ?? "",
    studentNumber: row.student_number,
    displayName: row.display_name,
    avatarKey: row.avatar_key,
    status: row.status,
    leaderboardAlias: row.leaderboard_alias,
    aliasApprovedAt: row.leaderboard_alias_approved_at,
    band: row.student_band_assignments.find((assignment) => assignment.valid_to === null)?.band ?? null,
    consents: row.guardian_consents.map(toConsentRecord),
    devices: [...row.student_devices]
      .sort((a, b) => b.linked_at.localeCompare(a.linked_at))
      .map((device) => ({
        id: device.id,
        linkedAt: device.linked_at,
        lastSeenAt: device.last_seen_at,
        revokedAt: device.revoked_at,
        revokeReason: device.revoke_reason,
      })),
    codes: [...row.student_login_codes]
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map((code) => ({
        id: code.id,
        createdAt: code.created_at,
        expiresAt: code.expires_at,
        revokedAt: code.revoked_at,
        revokeReason: code.revoke_reason,
        devicesLinked: code.devices_linked,
        maxDevices: code.max_devices,
        expired: code.revoked_at === null && new Date(code.expires_at).getTime() <= now,
      })),
  };
}
