import { z } from "zod";
import type { VariantAudioPolicy } from "../../features/exercises/core/audio.ts";
import { decideBeforeGrading } from "../../features/exercises/core/audio.ts";
import type { AudioExposure } from "../../features/exercises/core/leaks.ts";
import type { VariantId } from "../../features/exercises/core/module.ts";
import type { AudioRole, ItemAudio } from "../../features/exercises/core/primitives.ts";
import { VARIANTS } from "../../features/exercises/runtime-registry.ts";
import { vi } from "../../strings/vi.ts";
import type { ExerciseTypeCode, SupportLevel } from "../../types/learning.ts";
import { contentHashOf, nfc, sha256Hex, TTS_CATALOG_VERSION } from "./hash.ts";
import { checkTtsRequest } from "./request.ts";
import { planSlotSynthesis } from "./service.ts";
import { TTS_PURPOSES, type TtsErrorCode, type TtsPurpose } from "./types.ts";
import { PROVISIONAL_VOICE, TTS_VOICE_KEYS, type TtsVoiceProfile } from "./voice.ts";

/**
 * TTS Script Catalog (R10.3b1; docs/AUDIO_ENGINE.md §14.2): danh mục lời đọc có thể chuyển thành giọng nói, LẤY từ
 * câu lệnh chuẩn của biến thể, chuỗi phản hồi cố định và (tùy chọn) các khe âm thanh của câu bài tập đã sinh — không bịa
 * nội dung giáo dục mới, không nhận dữ liệu học sinh (đầu vào chỉ là học liệu/chuỗi cố định).
 *
 * Mọi mục sinh ra ở trạng thái `pending_review`. Danh mục KHÔNG có đường tự duyệt: trạng thái duyệt chỉ được suy từ bản
 * ghi duyệt của giáo viên (script-review.ts). Khe không được phép (âm/vần đơn lẻ, chính sách cấm, làm lộ đáp án) đi vào
 * danh sách `excluded`, không bao giờ vào danh sách hợp lệ — dùng lại `planSlotSynthesis` (AD-35), không có luật thứ hai.
 */

export type TtsAvailability = "auto" | "tap" | "hint_locked" | "forbidden" | "after_grading";

export type TtsUsage = {
  /** `null` = áp dụng cho mọi dạng bài (lời khen, phản hồi chung). */
  type: ExerciseTypeCode | null;
  variantId: VariantId | null;
  role: AudioRole;
  /** Theo mức hỗ trợ H3→H0 (lấy từ `audioPolicy` của biến thể — không tự quyết định). */
  availability: Readonly<Record<SupportLevel, TtsAvailability>>;
};

export type TtsAttentionFlag =
  /** Lời đọc xưng "con"/"em" — chờ giáo viên chọn cách xưng hô (Q-08). */
  | "ADDRESSING_UNDECIDED"
  /** Có từ ngữ phủ định ("chưa đúng", "sai") — giáo viên cân nhắc giọng điệu cho trẻ 6–7 tuổi. */
  | "NEGATIVE_WORDING";

export type TtsSourceKind = "variant_instruction" | "feedback_string" | "exercise_item";

export type TtsScriptEntry = {
  /** Ổn định theo vị trí nguồn (đổi chữ không đổi mã; đổi chữ làm đổi `contentHash`). */
  id: string;
  catalogVersion: number;
  purpose: TtsPurpose;
  /** Vai trò âm thanh chính (đầu tiên trong `usages`). */
  role: AudioRole;
  /** Lời đọc, chuẩn NFC. */
  text: string;
  /** Mục đích sử dụng, tiếng Việt, cho giáo viên. */
  usageNote: string;
  usages: TtsUsage[];
  source: { kind: TtsSourceKind; ref: string; version: string };
  /** Giọng/tốc độ DỰ KIẾN (chưa chọn khi `configVersion` là `provisional-*`). */
  voice: TtsVoiceProfile;
  contentHash: string;
  attention: TtsAttentionFlag[];
  /** Luôn `pending_review` khi mới dựng; trạng thái thật do script-review.ts suy ra từ bản duyệt của giáo viên. */
  reviewStatus: "pending_review";
};

