import type { UnitId } from "../../lib/vietnamese/decodability.ts";
import type { ExerciseTypeCode, InstructionIcon, LearningPathId, SupportLevel } from "../../types/learning.ts";
import { findProfile, resolveKnowledgeState } from "../knowledge/curriculum.ts";
import { KNOWLEDGE_BASE } from "../knowledge/default-kb.ts";
import type { KnowledgeBase } from "../knowledge/load.ts";
import type { StimulusContent } from "../exercises/core/audio.ts";
import type { VariantId } from "../exercises/core/module.ts";
import type { GenerationRequest } from "../exercises/generation/context.ts";
import { GENERATOR_VERSION, generateExerciseSet, type ExerciseSet } from "../exercises/generation/generate.ts";
import type { ExerciseItem } from "../exercises/items.ts";
import { VARIANTS } from "../exercises/registry.ts";
import { EXERCISE_TYPES } from "../exercises/catalog.ts";
import { LEARNING_PATHS } from "../learning-paths/catalog.ts";
import {
  DEMO_LESSON_ORDINAL,
  DEMO_MEDIA,
  DEMO_PROFILE_ID,
  DEMO_QUESTIONS,
  demoFixtureReview,
} from "./practice-fixture.ts";

/**
 * Dựng dữ liệu cho trang /demo (chạy phía server lúc build — trình duyệt chỉ nhận các câu đã sinh và đã
 * qua kiểm tra, không nhận kho tri thức). Chế độ `demo`: hồ sơ minh họa, dữ liệu chờ duyệt có cảnh báo,
 * không lưu, không AI.
 *
 * Từ R02 (AD-51) bản chơi thử không còn sinh "bài ở lớp"/phiếu tương đương: mỗi dạng bài chỉ sinh câu luyện tại
 * nhà và một câu ví dụ "Cô làm mẫu". Bộ sinh cặp nhà–lớp (generation/pair.ts) vẫn giữ và có test tới R11.
 */

export const DEMO_SEED = "readmate-demo-v1";

export type DemoActivity = {
  variant: VariantId;
  type: ExerciseTypeCode;
  typeName: string;
  typeOrder: number;
  title: string;
  objectiveDescription: string;
  instruction: { icon: InstructionIcon; text: string };
  audio: { stimulusContent: StimulusContent; rationale: string };
  recommended: boolean;
  status: "ready" | "preview_only" | "unavailable";
  unavailableReason: string | null;
  items: ExerciseItem[];
  example: ExerciseItem | null;
  generation: { requested: number; produced: number; rejectedByCode: Record<string, number> };
};

export type DemoBlock = {
  id: string;
  /** `independent`: thử thách "Tự làm" (H0, không gợi ý) ở cuối buổi luyện. */
  kind: "review" | "practice" | "independent";
  variant: VariantId;
  title: string;
  supportLevel: SupportLevel;
  items: ExerciseItem[];
  previewOnly: boolean;
};

export type DemoPath = {
  id: LearningPathId;
  name: string;
  tagline: string;
  description: string;
  supportLevel: SupportLevel;
  lessonOrdinal: number;
  effectiveLessonOrdinal: number | null;
  activities: DemoActivity[];
  session: DemoBlock[];
};

export type DemoPracticeData = {
  generatorVersion: string;
  datasetVersion: string;
  profileId: string;
  lessonOrdinal: number;
  paths: DemoPath[];
};

type SessionStep = { kind: DemoBlock["kind"]; variant: VariantId; count: number; focusUnits?: UnitId[] };

/** Dạng bài mỗi lộ trình cho chơi thử (đủ sáu dạng) và buổi luyện mẫu (khớp phần giới thiệu ở GĐ2). */
export const DEMO_PLANS: Readonly<
  Record<
    LearningPathId,
    { recommended: readonly VariantId[]; extra: readonly VariantId[]; session: readonly SessionStep[] }
  >
> = {
  "khoi-dong": {
    recommended: [
      "picture_onset",
      "visual_match",
      "picture_build",
      "parts_to_syllable",
      "which_onset",
      "choose_picture",
    ],
    extra: ["listen_letter", "missing_onset", "sentence_picture"],
    session: [
      { kind: "review", variant: "visual_match", count: 2, focusUnits: ["phoneme:b", "phoneme:d"] },
      { kind: "practice", variant: "picture_build", count: 3 },
      { kind: "independent", variant: "picture_onset", count: 2 },
    ],
  },
  "vung-buoc": {
    recommended: [
      "parts_to_syllable",
      "which_rime",
      "find_with_unit",
      "missing_onset",
      "missing_rime",
      "choose_picture",
    ],
    extra: ["picture_onset", "picture_build", "which_tone", "match_pairs", "sentence_picture", "arrange_words"],
    session: [
      { kind: "review", variant: "which_rime", count: 2, focusUnits: ["rime:an", "rime:ang"] },
      { kind: "practice", variant: "missing_rime", count: 3 },
      { kind: "independent", variant: "choose_picture", count: 2 },
    ],
  },
  "tang-toc": {
    recommended: [
      "missing_rime",
      "missing_tone",
      "match_pairs",
      "sentence_picture",
      "comprehension_question",
      "arrange_words",
    ],
    extra: ["picture_onset", "parts_to_syllable", "which_rime", "find_with_unit", "missing_onset", "choose_picture"],
    session: [
      { kind: "review", variant: "match_pairs", count: 1 },
      { kind: "practice", variant: "sentence_picture", count: 3 },
      { kind: "independent", variant: "arrange_words", count: 2 },
    ],
  },
};

