import type { UnitId } from "../../../lib/vietnamese/decodability.ts";
import type { MediaLibrary } from "../core/media.ts";
import type { AudioRole, AudioSlot, ItemAudio } from "../core/primitives.ts";
import type { VariantId } from "../core/module.ts";
import type { ExerciseItem } from "../items.ts";
import { VARIANTS } from "../registry.ts";
import type { GenerationContext } from "./context.ts";
import { shortHash, type Rng } from "./rng.ts";

/**
 * Một ứng viên bài tập: một mục tiêu cụ thể (một tranh, một tiếng, một câu…) kèm cách dựng câu.
 * Mỗi ứng viên được dựng bằng rng riêng (seed + khóa ứng viên) nên thêm/bớt ứng viên khác không làm
 * đổi câu đã sinh — tái lập được.
 */
export type Candidate = {
  /** Khóa mục tiêu (ví dụ `picture:fish`, `syllable:kẻ`) — dùng để loại trùng giữa bài ở nhà và ở lớp. */
  key: string;
  focusUnits: UnitId[];
  difficulty: number;
  build(rng: Rng): ExerciseItem | null;
};

export type CandidateBuilder = (ctx: GenerationContext, variant: VariantId) => Candidate[];

export const OPTION_IDS = ["o1", "o2", "o3", "o4", "o5", "o6"] as const;

export function itemId(variant: VariantId, key: string, seed: string): string {
  return `${variant}.${shortHash(`${seed}|${key}`)}`;
}

/** Xáo phương án (đáp án + nhiễu) và gán mã o1, o2… theo VỊ TRÍ sau khi xáo — mã không tiết lộ đáp án. */
export function shuffleOptions<T extends object>(
  rng: Rng,
  answer: T,
  distractors: ReadonlyArray<{ value: T; tag: string }>,
  prefix = "o",
): { options: Array<T & { id: string }>; answerId: string; distractorTags: Record<string, string> } {
  const entries = rng.shuffle<{ value: T; tag: string | null }>([{ value: answer, tag: null }, ...distractors]);
  const distractorTags: Record<string, string> = {};
  let answerId = "";
  const options = entries.map((entry, index) => {
    const id = `${prefix}${index + 1}`;
    if (entry.tag === null) answerId = id;
    else distractorTags[id] = entry.tag;
    return { ...entry.value, id };
  });
  return { options, answerId, distractorTags };
}

/**
 * Khe âm thanh của câu: lời đọc dự kiến (để soát chống lộ đáp án ngay từ bây giờ) và mã tệp âm thanh trong
 * thư viện media có cùng vai trò + cùng lời đọc. GĐ4 chưa có tệp nào → `assetId: null`; việc tệp đã được
 * duyệt hay chưa do chuỗi kiểm tra quyết định theo chế độ (MISSING_AUDIO).
 */
export function plannedAudio(
  media: MediaLibrary,
  variant: VariantId,
  extra: { stimulus?: string; model?: string },
): ItemAudio {
  const slot = (role: AudioRole, spokenText: string): AudioSlot => ({
    spokenText,
    assetId: media.audio.find((asset) => asset.role === role && asset.spokenText === spokenText)?.id ?? null,
  });
  const audio: ItemAudio = { instruction: slot("instruction", VARIANTS[variant].instruction.spoken) };
  if (extra.stimulus) audio.stimulus = slot("stimulus", extra.stimulus);
  if (extra.model && VARIANTS[variant].audioPolicy.modelAfterGrading) audio.model = slot("model", extra.model);
  return audio;
}

export function objectiveOf(variant: VariantId, focusUnits: UnitId[], ruleIds: string[] = []) {
  return { code: VARIANTS[variant].objective, focusUnits, ruleIds };
}

export function clampDifficulty(value: number): 1 | 2 | 3 | 4 | 5 {
  return Math.min(5, Math.max(1, Math.round(value))) as 1 | 2 | 3 | 4 | 5;
}