export type TtsExcluded = {
  /** Biến thể và vai trò khe bị loại (không lưu chữ: lời đọc làm lộ đáp án không được nhân bản ra ngoài). */
  variantId: VariantId | null;
  role: AudioRole;
  code: TtsErrorCode;
  textHash: string;
};

export type TtsScriptCatalog = {
  catalogVersion: number;
  entries: TtsScriptEntry[];
  excluded: TtsExcluded[];
};

const voiceSchema = z.strictObject({
  voiceKey: z.enum(TTS_VOICE_KEYS),
  speed: z.enum(["slow", "normal"]),
  configVersion: z.string().min(1),
});

const availabilitySchema = z.enum(["auto", "tap", "hint_locked", "forbidden", "after_grading"]);

/** Lược đồ chặt của một mục — dùng khi đọc lại danh mục từ nơi lưu (không nhận trường lạ như `studentId`). */
export const ttsScriptEntrySchema = z.strictObject({
  id: z.string().min(1),
  catalogVersion: z.number().int().positive(),
  purpose: z.enum(TTS_PURPOSES),
  role: z.enum(["instruction", "stimulus", "options", "model", "feedback"]),
  text: z.string().min(1),
  usageNote: z.string().min(1),
  usages: z
    .array(
      z.strictObject({
        type: z.string().nullable(),
        variantId: z.string().nullable(),
        role: z.enum(["instruction", "stimulus", "options", "model", "feedback"]),
        availability: z.strictObject({
          3: availabilitySchema,
          2: availabilitySchema,
          1: availabilitySchema,
          0: availabilitySchema,
        }),
      }),
    )
    .min(1),
  source: z.strictObject({
    kind: z.enum(["variant_instruction", "feedback_string", "exercise_item"]),
    ref: z.string().min(1),
    version: z.string().min(1),
  }),
  voice: voiceSchema,
  contentHash: z.string().regex(/^[0-9a-f]{64}$/u),
  attention: z.array(z.enum(["ADDRESSING_UNDECIDED", "NEGATIVE_WORDING"])),
  reviewStatus: z.literal("pending_review"),
});

const LEVELS: readonly SupportLevel[] = [3, 2, 1, 0];

export function availabilityOf(policy: VariantAudioPolicy, role: AudioRole): Record<SupportLevel, TtsAvailability> {
  const out = {} as Record<SupportLevel, TtsAvailability>;
  for (const level of LEVELS) {
    if (role === "instruction" || role === "stimulus" || role === "options") {
      const decision = decideBeforeGrading(policy, role, level);
      out[level] = !decision.permitted
        ? "forbidden"
        : decision.countsAsHint
          ? "hint_locked"
          : decision.autoPlay
            ? "auto"
            : "tap";
    } else if (role === "model") {
      out[level] = policy.modelAfterGrading ? "after_grading" : "forbidden";
    } else {
      out[level] = "after_grading";
    }
  }
  return out;
}

const ALL_AFTER_GRADING: Readonly<Record<SupportLevel, TtsAvailability>> = {
  3: "after_grading",
  2: "after_grading",
  1: "after_grading",
  0: "after_grading",
};

const USAGE_NOTES: Readonly<Record<string, string>> = {
  instruction: "Câu hướng dẫn của bài — học sinh nghe để biết phải làm gì.",
  feedback: "Lời phản hồi sau khi học sinh trả lời.",
  picture_name: "Tên tranh — chỉ phát khi mức hỗ trợ của dạng bài cho phép.",
  word: "Đọc mẫu từ — chỉ khi chính sách dạng bài cho phép.",
  sentence: "Đọc mẫu câu — chỉ khi chính sách dạng bài cho phép.",
  model: "Âm thanh đọc mẫu — chỉ phát sau khi câu đã chấm xong.",
};

