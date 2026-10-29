import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Result } from "@/server/result";
import { getDeviceSession } from "./session";

/**
 * Hồ sơ kiến thức của học sinh cho bộ máy bài tập (điểm nối cho R04 — Question Instance Service).
 *
 * KẾT QUẢ CHỈ DÙNG Ở MÁY CHỦ: chứa nhóm năng lực — học sinh không bao giờ được thấy (CLAUDE.md §6.4), nên
 * không bao giờ trả nguyên đối tượng này về trình duyệt. `studentId` phải thuộc danh sách liên kết của phiên
 * thiết bị (tra cứu, không tin dữ liệu client). Không tự phát bài học thật khi tiến độ lớp chưa được GV xác nhận:
 * `canUseProductionContent` chỉ true khi `curriculumStatus === "confirmed"` VÀ có đồng ý `learning_data`.
 */

export type StudentLearningContext = {
  studentId: string;
  classId: string;
  band: "foundation" | "developing" | "extending" | null;
  curriculumStatus: "unconfirmed" | "confirmed";
  seriesKey: string | null;
  seriesKind: "textbook" | "illustrative" | "teacher_custom" | null;
  currentLessonOrdinal: number | null;
  learningDataConsent: boolean;
  canUseProductionContent: boolean;
  /** Lý do chưa học thật được (để giao diện chọn câu chữ; không phải dữ liệu cho học sinh xem). */
  blockers: Array<"CURRICULUM_UNCONFIRMED" | "NO_LEARNING_DATA_CONSENT" | "NO_BAND">;
};

export async function getStudentLearningContext(studentId: string): Promise<Result<StudentLearningContext>> {
  const session = await getDeviceSession();
  if (session.state !== "linked") return { ok: false, code: "UNAUTHENTICATED" };
  if (!session.students.some((student) => student.id === studentId)) return { ok: false, code: "FORBIDDEN" };

  const admin = createSupabaseAdminClient();
  if (!admin) return { ok: false, code: "NOT_CONFIGURED" };

  const [{ data: student }, { data: band }, { data: consent }] = await Promise.all([
    admin
      .from("students")
      .select(
        "id, class_id, classes(curriculum_status, curriculum_series:curriculum_series_id(key, series_kind), current_lesson:current_lesson_id(ordinal))",
      )
      .eq("id", studentId)
      .maybeSingle(),
    admin
      .from("student_band_assignments")
      .select("band")
      .eq("student_id", studentId)
      .is("valid_to", null)
      .maybeSingle(),
    admin
      .from("guardian_consents")
      .select("id")
      .eq("student_id", studentId)
      .eq("scope", "learning_data")
      .eq("status", "granted")
      .maybeSingle(),
  ]);
  if (!student || !student.classes) return { ok: false, code: "FORBIDDEN" };

  const cls = student.classes;
  const curriculumStatus = cls.curriculum_status === "confirmed" ? "confirmed" : "unconfirmed";
  const bandValue =
    band?.band === "foundation" || band?.band === "developing" || band?.band === "extending" ? band.band : null;
  const seriesKind = cls.curriculum_series?.series_kind;
  const blockers: StudentLearningContext["blockers"] = [];
  if (curriculumStatus !== "confirmed") blockers.push("CURRICULUM_UNCONFIRMED");
  if (!consent) blockers.push("NO_LEARNING_DATA_CONSENT");
  if (!bandValue) blockers.push("NO_BAND");

  return {
    ok: true,
    data: {
      studentId,
      classId: student.class_id,
      band: bandValue,
      curriculumStatus,
      seriesKey: cls.curriculum_series?.key ?? null,
      seriesKind:
        seriesKind === "textbook" || seriesKind === "illustrative" || seriesKind === "teacher_custom"
          ? seriesKind
          : null,
      currentLessonOrdinal: cls.current_lesson?.ordinal ?? null,
      learningDataConsent: Boolean(consent),
      canUseProductionContent: blockers.length === 0,
      blockers,
    },
  };
}
