import { buildTtsScriptCatalog, type TtsScriptEntry } from "../tts/catalog.ts";
import { assetKeyOf } from "../tts/hash.ts";
import { LIBRARY_PROVIDER_ID, LIBRARY_VOICE } from "./voice.ts";

/**
 * Các lời đọc CỐ ĐỊNH của thư viện: 17 câu lệnh biến thể + 17 chuỗi phản hồi (danh mục TTS, mọi mục `pending_review` cho tới khi giáo
 * viên duyệt). Không có lời đọc nào chứa dữ liệu học sinh hay đáp án: chữ lấy từ `VARIANTS[…].instruction.spoken` và `vi.practice.feedback`.
 */

export type LibraryEntry = TtsScriptEntry & {
  /** Khóa tệp của cấu hình giọng hiện hành (nhà cung cấp + mục đích + giọng + tốc độ + phiên bản cấu hình + chữ NFC). */
  assetKey: string;
};

const entries: readonly LibraryEntry[] = buildTtsScriptCatalog({ voice: LIBRARY_VOICE })
  .entries.filter((entry) => entry.source.kind !== "exercise_item")
  .map((entry) => ({
    ...entry,
    assetKey: assetKeyOf({
      providerId: LIBRARY_PROVIDER_ID,
      purpose: entry.purpose,
      text: entry.text,
      voice: LIBRARY_VOICE,
    }),
  }));

export const LIBRARY_ENTRIES: readonly LibraryEntry[] = entries;

const BY_ID: ReadonlyMap<string, LibraryEntry> = new Map(entries.map((entry) => [entry.id, entry]));

export function libraryEntry(id: string): LibraryEntry | undefined {
  return BY_ID.get(id);
}

/** Mã lời đọc của câu lệnh chuẩn của một biến thể (`instruction:<biến thể>`). */
export function instructionEntryId(variant: string): string {
  return `instruction:${variant}`;
}
