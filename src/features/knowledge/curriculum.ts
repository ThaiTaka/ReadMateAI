import type { LanguageConventions, UnitId } from "../../lib/vietnamese/decodability.ts";
import type { Band } from "../../types/learning.ts";
import type { KnowledgeBase } from "./load.ts";
import type { CurriculumProfile, ProfileStatus, Series } from "./schema.ts";

/**
 * Lớp 2 — tiến độ học tập: từ hồ sơ của một lớp (bộ sách + vị trí bài + điều chỉnh của GV)
 * suy ra tập kiến thức đã học, được phép luyện và cần ôn. Thay đổi tiến độ = sửa dữ liệu hồ sơ,
 * không sửa mã (sau GĐ5 hồ sơ nằm trong CSDL, cùng cấu trúc).
 */

export type KnowledgeState = {
  profileId: string;
  profileStatus: ProfileStatus;
  seriesId: string | null;
  /** Vị trí bài của lớp (trước khi điều chỉnh theo nhóm). */
  lessonOrdinal: number | null;
  /** Mốc bài dùng để tính "đã học" cho nhóm này (Nhóm 3 lùi một bài — PRD §10). */
  effectiveLessonOrdinal: number | null;
  band: Band | null;
  /** Đơn vị đã được giới thiệu (theo bộ sách + GV thêm − GV bớt). */
  introduced: ReadonlySet<UnitId>;
  /** Đơn vị được dùng khi chọn ngữ liệu: đã học + (Nhóm 1) đơn vị GV cho phép thêm. */
  allowedForPractice: ReadonlySet<UnitId>;
  /** Đơn vị GV muốn tập trung ôn. */
  reviewFocus: ReadonlySet<UnitId>;
  conventions: LanguageConventions;
  /** Chỉ hồ sơ đã được GV xác nhận mới được dùng để giao bài thật. */
  usableForAssignments: boolean;
};

export type ResolveFailureCode = "PROFILE_HAS_NO_PROGRESS" | "SERIES_NOT_FOUND" | "LESSON_NOT_FOUND";

export type ResolveResult =
  | { ok: true; state: KnowledgeState }
  | { ok: false; code: ResolveFailureCode; message: string; profileStatus: ProfileStatus };

export type ResolveOptions = { band?: Band; lessonOrdinal?: number };

export function findProfile(kb: KnowledgeBase, id: string): CurriculumProfile | undefined {
  return kb.profiles.find((profile) => profile.id === id);
}

export function findSeries(kb: KnowledgeBase, id: string): Series | undefined {
  return kb.series.find((series) => series.id === id);
}

/** Tập đơn vị được giới thiệu ở các bài có thứ tự ≤ `ordinal` của một bộ bài. */
export function unitsIntroducedThrough(series: Series, ordinal: number): Set<UnitId> {
  return new Set(series.lessons.filter((lesson) => lesson.ordinal <= ordinal).flatMap((lesson) => lesson.introduces));
}

/** Bài đầu tiên giới thiệu một đơn vị (hoặc `null` nếu bộ bài không có đơn vị đó). */
export function lessonIntroducing(series: Series, unit: UnitId): number | null {
  return series.lessons.find((lesson) => lesson.introduces.includes(unit))?.ordinal ?? null;
}

export function resolveKnowledgeState(
  kb: KnowledgeBase,
  profile: CurriculumProfile,
  options: ResolveOptions = {},
): ResolveResult {
  const fail = (code: ResolveFailureCode, message: string): ResolveResult => ({
    ok: false,
    code,
    message,
    profileStatus: profile.status,
  });
  const band = options.band ?? null;
  const lessonOrdinal = options.lessonOrdinal ?? profile.currentLessonOrdinal;

  let fromSeries = new Set<UnitId>();
  let effectiveLessonOrdinal: number | null = null;
  if (profile.seriesId !== null) {
    const series = findSeries(kb, profile.seriesId);
    if (!series) return fail("SERIES_NOT_FOUND", `Không tìm thấy bộ bài "${profile.seriesId}".`);
    if (lessonOrdinal === null) {
      return fail("PROFILE_HAS_NO_PROGRESS", "Hồ sơ chưa ghi vị trí bài học hiện tại của lớp.");
    }
    if (!series.lessons.some((lesson) => lesson.ordinal === lessonOrdinal)) {
      return fail("LESSON_NOT_FOUND", `Bộ bài "${series.id}" không có bài số ${lessonOrdinal}.`);
    }
    effectiveLessonOrdinal = band === "foundation" ? lessonOrdinal - 1 : lessonOrdinal;
    fromSeries = unitsIntroducedThrough(series, effectiveLessonOrdinal);
  } else if (profile.additionalTaughtUnits.length === 0) {
    return fail(
      "PROFILE_HAS_NO_PROGRESS",
      "Hồ sơ chưa có bộ sách và chưa có danh sách kiến thức đã học — cần GV xác nhận.",
    );
  }

  const excluded = new Set(profile.excludedUnits);
  const introduced = new Set([...fromSeries, ...profile.additionalTaughtUnits].filter((unit) => !excluded.has(unit)));
  const allowedForPractice = new Set(introduced);
  if (band === "extending") {
    for (const unit of profile.extendingAllowedUnits) allowedForPractice.add(unit);
  }

  return {
    ok: true,
    state: {
      profileId: profile.id,
      profileStatus: profile.status,
      seriesId: profile.seriesId,
      lessonOrdinal,
      effectiveLessonOrdinal,
      band,
      introduced,
      allowedForPractice,
      reviewFocus: new Set(profile.reviewFocusUnits),
      conventions: profile.conventions,
      usableForAssignments: profile.status === "confirmed",
    },
  };
}
