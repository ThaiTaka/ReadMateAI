import { randomUUID } from "node:crypto";
import { moduleOf, VARIANTS } from "@/features/exercises/registry";
import { VARIANT_IDS, type VariantId } from "@/features/exercises/core/module";
import type { TtsScriptEntry } from "@/server/tts/catalog";
import { buildTtsScriptCatalog, type CatalogItem } from "@/server/tts/catalog";
import { assetKeyOf } from "@/server/tts/hash";
import type { TtsScriptReview } from "@/server/tts/script-review";
import type { TtsProvider } from "@/server/tts/types";
import type { TtsAudioVersion } from "@/server/tts/versions";
import type { TtsVoiceProfile } from "@/server/tts/voice";
import { demoItems, kb } from "../exercises/helpers";
import { wav } from "../audio-library/fixtures";

/** Giọng "đã chọn" GIẢ LẬP chỉ cho kiểm thử — không phải quyết định của chủ dự án/giáo viên. */
export const TEST_VOICE: TtsVoiceProfile = { voiceKey: "vi-female-1", speed: "slow", configVersion: "test-voice-1" };

export const TEACHER_ID = randomUUID();
export const REVIEWED_AT = "2026-10-28T08:00:00.000Z";

export function allItems(): CatalogItem[] {
  const out: CatalogItem[] = [];
  for (const variant of VARIANT_IDS as readonly VariantId[]) {
    for (const band of ["foundation", "developing", "extending"] as const) {
      try {
        for (const item of demoItems(variant, band)) out.push(item);
        break;
      } catch {
        // dải này chưa sinh được bài cho biến thể — thử dải kế tiếp
      }
    }
  }
  return out;
}

export const exposureOf = (item: CatalogItem) =>
  moduleOf(item as Parameters<typeof moduleOf>[0]).audioExposure(item as Parameters<typeof moduleOf>[0], kb);

export function fullCatalog(voice: TtsVoiceProfile = TEST_VOICE) {
  return buildTtsScriptCatalog({ items: allItems(), exposureOf, voice });
}

export function approve(entry: TtsScriptEntry, overrides: Partial<TtsScriptReview> = {}): TtsScriptReview {
  return {
    entryId: entry.id,
    contentHash: entry.contentHash,
    decision: "approved",
    reviewedBy: TEACHER_ID,
    reviewedAt: REVIEWED_AT,
    pronunciationConfirmed: true,
    ...overrides,
  };
}

/** WAV tổng hợp hợp lệ (sóng sin) — nhãn dữ liệu kiểm thử, chỉ dùng trong test. */
export function syntheticWavProvider(id: "mock" | "google" = "mock", seconds = 1): TtsProvider & { calls: number } {
  const state = { calls: 0 };
  return {
    id,
    external: false,
    get calls() {
      return state.calls;
    },
    synthesize: async () => {
      state.calls += 1;
      return { ok: true, data: { bytes: wav(seconds), mimeType: "audio/wav" } };
    },
  };
}

export function versionFor(
  entry: TtsScriptEntry,
  overrides: Partial<TtsAudioVersion> & { voice?: TtsVoiceProfile; provider?: TtsAudioVersion["provider"] } = {},
): TtsAudioVersion {
  const provider = overrides.provider ?? "google";
  const voice = overrides.voice ?? TEST_VOICE;
  return {
    versionId: randomUUID(),
    entryId: entry.id,
    contentHash: entry.contentHash,
    assetKey: assetKeyOf({ providerId: provider, purpose: entry.purpose, text: entry.text, voice }),
    provider,
    voice,
    audio: { sha256: "a".repeat(64), byteLength: 32044, mime: "audio/wav", durationMs: 1000, inspected: true },
    testOnly: false,
    status: "approved",
    reviewedBy: TEACHER_ID,
    reviewedAt: REVIEWED_AT,
    listened: true,
    pronunciationConfirmed: true,
    ...overrides,
  };
}

export { VARIANTS };