const ADDRESSING = /(^|[^\p{L}])(con|em)(?![\p{L}])/iu;
const NEGATIVE = /chưa đúng|không đúng|(^|[^\p{L}])sai(?![\p{L}])/iu;

export function attentionFlags(text: string): TtsAttentionFlag[] {
  const flags: TtsAttentionFlag[] = [];
  if (ADDRESSING.test(text)) flags.push("ADDRESSING_UNDECIDED");
  if (NEGATIVE.test(text)) flags.push("NEGATIVE_WORDING");
  return flags;
}

type EntryDraft = {
  id: string;
  purpose: TtsPurpose;
  text: string;
  usage: TtsUsage;
  source: { kind: TtsSourceKind; ref: string };
};

function makeEntry(draft: EntryDraft, voice: TtsVoiceProfile): TtsScriptEntry {
  const text = nfc(draft.text);
  const contentHash = contentHashOf({ purpose: draft.purpose, text });
  return {
    id: draft.id,
    catalogVersion: TTS_CATALOG_VERSION,
    purpose: draft.purpose,
    role: draft.usage.role,
    text,
    usageNote: USAGE_NOTES[draft.purpose] ?? USAGE_NOTES.instruction ?? "",
    usages: [draft.usage],
    source: { ...draft.source, version: `c${TTS_CATALOG_VERSION}.${contentHash.slice(0, 12)}` },
    voice: { ...voice },
    contentHash,
    attention: attentionFlags(text),
    reviewStatus: "pending_review",
  };
}

/** Phần của câu bài tập mà danh mục cần: biến thể và các khe âm thanh. Không có trường học sinh nào. */
export type CatalogItem = { variant: VariantId; audio: ItemAudio };

export type BuildCatalogInput = {
  /** Câu đã sinh (từ kho tri thức/bộ sinh); bỏ qua nếu chỉ cần danh mục tĩnh. */
  items?: readonly CatalogItem[];
  /** Bắt buộc khi có `items`: dạng đáp án không được lộ qua âm thanh (`moduleOf(item).audioExposure`). */
  exposureOf?: (item: CatalogItem) => AudioExposure;
  voice?: TtsVoiceProfile;
};

const PURPOSE_OF_STIMULUS: Readonly<Record<VariantAudioPolicy["stimulusContent"], TtsPurpose>> = {
  none: "picture_name",
  phoneme: "picture_name",
  picture_name: "picture_name",
  syllable: "word",
  word: "word",
  sentence: "sentence",
};

function purposeFor(role: AudioRole, policy: VariantAudioPolicy): TtsPurpose {
  switch (role) {
    case "instruction":
      return "instruction";
    case "feedback":
      return "feedback";
    case "model":
      return "model";
    case "options":
      return "word";
    case "stimulus":
      return PURPOSE_OF_STIMULUS[policy.stimulusContent];
  }
}

const FEEDBACK_FIELDS: ReadonlyArray<{ ref: string; text: string }> = (() => {
  const feedback = vi.practice.feedback;
  return [
    ...feedback.correctTitles.map((text, index) => ({ ref: `correct_title_${index + 1}`, text })),
    { ref: "correct_message", text: feedback.correctMessage },
    { ref: "retry_title", text: feedback.retryTitle },
    ...Object.entries(feedback.retry).map(([key, text]) => ({ ref: `retry.${key}`, text })),
    { ref: "reveal_title", text: feedback.revealTitle },
  ];
})();

/**
 * Dựng danh mục. Hàm thuần theo đầu vào (không đọc môi trường, không gọi mạng, không ghi gì). Kết quả có thứ tự cố định.
 */