const BLOCK_TITLES: Readonly<Record<DemoBlock["kind"], string>> = {
  review: "Ôn bài cũ",
  practice: "Luyện tập",
  independent: "Thử thách tự làm",
};

export function buildDemoPracticeData(kb: KnowledgeBase = KNOWLEDGE_BASE): DemoPracticeData {
  const profile = findProfile(kb, DEMO_PROFILE_ID);
  if (!profile) throw new Error(`Thiếu hồ sơ minh họa ${DEMO_PROFILE_ID} trong content/curriculum/profiles.`);
  const typeInfo = new Map(EXERCISE_TYPES.map((type) => [type.code, type]));

  const paths = LEARNING_PATHS.map((path): DemoPath => {
    const plan = DEMO_PLANS[path.id];
    const supportLevel = path.startingSupport;
    const base: Omit<GenerationRequest, "variant" | "count" | "seed"> = {
      kb,
      profile,
      band: path.band,
      lessonOrdinal: DEMO_LESSON_ORDINAL,
      mode: "demo",
      media: DEMO_MEDIA,
      comprehension: DEMO_QUESTIONS,
      fixtureReview: demoFixtureReview,
      allowPreviewOnly: true,
    };
    const resolved = resolveKnowledgeState(kb, profile, { band: path.band, lessonOrdinal: DEMO_LESSON_ORDINAL });
    const usedKeys = new Map<VariantId, Set<string>>();
    const remember = (variant: VariantId, set: ExerciseSet | null | undefined) => {
      if (!set) return;
      const keys = usedKeys.get(variant) ?? new Set<string>();
      for (const key of set.keys) keys.add(key);
      usedKeys.set(variant, keys);
    };

    const activities = [...plan.recommended, ...plan.extra]
      .map((variant): DemoActivity => {
        const definition = VARIANTS[variant];
        const info = typeInfo.get(definition.type);
        const seed = `${DEMO_SEED}:${path.id}:${variant}`;
        const generated = generateExerciseSet({ ...base, variant, count: 4, minCount: 2, seed });
        const home = generated.ok ? generated.set : null;
        // Câu ví dụ ("Cô làm mẫu") phải khác các câu luyện; cả hai không xuất hiện lại trong buổi luyện mẫu.
        const example = home
          ? generateExerciseSet({
              ...base,
              variant,
              count: 1,
              minCount: 1,
              seed: `${seed}|example`,
              excludeKeys: new Set([...(usedKeys.get(variant) ?? []), ...home.keys]),
            })
          : null;
        if (example?.ok) remember(variant, example.set);
        const homeDiagnostics = generated.ok ? null : generated.diagnostics;
        return {
          variant,
          type: definition.type,
          typeName: info?.name ?? definition.type,
          typeOrder: info?.order ?? 0,
          title: definition.title,
          objectiveDescription: definition.objectiveDescription,
          instruction: { icon: definition.instruction.icon, text: definition.instruction.text },
          audio: {
            stimulusContent: definition.audioPolicy.stimulusContent,
            rationale: definition.audioPolicy.rationale,
          },
          recommended: plan.recommended.includes(variant),
          status: !home ? "unavailable" : home.previewOnly ? "preview_only" : "ready",
          unavailableReason: generated.ok ? null : generated.message,
          items: home?.items ?? [],
          example: example?.ok ? (example.set.items[0] ?? null) : null,
          generation: {
            requested: 4,
            produced: home?.items.length ?? 0,
            rejectedByCode: homeDiagnostics?.rejectedByCode ?? {},
          },
        };
      })
      .sort((a, b) => a.typeOrder - b.typeOrder || Number(b.recommended) - Number(a.recommended));

    const session = plan.session.flatMap((step, index): DemoBlock[] => {
      const result = generateExerciseSet({
        ...base,
        variant: step.variant,
        count: step.count,
        minCount: 1,
        seed: `${DEMO_SEED}:${path.id}:session:${index}`,
        excludeKeys: usedKeys.get(step.variant) ?? new Set(),
        ...(step.focusUnits ? { focusUnits: new Set(step.focusUnits) } : {}),
      });
      if (!result.ok) return [];
      remember(step.variant, result.set);
      return [
        {
          id: `${path.id}-block-${index + 1}`,
          kind: step.kind,
          variant: step.variant,
          title: `${BLOCK_TITLES[step.kind]}: ${VARIANTS[step.variant].title}`,
          supportLevel: step.kind === "independent" ? 0 : supportLevel,
          items: result.set.items,
          previewOnly: result.set.previewOnly,
        },
      ];
    });

    return {
      id: path.id,
      name: path.name,
      tagline: path.tagline,
      description: path.description,
      supportLevel,
      lessonOrdinal: DEMO_LESSON_ORDINAL,
      effectiveLessonOrdinal: resolved.ok ? resolved.state.effectiveLessonOrdinal : null,
      activities,
      session,
    };
  });

  return {
    generatorVersion: GENERATOR_VERSION,
    datasetVersion: kb.datasetVersion,
    profileId: profile.id,
    lessonOrdinal: DEMO_LESSON_ORDINAL,
    paths,
  };
}