export function buildTtsScriptCatalog(input: BuildCatalogInput = {}): TtsScriptCatalog {
  const voice = input.voice ?? PROVISIONAL_VOICE;
  const entries: TtsScriptEntry[] = [];
  const excluded: TtsExcluded[] = [];

  const accept = (draft: EntryDraft): TtsScriptEntry | null => {
    const checked = checkTtsRequest({
      text: draft.text,
      purpose: draft.purpose,
      voiceKey: voice.voiceKey,
      speed: voice.speed,
    });
    if (!checked.ok) {
      excluded.push({
        variantId: draft.usage.variantId,
        role: draft.usage.role,
        code: checked.code,
        textHash: sha256Hex(nfc(draft.text)),
      });
      return null;
    }
    return makeEntry({ ...draft, text: checked.data.text }, voice);
  };

  // 1) Câu lệnh chuẩn của từng biến thể.
  const canonical = new Map<VariantId, string>();
  for (const variant of Object.values(VARIANTS)) {
    const text = nfc(variant.instruction.spoken);
    canonical.set(variant.id, text);
    const plan = planSlotSynthesis({
      role: "instruction",
      slot: { spokenText: text, assetId: null },
      policy: variant.audioPolicy,
      exposure: { forbidden: [] },
    });
    if (!plan.ok) {
      excluded.push({ variantId: variant.id, role: "instruction", code: plan.code, textHash: sha256Hex(text) });
      continue;
    }
    const entry = accept({
      id: `instruction:${variant.id}`,
      purpose: "instruction",
      text,
      usage: {
        type: variant.type,
        variantId: variant.id,
        role: "instruction",
        availability: availabilityOf(variant.audioPolicy, "instruction"),
      },
      source: { kind: "variant_instruction", ref: `variant:${variant.id}` },
    });
    if (entry) entries.push(entry);
  }

  // 2) Chuỗi phản hồi cố định (lời khen, lời nhắc thử lại). Câu có phần động (đáp án) không nằm trong danh mục.
  for (const field of FEEDBACK_FIELDS) {
    const entry = accept({
      id: `feedback:${field.ref}`,
      purpose: "feedback",
      text: field.text,
      usage: { type: null, variantId: null, role: "feedback", availability: ALL_AFTER_GRADING },
      source: { kind: "feedback_string", ref: `strings:practice.feedback.${field.ref}` },
    });
    if (entry) entries.push(entry);
  }

  // 3) Các khe âm thanh của câu bài tập đã sinh (tên tranh, từ, câu, đọc mẫu…), loại bỏ khe bị chính sách chặn.
  if (input.items && input.items.length > 0) {
    if (!input.exposureOf) throw new Error("buildTtsScriptCatalog: thiếu exposureOf khi truyền items");
    const byKey = new Map<string, TtsScriptEntry>();
    for (const item of input.items) {
      const definition = VARIANTS[item.variant];
      const exposure = input.exposureOf(item);
      for (const role of ["instruction", "stimulus", "options", "model", "feedback"] as const) {
        const slot = item.audio[role];
        if (!slot) continue;
        const text = nfc(slot.spokenText);
        if (role === "instruction" && text === canonical.get(item.variant)) continue; // đã có ở bước 1
        const plan = planSlotSynthesis({
          role,
          slot: { ...slot, spokenText: text },
          policy: definition.audioPolicy,
          exposure,
        });
        if (!plan.ok) {
          excluded.push({ variantId: item.variant, role, code: plan.code, textHash: sha256Hex(text) });
          continue;
        }
        const purpose = purposeFor(role, definition.audioPolicy);
        const usage: TtsUsage = {
          type: definition.type,
          variantId: item.variant,
          role,
          availability: availabilityOf(definition.audioPolicy, role),
        };
        const key = `${purpose}|${text}`;
        const existing = byKey.get(key);
        if (existing) {
          if (!existing.usages.some((u) => u.variantId === usage.variantId && u.role === usage.role)) {
            existing.usages.push(usage);
          }
          continue;
        }
        const entry = accept({
          id: `${purpose}:${contentHashOf({ purpose, text }).slice(0, 16)}`,
          purpose,
          text,
          usage,
          source: { kind: "exercise_item", ref: `variant:${item.variant}` },
        });
        if (entry) byKey.set(key, entry);
      }
    }
    entries.push(...[...byKey.values()].sort((a, b) => a.id.localeCompare(b.id)));
  }

  return { catalogVersion: TTS_CATALOG_VERSION, entries, excluded };
}
